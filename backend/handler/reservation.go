package handler

import (
	"net/http"

	"hiero-workflow/backend/hostex"

	"github.com/gin-gonic/gin"
)

type ReservationHandler struct {
	client *hostex.Client
}

func NewReservationHandler() *ReservationHandler {
	return &ReservationHandler{
		client: hostex.NewClient(),
	}
}

// 오늘의 예약 현황
func (h *ReservationHandler) GetToday(c *gin.Context) {
	checkIns, checkOuts, inHouse, err := h.client.GetTodayReservations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "호스텍스 API 연결 실패: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"check_ins":  checkIns,
		"check_outs": checkOuts,
		"in_house":   inHouse,
		"summary": gin.H{
			"check_in_count":  len(checkIns),
			"check_out_count": len(checkOuts),
			"in_house_count":  len(inHouse),
		},
	})
}

// 예약 목록 조회 (필터)
func (h *ReservationHandler) GetReservations(c *gin.Context) {
	params := make(map[string]string)

	if v := c.Query("status"); v != "" {
		params["status"] = v
	}
	if v := c.Query("channel_type"); v != "" {
		params["channel_type"] = v
	}
	if v := c.Query("start_check_in_date"); v != "" {
		params["start_check_in_date"] = v
	}
	if v := c.Query("end_check_in_date"); v != "" {
		params["end_check_in_date"] = v
	}
	if v := c.Query("start_check_out_date"); v != "" {
		params["start_check_out_date"] = v
	}
	if v := c.Query("end_check_out_date"); v != "" {
		params["end_check_out_date"] = v
	}
	if v := c.Query("property_id"); v != "" {
		params["property_id"] = v
	}
	if v := c.Query("limit"); v != "" {
		params["limit"] = v
	} else {
		params["limit"] = "50"
	}
	if v := c.Query("offset"); v != "" {
		params["offset"] = v
	}

	reservations, err := h.client.GetReservations(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "호스텍스 API 연결 실패: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, reservations)
}

// CEO 대시보드
func (h *ReservationHandler) GetCEODashboard(c *gin.Context) {
	data, err := h.client.GetCEODashboard()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "대시보드 데이터 조회 실패: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

// 숙소 목록 조회
func (h *ReservationHandler) GetProperties(c *gin.Context) {
	properties, total, err := h.client.GetProperties(100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "호스텍스 API 연결 실패: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"properties": properties,
		"total":      total,
	})
}
