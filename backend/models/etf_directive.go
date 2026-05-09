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
	DirectiveStatusCompleted    = "completed"      // 완료
	DirectiveStatusRejected     = "rejected"       // 거부/반려
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

	// 연결 (선택)
	ParentID  *uint `gorm:"index" json:"parent_id"`  // 원본 지시에 대한 보고
	IssueID   *uint `gorm:"index" json:"issue_id"`   // 관련 이슈
	PropertyID *uint `json:"property_id"`

	// 상태
	Status       string     `gorm:"size:20;index;default:'pending'" json:"status"`
	AcknowledgedAt *time.Time `json:"acknowledged_at"`
	CompletedAt    *time.Time `json:"completed_at"`

	// 완료 보고
	ResultMemo string `gorm:"type:text" json:"result_memo"` // 완료 시 메모

	// 서버 분석 (저장 후 서버가 도메인 충돌, 중복 등 분석)
	ServerAnalysis string `gorm:"type:text" json:"server_analysis"`
	HasConflict    bool   `gorm:"default:false" json:"has_conflict"` // 도메인 충돌 감지

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
