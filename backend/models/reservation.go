package models

import "time"

type Reservation struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	ReservationCode string    `json:"reservation_code" gorm:"size:100;uniqueIndex;not null"`
	StayCode        string    `json:"stay_code" gorm:"size:100"`
	PropertyID      int64     `json:"property_id" gorm:"index"`           // Hostex property ID
	InternalPropID  *uint     `json:"internal_prop_id" gorm:"index"`      // 내부 Property ID
	ChannelType     string    `json:"channel_type" gorm:"size:50"`
	ChannelName     string    `json:"channel_name" gorm:"size:100"`
	ListingID       string    `json:"listing_id" gorm:"size:100"`
	CheckInDate     string    `json:"check_in_date" gorm:"size:20;index"`
	CheckOutDate    string    `json:"check_out_date" gorm:"size:20;index"`
	Nights          int       `json:"nights"`
	NumberOfGuests  int       `json:"number_of_guests"`
	Status          string    `json:"status" gorm:"size:30;index"`
	StayStatus      string    `json:"stay_status" gorm:"size:30;index"`
	GuestName       string    `json:"guest_name" gorm:"size:200"`
	GuestPhone      string    `json:"guest_phone" gorm:"size:50"`
	GuestEmail      string    `json:"guest_email" gorm:"size:200"`
	TotalRate       int64     `json:"total_rate"`
	TotalCommission int64     `json:"total_commission"`
	Currency        string    `json:"currency" gorm:"size:10;default:KRW"`
	BookedAt        string    `json:"booked_at" gorm:"size:50;index"`
	CancelledAt     *string   `json:"cancelled_at" gorm:"size:50"`
	Remarks         string    `json:"remarks" gorm:"type:text"`
	ConversationID  string    `json:"conversation_id" gorm:"size:100;index"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// 조회 시 매핑 (DB 컬럼 아님)
	PropertyName string `json:"property_name" gorm:"-"`
	PropertyCode string `json:"property_code" gorm:"-"`
}
