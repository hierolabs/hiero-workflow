package models

import "time"

// ChecklistItem 일일/주간 운영 체크리스트 아이템
type ChecklistItem struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Date        string     `gorm:"size:10;index:idx_checklist_date_user;not null" json:"date"` // YYYY-MM-DD
	UserID      uint       `gorm:"index:idx_checklist_date_user;not null" json:"user_id"`
	UserName    string     `gorm:"size:100" json:"user_name"`
	TemplateID  string     `gorm:"size:100;index:idx_checklist_unique,unique" json:"template_id"`
	Page        string     `gorm:"size:50" json:"page"`   // reservations, cleaning, dashboard 등
	Mode        string     `gorm:"size:20" json:"mode"`   // manage, execute
	Title       string     `gorm:"size:255" json:"title"`
	Completed   bool       `gorm:"default:false" json:"completed"`
	CompletedAt *time.Time `json:"completed_at"`
	SortOrder   int        `json:"sort_order"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (ChecklistItem) TableName() string {
	return "checklist_items"
}
