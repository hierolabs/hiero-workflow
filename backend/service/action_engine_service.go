package service

import (
	"fmt"
	"sync"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// Action — 액션 엔진이 생성하는 구조체
type Action struct {
	RuleID      string   `json:"rule_id"`      // vacancy, low_occ, checkin_risk, revenue, conversion
	Priority    string   `json:"priority"`      // P0, P1, P2
	Title       string   `json:"title"`         // "[긴급] 내일 공실 5개 이상"
	Details     []string `json:"details"`       // 실행할 액션 목록
	Assignee    string   `json:"assignee"`      // "김진태"
	Deadline    string   `json:"deadline"`      // "오늘 18:00"
	IssueType   string   `json:"issue_type"`    // decision, cleaning, guest 등
	PropertyIDs []int64  `json:"property_ids"`  // 영향 숙소
	Properties  []string `json:"properties"`    // 숙소명 목록
}

type ActionEngineService struct {
	issueSvc *IssueService
}

func NewActionEngineService() *ActionEngineService {
	return &ActionEngineService{
		issueSvc: NewIssueService(),
	}
}

// EvaluateAll — 5가지 규칙 평가, 액션 목록 반환
func (s *ActionEngineService) EvaluateAll() []Action {
	today := time.Now().Format("2006-01-02")
	tomorrow := time.Now().Add(24 * time.Hour).Format("2006-01-02")
	sevenDaysAgo := time.Now().Add(-7 * 24 * time.Hour).Format("2006-01-02")

	// 데이터 병렬 로드
	var (
		properties     []models.Property
		tomorrowInHouse []models.Reservation
		weekResvs      []models.Reservation
		todayCheckIns  []models.Reservation
		inHouseNow     []models.Reservation
		conversations  []models.Conversation
		weekBookings   []models.Reservation
	)

	var wg sync.WaitGroup
	wg.Add(7)

	go func() {
		defer wg.Done()
		config.DB.Where("status = ?", "active").Select("id, hostex_id, name").Find(&properties)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id, property_id, check_in_date, check_out_date").
			Where("check_in_date <= ? AND check_out_date > ? AND status = ?", tomorrow, tomorrow, "accepted").
			Find(&tomorrowInHouse)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id, property_id, internal_prop_id, check_in_date, check_out_date, nights, total_rate").
			Where("check_in_date >= ? AND check_in_date <= ? AND status = ?", sevenDaysAgo, today, "accepted").
			Find(&weekResvs)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id, property_id, guest_name").
			Where("check_in_date = ? AND status = ?", today, "accepted").
			Find(&todayCheckIns)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id, property_id, total_rate, nights, channel_name, channel_type").
			Where("check_in_date <= ? AND check_out_date > ? AND status = ?", today, today, "accepted").
			Find(&inHouseNow)
	}()
	go func() {
		defer wg.Done()
		config.DB.Where("created_at >= ?", sevenDaysAgo).Select("id").Find(&conversations)
	}()
	go func() {
		defer wg.Done()
		config.DB.Select("id").
			Where("booked_at >= ? AND status = ?", sevenDaysAgo+"T00:00:00", "accepted").
			Find(&weekBookings)
	}()

	wg.Wait()

	// 숙소 맵
	propMap := map[int64]string{}
	for _, p := range properties {
		propMap[int64(p.ID)] = p.Name
		if p.HostexID > 0 {
			propMap[p.HostexID] = p.Name
		}
	}

	var actions []Action

	// ① 공실 기반 액션: D+1 공실 ≥ 5
	actions = append(actions, s.evalVacancy(properties, tomorrowInHouse, propMap, tomorrow)...)

	// ② 저가동률 숙소: 최근 7일 가동률 < 40%
	actions = append(actions, s.evalLowOccupancy(properties, weekResvs, propMap, sevenDaysAgo, today)...)

	// ③ 체크인 리스크: 오늘 체크인 > 10
	actions = append(actions, s.evalCheckinRisk(todayCheckIns)...)

	// ④ 매출 이상: ADR 목표 대비 -10%
	actions = append(actions, s.evalRevenue(inHouseNow)...)

	// ⑤ 전환율: 문의→예약 < 50%
	actions = append(actions, s.evalConversion(conversations, weekBookings)...)

	return actions
}

// ① 공실 D+1
func (s *ActionEngineService) evalVacancy(properties []models.Property, tomorrowInHouse []models.Reservation, propMap map[int64]string, tomorrow string) []Action {
	occupied := map[int64]bool{}
	for _, r := range tomorrowInHouse {
		occupied[r.PropertyID] = true
	}

	var vacantIDs []int64
	var vacantNames []string
	for _, p := range properties {
		pid := p.HostexID
		if pid == 0 {
			pid = int64(p.ID)
		}
		if !occupied[pid] {
			vacantIDs = append(vacantIDs, int64(p.ID))
			vacantNames = append(vacantNames, p.Name)
		}
	}

	if len(vacantIDs) < 5 {
		return nil
	}

	// 상위 10개만 표시
	displayNames := vacantNames
	if len(displayNames) > 10 {
		displayNames = displayNames[:10]
	}

	details := []string{
		fmt.Sprintf("내일(%s) 공실 %d개 — 전 객실 가격 -10%% 조정", tomorrow, len(vacantIDs)),
		"OTA 노출 최적화 (대표사진/제목 점검)",
	}
	for _, n := range displayNames {
		details = append(details, fmt.Sprintf("  · %s", n))
	}

	return []Action{{
		RuleID:      "vacancy",
		Priority:    "P0",
		Title:       fmt.Sprintf("[긴급] 내일 공실 %d개 — 가격 인하 필요", len(vacantIDs)),
		Details:     details,
		Assignee:    "김진태",
		Deadline:    "오늘 18:00",
		IssueType:   "decision",
		PropertyIDs: vacantIDs,
		Properties:  displayNames,
	}}
}

// ② 저가동률 (숙소별 최근 7일)
func (s *ActionEngineService) evalLowOccupancy(properties []models.Property, weekResvs []models.Reservation, propMap map[int64]string, from, to string) []Action {
	days := dateDiff(from, to)
	if days < 1 {
		days = 7
	}

	// 숙소별 점유 일수
	propOccDays := map[int64]int{}
	for _, r := range weekResvs {
		overlapStart := from
		if r.CheckInDate > overlapStart {
			overlapStart = r.CheckInDate
		}
		overlapEnd := to
		if r.CheckOutDate < overlapEnd {
			overlapEnd = r.CheckOutDate
		}
		overlap := dateDiff(overlapStart, overlapEnd)
		if overlap > 0 {
			propOccDays[r.PropertyID] += overlap
		}
	}

	type lowProp struct {
		ID   int64
		Name string
		Rate float64
	}
	var lowList []lowProp

	for _, p := range properties {
		pid := p.HostexID
		if pid == 0 {
			pid = int64(p.ID)
		}
		occ := float64(propOccDays[pid]) / float64(days) * 100
		if occ < 40 {
			lowList = append(lowList, lowProp{int64(p.ID), p.Name, occ})
		}
	}

	if len(lowList) == 0 {
		return nil
	}

	// 가동률 낮은 순 정렬
	for i := 0; i < len(lowList); i++ {
		for j := i + 1; j < len(lowList); j++ {
			if lowList[j].Rate < lowList[i].Rate {
				lowList[i], lowList[j] = lowList[j], lowList[i]
			}
		}
	}

	// 상위 5개만 액션 생성
	display := lowList
	if len(display) > 5 {
		display = display[:5]
	}

	var ids []int64
	var names []string
	details := []string{fmt.Sprintf("최근 7일 가동률 40%% 미만 숙소 %d개", len(lowList))}
	for _, lp := range display {
		ids = append(ids, lp.ID)
		names = append(names, lp.Name)
		details = append(details, fmt.Sprintf("  · %s (%.0f%%)", lp.Name, lp.Rate))
	}
	details = append(details, "→ 구조 문제 점검 (침대 구성, 타겟 변경)")

	deadline := time.Now().Add(3 * 24 * time.Hour).Format("2006-01-02")

	return []Action{{
		RuleID:      "low_occ",
		Priority:    "P1",
		Title:       fmt.Sprintf("[개선 필요] 저가동 숙소 %d개 — 구조 점검", len(lowList)),
		Details:     details,
		Assignee:    "김진우",
		Deadline:    deadline,
		IssueType:   "decision",
		PropertyIDs: ids,
		Properties:  names,
	}}
}

// ③ 체크인 리스크
func (s *ActionEngineService) evalCheckinRisk(todayCheckIns []models.Reservation) []Action {
	count := len(todayCheckIns)
	if count <= 10 {
		return nil
	}

	return []Action{{
		RuleID:   "checkin_risk",
		Priority: "P0",
		Title:    fmt.Sprintf("[운영 집중] 오늘 체크인 %d건 — 전수 점검", count),
		Details: []string{
			fmt.Sprintf("오늘 체크인 %d건 — 평소 대비 높음", count),
			"→ 청소 완료 여부 전수 확인",
			"→ 체크인 안내 메시지 발송 점검",
		},
		Assignee:  "우연",
		Deadline:  "오늘 15:00",
		IssueType: "cleaning",
	}}
}

// ④ 매출 이상
func (s *ActionEngineService) evalRevenue(inHouseNow []models.Reservation) []Action {
	if len(inHouseNow) == 0 {
		return nil
	}

	targetADR := int64(120000)
	var totalADR int64
	count := 0
	for _, r := range inHouseNow {
		nights := r.Nights
		if nights < 1 {
			nights = 1
		}
		totalADR += r.TotalRate / int64(nights)
		count++
	}
	avgADR := totalADR / int64(count)
	gapPct := float64(avgADR-targetADR) / float64(targetADR) * 100

	if gapPct >= -10 {
		return nil // -10% 이내면 정상
	}

	return []Action{{
		RuleID:   "revenue",
		Priority: "P1",
		Title:    fmt.Sprintf("[수익 경고] ADR %.0f%% — ₩%s (목표 ₩%s)", gapPct, fmtAmount(avgADR), fmtAmount(targetADR)),
		Details: []string{
			fmt.Sprintf("현재 평균 ADR ₩%s, 목표 ₩%s (%.0f%%)", fmtAmount(avgADR), fmtAmount(targetADR), gapPct),
			"→ PriceLabs 설정 점검",
			"→ 채널별 가격 비교 확인",
		},
		Assignee:  "김진우",
		Deadline:  "오늘",
		IssueType: "decision",
	}}
}

// ⑤ 전환율
func (s *ActionEngineService) evalConversion(conversations []models.Conversation, weekBookings []models.Reservation) []Action {
	convCount := len(conversations)
	bookCount := len(weekBookings)

	if convCount == 0 {
		return nil
	}

	rate := float64(bookCount) / float64(convCount) * 100
	if rate >= 50 {
		return nil
	}

	return []Action{{
		RuleID:   "conversion",
		Priority: "P1",
		Title:    fmt.Sprintf("[영업 문제] 문의→예약 전환율 %.0f%% (7일)", rate),
		Details: []string{
			fmt.Sprintf("최근 7일: 문의 %d건, 예약 %d건 → 전환율 %.0f%%", convCount, bookCount, rate),
			"→ 응답 속도 5분 이내 유지",
			"→ 자동응답 문구 개선",
		},
		Assignee:  "오재관",
		Deadline:  "즉시",
		IssueType: "guest",
	}}
}

// ExecuteActions — 액션 → 이슈 자동 등록 (중복 방지)
func (s *ActionEngineService) ExecuteActions(actions []Action) (int, error) {
	today := time.Now().Format("2006-01-02")
	created := 0

	for _, a := range actions {
		// 오늘 같은 rule_id로 이미 등록된 이슈가 있으면 스킵
		var count int64
		config.DB.Model(&models.Issue{}).
			Where("rule_id = ? AND DATE(created_at) = ?", a.RuleID, today).
			Count(&count)
		if count > 0 {
			continue
		}

		// 상세 내용 조합
		desc := ""
		for _, d := range a.Details {
			desc += d + "\n"
		}

		issue := models.Issue{
			Title:       a.Title,
			Description: desc,
			IssueType:   a.IssueType,
			Priority:    a.Priority,
			Status:      "open",
			Deadline:    a.Deadline,
			RuleID:      a.RuleID,
		}

		// 첫 번째 숙소 연결
		if len(a.PropertyIDs) > 0 {
			pid := uint(a.PropertyIDs[0])
			issue.PropertyID = &pid
		}
		if len(a.Properties) > 0 {
			issue.PropertyName = a.Properties[0]
			if len(a.Properties) > 1 {
				issue.PropertyName = fmt.Sprintf("%s 외 %d개", a.Properties[0], len(a.Properties)-1)
			}
		}

		// 이슈 생성 (자동 배정 포함)
		if _, err := s.issueSvc.Create(issue); err == nil {
			created++
		}
	}

	return created, nil
}
