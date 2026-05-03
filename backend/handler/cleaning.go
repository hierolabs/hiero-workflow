package handler

import (
	"net/http"
	"strconv"
	"time"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CleaningHandler struct {
	svc      *service.CleaningService
	issueSvc *service.IssueService
	commSvc  *service.CommunicationService
}

func NewCleaningHandler() *CleaningHandler {
	return &CleaningHandler{
		svc:      service.NewCleaningService(),
		issueSvc: service.NewIssueService(),
		commSvc:  service.NewCommunicationService(),
	}
}

// --- 청소 업무 ---

// ListTasks — 청소 업무 목록
func (h *CleaningHandler) ListTasks(c *gin.Context) {
	var query service.CleaningListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "목록 조회 실패"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetSummary — 날짜별 청소 요약
func (h *CleaningHandler) GetSummary(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	summary := h.svc.GetSummary(date)
	c.JSON(http.StatusOK, summary)
}

// Generate — 특정 날짜 청소 업무 자동 생성
func (h *CleaningHandler) Generate(c *gin.Context) {
	var req struct {
		Date string `json:"date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}

	created, err := h.svc.GenerateFromCheckouts(req.Date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "청소 업무 생성 완료",
		"created": created,
		"date":    req.Date,
	})
}

// Assign — 청소자 배정
func (h *CleaningHandler) Assign(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		CleanerID uint `json:"cleaner_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.CleanerID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cleaner_id는 필수입니다"})
		return
	}

	task, err := h.svc.Assign(id, req.CleanerID)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

// Start — 청소 시작
func (h *CleaningHandler) Start(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	task, err := h.svc.Start(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

// Complete — 청소 완료
func (h *CleaningHandler) Complete(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	task, err := h.svc.Complete(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	// 시스템 로그
	h.commSvc.LogSystemEvent(task.PropertyID, task.ReservationID, task.ReservationCode,
		"청소 완료: "+task.PropertyCode+" "+task.PropertyName)

	c.JSON(http.StatusOK, task)
}

// ReportIssue — 문제 있음 등록
func (h *CleaningHandler) ReportIssue(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
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

	task, err := h.svc.ReportIssue(id, req.IssueMemo)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	// 이슈 자동 생성
	issue, _ := h.issueSvc.CreateFromCleaningTask(task, req.IssueMemo)

	// 시스템 로그
	h.commSvc.LogSystemEvent(task.PropertyID, task.ReservationID, task.ReservationCode,
		"청소 문제 발생: "+req.IssueMemo)

	c.JSON(http.StatusOK, gin.H{
		"task":  task,
		"issue": issue,
	})
}

// --- 청소자 관리 ---

func (h *CleaningHandler) ListCleaners(c *gin.Context) {
	cleaners := h.svc.ListCleaners()
	c.JSON(http.StatusOK, cleaners)
}

func (h *CleaningHandler) CreateCleaner(c *gin.Context) {
	var cleaner models.Cleaner
	if err := c.ShouldBindJSON(&cleaner); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if cleaner.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "이름은 필수입니다"})
		return
	}

	created, err := h.svc.CreateCleaner(cleaner)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *CleaningHandler) UpdateCleaner(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		Name   string `json:"name"`
		Phone  string `json:"phone"`
		Region string `json:"region"`
		Memo   string `json:"memo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	cleaner, err := h.svc.UpdateCleaner(id, req.Name, req.Phone, req.Region, req.Memo)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, cleaner)
}

func (h *CleaningHandler) DeleteCleaner(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	if err := h.svc.DeleteCleaner(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "삭제 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "삭제 완료"})
}

// --- 청소코드 ---

func (h *CleaningHandler) ListCleaningCodes(c *gin.Context) {
	codes := h.svc.ListCleaningCodes()
	c.JSON(http.StatusOK, codes)
}

// --- 청소자별 배정 현황 ---

func (h *CleaningHandler) CleanerWorkload(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	workload := h.svc.GetCleanerWorkload(date)
	c.JSON(http.StatusOK, workload)
}

func parseUint(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 32)
	return uint(id), err
}
