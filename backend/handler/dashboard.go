package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	svc *service.DashboardService
}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{
		svc: service.NewDashboardService(),
	}
}

// GetCEODashboard — DB 기반 CEO 대시보드 (기간 필터 지원)
func (h *DashboardHandler) GetCEODashboard(c *gin.Context) {
	var query service.DashboardQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 파라미터: " + err.Error()})
		return
	}
	data, err := h.svc.GetCEODashboard(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대시보드 데이터 조회 실패: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}
