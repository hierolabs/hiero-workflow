package service

import (
	"errors"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CommunicationService struct{}

func NewCommunicationService() *CommunicationService {
	return &CommunicationService{}
}

// Create — 응대 기록 추가
func (s *CommunicationService) Create(log models.CommunicationLog) (models.CommunicationLog, error) {
	log.Content = strings.TrimSpace(log.Content)
	if log.Content == "" {
		return log, ErrEmptyContent
	}

	if err := config.DB.Create(&log).Error; err != nil {
		return log, err
	}
	return log, nil
}

// ListByReservation — 예약별 응대 타임라인
func (s *CommunicationService) ListByReservation(reservationID uint) []models.CommunicationLog {
	var logs []models.CommunicationLog
	config.DB.Where("reservation_id = ?", reservationID).
		Order("created_at ASC").
		Find(&logs)
	return logs
}

// ListByProperty — 숙소별 응대 기록
func (s *CommunicationService) ListByProperty(propertyID uint, limit int) []models.CommunicationLog {
	if limit <= 0 {
		limit = 50
	}
	var logs []models.CommunicationLog
	config.DB.Where("property_id = ?", propertyID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs)
	return logs
}

// ListByReservationCode — 예약코드로 응대 기록 조회
func (s *CommunicationService) ListByReservationCode(code string) []models.CommunicationLog {
	var logs []models.CommunicationLog
	config.DB.Where("reservation_code = ?", code).
		Order("created_at ASC").
		Find(&logs)
	return logs
}

// ListRecent — 최근 응대 기록 (전체)
func (s *CommunicationService) ListRecent(limit int) []models.CommunicationLog {
	if limit <= 0 {
		limit = 50
	}
	var logs []models.CommunicationLog
	config.DB.Order("created_at DESC").Limit(limit).Find(&logs)
	return logs
}

// --- 시스템 자동 기록 ---

// LogSystemEvent — 시스템 이벤트 자동 기록
func (s *CommunicationService) LogSystemEvent(propertyID *uint, reservationID *uint, reservationCode, content string) {
	log := models.CommunicationLog{
		PropertyID:      propertyID,
		ReservationID:   reservationID,
		ReservationCode: reservationCode,
		CommType:        models.CommTypeSystem,
		Content:         content,
		Channel:         "system",
		AuthorName:      "시스템",
	}
	config.DB.Create(&log)
}

var ErrEmptyContent = errors.New("empty_content")
