package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"gorm.io/gorm"
)

type CleaningService struct{}

func NewCleaningService() *CleaningService {
	return &CleaningService{}
}

// --- 청소 업무 자동 생성 ---

// GenerateFromCheckouts — 특정 날짜의 체크아웃 예약에서 청소 업무 자동 생성
func (s *CleaningService) GenerateFromCheckouts(date string) (int, error) {
	var reservations []models.Reservation
	config.DB.Where("check_out_date = ? AND status = ?", date, "accepted").
		Find(&reservations)

	// 기존 청소 업무 한 번에 조회 (N+1 제거)
	var existingTasks []models.CleaningTask
	config.DB.Where("cleaning_date = ?", date).Select("reservation_code").Find(&existingTasks)
	existingSet := map[string]bool{}
	for _, t := range existingTasks {
		existingSet[t.ReservationCode] = true
	}

	// Property 맵 사전 로드 (N+1 제거)
	var allProps []models.Property
	config.DB.Select("id, name, code, address").Find(&allProps)
	propMap := map[uint]models.Property{}
	for _, p := range allProps {
		propMap[p.ID] = p
	}

	// CleaningCode 맵 사전 로드 (property_code → 단가 매칭)
	var allCodes []models.CleaningCode
	config.DB.Find(&allCodes)
	codeMap := map[string]models.CleaningCode{} // code → CleaningCode
	for _, c := range allCodes {
		codeMap[c.Code] = c
	}

	// 연장 감지용: 같은 날 같은 숙소에 동일 게스트가 체크인하면 연장
	var sameDayCheckins []models.Reservation
	config.DB.Where("check_in_date = ? AND status = ?", date, "accepted").Find(&sameDayCheckins)
	extensionSet := map[int64]string{} // property_id → checkin guest_name prefix
	for _, ci := range sameDayCheckins {
		prefix := extractNamePrefix(ci.GuestName)
		extensionSet[ci.PropertyID] = prefix
	}

	created := 0
	for _, r := range reservations {
		// 이미 생성된 청소 업무 중복 방지
		if existingSet[r.ReservationCode] {
			continue
		}

		// 연장 감지: 같은 숙소에 동일 이름 게스트가 오늘 체크인 → 청소 불필요
		if ciPrefix, ok := extensionSet[r.PropertyID]; ok {
			coPrefix := extractNamePrefix(r.GuestName)
			if coPrefix != "" && coPrefix == ciPrefix {
				log.Printf("[Cleaning] 연장 감지, 청소 스킵: %s (%s)", r.ReservationCode, r.GuestName)
				continue
			}
		}

		// 내부 Property 정보 조회 (맵에서)
		var propName, propCode, address string
		var propID *uint
		if r.InternalPropID != nil {
			if prop, ok := propMap[*r.InternalPropID]; ok {
				propName = prop.Name
				propCode = prop.Code
				address = prop.Address
				propID = &prop.ID
			}
		}

		// CleaningCode 매칭 → 단가 자동 입력
		var cleaningCodeID *uint
		var cleaningCodeStr string
		var basePrice int
		if cc, ok := codeMap[propCode]; ok {
			cleaningCodeID = &cc.ID
			cleaningCodeStr = cc.Code
			basePrice = cc.BasePrice
		}

		// 다음 체크인 확인 → 우선순위 결정
		priority := s.calcPriority(r.PropertyID, date)

		task := models.CleaningTask{
			PropertyID:      propID,
			ReservationID:   &r.ID,
			ReservationCode: r.ReservationCode,
			CleaningDate:    date,
			CheckOutTime:    "11:00", // default
			NextCheckIn:     s.findNextCheckIn(r.PropertyID, date),
			CleaningCodeID:  cleaningCodeID,
			CleaningCode:    cleaningCodeStr,
			BasePrice:       basePrice,
			TotalCost:       basePrice,
			Status:          models.CleaningStatusPending,
			Priority:        priority,
			PropertyName:    propName,
			PropertyCode:    propCode,
			Address:         address,
			GuestName:       r.GuestName,
		}

		config.DB.Create(&task)
		created++
		log.Printf("[Cleaning] 청소 업무 생성: %s %s (%s)", date, propCode, r.GuestName)
	}

	return created, nil
}

// calcPriority — 당일 체크인이 있으면 urgent, 내일이면 normal, 없으면 low
func (s *CleaningService) calcPriority(hostexPropertyID int64, checkoutDate string) string {
	var nextCheckIn models.Reservation
	err := config.DB.Where("property_id = ? AND check_in_date >= ? AND status = ?",
		hostexPropertyID, checkoutDate, "accepted").
		Order("check_in_date ASC").
		First(&nextCheckIn).Error

	if err != nil {
		return models.CleaningPriorityLow
	}

	if nextCheckIn.CheckInDate == checkoutDate {
		return models.CleaningPriorityUrgent
	}

	// 내일 체크인
	checkout, _ := time.Parse("2006-01-02", checkoutDate)
	tomorrow := checkout.Add(24 * time.Hour).Format("2006-01-02")
	if nextCheckIn.CheckInDate == tomorrow {
		return models.CleaningPriorityNormal
	}

	return models.CleaningPriorityLow
}

// findNextCheckIn — 해당 숙소의 다음 체크인 날짜 찾기
func (s *CleaningService) findNextCheckIn(hostexPropertyID int64, afterDate string) string {
	var next models.Reservation
	if err := config.DB.Where("property_id = ? AND check_in_date >= ? AND status = ?",
		hostexPropertyID, afterDate, "accepted").
		Order("check_in_date ASC").
		First(&next).Error; err != nil {
		return ""
	}
	return next.CheckInDate
}

// --- 목록 조회 ---

type CleaningListQuery struct {
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
	CleaningDate string `form:"cleaning_date"`
	StartDate    string `form:"start_date"`
	EndDate      string `form:"end_date"`
	Status       string `form:"status"`
	CleanerID    uint   `form:"cleaner_id"`
	Priority     string `form:"priority"`
	PropertyID   uint   `form:"property_id"`
	Unassigned   bool   `form:"unassigned"`
}

func (q *CleaningListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 50
	}
}

type CleaningListResult struct {
	Tasks      []models.CleaningTask `json:"tasks"`
	Total      int64                 `json:"total"`
	Page       int                   `json:"page"`
	PageSize   int                   `json:"page_size"`
	TotalPages int                   `json:"total_pages"`
}

func (s *CleaningService) List(query CleaningListQuery) (CleaningListResult, error) {
	query.Normalize()

	db := config.DB.Model(&models.CleaningTask{})

	if query.CleaningDate != "" {
		db = db.Where("cleaning_date = ?", query.CleaningDate)
	} else {
		if query.StartDate != "" {
			db = db.Where("cleaning_date >= ?", query.StartDate)
		}
		if query.EndDate != "" {
			db = db.Where("cleaning_date <= ?", query.EndDate)
		}
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.CleanerID > 0 {
		db = db.Where("cleaner_id = ?", query.CleanerID)
	}
	if query.Priority != "" {
		db = db.Where("priority = ?", query.Priority)
	}
	if query.PropertyID > 0 {
		db = db.Where("property_id = ?", query.PropertyID)
	}
	if query.Unassigned {
		db = db.Where("cleaner_id IS NULL")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return CleaningListResult{}, err
	}

	var tasks []models.CleaningTask
	offset := (query.Page - 1) * query.PageSize

	// urgent 먼저, 그 다음 normal, low 순
	if err := db.Order("FIELD(priority, 'urgent', 'normal', 'low'), created_at ASC").
		Offset(offset).Limit(query.PageSize).
		Find(&tasks).Error; err != nil {
		return CleaningListResult{}, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return CleaningListResult{
		Tasks:      tasks,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// --- 배정 ---

func (s *CleaningService) Assign(taskID uint, cleanerID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	var cleaner models.Cleaner
	if err := config.DB.First(&cleaner, cleanerID).Error; err != nil {
		return task, fmt.Errorf("청소자를 찾을 수 없습니다")
	}

	task.CleanerID = &cleanerID
	task.CleanerName = cleaner.Name
	task.Status = models.CleaningStatusAssigned
	// 배정 시 메시지 자동 생성
	task.DispatchMessage = s.GenerateDispatchMessage(&task, &cleaner)
	config.DB.Save(&task)

	return task, nil
}

// GenerateDispatchMessage — 배정 메시지 자동 생성
func (s *CleaningService) GenerateDispatchMessage(task *models.CleaningTask, cleaner *models.Cleaner) string {
	// 다음 체크인 정보
	nextCheckIn := "없음"
	if task.NextCheckIn != "" {
		nextCheckIn = task.NextCheckIn
	}

	urgency := ""
	if task.Priority == models.CleaningPriorityUrgent {
		urgency = "⚡ [긴급] 당일 체크인\n"
	}

	msg := fmt.Sprintf(`%s📍 %s
%s (%s)

📅 청소일: %s
⏰ 체크아웃: %s
🔜 다음 체크인: %s

💰 단가: %d원
📝 %s

✅ 완료 후 앱에서 "완료" 처리 부탁드립니다.`,
		urgency,
		task.PropertyName,
		task.Address,
		task.PropertyCode,
		task.CleaningDate,
		task.CheckOutTime,
		nextCheckIn,
		task.BasePrice,
		func() string {
			if task.Memo != "" {
				return "특이사항: " + task.Memo
			}
			return "특이사항 없음"
		}(),
	)

	return msg
}

// DispatchTask — 배정 메시지 발송 상태로 전환
func (s *CleaningService) Dispatch(taskID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}
	if task.Status != models.CleaningStatusAssigned {
		return task, errors.New("배정된 상태에서만 발송 가능합니다")
	}

	now := time.Now()
	task.Status = models.CleaningStatusDispatched
	task.DispatchedAt = &now

	// 메시지가 없으면 생성
	if task.DispatchMessage == "" && task.CleanerID != nil {
		var cleaner models.Cleaner
		config.DB.First(&cleaner, *task.CleanerID)
		task.DispatchMessage = s.GenerateDispatchMessage(&task, &cleaner)
	}

	config.DB.Save(&task)
	return task, nil
}

// BulkDispatch — 배정된 모든 태스크 일괄 발송
func (s *CleaningService) BulkDispatch(date string) (int64, error) {
	now := time.Now()
	result := config.DB.Model(&models.CleaningTask{}).
		Where("cleaning_date = ? AND status = ?", date, models.CleaningStatusAssigned).
		Updates(map[string]interface{}{
			"status":        models.CleaningStatusDispatched,
			"dispatched_at": now,
		})
	return result.RowsAffected, result.Error
}

// --- 주간 정산 ---

type CleanerSettlement struct {
	CleanerID     uint   `json:"cleaner_id"`
	CleanerName   string `json:"cleaner_name"`
	Region        string `json:"region"`
	TaskCount     int    `json:"task_count"`
	BaseTotal     int    `json:"base_total"`
	ExtraTotal    int    `json:"extra_total"`
	TotalCost     int    `json:"total_cost"`
	Tax33         int    `json:"tax_33"`          // 3.3% 원천징수
	NetPayment    int    `json:"net_payment"`     // 실지급액 (total - 3.3%)
	BankName      string `json:"bank_name"`
	BankAccount   string `json:"bank_account"`
	AccountHolder string `json:"account_holder"`
	Phone         string `json:"phone"`
}

type WeeklySettlementResult struct {
	WeekStart       string              `json:"week_start"`
	WeekEnd         string              `json:"week_end"`
	Cleaners        []CleanerSettlement `json:"cleaners"`
	GrandTotal      int                 `json:"grand_total"`
	TotalTax        int                 `json:"total_tax"`
	TotalNetPayment int                 `json:"total_net_payment"`
	TotalTasks      int                 `json:"total_tasks"`
	TotalCleaners   int                 `json:"total_cleaners"`
}

func (s *CleaningService) GetWeeklySettlement(weekStart, weekEnd string) WeeklySettlementResult {
	// 기간 내 완료된 태스크 집계 (청소자별)
	type row struct {
		CleanerID   uint
		CleanerName string
		TaskCount   int
		BaseTotal   int
		ExtraTotal  int
		TotalCost   int
	}
	var rows []row
	config.DB.Model(&models.CleaningTask{}).
		Select("cleaner_id, cleaner_name, COUNT(*) as task_count, SUM(base_price) as base_total, SUM(extra_cost) as extra_total, SUM(total_cost) as total_cost").
		Where("cleaning_date >= ? AND cleaning_date <= ? AND status IN (?, ?) AND cleaner_id IS NOT NULL",
			weekStart, weekEnd, models.CleaningStatusCompleted, models.CleaningStatusInProgress).
		Group("cleaner_id, cleaner_name").
		Order("total_cost DESC").
		Scan(&rows)

	// 청소자 정보 (권역, 계좌)
	cleanerMap := map[uint]models.Cleaner{}
	var cleaners []models.Cleaner
	config.DB.Find(&cleaners)
	for _, c := range cleaners {
		cleanerMap[c.ID] = c
	}

	result := WeeklySettlementResult{
		WeekStart: weekStart,
		WeekEnd:   weekEnd,
	}

	for _, r := range rows {
		tax33 := int(float64(r.TotalCost) * 0.033) // 3.3% 원천징수
		cs := CleanerSettlement{
			CleanerID:   r.CleanerID,
			CleanerName: r.CleanerName,
			TaskCount:   r.TaskCount,
			BaseTotal:   r.BaseTotal,
			ExtraTotal:  r.ExtraTotal,
			TotalCost:   r.TotalCost,
			Tax33:       tax33,
			NetPayment:  r.TotalCost - tax33,
		}
		if c, ok := cleanerMap[r.CleanerID]; ok {
			cs.Region = c.Region
			cs.BankName = c.BankName
			cs.BankAccount = c.BankAccount
			cs.AccountHolder = c.AccountHolder
			cs.Phone = c.Phone
		}
		result.Cleaners = append(result.Cleaners, cs)
		result.GrandTotal += r.TotalCost
		result.TotalTax += tax33
		result.TotalNetPayment += r.TotalCost - tax33
		result.TotalTasks += r.TaskCount
	}
	result.TotalCleaners = len(result.Cleaners)

	return result
}

// --- 상태 변경 ---

func (s *CleaningService) Start(taskID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	now := time.Now()
	task.Status = models.CleaningStatusInProgress
	task.StartedAt = &now
	config.DB.Save(&task)

	return task, nil
}

func (s *CleaningService) Complete(taskID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	now := time.Now()
	task.Status = models.CleaningStatusCompleted
	task.CompletedAt = &now
	config.DB.Save(&task)

	return task, nil
}

func (s *CleaningService) ReportIssue(taskID uint, issueMemo string) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	task.Status = models.CleaningStatusIssue
	task.IssueMemo = strings.TrimSpace(issueMemo)
	config.DB.Save(&task)

	return task, nil
}

// --- 오늘 요약 ---

type CleaningSummary struct {
	Total      int64 `json:"total"`
	Pending    int64 `json:"pending"`
	Assigned   int64 `json:"assigned"`
	InProgress int64 `json:"in_progress"`
	Completed  int64 `json:"completed"`
	Issue      int64 `json:"issue"`
}

func (s *CleaningService) GetSummary(date string) CleaningSummary {
	var summary CleaningSummary

	// 단일 GROUP BY 쿼리로 통합 (6개 COUNT → 1개)
	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	config.DB.Model(&models.CleaningTask{}).
		Where("cleaning_date = ?", date).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&rows)

	for _, r := range rows {
		summary.Total += r.Count
		switch r.Status {
		case "pending":
			summary.Pending = r.Count
		case "assigned":
			summary.Assigned = r.Count
		case "in_progress":
			summary.InProgress = r.Count
		case "completed":
			summary.Completed = r.Count
		case "issue":
			summary.Issue = r.Count
		}
	}

	return summary
}

func (s *CleaningService) GetSummaryRange(startDate, endDate string) CleaningSummary {
	var summary CleaningSummary

	type statusCount struct {
		Status string
		Count  int64
	}
	var rows []statusCount
	config.DB.Model(&models.CleaningTask{}).
		Where("cleaning_date >= ? AND cleaning_date <= ?", startDate, endDate).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&rows)

	for _, r := range rows {
		summary.Total += r.Count
		switch r.Status {
		case "pending":
			summary.Pending = r.Count
		case "assigned":
			summary.Assigned = r.Count
		case "in_progress":
			summary.InProgress = r.Count
		case "completed":
			summary.Completed = r.Count
		case "issue":
			summary.Issue = r.Count
		}
	}

	return summary
}

// --- 동선 분석 ---

type TimeAnalysisTask struct {
	Order              int     `json:"order"`
	TaskID             uint    `json:"task_id"`
	PropertyCode       string  `json:"property_code"`
	PropertyName       string  `json:"property_name"`
	Address            string  `json:"address"`
	Region             string  `json:"region"`
	CleaningDate       string  `json:"cleaning_date"`
	StartedAt          string  `json:"started_at"`
	CompletedAt        string  `json:"completed_at"`
	CleaningMinutes    float64 `json:"cleaning_minutes"`
	TravelMinutesToNext float64 `json:"travel_minutes_to_next"`
	NextRegion         string  `json:"next_region,omitempty"`
	IsCrossRegion      bool    `json:"is_cross_region"`
	Status             string  `json:"status"`
}

type TimeAnalysisSummary struct {
	TotalTasks           int     `json:"total_tasks"`
	CompletedTasks       int     `json:"completed_tasks"`
	TotalWorkMinutes     float64 `json:"total_work_minutes"`
	TotalCleaningMinutes float64 `json:"total_cleaning_minutes"`
	TotalTravelMinutes   float64 `json:"total_travel_minutes"`
	EfficiencyPct        float64 `json:"efficiency_pct"`
	AvgCleaningMinutes   float64 `json:"avg_cleaning_minutes"`
	AvgTravelMinutes     float64 `json:"avg_travel_minutes"`
	CrossRegionMoves     int     `json:"cross_region_moves"`
}

type CleanerTimeAnalysis struct {
	CleanerID   uint                `json:"cleaner_id"`
	CleanerName string              `json:"cleaner_name"`
	Dates       []CleanerDayAnalysis `json:"dates"`
}

type CleanerDayAnalysis struct {
	Date    string              `json:"date"`
	Tasks   []TimeAnalysisTask  `json:"tasks"`
	Summary TimeAnalysisSummary `json:"summary"`
}

type TimeAnalysisResult struct {
	StartDate string                `json:"start_date"`
	EndDate   string                `json:"end_date"`
	Cleaners  []CleanerTimeAnalysis `json:"cleaners"`
}

func extractRegion(code string) string {
	if code == "" {
		return "기타"
	}
	region := ""
	for _, ch := range code {
		if ch >= '0' && ch <= '9' {
			break
		}
		region += string(ch)
	}
	if region == "" {
		return "기타"
	}
	return region
}

func (s *CleaningService) TimeAnalysis(startDate, endDate string, cleanerID uint) TimeAnalysisResult {
	result := TimeAnalysisResult{StartDate: startDate, EndDate: endDate}

	db := config.DB.Where("cleaning_date >= ? AND cleaning_date <= ?", startDate, endDate).
		Where("cleaner_id IS NOT NULL")
	if cleanerID > 0 {
		db = db.Where("cleaner_id = ?", cleanerID)
	}

	var tasks []models.CleaningTask
	db.Order("cleaner_id ASC, cleaning_date ASC, started_at ASC, id ASC").Find(&tasks)

	if len(tasks) == 0 {
		return result
	}

	// 청소자 + 날짜별 그룹핑
	type key struct {
		CleanerID uint
		Date      string
	}
	grouped := map[key][]models.CleaningTask{}
	cleanerNames := map[uint]string{}
	var keys []key

	for _, t := range tasks {
		cid := uint(0)
		if t.CleanerID != nil {
			cid = *t.CleanerID
		}
		k := key{CleanerID: cid, Date: t.CleaningDate}
		if _, ok := grouped[k]; !ok {
			keys = append(keys, k)
		}
		grouped[k] = append(grouped[k], t)
		if t.CleanerName != "" {
			cleanerNames[cid] = t.CleanerName
		}
	}

	// 청소자별로 집계
	cleanerMap := map[uint]*CleanerTimeAnalysis{}
	var cleanerOrder []uint

	for _, k := range keys {
		dayTasks := grouped[k]
		cta, ok := cleanerMap[k.CleanerID]
		if !ok {
			cta = &CleanerTimeAnalysis{
				CleanerID:   k.CleanerID,
				CleanerName: cleanerNames[k.CleanerID],
			}
			cleanerMap[k.CleanerID] = cta
			cleanerOrder = append(cleanerOrder, k.CleanerID)
		}

		day := CleanerDayAnalysis{Date: k.Date}
		var completedCount int
		var totalCleaning, totalTravel float64
		var firstStart, lastComplete *time.Time
		var crossMoves int

		for i, t := range dayTasks {
			region := extractRegion(t.PropertyCode)
			at := TimeAnalysisTask{
				Order:        i + 1,
				TaskID:       t.ID,
				PropertyCode: t.PropertyCode,
				PropertyName: t.PropertyName,
				Address:      t.Address,
				Region:       region,
				CleaningDate: t.CleaningDate,
				Status:       t.Status,
			}

			if t.StartedAt != nil {
				at.StartedAt = t.StartedAt.Format("15:04")
				if firstStart == nil {
					firstStart = t.StartedAt
				}
			}
			if t.CompletedAt != nil {
				at.CompletedAt = t.CompletedAt.Format("15:04")
				lastComplete = t.CompletedAt
				completedCount++
			}

			// 청소시간
			if t.StartedAt != nil && t.CompletedAt != nil {
				mins := t.CompletedAt.Sub(*t.StartedAt).Minutes()
				if mins > 0 && mins < 300 { // 5시간 이상은 이상치
					at.CleaningMinutes = mins
					totalCleaning += mins
				}
			}

			// 다음 태스크와의 이동시간
			if i < len(dayTasks)-1 {
				next := dayTasks[i+1]
				nextRegion := extractRegion(next.PropertyCode)
				at.NextRegion = nextRegion
				at.IsCrossRegion = region != nextRegion
				if at.IsCrossRegion {
					crossMoves++
				}

				if t.CompletedAt != nil && next.StartedAt != nil {
					travel := next.StartedAt.Sub(*t.CompletedAt).Minutes()
					if travel >= 0 && travel < 120 { // 2시간 이상은 이상치 (휴식 등)
						at.TravelMinutesToNext = travel
						totalTravel += travel
					}
				}
			}

			day.Tasks = append(day.Tasks, at)
		}

		// 일일 요약
		day.Summary.TotalTasks = len(dayTasks)
		day.Summary.CompletedTasks = completedCount
		day.Summary.TotalCleaningMinutes = totalCleaning
		day.Summary.TotalTravelMinutes = totalTravel
		day.Summary.CrossRegionMoves = crossMoves

		if firstStart != nil && lastComplete != nil {
			day.Summary.TotalWorkMinutes = lastComplete.Sub(*firstStart).Minutes()
		}
		if day.Summary.TotalWorkMinutes > 0 {
			day.Summary.EfficiencyPct = (totalCleaning / day.Summary.TotalWorkMinutes) * 100
		}
		if completedCount > 0 {
			day.Summary.AvgCleaningMinutes = totalCleaning / float64(completedCount)
		}
		travelCount := len(dayTasks) - 1
		if travelCount > 0 && totalTravel > 0 {
			day.Summary.AvgTravelMinutes = totalTravel / float64(travelCount)
		}

		cta.Dates = append(cta.Dates, day)
	}

	for _, cid := range cleanerOrder {
		result.Cleaners = append(result.Cleaners, *cleanerMap[cid])
	}

	return result
}

// --- 청소코드 ---

func (s *CleaningService) ListCleaningCodes() []models.CleaningCode {
	var codes []models.CleaningCode
	config.DB.Order("region_code ASC, code ASC").Find(&codes)
	return codes
}

// --- 청소자별 워크로드 ---

type CleanerWorkloadItem struct {
	CleanerID   uint   `json:"cleaner_id"`
	CleanerName string `json:"cleaner_name"`
	Assigned    int    `json:"assigned"`
	Completed   int    `json:"completed"`
	InProgress  int    `json:"in_progress"`
	MaxDaily    int    `json:"max_daily"`
}

func (s *CleaningService) GetCleanerWorkload(date string) []CleanerWorkloadItem {
	var cleaners []models.Cleaner
	config.DB.Where("active = ?", true).Order("name ASC").Find(&cleaners)

	result := make([]CleanerWorkloadItem, 0, len(cleaners))
	for _, c := range cleaners {
		var assigned, completed, inProgress int64
		config.DB.Model(&models.CleaningTask{}).
			Where("cleaning_date = ? AND cleaner_id = ?", date, c.ID).
			Count(&assigned)
		config.DB.Model(&models.CleaningTask{}).
			Where("cleaning_date = ? AND cleaner_id = ? AND status = ?", date, c.ID, "completed").
			Count(&completed)
		config.DB.Model(&models.CleaningTask{}).
			Where("cleaning_date = ? AND cleaner_id = ? AND status = ?", date, c.ID, "in_progress").
			Count(&inProgress)

		result = append(result, CleanerWorkloadItem{
			CleanerID:   c.ID,
			CleanerName: c.Name,
			Assigned:    int(assigned),
			Completed:   int(completed),
			InProgress:  int(inProgress),
			MaxDaily:    c.MaxDaily,
		})
	}
	return result
}

// --- 청소자 CRUD ---

func (s *CleaningService) ListCleaners() []models.Cleaner {
	var cleaners []models.Cleaner
	config.DB.Where("active = ?", true).Order("name ASC").Find(&cleaners)
	return cleaners
}

func (s *CleaningService) CreateCleaner(cleaner models.Cleaner) (models.Cleaner, error) {
	cleaner.Active = true
	if err := config.DB.Create(&cleaner).Error; err != nil {
		return cleaner, err
	}
	return cleaner, nil
}

func (s *CleaningService) UpdateCleaner(id uint, name, phone, region, memo string) (models.Cleaner, error) {
	var cleaner models.Cleaner
	if err := config.DB.First(&cleaner, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return cleaner, ErrNotFound
		}
		return cleaner, err
	}

	cleaner.Name = name
	cleaner.Phone = phone
	cleaner.Region = region
	cleaner.Memo = memo
	config.DB.Save(&cleaner)

	return cleaner, nil
}

func (s *CleaningService) DeleteCleaner(id uint) error {
	return config.DB.Delete(&models.Cleaner{}, id).Error
}

// extractNamePrefix — 게스트 이름에서 비교용 접두사 추출
// "장임선_39.6(6.6)" → "장임선", "김관준" → "김관준", "현덕 오" → "현덕 오"
func extractNamePrefix(name string) string {
	if name == "" {
		return ""
	}
	// _ 기준 분리 (한글이름_숫자패턴)
	for i, ch := range name {
		if ch == '_' {
			return name[:i]
		}
	}
	return name
}

// DetectExtensions — 특정 날짜의 연장 건 감지
func (s *CleaningService) DetectExtensions(date string) []map[string]interface{} {
	var checkouts []models.Reservation
	config.DB.Where("check_out_date = ? AND status = ?", date, "accepted").Find(&checkouts)

	var checkins []models.Reservation
	config.DB.Where("check_in_date = ? AND status = ?", date, "accepted").Find(&checkins)

	// property_id → checkin 매핑
	ciMap := map[int64]models.Reservation{}
	for _, ci := range checkins {
		ciMap[ci.PropertyID] = ci
	}

	var extensions []map[string]interface{}
	for _, co := range checkouts {
		if ci, ok := ciMap[co.PropertyID]; ok {
			coPrefix := extractNamePrefix(co.GuestName)
			ciPrefix := extractNamePrefix(ci.GuestName)
			if coPrefix != "" && coPrefix == ciPrefix {
				extensions = append(extensions, map[string]interface{}{
					"property_id":      co.InternalPropID,
					"guest_name":       coPrefix,
					"checkout_res":     co.ReservationCode,
					"checkin_res":      ci.ReservationCode,
					"checkout_date":    co.CheckOutDate,
					"new_checkout":     ci.CheckOutDate,
					"nights_extended":  ci.Nights,
				})
			}
		}
	}
	return extensions
}
