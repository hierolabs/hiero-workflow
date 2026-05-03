package models

import "time"

// 청소 업무 상태
const (
	CleaningStatusPending    = "pending"     // 생성됨, 미배정
	CleaningStatusAssigned   = "assigned"    // 배정됨
	CleaningStatusInProgress = "in_progress" // 청소 시작
	CleaningStatusCompleted  = "completed"   // 완료
	CleaningStatusIssue      = "issue"       // 문제 있음
)

// 청소 우선순위
const (
	CleaningPriorityUrgent = "urgent" // 당일 체크인 있음
	CleaningPriorityNormal = "normal" // 다음날 이후 체크인
	CleaningPriorityLow    = "low"    // 체크인 예정 없음
)

var ValidCleaningStatuses = map[string]bool{
	CleaningStatusPending:    true,
	CleaningStatusAssigned:   true,
	CleaningStatusInProgress: true,
	CleaningStatusCompleted:  true,
	CleaningStatusIssue:      true,
}

type CleaningTask struct {
	ID uint `gorm:"primaryKey" json:"id"`

	// 연결
	PropertyID      *uint  `gorm:"index" json:"property_id"`       // 내부 Property
	ReservationID   *uint  `gorm:"index" json:"reservation_id"`    // 체크아웃 예약
	ReservationCode string `gorm:"size:100" json:"reservation_code"`

	// 일정
	CleaningDate string `gorm:"size:20;index;not null" json:"cleaning_date"` // YYYY-MM-DD
	CheckOutTime string `gorm:"size:10" json:"check_out_time"`               // 체크아웃 시간
	NextCheckIn  string `gorm:"size:20" json:"next_check_in"`                // 다음 체크인 날짜

	// 배정
	CleanerID   *uint  `gorm:"index" json:"cleaner_id"`
	CleanerName string `gorm:"size:100" json:"cleaner_name"`

	// 상태
	Status   string `gorm:"size:30;index;default:'pending'" json:"status"`
	Priority string `gorm:"size:20;index;default:'normal'" json:"priority"`

	// 실행
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`

	// 메모
	PropertyName string `gorm:"size:100" json:"property_name"`
	PropertyCode string `gorm:"size:50" json:"property_code"`
	Address      string `gorm:"size:255" json:"address"`
	GuestName    string `gorm:"size:200" json:"guest_name"`
	Memo         string `gorm:"type:text" json:"memo"`
	IssueMemo    string `gorm:"type:text" json:"issue_memo"` // 문제 있음 메모

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
