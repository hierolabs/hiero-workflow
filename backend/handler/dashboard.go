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

// GetCEODashboard — DB 기반 CEO 대시보드 (Hostex API 미호출)
func (h *DashboardHandler) GetCEODashboard(c *gin.Context) {
	data, err := h.svc.GetCEODashboard()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대시보드 데이터 조회 실패: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}
