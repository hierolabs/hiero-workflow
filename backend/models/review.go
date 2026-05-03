package models

import "time"

// Review — Hostex 게스트 리뷰
type Review struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	ReservationCode string    `gorm:"size:100;uniqueIndex;not null" json:"reservation_code"`
	PropertyID      int64     `gorm:"index" json:"property_id"`
	InternalPropID  *uint     `gorm:"index" json:"internal_prop_id"`
	PropertyName    string    `gorm:"size:200" json:"property_name"`
	ChannelType     string    `gorm:"size:50" json:"channel_type"`
	CheckInDate     string    `gorm:"size:20" json:"check_in_date"`
	CheckOutDate    string    `gorm:"size:20" json:"check_out_date"`

	// 게스트 리뷰
	GuestScore        int    `json:"guest_score"`
	GuestContent      string `gorm:"type:text" json:"guest_content"`
	AccuracyScore     int    `json:"accuracy_score"`
	CheckinScore      int    `json:"checkin_score"`
	CleanlinessScore  int    `json:"cleanliness_score"`
	CommunicationScore int   `json:"communication_score"`
	LocationScore     int    `json:"location_score"`
	ValueScore        int    `json:"value_score"`
	GuestReviewAt     *time.Time `json:"guest_review_at"`

	// 호스트 리뷰
	HostScore     int    `json:"host_score"`
	HostContent   string `gorm:"type:text" json:"host_content"`
	HostReviewAt  *time.Time `json:"host_review_at"`

	// 호스트 답글
	HostReply string `gorm:"type:text" json:"host_reply"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
