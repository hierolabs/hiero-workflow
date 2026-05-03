package handler

import (
	"net/http"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CommunicationHandler struct {
	svc *service.CommunicationService
}

func NewCommunicationHandler() *CommunicationHandler {
	return &CommunicationHandler{
		svc: service.NewCommunicationService(),
	}
}

// Create — 응대 기록 추가
func (h *CommunicationHandler) Create(c *gin.Context) {
	var log models.CommunicationLog
	if err := c.ShouldBindJSON(&log); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if log.CommType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유형(comm_type)은 필수입니다"})
		return
	}

	// 작성자 정보
	userID, _ := c.Get("user_id")
	if uid, ok := userID.(uint); ok {
		log.AuthorID = &uid
	}

	created, err := h.svc.Create(log)
	if err != nil {
		if err == service.ErrEmptyContent {
			c.JSON(http.StatusBadRequest, gin.H{"error": "내용은 필수입니다"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusCreated, created)
}

// ListByReservation — 예약별 응대 타임라인
func (h *CommunicationHandler) ListByReservation(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	logs := h.svc.ListByReservation(id)
	c.JSON(http.StatusOK, logs)
}

// ListByProperty — 숙소별 응대 기록
func (h *CommunicationHandler) ListByProperty(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	logs := h.svc.ListByProperty(id, 50)
	c.JSON(http.StatusOK, logs)
}

// ListRecent — 최근 응대 기록
func (h *CommunicationHandler) ListRecent(c *gin.Context) {
	logs := h.svc.ListRecent(50)
	c.JSON(http.StatusOK, logs)
}
