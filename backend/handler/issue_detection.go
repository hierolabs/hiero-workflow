package handler

import (
	"net/http"
	"strconv"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type IssueDetectionHandler struct {
	svc *service.IssueDetectorService
}

func NewIssueDetectionHandler() *IssueDetectionHandler {
	return &IssueDetectionHandler{svc: service.NewIssueDetectorService()}
}

// GET /admin/issue-detections — 감지 목록 (status, date 필터)
func (h *IssueDetectionHandler) ListPending(c *gin.Context) {
	status := c.Query("status")
	date := c.Query("date")   // 단일 날짜
	start := c.Query("start") // 범위 시작
	end := c.Query("end")     // 범위 끝
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "500"))
	if limit <= 0 || limit > 1000 {
		limit = 500
	}

	var detections []models.IssueDetection
	query := config.DB.Model(&models.IssueDetection{})

	// 날짜 필터
	if start != "" && end != "" {
		query = query.Where("DATE(created_at) >= ? AND DATE(created_at) <= ?", start, end)
	} else if date != "" {
		query = query.Where("DATE(created_at) = ?", date)
	}

	// 상태 필터
	if status == "" || status == "pending" {
		if date == "" {
			// 기존 동작: pending만
			detections = h.svc.ListPending()
		} else {
			query.Where("status IN ?", []string{"pending", "responding"}).
				Order("created_at DESC").Limit(limit).Find(&detections)
		}
	} else if status == "all" {
		query.Order("created_at DESC").Limit(limit).Find(&detections)
	} else {
		query.Where("status = ?", status).Order("created_at DESC").Limit(limit).Find(&detections)
	}

	c.JSON(http.StatusOK, gin.H{
		"detections": detections,
		"total":      len(detections),
	})
}

// POST /admin/issue-detections/scan — 최근 메시지 스캔
func (h *IssueDetectionHandler) Scan(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	detected := h.svc.ScanRecentMessages(limit)
	c.JSON(http.StatusOK, gin.H{
		"message":  "스캔 완료",
		"detected": detected,
	})
}

// POST /admin/issue-detections/batch-resolve — 미처리 전부 resolved 처리
func (h *IssueDetectionHandler) BatchResolve(c *gin.Context) {
	now := time.Now()
	result := config.DB.Model(&models.IssueDetection{}).
		Where("status IN ?", []string{"pending", "responding"}).
		Updates(map[string]interface{}{
			"status":          "resolved",
			"resolved_at":     now,
			"resolution_type": "guide",
			"resolution_team": "office",
			"resolution_note": "과거 일괄 처리",
		})

	c.JSON(http.StatusOK, gin.H{
		"message": "일괄 처리 완료",
		"updated": result.RowsAffected,
	})
}

// POST /admin/issue-detections/backfill-source — 과거 전체 HS 리셋
// 과거 데이터는 실제 업무 흐름이 아니므로 전부 HS로 초기화
// 이슈로 등록된 건만 escalated 유지
func (h *IssueDetectionHandler) BackfillSource(c *gin.Context) {
	now := time.Now()

	// 전부 HS로
	hsResult := config.DB.Model(&models.IssueDetection{}).
		Where("status != ?", "issue_created").
		Updates(map[string]interface{}{
			"resolution_source": "hs",
			"assigned_to":      "HS",
			"status":           "resolved",
			"resolved_at":      now,
			"resolution_type":  "guide",
			"resolution_note":  "HS 초기화",
		})

	// issue_created만 escalated
	escResult := config.DB.Model(&models.IssueDetection{}).
		Where("status = ?", "issue_created").
		Update("resolution_source", "escalated")

	c.JSON(http.StatusOK, gin.H{
		"message":   "전체 HS 초기화 완료",
		"hs":        hsResult.RowsAffected,
		"escalated": escResult.RowsAffected,
	})
}

// POST /admin/issue-detections/reset-handlers — HS 건은 "HS", 나머지는 실제 응답자만 유지
func (h *IssueDetectionHandler) ResetHandlers(c *gin.Context) {
	// HS → assigned_to = "HS"
	hsResult := config.DB.Model(&models.IssueDetection{}).
		Where("resolution_source = ?", "hs").
		Update("assigned_to", "HS")

	// human/escalated 중 실제 respond 안 한 건 (responded_at이 NULL) → 비움
	humanResult := config.DB.Model(&models.IssueDetection{}).
		Where("resolution_source != ? AND responded_at IS NULL", "hs").
		Update("assigned_to", "")

	c.JSON(http.StatusOK, gin.H{
		"message":    "담당자 리셋 완료",
		"hs_marked":  hsResult.RowsAffected,
		"human_cleared": humanResult.RowsAffected,
	})
}

// GET /admin/issue-detections/ledger — 감지 대장 (일별 요약)
func (h *IssueDetectionHandler) Ledger(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}

	type DayRow struct {
		Date      string `json:"date"`
		Total     int    `json:"total"`
		Resolved  int    `json:"resolved"`
		Pending   int    `json:"pending"`
		Issue     int    `json:"issue_created"`
		Dismissed int    `json:"dismissed"`
		AvgResp   int    `json:"avg_response_sec"`
		AICount   int    `json:"ai_count"`
		HS        int    `json:"hs"`        // 자동 처리
		Human     int    `json:"human"`     // 사람 개입
		Escalated int    `json:"escalated"` // 민원 에스컬레이션
	}

	var rows []struct {
		Date    string
		Status  string
		Src     string
		Count   int
		AvgResp float64
		AICnt   int
	}
	config.DB.Model(&models.IssueDetection{}).
		Select("DATE_FORMAT(created_at, '%Y-%m-%d') as date, status, COALESCE(resolution_source,'') as src, COUNT(*) as count, AVG(response_time_sec) as avg_resp, SUM(CASE WHEN ai_assisted=1 THEN 1 ELSE 0 END) as ai_cnt").
		Where("created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", days).
		Group("date, status, src").
		Order("date DESC").
		Find(&rows)

	dayMap := map[string]*DayRow{}
	for _, r := range rows {
		if _, ok := dayMap[r.Date]; !ok {
			dayMap[r.Date] = &DayRow{Date: r.Date}
		}
		d := dayMap[r.Date]
		d.Total += r.Count
		d.AICount += r.AICnt
		switch r.Status {
		case "resolved":
			d.Resolved += r.Count
			d.AvgResp = int(r.AvgResp)
		case "pending", "responding":
			d.Pending += r.Count
		case "issue_created":
			d.Issue += r.Count
		case "dismissed":
			d.Dismissed += r.Count
		}
		switch r.Src {
		case "hs":
			d.HS += r.Count
		case "human":
			d.Human += r.Count
		case "escalated":
			d.Escalated += r.Count
		}
	}

	// 정렬
	result := make([]DayRow, 0, len(dayMap))
	for _, v := range dayMap {
		result = append(result, *v)
	}
	// 날짜 내림차순 정렬
	for i := 0; i < len(result); i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].Date > result[i].Date {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	// 전체 합산
	var totalAll, totalResolved, totalPending, totalIssue, totalDismissed, totalAI, totalHS, totalHuman, totalEscalated int
	for _, r := range result {
		totalAll += r.Total
		totalResolved += r.Resolved
		totalPending += r.Pending
		totalIssue += r.Issue
		totalDismissed += r.Dismissed
		totalAI += r.AICount
		totalHS += r.HS
		totalHuman += r.Human
		totalEscalated += r.Escalated
	}

	hsRate := 0
	if totalAll > 0 {
		hsRate = totalHS * 100 / totalAll
	}

	c.JSON(http.StatusOK, gin.H{
		"days":  result,
		"total": len(result),
		"summary": gin.H{
			"total":         totalAll,
			"resolved":      totalResolved,
			"pending":       totalPending,
			"issue_created": totalIssue,
			"dismissed":     totalDismissed,
			"ai_count":      totalAI,
			"hs":            totalHS,
			"human":         totalHuman,
			"escalated":     totalEscalated,
			"hs_rate":       hsRate,
			"resolve_rate":  func() int { if totalAll > 0 { return totalResolved * 100 / totalAll }; return 0 }(),
		},
	})
}

// POST /admin/issue-detections/:id/create-issue — 감지 → 이슈 생성
func (h *IssueDetectionHandler) CreateIssue(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	issue, err := h.svc.CreateIssueFromDetection(uint(id))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, issue)
}

// POST /admin/issue-detections/:id/dismiss — 감지 무시
func (h *IssueDetectionHandler) Dismiss(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	if err := h.svc.DismissDetection(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "무시 처리 완료"})
}

// POST /admin/issue-detections/:id/respond — 대응 시작 (응답 시각 기록)
func (h *IssueDetectionHandler) Respond(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var det models.IssueDetection
	if err := config.DB.First(&det, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var body struct {
		AssignedTo string `json:"assigned_to"`
		AiAssisted bool   `json:"ai_assisted"`
	}
	c.ShouldBindJSON(&body)

	now := time.Now()
	det.RespondedAt = &now
	det.Status = "responding"
	det.AssignedTo = body.AssignedTo
	det.AiAssisted = body.AiAssisted
	det.ResponseTimeSec = int(now.Sub(det.CreatedAt).Seconds())

	config.DB.Save(&det)
	c.JSON(http.StatusOK, det)
}

// POST /admin/issue-detections/:id/resolve — 대응 완료 (해결 시각 + 유형 기록)
func (h *IssueDetectionHandler) Resolve(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var det models.IssueDetection
	if err := config.DB.First(&det, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var body struct {
		ResolutionType string `json:"resolution_type"` // guide | action
		ResolutionTeam string `json:"resolution_team"` // office | field
		ResolutionNote string `json:"resolution_note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	det.ResolvedAt = &now
	det.Status = "resolved"
	det.ResolutionType = body.ResolutionType
	det.ResolutionTeam = body.ResolutionTeam
	det.ResolutionNote = body.ResolutionNote
	det.ResolveTimeSec = int(now.Sub(det.CreatedAt).Seconds())

	config.DB.Save(&det)
	c.JSON(http.StatusOK, det)
}

// POST /admin/issue-detections/backfill-reservation — 기존 감지에 reservation_code 백필
func (h *IssueDetectionHandler) BackfillReservation(c *gin.Context) {
	var detections []models.IssueDetection
	config.DB.Where("reservation_code = '' OR reservation_code IS NULL").Find(&detections)

	updated := 0
	for _, d := range detections {
		var conv models.Conversation
		if err := config.DB.Where("conversation_id = ?", d.ConversationID).First(&conv).Error; err != nil {
			continue
		}
		if conv.ReservationCode == "" {
			continue
		}
		config.DB.Model(&d).Update("reservation_code", conv.ReservationCode)
		updated++
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "백필 완료",
		"total":   len(detections),
		"updated": updated,
	})
}

// GET /admin/issue-detections/by-reservation/:code — 예약코드 기반 통합 뷰
func (h *IssueDetectionHandler) ByReservation(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reservation_code required"})
		return
	}

	// 1) 예약 정보
	var reservation models.Reservation
	config.DB.Where("reservation_code = ?", code).First(&reservation)

	// 2) 감지 이력
	var detections []models.IssueDetection
	config.DB.Where("reservation_code = ?", code).Order("created_at DESC").Find(&detections)

	// 3) 청소 태스크
	var cleaningTasks []models.CleaningTask
	config.DB.Where("reservation_code = ?", code).Order("cleaning_date DESC").Find(&cleaningTasks)

	// 4) 이슈
	var issues []models.Issue
	config.DB.Where("reservation_code = ?", code).Order("created_at DESC").Find(&issues)

	// 5) 메시지 수
	var msgCount int64
	var conv models.Conversation
	if err := config.DB.Where("reservation_code = ?", code).First(&conv).Error; err == nil {
		config.DB.Model(&models.Message{}).Where("conversation_id = ?", conv.ConversationID).Count(&msgCount)
	}

	// 감지 요약
	catSummary := map[string]int{}
	statusSummary := map[string]int{}
	for _, d := range detections {
		catSummary[d.DetectedCategory]++
		statusSummary[d.Status]++
	}

	c.JSON(http.StatusOK, gin.H{
		"reservation_code": code,
		"reservation":      reservation,
		"detections":       detections,
		"cleaning_tasks":   cleaningTasks,
		"issues":           issues,
		"message_count":    msgCount,
		"summary": gin.H{
			"detection_total":  len(detections),
			"by_category":     catSummary,
			"by_status":       statusSummary,
			"cleaning_count":  len(cleaningTasks),
			"issue_count":     len(issues),
		},
	})
}

// GET /admin/issue-detections/resolved — 대응완료 목록 (날짜 범위 지원)
func (h *IssueDetectionHandler) ListResolved(c *gin.Context) {
	startDate := c.DefaultQuery("start", time.Now().Format("2006-01-02"))
	endDate := c.DefaultQuery("end", time.Now().Format("2006-01-02"))

	var items []models.IssueDetection
	config.DB.Where("status = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?", "resolved", startDate, endDate).
		Order("created_at DESC").Find(&items)

	// 통계
	var guideCount, actionCount, aiCount, issueCreated int
	var totalResponseSec, totalResolveSec int
	catCount := map[string]int{}
	catResp := map[string]int{}
	for _, d := range items {
		if d.ResolutionType == "guide" {
			guideCount++
		} else {
			actionCount++
		}
		if d.AiAssisted {
			aiCount++
		}
		totalResponseSec += d.ResponseTimeSec
		totalResolveSec += d.ResolveTimeSec
		catCount[d.DetectedCategory]++
		catResp[d.DetectedCategory] += d.ResponseTimeSec
	}

	// 이슈로 전달된 건
	var issueItems []models.IssueDetection
	config.DB.Where("status = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?", "issue_created", startDate, endDate).Find(&issueItems)
	issueCreated = len(issueItems)

	// dismissed 건
	var dismissedCount int64
	config.DB.Model(&models.IssueDetection{}).Where("status = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?", "dismissed", startDate, endDate).Count(&dismissedCount)

	// pending 건
	var pendingCount int64
	config.DB.Model(&models.IssueDetection{}).Where("status IN (?,?) AND DATE(created_at) >= ? AND DATE(created_at) <= ?", "pending", "responding", startDate, endDate).Count(&pendingCount)

	avgResponse := 0
	avgResolve := 0
	if len(items) > 0 {
		avgResponse = totalResponseSec / len(items)
		avgResolve = totalResolveSec / len(items)
	}

	// 카테고리별 통계
	categories := []gin.H{}
	for cat, cnt := range catCount {
		avgR := 0
		if cnt > 0 {
			avgR = catResp[cat] / cnt
		}
		categories = append(categories, gin.H{
			"category":         cat,
			"count":            cnt,
			"avg_response_sec": avgR,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": len(items),
		"stats": gin.H{
			"guide_count":      guideCount,
			"action_count":     actionCount,
			"ai_count":         aiCount,
			"issue_created":    issueCreated,
			"dismissed":        int(dismissedCount),
			"pending":          int(pendingCount),
			"avg_response_sec": avgResponse,
			"avg_resolve_sec":  avgResolve,
			"categories":       categories,
		},
		"period": gin.H{"start": startDate, "end": endDate},
	})
}
