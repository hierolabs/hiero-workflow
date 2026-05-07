package service

import (
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
	MyTasks       []models.Issue `json:"my_tasks"`
	TotalTasks    int64          `json:"total_tasks"`
	Domains       map[string]int `json:"domains"`
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

	return CTOBoardData{
		MyTasks:    tasks,
		TotalTasks: int64(len(tasks)),
		Domains:    domains,
	}
}

// --- CFO Board ---

type CFOBoardData struct {
	MyTasks              []models.Issue `json:"my_tasks"`
	UnsettledCount       int64          `json:"unsettled_count"`
	TaxReviewCount       int64          `json:"tax_review_count"`
	AccountingReview     int64          `json:"accounting_review"`
	SettlementDelayed    int64          `json:"settlement_delayed"`
	TotalTasks           int64          `json:"total_tasks"`
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

	return CFOBoardData{
		MyTasks:           tasks,
		UnsettledCount:    unsettled,
		TaxReviewCount:    taxReview,
		AccountingReview:  0,
		SettlementDelayed: 0,
		TotalTasks:        int64(len(tasks)),
	}
}

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
