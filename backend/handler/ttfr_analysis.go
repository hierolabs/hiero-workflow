package handler

import (
	"net/http"
	"time"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type TTFRAnalysisHandler struct {
	svc *service.TTFRAnalysisService
}

func NewTTFRAnalysisHandler() *TTFRAnalysisHandler {
	return &TTFRAnalysisHandler{svc: service.NewTTFRAnalysisService()}
}

// Analyze — GET /admin/analysis/ttfr?start=2024-01-01&end=2026-12-31
func (h *TTFRAnalysisHandler) Analyze(c *gin.Context) {
	start := c.DefaultQuery("start", "2024-01-01")
	end := c.DefaultQuery("end", time.Now().AddDate(0, 0, 1).Format("2006-01-02"))

	result, err := h.svc.Analyze(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
