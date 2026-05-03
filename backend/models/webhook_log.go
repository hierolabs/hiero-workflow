package models

import "time"

type WebhookLog struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	Event           string    `json:"event" gorm:"size:50;index"`
	ReservationCode string    `json:"reservation_code" gorm:"size:100"`
	PropertyID      int64     `json:"property_id"`
	Payload         string    `json:"payload" gorm:"type:text"`
	ProcessedAt     time.Time `json:"processed_at"`
	CreatedAt       time.Time `json:"created_at"`
}
