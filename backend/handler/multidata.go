package handler

import (
	"fmt"
	"net/http"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type MultidataHandler struct{}

func NewMultidataHandler() *MultidataHandler { return &MultidataHandler{} }

type DataFolder struct {
	Key      string      `json:"key"`
	Label    string      `json:"label"`
	Desc     string      `json:"desc"`
	Total    int64       `json:"total"`
	ThisMonth int64      `json:"this_month"`
	Metrics  []DataMetric `json:"metrics"`
}

type DataMetric struct {
	Label string      `json:"label"`
	Value interface{} `json:"value"`
	Unit  string      `json:"unit"`
}

// GET /admin/multidata
func (h *MultidataHandler) Overview(c *gin.Context) {
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	yearMonth := now.Format("2006-01")

	folders := []DataFolder{}

	// 1. 숙소 (Properties)
	var propTotal, propActive int64
	config.DB.Model(&models.Property{}).Count(&propTotal)
	config.DB.Model(&models.Property{}).Where("status = ?", "active").Count(&propActive)
	folders = append(folders, DataFolder{
		Key: "properties", Label: "숙소", Desc: "관리 중인 공간",
		Total: propTotal,
		Metrics: []DataMetric{
			{Label: "운영 중", Value: propActive, Unit: "채"},
			{Label: "전체", Value: propTotal, Unit: "채"},
		},
	})

	// 2. 예약 (Reservations)
	var resTotal, resMonth, resToday int64
	config.DB.Model(&models.Reservation{}).Count(&resTotal)
	config.DB.Model(&models.Reservation{}).Where("check_in_date >= ?", monthStart).Count(&resMonth)
	today := now.Format("2006-01-02")
	config.DB.Model(&models.Reservation{}).Where("check_in_date = ? AND status = ?", today, "accepted").Count(&resToday)
	var inHouse int64
	config.DB.Model(&models.Reservation{}).Where("check_in_date <= ? AND check_out_date > ? AND status = ?", today, today, "accepted").Count(&inHouse)
	folders = append(folders, DataFolder{
		Key: "reservations", Label: "예약", Desc: "Hostex 동기화 예약",
		Total: resTotal, ThisMonth: resMonth,
		Metrics: []DataMetric{
			{Label: "누적", Value: resTotal, Unit: "건"},
			{Label: "이번 달", Value: resMonth, Unit: "건"},
			{Label: "오늘 체크인", Value: resToday, Unit: "건"},
			{Label: "현재 투숙", Value: inHouse, Unit: "건"},
		},
	})

	// 3. 청소 (Cleaning Tasks)
	var cleanTotal, cleanMonth, cleanToday int64
	config.DB.Model(&models.CleaningTask{}).Count(&cleanTotal)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date >= ?", monthStart).Count(&cleanMonth)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ?", today).Count(&cleanToday)
	folders = append(folders, DataFolder{
		Key: "cleaning", Label: "청소", Desc: "청소 업무 기록",
		Total: cleanTotal, ThisMonth: cleanMonth,
		Metrics: []DataMetric{
			{Label: "누적", Value: cleanTotal, Unit: "건"},
			{Label: "이번 달", Value: cleanMonth, Unit: "건"},
			{Label: "오늘", Value: cleanToday, Unit: "건"},
		},
	})

	// 4. 이슈 (Issues)
	var issueTotal, issueOpen, issueMonth int64
	config.DB.Model(&models.Issue{}).Count(&issueTotal)
	config.DB.Model(&models.Issue{}).Where("status IN ?", []string{"open", "in_progress"}).Count(&issueOpen)
	config.DB.Model(&models.Issue{}).Where("created_at >= ?", monthStart).Count(&issueMonth)
	folders = append(folders, DataFolder{
		Key: "issues", Label: "이슈", Desc: "민원·하자·운영 이슈",
		Total: issueTotal, ThisMonth: issueMonth,
		Metrics: []DataMetric{
			{Label: "누적", Value: issueTotal, Unit: "건"},
			{Label: "미해결", Value: issueOpen, Unit: "건"},
			{Label: "이번 달", Value: issueMonth, Unit: "건"},
		},
	})

	// 5. 거래 (Transactions)
	var txTotal, txMonth int64
	config.DB.Model(&models.HostexTransaction{}).Count(&txTotal)
	config.DB.Model(&models.HostexTransaction{}).Where("year_month = ?", yearMonth).Count(&txMonth)
	var txRevenue, txCost float64
	config.DB.Model(&models.HostexTransaction{}).Where("year_month = ? AND type = ?", yearMonth, "수입").Select("COALESCE(SUM(amount),0)").Scan(&txRevenue)
	config.DB.Model(&models.HostexTransaction{}).Where("year_month = ? AND type = ?", yearMonth, "비용").Select("COALESCE(SUM(amount),0)").Scan(&txCost)
	folders = append(folders, DataFolder{
		Key: "transactions", Label: "거래", Desc: "Hostex CSV 거래 내역",
		Total: txTotal, ThisMonth: txMonth,
		Metrics: []DataMetric{
			{Label: "누적", Value: txTotal, Unit: "건"},
			{Label: "이달 수입", Value: int64(txRevenue), Unit: "원"},
			{Label: "이달 비용", Value: int64(txCost), Unit: "원"},
		},
	})

	// 6. 리드 (Leads)
	var leadTotal, leadNew, leadContracted int64
	config.DB.Model(&models.OutsourcingLead{}).Count(&leadTotal)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "new").Count(&leadNew)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "contracted").Count(&leadContracted)
	folders = append(folders, DataFolder{
		Key: "leads", Label: "위탁영업", Desc: "리드 파이프라인",
		Total: leadTotal,
		Metrics: []DataMetric{
			{Label: "전체", Value: leadTotal, Unit: "건"},
			{Label: "신규", Value: leadNew, Unit: "건"},
			{Label: "계약", Value: leadContracted, Unit: "건"},
		},
	})

	// 7. 게스트 메시지
	var convTotal int64
	var msgTotal int64
	config.DB.Model(&models.Conversation{}).Count(&convTotal)
	config.DB.Model(&models.Message{}).Count(&msgTotal)
	folders = append(folders, DataFolder{
		Key: "messages", Label: "게스트 메시지", Desc: "Hostex 대화 내역",
		Total: msgTotal,
		Metrics: []DataMetric{
			{Label: "대화방", Value: convTotal, Unit: "개"},
			{Label: "메시지", Value: msgTotal, Unit: "건"},
		},
	})

	// 8. 리뷰
	var reviewTotal int64
	config.DB.Model(&models.Review{}).Count(&reviewTotal)
	folders = append(folders, DataFolder{
		Key: "reviews", Label: "리뷰", Desc: "게스트 리뷰 평점",
		Total: reviewTotal,
		Metrics: []DataMetric{
			{Label: "누적", Value: reviewTotal, Unit: "건"},
		},
	})

	// 9. 팀 (Users)
	var userTotal int64
	config.DB.Model(&models.AdminUser{}).Count(&userTotal)
	var cleanerTotal int64
	config.DB.Model(&models.Cleaner{}).Where("active = ?", true).Count(&cleanerTotal)
	folders = append(folders, DataFolder{
		Key: "team", Label: "팀·인력", Desc: "관리자 + 청소자",
		Total: userTotal + cleanerTotal,
		Metrics: []DataMetric{
			{Label: "관리자", Value: userTotal, Unit: "명"},
			{Label: "청소자", Value: cleanerTotal, Unit: "명"},
		},
	})

	// 10. 비용 (Cost Raw)
	var costTotal int64
	config.DB.Model(&models.CostRaw{}).Count(&costTotal)
	var allocTotal int64
	config.DB.Model(&models.CostAllocation{}).Count(&allocTotal)
	folders = append(folders, DataFolder{
		Key: "costs", Label: "비용", Desc: "비용 원본 + 분할 배분",
		Total: costTotal,
		Metrics: []DataMetric{
			{Label: "원본", Value: costTotal, Unit: "건"},
			{Label: "배분", Value: allocTotal, Unit: "건"},
		},
	})

	// 11. Hestory (Wiki)
	var wikiTotal, wikiFilled int64
	config.DB.Model(&models.WikiArticle{}).Count(&wikiTotal)
	config.DB.Model(&models.WikiArticle{}).Where("status != ?", "empty").Count(&wikiFilled)
	folders = append(folders, DataFolder{
		Key: "hestory", Label: "Hestory", Desc: "기술백서 아카이브",
		Total: wikiTotal,
		Metrics: []DataMetric{
			{Label: "전체 섹션", Value: wikiTotal, Unit: "개"},
			{Label: "작성됨", Value: wikiFilled, Unit: "개"},
		},
	})

	// 12. 사업진단
	var diagTotal int64
	config.DB.Model(&models.PropertyBusinessDiagnosis{}).Count(&diagTotal)
	folders = append(folders, DataFolder{
		Key: "diagnosis", Label: "사업진단", Desc: "5엔진 × 25지표",
		Total: diagTotal,
		Metrics: []DataMetric{
			{Label: "진단 숙소", Value: diagTotal, Unit: "개"},
		},
	})

	// 13. 문서 아카이빙
	var docTotal int64
	var docSize float64
	config.DB.Model(&models.Document{}).Count(&docTotal)
	config.DB.Model(&models.Document{}).Select("COALESCE(SUM(file_size),0)").Scan(&docSize)
	folders = append(folders, DataFolder{
		Key: "documents", Label: "문서", Desc: "계약서·보고서·CSV 아카이빙",
		Total: docTotal,
		Metrics: []DataMetric{
			{Label: "파일", Value: docTotal, Unit: "건"},
			{Label: "용량", Value: fmt.Sprintf("%.1f", docSize/1024/1024), Unit: "MB"},
		},
	})

	// 14. 근태/활동 (LocalDB)
	var sessionTotal, sessionToday int64
	var activityTotal int64
	config.LocalDB.Model(&models.UserSession{}).Count(&sessionTotal)
	config.LocalDB.Model(&models.UserSession{}).Where("DATE(login_at) = ?", today).Count(&sessionToday)
	config.LocalDB.Model(&models.UserActivity{}).Count(&activityTotal)
	var actLogTotal int64
	config.LocalDB.Model(&models.ActivityLog{}).Count(&actLogTotal)
	folders = append(folders, DataFolder{
		Key: "attendance", Label: "근태/활동", Desc: "로컬 SQLite 저장",
		Total: sessionTotal,
		Metrics: []DataMetric{
			{Label: "세션 누적", Value: sessionTotal, Unit: "건"},
			{Label: "오늘 세션", Value: sessionToday, Unit: "건"},
			{Label: "활동 기록", Value: activityTotal, Unit: "건"},
			{Label: "업무 로그", Value: actLogTotal, Unit: "건"},
			{Label: "저장소", Value: "로컬 SQLite", Unit: ""},
		},
	})

	// 15. 이슈 감지
	var detTotal, detPending int64
	config.DB.Model(&models.IssueDetection{}).Count(&detTotal)
	config.DB.Model(&models.IssueDetection{}).Where("status = ?", "pending").Count(&detPending)
	folders = append(folders, DataFolder{
		Key: "detections", Label: "이슈 감지", Desc: "고객 메시지 자동 감지",
		Total: detTotal,
		Metrics: []DataMetric{
			{Label: "누적 감지", Value: detTotal, Unit: "건"},
			{Label: "미처리", Value: detPending, Unit: "건"},
		},
	})

	// 16. 운영 대화 히스토리
	var chatWork, chatClean int64
	config.DB.Model(&models.ChatHistory{}).Where("room = ?", "work").Count(&chatWork)
	config.DB.Model(&models.ChatHistory{}).Where("room = ?", "cleaning").Count(&chatClean)
	folders = append(folders, DataFolder{
		Key: "chat_history", Label: "운영 대화", Desc: "단톡방 원본 — 업무지시+청소배정",
		Total: chatWork + chatClean,
		Metrics: []DataMetric{
			{Label: "일하는 방", Value: chatWork, Unit: "건"},
			{Label: "청소 방", Value: chatClean, Unit: "건"},
			{Label: "기간", Value: "2024.08~2026.05", Unit: ""},
		},
	})

	c.JSON(http.StatusOK, gin.H{"folders": folders})
}
