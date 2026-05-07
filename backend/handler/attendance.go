package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type AttendanceHandler struct {
	svc *service.AttendanceService
}

func NewAttendanceHandler() *AttendanceHandler {
	return &AttendanceHandler{svc: service.NewAttendanceService()}
}

// POST /admin/attendance/heartbeat — 프론트에서 5분마다 호출
func (h *AttendanceHandler) Heartbeat(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var body struct {
		Page string `json:"page"`
	}
	c.ShouldBindJSON(&body)

	h.svc.Heartbeat(userID.(uint))

	// Track page view
	if body.Page != "" {
		loginID, _ := c.Get("login_id")
		h.svc.TrackActivity(userID.(uint), 0, "page_view", body.Page, loginID.(string))
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /admin/attendance/logout
func (h *AttendanceHandler) Logout(c *gin.Context) {
	userID, _ := c.Get("user_id")
	h.svc.Logout(userID.(uint))
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// GET /admin/attendance/today — 오늘 접속 현황
func (h *AttendanceHandler) Today(c *gin.Context) {
	active := h.svc.GetTodayActive()
	c.JSON(http.StatusOK, gin.H{"users": active})
}

// GET /admin/attendance/report?start=2026-05-01&end=2026-05-31
func (h *AttendanceHandler) Report(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")
	data, err := h.svc.GetAttendance(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"attendance": data})
}

// GET /admin/attendance/productivity?start=2026-05-01&end=2026-05-31
func (h *AttendanceHandler) Productivity(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")
	data, err := h.svc.GetProductivity(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"productivity": data})
}
