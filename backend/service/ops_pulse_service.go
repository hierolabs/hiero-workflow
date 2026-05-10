package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type OpsPulseService struct{}

func NewOpsPulseService() *OpsPulseService { return &OpsPulseService{} }

type PulseItem struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Frequency string `json:"frequency"`
	Total     int    `json:"total"`
	Done      int    `json:"done"`
	Pct       int    `json:"pct"`
	Color     string `json:"color"`
	Link      string `json:"link"`
}

type PulseResult struct {
	Daily   []PulseItem `json:"daily"`
	Weekly  []PulseItem `json:"weekly"`
	Monthly []PulseItem `json:"monthly"`
	Overall int         `json:"overall_pct"`
}

func pct(done, total int) int {
	if total == 0 {
		return 100
	}
	p := done * 100 / total
	if p > 100 {
		return 100
	}
	return p
}

func (s *OpsPulseService) GetPulse() PulseResult {
	now := time.Now()
	today := now.Format("2006-01-02")

	// ========== DAILY: 매일 실제로 하는 일 ==========
	daily := make([]PulseItem, 0, 5)

	// 1. 삼투/리브/Agoda 체크인 안내 발송 (수동 안내 필요 채널만)
	var manualTotal, manualDone int64
	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND (channel_name LIKE '%삼삼엠투%' OR channel_name LIKE '%리브%' OR channel_name LIKE '%Agoda%' OR channel_name LIKE '%개인%')", today).
		Count(&manualTotal)
	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND (channel_name LIKE '%삼삼엠투%' OR channel_name LIKE '%리브%' OR channel_name LIKE '%Agoda%' OR channel_name LIKE '%개인%') AND conversation_id != ''", today).
		Count(&manualDone)
	daily = append(daily, PulseItem{
		Key: "manual_checkin", Label: "체크인 안내 발송", Frequency: "daily",
		Total: int(manualTotal), Done: int(manualDone), Pct: pct(int(manualDone), int(manualTotal)),
		Color: "blue", Link: "/messages",
	})

	// 2. 청소 배정→완료 (우현이 매일)
	var clTotal, clCompleted int64
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ?", today).Count(&clTotal)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", today, "completed").Count(&clCompleted)
	daily = append(daily, PulseItem{
		Key: "cleaning", Label: "청소 완료", Frequency: "daily",
		Total: int(clTotal), Done: int(clCompleted), Pct: pct(int(clCompleted), int(clTotal)),
		Color: "cyan", Link: "/cleaning",
	})

	// 3. 이슈 처리 (재관/진태 매일)
	var issTotal, issDone int64
	config.DB.Model(&models.Issue{}).Where("status IN (?, ?)", "open", "in_progress").Count(&issTotal)
	config.DB.Model(&models.Issue{}).Where("DATE(updated_at) = ? AND status IN (?, ?)", today, "resolved", "closed").Count(&issDone)
	daily = append(daily, PulseItem{
		Key: "issues", Label: "이슈 처리", Frequency: "daily",
		Total: int(issTotal), Done: int(issDone), Pct: pct(int(issDone), int(issTotal)),
		Color: "red", Link: "/issues?status=open",
	})

	// 4. 메시지 감지 → 판단 (감지된 것 중 처리 완료)
	var detTotal, detDone int64
	config.DB.Model(&models.IssueDetection{}).Where("status = ?", "pending").Count(&detTotal)
	config.DB.Model(&models.IssueDetection{}).Where("DATE(updated_at) = ? AND status IN (?, ?)", today, "issue_created", "dismissed").Count(&detDone)
	daily = append(daily, PulseItem{
		Key: "detections", Label: "감지 처리", Frequency: "daily",
		Total: int(detTotal), Done: int(detDone), Pct: pct(int(detDone), int(detTotal)),
		Color: "amber", Link: "/issue-detections",
	})

	// 5. 얼리/레이트 체크인 요청 (오늘 감지된 checkin + 연장/레이트)
	var earlyTotal, earlyDone int64
	config.DB.Model(&models.IssueDetection{}).
		Where("DATE(created_at) = ? AND (detected_category = 'checkin' OR detected_keywords LIKE '%연장%' OR detected_keywords LIKE '%레이트%')", today).
		Count(&earlyTotal)
	config.DB.Model(&models.IssueDetection{}).
		Where("DATE(created_at) = ? AND (detected_category = 'checkin' OR detected_keywords LIKE '%연장%' OR detected_keywords LIKE '%레이트%') AND status IN ('resolved', 'issue_created', 'dismissed')", today).
		Count(&earlyDone)
	daily = append(daily, PulseItem{
		Key: "early_late", Label: "얼리/레이트 요청", Frequency: "daily",
		Total: int(earlyTotal), Done: int(earlyDone), Pct: pct(int(earlyDone), int(earlyTotal)),
		Color: "purple", Link: "/messages",
	})

	// ========== WEEKLY: 주 1회 업무 ==========
	weekly := make([]PulseItem, 0, 2)
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekStartStr := weekStart.Format("2006-01-02")

	// 5. 청소 주간 정산 (수빈, 주 1회)
	var wClTotal, wClCompleted int64
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date >= ?", weekStartStr).Count(&wClTotal)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date >= ? AND status = ?", weekStartStr, "completed").Count(&wClCompleted)
	weekly = append(weekly, PulseItem{
		Key: "weekly_settlement", Label: "청소 주간 정산", Frequency: "weekly",
		Total: int(wClTotal), Done: int(wClCompleted), Pct: pct(int(wClCompleted), int(wClTotal)),
		Color: "green", Link: "/cleaning",
	})

	// 6. 주간 에스컬레이션 정리 (ETF/Founder 미해결 건)
	var escTotal, escDone int64
	config.DB.Model(&models.Issue{}).Where("escalation_level IN (?, ?) AND status IN (?, ?)", "etf", "founder", "open", "in_progress").Count(&escTotal)
	config.DB.Model(&models.Issue{}).Where("escalation_level IN (?, ?) AND DATE(updated_at) >= ? AND status IN (?, ?)", "etf", "founder", weekStartStr, "resolved", "closed").Count(&escDone)
	weekly = append(weekly, PulseItem{
		Key: "weekly_escalation", Label: "에스컬레이션 정리", Frequency: "weekly",
		Total: int(escTotal), Done: int(escDone), Pct: pct(int(escDone), int(escTotal)),
		Color: "orange", Link: "/issues?status=open",
	})

	// ========== MONTHLY: 월 1회 업무 ==========
	monthly := make([]PulseItem, 0, 4)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	// 7. CSV 정산 (수빈, 월 1회)
	var mResTotal, mTxDone int64
	config.DB.Model(&models.Reservation{}).Where("check_in_date >= ? AND check_in_date < ?", monthStart, today).Count(&mResTotal)
	config.DB.Model(&models.HostexTransaction{}).Where("payout_date >= ?", monthStart).Count(&mTxDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_settlement", Label: "월간 정산", Frequency: "monthly",
		Total: int(mResTotal), Done: int(mTxDone), Pct: pct(int(mTxDone), int(mResTotal)),
		Color: "green", Link: "/settlement",
	})

	// 8. 사업 진단 갱신 (월 1회)
	var propTotal, diagDone int64
	config.DB.Model(&models.Property{}).Count(&propTotal)
	config.DB.Model(&models.PropertyBusinessDiagnosis{}).Where("DATE(updated_at) >= ?", monthStart).Count(&diagDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_diagnosis", Label: "사업 진단", Frequency: "monthly",
		Total: int(propTotal), Done: int(diagDone), Pct: pct(int(diagDone), int(propTotal)),
		Color: "orange", Link: "/diagnosis",
	})

	// 9. 온보딩 진행 (신규 숙소 있을 때)
	var obTotal, obDone int64
	config.DB.Model(&models.OnboardingCheck{}).
		Joins("JOIN properties ON properties.id = onboarding_checks.property_id AND properties.lifecycle_status IN (?, ?, ?, ?, ?)",
			"setting", "filming", "ota_registering", "operation_ready", "partially_active").
		Count(&obTotal)
	config.DB.Model(&models.OnboardingCheck{}).
		Joins("JOIN properties ON properties.id = onboarding_checks.property_id AND properties.lifecycle_status IN (?, ?, ?, ?, ?)",
			"setting", "filming", "ota_registering", "operation_ready", "partially_active").
		Where("onboarding_checks.is_checked = ?", true).
		Count(&obDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_onboarding", Label: "온보딩 진행", Frequency: "monthly",
		Total: int(obTotal), Done: int(obDone), Pct: pct(int(obDone), int(obTotal)),
		Color: "purple", Link: "/properties",
	})

	// 10. 리드 → 계약 (지훈 영업)
	var leadTotal, leadDone int64
	config.DB.Model(&models.OutsourcingLead{}).Where("status NOT IN (?, ?)", "contracted", "rejected").Count(&leadTotal)
	config.DB.Model(&models.OutsourcingLead{}).Where("DATE(updated_at) >= ? AND status = ?", monthStart, "contracted").Count(&leadDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_leads", Label: "리드 → 계약", Frequency: "monthly",
		Total: int(leadTotal), Done: int(leadDone), Pct: pct(int(leadDone), int(leadTotal)),
		Color: "teal", Link: "/leads",
	})

	// Overall (일간 가중치 3, 주간 2, 월간 1)
	totalWeight := 0
	weightedSum := 0
	for _, item := range daily {
		weightedSum += item.Pct * 3
		totalWeight += 3
	}
	for _, item := range weekly {
		weightedSum += item.Pct * 2
		totalWeight += 2
	}
	for _, item := range monthly {
		weightedSum += item.Pct * 1
		totalWeight += 1
	}
	overall := 0
	if totalWeight > 0 {
		overall = weightedSum / totalWeight
	}

	return PulseResult{
		Daily:   daily,
		Weekly:  weekly,
		Monthly: monthly,
		Overall: overall,
	}
}
