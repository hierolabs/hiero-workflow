package models

import "time"

// Conversation — Hostex 게스트 대화방
type Conversation struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	ConversationID    string     `gorm:"size:100;uniqueIndex;not null" json:"conversation_id"`
	ReservationCode   string     `gorm:"size:100;index" json:"reservation_code"`
	PropertyID        int64      `gorm:"index" json:"property_id"`
	InternalPropID    *uint      `gorm:"index" json:"internal_prop_id"`
	GuestName         string     `gorm:"size:200" json:"guest_name"`
	ChannelType       string     `gorm:"size:50" json:"channel_type"`
	LastMessageAt     *time.Time `gorm:"index" json:"last_message_at"`
	LastMessagePreview string    `gorm:"size:500" json:"last_message_preview"`
	UnreadCount       int        `json:"unread_count"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// Message — 개별 메시지
type Message struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ConversationID  string    `gorm:"size:100;index:idx_conv_sent,priority:1;not null" json:"conversation_id"`
	HostexMessageID string    `gorm:"size:100;uniqueIndex" json:"hostex_message_id"`
	SenderType      string    `gorm:"size:20;not null" json:"sender_type"` // guest, host, system
	Content         string    `gorm:"type:text" json:"content"`
	MessageType     string    `gorm:"size:20;default:text" json:"message_type"` // text, image
	ImageURL        string    `gorm:"size:500" json:"image_url"`
	SentAt          time.Time `gorm:"index:idx_conv_sent,priority:2" json:"sent_at"`
	CreatedAt       time.Time `json:"created_at"`
}
