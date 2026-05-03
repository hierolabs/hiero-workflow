package handler

import (
	"net/http"

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
