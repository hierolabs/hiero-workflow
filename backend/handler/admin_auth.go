package handler

import (
	"net/http"
	"os"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AdminAuthHandler struct{}

func NewAdminAuthHandler() *AdminAuthHandler {
	return &AdminAuthHandler{}
}

func (h *AdminAuthHandler) Login(c *gin.Context) {
	var body struct {
		LoginID  string `json:"login_id" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "아이디와 비밀번호를 입력해주세요"})
		return
	}

	var user models.AdminUser
	if err := config.DB.Where("login_id = ?", body.LoginID).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "아이디 또는 비밀번호가 올바르지 않습니다"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "아이디 또는 비밀번호가 올바르지 않습니다"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    user.ID,
		"login_id":   user.LoginID,
		"role":       user.Role,
		"role_layer": user.RoleLayer,
		"role_title": user.RoleTitle,
		"exp":        time.Now().Add(24 * time.Hour).Unix(),
	})

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "hiero-default-secret"
	}

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "토큰 생성 실패"})
		return
	}

	// Auto attendance: create session on login
	attSvc := service.NewAttendanceService()
	session := attSvc.Login(user.ID, user.Name, string(user.RoleTitle), c.ClientIP(), c.GetHeader("User-Agent"))

	c.JSON(http.StatusOK, gin.H{
		"token":      tokenString,
		"session_id": session.ID,
		"user": gin.H{
			"id":                user.ID,
			"login_id":          user.LoginID,
			"name":              user.Name,
			"role":              user.Role,
			"role_layer":        user.RoleLayer,
			"role_title":        user.RoleTitle,
			"default_dashboard": user.GetDefaultDashboard(),
		},
	})
}

func (h *AdminAuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.AdminUser
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "사용자를 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                user.ID,
		"login_id":          user.LoginID,
		"name":              user.Name,
		"role":              user.Role,
		"role_layer":        user.RoleLayer,
		"role_title":        user.RoleTitle,
		"default_dashboard": user.GetDefaultDashboard(),
	})
}
