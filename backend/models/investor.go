package models

import "time"

type Investor struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"size:100;not null" json:"name"`
	Phone         string    `gorm:"size:20" json:"phone"`
	AccountHolder string    `gorm:"size:100" json:"account_holder"` // 입금주
	BankName      string    `gorm:"size:50" json:"bank_name"`
	AccountNumber string    `gorm:"size:50" json:"account_number"`
	Memo          string    `gorm:"type:text" json:"memo"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type PropertyInvestor struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	PropertyID     uint      `gorm:"index;not null" json:"property_id"`
	InvestorID     uint      `gorm:"index;not null" json:"investor_id"`
	OwnershipType  string    `gorm:"size:30" json:"ownership_type"` // direct,sublease,consignment,mixed
	ContractStart  string    `gorm:"size:10" json:"contract_start"`
	ContractEnd    string    `gorm:"size:10" json:"contract_end"`
	RentAmount     int64     `gorm:"default:0" json:"rent_amount"`
	CommissionRate float64   `gorm:"default:0" json:"commission_rate"`
	CreatedAt      time.Time `json:"created_at"`
}
