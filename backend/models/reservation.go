package models

import (
	"regexp"
	"strings"
	"time"
)

type Reservation struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	ReservationCode string    `json:"reservation_code" gorm:"size:100;uniqueIndex;not null"`
	StayCode        string    `json:"stay_code" gorm:"size:100"`
	PropertyID      int64     `json:"property_id" gorm:"index"`           // Hostex property ID
	InternalPropID  *uint     `json:"internal_prop_id" gorm:"index"`      // 내부 Property ID
	ChannelType     string    `json:"channel_type" gorm:"size:50"`
	ChannelName     string    `json:"channel_name" gorm:"size:100"`
	ChannelStandard string    `json:"channel_standard" gorm:"size:30;default:''"`
	ListingID       string    `json:"listing_id" gorm:"size:100"`
	CheckInDate     string    `json:"check_in_date" gorm:"size:20;index"`
	CheckOutDate    string    `json:"check_out_date" gorm:"size:20;index"`
	Nights          int       `json:"nights"`
	NumberOfGuests  int       `json:"number_of_guests"`
	Status          string    `json:"status" gorm:"size:30;index"`
	StayStatus      string    `json:"stay_status" gorm:"size:30;index"`
	GuestName       string    `json:"guest_name" gorm:"size:200"`
	GuestNameClean  string    `json:"guest_name_clean" gorm:"size:200;default:''"`
	GuestMemo       string    `json:"guest_memo" gorm:"size:300;default:''"`
	GuestPhone      string    `json:"guest_phone" gorm:"size:50"`
	GuestPhoneClean string    `json:"guest_phone_clean" gorm:"size:20;default:''"`
	GuestEmail      string    `json:"guest_email" gorm:"size:200"`
	TotalRate       int64     `json:"total_rate"`
	TotalCommission int64     `json:"total_commission"`
	Currency        string    `json:"currency" gorm:"size:10;default:KRW"`
	ReservationDate string    `json:"reservation_date" gorm:"column:reservation_date;size:20;index"` // 예약 생성일 (매출 기준일)
	BookedAt        string    `json:"booked_at" gorm:"size:50;index"`                               // Hostex 원본 (deprecated → reservation_date 사용)
	CancelledAt     *string   `json:"cancelled_at" gorm:"size:50"`
	Remarks         string    `json:"remarks" gorm:"type:text"`
	ConversationID  string    `json:"conversation_id" gorm:"size:100;index"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// 조회 시 매핑 (DB 컬럼 아님)
	PropertyName string `json:"property_name" gorm:"-"`
	PropertyCode string `json:"property_code" gorm:"-"`
}

var reNameSuffix = regexp.MustCompile(`_\d.*$`)
var reExtPrefix = regexp.MustCompile(`^\(연장\)\s*`)
var reDashSuffix = regexp.MustCompile(`\s*ㅡ\s*.*$`)

// MakeCleanName 은 guest_name에서 운영 메모(_금액(박수), (연장), ㅡ 메모)를 제거한 순수 이름을 반환
func MakeCleanName(raw string) string {
	s := strings.TrimSpace(raw)
	s = reExtPrefix.ReplaceAllString(s, "")
	s = reNameSuffix.ReplaceAllString(s, "")
	s = reDashSuffix.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}
