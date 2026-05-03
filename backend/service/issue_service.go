package service

import (
	"errors"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type IssueService struct{}

func NewIssueService() *IssueService {
	return &IssueService{}
}

// --- 이슈 유형별 자동 배정 규칙 ---
// 실제 배정은 AdminUser ID 기반이지만, 1차에서는 이름만 저장

var DefaultAssignees = map[string]string{
	models.IssueTypeCleaning:   "우연",
	models.IssueTypeFacility:   "김진태",
	models.IssueTypeGuest:      "오재관",
	models.IssueTypeSettlement: "박수빈",
	models.IssueTypeDecision:   "김진우",
	models.IssueTypeOther:      "",
}

// Create — 이슈 생성 (유형에 따라 자동 배정)
func (s *IssueService) Create(issue models.Issue) (models.Issue, error) {
	issue.Status = models.IssueStatusOpen

	// 담당자 자동 배정
	if issue.AssigneeName == "" {
		if assignee, ok := DefaultAssignees[issue.IssueType]; ok {
			issue.AssigneeName = assignee
		}
	}

	// 우선순위 기본값
	if issue.Priority == "" {
		issue.Priority = models.IssuePriorityP2
	}

	if err := config.DB.Create(&issue).Error; err != nil {
		return issue, err
	}

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

func (s *IssueService) UpdateStatus(id uint, status string) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}

	if !models.ValidIssueStatuses[status] {
		return issue, ErrInvalidStatus
	}

	issue.Status = status
	if status == models.IssueStatusResolved || status == models.IssueStatusClosed {
		now := time.Now()
		issue.ResolvedAt = &now
	}

	config.DB.Save(&issue)
	return issue, nil
}

// UpdateAssignee — 담당자 변경
func (s *IssueService) UpdateAssignee(id uint, assigneeName string) (models.Issue, error) {
	var issue models.Issue
	if err := config.DB.First(&issue, id).Error; err != nil {
		return issue, ErrNotFound
	}

	issue.AssigneeName = assigneeName
	config.DB.Save(&issue)
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
	config.DB.Model(&models.Issue{}).Count(&summary.Total)
	config.DB.Model(&models.Issue{}).Where("status = ?", "open").Count(&summary.Open)
	config.DB.Model(&models.Issue{}).Where("status = ?", "in_progress").Count(&summary.InProgress)
	config.DB.Model(&models.Issue{}).Where("status = ?", "resolved").Count(&summary.Resolved)
	return summary
}

var ErrInvalidStatus = errors.New("invalid_status")
