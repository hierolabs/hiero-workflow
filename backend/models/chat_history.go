package models

import "time"

// ChatHistory — 단톡방 원본 메시지 (활용 DB)
type ChatHistory struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Room      string    `json:"room" gorm:"size:50;index;not null"`        // work, cleaning
	Sender    string    `json:"sender" gorm:"size:100;index;not null"`
	Content   string    `json:"content" gorm:"type:text"`
	MsgDate   string    `json:"msg_date" gorm:"size:10;index"`             // 2026-05-08
	MsgTime   string    `json:"msg_time" gorm:"size:5"`                    // 14:30
	MsgType   string    `json:"msg_type" gorm:"size:20;default:text;index"` // text, photo, system, assignment
	Timestamp time.Time `json:"timestamp" gorm:"index"`
	Season    int       `json:"season" gorm:"index"`                       // 1, 2, 3
}
