package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type LeadHandler struct {
	svc *service.LeadService
}

func NewLeadHandler() *LeadHandler {
	return &LeadHandler{svc: service.NewLeadService()}
}

func (h *LeadHandler) Create(c *gin.Context) {
	var lead models.OutsourcingLead
	if err := c.ShouldBindJSON(&lead); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
		return
	}

	if err := h.svc.Create(&lead); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "리드 생성에 실패했습니다"})
		return
	}

	c.JSON(http.StatusCreated, lead)
}

func (h *LeadHandler) List(c *gin.Context) {
	status := c.Query("status")
	grade := c.Query("grade")

	leads, err := h.svc.List(status, grade)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "리드 목록 조회에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"leads": leads, "total": len(leads)})
}

func (h *LeadHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	lead, err := h.svc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "리드를 찾을 수 없습니다"})
		return
	}

	logs, _ := h.svc.GetActivityLogs(uint(id))
	questions := h.svc.GetCallQuestions()

	c.JSON(http.StatusOK, gin.H{
		"lead":           lead,
		"activity_logs":  logs,
		"call_questions": questions,
	})
}

func (h *LeadHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	lead, err := h.svc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "리드를 찾을 수 없습니다"})
		return
	}

	if err := c.ShouldBindJSON(lead); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
		return
	}

	lead.ID = uint(id)
	if err := h.svc.Update(lead); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "리드 수정에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	var req struct {
		Status models.LeadStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "상태를 입력해주세요"})
		return
	}

	if err := h.svc.UpdateStatus(uint(id), req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "상태 변경에 실패했습니다"})
		return
	}

	actorID, _ := c.Get("user_id")
	if uid, ok := actorID.(uint); ok {
		h.svc.LogActivity(uint(id), "status_change", string(req.Status), uid)
	}

	c.JSON(http.StatusOK, gin.H{"message": "상태가 변경되었습니다"})
}

func (h *LeadHandler) RecalculateScore(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	lead, err := h.svc.RecalculateScore(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "점수 재계산에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) GenerateMessage(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	msg, err := h.svc.GenerateMessage(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "메시지 생성에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": msg})
}

func (h *LeadHandler) Dashboard(c *gin.Context) {
	stats := h.svc.GetDashboardStats()
	c.JSON(http.StatusOK, stats)
}
