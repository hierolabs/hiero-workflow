package models

import "time"

// CostRaw 원본 비용 데이터 (CSV에서 임포트, 원본 보존)
type CostRaw struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PropertyID      *uint     `gorm:"index" json:"property_id"`
	PropertyName    string    `gorm:"size:200" json:"property_name"`
	CostType        string    `gorm:"size:50;index" json:"cost_type"`        // 청소비, 월세, 관리비, 수리비, 소모품비, 기타
	OriginalAmount  int64     `json:"original_amount"`                       // 원본 금액
	CostStartDate   string    `gorm:"size:20;index" json:"cost_start_date"`  // 비용 적용 시작일
	CostEndDate     string    `gorm:"size:20;index" json:"cost_end_date"`    // 비용 적용 종료일
	PaymentDate     string    `gorm:"size:20;index" json:"payment_date"`     // 실제 결제일
	ReservationRef  string    `gorm:"size:100;index" json:"reservation_ref"` // 관련 예약 코드 (있는 경우)
	SourceFileName  string    `gorm:"size:500" json:"source_file_name"`      // 원본 CSV 파일명
	SourceRowNumber int       `json:"source_row_number"`                     // 원본 CSV 행 번호
	Channel         string    `gorm:"size:50" json:"channel"`                // 채널
	Memo            string    `gorm:"type:text" json:"memo"`                 // 비고

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CostRaw) TableName() string {
	return "cost_raw"
}

// 비용 타입 상수
const (
	CostTypeCleaning    = "청소비"
	CostTypeRent        = "월세"
	CostTypeMgmt        = "관리비"
	CostTypeMaintenance = "수리비"
	CostTypeSupplies    = "소모품비"
	CostTypeOperation   = "운영비"
	CostTypeLabor       = "노동비"
	CostTypeInterior    = "인테리어"
	CostTypeDividend    = "배당"
	CostTypeInterest    = "임대이자"
	CostTypeOther       = "기타"
)
