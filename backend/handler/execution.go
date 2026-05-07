package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ExecutionHandler struct {
	svc *service.ExecutionService
}

func NewExecutionHandler() *ExecutionHandler {
	return &ExecutionHandler{svc: service.NewExecutionService()}
}

// GET /admin/execution/:role — 실행팀 개인 대시보드
func (h *ExecutionHandler) Dashboard(c *gin.Context) {
	role := c.Param("role")

	validRoles := map[string]bool{
		"marketing": true, "operations": true,
		"cleaning": true, "field": true,
	}
	if !validRoles[role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 역할: " + role})
		return
	}

	// cleaning → cleaning_dispatch 매핑
	roleTitle := role
	if role == "cleaning" {
		roleTitle = "cleaning_dispatch"
	}

	data := h.svc.GetDashboard(roleTitle)
	c.JSON(http.StatusOK, data)
}
