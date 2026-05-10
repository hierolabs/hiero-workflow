package models

import "time"

const (
	TaskCheckCompleted = "completed"
	TaskCheckRejected  = "rejected"
	TaskCheckDeleted   = "deleted"
)

// DailyTaskCheck 일일 업무 체크포인트
type DailyTaskCheck struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Date      string    `gorm:"size:10;index;not null" json:"date"`          // 2026-05-10
	TaskKey   string    `gorm:"size:50;index;not null" json:"task_key"`      // manual_checkin, cleaning, issues, detections
	RefID     uint      `gorm:"index;not null" json:"ref_id"`               // reservation_id, cleaning_task_id 등
	Status    string    `gorm:"size:20;not null" json:"status"`             // completed, rejected, deleted
	Memo      string    `gorm:"size:255" json:"memo"`
	CheckedBy string    `gorm:"size:100" json:"checked_by"`
	CreatedAt time.Time `json:"created_at"`
}
