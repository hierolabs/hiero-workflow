package models

import "time"

// MonthlyPropertyReport 월별 숙소 P&L 스냅샷
// ──────────────────────────────────────────────────
// Hostex 월간 수지보고서 CSV에서 파싱한 확정 데이터.
// hostex_transactions 집계와 별개로, 검증된 월별 스냅샷을 보존.
type MonthlyPropertyReport struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	PropertyID   *uint  `gorm:"index" json:"property_id"`                                           // 내부 Property FK (nullable)
	PropertyName string `gorm:"size:255;uniqueIndex:idx_month_property" json:"property_name"`       // Hostex 숙소명
	Month        string `gorm:"size:7;index;uniqueIndex:idx_month_property" json:"month"`           // "YYYY-MM"

	// ── 운영 지표 ────────────────────────────────────
	AOR float64 `gorm:"default:0" json:"aor"` // 가동률 (0~1)
	ADR int64   `gorm:"default:0" json:"adr"` // 평균 객실단가 (원)

	// ── 매출 ─────────────────────────────────────────
	Room        int64 `gorm:"default:0" json:"room"`         // 객실 수입
	CleaningFee int64 `gorm:"default:0" json:"cleaning_fee"` // 청소비 수입
	PetFee      int64 `gorm:"default:0" json:"pet_fee"`      // 반려동물 수입
	ExtraFee    int64 `gorm:"default:0" json:"extra_fee"`    // 추가 수입
	Tax         int64 `gorm:"default:0" json:"tax"`          // 세금
	Commission  int64 `gorm:"default:0" json:"commission"`   // 플랫폼 수수료
	Gross       int64 `gorm:"default:0" json:"gross"`        // 총 매출

	// ── 비용 ─────────────────────────────────────────
	CleaningCost int64 `gorm:"default:0" json:"cleaning_cost"` // 청소비
	RentIn       int64 `gorm:"default:0" json:"rent_in"`       // 임대 수입
	RentOut      int64 `gorm:"default:0" json:"rent_out"`      // 임대 지출 (월세)
	Mgmt         int64 `gorm:"default:0" json:"mgmt"`          // 관리비
	Operation    int64 `gorm:"default:0" json:"operation"`     // 운영비
	Refund       int64 `gorm:"default:0" json:"refund"`        // 환불
	Labor        int64 `gorm:"default:0" json:"labor"`         // 노동비
	Supplies     int64 `gorm:"default:0" json:"supplies"`      // 소모품비
	Interior     int64 `gorm:"default:0" json:"interior"`      // 인테리어비
	Other        int64 `gorm:"default:0" json:"other"`         // 기타 비용
	TotalCost    int64 `gorm:"default:0" json:"total_cost"`    // 총 비용

	// ── P&L ──────────────────────────────────────────
	Net    int64   `gorm:"default:0" json:"net"`    // 순이익 (Gross - TotalCost)
	Margin float64 `gorm:"default:0" json:"margin"` // 이익률 (Net / Gross)

	// ── 메타 ─────────────────────────────────────────
	SourceFilename string `gorm:"size:255" json:"source_filename"` // 원본 CSV 파일명

	CreatedAt time.Time `json:"created_at"`
}

func (MonthlyPropertyReport) TableName() string {
	return "monthly_property_reports"
}
