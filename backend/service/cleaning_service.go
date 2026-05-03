package service

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"gorm.io/gorm"
)

type CleaningService struct{}

func NewCleaningService() *CleaningService {
	return &CleaningService{}
}

// --- 청소 업무 자동 생성 ---

// GenerateFromCheckouts — 특정 날짜의 체크아웃 예약에서 청소 업무 자동 생성
func (s *CleaningService) GenerateFromCheckouts(date string) (int, error) {
	var reservations []models.Reservation
	config.DB.Where("check_out_date = ? AND status = ?", date, "accepted").
		Find(&reservations)

	created := 0
	for _, r := range reservations {
		// 이미 생성된 청소 업무 중복 방지
		var existing models.CleaningTask
		if err := config.DB.Where("reservation_code = ? AND cleaning_date = ?",
			r.ReservationCode, date).First(&existing).Error; err == nil {
			continue
		}

		// 내부 Property 정보 조회
		var propName, propCode, address string
		var propID *uint
		if r.InternalPropID != nil {
			var prop models.Property
			if err := config.DB.First(&prop, *r.InternalPropID).Error; err == nil {
				propName = prop.Name
				propCode = prop.Code
				address = prop.Address
				propID = &prop.ID
			}
		}

		// 다음 체크인 확인 → 우선순위 결정
		priority := s.calcPriority(r.PropertyID, date)

		task := models.CleaningTask{
			PropertyID:      propID,
			ReservationID:   &r.ID,
			ReservationCode: r.ReservationCode,
			CleaningDate:    date,
			CheckOutTime:    "11:00", // default
			NextCheckIn:     s.findNextCheckIn(r.PropertyID, date),
			Status:          models.CleaningStatusPending,
			Priority:        priority,
			PropertyName:    propName,
			PropertyCode:    propCode,
			Address:         address,
			GuestName:       r.GuestName,
		}

		config.DB.Create(&task)
		created++
		log.Printf("[Cleaning] 청소 업무 생성: %s %s (%s)", date, propCode, r.GuestName)
	}

	return created, nil
}

// calcPriority — 당일 체크인이 있으면 urgent, 내일이면 normal, 없으면 low
func (s *CleaningService) calcPriority(hostexPropertyID int64, checkoutDate string) string {
	var nextCheckIn models.Reservation
	err := config.DB.Where("property_id = ? AND check_in_date >= ? AND status = ?",
		hostexPropertyID, checkoutDate, "accepted").
		Order("check_in_date ASC").
		First(&nextCheckIn).Error

	if err != nil {
		return models.CleaningPriorityLow
	}

	if nextCheckIn.CheckInDate == checkoutDate {
		return models.CleaningPriorityUrgent
	}

	// 내일 체크인
	checkout, _ := time.Parse("2006-01-02", checkoutDate)
	tomorrow := checkout.Add(24 * time.Hour).Format("2006-01-02")
	if nextCheckIn.CheckInDate == tomorrow {
		return models.CleaningPriorityNormal
	}

	return models.CleaningPriorityLow
}

// findNextCheckIn — 해당 숙소의 다음 체크인 날짜 찾기
func (s *CleaningService) findNextCheckIn(hostexPropertyID int64, afterDate string) string {
	var next models.Reservation
	if err := config.DB.Where("property_id = ? AND check_in_date >= ? AND status = ?",
		hostexPropertyID, afterDate, "accepted").
		Order("check_in_date ASC").
		First(&next).Error; err != nil {
		return ""
	}
	return next.CheckInDate
}

// --- 목록 조회 ---

type CleaningListQuery struct {
	Page         int    `form:"page"`
	PageSize     int    `form:"page_size"`
	CleaningDate string `form:"cleaning_date"`
	Status       string `form:"status"`
	CleanerID    uint   `form:"cleaner_id"`
	Priority     string `form:"priority"`
	PropertyID   uint   `form:"property_id"`
	Unassigned   bool   `form:"unassigned"`
}

func (q *CleaningListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 || q.PageSize > 100 {
		q.PageSize = 50
	}
}

type CleaningListResult struct {
	Tasks      []models.CleaningTask `json:"tasks"`
	Total      int64                 `json:"total"`
	Page       int                   `json:"page"`
	PageSize   int                   `json:"page_size"`
	TotalPages int                   `json:"total_pages"`
}

func (s *CleaningService) List(query CleaningListQuery) (CleaningListResult, error) {
	query.Normalize()

	db := config.DB.Model(&models.CleaningTask{})

	if query.CleaningDate != "" {
		db = db.Where("cleaning_date = ?", query.CleaningDate)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.CleanerID > 0 {
		db = db.Where("cleaner_id = ?", query.CleanerID)
	}
	if query.Priority != "" {
		db = db.Where("priority = ?", query.Priority)
	}
	if query.PropertyID > 0 {
		db = db.Where("property_id = ?", query.PropertyID)
	}
	if query.Unassigned {
		db = db.Where("cleaner_id IS NULL")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return CleaningListResult{}, err
	}

	var tasks []models.CleaningTask
	offset := (query.Page - 1) * query.PageSize

	// urgent 먼저, 그 다음 normal, low 순
	if err := db.Order("FIELD(priority, 'urgent', 'normal', 'low'), created_at ASC").
		Offset(offset).Limit(query.PageSize).
		Find(&tasks).Error; err != nil {
		return CleaningListResult{}, err
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return CleaningListResult{
		Tasks:      tasks,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// --- 배정 ---

func (s *CleaningService) Assign(taskID uint, cleanerID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	var cleaner models.Cleaner
	if err := config.DB.First(&cleaner, cleanerID).Error; err != nil {
		return task, fmt.Errorf("청소자를 찾을 수 없습니다")
	}

	task.CleanerID = &cleanerID
	task.CleanerName = cleaner.Name
	task.Status = models.CleaningStatusAssigned
	config.DB.Save(&task)

	return task, nil
}

// --- 상태 변경 ---

func (s *CleaningService) Start(taskID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	now := time.Now()
	task.Status = models.CleaningStatusInProgress
	task.StartedAt = &now
	config.DB.Save(&task)

	return task, nil
}

func (s *CleaningService) Complete(taskID uint) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	now := time.Now()
	task.Status = models.CleaningStatusCompleted
	task.CompletedAt = &now
	config.DB.Save(&task)

	return task, nil
}

func (s *CleaningService) ReportIssue(taskID uint, issueMemo string) (models.CleaningTask, error) {
	var task models.CleaningTask
	if err := config.DB.First(&task, taskID).Error; err != nil {
		return task, ErrNotFound
	}

	task.Status = models.CleaningStatusIssue
	task.IssueMemo = strings.TrimSpace(issueMemo)
	config.DB.Save(&task)

	return task, nil
}

// --- 오늘 요약 ---

type CleaningSummary struct {
	Total      int64 `json:"total"`
	Pending    int64 `json:"pending"`
	Assigned   int64 `json:"assigned"`
	InProgress int64 `json:"in_progress"`
	Completed  int64 `json:"completed"`
	Issue      int64 `json:"issue"`
}

func (s *CleaningService) GetSummary(date string) CleaningSummary {
	var summary CleaningSummary
	db := config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ?", date)

	db.Count(&summary.Total)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", date, "pending").Count(&summary.Pending)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", date, "assigned").Count(&summary.Assigned)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", date, "in_progress").Count(&summary.InProgress)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", date, "completed").Count(&summary.Completed)
	config.DB.Model(&models.CleaningTask{}).Where("cleaning_date = ? AND status = ?", date, "issue").Count(&summary.Issue)

	return summary
}

// --- 청소자 CRUD ---

func (s *CleaningService) ListCleaners() []models.Cleaner {
	var cleaners []models.Cleaner
	config.DB.Where("active = ?", true).Order("name ASC").Find(&cleaners)
	return cleaners
}

func (s *CleaningService) CreateCleaner(cleaner models.Cleaner) (models.Cleaner, error) {
	cleaner.Active = true
	if err := config.DB.Create(&cleaner).Error; err != nil {
		return cleaner, err
	}
	return cleaner, nil
}

func (s *CleaningService) UpdateCleaner(id uint, name, phone, region, memo string) (models.Cleaner, error) {
	var cleaner models.Cleaner
	if err := config.DB.First(&cleaner, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return cleaner, ErrNotFound
		}
		return cleaner, err
	}

	cleaner.Name = name
	cleaner.Phone = phone
	cleaner.Region = region
	cleaner.Memo = memo
	config.DB.Save(&cleaner)

	return cleaner, nil
}

func (s *CleaningService) DeleteCleaner(id uint) error {
	return config.DB.Delete(&models.Cleaner{}, id).Error
}
