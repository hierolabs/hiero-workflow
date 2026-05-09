package models

import "time"

// 지시/보고 유형
const (
	DirectiveTypeDirective = "directive" // ↓ 상위 → 하위 업무지시
	DirectiveTypeReport    = "report"    // ↑ 하위 → 상위 보고
	DirectiveTypeLateral   = "lateral"   // ←→ 같은 레벨 협의/요청
)

// 상태
const (
	DirectiveStatusPending      = "pending"      // 발신됨, 수신자 미확인
	DirectiveStatusAcknowledged = "acknowledged"  // 수신자 확인
	DirectiveStatusInProgress   = "in_progress"   // 진행 중
	DirectiveStatusCompleted    = "completed"      // 완료 (수신자 보고)
	DirectiveStatusVerified     = "verified"       // 발신자 완료 확인
	DirectiveStatusReopened     = "reopened"       // 발신자 재작업 요청
	DirectiveStatusRejected     = "rejected"       // 거부/반려
	DirectiveStatusAgreed       = "agreed"         // lateral 합의
	DirectiveStatusCountered    = "countered"      // lateral 대안 제시
	DirectiveStatusEscalated    = "escalated"      // Founder 중재 요청
)

// 보고 세부 유형
const (
	ReportTypeDailyOps       = "daily_ops"        // 일일 운영 보고
	ReportTypeCleaningSummary = "cleaning_summary" // 청소 현황 보고
	ReportTypeFieldIncident  = "field_incident"    // 현장 사고/이슈
	ReportTypeCostReport     = "cost_report"       // 비용 보고
	ReportTypeEscalation     = "escalation"        // 상향 결재
)

// 우선순위
const (
	DirectivePriorityUrgent = "urgent"  // 즉시
	DirectivePriorityHigh   = "high"    // 오늘
	DirectivePriorityNormal = "normal"  // 이번 주
	DirectivePriorityLow    = "low"     // 여유
)

// ETF 역할별 도메인 — 마찰 방지용 경계 정의
var ETFDomains = map[string][]string{
	"ceo": {"strategy", "team", "lead", "approval", "partnership", "bottleneck"},
	"cto": {"documentation", "research", "technology", "message", "archiving", "knowledge"},
	"cfo": {"settlement", "accounting", "tax", "cost", "finance", "budget"},
}

// 지시 가능 범위 — GOT는 ETF만, ETF는 Execution만
var DirectiveScope = map[string][]string{
	"founder": {"ceo", "cto", "cfo"},                                  // GOT → ETF만
	"ceo":     {"marketing", "operations", "cleaning_dispatch", "field"}, // CEO → 전체 Execution
	"cto":     {"marketing", "operations"},                              // CTO → 마케팅·운영
	"cfo":     {"operations", "cleaning_dispatch"},                      // CFO → 운영·청소배정
}

// 보고 가능 범위 — 지시의 역방향
var ReportScope = map[string][]string{
	"marketing":        {"ceo", "cto"},       // 마케팅 → CEO, CTO
	"operations":       {"ceo", "cto", "cfo"}, // 운영 → CEO, CTO, CFO
	"cleaning_dispatch": {"ceo", "cfo"},       // 청소배정 → CEO, CFO
	"field":            {"ceo"},               // 현장 → CEO
	"ceo":              {"founder"},           // CEO → Founder
	"cto":              {"founder"},           // CTO → Founder
	"cfo":              {"founder"},           // CFO → Founder
}

// 열람 가능 범위 — 자기 하위 directive/report 열람 가능
var ViewScope = map[string][]string{
	"founder": {"ceo", "cto", "cfo", "marketing", "operations", "cleaning_dispatch", "field"}, // 전체
	"ceo":     {"marketing", "operations", "cleaning_dispatch", "field"},
	"cto":     {"marketing", "operations"},
	"cfo":     {"operations", "cleaning_dispatch"},
}

// 다단계 승인 임계값 (금액 기반)
const ApprovalThresholdETF = 500000    // ₩50만 이상 → ETF + Founder 2단계
const ApprovalThresholdFounder = 0     // P0/에스컬레이션 → Founder 필수

type ETFDirective struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 방향
	Type string `gorm:"size:20;index;not null" json:"type"` // directive, report, lateral

	// 발신자
	FromUserID   uint   `gorm:"index" json:"from_user_id"`
	FromUserName string `gorm:"size:100" json:"from_user_name"`
	FromRole     string `gorm:"size:30;index" json:"from_role"` // ceo, cto, cfo, operations, ...

	// 수신자
	ToUserID   uint   `gorm:"index" json:"to_user_id"`
	ToUserName string `gorm:"size:100" json:"to_user_name"`
	ToRole     string `gorm:"size:30;index" json:"to_role"`

	// 내용
	Title    string `gorm:"size:255;not null" json:"title"`
	Content  string `gorm:"type:text" json:"content"`
	Priority string `gorm:"size:20;default:'normal'" json:"priority"`

	// 보고 세부 유형 (type=report일 때)
	ReportType string `gorm:"size:30" json:"report_type"` // daily_ops, cleaning_summary, field_incident, cost_report, escalation

	// 기한
	Deadline *time.Time `json:"deadline"` // 마감 기한

	// 연결 (선택)
	ParentID  *uint `gorm:"index" json:"parent_id"`  // 원본 지시에 대한 보고
	IssueID   *uint `gorm:"index" json:"issue_id"`   // 관련 이슈
	PropertyID *uint `gorm:"index" json:"property_id"`

	// 승인 체인 (다단계 승인)
	ApprovalChain string `gorm:"size:255" json:"approval_chain"` // JSON: ["cfo","founder"]
	CurrentStep   int    `gorm:"default:0" json:"current_step"`  // 현재 승인 단계

	// 상태
	Status       string     `gorm:"size:20;index;default:'pending'" json:"status"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	CompletedAt    *time.Time `json:"completed_at"`

	// 완료 확인 (발신자)
	VerifiedAt *time.Time `json:"verified_at"`
	VerifiedBy string     `gorm:"size:100" json:"verified_by"`

	// 완료 보고
	ResultMemo    string `gorm:"type:text" json:"result_memo"`    // 완료 시 메모
	RevisionCount int    `gorm:"default:0" json:"revision_count"` // 수정 횟수

	// 서버 분석 (저장 후 서버가 도메인 충돌, 중복 등 분석)
	ServerAnalysis string `gorm:"type:text" json:"server_analysis"`
	HasConflict    bool   `gorm:"default:false" json:"has_conflict"` // 도메인 충돌 감지

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
