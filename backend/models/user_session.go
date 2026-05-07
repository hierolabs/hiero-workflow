package models

import "time"

// UserSession tracks login/logout (auto attendance).
type UserSession struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null;index" json:"user_id"`
	UserName  string     `gorm:"size:100" json:"user_name"`
	RoleTitle string     `gorm:"size:50" json:"role_title"`
	LoginAt   time.Time  `gorm:"not null" json:"login_at"`
	LogoutAt  *time.Time `json:"logout_at"`
	Duration  int        `gorm:"default:0" json:"duration"` // minutes
	IPAddress string     `gorm:"size:50" json:"ip_address"`
	UserAgent string     `gorm:"size:300" json:"user_agent"`
}

// UserActivity tracks page views and actions per session.
type UserActivity struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	SessionID uint      `gorm:"index" json:"session_id"`
	Action    string    `gorm:"size:50;not null;index" json:"action"` // page_view, click, edit, create, resolve, escalate
	Page      string    `gorm:"size:100" json:"page"`                 // /calendar, /cleaning, /issues ...
	Detail    string    `gorm:"size:500" json:"detail"`
	CreatedAt time.Time `json:"created_at"`
}
