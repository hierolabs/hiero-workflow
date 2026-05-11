package service

import (
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type OpsFeedService struct{}

func NewOpsFeedService() *OpsFeedService {
	return &OpsFeedService{}
}

type FeedItem struct {
	ID        uint   `json:"id"`
	Type      string `json:"type"`      // checkin, checkout, issue_assigned, issue_detected, cleaning, system
	Title     string `json:"title"`
	Detail    string `json:"detail"`
	Severity  string `json:"severity"`  // info, warning, critical
	Assignee  string `json:"assignee"`
	RefID     uint   `json:"ref_id"`
	RefType   string `json:"ref_type"`  // reservation, issue, detection, cleaning_task
	CreatedAt string `json:"created_at"`
}

func (s *OpsFeedService) GetTodayFeed() []FeedItem {
	today := time.Now().Format("2006-01-02")
	items := make([]FeedItem, 0, 50)

	// 1. 오늘 체크인
	var checkIns []models.Reservation
	config.DB.Select("id, guest_name, check_in_date, status, internal_prop_id").
		Where("check_in_date = ? AND status = ?", today, "accepted").
		Find(&checkIns)
	for _, r := range checkIns {
		propName := ""
		if r.InternalPropID != nil {
			var p models.Property
			if config.DB.Select("name, display_name").First(&p, *r.InternalPropID).Error == nil {
				propName = p.DisplayName
				if propName == "" {
					propName = p.Name
				}
			}
		}
		items = append(items, FeedItem{
			Type:    "checkin",
			Title:   fmt.Sprintf("체크인: %s", r.GuestName),
			Detail:  propName,
			Severity: "info",
			RefID:   r.ID,
			RefType: "reservation",
			CreatedAt: today + " 15:00",
		})
	}

	// 2. 오늘 체크아웃
	var checkOuts []models.Reservation
	config.DB.Select("id, guest_name, check_out_date, status, internal_prop_id").
		Where("check_out_date = ? AND status = ?", today, "accepted").
		Find(&checkOuts)
	for _, r := range checkOuts {
		propName := ""
		if r.InternalPropID != nil {
			var p models.Property
			if config.DB.Select("name, display_name").First(&p, *r.InternalPropID).Error == nil {
				propName = p.DisplayName
				if propName == "" {
					propName = p.Name
				}
			}
		}
		items = append(items, FeedItem{
			Type:    "checkout",
			Title:   fmt.Sprintf("체크아웃: %s", r.GuestName),
			Detail:  propName,
			Severity: "info",
			RefID:   r.ID,
			RefType: "reservation",
			CreatedAt: today + " 11:00",
		})
	}

	// 3. 오늘 생성된 이슈 (자동배정 포함)
	var issues []models.Issue
	config.DB.Where("DATE(created_at) = ?", today).
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
		Limit(20).Find(&issues)
	for _, iss := range issues {
		severity := "info"
		if iss.Priority == "P0" {
			severity = "critical"
		} else if iss.Priority == "P1" {
			severity = "warning"
		}
		items = append(items, FeedItem{
			Type:     "issue_assigned",
			Title:    iss.Title,
			Detail:   fmt.Sprintf("[%s] → %s", iss.Priority, iss.AssigneeName),
			Severity: severity,
			Assignee: iss.AssigneeName,
			RefID:    iss.ID,
			RefType:  "issue",
			CreatedAt: iss.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	// 4. 미처리 이슈 감지
	var detections []models.IssueDetection
	config.DB.Where("status = ?", "pending").
		Order("FIELD(severity, 'critical', 'high', 'medium', 'low'), created_at DESC").
		Limit(10).Find(&detections)
	for _, d := range detections {
		severity := "warning"
		if d.Severity == "critical" {
			severity = "critical"
		}
		items = append(items, FeedItem{
			Type:     "issue_detected",
			Title:    fmt.Sprintf("[감지] %s: %s", d.DetectedCategory, d.GuestName),
			Detail:   truncateStr(d.MessageContent, 60),
			Severity: severity,
			RefID:    d.ID,
			RefType:  "detection",
			CreatedAt: d.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	// 5. 오늘 청소 배정
	var cleanings []models.CleaningTask
	config.DB.Where("DATE(scheduled_date) = ?", today).
		Limit(15).Find(&cleanings)
	for _, ct := range cleanings {
		status := "대기"
		if ct.Status == "completed" {
			status = "완료"
		} else if ct.Status == "in_progress" {
			status = "진행중"
		}
		items = append(items, FeedItem{
			Type:     "cleaning",
			Title:    fmt.Sprintf("청소: %s", ct.PropertyName),
			Detail:   fmt.Sprintf("%s · %s", ct.CleanerName, status),
			Severity: "info",
			RefID:    ct.ID,
			RefType:  "cleaning_task",
			CreatedAt: today + " 11:00",
		})
	}

	return items
}

// GetTodaySummary — 오늘 운영 요약 수치
type TodaySummary struct {
	CheckIns       int `json:"check_ins"`
	CheckOuts      int `json:"check_outs"`
	IssuesCreated  int `json:"issues_created"`
	IssuesPending  int `json:"issues_pending"`
	Detections     int `json:"detections"`
	CleaningTasks  int `json:"cleaning_tasks"`
}

func (s *OpsFeedService) GetTodaySummary() TodaySummary {
	today := time.Now().Format("2006-01-02")
	var summary TodaySummary

	var ci, co, ic, ip, det, ct int64
	config.DB.Model(&models.Reservation{}).Where("check_in_date = ? AND status = ?", today, "accepted").Count(&ci)
	config.DB.Model(&models.Reservation{}).Where("check_out_date = ? AND status = ?", today, "accepted").Count(&co)
	config.DB.Model(&models.Issue{}).Where("DATE(created_at) = ?", today).Count(&ic)
	config.DB.Model(&models.Issue{}).Where("status IN (?, ?)", "open", "in_progress").Count(&ip)
	config.DB.Model(&models.IssueDetection{}).Where("status = ?", "pending").Count(&det)
	config.DB.Model(&models.CleaningTask{}).Where("DATE(scheduled_date) = ?", today).Count(&ct)

	summary.CheckIns = int(ci)
	summary.CheckOuts = int(co)
	summary.IssuesCreated = int(ic)
	summary.IssuesPending = int(ip)
	summary.Detections = int(det)
	summary.CleaningTasks = int(ct)
	return summary
}
