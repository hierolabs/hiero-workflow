package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CSAgentHandler struct {
	svc *service.CSAgentService
}

func NewCSAgentHandler() *CSAgentHandler {
	return &CSAgentHandler{svc: service.NewCSAgentService()}
}

// POST /admin/cs-agent/suggest — 게스트 메시지 분석 + 응답 제안
func (h *CSAgentHandler) Suggest(c *gin.Context) {
	var body struct {
		Message   string `json:"message" binding:"required"`
		GuestName string `json:"guest_name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "메시지를 입력해주세요"})
		return
	}

	result := h.svc.AnalyzeAndSuggest(body.Message, body.GuestName)
	c.JSON(http.StatusOK, result)
}
