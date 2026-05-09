package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type NotificationService struct{}

func NewNotificationService() *NotificationService {
	return &NotificationService{}
}

// --- 알림 생성 ---

func (s *NotificationService) Create(n models.Notification) {
	config.DB.Create(&n)
}

// NotifyUser — 특정 사용자에게 알림
func (s *NotificationService) NotifyUser(userID uint, notifType, title, content string, issueID *uint, fromUserID *uint, fromName string) {
	config.DB.Create(&models.Notification{
		UserID:     userID,
		Type:       notifType,
		Title:      title,
		Content:    content,
		IssueID:    issueID,
		FromUserID: fromUserID,
		FromName:   fromName,
	})
}

// NotifyByRoleTitle — 역할 기반으로 알림 (해당 role_title의 사용자에게)
func (s *NotificationService) NotifyByRoleTitle(roleTitle, notifType, title, content string, issueID *uint, fromName string) {
	var user models.AdminUser
	if err := config.DB.Where("role_title = ?", roleTitle).First(&user).Error; err == nil {
		s.NotifyUser(user.ID, notifType, title, content, issueID, nil, fromName)
	}
}

// NotifyByName — 이름으로 알림
func (s *NotificationService) NotifyByName(name, notifType, title, content string, issueID *uint, fromName string) {
	var user models.AdminUser
	if err := config.DB.Where("name = ?", name).First(&user).Error; err == nil {
		s.NotifyUser(user.ID, notifType, title, content, issueID, nil, fromName)
	}
}

// --- 알림 조회 ---

func (s *NotificationService) ListByUser(userID uint, limit int) []models.Notification {
	if limit <= 0 {
		limit = 30
	}
	var notifs []models.Notification
	config.DB.Where("user_id = ?", userID).
		Order("is_read ASC, created_at DESC").
		Limit(limit).
		Find(&notifs)
	return notifs
}

func (s *NotificationService) UnreadCount(userID uint) int64 {
	var count int64
	config.DB.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count)
	return count
}

// --- 읽음 처리 ---

func (s *NotificationService) MarkRead(id uint, userID uint) error {
	now := time.Now()
	return config.DB.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

func (s *NotificationService) MarkAllRead(userID uint) error {
	now := time.Now()
	return config.DB.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}

// --- 업무 로그 ---

func LogActivity(userID *uint, userName, action, targetType string, targetID *uint, detail string) {
	config.DB.Create(&models.ActivityLog{
		UserID:     userID,
		UserName:   userName,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Detail:     detail,
	})
}

func ListActivityLogs(limit int, action string, userID *uint) []models.ActivityLog {
	if limit <= 0 {
		limit = 50
	}
	db := config.DB.Model(&models.ActivityLog{})
	if action != "" {
		db = db.Where("action = ?", action)
	}
	if userID != nil {
		db = db.Where("user_id = ?", *userID)
	}
	var logs []models.ActivityLog
	db.Order("created_at DESC").Limit(limit).Find(&logs)
	return logs
}
