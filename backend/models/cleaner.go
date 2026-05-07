package models

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

// 이동수단
const (
	TransportWalk    = "walk"    // 뚜벅이
	TransportBike    = "bike"    // 자전거
	TransportCar     = "car"     // 자차
	TransportPublic  = "public"  // 대중교통
)

type Cleaner struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	LoginID  string `gorm:"size:50;uniqueIndex" json:"login_id"` // 로그인 ID
	Password string `gorm:"size:200" json:"-"`                   // 비밀번호 (해시)
	Name     string `gorm:"size:100;not null" json:"name"`
	Phone    string `gorm:"size:20" json:"phone"`
	Region   string `gorm:"size:50;index" json:"region"` // 대표 권역 (하위 호환)

	// 다중 권역 (쉼표 구분: "A,A2" 또는 "강동 전역")
	Regions string `gorm:"size:200" json:"regions"`

	// 가용 요일 (쉼표 구분: "mon,tue,wed,thu,fri,sat,sun")
	AvailableDays string `gorm:"size:50" json:"available_days"`

	// 이동수단
	Transport string `gorm:"size:20" json:"transport"`

	// 역량
	CanLaundry bool `gorm:"default:false" json:"can_laundry"` // 빨래 가능
	CanDry     bool `gorm:"default:false" json:"can_dry"`     // 건조 가능
	MaxDaily   int  `gorm:"default:5" json:"max_daily"`       // 일일 최대 건수

	// 정산
	BankName    string `gorm:"size:50" json:"bank_name"`
	BankAccount string `gorm:"size:50" json:"bank_account"`
	AccountHolder string `gorm:"size:50" json:"account_holder"`

	Active bool   `gorm:"default:true;index" json:"active"`
	Memo   string `gorm:"type:text" json:"memo"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// IsAvailableOn — 특정 요일에 가용한지 확인 (0=Sun, 1=Mon, ..., 6=Sat)
func (c *Cleaner) IsAvailableOn(weekday time.Weekday) bool {
	if c.AvailableDays == "" {
		return true // 미설정이면 매일 가능
	}
	dayMap := map[time.Weekday]string{
		time.Monday:    "mon",
		time.Tuesday:   "tue",
		time.Wednesday: "wed",
		time.Thursday:  "thu",
		time.Friday:    "fri",
		time.Saturday:  "sat",
		time.Sunday:    "sun",
	}
	dayStr := dayMap[weekday]
	return strings.Contains(c.AvailableDays, dayStr)
}

// CoverRegion — 특정 권역을 담당하는지 확인
func (c *Cleaner) CoversRegion(regionCode string) bool {
	if c.Regions == "" {
		return c.Region == regionCode
	}
	if strings.Contains(c.Regions, "전역") {
		return true
	}
	for _, r := range strings.Split(c.Regions, ",") {
		if strings.TrimSpace(r) == regionCode {
			return true
		}
	}
	return false
}
