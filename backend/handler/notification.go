package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type NotificationHandler struct {
	svc *service.NotificationService
}

func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{svc: service.NewNotificationService()}
}

// GET /admin/notifications
func (h *NotificationHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	notifs := h.svc.ListByUser(uid, 30)
	c.JSON(http.StatusOK, gin.H{"notifications": notifs})
}

// GET /admin/notifications/unread
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	count := h.svc.UnreadCount(uid)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// PATCH /admin/notifications/:id/read
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	h.svc.MarkRead(id, uid)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// PATCH /admin/notifications/read-all
func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	h.svc.MarkAllRead(uid)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /admin/activity-logs
func (h *NotificationHandler) ActivityLogs(c *gin.Context) {
	action := c.Query("action")
	logs := service.ListActivityLogs(50, action, nil)
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}
