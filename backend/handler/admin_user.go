package handler

import (
	"math"
	"net/http"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AdminUserHandler struct{}

func NewAdminUserHandler() *AdminUserHandler {
	return &AdminUserHandler{}
}

// 전체 관리자 목록 (모든 admin 접근 가능)
func (h *AdminUserHandler) GetUsers(c *gin.Context) {
	var users []models.AdminUser
	config.DB.Order("created_at DESC").Find(&users)
	c.JSON(http.StatusOK, users)
}

// GET /admin/users/team-stats — 팀원별 실시간 KPI 통계
func (h *AdminUserHandler) TeamStats(c *gin.Context) {
	var users []models.AdminUser
	config.DB.Where("role_title != '' AND login_id != 'admin'").Find(&users)

	today := time.Now().Format("2006-01-02")
	weekAgo := time.Now().AddDate(0, 0, -7)
	monthAgo := time.Now().AddDate(0, -1, 0)

	type UserStat struct {
		UserID    uint   `json:"user_id"`
		Name      string `json:"name"`
		LoginID   string `json:"login_id"`
		RoleTitle string `json:"role_title"`
		RoleLayer string `json:"role_layer"`
		Stats     struct {
			OpenIssues       int64   `json:"open_issues"`
			ResolvedToday    int64   `json:"resolved_today"`
			ResolvedWeek     int64   `json:"resolved_week"`
			ResolvedMonth    int64   `json:"resolved_month"`
			EscalatedUp      int64   `json:"escalated_up"`
			DelegatedDown    int64   `json:"delegated_down"`
			AvgResolveHours  float64 `json:"avg_resolve_hours"`
			ActivityWeek     int64   `json:"activity_week"`
			UnreadNotifs     int64   `json:"unread_notifications"`
		} `json:"stats"`
	}

	// 사용자 이름/ID 목록 추출
	names := make([]string, 0, len(users))
	userIDs := make([]uint, 0, len(users))
	roleTitles := make([]string, 0, len(users))
	for _, u := range users {
		names = append(names, u.Name)
		userIDs = append(userIDs, u.ID)
		roleTitles = append(roleTitles, u.RoleTitle)
	}

	// ── 일괄 조회 1: 이슈 통계 (assignee_name별 상태+기간 집계) ──
	type issueAgg struct {
		AssigneeName string
		OpenCnt      int64
		TodayCnt     int64
		WeekCnt      int64
		MonthCnt     int64
		AvgHours     *float64
	}
	var issueAggs []issueAgg
	config.DB.Model(&models.Issue{}).
		Select(`assignee_name,
			SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) as open_cnt,
			SUM(CASE WHEN status IN ('resolved','closed') AND resolved_at >= ? THEN 1 ELSE 0 END) as today_cnt,
			SUM(CASE WHEN status IN ('resolved','closed') AND resolved_at >= ? THEN 1 ELSE 0 END) as week_cnt,
			SUM(CASE WHEN status IN ('resolved','closed') AND resolved_at >= ? THEN 1 ELSE 0 END) as month_cnt,
			AVG(CASE WHEN status IN ('resolved','closed') AND resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) END) as avg_hours`,
			today, weekAgo, monthAgo).
		Where("assignee_name IN ?", names).
		Group("assignee_name").Find(&issueAggs)
	issueMap := map[string]issueAgg{}
	for _, ia := range issueAggs {
		issueMap[ia.AssigneeName] = ia
	}

	// ── 일괄 조회 2: 에스컬레이트 (escalated_from별) ──
	type escAgg struct {
		EscalatedFrom string
		Cnt           int64
	}
	var escAggs []escAgg
	config.DB.Model(&models.Issue{}).
		Select("escalated_from, COUNT(*) as cnt").
		Where("escalated_from IN ? AND escalation_level IN (?,?)", roleTitles, "etf", "founder").
		Group("escalated_from").Find(&escAggs)
	escMap := map[string]int64{}
	for _, ea := range escAggs {
		escMap[ea.EscalatedFrom] = ea.Cnt
	}

	// ── 일괄 조회 3: 업무지시 (activity_log에서 이름 매칭) ──
	type delegAgg struct {
		TargetName string
		Cnt        int64
	}
	delegMap := map[string]int64{}
	for _, n := range names {
		var cnt int64
		config.DB.Model(&models.ActivityLog{}).Where("action = ? AND detail LIKE ?", models.ActionIssueAssigned, "%→ "+n+"%").Count(&cnt)
		if cnt > 0 {
			delegMap[n] = cnt
		}
	}

	// ── 일괄 조회 4: 주간 활동 (user_name별) ──
	type actAgg struct {
		UserName string
		Cnt      int64
	}
	var actAggs []actAgg
	config.DB.Model(&models.ActivityLog{}).
		Select("user_name, COUNT(*) as cnt").
		Where("user_name IN ? AND created_at >= ?", names, weekAgo).
		Group("user_name").Find(&actAggs)
	actMap := map[string]int64{}
	for _, aa := range actAggs {
		actMap[aa.UserName] = aa.Cnt
	}

	// ── 일괄 조회 5: 읽지않은 알림 (user_id별) ──
	type notifAgg struct {
		UserID uint
		Cnt    int64
	}
	var notifAggs []notifAgg
	config.DB.Model(&models.Notification{}).
		Select("user_id, COUNT(*) as cnt").
		Where("user_id IN ? AND is_read = ?", userIDs, false).
		Group("user_id").Find(&notifAggs)
	notifMap := map[uint]int64{}
	for _, na := range notifAggs {
		notifMap[na.UserID] = na.Cnt
	}

	// ── 조립 ──
	results := make([]UserStat, 0, len(users))
	for _, u := range users {
		s := UserStat{UserID: u.ID, Name: u.Name, LoginID: u.LoginID, RoleTitle: u.RoleTitle, RoleLayer: u.RoleLayer}

		if ia, ok := issueMap[u.Name]; ok {
			s.Stats.OpenIssues = ia.OpenCnt
			s.Stats.ResolvedToday = ia.TodayCnt
			s.Stats.ResolvedWeek = ia.WeekCnt
			s.Stats.ResolvedMonth = ia.MonthCnt
			if ia.AvgHours != nil {
				s.Stats.AvgResolveHours = math.Round(*ia.AvgHours*10) / 10
			}
		}
		s.Stats.EscalatedUp = escMap[u.RoleTitle]
		s.Stats.DelegatedDown = delegMap[u.Name]
		s.Stats.ActivityWeek = actMap[u.Name]
		s.Stats.UnreadNotifs = notifMap[u.ID]

		results = append(results, s)
	}

	c.JSON(http.StatusOK, results)
}

// 관리자 생성 (super_admin만)
func (h *AdminUserHandler) CreateUser(c *gin.Context) {
	var body struct {
		LoginID  string `json:"login_id" binding:"required"`
		Password string `json:"password" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "필수 항목을 입력해주세요"})
		return
	}

	var exists models.AdminUser
	if err := config.DB.Where("login_id = ?", body.LoginID).First(&exists).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "이미 존재하는 아이디입니다"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "비밀번호 처리 실패"})
		return
	}

	role := models.RoleAdmin
	if body.Role == models.RoleSuperAdmin {
		role = models.RoleSuperAdmin
	}

	user := models.AdminUser{
		LoginID:  body.LoginID,
		Password: string(hashed),
		Name:     body.Name,
		Role:     role,
	}
	config.DB.Create(&user)
	c.JSON(http.StatusCreated, user)
}

// 관리자 정보 수정 (super_admin만)
func (h *AdminUserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var user models.AdminUser
	if err := config.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "사용자를 찾을 수 없습니다"})
		return
	}

	var body struct {
		Name *string `json:"name"`
		Role *string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.Name != nil {
		user.Name = *body.Name
	}
	if body.Role != nil && (*body.Role == models.RoleSuperAdmin || *body.Role == models.RoleAdmin) {
		user.Role = *body.Role
	}

	config.DB.Save(&user)
	c.JSON(http.StatusOK, user)
}

// 비밀번호 재설정 (super_admin만)
func (h *AdminUserHandler) ResetPassword(c *gin.Context) {
	id := c.Param("id")

	var user models.AdminUser
	if err := config.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "사용자를 찾을 수 없습니다"})
		return
	}

	var body struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "새 비밀번호를 입력해주세요"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "비밀번호 처리 실패"})
		return
	}

	config.DB.Model(&user).Update("password", string(hashed))
	c.JSON(http.StatusOK, gin.H{"message": "비밀번호가 재설정되었습니다"})
}

// 관리자 삭제 (super_admin만)
func (h *AdminUserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	var user models.AdminUser
	if err := config.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "사용자를 찾을 수 없습니다"})
		return
	}

	// 자기 자신 삭제 방지
	currentID, _ := c.Get("user_id")
	if user.ID == currentID.(uint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "자기 자신은 삭제할 수 없습니다"})
		return
	}

	config.DB.Delete(&user)
	c.JSON(http.StatusOK, gin.H{"message": "삭제되었습니다"})
}
