package service

import (
	"log"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/hostex"
	"hiero-workflow/backend/models"
)

type ReservationService struct{}

func NewReservationService() *ReservationService {
	return &ReservationService{}
}

// UpsertFromHostex — Hostex 예약 데이터를 내부 DB에 저장/업데이트하고 Property 매칭
func (s *ReservationService) UpsertFromHostex(r hostex.Reservation) models.Reservation {
	channelName := r.ChannelType
	if r.CustomChannel != nil && r.CustomChannel.Name != "" {
		channelName = r.CustomChannel.Name
	}

	nights := 0
	if t1, err1 := time.Parse("2006-01-02", r.CheckInDate); err1 == nil {
		if t2, err2 := time.Parse("2006-01-02", r.CheckOutDate); err2 == nil {
			nights = int(t2.Sub(t1).Hours() / 24)
		}
	}

	var totalRate, totalCommission int64
	currency := "KRW"
	if r.Rates != nil {
		totalRate = r.Rates.TotalRate.Amount
		totalCommission = r.Rates.TotalCommission.Amount
		currency = r.Rates.TotalRate.Currency
	}

	// 내부 Property 매칭
	internalPropID := s.matchInternalProperty(r.PropertyID)

	dbReservation := models.Reservation{
		ReservationCode: r.ReservationCode,
		StayCode:        r.ReservationCode,
		PropertyID:      r.PropertyID,
		InternalPropID:  internalPropID,
		ChannelType:     r.ChannelType,
		ChannelName:     channelName,
		ListingID:       r.ListingID,
		CheckInDate:     r.CheckInDate,
		CheckOutDate:    r.CheckOutDate,
		Nights:          nights,
		NumberOfGuests:  r.NumberOfGuests,
		Status:          r.Status,
		StayStatus:      r.StayStatus,
		GuestName:       r.GuestName,
		GuestPhone:      r.GuestPhone,
		GuestEmail:      r.GuestEmail,
		TotalRate:       totalRate,
		TotalCommission: totalCommission,
		Currency:        currency,
		BookedAt:        r.BookedAt,
		CancelledAt:     r.CancelledAt,
		Remarks:         r.Remarks,
		ConversationID:  r.ConversationID,
	}

	var existing models.Reservation
	if err := config.DB.Where("reservation_code = ?", r.ReservationCode).First(&existing).Error; err != nil {
		config.DB.Create(&dbReservation)
	} else {
		dbReservation.ID = existing.ID
		config.DB.Model(&existing).Updates(dbReservation)
	}

	return dbReservation
}

// CancelReservation — 예약 취소 처리
func (s *ReservationService) CancelReservation(reservationCode string) {
	if reservationCode == "" {
		return
	}

	now := time.Now().Format("2006-01-02T15:04:05Z")
	result := config.DB.Model(&models.Reservation{}).
		Where("reservation_code = ?", reservationCode).
		Updates(map[string]interface{}{
			"status":       "cancelled",
			"cancelled_at": &now,
		})

	if result.RowsAffected > 0 {
		log.Printf("[Reservation] 예약 취소 완료: %s", reservationCode)
	} else {
		log.Printf("[Reservation] 취소할 예약 없음: %s", reservationCode)
	}
}

// matchInternalProperty — Hostex property ID로 내부 Property 찾기
func (s *ReservationService) matchInternalProperty(hostexPropertyID int64) *uint {
	if hostexPropertyID == 0 {
		return nil
	}

	var property models.Property
	if err := config.DB.Where("hostex_id = ?", hostexPropertyID).First(&property).Error; err != nil {
		return nil
	}

	return &property.ID
}

// RematchAllReservations — 매핑되지 않은 예약들의 내부 Property 재매칭
func (s *ReservationService) RematchAllReservations() int {
	var unmatched []models.Reservation
	config.DB.Where("internal_prop_id IS NULL AND property_id > 0").Find(&unmatched)

	matched := 0
	for _, r := range unmatched {
		propID := s.matchInternalProperty(r.PropertyID)
		if propID != nil {
			config.DB.Model(&r).Update("internal_prop_id", propID)
			matched++
		}
	}

	log.Printf("[Reservation] 재매칭 완료: %d/%d건", matched, len(unmatched))
	return matched
}

// List — 예약 목록 조회 (어드민용)
func (s *ReservationService) List(query ReservationListQuery) (ReservationListResult, error) {
	query.Normalize()

	db := config.DB.Model(&models.Reservation{})

	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.ChannelType != "" {
		db = db.Where("channel_type = ?", query.ChannelType)
	}
	if query.InternalPropID > 0 {
		db = db.Where("internal_prop_id = ?", query.InternalPropID)
	}
	if query.HostexPropertyID > 0 {
		db = db.Where("property_id = ?", query.HostexPropertyID)
	}
	if query.CheckInFrom != "" {
		db = db.Where("check_in_date >= ?", query.CheckInFrom)
	}
	if query.CheckInTo != "" {
		db = db.Where("check_in_date <= ?", query.CheckInTo)
	}
	if query.CheckOutFrom != "" {
		db = db.Where("check_out_date >= ?", query.CheckOutFrom)
	}
	if query.CheckOutTo != "" {
		db = db.Where("check_out_date <= ?", query.CheckOutTo)
	}
	if query.Keyword != "" {
		kw := "%" + strings.TrimSpace(query.Keyword) + "%"
		db = db.Where("guest_name LIKE ? OR reservation_code LIKE ?", kw, kw)
	}
	if query.UnmatchedOnly {
		db = db.Where("internal_prop_id IS NULL")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return ReservationListResult{}, err
	}

	var reservations []models.Reservation
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("check_in_date DESC, created_at DESC").
		Offset(offset).Limit(query.PageSize).
		Find(&reservations).Error; err != nil {
		return ReservationListResult{}, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return ReservationListResult{
		Reservations: reservations,
		Total:        total,
		Page:         query.Page,
		PageSize:     query.PageSize,
		TotalPages:   totalPages,
	}, nil
}

// GetByID — 예약 상세 조회
func (s *ReservationService) GetByID(id uint) (models.Reservation, error) {
	var reservation models.Reservation
	if err := config.DB.First(&reservation, id).Error; err != nil {
		return reservation, ErrNotFound
	}
	return reservation, nil
}

// RevenueSummary — 기간별 매출 집계
func (s *ReservationService) RevenueSummary(query RevenueSummaryQuery) (RevenueSummaryResult, error) {
	query.Normalize()

	db := config.DB.Model(&models.Reservation{}).
		Where("status = ?", "accepted")

	if query.StartDate != "" {
		db = db.Where("check_in_date >= ?", query.StartDate)
	}
	if query.EndDate != "" {
		db = db.Where("check_in_date <= ?", query.EndDate)
	}

	var reservations []models.Reservation
	if err := db.Order("check_in_date ASC").Find(&reservations).Error; err != nil {
		return RevenueSummaryResult{}, err
	}

	// 전체 합산
	var totalRevenue, totalCommission int64
	var totalNights, totalBookings int
	channelMap := map[string]*ChannelRevenue{}

	// 일별 집계 맵
	dailyMap := map[string]*PeriodRevenue{}

	for _, r := range reservations {
		totalRevenue += r.TotalRate
		totalCommission += r.TotalCommission
		totalNights += r.Nights
		totalBookings++

		// 채널별
		ch := r.ChannelName
		if ch == "" {
			ch = r.ChannelType
		}
		if ch == "" {
			ch = "기타"
		}
		if _, ok := channelMap[ch]; !ok {
			channelMap[ch] = &ChannelRevenue{Channel: ch}
		}
		channelMap[ch].Revenue += r.TotalRate
		channelMap[ch].Commission += r.TotalCommission
		channelMap[ch].Bookings++
		channelMap[ch].Nights += r.Nights

		// 일별
		dateKey := r.CheckInDate
		if len(dateKey) < 10 {
			continue
		}
		dateKey = dateKey[:10]

		if query.GroupBy == "week" {
			if t, err := time.Parse("2006-01-02", dateKey); err == nil {
				// 주 시작일 (월요일)
				weekday := int(t.Weekday())
				if weekday == 0 {
					weekday = 7
				}
				monday := t.AddDate(0, 0, -(weekday - 1))
				dateKey = monday.Format("2006-01-02")
			}
		} else if query.GroupBy == "month" {
			dateKey = dateKey[:7] // "2026-05"
		}

		if _, ok := dailyMap[dateKey]; !ok {
			dailyMap[dateKey] = &PeriodRevenue{Period: dateKey}
		}
		dailyMap[dateKey].Revenue += r.TotalRate
		dailyMap[dateKey].Commission += r.TotalCommission
		dailyMap[dateKey].Net += r.TotalRate - r.TotalCommission
		dailyMap[dateKey].Bookings++
		dailyMap[dateKey].Nights += r.Nights
	}

	// 맵 → 정렬된 슬라이스
	periods := make([]PeriodRevenue, 0, len(dailyMap))
	for _, v := range dailyMap {
		if v.Nights > 0 {
			v.ADR = v.Revenue / int64(v.Nights)
		}
		periods = append(periods, *v)
	}
	// 날짜 순 정렬
	for i := 0; i < len(periods); i++ {
		for j := i + 1; j < len(periods); j++ {
			if periods[j].Period < periods[i].Period {
				periods[i], periods[j] = periods[j], periods[i]
			}
		}
	}

	channels := make([]ChannelRevenue, 0, len(channelMap))
	for _, v := range channelMap {
		if v.Nights > 0 {
			v.ADR = v.Revenue / int64(v.Nights)
		}
		v.Net = v.Revenue - v.Commission
		if totalRevenue > 0 {
			v.Share = float64(v.Revenue) / float64(totalRevenue) * 100
		}
		channels = append(channels, *v)
	}
	// 매출 순 정렬
	for i := 0; i < len(channels); i++ {
		for j := i + 1; j < len(channels); j++ {
			if channels[j].Revenue > channels[i].Revenue {
				channels[i], channels[j] = channels[j], channels[i]
			}
		}
	}

	avgADR := int64(0)
	if totalNights > 0 {
		avgADR = totalRevenue / int64(totalNights)
	}

	return RevenueSummaryResult{
		StartDate:       query.StartDate,
		EndDate:         query.EndDate,
		GroupBy:         query.GroupBy,
		TotalRevenue:    totalRevenue,
		TotalCommission: totalCommission,
		TotalNet:        totalRevenue - totalCommission,
		TotalBookings:   totalBookings,
		TotalNights:     totalNights,
		AvgADR:          avgADR,
		Periods:         periods,
		Channels:        channels,
	}, nil
}

// --- Query/Result types ---

type ReservationListQuery struct {
	Page            int    `form:"page"`
	PageSize        int    `form:"page_size"`
	Status          string `form:"status"`
	ChannelType     string `form:"channel_type"`
	InternalPropID  uint   `form:"internal_prop_id"`
	HostexPropertyID int64 `form:"property_id"`
	CheckInFrom     string `form:"check_in_from"`
	CheckInTo       string `form:"check_in_to"`
	CheckOutFrom    string `form:"check_out_from"`
	CheckOutTo      string `form:"check_out_to"`
	Keyword         string `form:"keyword"`
	UnmatchedOnly   bool   `form:"unmatched_only"`
}

func (q *ReservationListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 20
	}
}

type ReservationListResult struct {
	Reservations []models.Reservation `json:"reservations"`
	Total        int64                `json:"total"`
	Page         int                  `json:"page"`
	PageSize     int                  `json:"page_size"`
	TotalPages   int                  `json:"total_pages"`
}

// --- Revenue Summary types ---

type RevenueSummaryQuery struct {
	StartDate string `form:"start_date"` // 2026-01-01
	EndDate   string `form:"end_date"`   // 2026-05-31
	GroupBy   string `form:"group_by"`   // day, week, month
}

func (q *RevenueSummaryQuery) Normalize() {
	if q.GroupBy == "" {
		q.GroupBy = "day"
	}
	if q.StartDate == "" {
		q.StartDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if q.EndDate == "" {
		q.EndDate = time.Now().Format("2006-01-02")
	}
}

type PeriodRevenue struct {
	Period     string `json:"period"`
	Revenue    int64  `json:"revenue"`
	Commission int64  `json:"commission"`
	Net        int64  `json:"net"`
	Bookings   int    `json:"bookings"`
	Nights     int    `json:"nights"`
	ADR        int64  `json:"adr"`
}

type ChannelRevenue struct {
	Channel    string  `json:"channel"`
	Revenue    int64   `json:"revenue"`
	Commission int64   `json:"commission"`
	Net        int64   `json:"net"`
	Bookings   int     `json:"bookings"`
	Nights     int     `json:"nights"`
	ADR        int64   `json:"adr"`
	Share      float64 `json:"share"`
}

type RevenueSummaryResult struct {
	StartDate       string           `json:"start_date"`
	EndDate         string           `json:"end_date"`
	GroupBy         string           `json:"group_by"`
	TotalRevenue    int64            `json:"total_revenue"`
	TotalCommission int64            `json:"total_commission"`
	TotalNet        int64            `json:"total_net"`
	TotalBookings   int              `json:"total_bookings"`
	TotalNights     int              `json:"total_nights"`
	AvgADR          int64            `json:"avg_adr"`
	Periods         []PeriodRevenue  `json:"periods"`
	Channels        []ChannelRevenue `json:"channels"`
}
