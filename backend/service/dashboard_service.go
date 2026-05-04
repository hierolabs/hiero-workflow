package service

import (
	"fmt"
	"sync"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type DashboardService struct{}

func NewDashboardService() *DashboardService {
	return &DashboardService{}
}

// DashboardQuery — 대시보드 기간 필터
type DashboardQuery struct {
	StartDate string `form:"start_date"` // 2026-05-01
	EndDate   string `form:"end_date"`   // 2026-05-04
}

// Normalize — 기본값 설정 (비어있으면 오늘)
func (q *DashboardQuery) Normalize() {
	today := time.Now().Format("2006-01-02")
	if q.StartDate == "" {
		q.StartDate = today
	}
	if q.EndDate == "" {
		q.EndDate = q.StartDate
	}
}

// IsToday — 오늘 하루인지 확인 (액션 카드 표시 여부 판단)
func (q *DashboardQuery) IsToday() bool {
	today := time.Now().Format("2006-01-02")
	return q.StartDate == today && q.EndDate == today
}

// DayCount — 기간 일수
func (q *DashboardQuery) DayCount() int {
	d := dateDiff(q.StartDate, q.EndDate)
	if d < 1 {
		return 1
	}
	return d + 1
}

// GetCEODashboard — DB 기반 CEO 대시보드 (기간 필터 지원)
func (s *DashboardService) GetCEODashboard(query DashboardQuery) (map[string]interface{}, error) {
	query.Normalize()
	startDate := query.StartDate
	endDate := query.EndDate
	today := time.Now().Format("2006-01-02")
	threeDaysLater := time.Now().Add(3 * 24 * time.Hour).Format("2006-01-02")
	sevenDaysLater := time.Now().Add(7 * 24 * time.Hour).Format("2006-01-02")

	// DB 쿼리 병렬 실행
	var (
		properties      []models.Property
		checkIns        []models.Reservation
		checkOuts       []models.Reservation
		inHouse         []models.Reservation
		todayBookings   []models.Reservation
		upcoming3d      []models.Reservation
		upcoming7d      []models.Reservation
		recentCheckouts []models.Reservation
	)

	sixtyDaysBefore, _ := time.Parse("2006-01-02", endDate)
	sixtyDaysAgo := sixtyDaysBefore.Add(-60 * 24 * time.Hour).Format("2006-01-02")

	var wg sync.WaitGroup
	wg.Add(8)

	// 필요한 컬럼만 SELECT (네트워크+메모리 절감)
	rsvCols := "id, property_id, internal_prop_id, check_in_date, check_out_date, nights, total_rate, total_commission, channel_name, channel_type, booked_at, status"

	go func() { defer wg.Done(); config.DB.Where("status = ?", "active").Select("id, hostex_id, name").Find(&properties) }()
	go func() {
		defer wg.Done()
		config.DB.Select(rsvCols).Where("check_in_date >= ? AND check_in_date <= ? AND status = ?", startDate, endDate, "accepted").Find(&checkIns)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select(rsvCols).Where("check_out_date >= ? AND check_out_date <= ? AND status = ?", startDate, endDate, "accepted").Find(&checkOuts)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select(rsvCols).Where("check_in_date <= ? AND check_out_date > ? AND status = ?", endDate, startDate, "accepted").Find(&inHouse)
	}()
	go func() {
		defer wg.Done()
		if startDate == endDate {
			config.DB.Select(rsvCols).Where("booked_at >= ? AND booked_at < ?  AND status = ?", startDate+"T00:00:00", startDate+"T23:59:59", "accepted").Find(&todayBookings)
		} else {
			config.DB.Select(rsvCols).Where("booked_at >= ? AND booked_at < ? AND status = ?", startDate+"T00:00:00", endDate+"T23:59:59", "accepted").Find(&todayBookings)
		}
	}()
	go func() {
		defer wg.Done()
		config.DB.Select(rsvCols).Where("check_in_date > ? AND check_in_date <= ? AND status = ?", today, threeDaysLater, "accepted").Find(&upcoming3d)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select(rsvCols).Where("check_in_date > ? AND check_in_date <= ? AND status = ?", today, sevenDaysLater, "accepted").Find(&upcoming7d)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id, property_id, check_out_date").Where("check_out_date >= ? AND check_out_date <= ? AND status = ?", sixtyDaysAgo, endDate, "accepted").Find(&recentCheckouts)
	}()

	wg.Wait()

	lastCheckout := map[int64]string{}
	for _, r := range recentCheckouts {
		if r.PropertyID > 0 {
			if existing, ok := lastCheckout[r.PropertyID]; !ok || r.CheckOutDate > existing {
				lastCheckout[r.PropertyID] = r.CheckOutDate
			}
		}
	}

	// 숙소 ID → 이름 맵
	propTitleMap := map[int64]string{}
	for _, p := range properties {
		propTitleMap[int64(p.ID)] = p.Name
		if p.HostexID > 0 {
			propTitleMap[p.HostexID] = p.Name
		}
	}

	// --- 계산 ---

	// 💰 매출
	var todayRevenue, todayCommission int64
	for _, r := range checkIns {
		todayRevenue += r.TotalRate
		todayCommission += r.TotalCommission
	}

	var inHouseRevenue int64
	for _, r := range inHouse {
		nights := r.Nights
		if nights < 1 {
			nights = 1
		}
		inHouseRevenue += r.TotalRate / int64(nights)
	}

	// 숙소별 점유
	occupiedToday := map[int64]bool{}
	occupied3d := map[int64]bool{}
	for _, r := range inHouse {
		occupiedToday[r.PropertyID] = true
		occupied3d[r.PropertyID] = true
	}
	for _, r := range checkIns {
		occupiedToday[r.PropertyID] = true
		occupied3d[r.PropertyID] = true
	}
	for _, r := range upcoming3d {
		occupied3d[r.PropertyID] = true
	}

	// ADR
	var totalADR int64
	adrCount := 0
	channelADRSum := map[string]int64{}
	channelADRCount := map[string]int{}
	for _, r := range inHouse {
		nights := r.Nights
		if nights < 1 {
			nights = 1
		}
		adr := r.TotalRate / int64(nights)
		totalADR += adr
		adrCount++

		ch := r.ChannelName
		if ch == "" {
			ch = r.ChannelType
		}
		if ch == "" {
			ch = "기타"
		}
		channelADRSum[ch] += adr
		channelADRCount[ch]++
	}
	avgADR := int64(0)
	if adrCount > 0 {
		avgADR = totalADR / int64(adrCount)
	}

	// 🔴 리스크: 공실
	type VacantProperty struct {
		ID         int64  `json:"id"`
		Title      string `json:"title"`
		VacantDays int    `json:"vacant_days"`
		Severity   string `json:"severity"`
		Action     string `json:"action"`
	}

	var vacantProperties []VacantProperty
	var vacantCritical, vacantWarning int
	for _, p := range properties {
		pid := p.HostexID
		if pid == 0 {
			pid = int64(p.ID)
		}
		if !occupiedToday[pid] {
			vacantDays := 1
			if lc, ok := lastCheckout[pid]; ok {
				vacantDays = dateDiff(lc, today)
				if vacantDays < 1 {
					vacantDays = 1
				}
			} else {
				vacantDays = 30
			}

			severity := "info"
			action := "모니터링"
			if vacantDays >= 7 {
				severity = "critical"
				action = "즉시 가격 인하 필요"
				vacantCritical++
			} else if vacantDays >= 3 {
				severity = "warning"
				action = "가격 조정 검토"
				vacantWarning++
			}

			vacantProperties = append(vacantProperties, VacantProperty{
				ID:         int64(p.ID),
				Title:      p.Name,
				VacantDays: vacantDays,
				Severity:   severity,
				Action:     action,
			})
		}
	}

	// 위험도 순 정렬
	for i := 0; i < len(vacantProperties); i++ {
		for j := i + 1; j < len(vacantProperties); j++ {
			if vacantProperties[j].VacantDays > vacantProperties[i].VacantDays {
				vacantProperties[i], vacantProperties[j] = vacantProperties[j], vacantProperties[i]
			}
		}
	}

	// 📈 성장: 채널별
	channelCount := map[string]int{}
	channelRevenue := map[string]int64{}
	for _, r := range todayBookings {
		ch := r.ChannelName
		if ch == "" {
			ch = r.ChannelType
		}
		if ch == "" {
			ch = "기타"
		}
		channelCount[ch]++
		channelRevenue[ch] += r.TotalRate
	}

	channels := []map[string]interface{}{}
	for ch, cnt := range channelCount {
		channels = append(channels, map[string]interface{}{
			"channel": ch,
			"count":   cnt,
			"revenue": channelRevenue[ch],
		})
	}

	// 가동률 계산
	days := query.DayCount()
	occupancyRate := float64(0)
	if days == 1 {
		// 단일일: 기존 방식 (투숙 중 숙소 수 / 전체 숙소 수)
		if len(properties) > 0 {
			occupancyRate = float64(len(inHouse)) / float64(len(properties)) * 100
		}
	} else {
		// 기간: room-nights 기반
		totalRoomNights := len(properties) * days
		occupiedRoomNights := 0
		for _, r := range inHouse {
			rStart := r.CheckInDate
			rEnd := r.CheckOutDate
			overlapStart := startDate
			if rStart > overlapStart {
				overlapStart = rStart
			}
			overlapEnd := endDate
			if rEnd < overlapEnd {
				overlapEnd = rEnd
			}
			overlap := dateDiff(overlapStart, overlapEnd)
			if overlap > 0 {
				occupiedRoomNights += overlap
			}
		}
		if totalRoomNights > 0 {
			occupancyRate = float64(occupiedRoomNights) / float64(totalRoomNights) * 100
		}
	}

	// 채널별 ADR
	channelPricing := []map[string]interface{}{}
	for ch, sum := range channelADRSum {
		cnt := channelADRCount[ch]
		if cnt > 0 {
			chADR := sum / int64(cnt)
			diffPct := float64(0)
			if avgADR > 0 {
				diffPct = float64(chADR-avgADR) / float64(avgADR) * 100
			}
			channelPricing = append(channelPricing, map[string]interface{}{
				"channel":  ch,
				"avg_adr":  chADR,
				"count":    cnt,
				"diff_pct": fmt.Sprintf("%.1f", diffPct),
			})
		}
	}

	// 🔥 Action Engine — 조건 기반 액션 자동 생성 (오늘 모드만)
	targetOccupancy := 82.0
	targetADR := int64(120000)
	var actions []Action
	if query.IsToday() {
		engine := NewActionEngineService()
		actions = engine.EvaluateAll()
	}

	// 기간 라벨
	periodLabel := startDate
	if startDate != endDate {
		periodLabel = startDate + " ~ " + endDate
	}

	return map[string]interface{}{
		"period": map[string]interface{}{
			"start_date": startDate,
			"end_date":   endDate,
			"days":       days,
			"label":      periodLabel,
			"is_today":   query.IsToday(),
		},
		"actions": actions,
		"revenue": map[string]interface{}{
			"today_revenue":    todayRevenue,
			"today_commission": todayCommission,
			"today_net":        todayRevenue - todayCommission,
			"daily_in_house":   inHouseRevenue,
		},
		"risk": map[string]interface{}{
			"vacant_count":      len(vacantProperties),
			"critical_count":    vacantCritical,
			"warning_count":     vacantWarning,
			"vacant_properties": vacantProperties,
			"total_properties":  len(properties),
		},
		"pricing": map[string]interface{}{
			"avg_adr":         avgADR,
			"target_adr":      targetADR,
			"adr_gap_pct":     fmt.Sprintf("%.1f", float64(avgADR-targetADR)/float64(max(targetADR, 1))*100),
			"channel_pricing": channelPricing,
		},
		"growth": map[string]interface{}{
			"today_new_bookings":   len(todayBookings),
			"upcoming_7d_bookings": len(upcoming7d),
			"channels":            channels,
		},
		"metrics": map[string]interface{}{
			"occupancy_rate":   fmt.Sprintf("%.1f", occupancyRate),
			"target_occupancy": fmt.Sprintf("%.0f", targetOccupancy),
			"avg_adr":          avgADR,
			"check_in_count":   len(checkIns),
			"check_out_count":  len(checkOuts),
			"in_house_count":   len(inHouse),
			"total_properties": len(properties),
		},
	}, nil
}

func dateDiff(from, to string) int {
	f, err1 := time.Parse("2006-01-02", from)
	t, err2 := time.Parse("2006-01-02", to)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(t.Sub(f).Hours() / 24)
}

func fmtAmount(amount int64) string {
	if amount >= 100000000 {
		return fmt.Sprintf("%.1f억", float64(amount)/100000000)
	}
	if amount >= 10000 {
		return fmt.Sprintf("%.0f만", float64(amount)/10000)
	}
	return fmt.Sprintf("%d", amount)
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
