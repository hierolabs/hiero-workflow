package models

import "time"

const (
	GOTReportDaily   = "daily"
	GOTReportWeekly  = "weekly"
	GOTReportMonthly = "monthly"
	GOTReportAlert   = "alert"
)

// GOTReport GOT(Founder)에게 자동 보고되는 재무 요약
type GOTReport struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	ReportType string `gorm:"size:20;index;not null" json:"report_type"` // daily, weekly, monthly, alert
	Period     string `gorm:"size:20;index;not null" json:"period"`      // 2026-05-10, 2026-W19, 2026-05

	// Data 1·2·3 스냅샷
	Revenue     int64 `json:"revenue"`
	Cost        int64 `json:"cost"`
	Net         int64 `json:"net"`
	RevenuePrev int64 `json:"revenue_prev"`
	CostPrev    int64 `json:"cost_prev"`
	NetPrev     int64 `json:"net_prev"`

	// 핵심 지표
	CashGap           int64  `json:"cash_gap"`            // 비용 - 매출 (양수면 적자)
	ExpectedDeposit7d int64  `json:"expected_deposit_7d"`  // 7일내 입금 예정
	TopCostCategory   string `gorm:"size:50" json:"top_cost_category"`

	// 알림 & 결정
	Alerts    string `gorm:"type:text" json:"alerts"`    // JSON: [{category, amount, change_rate}]
	Decisions string `gorm:"type:text" json:"decisions"` // JSON: [{title, description, category}]
	Summary   string `gorm:"type:text" json:"summary"`   // 자연어 3줄 요약

	IsRead bool       `gorm:"default:false" json:"is_read"`
	ReadAt *time.Time `json:"read_at"`

	CreatedAt time.Time `json:"created_at"`
}
