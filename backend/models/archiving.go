package models

import "time"

// ArchivingJob 아카이빙 파이프라인 작업 이력
// session: 세션 작업 → TAB 1~4 생성
// weekly:  주간 TAB 1~4 → TAB 5~7 생성
// monthly: 월간 review 상태 알림
type ArchivingJob struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Type          string     `gorm:"size:30;not null" json:"type"`                       // session | weekly | monthly
	Status        string     `gorm:"size:30;not null;default:pending" json:"status"`      // pending | processing | completed | failed
	InputSummary  string     `gorm:"type:text" json:"input_summary"`                     // 세션 설명 텍스트
	ArticleIDs    string     `gorm:"size:500" json:"article_ids"`                        // JSON array [15, 16]
	TabsGenerated string     `gorm:"size:100" json:"tabs_generated"`                     // "1,2,3,4" or "5,6,7"
	ErrorMessage  string     `gorm:"type:text" json:"error_message"`
	CreatedByName string     `gorm:"size:100" json:"created_by_name"`
	CreatedAt     time.Time  `json:"created_at"`
	CompletedAt   *time.Time `json:"completed_at"`
}
