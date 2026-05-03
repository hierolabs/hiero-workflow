package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type AdminReservationHandler struct {
	svc *service.ReservationService
}

func NewAdminReservationHandler() *AdminReservationHandler {
	return &AdminReservationHandler{
		svc: service.NewReservationService(),
	}
}

// List — 예약 목록 조회
func (h *AdminReservationHandler) List(c *gin.Context) {
	var query service.ReservationListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "목록 조회에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Get — 예약 상세 조회
func (h *AdminReservationHandler) Get(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID입니다"})
		return
	}

	reservation, err := h.svc.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "예약을 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, reservation)
}

// RevenueSummary — 매출 집계 (일/주/월)
func (h *AdminReservationHandler) RevenueSummary(c *gin.Context) {
	var query service.RevenueSummaryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.RevenueSummary(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "매출 집계에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Rematch — 미매칭 예약 재매칭
func (h *AdminReservationHandler) Rematch(c *gin.Context) {
	matched := h.svc.RematchAllReservations()
	c.JSON(http.StatusOK, gin.H{
		"message": "재매칭 완료",
		"matched": matched,
	})
}
