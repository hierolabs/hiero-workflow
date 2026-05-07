package service

// AssignmentTarget — 이슈 자동 배정 대상
type AssignmentTarget struct {
	RoleTitle string
	RoleLayer string
	Name      string
}

// AssignIssueByType — 이슈 유형별 자동 배정 (최신 조직구조)
func AssignIssueByType(issueType string) AssignmentTarget {
	switch issueType {
	// 오재관 / operations
	case "reservation_changed", "reservation_cancelled", "guest_message",
		"checkin_problem", "checkout_problem", "cs_unanswered",
		"guest": // 기존 호환
		return AssignmentTarget{RoleTitle: "operations", RoleLayer: "execution", Name: "오재관"}

	// 김우현 / cleaning_dispatch
	case "cleaning_needed", "cleaning_unassigned", "cleaning_late",
		"cleaning_photo_missing", "cleaning_cost_missing",
		"cleaning": // 기존 호환
		return AssignmentTarget{RoleTitle: "cleaning_dispatch", RoleLayer: "execution", Name: "김우현"}

	// 김진태 / field
	case "field_complaint", "facility_broken", "setup_needed",
		"property_data_error", "photo_update_needed", "address_error",
		"facility": // 기존 호환
		return AssignmentTarget{RoleTitle: "field", RoleLayer: "execution", Name: "김진태"}

	// 박수빈 / cfo
	case "transaction_review", "account_mapping_review", "tax_question",
		"unpaid_rent", "settlement_missing", "partner_payment_issue",
		"settlement": // 기존 호환
		return AssignmentTarget{RoleTitle: "cfo", RoleLayer: "etf", Name: "박수빈"}

	// 이예린 / marketing
	case "new_lead", "landing_inquiry", "content_needed",
		"proposal_needed", "design_needed", "external_sales_followup":
		return AssignmentTarget{RoleTitle: "marketing", RoleLayer: "execution", Name: "이예린"}

	// 변유진 / cto
	case "research_needed", "message_inconsistent", "business_plan_update",
		"blog_article_needed", "manual_update_needed", "moro_concept_needed":
		return AssignmentTarget{RoleTitle: "cto", RoleLayer: "etf", Name: "변유진"}

	// 김지훈 / ceo
	case "team_blocked", "priority_conflict", "approval_needed",
		"execution_delay", "cross_team_issue":
		return AssignmentTarget{RoleTitle: "ceo", RoleLayer: "etf", Name: "김지훈"}

	// 김진우 / founder
	case "strategic_decision", "high_risk", "final_approval",
		"core_direction_needed", "got_decision",
		"decision": // 기존 호환
		return AssignmentTarget{RoleTitle: "founder", RoleLayer: "founder", Name: "김진우"}

	default:
		return AssignmentTarget{RoleTitle: "ceo", RoleLayer: "etf", Name: "김지훈"}
	}
}
