package handler

import (
	"net/http"
	"time"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CalendarHandler struct {
	svc *service.CalendarService
}

func NewCalendarHandler() *CalendarHandler {
	return &CalendarHandler{
		svc: service.NewCalendarService(),
	}
}

// GetCalendar handles GET /admin/calendar?start=2026-05-01&end=2026-05-31
func (h *CalendarHandler) GetCalendar(c *gin.Context) {
	startStr := c.Query("start")
	endStr := c.Query("end")
	today := time.Now().Format("2006-01-02")

	if startStr == "" || endStr == "" {
		now := time.Now()
		startStr = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).Format("2006-01-02")
		endStr = time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, time.Local).Format("2006-01-02")
	}

	data, err := h.svc.GetCalendarData(startStr, endStr, today)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "캘린더 데이터를 가져올 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Calendar data loaded",
		"data":    data,
	})
}

// GetSummary handles GET /admin/calendar/summary?date=2026-05-03
func (h *CalendarHandler) GetSummary(c *gin.Context) {
	dateStr := c.Query("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	summary, err := h.svc.GetDailySummary(dateStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "요약 데이터를 가져올 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Daily summary loaded",
		"data":    summary,
	})
}
