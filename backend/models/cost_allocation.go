package models

import "time"

// CostAllocation 분석용 분할 비용 (cost_raw를 기간별 1/n 배분)
type CostAllocation struct {
	ID                 uint   `gorm:"primaryKey" json:"id"`
	RawCostID          uint   `gorm:"index;not null" json:"raw_cost_id"`           // cost_raw.id 참조
	PropertyID         *uint  `gorm:"index" json:"property_id"`
	AllocatedMonth     string `gorm:"size:7;index;not null" json:"allocated_month"` // YYYY-MM
	AllocatedStartDate string `gorm:"size:20" json:"allocated_start_date"`          // 해당 월 배분 시작일
	AllocatedEndDate   string `gorm:"size:20" json:"allocated_end_date"`            // 해당 월 배분 종료일
	AllocatedAmount    int64  `json:"allocated_amount"`                             // 배분 금액
	AllocationMethod   string `gorm:"size:30" json:"allocation_method"`             // daily_prorate, full_month, manual
	CostType           string `gorm:"size:50;index" json:"cost_type"`               // cost_raw.cost_type 복사 (조회 편의)

	CreatedAt time.Time `json:"created_at"`
}

func (CostAllocation) TableName() string {
	return "cost_allocations"
}

// 배분 방식 상수
const (
	AllocMethodDailyProrate = "daily_prorate" // 일할 배분
	AllocMethodFullMonth    = "full_month"    // 월 전체 귀속
	AllocMethodManual       = "manual"        // 수동 배분
)
