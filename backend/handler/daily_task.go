package handler

import (
	"fmt"
	"net/http"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type DailyTaskHandler struct{}

func NewDailyTaskHandler() *DailyTaskHandler { return &DailyTaskHandler{} }

// POST /admin/daily-tasks/check — 단건 체크
func (h *DailyTaskHandler) Check(c *gin.Context) {
	var req struct {
		TaskKey   string `json:"task_key"`
		RefID     uint   `json:"ref_id"`
		Status    string `json:"status"`    // completed, rejected, deleted
		Memo      string `json:"memo"`
		CheckedBy string `json:"checked_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	today := time.Now().Format("2006-01-02")

	// upsert
	var existing models.DailyTaskCheck
	if err := config.DB.Where("date = ? AND task_key = ? AND ref_id = ?", today, req.TaskKey, req.RefID).
		First(&existing).Error; err != nil {
		// 새로 생성
		check := models.DailyTaskCheck{
			Date: today, TaskKey: req.TaskKey, RefID: req.RefID,
			Status: req.Status, Memo: req.Memo, CheckedBy: req.CheckedBy,
		}
		config.DB.Create(&check)
		c.JSON(http.StatusCreated, check)
	} else {
		// 업데이트
		config.DB.Model(&existing).Updates(map[string]interface{}{
			"status": req.Status, "memo": req.Memo, "checked_by": req.CheckedBy,
		})
		c.JSON(http.StatusOK, existing)
	}

	service.LogActivity(nil, req.CheckedBy, "daily_task_"+req.Status, req.TaskKey, &req.RefID, req.Memo)
}

// POST /admin/daily-tasks/bulk-check — 일괄 체크
func (h *DailyTaskHandler) BulkCheck(c *gin.Context) {
	var req struct {
		TaskKey   string `json:"task_key"`
		RefIDs    []uint `json:"ref_ids"`
		Status    string `json:"status"`
		CheckedBy string `json:"checked_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	today := time.Now().Format("2006-01-02")
	count := 0

	for _, refID := range req.RefIDs {
		var existing models.DailyTaskCheck
		if err := config.DB.Where("date = ? AND task_key = ? AND ref_id = ?", today, req.TaskKey, refID).
			First(&existing).Error; err != nil {
			config.DB.Create(&models.DailyTaskCheck{
				Date: today, TaskKey: req.TaskKey, RefID: refID,
				Status: req.Status, CheckedBy: req.CheckedBy,
			})
			count++
		} else if existing.Status != req.Status {
			config.DB.Model(&existing).Updates(map[string]interface{}{
				"status": req.Status, "checked_by": req.CheckedBy,
			})
			count++
		}
	}

	service.LogActivity(nil, req.CheckedBy, "daily_task_bulk_"+req.Status, req.TaskKey, nil,
		fmt.Sprintf("%s %d건 일괄 처리", req.TaskKey, count))

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%d건 처리됨", count), "count": count})
}

// GET /admin/daily-tasks/checkin-targets?date=2026-05-10 — 수동 체크인 안내 대상 (DB 직접)
func (h *DailyTaskHandler) CheckinTargets(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))

	var reservations []models.Reservation
	config.DB.Where("check_in_date = ? AND status != 'cancelled' AND (channel_name LIKE '%삼삼엠투%' OR channel_name LIKE '%리브%' OR channel_name LIKE '%Agoda%')", date).
		Find(&reservations)

	// property_name 매핑
	for i := range reservations {
		if reservations[i].InternalPropID != nil {
			var prop models.Property
			if err := config.DB.First(&prop, *reservations[i].InternalPropID).Error; err == nil {
				reservations[i].PropertyName = prop.Name
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"reservations": reservations, "count": len(reservations)})
}

// GET /admin/daily-tasks?date=2026-05-10&task_key=manual_checkin — 체크 현황
func (h *DailyTaskHandler) List(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	taskKey := c.Query("task_key")

	var checks []models.DailyTaskCheck
	db := config.DB.Where("date = ?", date)
	if taskKey != "" {
		db = db.Where("task_key = ?", taskKey)
	}
	db.Find(&checks)

	// ref_id → status 맵
	checkMap := map[string]models.DailyTaskCheck{}
	for _, ch := range checks {
		key := fmt.Sprintf("%s_%d", ch.TaskKey, ch.RefID)
		checkMap[key] = ch
	}

	c.JSON(http.StatusOK, gin.H{"checks": checks, "check_map": checkMap})
}
