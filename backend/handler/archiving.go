package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ArchivingHandler struct {
	svc *service.ArchivingService
}

func NewArchivingHandler() *ArchivingHandler {
	return &ArchivingHandler{svc: service.NewArchivingService()}
}

// Generate — 세션 작업 → TAB 1~4 생성
func (h *ArchivingHandler) Generate(c *gin.Context) {
	var req service.GenerateSessionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_summary는 필수입니다"})
		return
	}

	authorName := getUserName(c)
	result, err := h.svc.GenerateSessionTabs(req, authorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Weekly — 주간 TAB 5~7 생성
func (h *ArchivingHandler) Weekly(c *gin.Context) {
	var req service.GenerateWeeklyReq
	c.ShouldBindJSON(&req)

	authorName := getUserName(c)
	result, err := h.svc.GenerateWeeklyTabs(req, authorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// MonthlyNotify — 월간 검토 알림
func (h *ArchivingHandler) MonthlyNotify(c *gin.Context) {
	count, err := h.svc.MonthlyNotify()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"review_count": count, "message": "알림 발송 완료"})
}

// ListJobs — 작업 이력
func (h *ArchivingHandler) ListJobs(c *gin.Context) {
	limit := 30
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	jobs, err := h.svc.ListJobs(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"jobs": jobs})
}

// Review — 다관점 AI 평가
func (h *ArchivingHandler) Review(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Perspectives []string `json:"perspectives"`
	}
	c.ShouldBindJSON(&req)

	result, err := h.svc.ReviewArticle(uint(id), req.Perspectives)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Rewrite — 평가 피드백 기반 AI 재작성
func (h *ArchivingHandler) Rewrite(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		Perspectives []string `json:"perspectives"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.svc.RewriteWithFeedback(uint(id), req.Perspectives)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": result})
}

// GetReviews — 아티클 저장된 평가 결과 조회
func (h *ArchivingHandler) GetReviews(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	reviews, err := h.svc.GetArticleReviews(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reviews": reviews})
}

// ReviewSummary — CTO Board용 평가 요약
func (h *ArchivingHandler) ReviewSummary(c *gin.Context) {
	items, err := h.svc.GetReviewSummary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// Status — 아카이빙 현황
func (h *ArchivingHandler) Status(c *gin.Context) {
	status, err := h.svc.GetStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}
