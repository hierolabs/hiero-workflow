package models

import "time"

// PropertyBusinessDiagnosis 숙소별 5엔진 사업 진단
// ──────────────────────────────────────────────────────────────
// 5개 엔진 × 5개 세부지표 = 25개 지표
//   1. value_creation  (가치 창출)    — 5개
//   2. marketing       (마케팅)       — 5개
//   3. sales           (판매)         — 5개
//   4. value_delivery  (운영 전달)    — 5개
//   5. finance         (재무)         — 비용 항목 + 계산값
//
// 점수는 0~100 (default=50). 재무 필드는 원 단위 (default=0).
// property_id에 1:1 매핑.
type PropertyBusinessDiagnosis struct {
	ID         uint `gorm:"primaryKey" json:"id"`
	PropertyID uint `gorm:"uniqueIndex;not null" json:"property_id"`

	// ─── 1. Value Creation (가치 창출) ── 5개 ────────────────
	LocationScore   int `gorm:"default:50" json:"location_score"`    // 입지
	RoomTypeScore   int `gorm:"default:50" json:"room_type_score"`   // 침대 구성
	PriceValueScore int `gorm:"default:50" json:"price_value_score"` // 가격 대비 가치
	InteriorScore   int `gorm:"default:50" json:"interior_score"`    // 인테리어
	TargetFitScore  int `gorm:"default:50" json:"target_fit_score"`  // 타겟 고객 적합성

	// ─── 2. Marketing (마케팅) ── 5개 ────────────────────────
	PhotoScore              int `gorm:"default:50" json:"photo_score"`               // 대표사진
	ChannelExposureScore    int `gorm:"default:50" json:"channel_exposure_score"`     // 플랫폼 노출
	ListingScore            int `gorm:"default:50" json:"listing_score"`              // 제목/설명
	ReviewScore             int `gorm:"default:50" json:"review_score"`               // 후기/평점
	ChannelPerformanceScore int `gorm:"default:50" json:"channel_performance_score"`  // 채널별 성과

	// ─── 3. Sales (판매) ── 5개 ──────────────────────────────
	OccupancyRate       float64 `gorm:"default:0" json:"occupancy_rate"`        // 가동률 %
	InquiryConversion   int     `gorm:"default:50" json:"inquiry_conversion"`   // 문의 전환율
	BookingConversion   int     `gorm:"default:50" json:"booking_conversion"`   // 예약 전환율
	PriceFlexibility    int     `gorm:"default:50" json:"price_flexibility"`    // 가격 조정 능력
	LongStayConversion  int     `gorm:"default:50" json:"long_stay_conversion"` // 장기숙박 전환

	// ─── 4. Value Delivery (운영 전달) ── 5개 ────────────────
	CleaningScore int `gorm:"default:70" json:"cleaning_score"` // 청소 품질
	CheckinScore  int `gorm:"default:70" json:"checkin_score"`  // 체크인 편의성
	CSScore       int `gorm:"default:70" json:"cs_score"`       // CS 응답
	AmenityScore  int `gorm:"default:70" json:"amenity_score"`  // 비품 관리
	ClaimRate     int `gorm:"default:80" json:"claim_rate"`     // 클레임 발생률 (높을수록 좋음 = 클레임 적음)

	// ─── 5. Finance (재무) ── 비용 원본 ──────────────────────
	MonthlyRevenue  int `gorm:"default:0" json:"monthly_revenue"`   // 월 매출
	MonthlyRent     int `gorm:"default:0" json:"monthly_rent"`      // 월세
	MonthlyMgmtFee  int `gorm:"default:0" json:"monthly_mgmt_fee"`  // 관리비
	MonthlyCleanFee int `gorm:"default:0" json:"monthly_clean_fee"` // 청소비
	PlatformFee     int `gorm:"default:0" json:"platform_fee"`      // 플랫폼 수수료
	ADR             int `gorm:"default:0" json:"adr"`               // 평균 1박 단가 (BEP 계산용)

	// 운영자 메모
	Note string `gorm:"type:text" json:"note,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (PropertyBusinessDiagnosis) TableName() string {
	return "property_business_diagnoses"
}
