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

	// GOT 관제탑 — 3카테고리별 분류
	CategoryDecisions map[string][]TopDecision `json:"category_decisions"`

	// GOT ↔ ETF 지시/보고 현황
	GotDirectivesSent     int64 `json:"got_directives_sent"`      // GOT→ETF 보낸 지시
	GotDirectivesPending  int64 `json:"got_directives_pending"`   // 미완료
	EtfReportsReceived    int64 `json:"etf_reports_received"`     // ETF→GOT 보고 수신
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

	// 3카테고리별 분류
	categoryMap := map[string][]TopDecision{
		"revenue":  {},  // 매출/가격
		"risk":     {},  // 운영/리스크
		"strategy": {},  // 조직/전략
	}
	for _, d := range decisions {
		switch d.Domain {
		case "money", "property":
			categoryMap["revenue"] = append(categoryMap["revenue"], d)
		case "operations", "risk":
			categoryMap["risk"] = append(categoryMap["risk"], d)
		default:
			categoryMap["strategy"] = append(categoryMap["strategy"], d)
		}
	}

	// GOT ↔ ETF directive 현황
	var gotSent, gotPending, etfReports int64
	config.DB.Model(&models.ETFDirective{}).
		Where("from_role = ?", "founder").Count(&gotSent)
	config.DB.Model(&models.ETFDirective{}).
		Where("from_role = ? AND status IN (?, ?, ?)", "founder", "pending", "acknowledged", "in_progress").
		Count(&gotPending)
	config.DB.Model(&models.ETFDirective{}).
		Where("to_role = ? AND type = ?", "founder", "report").Count(&etfReports)

	return DailyFounderBrief{
		Date:                  today,
		TopDecisions:          decisions,
		ETFSummary:            etfSummary,
		RiskAlerts:            int(riskCount),
		CategoryDecisions:     categoryMap,
		GotDirectivesSent:     gotSent,
		GotDirectivesPending:  gotPending,
		EtfReportsReceived:    etfReports,
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

// --- GOT 3카테고리 순환 분석 ---

type CategoryCycle struct {
	// 각 카테고리별 현황
	Categories map[string]CategoryStat `json:"categories"`
	// 순환 흐름 (카테고리 간 전이)
	Flows []CategoryFlow `json:"flows"`
	// 현재 순환 위치 (가장 긴장도가 높은 카테고리)
	HotSpot string `json:"hot_spot"`
	// 순환 상태 메시지
	CycleStatus string `json:"cycle_status"`
}

type CategoryStat struct {
	Label       string `json:"label"`
	Question    string `json:"question"`
	ActiveCount int64  `json:"active_count"`  // 활성 이슈 수
	ResolvedWeek int64 `json:"resolved_week"` // 이번 주 해결
	Tension     int    `json:"tension"`       // 긴장도 0~100
	TopIssue    string `json:"top_issue"`     // 대표 이슈 제목
}

type CategoryFlow struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Label    string `json:"label"`
	Count    int64  `json:"count"`    // 실제 전이 건수
	Examples string `json:"examples"` // 대표 예시
}

func (s *FounderService) GetCycleAnalysis() CategoryCycle {
	weekAgo := time.Now().AddDate(0, 0, -7)

	// --- 카테고리별 현황 집계 ---

	// revenue: settlement, cleaning(비용), facility(수선비)
	var revActive, revResolved int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?) AND status IN (?, ?)", "settlement", "facility", "open", "in_progress").
		Count(&revActive)
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?) AND status IN (?, ?) AND resolved_at >= ?", "settlement", "facility", "resolved", "closed", weekAgo).
		Count(&revResolved)
	var revTopIssue models.Issue
	config.DB.Where("issue_type IN (?, ?) AND status IN (?, ?)", "settlement", "facility", "open", "in_progress").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").First(&revTopIssue)

	// risk: guest, cleaning(운영), other
	var riskActive, riskResolved int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?, ?) AND status IN (?, ?)", "guest", "cleaning", "other", "open", "in_progress").
		Count(&riskActive)
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?, ?) AND status IN (?, ?) AND resolved_at >= ?", "guest", "cleaning", "other", "resolved", "closed", weekAgo).
		Count(&riskResolved)
	var riskTopIssue models.Issue
	config.DB.Where("issue_type IN (?, ?, ?) AND status IN (?, ?)", "guest", "cleaning", "other", "open", "in_progress").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").First(&riskTopIssue)

	// strategy: decision
	var stratActive, stratResolved int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND status IN (?, ?)", "decision", "open", "in_progress").
		Count(&stratActive)
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND status IN (?, ?) AND resolved_at >= ?", "decision", "resolved", "closed", weekAgo).
		Count(&stratResolved)
	var stratTopIssue models.Issue
	config.DB.Where("issue_type = ? AND status IN (?, ?)", "decision", "open", "in_progress").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").First(&stratTopIssue)

	// 긴장도 계산 (활성 이슈 수 기반, 100 = 매우 높음)
	revTension := calcTension(revActive, revResolved)
	riskTension := calcTension(riskActive, riskResolved)
	stratTension := calcTension(stratActive, stratResolved)

	categories := map[string]CategoryStat{
		"revenue": {
			Label: "매출 · 가격", Question: "돈이 되는가, 가격이 맞나",
			ActiveCount: revActive, ResolvedWeek: revResolved,
			Tension: revTension, TopIssue: revTopIssue.Title,
		},
		"risk": {
			Label: "운영 · 리스크", Question: "현장이 돌아가는가, 위험은 없나",
			ActiveCount: riskActive, ResolvedWeek: riskResolved,
			Tension: riskTension, TopIssue: riskTopIssue.Title,
		},
		"strategy": {
			Label: "조직 · 전략", Question: "왜 이걸 하는가, 방향이 맞나",
			ActiveCount: stratActive, ResolvedWeek: stratResolved,
			Tension: stratTension, TopIssue: stratTopIssue.Title,
		},
	}

	// --- 순환 흐름 (카테고리 간 전이 감지) ---
	// 전략 결정 → 매출 영향: decision 이슈 해결 후 settlement 이슈 발생
	var stratToRev int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?) AND status IN (?, ?) AND created_at >= ?",
			"settlement", "facility", "open", "in_progress", weekAgo).
		Count(&stratToRev)

	// 매출 활동 → 운영 리스크: settlement/facility 이슈 있으면서 guest/cleaning 이슈 동시 발생
	var revToRisk int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type IN (?, ?, ?) AND status IN (?, ?) AND created_at >= ?",
			"guest", "cleaning", "other", "open", "in_progress", weekAgo).
		Count(&revToRisk)

	// 운영 리스크 → 전략 재검토: P0/P1 이슈가 decision 에스컬레이션
	var riskToStrat int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND escalation_level IN (?, ?) AND created_at >= ?",
			"decision", "etf", "founder", weekAgo).
		Count(&riskToStrat)

	flows := []CategoryFlow{
		{
			From: "strategy", To: "revenue",
			Label: "전략 결정 → 매출 실행",
			Count: stratToRev,
			Examples: "가격 전략 변경, 신규 채널 진출, 권역 확장",
		},
		{
			From: "revenue", To: "risk",
			Label: "매출 활동 → 운영 리스크",
			Count: revToRisk,
			Examples: "가격 인하 후 CS 증가, 신규 숙소 하자, 정산 오류",
		},
		{
			From: "risk", To: "strategy",
			Label: "리스크 누적 → 전략 재검토",
			Count: riskToStrat,
			Examples: "반복 민원 → 구조 변경, 가동률 하락 → 방향 전환",
		},
	}

	// Hot Spot 판정
	hotSpot := "strategy"
	maxTension := stratTension
	if revTension > maxTension {
		hotSpot = "revenue"
		maxTension = revTension
	}
	if riskTension > maxTension {
		hotSpot = "risk"
	}

	// 순환 상태 메시지
	cycleStatus := "정상 순환 — 모든 카테고리 균형"
	if maxTension >= 70 {
		cycleStatus = categories[hotSpot].Label + " 긴장도 높음 — 집중 필요"
	} else if maxTension >= 40 {
		cycleStatus = categories[hotSpot].Label + " 주의 — 이슈 증가 추세"
	}

	return CategoryCycle{
		Categories:  categories,
		Flows:       flows,
		HotSpot:     hotSpot,
		CycleStatus: cycleStatus,
	}
}

func calcTension(active, resolved int64) int {
	if active == 0 && resolved == 0 {
		return 0
	}
	// 활성 이슈 많고 해결 적으면 긴장도 높음
	if resolved == 0 {
		if active >= 5 {
			return 90
		}
		return int(active * 20)
	}
	ratio := float64(active) / float64(active+resolved) * 100
	if ratio > 90 {
		return 90
	}
	return int(ratio)
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
