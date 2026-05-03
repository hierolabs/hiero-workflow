package models

import "time"

// GuestRequest — 게스트 요청 태그 (얼리체크인, 수건 추가 등)
type GuestRequest struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ConversationID  string    `gorm:"size:100;index" json:"conversation_id"`
	ReservationCode string    `gorm:"size:100;index" json:"reservation_code"`
	PropertyID      int64     `json:"property_id"`
	InternalPropID  *uint     `gorm:"index" json:"internal_prop_id"`
	RequestType     string    `gorm:"size:50;index;not null" json:"request_type"`
	Note            string    `gorm:"type:text" json:"note"`
	Status          string    `gorm:"size:20;default:pending" json:"status"` // pending, confirmed, rejected, completed
	CreatedByID     *uint     `json:"created_by_id"`
	CreatedByName   string    `gorm:"size:100" json:"created_by_name"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// 요청 타입 상수
const (
	RequestEarlyCheckin  = "early_checkin"
	RequestLateCheckout  = "late_checkout"
	RequestExtraTowels   = "extra_towels"
	RequestExtraBedding  = "extra_bedding"
	RequestLuggage       = "luggage_storage"
	RequestAirport       = "airport_pickup"
	RequestSpecial       = "special_request"
)
