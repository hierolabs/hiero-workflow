package models

import "time"

// 응대 기록 유형
const (
	CommTypeNote    = "note"    // 내부 메모
	CommTypePhone   = "phone"   // 전화
	CommTypeMessage = "message" // 플랫폼 메시지
	CommTypeVisit   = "visit"   // 현장 방문
	CommTypeIssue   = "issue"   // 이슈 연결
	CommTypeSystem  = "system"  // 시스템 자동 생성
)

type CommunicationLog struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 연결 (숙소 + 예약 기준으로 묶임)
	PropertyID      *uint  `gorm:"index" json:"property_id"`
	ReservationID   *uint  `gorm:"index" json:"reservation_id"`
	ReservationCode string `gorm:"size:100;index" json:"reservation_code"`
	IssueID         *uint  `gorm:"index" json:"issue_id"`

	// 내용
	CommType string `gorm:"size:30;index;not null" json:"comm_type"`
	Content  string `gorm:"type:text;not null" json:"content"`
	Channel  string `gorm:"size:50" json:"channel"` // airbnb, phone, kakao, internal 등

	// 작성자
	AuthorID   *uint  `json:"author_id"`
	AuthorName string `gorm:"size:100" json:"author_name"`

	// 컨텍스트
	PropertyName string `gorm:"size:100" json:"property_name"`
	GuestName    string `gorm:"size:200" json:"guest_name"`

	CreatedAt time.Time `json:"created_at"`
}
