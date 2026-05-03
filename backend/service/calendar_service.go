package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CalendarService struct{}

func NewCalendarService() *CalendarService {
	return &CalendarService{}
}

type DailySummary struct {
	TodayCheckins       int `json:"today_checkins"`
	TodayCheckouts      int `json:"today_checkouts"`
	CheckinCompleted    int `json:"checkin_completed"`
	CheckoutCompleted   int `json:"checkout_completed"`
	InHouse             int `json:"in_house"`
	Vacant              int `json:"vacant"`
	Closed              int `json:"closed"`
	TomorrowCheckins    int `json:"tomorrow_checkins"`
	TomorrowNeedConfirm int `json:"tomorrow_need_confirm"`
}

type CalendarPropertyRow struct {
	ID              uint   `json:"id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	HostexID        int64  `json:"hostex_id"`
	Region          string `json:"region"`
	RoomType        string `json:"room_type"`
	OperationStatus string `json:"operation_status"`
	TodayStatus     string `json:"today_status"`
}

type CalendarReservationBlock struct {
	ID              uint   `json:"id"`
	ReservationCode string `json:"reservation_code"`
	PropertyID      int64  `json:"property_id"`
	InternalPropID  *uint  `json:"internal_prop_id"`
	GuestName       string `json:"guest_name"`
	ChannelType     string `json:"channel_type"`
	ChannelName     string `json:"channel_name"`
	CheckInDate     string `json:"check_in_date"`
	CheckOutDate    string `json:"check_out_date"`
	Nights          int    `json:"nights"`
	TotalRate       int64  `json:"total_rate"`
	Status          string `json:"status"`
	StayStatus      string `json:"stay_status"`
	NeedsCleaning   bool   `json:"needs_cleaning"`
}

type CalendarData struct {
	Summary      DailySummary               `json:"summary"`
	Properties   []CalendarPropertyRow      `json:"properties"`
	Reservations []CalendarReservationBlock  `json:"reservations"`
}

func (s *CalendarService) GetDailySummary(dateStr string) (*DailySummary, error) {
	tomorrow := addDay(dateStr)
	summary := &DailySummary{}

	var v int64

	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND status != 'cancelled'", dateStr).Count(&v)
	summary.TodayCheckins = int(v)

	config.DB.Model(&models.Reservation{}).
		Where("check_out_date = ? AND status != 'cancelled'", dateStr).Count(&v)
	summary.TodayCheckouts = int(v)

	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND stay_status = 'in_house' AND status != 'cancelled'", dateStr).Count(&v)
	summary.CheckinCompleted = int(v)

	config.DB.Model(&models.Reservation{}).
		Where("check_out_date = ? AND stay_status = 'completed' AND status != 'cancelled'", dateStr).Count(&v)
	summary.CheckoutCompleted = int(v)

	config.DB.Model(&models.Reservation{}).
		Where("check_in_date <= ? AND check_out_date > ? AND status != 'cancelled'", dateStr, dateStr).Count(&v)
	summary.InHouse = int(v)

	var totalProps int64
	config.DB.Model(&models.Property{}).Where("status = ?", models.PropertyStatusActive).Count(&totalProps)

	var closedProps int64
	config.DB.Model(&models.Property{}).
		Where("status = ? OR operation_status IN ('maintenance','blocked')", models.PropertyStatusClosed).Count(&closedProps)
	summary.Closed = int(closedProps)

	summary.Vacant = int(totalProps) - summary.InHouse - summary.Closed
	if summary.Vacant < 0 {
		summary.Vacant = 0
	}

	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND status != 'cancelled'", tomorrow).Count(&v)
	summary.TomorrowCheckins = int(v)

	config.DB.Model(&models.Reservation{}).
		Where("check_in_date = ? AND (stay_status IS NULL OR stay_status = '' OR stay_status = 'pending') AND status != 'cancelled'", tomorrow).Count(&v)
	summary.TomorrowNeedConfirm = int(v)

	return summary, nil
}

func (s *CalendarService) GetCalendarData(startDate, endDate, dateStr string) (*CalendarData, error) {
	summary, err := s.GetDailySummary(dateStr)
	if err != nil {
		return nil, err
	}

	var properties []models.Property
	config.DB.Where("status IN ('active','paused')").Order("display_order ASC, name ASC").Find(&properties)

	// Batch compute today status for all properties
	todayStatusMap := batchCalcTodayStatus(properties, dateStr)

	propertyRows := make([]CalendarPropertyRow, len(properties))
	for i, p := range properties {
		propertyRows[i] = CalendarPropertyRow{
			ID:              p.ID,
			Code:            p.Code,
			Name:            p.Name,
			HostexID:        p.HostexID,
			Region:          p.Region,
			RoomType:        p.RoomType,
			OperationStatus: p.OperationStatus,
			TodayStatus:     todayStatusMap[p.ID],
		}
	}

	var reservations []models.Reservation
	config.DB.Where(
		"check_in_date <= ? AND check_out_date >= ? AND status != 'cancelled'",
		endDate, startDate,
	).Order("check_in_date ASC").Find(&reservations)

	// Batch fetch cleaning tasks for all reservations
	var cleaningTasks []models.CleaningTask
	config.DB.Where("cleaning_date >= ? AND cleaning_date <= ? AND status IN ('pending','assigned','in_progress')", startDate, endDate).Find(&cleaningTasks)
	cleaningSet := make(map[string]bool)
	for _, ct := range cleaningTasks {
		cleaningSet[ct.ReservationCode+"|"+ct.CleaningDate] = true
	}

	blocks := make([]CalendarReservationBlock, len(reservations))
	for i, r := range reservations {
		needsCleaning := cleaningSet[r.ReservationCode+"|"+r.CheckOutDate]

		blocks[i] = CalendarReservationBlock{
			ID:              r.ID,
			ReservationCode: r.ReservationCode,
			PropertyID:      r.PropertyID,
			InternalPropID:  r.InternalPropID,
			GuestName:       r.GuestName,
			ChannelType:     r.ChannelType,
			ChannelName:     r.ChannelName,
			CheckInDate:     r.CheckInDate,
			CheckOutDate:    r.CheckOutDate,
			Nights:          r.Nights,
			TotalRate:       r.TotalRate,
			Status:          r.Status,
			StayStatus:      r.StayStatus,
			NeedsCleaning:   needsCleaning,
		}
	}

	return &CalendarData{
		Summary:      *summary,
		Properties:   propertyRows,
		Reservations: blocks,
	}, nil
}

func batchCalcTodayStatus(properties []models.Property, dateStr string) map[uint]string {
	result := make(map[uint]string)
	propIDs := make([]uint, len(properties))
	propMap := make(map[uint]*models.Property)
	for i, p := range properties {
		propIDs[i] = p.ID
		pp := properties[i]
		propMap[p.ID] = &pp
		result[p.ID] = "vacant" // default
	}

	// Mark closed/maintenance
	for _, p := range properties {
		if p.OperationStatus == "maintenance" || p.OperationStatus == "blocked" || p.Status == models.PropertyStatusClosed {
			result[p.ID] = "closed"
		}
	}

	// Batch: all reservations involving these properties on this date
	var todayReservations []struct {
		InternalPropID uint   `gorm:"column:internal_prop_id"`
		CheckInDate    string `gorm:"column:check_in_date"`
		CheckOutDate   string `gorm:"column:check_out_date"`
	}
	config.DB.Model(&models.Reservation{}).
		Select("internal_prop_id, check_in_date, check_out_date").
		Where("internal_prop_id IN ? AND check_in_date <= ? AND check_out_date >= ? AND status != 'cancelled'",
			propIDs, dateStr, dateStr).
		Find(&todayReservations)

	for _, r := range todayReservations {
		if result[r.InternalPropID] == "closed" {
			continue
		}
		if r.CheckOutDate == dateStr {
			result[r.InternalPropID] = "checkout_today"
		} else if r.CheckInDate == dateStr {
			result[r.InternalPropID] = "checkin_today"
		} else if result[r.InternalPropID] == "vacant" {
			result[r.InternalPropID] = "in_house"
		}
	}

	return result
}

func calcTodayStatus(p models.Property, dateStr string) string {
	if p.OperationStatus == "maintenance" || p.OperationStatus == "blocked" || p.Status == models.PropertyStatusClosed {
		return "closed"
	}

	var v int64

	config.DB.Model(&models.Reservation{}).
		Where("internal_prop_id = ? AND check_out_date = ? AND status != 'cancelled'", p.ID, dateStr).Count(&v)
	if v > 0 {
		return "checkout_today"
	}

	config.DB.Model(&models.Reservation{}).
		Where("internal_prop_id = ? AND check_in_date = ? AND status != 'cancelled'", p.ID, dateStr).Count(&v)
	if v > 0 {
		return "checkin_today"
	}

	config.DB.Model(&models.Reservation{}).
		Where("internal_prop_id = ? AND check_in_date <= ? AND check_out_date > ? AND status != 'cancelled'", p.ID, dateStr, dateStr).Count(&v)
	if v > 0 {
		return "in_house"
	}

	return "vacant"
}

func addDay(dateStr string) string {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return dateStr
	}
	return t.AddDate(0, 0, 1).Format("2006-01-02")
}
