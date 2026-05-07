package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type FounderService struct{}

func NewFounderService() *FounderService {
	return &FounderService{}
}

// --- Daily Founder Brief ---

type TopDecision struct {
	ID              uint   `json:"id"`
	Title           string `json:"title"`
	Domain          string `json:"domain"`
	Reason          string `json:"reason"`
	RequestedBy     string `json:"requested_by"`
	DecisionType    string `json:"decision_type"`
	Priority        string `json:"priority"`
	CreatedAt       string `json:"created_at"`
	EscalatedFrom   string `json:"escalated_from"`
	EscalationLevel string `json:"escalation_level"`
	AssigneeName    string `json:"assignee_name"`
}

type ETFStatusSummary struct {
	CEOStatus string `json:"ceo_status"`
	CTOStatus string `json:"cto_status"`
	CFOStatus string `json:"cfo_status"`
}

type DailyFounderBrief struct {
	Date         string           `json:"date"`
	TopDecisions []TopDecision    `json:"top_decisions"`
	ETFSummary   ETFStatusSummary `json:"etf_summary"`
	RiskAlerts   int              `json:"risk_alerts"`
}

func (s *FounderService) GetDailyBrief() DailyFounderBrief {
	today := time.Now().Format("2006-01-02")

	// Founder 레벨로 에스컬레이트된 이슈 또는 P0 또는 최종결정 필요 — 최대 3개
	var issues []models.Issue
	config.DB.Where(
		"(escalation_level = ? OR priority = ? OR requires_final_decision = ?) AND status IN (?, ?)",
		models.EscalationFounder, "P0", true, "open", "in_progress",
	).Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
		Limit(3).
		Find(&issues)

	decisions := make([]TopDecision, 0, len(issues))
	for _, iss := range issues {
		decisionType := "operational"
		if iss.IssueType == "decision" {
			decisionType = "strategic_direction"
		}
		if iss.Priority == "P0" {
			decisionType = "high_risk"
		}

		domain := issueToDomain(iss.IssueType)

		decisions = append(decisions, TopDecision{
			ID:              iss.ID,
			Title:           iss.Title,
			Domain:          domain,
			Reason:          iss.Description,
			RequestedBy:     iss.CreatedByName,
			DecisionType:    decisionType,
			Priority:        iss.Priority,
			CreatedAt:       iss.CreatedAt.Format("2006-01-02"),
			EscalatedFrom:   iss.EscalatedFrom,
			EscalationLevel: iss.EscalationLevel,
			AssigneeName:    iss.AssigneeName,
		})
	}

	// ETF 요약
	etfSummary := s.getETFStatusSummary()

	// 리스크 알림 수
	var riskCount int64
	config.DB.Model(&models.Issue{}).
		Where("priority = ? AND status IN (?, ?)", "P0", "open", "in_progress").
		Count(&riskCount)

	return DailyFounderBrief{
		Date:         today,
		TopDecisions: decisions,
		ETFSummary:   etfSummary,
		RiskAlerts:   int(riskCount),
	}
}

func (s *FounderService) GetTopDecisions() []TopDecision {
	brief := s.GetDailyBrief()
	return brief.TopDecisions
}

// --- ETF Summary ---

type ETFSummaryData struct {
	CEO CEOSummary `json:"ceo"`
	CTO CTOSummary `json:"cto"`
	CFO CFOSummary `json:"cfo"`
}

type CEOSummary struct {
	Bottlenecks     int64 `json:"bottlenecks"`
	DelayedTasks    int64 `json:"delayed_tasks"`
	ApprovalPending int64 `json:"approval_pending"`
}

type CTOSummary struct {
	DocumentationTasks int64 `json:"documentation_tasks"`
	ResearchTasks      int64 `json:"research_tasks"`
	MessageReview      int64 `json:"message_review"`
}

type CFOSummary struct {
	UnsettledCount       int64 `json:"unsettled_count"`
	TaxReviewCount       int64 `json:"tax_review_count"`
	AccountingReviewCount int64 `json:"accounting_review_count"`
}

func (s *FounderService) GetETFSummary() ETFSummaryData {
	// CEO: 병목/지연/승인대기
	var bottlenecks, delayed, approvalPending int64
	config.DB.Model(&models.Issue{}).
		Where("status = ? AND priority IN (?, ?)", "open", "P0", "P1").
		Count(&bottlenecks)
	config.DB.Model(&models.Issue{}).
		Where("status = ? AND created_at < ?", "open", time.Now().Add(-24*time.Hour)).
		Count(&delayed)
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND status = ?", "decision", "open").
		Count(&approvalPending)

	// CTO: role_title 기반으로 사용자 조회
	var ctoUser models.AdminUser
	config.DB.Where("role_title = ?", "cto").First(&ctoUser)
	var docTasks, researchTasks, msgReview int64
	if ctoUser.ID > 0 {
		config.DB.Model(&models.Issue{}).
			Where("assignee_name = ? AND status IN (?, ?)", ctoUser.Name, "open", "in_progress").
			Count(&docTasks)
	}
	researchTasks = 0
	msgReview = 0

	// CFO: role_title 기반으로 사용자 조회
	var cfoUser models.AdminUser
	config.DB.Where("role_title = ?", "cfo").First(&cfoUser)
	var unsettled, taxReview, accountingReview int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND status IN (?, ?)", "settlement", "open", "in_progress").
		Count(&unsettled)
	if cfoUser.ID > 0 {
		config.DB.Model(&models.Issue{}).
			Where("assignee_name = ? AND status IN (?, ?)", cfoUser.Name, "open", "in_progress").
			Count(&taxReview)
	}
	accountingReview = 0

	return ETFSummaryData{
		CEO: CEOSummary{
			Bottlenecks:     bottlenecks,
			DelayedTasks:    delayed,
			ApprovalPending: approvalPending,
		},
		CTO: CTOSummary{
			DocumentationTasks: docTasks,
			ResearchTasks:      researchTasks,
			MessageReview:      msgReview,
		},
		CFO: CFOSummary{
			UnsettledCount:       unsettled,
			TaxReviewCount:       taxReview,
			AccountingReviewCount: accountingReview,
		},
	}
}

func (s *FounderService) getETFStatusSummary() ETFStatusSummary {
	data := s.GetETFSummary()
	return ETFStatusSummary{
		CEOStatus: formatCount("병목", data.CEO.Bottlenecks) + ", " + formatCount("지연", data.CEO.DelayedTasks),
		CTOStatus: formatCount("문서화", data.CTO.DocumentationTasks),
		CFOStatus: formatCount("미정산", data.CFO.UnsettledCount) + ", " + formatCount("세무", data.CFO.TaxReviewCount),
	}
}

func issueToDomain(issueType string) string {
	switch issueType {
	case "settlement":
		return "money"
	case "cleaning", "facility":
		return "property"
	case "guest":
		return "operations"
	case "decision":
		return "strategy"
	default:
		return "operations"
	}
}

func formatCount(label string, count int64) string {
	return label + " " + itoa(count) + "건"
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
