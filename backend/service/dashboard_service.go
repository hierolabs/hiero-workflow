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

	// 🔥 액션 생성 (오늘 모드일 때만)
	targetOccupancy := 82.0
	targetADR := int64(120000)
	actions := []map[string]interface{}{}

	// 공실 위험 호실 ID
	vacantPropertyIDs := []int64{}
	for _, vp := range vacantProperties {
		vacantPropertyIDs = append(vacantPropertyIDs, vp.ID)
	}

	checkOutPropertyIDs := []int64{}
	for _, r := range checkOuts {
		checkOutPropertyIDs = append(checkOutPropertyIDs, r.PropertyID)
	}

	checkInPropertyIDs := []int64{}
	checkInNames := []string{}
	for _, r := range checkIns {
		checkInPropertyIDs = append(checkInPropertyIDs, r.PropertyID)
		if title, ok := propTitleMap[r.PropertyID]; ok {
			checkInNames = append(checkInNames, title)
		} else {
			checkInNames = append(checkInNames, fmt.Sprintf("#%d", r.PropertyID))
		}
	}

	// 액션은 오늘 모드일 때만 생성
	if query.IsToday() {

	// 액션 1: 공실 위험
	if vacantCritical > 0 {
		vacantDesc := fmt.Sprintf("7일 이상 공실 %d개, 3일 이상 %d개.\n", vacantCritical, vacantWarning)
		for _, vp := range vacantProperties {
			if vp.Severity == "critical" {
				vacantDesc += fmt.Sprintf("- %s (%d일 공실)\n", vp.Title, vp.VacantDays)
			}
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "risk",
			"title":    fmt.Sprintf("장기 공실 %d개 — 즉시 가격 인하 필요", vacantCritical),
			"detail":   fmt.Sprintf("7일 이상 공실 %d개, 3일 이상 %d개. 일 손실 추정 ₩%s", vacantCritical, vacantWarning, fmtAmount(int64(vacantCritical)*avgADR)),
			"action":   "공실 숙소 가격 10~20% 인하 적용",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P0",
				"title":       fmt.Sprintf("장기 공실 %d개 — 즉시 가격 인하 필요", vacantCritical),
				"description": vacantDesc,
			},
			"property_ids": vacantPropertyIDs,
		})
	}

	// 액션 2: 가동률 목표 미달
	if occupancyRate < targetOccupancy {
		gap := targetOccupancy - occupancyRate
		lostRevenue := int64(gap / 100 * float64(len(properties)) * float64(avgADR))
		actions = append(actions, map[string]interface{}{
			"priority": "P1",
			"type":     "occupancy",
			"title":    fmt.Sprintf("가동률 %.1f%% — 목표 %.0f%% 대비 -%.1f%%p", occupancyRate, targetOccupancy, gap),
			"detail":   fmt.Sprintf("일 손실 추정 ₩%s", fmtAmount(lostRevenue)),
			"action":   "공실 숙소 프로모션 또는 가격 조정",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P1",
				"title":       fmt.Sprintf("가동률 %.1f%% — 목표 대비 -%.1f%%p, 가격 조정 검토", occupancyRate, gap),
				"description": fmt.Sprintf("현재 가동률 %.1f%%, 목표 %.0f%%. 일 손실 추정 ₩%s.", occupancyRate, targetOccupancy, fmtAmount(lostRevenue)),
			},
			"property_ids": vacantPropertyIDs,
		})
	}

	// 액션 3: ADR 목표 미달
	if avgADR < targetADR && avgADR > 0 {
		diffPct := float64(targetADR-avgADR) / float64(targetADR) * 100
		pricingDesc := fmt.Sprintf("현재 평균 ADR ₩%s, 목표 ₩%s (-%.0f%%).\n채널별 현황:\n", fmtAmount(avgADR), fmtAmount(targetADR), diffPct)
		for ch, sum := range channelADRSum {
			cnt := channelADRCount[ch]
			if cnt > 0 {
				pricingDesc += fmt.Sprintf("- %s: ₩%s (%d건)\n", ch, fmtAmount(sum/int64(cnt)), cnt)
			}
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P1",
			"type":     "pricing",
			"title":    fmt.Sprintf("평균 ADR ₩%s — 목표 ₩%s 대비 -%.0f%%", fmtAmount(avgADR), fmtAmount(targetADR), diffPct),
			"detail":   "채널별 가격 차이 확인 필요",
			"action":   "저가 채널 가격 조정 또는 최소 숙박일 변경",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P1",
				"title":       fmt.Sprintf("ADR ₩%s — 목표 대비 -%.0f%%, 채널 가격 조정 필요", fmtAmount(avgADR), diffPct),
				"description": pricingDesc,
			},
		})
	}

	// 액션 4: 체크아웃 → 청소
	if len(checkOuts) > 0 {
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "operation",
			"title":    fmt.Sprintf("오늘 체크아웃 %d건 — 청소 배정 확인", len(checkOuts)),
			"detail":   "체크아웃 숙소 청소 완료 여부 확인 필요",
			"action":   "청소팀 배정 상태 체크",
			"dispatch_target": "cleaning",
			"dispatch_payload": map[string]interface{}{
				"date": today,
			},
			"property_ids": checkOutPropertyIDs,
		})
	}

	// 액션 5: 체크인 준비
	if len(checkIns) > 0 {
		checkInDesc := fmt.Sprintf("오늘 체크인 %d건. 청소 완료 + 가이드 발송 확인 필요.\n", len(checkIns))
		for _, name := range checkInNames {
			checkInDesc += fmt.Sprintf("- %s\n", name)
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "operation",
			"title":    fmt.Sprintf("오늘 체크인 %d건 — 준비 상태 확인", len(checkIns)),
			"detail":   "체크인 숙소 청소 완료 + 가이드 발송 확인",
			"action":   "체크인 가이드 발송 여부 확인",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "cleaning",
				"priority":    "P0",
				"title":       fmt.Sprintf("오늘 체크인 %d건 — 준비 상태 확인", len(checkIns)),
				"description": checkInDesc,
			},
			"property_ids": checkInPropertyIDs,
		})
	}

	} // end if query.IsToday()

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
