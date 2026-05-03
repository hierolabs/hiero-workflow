package models

import (
	"time"

	"gorm.io/gorm"
)

// CleaningCode — 숙소별 청소 코드 + 권역 + 단가
// 엑셀 "청소코드" 시트의 DB화
type CleaningCode struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 식별
	Code string `gorm:"uniqueIndex;size:20;not null" json:"code"` // A22, B101, C2 등

	// 권역
	RegionCode string `gorm:"size:10;index;not null" json:"region_code"` // A, B, C, D ...
	RegionName string `gorm:"size:50;not null" json:"region_name"`       // 강동 천호, 강동 북천호 ...

	// 건물/호실
	BuildingName string `gorm:"size:50;not null" json:"building_name"` // 예건, 더하임, 청광1차 ...
	RoomName     string `gorm:"size:100;not null" json:"room_name"`    // 예건 202, 더하임 1001 ...

	// 스펙
	RoomCount float64 `gorm:"default:1" json:"room_count"` // 1, 1.5, 2, 3, 복층=1.5
	BasePrice int     `gorm:"not null" json:"base_price"`  // 기본 청소 단가 (원)

	// 내부 Property 연결 (nullable)
	PropertyID *uint `gorm:"index" json:"property_id"`

	// 메모
	Memo string `gorm:"type:text" json:"memo"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
