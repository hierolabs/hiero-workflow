package models

import "time"

// PriceLabsListing — PriceLabs 리스팅 매핑 + KPI 캐시
type PriceLabsListing struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	PropertyID           uint      `gorm:"index" json:"property_id"`           // HIERO property ID
	HostexID             int64     `gorm:"index" json:"hostex_id"`             // Hostex property ID
	PriceLabsID          string    `gorm:"size:100;uniqueIndex" json:"pricelabs_id"` // "18848_12142094_house"
	PMS                  string    `gorm:"size:20" json:"pms"`                 // hostex
	Currency             string    `gorm:"size:10" json:"currency"`            // KRW
	MinPrice             int64     `json:"min_price"`                          // 최저가 설정
	BasePrice            int64     `json:"base_price"`                         // 기본가 설정
	RecommendedBase      int64     `json:"recommended_base"`                   // AI 추천 기본가
	OccupancyNext7       string    `gorm:"size:10" json:"occupancy_next_7"`    // "57 %"
	OccupancyNext30      string    `gorm:"size:10" json:"occupancy_next_30"`
	OccupancyNext60      string    `gorm:"size:10" json:"occupancy_next_60"`
	MarketOccupancyNext7  string   `gorm:"size:10" json:"market_occupancy_next_7"`
	MarketOccupancyNext30 string   `gorm:"size:10" json:"market_occupancy_next_30"`
	MarketOccupancyNext60 string   `gorm:"size:10" json:"market_occupancy_next_60"`
	ADRPast90            int64     `json:"adr_past_90"`
	ADRPast90STLY        int64     `json:"adr_past_90_stly"`                  // 작년 동기
	BookingPickup30      int       `json:"booking_pickup_30"`
	MPINext7             float64   `json:"mpi_next_7"`                        // 시장 가격 지수
	SyncedAt             time.Time `json:"synced_at"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// PriceLabsPrice — PriceLabs 일별 가격 상세 캐시
type PriceLabsPrice struct {
	ID                uint   `gorm:"primaryKey" json:"id"`
	PropertyID        uint   `gorm:"index;not null" json:"property_id"`
	Date              string `gorm:"size:10;not null;index" json:"date"`
	Price             int64  `json:"price"`               // PriceLabs 적용가
	UncustomizedPrice int64  `json:"uncustomized_price"`  // AI 순수 추천가 (룰 적용 전)
	UserPrice         int64  `json:"user_price"`          // 사용자 수동가 (-1=없음)
	MinStay           int    `json:"min_stay"`
	BookingStatus     string `gorm:"size:20" json:"booking_status"`      // Booked / Available
	BookingStatusSTLY string `gorm:"size:20" json:"booking_status_stly"` // 작년 동일
	ADR               int64  `json:"adr"`
	ADRSTLY           int64  `json:"adr_stly"`
	BookedDate        string `gorm:"size:10" json:"booked_date"`
	DemandColor       string `gorm:"size:10" json:"demand_color"`        // #bae4bc
	DemandDesc        string `gorm:"size:30" json:"demand_desc"`         // Normal Demand
	WeeklyDiscount    float64 `json:"weekly_discount"`
	MonthlyDiscount   float64 `json:"monthly_discount"`
	SyncedAt          time.Time `json:"synced_at"`
}
