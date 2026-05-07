package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type FounderHandler struct {
	svc *service.FounderService
}

func NewFounderHandler() *FounderHandler {
	return &FounderHandler{svc: service.NewFounderService()}
}

// GET /admin/founder/daily-brief
func (h *FounderHandler) DailyBrief(c *gin.Context) {
	data := h.svc.GetDailyBrief()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/top-decisions
func (h *FounderHandler) TopDecisions(c *gin.Context) {
	data := h.svc.GetTopDecisions()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/etf-summary
func (h *FounderHandler) ETFSummary(c *gin.Context) {
	data := h.svc.GetETFSummary()
	c.JSON(http.StatusOK, data)
}
