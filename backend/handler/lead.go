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

func (h *LeadHandler) SaveDiagnosis(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	var req struct {
		PropertyAddress string `json:"property_address"`
		PropertySize    string `json:"property_size"`
		PhotoURLs       string `json:"photo_urls"`
		DiagnosisNotes  string `json:"diagnosis_notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
		return
	}

	var actorID uint
	if uid, ok := c.Get("user_id"); ok {
		if u, ok := uid.(uint); ok {
			actorID = u
		}
	}

	if err := h.svc.SaveDiagnosis(uint(id), req.PropertyAddress, req.PropertySize, req.PhotoURLs, req.DiagnosisNotes, actorID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "진단 정보 저장에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "진단 정보가 저장되었습니다"})
}

func (h *LeadHandler) CalculateRevenue(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	var req struct {
		ADR              int64   `json:"adr" binding:"required"`
		OccupancyRate    float64 `json:"occupancy_rate" binding:"required"`
		MonthlyFixedCost int64   `json:"monthly_fixed_cost"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ADR과 가동률을 입력해주세요"})
		return
	}

	var actorID uint
	if uid, ok := c.Get("user_id"); ok {
		if u, ok := uid.(uint); ok {
			actorID = u
		}
	}

	result, err := h.svc.CalculateRevenue(uint(id), req.ADR, req.OccupancyRate, req.MonthlyFixedCost, actorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "매출 계산에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *LeadHandler) SaveProposal(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	var req struct {
		ProposalContent string `json:"proposal_content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "제안서 내용을 입력해주세요"})
		return
	}

	var actorID uint
	if uid, ok := c.Get("user_id"); ok {
		if u, ok := uid.(uint); ok {
			actorID = u
		}
	}

	if err := h.svc.SaveProposal(uint(id), req.ProposalContent, actorID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "제안서 저장에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "제안서가 저장되었습니다"})
}

func (h *LeadHandler) AddActivity(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID입니다"})
		return
	}

	var req struct {
		Action  string `json:"action" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "액션을 입력해주세요"})
		return
	}

	var actorID uint
	if uid, ok := c.Get("user_id"); ok {
		if u, ok := uid.(uint); ok {
			actorID = u
		}
	}

	if err := h.svc.LogActivity(uint(id), req.Action, req.Content, actorID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "활동 기록에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "활동이 기록되었습니다"})
}
