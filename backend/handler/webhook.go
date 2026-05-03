package handler

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	reservationSvc *service.ReservationService
	hostexSvc      *service.HostexSyncService
	messageSvc     *service.MessageService
	reviewSvc      *service.ReviewService
}

func NewWebhookHandler() *WebhookHandler {
	return &WebhookHandler{
		reservationSvc: service.NewReservationService(),
		hostexSvc:      service.NewHostexSyncService(),
		messageSvc:     service.NewMessageService(),
		reviewSvc:      service.NewReviewService(),
	}
}

type WebhookPayload struct {
	Event           string `json:"event"`
	ReservationCode string `json:"reservation_code"`
	StayCode        string `json:"stay_code"`
	PropertyID      int64  `json:"property_id"`
	Timestamp       string `json:"timestamp"`
	SubEvent        string `json:"sub_event"`
}

// HandleHostex — 호스텍스 웹훅 수신 (3초 내 200 응답 필수)
func (h *WebhookHandler) HandleHostex(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)

	go h.processWebhook(body)
}

func (h *WebhookHandler) processWebhook(body []byte) {
	var payload WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("[Webhook] 파싱 실패: %s", err)
		return
	}

	log.Printf("[Webhook] 수신: %s (reservation: %s, property: %d)",
		payload.Event, payload.ReservationCode, payload.PropertyID)

	// 웹훅 로그 저장
	webhookLog := models.WebhookLog{
		Event:           payload.Event,
		ReservationCode: payload.ReservationCode,
		PropertyID:      payload.PropertyID,
		Payload:         string(body),
		ProcessedAt:     time.Now(),
	}
	config.DB.Create(&webhookLog)

	// 이벤트별 처리
	switch payload.Event {
	case "reservation_created":
		h.syncReservation(payload.ReservationCode)
		log.Printf("[Webhook] 신규 예약 처리 완료: %s", payload.ReservationCode)

	case "reservation_updated":
		h.syncReservation(payload.ReservationCode)
		log.Printf("[Webhook] 예약 변경 처리 완료: %s", payload.ReservationCode)

	case "reservation_cancelled":
		h.reservationSvc.CancelReservation(payload.ReservationCode)

	case "property_availability_updated":
		log.Printf("[Webhook] 가용성 변경: property %d", payload.PropertyID)

	case "message_created":
		log.Printf("[Webhook] 새 메시지 수신: reservation %s", payload.ReservationCode)
		go h.messageSvc.HandleIncomingMessage(payload.ReservationCode)

	case "review_created", "review_updated":
		log.Printf("[Webhook] 리뷰 이벤트: %s", payload.ReservationCode)
		go h.syncReview(payload.ReservationCode)

	default:
		log.Printf("[Webhook] 미처리 이벤트: %s", payload.Event)
	}
}

// syncReservation — Hostex API로 예약 조회 후 DB 저장
func (h *WebhookHandler) syncReservation(reservationCode string) {
	if reservationCode == "" {
		return
	}

	reservations, err := h.hostexSvc.FetchReservationByCode(reservationCode)
	if err != nil {
		log.Printf("[Webhook] 예약 조회 실패 (%s): %s", reservationCode, err)
		return
	}
	if len(reservations) == 0 {
		log.Printf("[Webhook] 예약 없음: %s", reservationCode)
		return
	}

	r := reservations[0]
	saved := h.reservationSvc.UpsertFromHostex(r)
	log.Printf("[Webhook] 예약 저장 완료: %s (guest: %s, %s~%s, internal_prop: %v)",
		r.ReservationCode, r.GuestName, r.CheckInDate, r.CheckOutDate, saved.InternalPropID)
}

// syncReview — 리뷰 웹훅 처리
func (h *WebhookHandler) syncReview(reservationCode string) {
	if reservationCode == "" {
		return
	}
	h.reviewSvc.SyncSingleReview(reservationCode)
}

// GetLogs — 웹훅 로그 조회 (어드민용)
func (h *WebhookHandler) GetLogs(c *gin.Context) {
	var logs []models.WebhookLog
	config.DB.Order("created_at DESC").Limit(100).Find(&logs)
	c.JSON(http.StatusOK, logs)
}

// InitialSync — Hostex 전체 동기화 (숙소 + 예약)
func (h *WebhookHandler) InitialSync(c *gin.Context) {
	go h.hostexSvc.SyncAll()
	c.JSON(http.StatusOK, gin.H{"message": "전체 동기화를 시작합니다 (숙소 + 예약). 로그를 확인하세요."})
}
