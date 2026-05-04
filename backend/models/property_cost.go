package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// PropertyCost 숙소별 고정비용 설정
// ──────────────────────────────────────────────────
// 소유 구조별(임차/위탁/배당/자가) 월세·위탁료·공과금 등 고정비용 관리
type PropertyCost struct {
	ID         uint `gorm:"primaryKey" json:"id"`
	PropertyID uint `gorm:"uniqueIndex;not null" json:"property_id"` // 내부 Property FK

	// ── 소유 구조 ────────────────────────────────────
	OwnerType string `gorm:"size:20;default:LEASED" json:"owner_type"` // OWNED/LEASED/CONSIGNED/REVENUE_SHARE

	// ── 월세/계약 (공통) ─────────────────────────────
	Rent          int64      `gorm:"default:0" json:"rent"`                     // 월세 (원)
	RentRecipient string     `gorm:"size:100" json:"rent_recipient"`            // 수령인
	ContractStart *time.Time `json:"contract_start"`                            // 계약 시작일
	ContractEnd   *time.Time `json:"contract_end"`                              // 계약 종료일
	Deposit       int64      `gorm:"default:0" json:"deposit"`                  // 보증금
	RentMemo      string     `gorm:"type:text" json:"rent_memo"`                // 메모

	// ── 위탁/배당 전용 ───────────────────────────────
	ConsignedFixedPay int64  `gorm:"default:0" json:"consigned_fixed_pay"`      // 위탁 고정지급액
	RevenueLinked     bool   `gorm:"default:false" json:"revenue_linked"`       // 매출연동 여부
	RevenuePercent    int    `gorm:"default:0" json:"revenue_percent"`          // 매출연동 % (0-100)
	RevenueBasis      string `gorm:"size:10;default:NET" json:"revenue_basis"`  // GROSS/NET

	// ── 자가 전용 ────────────────────────────────────
	LoanInterest int64 `gorm:"default:0" json:"loan_interest"` // 대출이자 (월)
	Depreciation int64 `gorm:"default:0" json:"depreciation"`  // 감가상각 (월)
	AnnualTax    int64 `gorm:"default:0" json:"annual_tax"`    // 연간 세금

	// ── 공과금 (JSON) ────────────────────────────────
	Utilities UtilitiesMap `gorm:"type:json" json:"utilities"` // 7개 항목

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (PropertyCost) TableName() string {
	return "property_costs"
}

// ── 소유 구조 상수 ───────────────────────────────────
const (
	OwnerTypeOwned        = "OWNED"         // 자가
	OwnerTypeLeased       = "LEASED"        // 임차
	OwnerTypeConsigned    = "CONSIGNED"      // 위탁
	OwnerTypeRevenueShare = "REVENUE_SHARE"  // 배당
)

// ── 매출 기준 상수 ───────────────────────────────────
const (
	RevenueBasisGross = "GROSS" // 총매출 기준
	RevenueBasisNet   = "NET"   // 순매출 기준
)

// ── 공과금 모드 상수 ─────────────────────────────────
const (
	UtilityModeFixed    = "FIXED"    // 고정 금액
	UtilityModeVariable = "VARIABLE" // 변동 금액
)

// ── 공과금 키 ────────────────────────────────────────
var UtilityKeys = []string{
	"management_fee", "internet", "electric",
	"gas", "water", "insurance", "other_utility",
}

// UtilityItem 공과금 항목 1개
type UtilityItem struct {
	Mode   string `json:"mode"`   // FIXED / VARIABLE
	Amount int64  `json:"amount"` // 월 금액 (원)
}

// UtilitiesMap 공과금 전체 (JSON 컬럼)
type UtilitiesMap map[string]UtilityItem

// Scan implements sql.Scanner for GORM JSON read
func (u *UtilitiesMap) Scan(value interface{}) error {
	if value == nil {
		*u = nil
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("UtilitiesMap.Scan: unsupported type %T", value)
	}
	return json.Unmarshal(bytes, u)
}

// Value implements driver.Valuer for GORM JSON write
func (u UtilitiesMap) Value() (driver.Value, error) {
	if u == nil {
		return nil, nil
	}
	b, err := json.Marshal(u)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// DefaultUtilities 기본 공과금 맵 생성
func DefaultUtilities() UtilitiesMap {
	m := make(UtilitiesMap)
	for _, key := range UtilityKeys {
		m[key] = UtilityItem{Mode: UtilityModeFixed, Amount: 0}
	}
	return m
}
