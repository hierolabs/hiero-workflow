package handler

import (
	"net/http"
	"strconv"
	"time"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ChecklistHandler struct {
	svc *service.ChecklistService
}

func NewChecklistHandler() *ChecklistHandler {
	return &ChecklistHandler{svc: service.NewChecklistService()}
}

// GetToday GET /admin/checklist/today
func (h *ChecklistHandler) GetToday(c *gin.Context) {
	userID := c.GetUint("user_id")
	loginID, _ := c.Get("login_id")
	name, _ := loginID.(string)
	today := time.Now().Format("2006-01-02")

	items := h.svc.GetOrGenerate(userID, name, today)
	c.JSON(http.StatusOK, gin.H{"items": items, "date": today, "count": len(items)})
}

// Toggle PATCH /admin/checklist/:id/toggle
func (h *ChecklistHandler) Toggle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	userID := c.GetUint("user_id")
	item, err := h.svc.Toggle(uint(id), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// Summary GET /admin/checklist/summary?date=
func (h *ChecklistHandler) Summary(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	summary := h.svc.GetSummary(date)
	c.JSON(http.StatusOK, summary)
}
