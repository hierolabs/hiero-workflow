package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type IssueService struct {
	notifSvc *NotificationService
}

func NewIssueService() *IssueService {
	return &IssueService{notifSvc: NewNotificationService()}
}

// --- 이슈 유형별 자동 배정 규칙 (최신 조직구조) ---

// Create — 이슈 생성 (유형에 따라 자동 배정)
func (s *IssueService) Create(issue models.Issue) (models.Issue, error) {
	issue.Status = models.IssueStatusOpen

	// 담당자 자동 배정 — AssignIssueByType 사용
	if issue.AssigneeName == "" {
		target := AssignIssueByType(issue.IssueType)
		issue.AssigneeName = target.Name
	}

	// 우선순위 기본값
	if issue.Priority == "" {
		issue.Priority = models.IssuePriorityP2
	}

	// 즉결 처리 판정
	issue.ApprovalLevel = models.CalcApprovalLevel(issue.EstimatedCost)
	if issue.ApprovalLevel == "auto" && issue.EstimatedCost > 0 {
		issue.AutoApproved = true
		issue.Status = models.IssueStatusInProgress // 즉결 → 바로 진행
	}
	// 금액 기반 자동 에스컬레이션
	if issue.ApprovalLevel == "etf" {
		issue.EscalationLevel = models.EscalationETF
	} else if issue.ApprovalLevel == "founder" {
		issue.EscalationLevel = models.EscalationFounder
		issue.RequiresFinalDecision = true
	}

	if err := config.DB.Create(&issue).Error; err != nil {
		return issue, err
	}

	// 알림: 배정된 담당자에게
	if issue.AssigneeName != "" {
		notifTitle := "새 이슈 배정"
		if issue.AutoApproved {
			notifTitle = "즉결 처리 이슈"
		}
		s.notifSvc.NotifyByName(issue.AssigneeName, models.NotifTypeAssigned,
			notifTitle, issue.Title, &issue.ID, "시스템")
	}
	// 금액 기반 ETF/Founder 자동 알림
	if issue.ApprovalLevel == "etf" {
		s.notifSvc.NotifyByRoleTitle("cfo", models.NotifTypeEscalated,
			"비용 승인 필요", fmt.Sprintf("%s (%d원)", issue.Title, issue.EstimatedCost), &issue.ID, issue.AssigneeName)
	} else if issue.ApprovalLevel == "founder" {
		s.notifSvc.NotifyByRoleTitle("founder", models.NotifTypeEscalated,
			"고액 승인 필요", fmt.Sprintf("%s (%d원)", issue.Title, issue.EstimatedCost), &issue.ID, issue.AssigneeName)
	}
	// 로그
	costInfo := ""
	if issue.EstimatedCost > 0 {
		costInfo = fmt.Sprintf(" [%d원, %s]", issue.EstimatedCost, issue.ApprovalLevel)
	}
	LogActivity(nil, "시스템", models.ActionIssueCreated, "issue", &issue.ID,
		"이슈 생성: "+issue.Title+" → "+issue.AssigneeName+costInfo)

	return issue, nil
}

// CreateFromCleaningTask — 청소 문제에서 이슈 자동 생성
func (s *IssueService) CreateFromCleaningTask(task models.CleaningTask, description string) (models.Issue, error) {
	issue := models.Issue{
		PropertyID:      task.PropertyID,
		ReservationID:   task.ReservationID,
		CleaningTaskID:  &task.ID,
		ReservationCode: task.ReservationCode,
		Title:           "청소 문제: " + task.PropertyCode + " " + task.PropertyName,
		Description:     description,
		IssueType:       models.IssueTypeCleaning,
		Priority:        models.IssuePriorityP1,
		PropertyName:    task.PropertyName,
		PropertyCode:    task.PropertyCode,
	}

	return s.Create(issue)
}

// --- 목록 조회 ---

type IssueListQuery struct {
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
	Status     string `form:"status"`
	IssueType  string `form:"issue_type"`
	Priority   string `form:"priority"`
	PropertyID uint   `form:"property_id"`
	Keyword    string `form:"keyword"`
}

func (q *IssueListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
}

type IssueListResult struct {
	Issues     []models.Issue `json:"issues"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

func (s *IssueService) List(query IssueListQuery) (IssueListResult, error) {
	query.Normalize()

	db := config.DB.Model(&models.Issue{})

	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.IssueType != "" {
		db = db.Where("issue_type = ?", query.IssueType)
	}
	if query.Priority != "" {
		db = db.Where("priority = ?", query.Priority)
	}
	if query.PropertyID > 0 {
		db = db.Where("property_id = ?", query.PropertyID)
	}
	if query.Keyword != "" {
		kw := "%" + strings.TrimSpace(query.Keyword) + "%"
		db = db.Where("title LIKE ? OR description LIKE ? OR property_name LIKE ?", kw, kw, kw)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return IssueListResult{}, err
	}

	var issues []models.Issue
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
		Offset(offset).Limit(query.PageSize).
		Find(&issues).Error; err != nil {
		return IssueListResult{}, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return IssueListResult{
		Issues:     issues,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// --- 상태 변경 ---

func (s *IssueService) UpdateStatus(id uint, status string, resolution string) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}

	if !models.ValidIssueStatuses[status] {
		return issue, ErrInvalidStatus
	}

	oldStatus := issue.Status
	issue.Status = status
	if resolution != "" {
		issue.Resolution = resolution
	}
	if status == models.IssueStatusResolved || status == models.IssueStatusClosed {
		now := time.Now()
		issue.ResolvedAt = &now
	}

	config.DB.Save(&issue)

	// 알림: 해결 시 생성자에게
	if (status == models.IssueStatusResolved || status == models.IssueStatusClosed) && issue.CreatedByID != nil {
		s.notifSvc.NotifyUser(*issue.CreatedByID, models.NotifTypeResolved,
			"이슈 해결됨", issue.Title, &issue.ID, nil, issue.AssigneeName)
	}
	// 로그
	LogActivity(nil, issue.AssigneeName, models.ActionStatusChanged, "issue", &issue.ID,
		oldStatus+" → "+status+": "+issue.Title)

	return issue, nil
}

// UpdateAssignee — 담당자 변경 (+ escalation_level 자동 조정)
func (s *IssueService) UpdateAssignee(id uint, assigneeName string) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}

	oldAssignee := issue.AssigneeName
	issue.AssigneeName = assigneeName

	// 새 담당자의 role_layer를 조회해서 escalation_level 자동 조정
	var user models.AdminUser
	if err := config.DB.Where("name = ?", assigneeName).First(&user).Error; err == nil {
		issue.EscalationLevel = user.RoleLayer
	}

	config.DB.Save(&issue)

	// 알림: 새 담당자에게
	s.notifSvc.NotifyByName(assigneeName, models.NotifTypeDelegated,
		"업무 배정", issue.Title, &issue.ID, oldAssignee)
	// 로그
	LogActivity(nil, oldAssignee, models.ActionIssueAssigned, "issue", &issue.ID,
		"담당자 변경: "+oldAssignee+" → "+assigneeName+": "+issue.Title)

	return issue, nil
}

// GetByID — 이슈 상세 조회
func (s *IssueService) GetByID(id uint) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}
	return issue, nil
}

// 이슈 요약
type IssueSummary struct {
	Total      int64 `json:"total"`
	Open       int64 `json:"open"`
	InProgress int64 `json:"in_progress"`
	Resolved   int64 `json:"resolved"`
}

func (s *IssueService) GetSummary() IssueSummary {
	var summary IssueSummary

	// 단일 GROUP BY 쿼리로 통합 (4개 COUNT → 1개)
	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	config.DB.Model(&models.Issue{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&rows)

	for _, r := range rows {
		summary.Total += r.Count
		switch r.Status {
		case "open":
			summary.Open = r.Count
		case "in_progress":
			summary.InProgress = r.Count
		case "resolved":
			summary.Resolved = r.Count
		}
	}

	return summary
}

// EscalateIssue — 이슈를 한 단계 위로 에스컬레이트
// execution → etf, etf → founder
func (s *IssueService) EscalateIssue(id uint, currentRoleLayer string, currentRoleTitle string) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}

	now := time.Now()
	issue.EscalatedFrom = currentRoleTitle
	issue.EscalatedAt = &now

	switch currentRoleLayer {
	case "execution":
		// execution → etf: 이슈 유형 기반 ETF 담당자 매핑
		issue.EscalationLevel = models.EscalationETF
		target := mapToETF(issue.IssueType)
		// role_title로 실제 사용자 조회
		var user models.AdminUser
		if err := config.DB.Where("role_title = ?", target).First(&user).Error; err == nil {
			issue.AssigneeName = user.Name
			issue.AssigneeID = &user.ID
		}

	case "etf":
		// etf → founder
		issue.EscalationLevel = models.EscalationFounder
		var user models.AdminUser
		if err := config.DB.Where("role_title = ?", "founder").First(&user).Error; err == nil {
			issue.AssigneeName = user.Name
			issue.AssigneeID = &user.ID
		}

	default:
		return issue, errors.New("cannot_escalate_from_this_layer")
	}

	config.DB.Save(&issue)

	// 알림: 새 담당자에게
	s.notifSvc.NotifyByName(issue.AssigneeName, models.NotifTypeEscalated,
		"에스컬레이트됨", issue.Title, &issue.ID, currentRoleTitle)
	// 로그
	LogActivity(nil, currentRoleTitle, models.ActionIssueEscalated, "issue", &issue.ID,
		currentRoleLayer+" → "+issue.EscalationLevel+": "+issue.Title)

	return issue, nil
}

// mapToETF — 이슈 유형별 ETF 역할 매핑
func mapToETF(issueType string) string {
	switch issueType {
	case "settlement", "settlement_missing", "transaction_review",
		"account_mapping_review", "tax_question", "unpaid_rent", "partner_payment_issue":
		return "cfo"
	case "research_needed", "message_inconsistent", "business_plan_update",
		"blog_article_needed", "manual_update_needed", "moro_concept_needed":
		return "cto"
	default:
		return "ceo"
	}
}

var ErrInvalidStatus = errors.New("invalid_status")
