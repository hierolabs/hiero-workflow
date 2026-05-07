package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type OpsPulseService struct{}

func NewOpsPulseService() *OpsPulseService { return &OpsPulseService{} }

// PulseItem — 하나의 업무 도메인 할당량
type PulseItem struct {
	Key       string `json:"key"`       // 식별 키
	Label     string `json:"label"`     // 표시명
	Frequency string `json:"frequency"` // daily, weekly, monthly
	Total     int    `json:"total"`     // 할당량 (해야 할 것)
	Done      int    `json:"done"`      // 완료
	Pct       int    `json:"pct"`       // 진행률 0~100
	Color     string `json:"color"`     // 프론트 표시용
	Link      string `json:"link"`      // 드릴다운 경로
}

type PulseResult struct {
	Daily   []PulseItem `json:"daily"`
	Weekly  []PulseItem `json:"weekly"`
	Monthly []PulseItem `json:"monthly"`
	Overall int         `json:"overall_pct"` // 전체 진행률
}

func pct(done, total int) int {
	if total == 0 {
		return 100 // 할 일 없으면 100%
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

	// === DAILY ===
	daily := make([]PulseItem, 0, 8)

	// 1. 체크인 처리
	var ciTotal, ciDone int64
	config.DB.Model(&models.Reservation{}).Where("check_in_date = ?", today).Count(&ciTotal)
	config.DB.Model(&models.Reservation{}).Where("check_in_date = ? AND status IN (?, ?)", today, "checked_in", "checked_out").Count(&ciDone)
	daily = append(daily, PulseItem{
		Key: "checkin", Label: "체크인 처리", Frequency: "daily",
		Total: int(ciTotal), Done: int(ciDone), Pct: pct(int(ciDone), int(ciTotal)),
		Color: "blue", Link: "/reservations?date=" + today,
	})

	// 2. 체크아웃 처리
	var coTotal, coDone int64
	config.DB.Model(&models.Reservation{}).Where("check_out_date = ?", today).Count(&coTotal)
	config.DB.Model(&models.Reservation{}).Where("check_out_date = ? AND status IN (?, ?)", today, "checked_out", "completed").Count(&coDone)
	daily = append(daily, PulseItem{
		Key: "checkout", Label: "체크아웃 처리", Frequency: "daily",
		Total: int(coTotal), Done: int(coDone), Pct: pct(int(coDone), int(coTotal)),
		Color: "gray", Link: "/reservations?date=" + today,
	})

	// 3. 청소 완료
	var clTotal, clDone int64
	config.DB.Model(&models.CleaningTask{}).Where("DATE(scheduled_date) = ?", today).Count(&clTotal)
	config.DB.Model(&models.CleaningTask{}).Where("DATE(scheduled_date) = ? AND status = ?", today, "completed").Count(&clDone)
	daily = append(daily, PulseItem{
		Key: "cleaning", Label: "청소 완료", Frequency: "daily",
		Total: int(clTotal), Done: int(clDone), Pct: pct(int(clDone), int(clTotal)),
		Color: "cyan", Link: "/cleaning",
	})

	// 4. 이슈 해결 (오늘 생성 + 미처리 기존)
	var issTotal, issDone int64
	config.DB.Model(&models.Issue{}).Where("status IN (?, ?)", "open", "in_progress").Count(&issTotal)
	config.DB.Model(&models.Issue{}).Where("DATE(updated_at) = ? AND status IN (?, ?)", today, "resolved", "closed").Count(&issDone)
	daily = append(daily, PulseItem{
		Key: "issues", Label: "이슈 해결", Frequency: "daily",
		Total: int(issTotal), Done: int(issDone), Pct: pct(int(issDone), int(issTotal)),
		Color: "red", Link: "/issues?status=open",
	})

	// 5. 이슈 감지 처리
	var detTotal, detDone int64
	config.DB.Model(&models.IssueDetection{}).Where("status = ?", "pending").Count(&detTotal)
	config.DB.Model(&models.IssueDetection{}).Where("DATE(updated_at) = ? AND status != ?", today, "pending").Count(&detDone)
	daily = append(daily, PulseItem{
		Key: "detections", Label: "감지 처리", Frequency: "daily",
		Total: int(detTotal), Done: int(detDone), Pct: pct(int(detDone), int(detTotal)),
		Color: "amber", Link: "/issue-detections",
	})

	// 6. 메시지 응답 (오늘 수신 대화)
	var msgTotal, msgDone int64
	config.DB.Model(&models.Conversation{}).Where("DATE(last_message_at) = ?", today).Count(&msgTotal)
	config.DB.Model(&models.Conversation{}).Where("DATE(last_message_at) = ? AND status = ?", today, "replied").Count(&msgDone)
	daily = append(daily, PulseItem{
		Key: "messages", Label: "메시지 응답", Frequency: "daily",
		Total: int(msgTotal), Done: int(msgDone), Pct: pct(int(msgDone), int(msgTotal)),
		Color: "purple", Link: "/messages",
	})

	// === WEEKLY ===
	weekly := make([]PulseItem, 0, 4)
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekStartStr := weekStart.Format("2006-01-02")

	// 7. 주간 청소 정산 (이번주 완료 청소 중 정산 확인된 것)
	var wClTotal, wClDone int64
	config.DB.Model(&models.CleaningTask{}).Where("DATE(scheduled_date) >= ? AND status = ?", weekStartStr, "completed").Count(&wClTotal)
	// settled 컬럼이 없으면 완료 자체가 진행률
	config.DB.Model(&models.CleaningTask{}).Where("DATE(scheduled_date) >= ? AND status = ?", weekStartStr, "completed").Count(&wClDone)
	weekly = append(weekly, PulseItem{
		Key: "weekly_cleaning", Label: "주간 청소 완료", Frequency: "weekly",
		Total: int(wClTotal), Done: int(wClDone), Pct: pct(int(wClDone), int(wClTotal)),
		Color: "cyan", Link: "/cleaning",
	})

	// 8. 주간 이슈 처리율
	var wIssTotal, wIssDone int64
	config.DB.Model(&models.Issue{}).Where("DATE(created_at) >= ?", weekStartStr).Count(&wIssTotal)
	config.DB.Model(&models.Issue{}).Where("DATE(created_at) >= ? AND status IN (?, ?)", weekStartStr, "resolved", "closed").Count(&wIssDone)
	weekly = append(weekly, PulseItem{
		Key: "weekly_issues", Label: "주간 이슈 처리", Frequency: "weekly",
		Total: int(wIssTotal), Done: int(wIssDone), Pct: pct(int(wIssDone), int(wIssTotal)),
		Color: "red", Link: "/issues",
	})

	// 9. 주간 근태 (이번주 출근 기록)
	var wAttTotal, wAttDone int64
	// 팀원 수 × 근무일 수
	var teamCount int64
	config.DB.Model(&models.AdminUser{}).Where("is_active = ?", true).Count(&teamCount)
	daysPassed := int(now.Weekday())
	if daysPassed == 0 {
		daysPassed = 7
	}
	wAttTotal = teamCount * int64(daysPassed)
	config.DB.Model(&models.UserSession{}).Where("DATE(login_at) >= ?", weekStartStr).Count(&wAttDone)
	weekly = append(weekly, PulseItem{
		Key: "weekly_attendance", Label: "주간 출근율", Frequency: "weekly",
		Total: int(wAttTotal), Done: int(wAttDone), Pct: pct(int(wAttDone), int(wAttTotal)),
		Color: "indigo", Link: "/team",
	})

	// === MONTHLY ===
	monthly := make([]PulseItem, 0, 4)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	// 10. 월간 매출 동기화 (이번달 예약 중 거래 매칭)
	var mResTotal int64
	config.DB.Model(&models.Reservation{}).Where("DATE(check_in_date) >= ?", monthStart).Count(&mResTotal)
	var mTxDone int64
	config.DB.Model(&models.HostexTransaction{}).Where("DATE(payout_date) >= ?", monthStart).Count(&mTxDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_revenue", Label: "월간 매출 추적", Frequency: "monthly",
		Total: int(mResTotal), Done: int(mTxDone), Pct: pct(int(mTxDone), int(mResTotal)),
		Color: "green", Link: "/revenue",
	})

	// 11. 월간 이슈 처리율
	var mIssTotal, mIssDone int64
	config.DB.Model(&models.Issue{}).Where("DATE(created_at) >= ?", monthStart).Count(&mIssTotal)
	config.DB.Model(&models.Issue{}).Where("DATE(created_at) >= ? AND status IN (?, ?)", monthStart, "resolved", "closed").Count(&mIssDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_issues", Label: "월간 이슈 해결", Frequency: "monthly",
		Total: int(mIssTotal), Done: int(mIssDone), Pct: pct(int(mIssDone), int(mIssTotal)),
		Color: "red", Link: "/issues",
	})

	// 12. 사업 진단 최신성 (이번달 진단 업데이트 숙소 비율)
	var propTotal int64
	config.DB.Model(&models.Property{}).Where("is_active = ?", true).Count(&propTotal)
	var diagDone int64
	config.DB.Model(&models.PropertyBusinessDiagnosis{}).Where("DATE(updated_at) >= ?", monthStart).Count(&diagDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_diagnosis", Label: "사업 진단 갱신", Frequency: "monthly",
		Total: int(propTotal), Done: int(diagDone), Pct: pct(int(diagDone), int(propTotal)),
		Color: "orange", Link: "/diagnosis",
	})

	// 13. 리드 진행 (이번달 리드 상태 변화)
	var leadTotal, leadDone int64
	config.DB.Model(&models.OutsourcingLead{}).Where("status NOT IN (?, ?)", "contracted", "rejected").Count(&leadTotal)
	config.DB.Model(&models.OutsourcingLead{}).Where("DATE(updated_at) >= ? AND status = ?", monthStart, "contracted").Count(&leadDone)
	monthly = append(monthly, PulseItem{
		Key: "monthly_leads", Label: "신규 위탁 계약", Frequency: "monthly",
		Total: int(leadTotal), Done: int(leadDone), Pct: pct(int(leadDone), int(leadTotal)),
		Color: "teal", Link: "/leads",
	})

	// Overall
	allItems := append(append(daily, weekly...), monthly...)
	totalPct := 0
	for _, item := range allItems {
		totalPct += item.Pct
	}
	overall := 0
	if len(allItems) > 0 {
		overall = totalPct / len(allItems)
	}

	return PulseResult{
		Daily:   daily,
		Weekly:  weekly,
		Monthly: monthly,
		Overall: overall,
	}
}
