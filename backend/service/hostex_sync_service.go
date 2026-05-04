package service

import (
	"fmt"
	"log"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/hostex"
	"hiero-workflow/backend/models"
)

type HostexSyncService struct {
	client *hostex.Client
}

func NewHostexSyncService() *HostexSyncService {
	return &HostexSyncService{
		client: hostex.NewClient(),
	}
}

// FetchReservationByCode — Hostex에서 예약 코드로 예약 조회
func (s *HostexSyncService) FetchReservationByCode(code string) ([]hostex.Reservation, error) {
	return s.client.GetReservations(map[string]string{
		"reservation_code": code,
		"limit":            "1",
	})
}

// FetchReservations — Hostex에서 예약 목록 조회
func (s *HostexSyncService) FetchReservations(params map[string]string) ([]hostex.Reservation, error) {
	return s.client.GetReservations(params)
}

// HostexPropertyMapping — Hostex 숙소와 내부 Property 매핑 정보
type HostexPropertyMapping struct {
	HostexID       int64  `json:"hostex_id"`
	HostexTitle    string `json:"hostex_title"`
	HostexAddress  string `json:"hostex_address"`
	InternalPropID *uint  `json:"internal_prop_id"`
	InternalCode   string `json:"internal_code"`
	InternalName   string `json:"internal_name"`
	Matched        bool   `json:"matched"`
}

// GetPropertyMappings — Hostex 숙소 목록과 내부 Property 매핑 상태 조회
func (s *HostexSyncService) GetPropertyMappings() ([]HostexPropertyMapping, error) {
	hostexProps, err := s.client.GetAllProperties()
	if err != nil {
		return nil, err
	}

	// 내부 Property의 hostex_id 매핑 조회
	var internalProps []models.Property
	config.DB.Find(&internalProps)

	hostexMap := map[int64]models.Property{}
	for _, p := range internalProps {
		if p.HostexID > 0 {
			hostexMap[p.HostexID] = p
		}
	}

	var mappings []HostexPropertyMapping
	for _, hp := range hostexProps {
		mapping := HostexPropertyMapping{
			HostexID:      hp.ID,
			HostexTitle:   hp.Title,
			HostexAddress: hp.Address,
		}

		if internal, ok := hostexMap[hp.ID]; ok {
			mapping.InternalPropID = &internal.ID
			mapping.InternalCode = internal.Code
			mapping.InternalName = internal.Name
			mapping.Matched = true
		}

		mappings = append(mappings, mapping)
	}

	return mappings, nil
}

// LinkProperty — Hostex 숙소 ID를 내부 Property에 연결
func (s *HostexSyncService) LinkProperty(internalPropID uint, hostexID int64) error {
	// 기존에 같은 hostex_id를 가진 Property가 있으면 해제
	config.DB.Model(&models.Property{}).
		Where("hostex_id = ? AND id != ?", hostexID, internalPropID).
		Update("hostex_id", 0)

	// 연결
	result := config.DB.Model(&models.Property{}).
		Where("id = ?", internalPropID).
		Update("hostex_id", hostexID)

	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	log.Printf("[HostexSync] Property %d ↔ Hostex %d 연결", internalPropID, hostexID)

	// 연결 후 해당 Hostex property의 예약들 재매칭
	config.DB.Model(&models.Reservation{}).
		Where("property_id = ? AND internal_prop_id IS NULL", hostexID).
		Update("internal_prop_id", internalPropID)

	return nil
}

// UnlinkProperty — 내부 Property에서 Hostex 연결 해제
func (s *HostexSyncService) UnlinkProperty(internalPropID uint) error {
	result := config.DB.Model(&models.Property{}).
		Where("id = ?", internalPropID).
		Update("hostex_id", 0)

	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	log.Printf("[HostexSync] Property %d Hostex 연결 해제", internalPropID)
	return nil
}

// GetUnmappedInternalProperties — Hostex 연결이 안 된 내부 Property 목록
func (s *HostexSyncService) GetUnmappedInternalProperties() []models.Property {
	var properties []models.Property
	config.DB.Where("hostex_id = 0 OR hostex_id IS NULL").Find(&properties)
	return properties
}

// ============================================================
// 전체 동기화: Hostex → 내부 DB
// ============================================================

// SyncAll — 숙소 + 예약 전체 동기화 (서버 시작 시, 수동 트리거 시)
func (s *HostexSyncService) SyncAll() error {
	log.Println("[HostexSync] === 전체 동기화 시작 ===")

	// 1. 숙소 동기화
	propCount, err := s.SyncProperties()
	if err != nil {
		log.Printf("[HostexSync] 숙소 동기화 실패: %s", err)
	} else {
		log.Printf("[HostexSync] 숙소 동기화 완료: %d건 처리", propCount)
	}

	// 2. 예약 동기화
	resCount, err := s.SyncReservations()
	if err != nil {
		log.Printf("[HostexSync] 예약 동기화 실패: %s", err)
	} else {
		log.Printf("[HostexSync] 예약 동기화 완료: %d건 처리", resCount)
	}

	// 3. 미매칭 예약 재매칭
	resSvc := NewReservationService()
	matched := resSvc.RematchAllReservations()

	log.Printf("[HostexSync] === 전체 동기화 완료 (숙소: %d, 예약: %d, 재매칭: %d) ===",
		propCount, resCount, matched)

	return nil
}

// SyncProperties — Hostex 숙소를 내부 Property DB로 동기화
// 이미 있으면 업데이트, 없으면 신규 생성
func (s *HostexSyncService) SyncProperties() (int, error) {
	hostexProps, err := s.client.GetAllProperties()
	if err != nil {
		return 0, err
	}

	processed := 0
	for _, hp := range hostexProps {
		var existing models.Property
		err := config.DB.Where("hostex_id = ?", hp.ID).First(&existing).Error

		if err != nil {
			// 신규 생성 — Hostex 숙소를 내부 Property로 자동 등록
			code := generatePropertyCode(hp.Title, hp.ID)

			// 체크인/체크아웃 시간
			checkIn := hp.DefaultCheckinTime
			if checkIn == "" {
				checkIn = "15:00"
			}
			checkOut := hp.DefaultCheckoutTime
			if checkOut == "" {
				checkOut = "11:00"
			}

			newProp := models.Property{
				HostexID:        hp.ID,
				Code:            code,
				Name:            hp.Title,
				Address:         hp.Address,
				PropertyType:    "apartment", // 기본값
				RoomType:        "entire",    // 기본값
				MaxGuests:       2,           // 기본값
				Bedrooms:        1,
				Beds:            1,
				Bathrooms:       1,
				Status:          models.PropertyStatusActive,
				OperationStatus: models.OperationStatusAvailable,
				CheckInTime:     checkIn,
				CheckOutTime:    checkOut,
			}

			config.DB.Create(&newProp)
			log.Printf("[HostexSync] 숙소 신규 생성: %s (hostex_id: %d, code: %s)", hp.Title, hp.ID, code)
		} else {
			// 기존 숙소 업데이트 — 이름, 주소만 Hostex에서 갱신
			updates := map[string]interface{}{}
			if hp.Title != "" && hp.Title != existing.Name {
				updates["name"] = hp.Title
			}
			if hp.Address != "" && hp.Address != existing.Address {
				updates["address"] = hp.Address
			}
			if hp.DefaultCheckinTime != "" && hp.DefaultCheckinTime != existing.CheckInTime {
				updates["check_in_time"] = hp.DefaultCheckinTime
			}
			if hp.DefaultCheckoutTime != "" && hp.DefaultCheckoutTime != existing.CheckOutTime {
				updates["check_out_time"] = hp.DefaultCheckoutTime
			}

			if len(updates) > 0 {
				config.DB.Model(&existing).Updates(updates)
				log.Printf("[HostexSync] 숙소 업데이트: %s (id: %d)", hp.Title, existing.ID)
			}
		}
		processed++
	}

	return processed, nil
}

// SyncReservations — Hostex 예약을 내부 Reservation DB로 동기화
// 과거 3일 ~ 미래 14일 (웹훅 누락분 보완 목적, 매시간 실행)
func (s *HostexSyncService) SyncReservations() (int, error) {
	pastStart := time.Now().Add(-3 * 24 * time.Hour).Format("2006-01-02")
	futureEnd := time.Now().Add(14 * 24 * time.Hour).Format("2006-01-02")
	return s.syncReservationRange(pastStart, futureEnd)
}

// SyncAllReservations — Hostex 예약 전체 동기화 (과거 2년 ~ 미래 90일)
func (s *HostexSyncService) SyncAllReservations() (int, error) {
	pastStart := time.Now().Add(-730 * 24 * time.Hour).Format("2006-01-02")
	futureEnd := time.Now().Add(90 * 24 * time.Hour).Format("2006-01-02")
	return s.syncReservationRange(pastStart, futureEnd)
}

// syncReservationRange — 지정 기간의 예약을 3개월 단위로 나눠서 동기화
func (s *HostexSyncService) syncReservationRange(startDate, endDate string) (int, error) {
	resSvc := NewReservationService()
	total := 0

	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)

	// 3개월(90일) 단위로 분할하여 API 호출 (대량 데이터 대응)
	chunkDays := 90
	for chunkStart := start; chunkStart.Before(end); chunkStart = chunkStart.Add(time.Duration(chunkDays) * 24 * time.Hour) {
		chunkEnd := chunkStart.Add(time.Duration(chunkDays) * 24 * time.Hour)
		if chunkEnd.After(end) {
			chunkEnd = end
		}

		log.Printf("[HostexSync] 예약 조회 구간: %s ~ %s", chunkStart.Format("2006-01-02"), chunkEnd.Format("2006-01-02"))

		offset := 0
		for {
			reservations, err := s.client.GetReservations(map[string]string{
				"start_check_in_date": chunkStart.Format("2006-01-02"),
				"end_check_in_date":   chunkEnd.Format("2006-01-02"),
				"limit":               "100",
				"offset":              fmt.Sprintf("%d", offset),
			})
			if err != nil {
				log.Printf("[HostexSync] 예약 조회 실패 (%s~%s): %s", chunkStart.Format("2006-01-02"), chunkEnd.Format("2006-01-02"), err)
				break
			}
			if len(reservations) == 0 {
				break
			}

			for _, r := range reservations {
				resSvc.UpsertFromHostex(r)
				total++
			}

			log.Printf("[HostexSync] %s~%s: %d건 처리 (누적 %d건)",
				chunkStart.Format("2006-01-02"), chunkEnd.Format("2006-01-02"), len(reservations), total)

			offset += len(reservations)
			if len(reservations) < 100 {
				break
			}
		}
	}

	return total, nil
}

// generatePropertyCode — Hostex 숙소 제목에서 코드 자동 생성
func generatePropertyCode(title string, hostexID int64) string {
	// 제목의 첫 글자들을 활용하거나, hostex ID 기반 코드
	title = strings.TrimSpace(title)
	if title == "" {
		return fmt.Sprintf("H%d", hostexID)
	}

	// 제목에서 숫자 부분 추출 시도
	parts := strings.Fields(title)
	if len(parts) >= 2 {
		// "아파트 1005" → "A-1005" 형태
		return fmt.Sprintf("H%d", hostexID)
	}

	return fmt.Sprintf("H%d", hostexID)
}
