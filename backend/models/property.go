package models

import (
	"time"

	"gorm.io/gorm"
)

// Property status constants
const (
	PropertyStatusPreparing = "preparing"
	PropertyStatusActive    = "active"
	PropertyStatusPaused    = "paused"
	PropertyStatusClosed    = "closed"
)

// Property operation status constants
const (
	OperationStatusInactive    = "inactive"
	OperationStatusAvailable   = "available"
	OperationStatusOccupied    = "occupied"
	OperationStatusMaintenance = "maintenance"
	OperationStatusBlocked     = "blocked"
)

var ValidPropertyStatuses = map[string]bool{
	PropertyStatusPreparing: true,
	PropertyStatusActive:    true,
	PropertyStatusPaused:    true,
	PropertyStatusClosed:    true,
}

var ValidOperationStatuses = map[string]bool{
	OperationStatusInactive:    true,
	OperationStatusAvailable:   true,
	OperationStatusOccupied:    true,
	OperationStatusMaintenance: true,
	OperationStatusBlocked:     true,
}

type Property struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 식별
	Code string `gorm:"uniqueIndex;size:50;not null" json:"code"`
	Name string `gorm:"size:100;not null" json:"name"`

	// Hostex 연동 (0 = 미연결)
	HostexID int64 `gorm:"index;default:0" json:"hostex_id"`

	// 위치
	Region        string `gorm:"size:50;index" json:"region"`
	Address       string `gorm:"size:255" json:"address"`
	DetailAddress string `gorm:"size:255" json:"detail_address"`

	// 유형
	PropertyType string `gorm:"size:30;index" json:"property_type"`
	RoomType     string `gorm:"size:30;index" json:"room_type"`

	// 스펙
	MaxGuests int     `gorm:"default:1" json:"max_guests"`
	Bedrooms  int     `gorm:"default:0" json:"bedrooms"`
	Beds      int     `gorm:"default:0" json:"beds"`
	Bathrooms float64 `gorm:"default:1" json:"bathrooms"`

	// 비용
	MonthlyRent   int64 `gorm:"default:0" json:"monthly_rent"`
	ManagementFee int64 `gorm:"default:0" json:"management_fee"`
	Deposit       int64 `gorm:"default:0" json:"deposit"`

	// 상태
	Status          string `gorm:"size:30;index;default:'preparing'" json:"status"`
	OperationStatus string `gorm:"size:30;index;default:'inactive'" json:"operation_status"`

	// 운영
	CheckInTime  string `gorm:"size:10" json:"check_in_time"`
	CheckOutTime string `gorm:"size:10" json:"check_out_time"`

	// 표시 순서
	DisplayOrder int `gorm:"default:9999" json:"display_order"`

	// 메모
	Memo string `gorm:"type:text" json:"memo"`

	// 관계
	CreatedByID *uint `json:"created_by_id"`

	// 타임스탬프
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
