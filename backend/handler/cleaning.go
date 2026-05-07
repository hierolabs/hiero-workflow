package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CleaningHandler struct {
	svc      *service.CleaningService
	issueSvc *service.IssueService
	commSvc  *service.CommunicationService
}

func NewCleaningHandler() *CleaningHandler {
	return &CleaningHandler{
		svc:      service.NewCleaningService(),
		issueSvc: service.NewIssueService(),
		commSvc:  service.NewCommunicationService(),
	}
}

// --- 청소 업무 ---

// ListTasks — 청소 업무 목록
func (h *CleaningHandler) ListTasks(c *gin.Context) {
	var query service.CleaningListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "목록 조회 실패"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetSummary — 날짜별 청소 요약
func (h *CleaningHandler) GetSummary(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	summary := h.svc.GetSummary(date)
	c.JSON(http.StatusOK, summary)
}

// Generate — 특정 날짜 청소 업무 자동 생성
func (h *CleaningHandler) Generate(c *gin.Context) {
	var req struct {
		Date string `json:"date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}

	created, err := h.svc.GenerateFromCheckouts(req.Date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "청소 업무 생성 완료",
		"created": created,
		"date":    req.Date,
	})
}

// Assign — 청소자 배정
func (h *CleaningHandler) Assign(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		CleanerID uint `json:"cleaner_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.CleanerID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cleaner_id는 필수입니다"})
		return
	}

	task, err := h.svc.Assign(id, req.CleanerID)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

// Start — 청소 시작
func (h *CleaningHandler) Start(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	task, err := h.svc.Start(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, task)
}

// Complete — 청소 완료
func (h *CleaningHandler) Complete(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	task, err := h.svc.Complete(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	// 시스템 로그
	h.commSvc.LogSystemEvent(task.PropertyID, task.ReservationID, task.ReservationCode,
		"청소 완료: "+task.PropertyCode+" "+task.PropertyName)

	c.JSON(http.StatusOK, task)
}

// ReportIssue — 문제 있음 등록
func (h *CleaningHandler) ReportIssue(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		IssueMemo string `json:"issue_memo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	task, err := h.svc.ReportIssue(id, req.IssueMemo)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	// 이슈 자동 생성
	issue, _ := h.issueSvc.CreateFromCleaningTask(task, req.IssueMemo)

	// 시스템 로그
	h.commSvc.LogSystemEvent(task.PropertyID, task.ReservationID, task.ReservationCode,
		"청소 문제 발생: "+req.IssueMemo)

	c.JSON(http.StatusOK, gin.H{
		"task":  task,
		"issue": issue,
	})
}

// --- 청소자 관리 ---

func (h *CleaningHandler) ListCleaners(c *gin.Context) {
	cleaners := h.svc.ListCleaners()
	c.JSON(http.StatusOK, cleaners)
}

func (h *CleaningHandler) CreateCleaner(c *gin.Context) {
	var cleaner models.Cleaner
	if err := c.ShouldBindJSON(&cleaner); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if cleaner.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "이름은 필수입니다"})
		return
	}

	created, err := h.svc.CreateCleaner(cleaner)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *CleaningHandler) UpdateCleaner(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		Name   string `json:"name"`
		Phone  string `json:"phone"`
		Region string `json:"region"`
		Memo   string `json:"memo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	cleaner, err := h.svc.UpdateCleaner(id, req.Name, req.Phone, req.Region, req.Memo)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, cleaner)
}

func (h *CleaningHandler) DeleteCleaner(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	if err := h.svc.DeleteCleaner(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "삭제 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "삭제 완료"})
}

// --- 청소코드 ---

func (h *CleaningHandler) ListCleaningCodes(c *gin.Context) {
	codes := h.svc.ListCleaningCodes()
	c.JSON(http.StatusOK, codes)
}

// --- 청소자별 배정 현황 ---

func (h *CleaningHandler) CleanerWorkload(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	workload := h.svc.GetCleanerWorkload(date)
	c.JSON(http.StatusOK, workload)
}

// GET /admin/cleaning/extensions — 연장 감지 알림
func (h *CleaningHandler) Extensions(c *gin.Context) {
	date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	extensions := h.svc.DetectExtensions(date)
	c.JSON(http.StatusOK, gin.H{
		"date":       date,
		"count":      len(extensions),
		"extensions": extensions,
	})
}

// CleaningCostMatch — Data 2 (CSV 청소비) vs CleaningTask DB 매칭
func (h *CleaningHandler) CostMatch(c *gin.Context) {
	yearMonth := c.DefaultQuery("year_month", time.Now().Format("2006-01"))

	// Data 2: hostex_transactions에서 청소 비용 (숙소별 월합계)
	type csvRow struct {
		PropertyID   uint   `json:"property_id"`
		PropertyName string `json:"property_name"`
		CsvTotal     int64  `json:"csv_total"`
		TxCount      int64  `json:"tx_count"`
	}
	var csvData []csvRow
	config.DB.Model(&models.HostexTransaction{}).
		Select("property_id, property_name, SUM(ABS(amount)) as csv_total, COUNT(*) as tx_count").
		Where("category = ? AND year_month = ? AND property_id IS NOT NULL", models.TxCatCleaning, yearMonth).
		Group("property_id, property_name").
		Order("property_name ASC").
		Scan(&csvData)

	// CleaningTask DB: 숙소별 월합계
	type taskRow struct {
		PropertyID   uint   `json:"property_id"`
		PropertyName string `json:"property_name"`
		TaskTotal    int64  `json:"task_total"`
		TaskCount    int64  `json:"task_count"`
	}
	var taskData []taskRow
	config.DB.Model(&models.CleaningTask{}).
		Select("property_id, property_name, SUM(total_cost) as task_total, COUNT(*) as task_count").
		Where("cleaning_date LIKE ? AND status IN (?, ?) AND property_id IS NOT NULL",
			yearMonth+"%", models.CleaningStatusCompleted, models.CleaningStatusInProgress).
		Group("property_id, property_name").
		Scan(&taskData)

	// 매칭
	taskMap := map[uint]taskRow{}
	for _, t := range taskData {
		if t.PropertyID > 0 {
			taskMap[t.PropertyID] = t
		}
	}

	type matchRow struct {
		PropertyID   uint   `json:"property_id"`
		PropertyName string `json:"property_name"`
		CsvTotal     int64  `json:"csv_total"`
		CsvCount     int64  `json:"csv_count"`
		TaskTotal    int64  `json:"task_total"`
		TaskCount    int64  `json:"task_count"`
		Diff         int64  `json:"diff"`
		Status       string `json:"status"` // match, over, under, csv_only, task_only
	}

	matched := []matchRow{}
	csvMap := map[uint]bool{}

	for _, csv := range csvData {
		if csv.PropertyID == 0 {
			continue
		}
		csvMap[csv.PropertyID] = true
		m := matchRow{
			PropertyID:   csv.PropertyID,
			PropertyName: csv.PropertyName,
			CsvTotal:     csv.CsvTotal,
			CsvCount:     csv.TxCount,
		}
		if t, ok := taskMap[csv.PropertyID]; ok {
			m.TaskTotal = t.TaskTotal
			m.TaskCount = t.TaskCount
		}
		m.Diff = m.TaskTotal - m.CsvTotal
		if m.Diff == 0 {
			m.Status = "match"
		} else if m.Diff > 0 {
			m.Status = "over"
		} else {
			m.Status = "under"
		}
		if m.TaskTotal == 0 {
			m.Status = "csv_only"
		}
		matched = append(matched, m)
	}

	// task만 있고 csv에 없는 것
	for _, t := range taskData {
		if t.PropertyID > 0 && !csvMap[t.PropertyID] {
			matched = append(matched, matchRow{
				PropertyID:   t.PropertyID,
				PropertyName: t.PropertyName,
				TaskTotal:    t.TaskTotal,
				TaskCount:    t.TaskCount,
				Diff:         t.TaskTotal,
				Status:       "task_only",
			})
		}
	}

	// 합계
	var totalCsv, totalTask int64
	matchCount, mismatchCount := 0, 0
	for _, m := range matched {
		totalCsv += m.CsvTotal
		totalTask += m.TaskTotal
		if m.Status == "match" {
			matchCount++
		} else {
			mismatchCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"year_month":     yearMonth,
		"matches":        matched,
		"total_csv":      totalCsv,
		"total_task":     totalTask,
		"total_diff":     totalTask - totalCsv,
		"match_count":    matchCount,
		"mismatch_count": mismatchCount,
		"property_count": len(matched),
	})
}

// ExportCSV — 청소 기록 전체 CSV 엑스포트
func (h *CleaningHandler) ExportCSV(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	cleanerID := c.Query("cleaner_id")

	db := config.DB.Model(&models.CleaningTask{})
	if startDate != "" {
		db = db.Where("cleaning_date >= ?", startDate)
	}
	if endDate != "" {
		db = db.Where("cleaning_date <= ?", endDate)
	}
	if cleanerID != "" {
		db = db.Where("cleaner_id = ?", cleanerID)
	}

	var tasks []models.CleaningTask
	db.Order("cleaning_date DESC, property_code ASC").Find(&tasks)

	// CSV 생성
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=cleaning_records.csv")

	// BOM for Excel
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})
	c.Writer.WriteString("청소일,숙소코드,숙소명,주소,게스트,청소자,상태,우선순위,기본단가,추가비,합계,시작시각,완료시각,이슈메모\n")

	for _, t := range tasks {
		startedAt := ""
		if t.StartedAt != nil {
			startedAt = t.StartedAt.Format("15:04")
		}
		completedAt := ""
		if t.CompletedAt != nil {
			completedAt = t.CompletedAt.Format("15:04")
		}
		line := fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%d,%d,%d,%s,%s,%s\n",
			t.CleaningDate, t.PropertyCode, t.PropertyName, t.Address,
			t.GuestName, t.CleanerName, t.Status, t.Priority,
			t.BasePrice, t.ExtraCost, t.TotalCost,
			startedAt, completedAt, t.IssueMemo)
		c.Writer.WriteString(line)
	}
}

// AllRecords — 청소 전체 기록 조회 (필터+페이징)
func (h *CleaningHandler) AllRecords(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	cleanerID := c.Query("cleaner_id")
	status := c.Query("status")
	propertyID := c.Query("property_id")
	page := 1
	pageSize := 50
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 { page = v }
	}
	if ps := c.Query("page_size"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 && v <= 200 { pageSize = v }
	}

	db := config.DB.Model(&models.CleaningTask{})
	if startDate != "" { db = db.Where("cleaning_date >= ?", startDate) }
	if endDate != "" { db = db.Where("cleaning_date <= ?", endDate) }
	if cleanerID != "" { db = db.Where("cleaner_id = ?", cleanerID) }
	if status != "" { db = db.Where("status = ?", status) }
	if propertyID != "" { db = db.Where("property_id = ?", propertyID) }

	var total int64
	db.Count(&total)

	var tasks []models.CleaningTask
	db.Order("cleaning_date DESC, id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&tasks)

	// 집계 (같은 필터로 별도 쿼리)
	sumDB := config.DB.Model(&models.CleaningTask{})
	if startDate != "" { sumDB = sumDB.Where("cleaning_date >= ?", startDate) }
	if endDate != "" { sumDB = sumDB.Where("cleaning_date <= ?", endDate) }
	if cleanerID != "" { sumDB = sumDB.Where("cleaner_id = ?", cleanerID) }
	if status != "" { sumDB = sumDB.Where("status = ?", status) }
	if propertyID != "" { sumDB = sumDB.Where("property_id = ?", propertyID) }
	var sumBase, sumExtra, sumTotal int64
	sumDB.Select("COALESCE(SUM(base_price),0), COALESCE(SUM(extra_cost),0), COALESCE(SUM(total_cost),0)").
		Row().Scan(&sumBase, &sumExtra, &sumTotal)

	c.JSON(http.StatusOK, gin.H{
		"tasks":      tasks,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"sum_base":   sumBase,
		"sum_extra":  sumExtra,
		"sum_total":  sumTotal,
	})
}

// WeeklySettlement — 관리자용 전체 청소자 주간 정산표
func (h *CleaningHandler) WeeklySettlement(c *gin.Context) {
	weekStart := c.Query("week_start")
	weekEnd := c.Query("week_end")

	if weekStart == "" || weekEnd == "" {
		now := time.Now()
		weekday := int(now.Weekday())
		if weekday == 0 { weekday = 7 }
		monday := now.AddDate(0, 0, -(weekday - 1))
		sunday := monday.AddDate(0, 0, 6)
		weekStart = monday.Format("2006-01-02")
		weekEnd = sunday.Format("2006-01-02")
	}

	result := h.svc.GetWeeklySettlement(weekStart, weekEnd)
	c.JSON(http.StatusOK, result)
}

// Dispatch — 배정 메시지 발송 상태로 전환
func (h *CleaningHandler) Dispatch(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	task, err := h.svc.Dispatch(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

// BulkDispatch — 오늘 배정된 모든 태스크 일괄 발송
func (h *CleaningHandler) BulkDispatch(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		now := time.Now()
		date = now.Format("2006-01-02")
	}

	count, err := h.svc.BulkDispatch(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "일괄 발송 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"dispatched": count, "date": date})
}

// GetDispatchMessage — 특정 태스크의 배정 메시지 조회
func (h *CleaningHandler) GetDispatchMessage(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var task models.CleaningTask
	if err := config.DB.First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "태스크 없음"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": task.DispatchMessage, "status": task.Status})
}

func parseUint(s string) (uint, error) {
	id, err := strconv.ParseUint(s, 10, 32)
	return uint(id), err
}
