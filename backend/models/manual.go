package models

import "time"

// ManualEntry represents a wiki-like editable manual section
type ManualEntry struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Page    string `gorm:"size:50;index:idx_manual_page_section" json:"page"`
	Section string `gorm:"size:100;index:idx_manual_page_section" json:"section"`
	Title   string `gorm:"size:200" json:"title"`
	Content string `gorm:"type:longtext" json:"content"`

	UpdatedBy   uint   `json:"updated_by"`
	UpdatedName string `gorm:"size:100" json:"updated_name"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
