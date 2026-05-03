package service

import (
	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type GuestRequestService struct{}

func NewGuestRequestService() *GuestRequestService {
	return &GuestRequestService{}
}

// Create — 게스트 요청 생성
func (s *GuestRequestService) Create(req models.GuestRequest) (models.GuestRequest, error) {
	err := config.DB.Create(&req).Error
	return req, err
}

// ListByConversation — 대화별 요청 목록
func (s *GuestRequestService) ListByConversation(conversationID string) []models.GuestRequest {
	var reqs []models.GuestRequest
	config.DB.Where("conversation_id = ?", conversationID).Order("created_at DESC").Find(&reqs)
	return reqs
}

// ListByReservation — 예약별 요청 목록
func (s *GuestRequestService) ListByReservation(reservationCode string) []models.GuestRequest {
	var reqs []models.GuestRequest
	config.DB.Where("reservation_code = ?", reservationCode).Order("created_at DESC").Find(&reqs)
	return reqs
}

// ListPending — 미처리 요청 전체
func (s *GuestRequestService) ListPending() []models.GuestRequest {
	var reqs []models.GuestRequest
	config.DB.Where("status = ?", "pending").Order("created_at DESC").Find(&reqs)
	return reqs
}

// UpdateStatus — 요청 상태 변경
func (s *GuestRequestService) UpdateStatus(id uint, status string) error {
	return config.DB.Model(&models.GuestRequest{}).Where("id = ?", id).Update("status", status).Error
}
