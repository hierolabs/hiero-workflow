package service

import (
	"math"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type AttendanceService struct{}

func NewAttendanceService() *AttendanceService { return &AttendanceService{} }

// ── Session Management ──────────────────────────────────────────────

func (s *AttendanceService) Login(userID uint, userName, roleTitle, ip, ua string) *models.UserSession {
	// Close any open sessions for this user
	config.LocalDB.Model(&models.UserSession{}).
		Where("user_id = ? AND logout_at IS NULL", userID).
		Updates(map[string]interface{}{
			"logout_at": time.Now(),
		})
	// Backfill duration for just-closed sessions
	var openSessions []models.UserSession
	config.LocalDB.Where("user_id = ? AND duration = 0 AND logout_at IS NOT NULL", userID).Find(&openSessions)
	for _, sess := range openSessions {
		if sess.LogoutAt != nil {
			dur := int(sess.LogoutAt.Sub(sess.LoginAt).Minutes())
			config.LocalDB.Model(&sess).Update("duration", dur)
		}
	}

	session := models.UserSession{
		UserID:    userID,
		UserName:  userName,
		RoleTitle: roleTitle,
		LoginAt:   time.Now(),
		IPAddress: ip,
		UserAgent: ua,
	}
	config.LocalDB.Create(&session)
	return &session
}

func (s *AttendanceService) Logout(userID uint) {
	now := time.Now()
	var session models.UserSession
	if err := config.LocalDB.Where("user_id = ? AND logout_at IS NULL", userID).
		Order("login_at DESC").First(&session).Error; err != nil {
		return
	}
	dur := int(now.Sub(session.LoginAt).Minutes())
	config.LocalDB.Model(&session).Updates(map[string]interface{}{
		"logout_at": now,
		"duration":  dur,
	})
}

// LogoutAllExcept — 특정 사용자 외 전체 세션 로그아웃
func (s *AttendanceService) LogoutAllExcept(keepUserID uint) int {
	now := time.Now()
	var sessions []models.UserSession
	config.LocalDB.Where("user_id != ? AND logout_at IS NULL", keepUserID).Find(&sessions)
	for _, sess := range sessions {
		dur := int(now.Sub(sess.LoginAt).Minutes())
		config.LocalDB.Model(&sess).Updates(map[string]interface{}{
			"logout_at": now,
			"duration":  dur,
		})
	}
	return len(sessions)
}

func (s *AttendanceService) Heartbeat(userID uint) {
	// Touch the latest open session — keeps it alive
	var session models.UserSession
	if err := config.LocalDB.Where("user_id = ? AND logout_at IS NULL", userID).
		Order("login_at DESC").First(&session).Error; err != nil {
		return
	}
	// Auto-close if idle > 30min, then create a new session
	if time.Since(session.LoginAt) > 8*time.Hour {
		s.Logout(userID)
	}
}

// ── Activity Tracking ───────────────────────────────────────────────

func (s *AttendanceService) TrackActivity(userID, sessionID uint, action, page, detail string) {
	config.LocalDB.Create(&models.UserActivity{
		UserID:    userID,
		SessionID: sessionID,
		Action:    action,
		Page:      page,
		Detail:    detail,
	})
}

// ── Attendance Report ───────────────────────────────────────────────

type AttendanceRecord struct {
	Date       string `json:"date"`
	LoginAt    string `json:"login_at"`
	LogoutAt   string `json:"logout_at"`
	Duration   int    `json:"duration"` // minutes
	Activities int64  `json:"activities"`
}

type UserAttendance struct {
	UserID     uint               `json:"user_id"`
	UserName   string             `json:"user_name"`
	RoleTitle  string             `json:"role_title"`
	Records    []AttendanceRecord `json:"records"`
	TotalDays  int                `json:"total_days"`
	TotalHours float64            `json:"total_hours"`
	AvgHours   float64            `json:"avg_hours"`
}

func (s *AttendanceService) GetAttendance(startDate, endDate string) ([]UserAttendance, error) {
	var sessions []models.UserSession
	q := config.LocalDB.Order("user_id ASC, login_at ASC")
	if startDate != "" {
		t, _ := time.Parse("2006-01-02", startDate)
		q = q.Where("login_at >= ?", t)
	}
	if endDate != "" {
		t, _ := time.Parse("2006-01-02", endDate)
		q = q.Where("login_at < ?", t.AddDate(0, 0, 1))
	}
	if err := q.Find(&sessions).Error; err != nil {
		return nil, err
	}

	userMap := map[uint]*UserAttendance{}
	for _, sess := range sessions {
		ua, ok := userMap[sess.UserID]
		if !ok {
			ua = &UserAttendance{
				UserID:    sess.UserID,
				UserName:  sess.UserName,
				RoleTitle: sess.RoleTitle,
			}
			userMap[sess.UserID] = ua
		}

		logout := ""
		if sess.LogoutAt != nil {
			logout = sess.LogoutAt.Format("15:04")
		}

		var actCount int64
		config.LocalDB.Model(&models.UserActivity{}).Where("session_id = ?", sess.ID).Count(&actCount)

		ua.Records = append(ua.Records, AttendanceRecord{
			Date:       sess.LoginAt.Format("2006-01-02"),
			LoginAt:    sess.LoginAt.Format("15:04"),
			LogoutAt:   logout,
			Duration:   sess.Duration,
			Activities: actCount,
		})
	}

	result := []UserAttendance{}
	for _, ua := range userMap {
		days := map[string]bool{}
		totalMin := 0
		for _, r := range ua.Records {
			days[r.Date] = true
			totalMin += r.Duration
		}
		ua.TotalDays = len(days)
		ua.TotalHours = math.Round(float64(totalMin)/60*10) / 10
		if ua.TotalDays > 0 {
			ua.AvgHours = math.Round(ua.TotalHours/float64(ua.TotalDays)*10) / 10
		}
		result = append(result, *ua)
	}
	return result, nil
}

// ── Productivity Stats ──────────────────────────────────────────────

type ProductivityStat struct {
	UserID       uint    `json:"user_id"`
	UserName     string  `json:"user_name"`
	RoleTitle    string  `json:"role_title"`
	TotalHours   float64 `json:"total_hours"`
	TotalActions int64   `json:"total_actions"`
	PageViews    int64   `json:"page_views"`
	IssuesCreated  int64 `json:"issues_created"`
	IssuesResolved int64 `json:"issues_resolved"`
	Escalations    int64 `json:"escalations"`
	ActionsPerHour float64 `json:"actions_per_hour"`
}

func (s *AttendanceService) GetProductivity(startDate, endDate string) ([]ProductivityStat, error) {
	attendance, err := s.GetAttendance(startDate, endDate)
	if err != nil {
		return nil, err
	}

	result := []ProductivityStat{}
	for _, ua := range attendance {
		stat := ProductivityStat{
			UserID:     ua.UserID,
			UserName:   ua.UserName,
			RoleTitle:  ua.RoleTitle,
			TotalHours: ua.TotalHours,
		}

		// Count activities from UserActivity
		q := config.LocalDB.Model(&models.UserActivity{}).Where("user_id = ?", ua.UserID)
		if startDate != "" {
			q = q.Where("DATE(created_at) >= ?", startDate)
		}
		if endDate != "" {
			q = q.Where("DATE(created_at) <= ?", endDate)
		}
		q.Count(&stat.TotalActions)

		config.LocalDB.Model(&models.UserActivity{}).Where("user_id = ? AND action = ?", ua.UserID, "page_view").Count(&stat.PageViews)

		// Count from ActivityLog (existing issue actions)
		aq := config.LocalDB.Model(&models.ActivityLog{}).Where("user_id = ?", ua.UserID)
		if startDate != "" {
			aq = aq.Where("DATE(created_at) >= ?", startDate)
		}
		if endDate != "" {
			aq = aq.Where("DATE(created_at) <= ?", endDate)
		}
		aq.Where("action = ?", "issue_created").Count(&stat.IssuesCreated)

		config.LocalDB.Model(&models.ActivityLog{}).
			Where("user_id = ? AND action = ?", ua.UserID, "issue_resolved").
			Count(&stat.IssuesResolved)

		config.LocalDB.Model(&models.ActivityLog{}).
			Where("user_id = ? AND action = ?", ua.UserID, "issue_escalated").
			Count(&stat.Escalations)

		if stat.TotalHours > 0 {
			stat.ActionsPerHour = math.Round(float64(stat.TotalActions)/stat.TotalHours*10) / 10
		}

		result = append(result, stat)
	}
	return result, nil
}

// ── Today's Active Sessions ─────────────────────────────────────────

type ActiveUser struct {
	UserID    uint   `json:"user_id"`
	UserName  string `json:"user_name"`
	RoleTitle string `json:"role_title"`
	LoginAt   string `json:"login_at"`
	Duration  int    `json:"duration"` // minutes since login
	IsOnline  bool   `json:"is_online"`
}

func (s *AttendanceService) GetTodayActive() []ActiveUser {
	// KST 기준 오늘 00:00 ~ 23:59
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	var sessions []models.UserSession
	config.LocalDB.Where("login_at >= ?", todayStart).Order("login_at DESC").Find(&sessions)

	seen := map[uint]bool{}
	result := []ActiveUser{}
	for _, sess := range sessions {
		if seen[sess.UserID] {
			continue
		}
		seen[sess.UserID] = true

		dur := int(time.Since(sess.LoginAt).Minutes())
		if sess.LogoutAt != nil {
			dur = sess.Duration
		}

		result = append(result, ActiveUser{
			UserID:    sess.UserID,
			UserName:  sess.UserName,
			RoleTitle: sess.RoleTitle,
			LoginAt:   sess.LoginAt.Format("15:04"),
			Duration:  dur,
			IsOnline:  sess.LogoutAt == nil,
		})
	}
	return result
}
