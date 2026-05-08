package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CleaningDispatchHandler struct {
	svc *service.CleaningDispatchService
}

func NewCleaningDispatchHandler() *CleaningDispatchHandler {
	return &CleaningDispatchHandler{svc: service.NewCleaningDispatchService()}
}

// POST /admin/cleaning/parse-assignment — 카톡 배정표 붙여넣기 → 파싱
func (h *CleaningDispatchHandler) ParseAssignment(c *gin.Context) {
	var body struct {
		Text string `json:"text" binding:"required"`
		Date string `json:"date"` // 날짜 오버라이드 (없으면 텍스트에서 추출)
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "배정 텍스트를 입력해주세요"})
		return
	}

	result := h.svc.ParseAssignmentText(body.Text, body.Date)
	c.JSON(http.StatusOK, result)
}

// POST /admin/cleaning/confirm-assignment — 파싱 결과 확정 → 실제 배정
func (h *CleaningDispatchHandler) ConfirmAssignment(c *gin.Context) {
	var body struct {
		Assignments []service.ParsedAssignment `json:"assignments"`
		Date        string                     `json:"date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assigned, created, err := h.svc.ConfirmAssignments(body.Assignments, body.Date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "배정 완료",
		"assigned": assigned,
		"created":  created,
	})
}

// GET /admin/cleaning/auto-assign?date=2026-05-08 — AI 자동 배정 제안
func (h *CleaningDispatchHandler) AutoAssign(c *gin.Context) {
	date := c.DefaultQuery("date", "")
	result := h.svc.AutoAssign(date)
	c.JSON(http.StatusOK, result)
}

// POST /admin/cleaning/confirm-auto-assign — AI 배정 확정
func (h *CleaningDispatchHandler) ConfirmAutoAssign(c *gin.Context) {
	var body struct {
		Assignments []service.AutoAssignment `json:"assignments"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	count := h.svc.ConfirmAutoAssign(body.Assignments)
	c.JSON(http.StatusOK, gin.H{"message": "자동 배정 확정", "assigned": count})
}
