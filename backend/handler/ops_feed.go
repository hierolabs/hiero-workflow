package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type OpsFeedHandler struct {
	svc *service.OpsFeedService
}

func NewOpsFeedHandler() *OpsFeedHandler {
	return &OpsFeedHandler{svc: service.NewOpsFeedService()}
}

// GET /admin/ops/feed — 오늘 운영 피드
func (h *OpsFeedHandler) Feed(c *gin.Context) {
	items := h.svc.GetTodayFeed()
	summary := h.svc.GetTodaySummary()
	c.JSON(http.StatusOK, gin.H{
		"feed":    items,
		"summary": summary,
	})
}
