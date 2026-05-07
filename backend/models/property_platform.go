package models

import "time"

const (
	PlatformHostex   = "hostex"
	PlatformAirbnb   = "airbnb"
	PlatformBooking  = "booking"
	PlatformAgoda    = "agoda"
	Platform33m2     = "33m2"
	PlatformLiv      = "liv"
	PlatformJaritalk = "jaritalk"
	PlatformNaver    = "naver"
	PlatformDirect   = "direct" // HIERO 직접 예약 (미래)
)

// Platform Tier
const (
	PlatformTierMaster   = "master"    // Tier 1: Airbnb = Source of Truth
	PlatformTierFastCopy = "fast_copy" // Tier 2: 삼삼엠투, 리브, 자리톡 (복붙 용이)
	PlatformTierComplex  = "complex"   // Tier 3: Booking, Agoda (등록 복잡)
	PlatformTierHub      = "hub"       // Hostex, HIERO Direct
)

// 플랫폼별 기본 Tier 매핑
var PlatformTiers = map[string]string{
	PlatformAirbnb:   PlatformTierMaster,
	Platform33m2:     PlatformTierFastCopy,
	PlatformLiv:      PlatformTierFastCopy,
	PlatformJaritalk: PlatformTierFastCopy,
	PlatformBooking:  PlatformTierComplex,
	PlatformAgoda:    PlatformTierComplex,
	PlatformHostex:   PlatformTierHub,
	PlatformNaver:    PlatformTierFastCopy,
	PlatformDirect:   PlatformTierHub,
}

const (
	PlatformStatusDraft    = "draft"
	PlatformStatusPending  = "pending"
	PlatformStatusReview   = "review"
	PlatformStatusActive   = "active"
	PlatformStatusPaused   = "paused"
	PlatformStatusRejected = "rejected"
)

type PropertyPlatform struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	PropertyID   uint       `gorm:"index;not null" json:"property_id"`
	Platform     string     `gorm:"size:30;not null;index" json:"platform"`
	PlatformName string     `gorm:"size:200" json:"platform_name"`  // 플랫폼 내 숙소명
	PlatformURL  string     `gorm:"size:500" json:"platform_url"`   // 리스팅 URL
	Status       string     `gorm:"size:20;default:'draft'" json:"status"`
	Tier         string     `gorm:"size:20" json:"tier"`            // master, fast_copy, complex, hub
	IsMaster     bool       `gorm:"default:false" json:"is_master"` // Airbnb = true (Source of Truth)
	HostName     string     `gorm:"size:100" json:"host_name"`      // 담당 호스트
	RegisteredAt *time.Time `json:"registered_at"`
	ActivatedAt  *time.Time `json:"activated_at"`
	Memo         string     `gorm:"type:text" json:"memo"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
