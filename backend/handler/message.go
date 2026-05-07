package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type MessageHandler struct {
	msgSvc      *service.MessageService
	reqSvc      *service.GuestRequestService
	analysisSvc *service.MessageAnalysisService
	reviewSvc   *service.ReviewService
}

func NewMessageHandler() *MessageHandler {
	return &MessageHandler{
		msgSvc:      service.NewMessageService(),
		reqSvc:      service.NewGuestRequestService(),
		analysisSvc: service.NewMessageAnalysisService(),
		reviewSvc:   service.NewReviewService(),
	}
}

// ListConversations — 대화 목록
func (h *MessageHandler) ListConversations(c *gin.Context) {
	propertyID, _ := strconv.ParseInt(c.Query("property_id"), 10, 64)
	keyword := c.Query("keyword")
	hasUnread := c.Query("has_unread") == "true"
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "30"))

	convs, total, err := h.msgSvc.ListConversations(propertyID, keyword, hasUnread, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"conversations": convs,
		"total":         total,
		"page":          page,
		"page_size":     pageSize,
	})
}

// GetConversation — 대화 상세 + 메시지 + 요청
func (h *MessageHandler) GetConversation(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	conv, err := h.msgSvc.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "대화를 찾을 수 없습니다"})
		return
	}

	msgs, _ := h.msgSvc.GetMessages(conversationID)
	requests := h.reqSvc.ListByConversation(conversationID)

	// 읽음 처리
	h.msgSvc.MarkRead(conversationID)

	c.JSON(http.StatusOK, gin.H{
		"conversation": conv,
		"messages":     msgs,
		"requests":     requests,
	})
}

// SendMessage — 메시지 발송
func (h *MessageHandler) SendMessage(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	var body struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "메시지를 입력해주세요"})
		return
	}

	msg, err := h.msgSvc.SendMessage(conversationID, body.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "메시지 발송 실패: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": msg})
}

// MarkRead — 읽음 처리
func (h *MessageHandler) MarkRead(c *gin.Context) {
	conversationID := c.Param("conversation_id")
	h.msgSvc.MarkRead(conversationID)
	c.JSON(http.StatusOK, gin.H{"message": "읽음 처리 완료"})
}

// SyncMessages — 대화 + 메시지 동기화
func (h *MessageHandler) SyncMessages(c *gin.Context) {
	go func() {
		h.msgSvc.SyncConversationsWithMessages()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "대화 + 메시지 동기화 시작됨"})
}

// SyncAllMessages — 모든 대화의 메시지 전체 동기화
func (h *MessageHandler) SyncAllMessages(c *gin.Context) {
	go func() {
		h.msgSvc.SyncAllMessages()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "전체 메시지 동기화 시작됨 (백그라운드 진행 중)"})
}

// SyncConversationMessages — 특정 대화 메시지 동기화
func (h *MessageHandler) SyncConversationMessages(c *gin.Context) {
	conversationID := c.Param("conversation_id")
	count, err := h.msgSvc.SyncConversationMessages(conversationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "동기화 완료", "synced": count})
}

// CreateGuestRequest — 게스트 요청 생성
func (h *MessageHandler) CreateGuestRequest(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	var body struct {
		RequestType string `json:"request_type" binding:"required"`
		Note        string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 타입을 선택해주세요"})
		return
	}

	// 대화에서 예약/숙소 정보 가져오기
	conv, err := h.msgSvc.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "대화를 찾을 수 없습니다"})
		return
	}

	req := models.GuestRequest{
		ConversationID:  conversationID,
		ReservationCode: conv.ReservationCode,
		PropertyID:      conv.PropertyID,
		InternalPropID:  conv.InternalPropID,
		RequestType:     body.RequestType,
		Note:            body.Note,
		Status:          "pending",
	}

	created, err := h.reqSvc.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"request": created})
}

// UpdateGuestRequestStatus — 요청 상태 변경
func (h *MessageHandler) UpdateGuestRequestStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "상태를 입력해주세요"})
		return
	}

	if err := h.reqSvc.UpdateStatus(uint(id), body.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "상태 변경 완료"})
}

// ListPendingRequests — 미처리 요청 전체
func (h *MessageHandler) ListPendingRequests(c *gin.Context) {
	reqs := h.reqSvc.ListPending()
	c.JSON(http.StatusOK, gin.H{"requests": reqs})
}

// SyncReviews — 리뷰 동기화
func (h *MessageHandler) SyncReviews(c *gin.Context) {
	go func() {
		h.reviewSvc.SyncReviews()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "리뷰 동기화 시작됨"})
}

// AnalyzeMessages — 기간별 메시지+리뷰 이슈 분석 (day/week/month)
func (h *MessageHandler) AnalyzeMessages(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	result, err := h.analysisSvc.Analyze(period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
