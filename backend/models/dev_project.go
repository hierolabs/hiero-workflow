package models

import "time"

// 개발 프로젝트 상태
const (
	DevProjectStatusPlanning   = "planning"
	DevProjectStatusActive     = "active"
	DevProjectStatusPaused     = "paused"
	DevProjectStatusCompleted  = "completed"
)

// 마일스톤 상태
const (
	MilestoneStatusNotStarted  = "not_started"
	MilestoneStatusInProgress  = "in_progress"
	MilestoneStatusDone        = "done"
	MilestoneStatusBlocked     = "blocked"
)

// 마일스톤 카테고리
const (
	MilestoneCatScore    = "score"     // Score Stack
	MilestoneCatLayer    = "layer"     // 4 Layer
	MilestoneCatData     = "data"      // 데이터소스 연동
	MilestoneCatUI       = "ui"        // UI/UX 구현
	MilestoneCatInfra    = "infra"     // 인프라/기술스택
	MilestoneCatDecision = "decision"  // 기술 의사결정
)

// DevProject — 개발 프로젝트 (MORO, ThingDone 등)
type DevProject struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Code        string    `gorm:"size:30;uniqueIndex" json:"code"` // moro, thingdone
	Description string    `gorm:"type:text" json:"description"`
	Status      string    `gorm:"size:20;default:planning" json:"status"`
	OwnerRole   string    `gorm:"size:20" json:"owner_role"` // cto, ceo
	Phase       string    `gorm:"size:20" json:"phase"`      // mvp, v2, v3
	StartDate   string    `gorm:"size:10" json:"start_date"` // 2026-05-02
	TargetDate  string    `gorm:"size:10" json:"target_date"`
	WeekCount   int       `json:"week_count"` // MVP 몇 주
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Milestones []DevMilestone `gorm:"foreignKey:ProjectID" json:"milestones,omitempty"`
}

// DevMilestone — 프로젝트 내 마일스톤
type DevMilestone struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ProjectID   uint      `gorm:"index;not null" json:"project_id"`
	Name        string    `gorm:"size:200;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Category    string    `gorm:"size:20;not null" json:"category"` // score, layer, data, ui, infra, decision
	Status      string    `gorm:"size:20;default:not_started" json:"status"`
	Phase       string    `gorm:"size:10" json:"phase"`     // P1, P2
	DueWeek     int       `json:"due_week"`                 // MVP 주차
	SortOrder   int       `json:"sort_order"`
	Notes       string    `gorm:"type:text" json:"notes"`   // 구현 메모
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
