package models

import (
	"time"

	"gorm.io/gorm"
)

// Property status constants
const (
	PropertyStatusPreparing = "preparing"
	PropertyStatusActive    = "active"
	PropertyStatusPaused    = "paused"
	PropertyStatusClosed    = "closed"
)

// Property operation status constants
const (
	OperationStatusInactive    = "inactive"
	OperationStatusAvailable   = "available"
	OperationStatusOccupied    = "occupied"
	OperationStatusMaintenance = "maintenance"
	OperationStatusBlocked     = "blocked"
)

// 운영유형 (세무·회계 구조)
const (
	OpTypeMidTermSublease      = "MID_TERM_SUBLEASE"       // 중단기 전대
	OpTypeLicensedAirbnb       = "LICENSED_AIRBNB"          // 허가형 비엔비
	OpTypeWehomeSpecial        = "WEHOME_SPECIAL"           // 위홈 실증특례
	OpTypeForeignTourist       = "FOREIGN_TOURIST_HOMESTAY" // 외국인관광도시민박
	OpTypeUnlicensedRisk       = "UNLICENSED_RISK"          // 무허가 위험
	OpTypeMixed                = "MIXED"                    // 혼합
)

// 세금구분
const (
	TaxCatExemptRent      = "VAT_EXEMPT_RENT"       // 면세 전대 임대료
	TaxCatTaxableLodging  = "VAT_TAXABLE_LODGING"   // 과세 숙박매출
	TaxCatTaxableService  = "VAT_TAXABLE_SERVICE"    // 과세 서비스매출
	TaxCatCommonCost      = "COMMON_COST"            // 공통비
)

// 허가상태
const (
	LicenseNone      = "NONE"       // 없음
	LicensePending   = "PENDING"    // 신청중
	LicenseApproved  = "APPROVED"   // 승인
	LicenseExpired   = "EXPIRED"    // 만료
)

// 계약유형
const (
	ContractSublease = "SUBLEASE_CONTRACT"  // 전대차계약
	ContractPlatform = "PLATFORM_BOOKING"   // 플랫폼 숙박예약
	ContractService  = "SERVICE_CONTRACT"   // 운영관리/컨설팅
)

// Lifecycle status
const (
	LifecycleLead             = "lead"
	LifecycleMeeting          = "meeting"
	LifecycleNegotiating      = "negotiating"
	LifecycleContracted       = "contracted"
	LifecycleSetting          = "setting"
	LifecycleFilming          = "filming"
	LifecycleOTARegistering   = "ota_registering"
	LifecycleOperationReady   = "operation_ready"
	LifecyclePartiallyActive  = "partially_active"  // Master(Airbnb) active, 나머지 진행 중
	LifecycleFullyDistributed = "fully_distributed"  // 전체 플랫폼 등록 완료
	LifecycleActive           = "active"
	LifecyclePaused           = "paused"
	LifecycleClosed           = "closed"
)

// Setting type
const (
	SettingLight      = "light"      // 3일
	SettingStandard   = "standard"   // 5일
	SettingRenovation = "renovation" // 14일
)

// Grade
const (
	GradeStandard = "S"
	GradeDeluxe   = "D"
	GradePremium  = "P"
)

var ValidPropertyStatuses = map[string]bool{
	PropertyStatusPreparing: true,
	PropertyStatusActive:    true,
	PropertyStatusPaused:    true,
	PropertyStatusClosed:    true,
}

var ValidOperationStatuses = map[string]bool{
	OperationStatusInactive:    true,
	OperationStatusAvailable:   true,
	OperationStatusOccupied:    true,
	OperationStatusMaintenance: true,
	OperationStatusBlocked:     true,
}

type Property struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 식별
	Code string `gorm:"uniqueIndex;size:50;not null" json:"code"`
	Name        string `gorm:"size:100;not null" json:"name"`
	DisplayName string `gorm:"size:100;default:''" json:"display_name"`

	// Hostex 연동 (0 = 미연결)
	HostexID int64 `gorm:"index;default:0" json:"hostex_id"`

	// 위치
	Region        string `gorm:"size:50;index" json:"region"`
	Address       string `gorm:"size:255" json:"address"`
	DetailAddress string `gorm:"size:255" json:"detail_address"`
	BuildingName  string `gorm:"size:100;default:''" json:"building_name"` // 건물명

	// 유형
	PropertyType string `gorm:"size:30;index" json:"property_type"`
	RoomType     string `gorm:"size:30;index" json:"room_type"`

	// 스펙
	MaxGuests int     `gorm:"default:1" json:"max_guests"`
	Bedrooms  int     `gorm:"default:0" json:"bedrooms"`
	Beds      int     `gorm:"default:0" json:"beds"`
	Bathrooms float64 `gorm:"default:1" json:"bathrooms"`

	// 비용
	MonthlyRent   int64 `gorm:"default:0" json:"monthly_rent"`
	ManagementFee int64 `gorm:"default:0" json:"management_fee"`
	Deposit       int64 `gorm:"default:0" json:"deposit"`

	// 상태
	Status          string `gorm:"size:30;index;default:'preparing'" json:"status"`
	OperationStatus string `gorm:"size:30;index;default:'inactive'" json:"operation_status"`

	// 라이프사이클
	LifecycleStatus    string     `gorm:"size:30;index;default:'lead'" json:"lifecycle_status"` // lead,meeting,negotiating,contracted,setting,filming,ota_registering,operation_ready,active,paused,closed
	SettingType        string     `gorm:"size:20" json:"setting_type"`                          // light,standard,renovation
	Grade              string     `gorm:"size:5" json:"grade"`                                  // S,D,P
	ExpectedActiveDate *time.Time `json:"expected_active_date"`
	ContractedAt       *time.Time `json:"contracted_at"`
	SettingStartedAt   *time.Time `json:"setting_started_at"`
	ActiveAt           *time.Time `json:"active_at"`
	InvestorID         *uint      `gorm:"index" json:"investor_id"`

	// 운영
	CheckInTime  string `gorm:"size:10" json:"check_in_time"`
	CheckOutTime string `gorm:"size:10" json:"check_out_time"`

	// 공간 상세
	BedType           string     `gorm:"size:50;default:''" json:"bed_type"`             // Q1, SS3, Q1 SS2 등
	TvType            string     `gorm:"size:50;default:''" json:"tv_type"`              // TV(케이블), TV(ott), 빔, x
	EntrancePassword  string     `gorm:"size:200;default:''" json:"entrance_password"`   // 공동현관 비번
	RoomPassword      string     `gorm:"size:200;default:''" json:"room_password"`       // 호실 비번
	PasswordChangedAt *time.Time `json:"password_changed_at"`                            // 비번 변경일
	ManagementOffice  string     `gorm:"size:100;default:''" json:"management_office"`   // 관리사무소 연락처

	// 표시 순서
	DisplayOrder int `gorm:"default:9999" json:"display_order"`

	// 세무·회계
	OperationType string `gorm:"size:30;index;default:''" json:"operation_type"`  // MID_TERM_SUBLEASE / LICENSED_AIRBNB / MIXED 등
	TaxCategory   string `gorm:"size:30;index;default:''" json:"tax_category"`    // VAT_EXEMPT_RENT / VAT_TAXABLE_LODGING 등
	LicenseStatus string `gorm:"size:20;default:''" json:"license_status"`        // NONE / PENDING / APPROVED / EXPIRED
	ContractType  string `gorm:"size:30;default:''" json:"contract_type"`         // SUBLEASE_CONTRACT / PLATFORM_BOOKING 등
	OwnerName     string `gorm:"size:100;default:''" json:"owner_name"`           // 임대인(집주인)

	// 이미지
	CoverImage string `gorm:"size:500;default:''" json:"cover_image"` // 대표 이미지 URL

	// 메모
	Memo string `gorm:"type:text" json:"memo"`

	// 관계
	CreatedByID *uint `json:"created_by_id"`

	// 타임스탬프
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
