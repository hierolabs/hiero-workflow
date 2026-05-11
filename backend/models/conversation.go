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
	GuestNameClean    string     `gorm:"size:200;default:''" json:"guest_name_clean"`
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

// MessageTag — 메시지 키워드 매칭 결과 (사전 계산)
// 메시지 저장 시점에 키워드 매칭 후 저장 → 분석은 GROUP BY 집계만
type MessageTag struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	MessageID      uint      `gorm:"index;not null" json:"message_id"`
	ConversationID string    `gorm:"size:100;index:idx_tag_conv" json:"conversation_id"`
	TagType        string    `gorm:"size:20;index:idx_tag_type_sent;not null" json:"tag_type"` // insight, issue
	Category       string    `gorm:"size:50;index:idx_tag_cat" json:"category"`
	MatchedKeyword string    `gorm:"size:100" json:"matched_keyword"`
	SenderType     string    `gorm:"size:20" json:"sender_type"`
	ChannelType    string    `gorm:"size:50" json:"channel_type"`
	PropertyName   string    `gorm:"size:200" json:"property_name"`
	GuestName      string    `gorm:"size:200" json:"guest_name"`
	Content        string    `gorm:"size:500" json:"content"`
	SentAt         time.Time `gorm:"index:idx_tag_type_sent" json:"sent_at"`
	CreatedAt      time.Time `json:"created_at"`
}
