package models

import "time"

// HostexTransaction Hostex 거래 내역 (CSV 업로드)
// ──────────────────────────────────────────────────
// CSV 컬럼: 날짜, 유형, 항목, 금액, 결제방법, 관련예약,
//           체크인, 체크아웃, 게스트, 채널, 관련숙박시설, 운영자, 비고
type HostexTransaction struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TransactionAt time.Time `gorm:"index" json:"transaction_at"`           // 날짜
	Type          string    `gorm:"size:20;index" json:"type"`             // 수입/비용
	Category      string    `gorm:"size:50;index" json:"category"`         // 항목 (객실요금, 청소비용, 관리비 등)
	Amount        int64     `json:"amount"`                                // 금액 (원)
	PaymentMethod string    `gorm:"size:100" json:"payment_method"`        // 결제방법
	ReservationRef string   `gorm:"size:100;index" json:"reservation_ref"` // 관련 예약 코드
	CheckIn       string    `gorm:"size:20" json:"check_in"`
	CheckOut      string    `gorm:"size:20" json:"check_out"`
	GuestName     string    `gorm:"size:200" json:"guest_name"`
	Channel       string    `gorm:"size:50" json:"channel"`                // 채널 (Airbnb, 삼삼엠투 등)
	PropertyName  string    `gorm:"size:200;index" json:"property_name"`   // 관련 숙박 시설
	PropertyID    *uint     `gorm:"index" json:"property_id"`              // 내부 Property ID (매칭 후)
	Operator      string    `gorm:"size:100" json:"operator"`              // 운영자
	Note          string    `gorm:"type:text" json:"note"`                 // 비고
	YearMonth     string    `gorm:"size:7;index" json:"year_month"`        // YYYY-MM (집계용)

	CreatedAt time.Time `json:"created_at"`
}

func (HostexTransaction) TableName() string {
	return "hostex_transactions"
}

// 항목 → 비용 카테고리 매핑 상수
const (
	TxTypeIncome  = "수입"
	TxTypeExpense = "비용"

	TxCatRoomRate     = "객실 요금"
	TxCatRoomRefund   = "객실 요금 환불"
	TxCatCleaning     = "청소 비용"
	TxCatMgmt         = "관리비"
	TxCatRentOut      = "Rent_out"
	TxCatRentIn       = "Rent_in"
	TxCatOperation    = "운영 비용"
	TxCatLabor        = "노동 비용"
	TxCatSupplies     = "소모품 비용"
	TxCatMaintenance  = "유지 보수"
	TxCatInterior     = "인테리어"
	TxCatPropertyFee  = "재산 요금"
	TxCatDividend     = "배당및월세"
	TxCatDividendOnly = "배당"
	TxCatInterest     = "임대이자"
)
