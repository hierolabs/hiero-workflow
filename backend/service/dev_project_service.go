package service

import (
	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"gorm.io/gorm"
)

type DevProjectService struct{}

func NewDevProjectService() *DevProjectService {
	return &DevProjectService{}
}

// ── 프로젝트 목록 (마일스톤 포함) ──
func (s *DevProjectService) ListProjects() ([]models.DevProject, error) {
	var projects []models.DevProject
	err := config.DB.Preload("Milestones", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Order("created_at ASC").Find(&projects).Error
	return projects, err
}

// ── 프로젝트 상세 ──
func (s *DevProjectService) GetProject(id uint) (*models.DevProject, error) {
	var p models.DevProject
	err := config.DB.Preload("Milestones", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).First(&p, id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ── 프로젝트별 진행률 ──
type ProjectProgress struct {
	ProjectID   uint   `json:"project_id"`
	ProjectName string `json:"project_name"`
	Code        string `json:"code"`
	Status      string `json:"status"`
	Phase       string `json:"phase"`
	Total       int    `json:"total"`
	Done        int    `json:"done"`
	InProgress  int    `json:"in_progress"`
	Blocked     int    `json:"blocked"`
	Percent     int    `json:"percent"`
	ByCategory  map[string]CategoryProgress `json:"by_category"`
}

type CategoryProgress struct {
	Total      int `json:"total"`
	Done       int `json:"done"`
	InProgress int `json:"in_progress"`
	Percent    int `json:"percent"`
}

func (s *DevProjectService) GetProjectProgress(projectID uint) (*ProjectProgress, error) {
	var p models.DevProject
	if err := config.DB.Preload("Milestones").First(&p, projectID).Error; err != nil {
		return nil, err
	}

	prog := &ProjectProgress{
		ProjectID:   p.ID,
		ProjectName: p.Name,
		Code:        p.Code,
		Status:      p.Status,
		Phase:       p.Phase,
		Total:       len(p.Milestones),
		ByCategory:  make(map[string]CategoryProgress),
	}

	catMap := make(map[string]*CategoryProgress)

	for _, m := range p.Milestones {
		// 전체 집계
		switch m.Status {
		case models.MilestoneStatusDone:
			prog.Done++
		case models.MilestoneStatusInProgress:
			prog.InProgress++
		case models.MilestoneStatusBlocked:
			prog.Blocked++
		}

		// 카테고리별 집계
		cp, ok := catMap[m.Category]
		if !ok {
			cp = &CategoryProgress{}
			catMap[m.Category] = cp
		}
		cp.Total++
		if m.Status == models.MilestoneStatusDone {
			cp.Done++
		}
		if m.Status == models.MilestoneStatusInProgress {
			cp.InProgress++
		}
	}

	if prog.Total > 0 {
		prog.Percent = (prog.Done * 100) / prog.Total
	}
	for k, cp := range catMap {
		if cp.Total > 0 {
			cp.Percent = (cp.Done * 100) / cp.Total
		}
		prog.ByCategory[k] = *cp
	}

	return prog, nil
}

// ── 전체 프로젝트 진행률 (CTO Board용) ──
func (s *DevProjectService) GetAllProgress() ([]ProjectProgress, error) {
	var projects []models.DevProject
	if err := config.DB.Preload("Milestones").Find(&projects).Error; err != nil {
		return nil, err
	}

	var result []ProjectProgress
	for _, p := range projects {
		prog := ProjectProgress{
			ProjectID:   p.ID,
			ProjectName: p.Name,
			Code:        p.Code,
			Status:      p.Status,
			Phase:       p.Phase,
			Total:       len(p.Milestones),
			ByCategory:  make(map[string]CategoryProgress),
		}

		catMap := make(map[string]*CategoryProgress)
		for _, m := range p.Milestones {
			switch m.Status {
			case models.MilestoneStatusDone:
				prog.Done++
			case models.MilestoneStatusInProgress:
				prog.InProgress++
			case models.MilestoneStatusBlocked:
				prog.Blocked++
			}
			cp, ok := catMap[m.Category]
			if !ok {
				cp = &CategoryProgress{}
				catMap[m.Category] = cp
			}
			cp.Total++
			if m.Status == models.MilestoneStatusDone {
				cp.Done++
			}
			if m.Status == models.MilestoneStatusInProgress {
				cp.InProgress++
			}
		}
		if prog.Total > 0 {
			prog.Percent = (prog.Done * 100) / prog.Total
		}
		for k, cp := range catMap {
			if cp.Total > 0 {
				cp.Percent = (cp.Done * 100) / cp.Total
			}
			prog.ByCategory[k] = *cp
		}
		result = append(result, prog)
	}
	return result, nil
}

// ── 마일스톤 상태 변경 ──
func (s *DevProjectService) UpdateMilestoneStatus(milestoneID uint, status string, notes string) error {
	updates := map[string]interface{}{"status": status}
	if notes != "" {
		updates["notes"] = notes
	}
	return config.DB.Model(&models.DevMilestone{}).Where("id = ?", milestoneID).Updates(updates).Error
}
