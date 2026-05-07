package models

import "time"

// 팀 내부 채팅 — 채널 기반

// ChatChannel — 팀 채팅방 (전체, 역할별, 이슈별)
type ChatChannel struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"size:100;not null"`
	ChannelType string    `json:"channel_type" gorm:"size:30;not null;default:team"` // team, role, issue, direct
	RoleFilter  string    `json:"role_filter" gorm:"size:50"`                        // etf, execution, founder, "" (all)
	IssueID     *uint     `json:"issue_id" gorm:"index"`
	CreatedByID *uint     `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ChatMessage — 채팅 메시지
type ChatMessage struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	ChannelID   uint      `json:"channel_id" gorm:"index;not null"`
	SenderID    uint      `json:"sender_id" gorm:"index;not null"`
	SenderName  string    `json:"sender_name" gorm:"size:100"`
	SenderRole  string    `json:"sender_role" gorm:"size:50"`
	Content     string    `json:"content" gorm:"type:text;not null"`
	MessageType string    `json:"message_type" gorm:"size:20;default:text"` // text, issue_link, system
	RefIssueID  *uint     `json:"ref_issue_id"`                             // 이슈 링크 메시지
	CreatedAt   time.Time `json:"created_at"`
}

// ChatChannelMember — 채널 멤버
type ChatChannelMember struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ChannelID uint      `json:"channel_id" gorm:"uniqueIndex:idx_channel_user;not null"`
	UserID    uint      `json:"user_id" gorm:"uniqueIndex:idx_channel_user;not null"`
	LastRead  time.Time `json:"last_read"`
	CreatedAt time.Time `json:"created_at"`
}

// IssueDetection — 고객 메시지에서 감지된 이슈
type IssueDetection struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	ConversationID  string    `json:"conversation_id" gorm:"index;not null"`
	MessageID       uint      `json:"message_id" gorm:"index"`
	GuestName       string    `json:"guest_name" gorm:"size:100"`
	PropertyName    string    `json:"property_name" gorm:"size:100"`
	DetectedCategory string   `json:"detected_category" gorm:"size:50;not null"` // checkin, parking, boiler, cleaning, reservation, emergency
	DetectedKeywords string   `json:"detected_keywords" gorm:"size:500"`
	Severity         string   `json:"severity" gorm:"size:20;default:medium"` // low, medium, high, critical
	MessageContent   string   `json:"message_content" gorm:"type:text"`
	Status           string   `json:"status" gorm:"size:20;default:pending"` // pending, issue_created, dismissed
	CreatedIssueID   *uint    `json:"created_issue_id"`
	CreatedAt        time.Time `json:"created_at"`
}
