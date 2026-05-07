package models

import "time"

// AiConversation — 페이지별 AI Agent 대화 기록
type AiConversation struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"index;not null"`
	UserName  string    `json:"user_name" gorm:"size:100"`
	Page      string    `json:"page" gorm:"size:50;index;not null"`
	Role      string    `json:"role" gorm:"size:20;not null"`       // user | assistant
	Content   string    `json:"content" gorm:"type:text;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"index"`
}

// AiMemory — AI 장기 기억 (대화 요약 + 크로스페이지 인사이트)
type AiMemory struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Page      string    `json:"page" gorm:"size:50;index"`          // 특정 페이지 or "global"
	Type      string    `json:"type" gorm:"size:30;not null"`       // summary | insight | decision
	Content   string    `json:"content" gorm:"type:text;not null"`
	Metadata  string    `json:"metadata" gorm:"type:text"`          // JSON: 관련 숙소/이슈 ID 등
	ExpiresAt *time.Time `json:"expires_at"`                        // null이면 영구
	CreatedAt time.Time `json:"created_at" gorm:"index"`
	UpdatedAt time.Time `json:"updated_at"`
}
