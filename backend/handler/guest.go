package handler

import (
	"net/http"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type GuestHandler struct{}

func NewGuestHandler() *GuestHandler { return &GuestHandler{} }

// GuestSummary — 게스트별 집계 결과
type GuestSummary struct {
	GuestName      string `json:"guest_name"`
	GuestPhone     string `json:"guest_phone"`
	GuestEmail     string `json:"guest_email"`
	TotalVisits    int    `json:"total_visits"`
	TotalNights    int    `json:"total_nights"`
	TotalSpent     int64  `json:"total_spent"`
	FirstVisit     string `json:"first_visit"`
	LastVisit      string `json:"last_visit"`
	LastProperty   string `json:"last_property"`
	Channels       string `json:"channels"`
	Properties     string `json:"properties"`
	AvgNights      float64 `json:"avg_nights"`
	Status         string `json:"status"` // active / completed / cancelled
}

// List — 전체 게스트 리스트 (예약 데이터 기반 집계)
func (h *GuestHandler) List(c *gin.Context) {
	db := config.DB

	search := c.Query("search")
	channel := c.Query("channel")
	dateFrom := c.Query("from")
	dateTo := c.Query("to")
	sortBy := c.DefaultQuery("sort", "last_visit")
	order := c.DefaultQuery("order", "desc")

	// 유효한 정렬 필드만 허용
	validSorts := map[string]string{
		"last_visit":   "MAX(r.check_in_date)",
		"total_visits": "COUNT(*)",
		"total_spent":  "SUM(r.total_rate)",
		"total_nights": "SUM(r.nights)",
		"guest_name":   "r.guest_name",
	}
	sortExpr, ok := validSorts[sortBy]
	if !ok {
		sortExpr = "MAX(r.check_in_date)"
	}
	if order != "asc" {
		order = "desc"
	}

	// 기본 쿼리: 게스트 이름 기준 그룹핑
	query := db.Table("reservations r").
		Select(`
			r.guest_name,
			MAX(r.guest_phone) as guest_phone,
			MAX(r.guest_email) as guest_email,
			COUNT(*) as total_visits,
			SUM(r.nights) as total_nights,
			SUM(r.total_rate) as total_spent,
			MIN(r.check_in_date) as first_visit,
			MAX(r.check_in_date) as last_visit,
			GROUP_CONCAT(DISTINCT r.channel_name ORDER BY r.channel_name SEPARATOR ', ') as channels,
			GROUP_CONCAT(DISTINCT COALESCE(p.name, '') ORDER BY p.name SEPARATOR ', ') as properties
		`).
		Joins("LEFT JOIN properties p ON r.internal_prop_id = p.id").
		Where("r.guest_name != '' AND r.status != 'cancelled'").
		Group("r.guest_name")

	if dateFrom != "" {
		query = query.Where("r.check_in_date >= ?", dateFrom)
	}
	if dateTo != "" {
		query = query.Where("r.check_in_date <= ?", dateTo)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("r.guest_name LIKE ? OR r.guest_phone LIKE ? OR r.guest_email LIKE ?", like, like, like)
	}
	if channel != "" {
		query = query.Where("r.channel_name = ?", channel)
	}

	query = query.Order(sortExpr + " " + order)

	var results []struct {
		GuestName  string `json:"guest_name"`
		GuestPhone string `json:"guest_phone"`
		GuestEmail string `json:"guest_email"`
		TotalVisits int   `json:"total_visits"`
		TotalNights int   `json:"total_nights"`
		TotalSpent int64  `json:"total_spent"`
		FirstVisit string `json:"first_visit"`
		LastVisit  string `json:"last_visit"`
		Channels   string `json:"channels"`
		Properties string `json:"properties"`
	}

	if err := query.Find(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 응답 가공
	guests := make([]GuestSummary, 0, len(results))
	for _, r := range results {
		avgNights := float64(0)
		if r.TotalVisits > 0 {
			avgNights = float64(r.TotalNights) / float64(r.TotalVisits)
		}

		// 마지막 숙소 이름 추출
		lastProp := ""
		if r.Properties != "" {
			parts := strings.Split(r.Properties, ", ")
			lastProp = parts[len(parts)-1]
		}

		guests = append(guests, GuestSummary{
			GuestName:   r.GuestName,
			GuestPhone:  r.GuestPhone,
			GuestEmail:  r.GuestEmail,
			TotalVisits: r.TotalVisits,
			TotalNights: r.TotalNights,
			TotalSpent:  r.TotalSpent,
			FirstVisit:  r.FirstVisit,
			LastVisit:   r.LastVisit,
			LastProperty: lastProp,
			Channels:    r.Channels,
			Properties:  r.Properties,
			AvgNights:   avgNights,
		})
	}

	// 채널 목록 (필터용)
	var channelList []string
	db.Model(&models.Reservation{}).
		Where("channel_name != '' AND status != 'cancelled'").
		Distinct("channel_name").
		Pluck("channel_name", &channelList)

	// 전체 통계
	var totalGuests int64
	var totalReservations int64
	var totalRevenue int64
	db.Model(&models.Reservation{}).Where("guest_name != '' AND status != 'cancelled'").
		Select("COUNT(DISTINCT guest_name)").Scan(&totalGuests)
	db.Model(&models.Reservation{}).Where("guest_name != '' AND status != 'cancelled'").
		Count(&totalReservations)
	db.Model(&models.Reservation{}).Where("guest_name != '' AND status != 'cancelled'").
		Select("COALESCE(SUM(total_rate), 0)").Scan(&totalRevenue)

	// 재방문 게스트 수
	var repeatGuests int64
	db.Table("reservations").
		Where("guest_name != '' AND status != 'cancelled'").
		Group("guest_name").
		Having("COUNT(*) > 1").
		Count(&repeatGuests)

	c.JSON(http.StatusOK, gin.H{
		"guests":   guests,
		"channels": channelList,
		"stats": gin.H{
			"total_guests":       totalGuests,
			"total_reservations": totalReservations,
			"total_revenue":      totalRevenue,
			"repeat_guests":      repeatGuests,
		},
	})
}

// Detail — 특정 게스트의 전체 예약 이력
func (h *GuestHandler) Detail(c *gin.Context) {
	name := c.Param("name")
	db := config.DB

	var reservations []models.Reservation
	db.Where("guest_name = ?", name).
		Order("check_in_date DESC").
		Find(&reservations)

	// 숙소명 매핑
	for i, r := range reservations {
		if r.InternalPropID != nil {
			var prop models.Property
			if db.First(&prop, *r.InternalPropID).Error == nil {
				reservations[i].PropertyName = prop.Name
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"guest_name":   name,
		"reservations": reservations,
	})
}
