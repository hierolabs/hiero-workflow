package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type ExecutionService struct{}

func NewExecutionService() *ExecutionService {
	return &ExecutionService{}
}

type ExecutionDashboard struct {
	Name          string         `json:"name"`
	RoleTitle     string         `json:"role_title"`
	TodayTasks    []models.Issue `json:"today_tasks"`
	DelayedTasks  []models.Issue `json:"delayed_tasks"`
	MyIssues      []models.Issue `json:"my_issues"`
	TodayCount    int64          `json:"today_count"`
	DelayedCount  int64          `json:"delayed_count"`
	ResolvedToday int64          `json:"resolved_today"`
}

func (s *ExecutionService) GetDashboard(roleTitle string) ExecutionDashboard {
	assigneeName := roleTitleToName(roleTitle)
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().Add(-24 * time.Hour)

	var todayTasks, delayedTasks, myIssues []models.Issue

	// 오늘 할 일 (open 상태)
	config.DB.Where("assignee_name = ? AND status = ?", assigneeName, "open").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
		Find(&todayTasks)

	// 지연 업무 (24시간 이상 open)
	config.DB.Where("assignee_name = ? AND status = ? AND created_at < ?", assigneeName, "open", yesterday).
		Order("created_at ASC").
		Find(&delayedTasks)

	// 내가 담당한 이슈 (진행 중)
	config.DB.Where("assignee_name = ? AND status = ?", assigneeName, "in_progress").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
		Find(&myIssues)

	var resolvedToday int64
	config.DB.Model(&models.Issue{}).
		Where("assignee_name = ? AND status IN (?, ?) AND resolved_at >= ?", assigneeName, "resolved", "closed", today).
		Count(&resolvedToday)

	return ExecutionDashboard{
		Name:          assigneeName,
		RoleTitle:     roleTitle,
		TodayTasks:    todayTasks,
		DelayedTasks:  delayedTasks,
		MyIssues:      myIssues,
		TodayCount:    int64(len(todayTasks)),
		DelayedCount:  int64(len(delayedTasks)),
		ResolvedToday: resolvedToday,
	}
}

func roleTitleToName(roleTitle string) string {
	switch roleTitle {
	case "marketing":
		return "이예린"
	case "operations":
		return "오재관"
	case "cleaning_dispatch":
		return "김우현"
	case "field":
		return "김진태"
	case "ceo":
		return "김지훈"
	case "cto":
		return "변유진"
	case "cfo":
		return "박수빈"
	case "founder":
		return "김진우"
	default:
		return ""
	}
}
