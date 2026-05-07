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

	results := make([]UserStat, 0, len(users))
	for _, u := range users {
		s := UserStat{UserID: u.ID, Name: u.Name, LoginID: u.LoginID, RoleTitle: u.RoleTitle, RoleLayer: u.RoleLayer}

		// 미처리 이슈
		config.DB.Model(&models.Issue{}).Where("assignee_name = ? AND status IN (?,?)", u.Name, "open", "in_progress").Count(&s.Stats.OpenIssues)
		// 오늘 해결
		config.DB.Model(&models.Issue{}).Where("assignee_name = ? AND status IN (?,?) AND resolved_at >= ?", u.Name, "resolved", "closed", today).Count(&s.Stats.ResolvedToday)
		// 주간 해결
		config.DB.Model(&models.Issue{}).Where("assignee_name = ? AND status IN (?,?) AND resolved_at >= ?", u.Name, "resolved", "closed", weekAgo).Count(&s.Stats.ResolvedWeek)
		// 월간 해결
		config.DB.Model(&models.Issue{}).Where("assignee_name = ? AND status IN (?,?) AND resolved_at >= ?", u.Name, "resolved", "closed", monthAgo).Count(&s.Stats.ResolvedMonth)
		// 에스컬레이트 (이 사람이 올린 건)
		config.DB.Model(&models.Issue{}).Where("escalated_from = ? AND escalation_level IN (?,?)", u.RoleTitle, "etf", "founder").Count(&s.Stats.EscalatedUp)
		// 업무지시 (이 사람에게 내려온 건)
		config.DB.Model(&models.ActivityLog{}).Where("action = ? AND detail LIKE ?", models.ActionIssueAssigned, "%→ "+u.Name+"%").Count(&s.Stats.DelegatedDown)
		// 평균 해결시간 (시간)
		var avgHours *float64
		config.DB.Model(&models.Issue{}).Select("AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at))").
			Where("assignee_name = ? AND status IN (?,?) AND resolved_at IS NOT NULL", u.Name, "resolved", "closed").
			Row().Scan(&avgHours)
		if avgHours != nil {
			s.Stats.AvgResolveHours = math.Round(*avgHours*10) / 10
		}
		// 주간 활동
		config.DB.Model(&models.ActivityLog{}).Where("user_name = ? AND created_at >= ?", u.Name, weekAgo).Count(&s.Stats.ActivityWeek)
		// 읽지않은 알림
		config.DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", u.ID, false).Count(&s.Stats.UnreadNotifs)

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
