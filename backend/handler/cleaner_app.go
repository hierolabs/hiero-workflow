package handler

import (
	"net/http"
	"os"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type CleanerAppHandler struct {
	svc *service.CleaningService
}

func NewCleanerAppHandler() *CleanerAppHandler {
	return &CleanerAppHandler{
		svc: service.NewCleaningService(),
	}
}

// --- 로그인 ---

func (h *CleanerAppHandler) Login(c *gin.Context) {
	var req struct {
		LoginID  string `json:"login_id"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	req.LoginID = strings.TrimSpace(req.LoginID)
	if req.LoginID == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "아이디와 비밀번호를 입력해주세요"})
		return
	}

	var cleaner models.Cleaner
	if err := config.DB.Where("login_id = ? AND active = ?", req.LoginID, true).First(&cleaner).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "아이디 또는 비밀번호가 올바르지 않습니다"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cleaner.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "아이디 또는 비밀번호가 올바르지 않습니다"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "hiero-default-secret"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"cleaner_id":   cleaner.ID,
		"cleaner_name": cleaner.Name,
		"login_id":     cleaner.LoginID,
		"role":         "cleaner",
		"exp":          time.Now().Add(30 * 24 * time.Hour).Unix(), // 30일
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "토큰 생성 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"cleaner": gin.H{
			"id":        cleaner.ID,
			"name":      cleaner.Name,
			"login_id":  cleaner.LoginID,
			"phone":     cleaner.Phone,
			"regions":   cleaner.Regions,
			"transport": cleaner.Transport,
		},
	})
}

// --- 내 정보 ---

func (h *CleanerAppHandler) Me(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	var cleaner models.Cleaner
	if err := config.DB.First(&cleaner, cleanerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "청소자 정보를 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             cleaner.ID,
		"name":           cleaner.Name,
		"login_id":       cleaner.LoginID,
		"phone":          cleaner.Phone,
		"region":         cleaner.Region,
		"regions":        cleaner.Regions,
		"available_days": cleaner.AvailableDays,
		"transport":      cleaner.Transport,
		"can_laundry":    cleaner.CanLaundry,
		"can_dry":        cleaner.CanDry,
		"max_daily":      cleaner.MaxDaily,
	})
}

// --- 내 오늘 배정 ---

func (h *CleanerAppHandler) MyTasks(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	var tasks []models.CleaningTask
	config.DB.Where("cleaner_id = ? AND cleaning_date = ?", cleanerID, date).
		Order("FIELD(priority, 'urgent', 'normal', 'low'), created_at ASC").
		Find(&tasks)

	// 오늘 요약
	var totalBase, totalExtra, totalCost int
	var completed, total int
	for _, t := range tasks {
		total++
		totalBase += t.BasePrice
		totalExtra += t.ExtraCost
		totalCost += t.TotalCost
		if t.Status == models.CleaningStatusCompleted {
			completed++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
		"summary": gin.H{
			"date":        date,
			"total":       total,
			"completed":   completed,
			"total_base":  totalBase,
			"total_extra": totalExtra,
			"total_cost":  totalCost,
		},
	})
}

// --- 청소 시작 ---

func (h *CleanerAppHandler) StartTask(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	taskID, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "업무를 찾을 수 없습니다"})
		return
	}

	if task.CleanerID == nil || *task.CleanerID != cleanerID {
		c.JSON(http.StatusForbidden, gin.H{"error": "본인에게 배정된 업무만 시작할 수 있습니다"})
		return
	}

	now := time.Now()
	task.Status = models.CleaningStatusInProgress
	task.StartedAt = &now
	config.DB.Save(&task)

	c.JSON(http.StatusOK, task)
}

// --- 청소 완료 ---

func (h *CleanerAppHandler) CompleteTask(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	taskID, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "업무를 찾을 수 없습니다"})
		return
	}

	if task.CleanerID == nil || *task.CleanerID != cleanerID {
		c.JSON(http.StatusForbidden, gin.H{"error": "본인에게 배정된 업무만 완료할 수 있습니다"})
		return
	}

	now := time.Now()
	task.Status = models.CleaningStatusCompleted
	task.CompletedAt = &now
	config.DB.Save(&task)

	c.JSON(http.StatusOK, task)
}

// --- 문제 등록 ---

func (h *CleanerAppHandler) ReportIssue(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	taskID, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		IssueMemo string `json:"issue_memo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "업무를 찾을 수 없습니다"})
		return
	}

	if task.CleanerID == nil || *task.CleanerID != cleanerID {
		c.JSON(http.StatusForbidden, gin.H{"error": "본인에게 배정된 업무만 수정할 수 있습니다"})
		return
	}

	task.Status = models.CleaningStatusIssue
	task.IssueMemo = strings.TrimSpace(req.IssueMemo)
	config.DB.Save(&task)

	c.JSON(http.StatusOK, task)
}

// --- 내 주간 지급액 ---

func (h *CleanerAppHandler) MyPayment(c *gin.Context) {
	cleanerID := c.GetUint("cleaner_id")
	weekStart := c.Query("week_start")
	weekEnd := c.Query("week_end")

	if weekStart == "" || weekEnd == "" {
		// 기본: 이번 주 (월~일)
		now := time.Now()
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		monday := now.AddDate(0, 0, -(weekday - 1))
		sunday := monday.AddDate(0, 0, 6)
		weekStart = monday.Format("2006-01-02")
		weekEnd = sunday.Format("2006-01-02")
	}

	var tasks []models.CleaningTask
	config.DB.Where("cleaner_id = ? AND cleaning_date >= ? AND cleaning_date <= ?",
		cleanerID, weekStart, weekEnd).
		Order("cleaning_date ASC").
		Find(&tasks)

	var totalBase, totalExtra, totalCost, count int
	dailySummary := map[string]gin.H{}
	for _, t := range tasks {
		count++
		totalBase += t.BasePrice
		totalExtra += t.ExtraCost
		totalCost += t.TotalCost

		day := t.CleaningDate
		if _, ok := dailySummary[day]; !ok {
			dailySummary[day] = gin.H{"date": day, "count": 0, "amount": 0}
		}
		ds := dailySummary[day]
		ds["count"] = ds["count"].(int) + 1
		ds["amount"] = ds["amount"].(int) + t.TotalCost
		dailySummary[day] = ds
	}

	days := make([]gin.H, 0)
	for _, v := range dailySummary {
		days = append(days, v)
	}

	c.JSON(http.StatusOK, gin.H{
		"week_start":  weekStart,
		"week_end":    weekEnd,
		"count":       count,
		"total_base":  totalBase,
		"total_extra": totalExtra,
		"total_cost":  totalCost,
		"daily":       days,
	})
}
