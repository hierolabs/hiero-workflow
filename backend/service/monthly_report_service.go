package service

import (
	"fmt"
	"log"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type MonthlyReportService struct{}

func NewMonthlyReportService() *MonthlyReportService {
	return &MonthlyReportService{}
}

// GenerateMonth 특정 월의 monthly_property_reports 생성 (기존 데이터 삭제 후 재생성)
func (s *MonthlyReportService) GenerateMonth(month string) (int, error) {
	if len(month) != 7 {
		return 0, fmt.Errorf("month 형식 오류: %s (YYYY-MM 필요)", month)
	}

	year := 0
	mon := 0
	fmt.Sscanf(month, "%d-%d", &year, &mon)
	if year == 0 || mon == 0 {
		return 0, fmt.Errorf("month 파싱 실패: %s", month)
	}

	daysInMonth := time.Date(year, time.Month(mon+1), 0, 0, 0, 0, 0, time.UTC).Day()
	monthStart := fmt.Sprintf("%s-01", month)
	monthEnd := fmt.Sprintf("%s-%02d", month, daysInMonth)

	// 기존 데이터 삭제
	config.DB.Where("month = ?", month).Delete(&models.MonthlyPropertyReport{})

	// 숙소 조회
	var properties []models.Property
	config.DB.Select("id, name, display_name").Find(&properties)

	inserted := 0
	for _, prop := range properties {
		pName := prop.DisplayName
		if pName == "" {
			pName = prop.Name
		}
		report := s.buildReport(prop.ID, pName, month, monthStart, monthEnd, daysInMonth)
		if report == nil {
			continue
		}
		config.DB.Create(report)
		inserted++
	}

	log.Printf("[MonthlyReport] %s: %d개 숙소 생성", month, inserted)
	return inserted, nil
}

// GenerateAll 거래 데이터가 있는 모든 월에 대해 생성
func (s *MonthlyReportService) GenerateAll() (int, error) {
	var months []string
	config.DB.Model(&models.HostexTransaction{}).
		Select("DISTINCT `year_month`").
		Where("`year_month` IS NOT NULL AND `year_month` != ''").
		Order("`year_month`").
		Pluck("`year_month`", &months)

	total := 0
	for _, m := range months {
		n, err := s.GenerateMonth(m)
		if err != nil {
			log.Printf("[MonthlyReport] %s 오류: %v", m, err)
			continue
		}
		total += n
	}
	return total, nil
}

// GeneratePreviousMonth 전월 리포트 생성 (cron용)
func (s *MonthlyReportService) GeneratePreviousMonth() (int, error) {
	now := time.Now()
	prev := now.AddDate(0, -1, 0)
	month := fmt.Sprintf("%04d-%02d", prev.Year(), prev.Month())
	return s.GenerateMonth(month)
}

func (s *MonthlyReportService) buildReport(propID uint, propName, month, monthStart, monthEnd string, daysInMonth int) *models.MonthlyPropertyReport {
	// ── 매출/비용: hostex_transactions ──
	type txRow struct {
		Type     string
		Category string
		Total    int64
	}
	var txRows []txRow
	config.DB.Model(&models.HostexTransaction{}).
		Select("type, category, SUM(amount) as total").
		Where("property_id = ? AND `year_month` = ?", propID, month).
		Group("type, category").
		Scan(&txRows)

	var room, cleaningFee, petFee, extraFee, tax, commission int64
	var cleaningCost, rentIn, rentOut, mgmt, operation, refund, labor, supplies, interior, other int64

	incomeMap := map[string]*int64{
		"객실 요금":     &room,
		"청소비 수입":    &cleaningFee,
		"반려동물 수수료":  &petFee,
		"추가 수입":     &extraFee,
	}
	commCats := map[string]bool{"수수료": true, "플랫폼 수수료": true, "호스트 수수료": true}
	taxCats := map[string]bool{"세금": true, "부가세": true}

	expenseMap := map[string]*int64{
		"청소 비용": &cleaningCost,
		"Rent_out": &rentOut,
		"Rent_in":  &rentIn,
		"관리비":    &mgmt,
		"운영비":    &operation,
		"환불":     &refund,
		"인건비":    &labor,
		"소모품":    &supplies,
		"인테리어":   &interior,
	}

	for _, row := range txRows {
		if row.Type == "수입" {
			if ptr, ok := incomeMap[row.Category]; ok {
				*ptr += row.Total
			} else if commCats[row.Category] {
				commission += row.Total
			} else if taxCats[row.Category] {
				tax += row.Total
			} else {
				room += row.Total
			}
		} else if row.Type == "비용" {
			if ptr, ok := expenseMap[row.Category]; ok {
				*ptr += row.Total
			} else {
				other += row.Total
			}
		}
	}

	// ── 점유율 (AOR) ──
	var occupied int64
	config.DB.Raw(`
		SELECT COALESCE(SUM(
			DATEDIFF(
				LEAST(check_out_date, DATE_ADD(?, INTERVAL 1 DAY)),
				GREATEST(check_in_date, ?)
			)
		), 0) as occupied_nights
		FROM reservations
		WHERE internal_prop_id = ?
		  AND status NOT IN ('cancelled', 'no_show')
		  AND check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
		  AND check_out_date > ?
	`, monthEnd, monthStart, propID, monthEnd, monthStart).Scan(&occupied)

	if occupied > int64(daysInMonth) {
		occupied = int64(daysInMonth)
	}

	// 총합 계산
	gross := room + cleaningFee + petFee + extraFee + tax + commission
	totalCost := abs64(cleaningCost) + abs64(rentOut) + abs64(mgmt) + abs64(operation) +
		abs64(refund) + abs64(labor) + abs64(supplies) + abs64(interior) + abs64(other) - abs64(rentIn)

	// 데이터 없으면 스킵
	if gross == 0 && totalCost == 0 && occupied == 0 {
		return nil
	}

	net := gross - totalCost
	aor := 0.0
	if daysInMonth > 0 {
		aor = float64(occupied) / float64(daysInMonth)
	}
	margin := 0.0
	if gross != 0 {
		margin = float64(net) / float64(gross)
	}
	adr := int64(0)
	if occupied > 0 {
		adr = room / occupied
	}

	return &models.MonthlyPropertyReport{
		PropertyID:   &propID,
		PropertyName: propName,
		Month:        month,
		AOR:          aor,
		ADR:          adr,
		Room:         room,
		CleaningFee:  cleaningFee,
		PetFee:       petFee,
		ExtraFee:     extraFee,
		Tax:          tax,
		Commission:   commission,
		Gross:        gross,
		CleaningCost: cleaningCost,
		RentIn:       rentIn,
		RentOut:      rentOut,
		Mgmt:         mgmt,
		Operation:    operation,
		Refund:       refund,
		Labor:        labor,
		Supplies:     supplies,
		Interior:     interior,
		Other:        other,
		TotalCost:    totalCost,
		Net:          net,
		Margin:       margin,
		SourceFilename: "auto_generated",
	}
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}
