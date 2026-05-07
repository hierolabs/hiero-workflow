package models

import "time"

type PropertyParking struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	PropertyID        uint      `gorm:"index;not null" json:"property_id"`
	BuildingName      string    `gorm:"size:100" json:"building_name"`
	SelfParking       string    `gorm:"size:50" json:"self_parking"`        // 선착/전용/없음
	StreetParking     string    `gorm:"size:50" json:"street_parking"`      // 가능/불가
	MechanicalSpec    string    `gorm:"size:200" json:"mechanical_spec"`    // 기계식 제원
	PublicParking     string    `gorm:"size:100" json:"public_parking"`     // 공영주차장명
	PublicParkingRate string    `gorm:"size:100" json:"public_parking_rate"`
	DailyCharge       int64     `gorm:"default:0" json:"daily_charge"`
	MonthlyCharge     int64     `gorm:"default:0" json:"monthly_charge"`
	RemoteFee         int64     `gorm:"default:0" json:"remote_fee"`
	ManagementCompany string    `gorm:"size:100" json:"management_company"`
	Memo              string    `gorm:"type:text" json:"memo"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
