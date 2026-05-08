package models

import "time"

// MarketPrice — 외부 OTA 매물 가격 스냅샷
type MarketPrice struct {
	ID                   uint       `gorm:"primaryKey" json:"id"`
	CrawlJobID           uint       `gorm:"index" json:"crawl_job_id"`
	PropertyID           *uint      `gorm:"index" json:"property_id"`                         // HIERO 숙소 매칭 (nullable)
	Platform             string     `gorm:"size:50;not null;index" json:"platform"`            // "33m2", "liv", "jaritalk"
	ExternalRoomID       string     `gorm:"size:100;index" json:"external_room_id"`            // 삼삼엠투 room_id 등
	RoomName             string     `gorm:"size:300" json:"room_name"`
	Address              string     `gorm:"size:500" json:"address"`
	Region               string     `gorm:"size:100;index" json:"region"`
	Visibility           string     `gorm:"size:20" json:"visibility"`                         // "공개", "비공개"
	RentWeekly           int        `json:"rent_weekly"`                                       // 주간 임대료 (원)
	Deposit              int        `json:"deposit"`                                           // 보증금
	MaintenanceWeekly    int        `json:"maintenance_weekly"`                                // 주간 관리비
	CleaningFee          int        `json:"cleaning_fee"`                                      // 퇴실 청소비
	RefundPolicy         string     `gorm:"size:20" json:"refund_policy"`                      // "약한", "보통", "강한"
	LongTermDiscountRaw  string     `gorm:"type:text" json:"long_term_discount_raw"`
	ImmediateDiscountRaw string     `gorm:"type:text" json:"immediate_discount_raw"`
	MaintenanceIncluded  string     `gorm:"type:text" json:"maintenance_included"`             // JSON: {"가스":"포함",...}
	SnapshotDate         time.Time  `gorm:"index" json:"snapshot_date"`
	RawJSON              string     `gorm:"type:json" json:"-"`
	CreatedAt            time.Time  `json:"created_at"`
}

// MarketContract — 외부 OTA 계약 현황 스냅샷
type MarketContract struct {
	ID                 uint       `gorm:"primaryKey" json:"id"`
	CrawlJobID         uint       `gorm:"index" json:"crawl_job_id"`
	Platform           string     `gorm:"size:50;not null;index" json:"platform"`
	ExternalContractID string     `gorm:"size:100" json:"external_contract_id"`
	ExternalRoomID     string     `gorm:"size:100;index" json:"external_room_id"`
	ChatID             string     `gorm:"size:100" json:"chat_id"`
	RoomName           string     `gorm:"size:300" json:"room_name"`
	TenantName         string     `gorm:"size:100" json:"tenant_name"`
	Status             string     `gorm:"size:30" json:"status"`                               // "거주중", "입주대기", "취소" 등
	PaymentStatus      string     `gorm:"size:30" json:"payment_status"`                       // "결제완료", "결제대기" 등
	PeriodStart        *time.Time `json:"period_start"`
	PeriodEnd          *time.Time `json:"period_end"`
	PeriodRaw          string     `gorm:"size:200" json:"period_raw"`                          // 원문: "2026.05.11(월) ~ 2026.05.24(일)"
	Amount             int        `json:"amount"`                                              // 계약 금액 (원)
	SnapshotDate       time.Time  `gorm:"index" json:"snapshot_date"`
	CreatedAt          time.Time  `json:"created_at"`
}

// CrawlJob — 크롤링/임포트 실행 이력
type CrawlJob struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	Platform         string     `gorm:"size:50;not null" json:"platform"`
	JobType          string     `gorm:"size:30;not null" json:"job_type"`                      // "rooms", "contracts", "full"
	Status           string     `gorm:"size:20;not null;default:'pending'" json:"status"`      // "pending", "processing", "completed", "failed"
	Source           string     `gorm:"size:30" json:"source"`                                 // "file_upload", "auto_import"
	FileName         string     `gorm:"size:300" json:"file_name"`
	TotalRecords     int        `json:"total_records"`
	ProcessedRecords int        `json:"processed_records"`
	ErrorMessage     string     `gorm:"type:text" json:"error_message"`
	StartedAt        *time.Time `json:"started_at"`
	CompletedAt      *time.Time `json:"completed_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}
