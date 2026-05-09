package models

import "time"

const (
	AlertStatusNew          = "new"          // 신규 (팝업)
	AlertStatusAcknowledged = "acknowledged" // 확인 (접힘)
	AlertStatusForwarded    = "forwarded"    // 전송 (ETF에 전달)
	AlertStatusApproved     = "approved"     // 승인
	AlertStatusRejected     = "rejected"     // 반려
)

// GOTAlert 이상 감지 알림 (상태 추적용)
type GOTAlert struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	AlertKey string `gorm:"size:100;uniqueIndex;not null" json:"alert_key"` // type+category+period 유니크

	// 감지 내용
	Type     string `gorm:"size:30;index" json:"type"`     // cost_spike, revenue_drop, cash_gap, duplicate, refund_spike
	Severity string `gorm:"size:20" json:"severity"`       // critical, warning, info
	Title    string `gorm:"size:255" json:"title"`
	Evidence string `gorm:"type:text" json:"evidence"`
	Impact   string `gorm:"type:text" json:"impact"`
	Action   string `gorm:"type:text" json:"action"`       // 추천 조치
	Value    int64  `json:"value"`
	Category string `gorm:"size:50" json:"category"`

	// 상태
	Status     string     `gorm:"size:20;index;default:'new'" json:"status"`
	ActionBy   string     `gorm:"size:100" json:"action_by"`   // 처리자
	ActionMemo string     `gorm:"type:text" json:"action_memo"` // 처리 메모
	ActionAt   *time.Time `json:"action_at"`

	// 전송 대상 (forwarded일 때)
	ForwardedTo string `gorm:"size:30" json:"forwarded_to"` // ceo, cto, cfo

	Period    string    `gorm:"size:20;index" json:"period"` // 2026-05-10
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
