package models

import "time"

// 이슈 유형
const (
	IssueTypeCleaning    = "cleaning"    // 청소 문제
	IssueTypeFacility    = "facility"    // 시설 문제
	IssueTypeGuest       = "guest"       // 게스트 응대
	IssueTypeSettlement  = "settlement"  // 비용/정산
	IssueTypeDecision    = "decision"    // 주요 의사결정
	IssueTypeOther       = "other"       // 기타
)

// 이슈 상태
const (
	IssueStatusOpen       = "open"
	IssueStatusInProgress = "in_progress"
	IssueStatusResolved   = "resolved"
	IssueStatusClosed     = "closed"
)

// 이슈 우선순위
const (
	IssuePriorityP0 = "P0" // 즉시
	IssuePriorityP1 = "P1" // 오늘 내
	IssuePriorityP2 = "P2" // 이번 주
	IssuePriorityP3 = "P3" // 여유
)

// 에스컬레이션 레벨
const (
	EscalationExecution = "execution"
	EscalationETF       = "etf"
	EscalationFounder   = "founder"
)

// 즉결 처리 금액 기준
const (
	AutoApprovalLimit    = 100000  // 10만원 미만: 담당자 즉결
	ETFApprovalLimit     = 300000  // 30만원 미만: ETF 승인
	FounderApprovalLimit = 300000  // 30만원 이상: Founder 승인
)

// ApprovalLevel 자동 판정
func CalcApprovalLevel(cost int64) string {
	if cost <= 0 {
		return "auto"
	}
	if cost < AutoApprovalLimit {
		return "auto" // 10만원 미만: 즉결
	}
	if cost < FounderApprovalLimit {
		return "etf" // 10~30만원: ETF 승인
	}
	return "founder" // 30만원 이상: Founder 승인
}

var ValidIssueStatuses = map[string]bool{
	IssueStatusOpen:       true,
	IssueStatusInProgress: true,
	IssueStatusResolved:   true,
	IssueStatusClosed:     true,
}

type Issue struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 연결
	PropertyID      *uint  `gorm:"index" json:"property_id"`
	ReservationID   *uint  `gorm:"index" json:"reservation_id"`
	CleaningTaskID  *uint  `gorm:"index" json:"cleaning_task_id"`
	ReservationCode string `gorm:"size:100" json:"reservation_code"`

	// 내용
	Title       string `gorm:"size:255;not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	IssueType   string `gorm:"size:30;index;not null" json:"issue_type"`
	Priority    string `gorm:"size:10;index;default:'P2'" json:"priority"`
	Status      string `gorm:"size:30;index;default:'open'" json:"status"`

	// 배정
	AssigneeID   *uint  `gorm:"index" json:"assignee_id"`
	AssigneeName string `gorm:"size:100" json:"assignee_name"`

	// 컨텍스트
	PropertyName string `gorm:"size:100" json:"property_name"`
	PropertyCode string `gorm:"size:50" json:"property_code"`

	// 에스컬레이션
	EscalationLevel       string     `gorm:"size:20;default:'execution'" json:"escalation_level"` // execution | etf | founder
	EscalatedFrom         string     `gorm:"size:50" json:"escalated_from"`                       // 에스컬레이트한 역할: operations, ceo 등
	EscalatedAt           *time.Time `json:"escalated_at"`
	RequiresFinalDecision bool       `gorm:"default:false" json:"requires_final_decision"` // true면 ETF 에스컬레이트 없이도 Founder Brief에 표시

	// 비용 + 즉결 처리
	EstimatedCost int64  `gorm:"default:0" json:"estimated_cost"`            // 예상 비용 (원)
	AutoApproved  bool   `gorm:"default:false" json:"auto_approved"`         // 즉결 처리 여부
	ApprovalLevel string `gorm:"size:20" json:"approval_level"`              // auto, execution, etf, founder

	// 마감
	Deadline string `gorm:"size:30" json:"deadline"` // "오늘 18:00", "2026-05-07" 등
	RuleID   string `gorm:"size:30;index" json:"rule_id"` // 액션 엔진 규칙 ID (중복 방지)

	// 해결
	ResolvedAt *time.Time `json:"resolved_at"`
	Resolution string     `gorm:"type:text" json:"resolution"`

	// 생성자
	CreatedByID   *uint  `json:"created_by_id"`
	CreatedByName string `gorm:"size:100" json:"created_by_name"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
