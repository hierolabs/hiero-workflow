package handler

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"time"

	"hiero-workflow/backend/config"

	"github.com/gin-gonic/gin"
)

type InfraHandler struct{}

func NewInfraHandler() *InfraHandler { return &InfraHandler{} }

type TableInfo struct {
	Name     string `json:"name"`
	Rows     int64  `json:"rows"`
	DataMB   float64 `json:"data_mb"`
	IndexMB  float64 `json:"index_mb"`
	Category string `json:"category"`
}

type InfraOverview struct {
	DB         DBInfo      `json:"db"`
	Tables     []TableInfo `json:"tables"`
	Server     ServerInfo  `json:"server"`
	DataSources []DataSource `json:"data_sources"`
}

type DBInfo struct {
	Host     string  `json:"host"`
	Name     string  `json:"name"`
	Version  string  `json:"version"`
	TotalMB  float64 `json:"total_mb"`
	TableCount int   `json:"table_count"`
	TotalRows  int64 `json:"total_rows"`
	Region   string  `json:"region"`
	Engine   string  `json:"engine"`
}

type ServerInfo struct {
	GoVersion string `json:"go_version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	Port      string `json:"port"`
	Uptime    string `json:"uptime"`
}

type DataSource struct {
	Name   string `json:"name"`
	Type   string `json:"type"` // webhook, csv_upload, manual, ai_auto, seed
	Target string `json:"target"`
	Desc   string `json:"desc"`
}

var serverStartTime = time.Now()

// GET /admin/infra
func (h *InfraHandler) Overview(c *gin.Context) {
	dbName := os.Getenv("DB_NAME")
	dbHost := os.Getenv("DB_HOST")

	// DB version
	var version string
	config.DB.Raw("SELECT VERSION()").Scan(&version)

	// Table stats
	type tableStat struct {
		TableName  string  `gorm:"column:TABLE_NAME"`
		TableRows  int64   `gorm:"column:TABLE_ROWS"`
		DataLength float64 `gorm:"column:DATA_LENGTH"`
		IndexLength float64 `gorm:"column:INDEX_LENGTH"`
	}
	var stats []tableStat
	config.DB.Raw(`
		SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
		FROM information_schema.tables
		WHERE TABLE_SCHEMA = ?
		ORDER BY DATA_LENGTH DESC`, dbName).Scan(&stats)

	// Category map
	catMap := map[string]string{
		"properties": "운영", "reservations": "운영", "cleaning_tasks": "운영",
		"cleaning_codes": "운영", "cleaners": "운영", "conversations": "운영",
		"messages": "운영", "reviews": "운영", "guest_requests": "운영",
		"hostex_transactions": "재무", "cost_raw": "재무", "cost_allocations": "재무",
		"monthly_property_reports": "재무", "property_costs": "재무",
		"issues": "워크플로우", "issue_detections": "워크플로우", "tasks": "워크플로우",
		"checklist_items": "워크플로우", "communication_logs": "워크플로우", "webhook_logs": "워크플로우",
		"admin_users": "조직·인사", "roles": "조직·인사", "permissions": "조직·인사",
		"role_permissions": "조직·인사", "user_roles": "조직·인사",
		"user_sessions": "조직·인사", "user_activities": "조직·인사",
		"activity_logs": "조직·인사", "notifications": "조직·인사",
		"outsourcing_leads": "마케팅", "lead_activity_logs": "마케팅",
		"campaigns": "마케팅", "message_templates": "마케팅",
		"ai_conversations": "AI·지식", "ai_memories": "AI·지식",
		"wiki_articles": "AI·지식", "wiki_revisions": "AI·지식",
		"manual_entries": "AI·지식", "property_business_diagnoses": "AI·지식",
		"chat_channels": "협업", "chat_messages": "협업", "chat_channel_members": "협업",
	}

	tables := []TableInfo{}
	var totalMB float64
	var totalRows int64
	for _, s := range stats {
		dataMB := s.DataLength / 1024 / 1024
		idxMB := s.IndexLength / 1024 / 1024
		totalMB += dataMB + idxMB
		totalRows += s.TableRows
		cat := catMap[s.TableName]
		if cat == "" {
			cat = "기타"
		}
		tables = append(tables, TableInfo{
			Name: s.TableName, Rows: s.TableRows,
			DataMB: float64(int(dataMB*100)) / 100,
			IndexMB: float64(int(idxMB*100)) / 100,
			Category: cat,
		})
	}

	uptime := time.Since(serverStartTime).Round(time.Second).String()

	result := InfraOverview{
		DB: DBInfo{
			Host:       dbHost,
			Name:       dbName,
			Version:    fmt.Sprintf("MySQL %s", version),
			TotalMB:    float64(int(totalMB*100)) / 100,
			TableCount: len(stats),
			TotalRows:  totalRows,
			Region:     "ap-northeast-2 (서울)",
			Engine:     "AWS RDS",
		},
		Tables: tables,
		Server: ServerInfo{
			GoVersion: runtime.Version(),
			OS:        runtime.GOOS,
			Arch:      runtime.GOARCH,
			Port:      os.Getenv("PORT"),
			Uptime:    uptime,
		},
		DataSources: []DataSource{
			{Name: "Hostex Webhook", Type: "webhook", Target: "reservations, properties, conversations, messages, reviews", Desc: "자동 — 예약 생성/변경/취소 시 실시간 수신"},
			{Name: "Hostex CSV", Type: "csv_upload", Target: "hostex_transactions", Desc: "수동 — 관리자가 Hostex에서 CSV 다운 후 업로드"},
			{Name: "관리자 입력", Type: "manual", Target: "issues, cleaning_tasks, leads, costs, wiki_articles", Desc: "수동 — Admin UI에서 직접 생성/편집"},
			{Name: "AI 자동 생성", Type: "ai_auto", Target: "ai_conversations, ai_memories, issue_detections, diagnoses", Desc: "자동 — GPT-4o-mini 분석, 메시지 이슈 감지"},
			{Name: "시드 데이터", Type: "seed", Target: "admin_users, roles, cleaning_codes, cleaners, wiki_articles", Desc: "자동 — 서버 시작 시 초기 데이터 생성"},
			{Name: "근태 자동 추적", Type: "auto_track", Target: "user_sessions, user_activities", Desc: "자동 — 로그인/로그아웃/5분 하트비트"},
			{Name: "문서 아카이빙", Type: "file_upload", Target: "documents + ./uploads/", Desc: "수동 — 계약서·보고서·CSV 원본 로컬 저장"},
		},
	}

	c.JSON(http.StatusOK, result)
}
