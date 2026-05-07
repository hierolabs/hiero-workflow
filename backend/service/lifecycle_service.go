package service

import (
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type LifecycleService struct {
	notifSvc *NotificationService
}

func NewLifecycleService() *LifecycleService {
	return &LifecycleService{notifSvc: NewNotificationService()}
}

// --- 상태 전환 ---

var lifecycleOrder = []string{
	"lead", "meeting", "negotiating", "contracted",
	"setting", "filming", "ota_registering", "operation_ready",
	"active", "paused", "closed",
}

func (s *LifecycleService) UpdateLifecycleStatus(propertyID uint, newStatus string, userID *uint, userName string) error {
	var prop models.Property
	if err := config.DB.First(&prop, propertyID).Error; err != nil {
		return err
	}

	oldStatus := prop.LifecycleStatus
	prop.LifecycleStatus = newStatus

	now := time.Now()
	switch newStatus {
	case models.LifecycleContracted:
		prop.ContractedAt = &now
		prop.ExpectedActiveDate = s.calcETA(&prop)
	case models.LifecycleSetting:
		prop.SettingStartedAt = &now
		prop.ExpectedActiveDate = s.calcETA(&prop)
	case models.LifecyclePartiallyActive:
		// Master(Airbnb) active → 판매 시작 가능
		prop.Status = models.PropertyStatusActive
		prop.OperationStatus = models.OperationStatusAvailable
		if prop.ActiveAt == nil {
			prop.ActiveAt = &now
		}
	case models.LifecycleFullyDistributed:
		// 전체 플랫폼 등록 완료
		prop.Status = models.PropertyStatusActive
	case models.LifecycleActive:
		prop.ActiveAt = &now
		prop.Status = models.PropertyStatusActive
		prop.OperationStatus = models.OperationStatusAvailable
	case models.LifecyclePaused:
		prop.Status = models.PropertyStatusPaused
	case models.LifecycleClosed:
		prop.Status = models.PropertyStatusClosed
	}

	config.DB.Save(&prop)

	// 로그
	LogActivity(userID, userName, "lifecycle_changed", "property", &propertyID,
		fmt.Sprintf("%s → %s: %s", oldStatus, newStatus, prop.Name))

	return nil
}

// ETA 자동 계산
func (s *LifecycleService) calcETA(prop *models.Property) *time.Time {
	base := time.Now()
	if prop.ContractedAt != nil {
		base = *prop.ContractedAt
	}

	var settingDays int
	switch prop.SettingType {
	case models.SettingLight:
		settingDays = 3
	case models.SettingStandard:
		settingDays = 5
	case models.SettingRenovation:
		settingDays = 14
	default:
		settingDays = 5
	}

	eta := base.AddDate(0, 0, settingDays+3) // setting + filming(1) + OTA(1) + ready(1)
	return &eta
}

// --- 온보딩 체크리스트 ---

// 숙소 최초 체크리스트 생성
func (s *LifecycleService) InitOnboarding(propertyID uint) {
	// 이미 있으면 스킵
	var count int64
	config.DB.Model(&models.OnboardingCheck{}).Where("property_id = ?", propertyID).Count(&count)
	if count > 0 {
		return
	}

	for _, phase := range models.OnboardingPhases {
		for _, item := range phase.Items {
			config.DB.Create(&models.OnboardingCheck{
				PropertyID: propertyID,
				Phase:      phase.Phase,
				Item:       item,
			})
		}
	}
}

func (s *LifecycleService) GetOnboarding(propertyID uint) []models.OnboardingCheck {
	var checks []models.OnboardingCheck
	config.DB.Where("property_id = ?", propertyID).Order("phase ASC, id ASC").Find(&checks)
	return checks
}

func (s *LifecycleService) ToggleCheck(checkID uint, userID *uint, userName string) (models.OnboardingCheck, error) {
	var check models.OnboardingCheck
	if err := config.DB.First(&check, checkID).Error; err != nil {
		return check, err
	}

	now := time.Now()
	if check.IsChecked {
		check.IsChecked = false
		check.CheckedByID = nil
		check.CheckedByName = ""
		check.CheckedAt = nil
	} else {
		check.IsChecked = true
		check.CheckedByID = userID
		check.CheckedByName = userName
		check.CheckedAt = &now
	}

	config.DB.Save(&check)

	// 로그
	action := "onboarding_checked"
	if !check.IsChecked {
		action = "onboarding_unchecked"
	}
	LogActivity(userID, userName, action, "property", &check.PropertyID,
		fmt.Sprintf("Phase %d: %s", check.Phase, check.Item))

	return check, nil
}

// --- 플랫폼 관리 ---

func (s *LifecycleService) GetPlatforms(propertyID uint) []models.PropertyPlatform {
	var platforms []models.PropertyPlatform
	config.DB.Where("property_id = ?", propertyID).Order("platform ASC").Find(&platforms)
	return platforms
}

func (s *LifecycleService) UpsertPlatform(p models.PropertyPlatform) (models.PropertyPlatform, error) {
	if p.ID > 0 {
		config.DB.Save(&p)
	} else {
		config.DB.Create(&p)
	}
	return p, nil
}

// --- 투자자 ---

func (s *LifecycleService) ListInvestors() []models.Investor {
	var investors []models.Investor
	config.DB.Order("name ASC").Find(&investors)
	return investors
}

func (s *LifecycleService) CreateInvestor(inv models.Investor) (models.Investor, error) {
	if err := config.DB.Create(&inv).Error; err != nil {
		return inv, err
	}
	return inv, nil
}

// --- 파이프라인 요약 (Founder용) ---

type PipelineSummary struct {
	Lead              int64 `json:"lead"`
	Meeting           int64 `json:"meeting"`
	Negotiating       int64 `json:"negotiating"`
	Contracted        int64 `json:"contracted"`
	Setting           int64 `json:"setting"`
	Filming           int64 `json:"filming"`
	OTARegistering    int64 `json:"ota_registering"`
	OperationReady    int64 `json:"operation_ready"`
	PartiallyActive   int64 `json:"partially_active"`
	FullyDistributed  int64 `json:"fully_distributed"`
	Active            int64 `json:"active"`
	Paused            int64 `json:"paused"`
	Closed            int64 `json:"closed"`
	BottleneckCount   int64 `json:"bottleneck_count"`
}

func (s *LifecycleService) GetPipeline() PipelineSummary {
	var summary PipelineSummary

	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	config.DB.Model(&models.Property{}).
		Select("lifecycle_status as status, COUNT(*) as count").
		Where("lifecycle_status != ''").
		Group("lifecycle_status").
		Scan(&rows)

	for _, r := range rows {
		switch r.Status {
		case "lead":
			summary.Lead = r.Count
		case "meeting":
			summary.Meeting = r.Count
		case "negotiating":
			summary.Negotiating = r.Count
		case "contracted":
			summary.Contracted = r.Count
		case "setting":
			summary.Setting = r.Count
		case "filming":
			summary.Filming = r.Count
		case "ota_registering":
			summary.OTARegistering = r.Count
		case "operation_ready":
			summary.OperationReady = r.Count
		case "partially_active":
			summary.PartiallyActive = r.Count
		case "fully_distributed":
			summary.FullyDistributed = r.Count
		case "active":
			summary.Active = r.Count
		case "paused":
			summary.Paused = r.Count
		case "closed":
			summary.Closed = r.Count
		}
	}

	// 병목: setting 7일+, filming 2일+, ota 3일+
	config.DB.Model(&models.Property{}).
		Where("(lifecycle_status = 'setting' AND setting_started_at < ?) OR "+
			"(lifecycle_status = 'filming' AND setting_started_at < ?) OR "+
			"(lifecycle_status = 'ota_registering' AND setting_started_at < ?)",
			time.Now().AddDate(0, 0, -7),
			time.Now().AddDate(0, 0, -9),
			time.Now().AddDate(0, 0, -11),
		).Count(&summary.BottleneckCount)

	return summary
}
