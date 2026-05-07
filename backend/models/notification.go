package models

import "time"

// 알림 유형
const (
	NotifTypeAssigned  = "assigned"  // 업무 배정
	NotifTypeEscalated = "escalated" // 에스컬레이트
	NotifTypeResolved  = "resolved"  // 해결됨
	NotifTypeDelegated = "delegated" // 업무지시
	NotifTypeMessage   = "message"   // 사내 메시지
)

type Notification struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"index;not null" json:"user_id"`         // 받는 사람
	Type       string     `gorm:"size:50;not null;index" json:"type"`    // assigned, escalated, resolved, delegated, message
	Title      string     `gorm:"size:255;not null" json:"title"`        // 알림 제목
	Content    string     `gorm:"type:text" json:"content"`              // 상세 내용
	IssueID    *uint      `gorm:"index" json:"issue_id"`                 // 연결된 이슈
	FromUserID *uint      `json:"from_user_id"`                          // 보낸 사람
	FromName   string     `gorm:"size:100" json:"from_name"`             // 보낸 사람 이름
	IsRead     bool       `gorm:"default:false;index" json:"is_read"`    // 읽음 여부
	ReadAt     *time.Time `json:"read_at"`                               // 읽은 시각
	CreatedAt  time.Time  `json:"created_at"`
}
