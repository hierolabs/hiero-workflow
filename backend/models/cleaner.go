package models

import (
	"time"

	"gorm.io/gorm"
)

type Cleaner struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	Name   string `gorm:"size:100;not null" json:"name"`
	Phone  string `gorm:"size:20" json:"phone"`
	Region string `gorm:"size:50;index" json:"region"` // 담당 지역
	Active bool   `gorm:"default:true;index" json:"active"`
	Memo   string `gorm:"type:text" json:"memo"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
