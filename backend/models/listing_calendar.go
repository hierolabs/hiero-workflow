package models

import "time"

// ListingCalendar — Hostex 캘린더 가격/제한 캐시 (날짜별 1행)
type ListingCalendar struct {
	ID                uint   `gorm:"primaryKey" json:"id"`
	PropertyID        uint   `gorm:"index;not null" json:"property_id"`
	Date              string `gorm:"size:10;not null;index" json:"date"` // 2026-05-08
	Price             int64  `gorm:"default:0" json:"price"`
	MinStay           int    `gorm:"default:1" json:"min_stay"`
	Available         bool   `gorm:"default:true" json:"available"`
	ClosedOnArrival   bool   `gorm:"default:false" json:"closed_on_arrival"`
	ClosedOnDeparture bool   `gorm:"default:false" json:"closed_on_departure"`
	SyncedAt          time.Time `json:"synced_at"`
}

func (ListingCalendar) TableName() string {
	return "listing_calendars"
}
