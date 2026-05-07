package models

import "time"

// 액션 유형
const (
	ActionIssueCreated   = "issue_created"
	ActionIssueAssigned  = "issue_assigned"
	ActionIssueEscalated = "issue_escalated"
	ActionIssueResolved  = "issue_resolved"
	ActionIssueDelegated = "issue_delegated"
	ActionStatusChanged  = "status_changed"
)

type ActivityLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     *uint     `gorm:"index" json:"user_id"`                 // 실행한 사람
	UserName   string    `gorm:"size:100" json:"user_name"`            // 실행한 사람 이름
	Action     string    `gorm:"size:50;not null;index" json:"action"` // issue_created, issue_assigned 등
	TargetType string    `gorm:"size:50" json:"target_type"`           // issue, user, property
	TargetID   *uint     `gorm:"index" json:"target_id"`              // 대상 ID
	Detail     string    `gorm:"type:text" json:"detail"`             // 상세 설명
	CreatedAt  time.Time `json:"created_at"`
}
