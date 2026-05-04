package service

import (
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type ChecklistService struct{}

func NewChecklistService() *ChecklistService {
	return &ChecklistService{}
}

// GetOrGenerate 오늘 체크리스트가 없으면 템플릿에서 생성 후 반환
func (s *ChecklistService) GetOrGenerate(userID uint, userName, date string) []models.ChecklistItem {
	var existing []models.ChecklistItem
	config.DB.Where("date = ? AND user_id = ?", date, userID).Order("sort_order").Find(&existing)

	if len(existing) > 0 {
		return existing
	}

	// 오늘 요일 (1=월 ... 7=일)
	t, _ := time.Parse("2006-01-02", date)
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}

	// 템플릿에서 오늘 해당 항목 생성
	for _, tmpl := range ChecklistTemplates {
		if tmpl.Frequency == "daily" || (tmpl.Frequency == "weekly" && tmpl.WeekDay == weekday) {
			item := models.ChecklistItem{
				Date:       date,
				UserID:     userID,
				UserName:   userName,
				TemplateID: tmpl.ID,
				Page:       tmpl.Page,
				Mode:       tmpl.Mode,
				Title:      tmpl.Title,
				Completed:  false,
				SortOrder:  tmpl.SortOrder,
			}
			config.DB.Create(&item)
			existing = append(existing, item)
		}
	}

	return existing
}

// Toggle 체크리스트 아이템 완료 토글
func (s *ChecklistService) Toggle(itemID uint, userID uint) (*models.ChecklistItem, error) {
	var item models.ChecklistItem
	if err := config.DB.Where("id = ? AND user_id = ?", itemID, userID).First(&item).Error; err != nil {
		return nil, err
	}

	if item.Completed {
		item.Completed = false
		item.CompletedAt = nil
	} else {
		item.Completed = true
		now := time.Now()
		item.CompletedAt = &now
	}

	config.DB.Save(&item)
	return &item, nil
}

// ChecklistSummary 집계 결과
type ChecklistSummary struct {
	Total     int            `json:"total"`
	Completed int            `json:"completed"`
	Rate      float64        `json:"rate"` // 0~100
	ByPage    []PageSummary  `json:"by_page"`
}

type PageSummary struct {
	Page      string `json:"page"`
	Total     int    `json:"total"`
	Completed int    `json:"completed"`
}

// GetSummary 특정 날짜의 전체 완료율
func (s *ChecklistService) GetSummary(date string) *ChecklistSummary {
	var items []models.ChecklistItem
	config.DB.Where("date = ?", date).Find(&items)

	summary := &ChecklistSummary{}
	pageMap := map[string]*PageSummary{}

	for _, item := range items {
		summary.Total++
		if item.Completed {
			summary.Completed++
		}

		ps, ok := pageMap[item.Page]
		if !ok {
			ps = &PageSummary{Page: item.Page}
			pageMap[item.Page] = ps
		}
		ps.Total++
		if item.Completed {
			ps.Completed++
		}
	}

	if summary.Total > 0 {
		summary.Rate = float64(summary.Completed) / float64(summary.Total) * 100
	}

	for _, ps := range pageMap {
		summary.ByPage = append(summary.ByPage, *ps)
	}

	return summary
}
