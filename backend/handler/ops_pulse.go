package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type OpsPulseHandler struct {
	svc *service.OpsPulseService
}

func NewOpsPulseHandler() *OpsPulseHandler {
	return &OpsPulseHandler{svc: service.NewOpsPulseService()}
}

// GET /admin/ops/pulse — 업무 도메인별 할당량 + 진행률
func (h *OpsPulseHandler) Pulse(c *gin.Context) {
	result := h.svc.GetPulse()
	c.JSON(http.StatusOK, result)
}
