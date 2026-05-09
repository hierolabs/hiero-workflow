package service

import (
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type ETFBoardService struct{}

func NewETFBoardService() *ETFBoardService {
	return &ETFBoardService{}
}

// --- CEO Board ---

type CEOBoardData struct {
	Bottlenecks      []models.Issue `json:"bottlenecks"`
	DelayedTasks     []models.Issue `json:"delayed_tasks"`
	ApprovalPending  []models.Issue `json:"approval_pending"`
	TeamCompletion   []TeamStat     `json:"team_completion"`
	TotalOpen        int64          `json:"total_open"`
	TotalDelayed     int64          `json:"total_delayed"`
	TotalApproval    int64          `json:"total_approval"`
}

type TeamStat struct {
	Name           string `json:"name"`
	RoleTitle      string `json:"role_title"`
	OpenIssues     int64  `json:"open_issues"`
	ResolvedToday  int64  `json:"resolved_today"`
	CompletionRate int    `json:"completion_rate"`
	IsOnline       bool   `json:"is_online"`
	LoginAt        string `json:"login_at"`
}

func (s *ETFBoardService) GetCEOBoard() CEOBoardData {
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().Add(-24 * time.Hour)

	// 병목: P0/P1 미해결
	var bottlenecks []models.Issue
	config.DB.Where("priority IN (?, ?) AND status IN (?, ?)", "P0", "P1", "open", "in_progress").
		Order("FIELD(priority, 'P0', 'P1'), created_at ASC").
		Limit(20).Find(&bottlenecks)

	// 지연: 24시간 이상 open
	var delayed []models.Issue
	config.DB.Where("status = ? AND created_at < ?", "open", yesterday).
		Order("created_at ASC").Limit(20).Find(&delayed)

	// 승인 대기: decision 타입
	var approvalPending []models.Issue
	config.DB.Where("issue_type = ? AND status = ?", "decision", "open").
		Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at ASC").
		Limit(10).Find(&approvalPending)

	// 팀원별 완료율
	var users []models.AdminUser
	config.DB.Where("role_layer IN (?, ?)", "etf", "execution").Find(&users)

	// 근태 정보 조회 (LocalDB)
	attSvc := NewAttendanceService()
	activeUsers := attSvc.GetTodayActive()
	onlineMap := map[uint]string{}
	for _, au := range activeUsers {
		if au.IsOnline {
			onlineMap[au.UserID] = au.LoginAt
		}
	}

	teamStats := make([]TeamStat, 0, len(users))
	for _, u := range users {
		var openCount, resolvedToday int64
		config.DB.Model(&models.Issue{}).
			Where("assignee_name = ? AND status IN (?, ?)", u.Name, "open", "in_progress").
			Count(&openCount)
		config.DB.Model(&models.Issue{}).
			Where("assignee_name = ? AND status IN (?, ?) AND resolved_at >= ?", u.Name, "resolved", "closed", today).
			Count(&resolvedToday)

		rate := 0
		total := openCount + resolvedToday
		if total > 0 {
			rate = int(resolvedToday * 100 / total)
		}

		loginAt, isOnline := onlineMap[u.ID]

		teamStats = append(teamStats, TeamStat{
			Name:           u.Name,
			RoleTitle:      u.RoleTitle,
			OpenIssues:     openCount,
			ResolvedToday:  resolvedToday,
			CompletionRate: rate,
			IsOnline:       isOnline,
			LoginAt:        loginAt,
		})
	}

	return CEOBoardData{
		Bottlenecks:     bottlenecks,
		DelayedTasks:    delayed,
		ApprovalPending: approvalPending,
		TeamCompletion:  teamStats,
		TotalOpen:       int64(len(bottlenecks)),
		TotalDelayed:    int64(len(delayed)),
		TotalApproval:   int64(len(approvalPending)),
	}
}

// --- CTO Board ---

type CTOBoardData struct {
	MyTasks              []models.Issue          `json:"my_tasks"`
	TotalTasks           int64                   `json:"total_tasks"`
	Domains              map[string]int          `json:"domains"`
	ReceivedDirectives   []models.ETFDirective   `json:"received_directives"`
	SentDirectives       []models.ETFDirective   `json:"sent_directives"`
}

func (s *ETFBoardService) GetCTOBoard() CTOBoardData {
	// role_title 기반으로 CTO 사용자 조회
	var ctoUser models.AdminUser
	config.DB.Where("role_title = ?", "cto").First(&ctoUser)

	var tasks []models.Issue
	if ctoUser.ID > 0 {
		config.DB.Where("assignee_name = ? AND status IN (?, ?)", ctoUser.Name, "open", "in_progress").
			Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
			Find(&tasks)
	}

	domains := map[string]int{
		"knowledge":      0,
		"research":       0,
		"documentation":  0,
		"message":        0,
		"business_plan":  0,
		"technology":     0,
	}
	// 현재 이슈 타입에서 도메인 매핑
	for range tasks {
		domains["documentation"]++
	}

	// 받은 지시
	var received []models.ETFDirective
	config.DB.Where("to_role = ? AND status != ?", "cto", models.DirectiveStatusCompleted).
		Order("FIELD(priority, 'urgent', 'high', 'normal', 'low'), created_at DESC").
		Limit(30).Find(&received)

	// 보낸 지시
	var sent []models.ETFDirective
	if ctoUser.ID > 0 {
		config.DB.Where("from_user_id = ?", ctoUser.ID).
			Order("created_at DESC").Limit(30).Find(&sent)
	}

	return CTOBoardData{
		MyTasks:            tasks,
		TotalTasks:         int64(len(tasks)),
		Domains:            domains,
		ReceivedDirectives: received,
		SentDirectives:     sent,
	}
}

// --- CFO Board ---

// 재무 흐름 요약 (Data 1·2·3 통합)
type FinancialFlow struct {
	// Data 1: 매출 (reservation 기준)
	Data1 DataFlowSummary `json:"data1"`
	// Data 2: 비용 (CSV + cost_allocations)
	Data2 DataFlowSummary `json:"data2"`
	// Data 3: 입금 (deposit_date 기준 예상)
	Data3 DataFlowSummary `json:"data3"`
	// 최근 월별 P&L 트렌드
	MonthlyTrend []MonthlyPL `json:"monthly_trend"`
}

type DataFlowSummary struct {
	Label       string `json:"label"`
	Description string `json:"description"`
	Source      string `json:"source"`
	ThisMonth   int64  `json:"this_month"`
	LastMonth   int64  `json:"last_month"`
	Change      int64  `json:"change"`      // 증감
	ChangeRate  float64 `json:"change_rate"` // 증감률 %
}

type MonthlyPL struct {
	Month     string `json:"month"`
	Revenue   int64  `json:"revenue"`
	Cost      int64  `json:"cost"`
	Net       int64  `json:"net"`
	Margin    float64 `json:"margin"`
}

type CFOBoardData struct {
	MyTasks              []models.Issue          `json:"my_tasks"`
	UnsettledCount       int64                   `json:"unsettled_count"`
	TaxReviewCount       int64                   `json:"tax_review_count"`
	AccountingReview     int64                   `json:"accounting_review"`
	SettlementDelayed    int64                   `json:"settlement_delayed"`
	TotalTasks           int64                   `json:"total_tasks"`
	ReceivedDirectives   []models.ETFDirective   `json:"received_directives"`
	SentDirectives       []models.ETFDirective   `json:"sent_directives"`
	Financial            FinancialFlow           `json:"financial"`
}

func (s *ETFBoardService) GetCFOBoard() CFOBoardData {
	// role_title 기반으로 CFO 사용자 조회
	var cfoUser models.AdminUser
	config.DB.Where("role_title = ?", "cfo").First(&cfoUser)

	var tasks []models.Issue
	if cfoUser.ID > 0 {
		config.DB.Where("assignee_name = ? AND status IN (?, ?)", cfoUser.Name, "open", "in_progress").
			Order("FIELD(priority, 'P0', 'P1', 'P2', 'P3'), created_at DESC").
			Find(&tasks)
	}

	var unsettled, taxReview int64
	config.DB.Model(&models.Issue{}).
		Where("issue_type = ? AND status IN (?, ?)", "settlement", "open", "in_progress").
		Count(&unsettled)
	if cfoUser.ID > 0 {
		config.DB.Model(&models.Issue{}).
			Where("assignee_name = ? AND issue_type = ? AND status = ?", cfoUser.Name, "settlement", "open").
			Count(&taxReview)
	}

	// 받은 지시
	var received []models.ETFDirective
	config.DB.Where("to_role = ? AND status != ?", "cfo", models.DirectiveStatusCompleted).
		Order("FIELD(priority, 'urgent', 'high', 'normal', 'low'), created_at DESC").
		Limit(30).Find(&received)

	// 보낸 지시
	var sent []models.ETFDirective
	if cfoUser.ID > 0 {
		config.DB.Where("from_user_id = ?", cfoUser.ID).
			Order("created_at DESC").Limit(30).Find(&sent)
	}

	// 재무 흐름 집계 (기본: 이번달)
	financial := s.BuildFinancialFlow("", "")

	return CFOBoardData{
		MyTasks:            tasks,
		UnsettledCount:     unsettled,
		TaxReviewCount:     taxReview,
		AccountingReview:   0,
		SettlementDelayed:  0,
		TotalTasks:         int64(len(tasks)),
		ReceivedDirectives: received,
		SentDirectives:     sent,
		Financial:          financial,
	}
}

// BuildFinancialFlow Data 1/2/3 통합 재무 흐름 (기간 파라미터)
// startDate, endDate가 비어있으면 이번달 기준
func (s *ETFBoardService) BuildFinancialFlow(startDate, endDate string) FinancialFlow {
	now := time.Now()

	// 기간 파싱
	var periodStart, periodEnd time.Time
	if startDate != "" && endDate != "" {
		periodStart, _ = time.Parse("2006-01-02", startDate)
		periodEnd, _ = time.Parse("2006-01-02", endDate)
		periodEnd = periodEnd.AddDate(0, 0, 1) // endDate 포함
	} else {
		// 기본: 이번달
		periodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		periodEnd = periodStart.AddDate(0, 1, 0)
	}

	// 비교 기간: 동일 길이를 월 단위로 정렬
	// 예: 5/1~5/31 → 이전: 4/1~4/30 (정확히 1개월 전)
	months := 0
	t := periodStart
	for t.Before(periodEnd) {
		t = t.AddDate(0, 1, 0)
		months++
	}
	if months == 0 {
		months = 1
	}

	var prevStart, prevEnd time.Time
	if months >= 1 && periodStart.Day() == 1 {
		// 월 초 시작 → 정확히 N개월 전
		prevStart = periodStart.AddDate(0, -months, 0)
		prevEnd = periodStart
	} else {
		// 그 외 → 동일 일수만큼 이전
		duration := periodEnd.Sub(periodStart)
		prevStart = periodStart.Add(-duration)
		prevEnd = periodStart
	}

	startStr := periodStart.Format("2006-01-02")
	days := int(periodEnd.Sub(periodStart).Hours() / 24)

	periodLabel := fmt.Sprintf("%s ~ %s (%d일)", startStr, periodEnd.AddDate(0, 0, -1).Format("2006-01-02"), days)

	// 날짜 문자열
	endStr := periodEnd.Format("2006-01-02")
	prevStartStr := prevStart.Format("2006-01-02")
	prevEndStr := prevEnd.Format("2006-01-02")

	// Data 1: 매출 — hostex_transactions (type=수입) 원본 CSV
	var revThis, revLast int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = ? AND transaction_at >= ? AND transaction_at < ?", "수입", startStr, endStr).
		Select("COALESCE(SUM(amount), 0)").Scan(&revThis)
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = ? AND transaction_at >= ? AND transaction_at < ?", "수입", prevStartStr, prevEndStr).
		Select("COALESCE(SUM(amount), 0)").Scan(&revLast)

	data1 := DataFlowSummary{
		Label:       "Data 1 · 매출",
		Description: periodLabel + " · Hostex CSV 수입",
		Source:      "hostex_transactions (type=수입)",
		ThisMonth:   revThis,
		LastMonth:   revLast,
	}
	if revLast > 0 {
		data1.Change = revThis - revLast
		data1.ChangeRate = float64(revThis-revLast) / float64(revLast) * 100
	}

	// Data 2: 비용 — hostex_transactions (type=비용) 원본 CSV만 사용
	// cost_allocations 이중 집계 방지
	var totalCostThis, totalCostLast int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = ? AND transaction_at >= ? AND transaction_at < ?", "비용", startStr, endStr).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalCostThis)
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = ? AND transaction_at >= ? AND transaction_at < ?", "비용", prevStartStr, prevEndStr).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalCostLast)

	data2 := DataFlowSummary{
		Label:       "Data 2 · 비용",
		Description: periodLabel + " · Hostex CSV 비용",
		Source:      "hostex_transactions (type=비용)",
		ThisMonth:   totalCostThis,
		LastMonth:   totalCostLast,
	}
	if totalCostLast > 0 {
		data2.Change = totalCostThis - totalCostLast
		data2.ChangeRate = float64(totalCostThis-totalCostLast) / float64(totalCostLast) * 100
	}

	// Data 3: 순이익 (수입 - 비용)
	netThis := revThis - totalCostThis
	netLast := revLast - totalCostLast

	desc3 := periodLabel + " · 수입 - 비용"
	if startDate == "" && endDate == "" {
		elapsed := now.Day()
		daysInMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()
		if elapsed > 0 {
			projectedRev := (revThis / int64(elapsed)) * int64(daysInMonth)
			projectedCost := (totalCostThis / int64(elapsed)) * int64(daysInMonth)
			projectedNet := projectedRev - projectedCost
			desc3 = fmt.Sprintf("%d/%d일 경과 · 월말 예상 ₩%s", elapsed, daysInMonth, formatKRW(int(projectedNet)))
		}
	}

	data3 := DataFlowSummary{
		Label:       "Data 3 · 순이익",
		Description: desc3,
		Source:      "수입 - 비용 (hostex_transactions)",
		ThisMonth:   netThis,
		LastMonth:   netLast,
	}
	if netLast != 0 {
		data3.Change = netThis - netLast
		data3.ChangeRate = float64(netThis-netLast) / float64(abs64(netLast)) * 100
	}

	// P&L 트렌드 — hostex_transactions 월별 집계
	var trend []MonthlyPL
	trendStartStr := periodStart.AddDate(0, -6, 0).Format("2006-01") + "-01"
	type monthRow struct {
		Ym      string
		Revenue int64
		Cost    int64
	}
	var rows []monthRow
	config.DB.Raw(`
		SELECT DATE_FORMAT(transaction_at, '%Y-%m') as ym,
			SUM(CASE WHEN type = '수입' THEN amount ELSE 0 END) as revenue,
			SUM(CASE WHEN type = '비용' THEN amount ELSE 0 END) as cost
		FROM hostex_transactions
		WHERE transaction_at >= ?
		GROUP BY ym ORDER BY ym ASC
	`, trendStartStr).Scan(&rows)

	for _, r := range rows {
		net := r.Revenue - r.Cost
		margin := 0.0
		if r.Revenue > 0 {
			margin = float64(net) / float64(r.Revenue) * 100
		}
		trend = append(trend, MonthlyPL{
			Month: r.Ym, Revenue: r.Revenue,
			Cost: r.Cost, Net: net, Margin: margin,
		})
	}

	return FinancialFlow{
		Data1:        data1,
		Data2:        data2,
		Data3:        data3,
		MonthlyTrend: trend,
	}
}

// getMonthsBetween 기간 사이의 YYYY-MM 목록
func getMonthsBetween(start, end time.Time) []string {
	var months []string
	cur := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, start.Location())
	for cur.Before(end) {
		months = append(months, cur.Format("2006-01"))
		cur = cur.AddDate(0, 1, 0)
	}
	return months
}

// abs64 is defined in monthly_report_service.go

// --- ETF Board 통합 ---

type ETFBoardOverview struct {
	CEO CEOCardData `json:"ceo"`
	CTO CTOCardData `json:"cto"`
	CFO CFOCardData `json:"cfo"`
}

type CEOCardData struct {
	Bottlenecks     int64 `json:"bottlenecks"`
	DelayedTasks    int64 `json:"delayed_tasks"`
	ApprovalPending int64 `json:"approval_pending"`
	TeamCount       int   `json:"team_count"`
	OnlineCount     int   `json:"online_count"`
}

type CTOCardData struct {
	TotalTasks      int64 `json:"total_tasks"`
	Documentation   int   `json:"documentation"`
	Research        int   `json:"research"`
	MessageReview   int   `json:"message_review"`
}

type CFOCardData struct {
	UnsettledCount  int64 `json:"unsettled_count"`
	TaxReview       int64 `json:"tax_review"`
	TotalTasks      int64 `json:"total_tasks"`
}

func (s *ETFBoardService) GetOverview() ETFBoardOverview {
	ceo := s.GetCEOBoard()
	cto := s.GetCTOBoard()
	cfo := s.GetCFOBoard()

	return ETFBoardOverview{
		CEO: CEOCardData{
			Bottlenecks:     ceo.TotalOpen,
			DelayedTasks:    ceo.TotalDelayed,
			ApprovalPending: ceo.TotalApproval,
			TeamCount:       len(ceo.TeamCompletion),
			OnlineCount:     countOnline(ceo.TeamCompletion),
		},
		CTO: CTOCardData{
			TotalTasks:    cto.TotalTasks,
			Documentation: cto.Domains["documentation"],
			Research:      cto.Domains["research"],
			MessageReview: cto.Domains["message"],
		},
		CFO: CFOCardData{
			UnsettledCount: cfo.UnsettledCount,
			TaxReview:      cfo.TaxReviewCount,
			TotalTasks:     cfo.TotalTasks,
		},
	}
}

func countOnline(stats []TeamStat) int {
	n := 0
	for _, s := range stats {
		if s.IsOnline {
			n++
		}
	}
	return n
}
