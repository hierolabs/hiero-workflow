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

type MessageHandler struct {
	msgSvc      *service.MessageService
	reqSvc      *service.GuestRequestService
	analysisSvc *service.MessageAnalysisService
	reviewSvc   *service.ReviewService
}

func NewMessageHandler() *MessageHandler {
	return &MessageHandler{
		msgSvc:      service.NewMessageService(),
		reqSvc:      service.NewGuestRequestService(),
		analysisSvc: service.NewMessageAnalysisService(),
		reviewSvc:   service.NewReviewService(),
	}
}

// ListConversations — 대화 목록
func (h *MessageHandler) ListConversations(c *gin.Context) {
	propertyID, _ := strconv.ParseInt(c.Query("property_id"), 10, 64)
	keyword := c.Query("keyword")
	hasUnread := c.Query("has_unread") == "true"
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "30"))

	convs, total, err := h.msgSvc.ListConversations(propertyID, keyword, hasUnread, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().Add(-24 * time.Hour).Format("2006-01-02")

	type EnrichedConv struct {
		models.Conversation
		DetectionCount int64  `json:"detection_count"`
		MaxSeverity    string `json:"max_severity"`
		PropertyName   string `json:"property_name"`
		CheckIn        string `json:"check_in"`
		CheckOut       string `json:"check_out"`
		StayStatus     string `json:"stay_status"`
		GuestType      string `json:"guest_type"` // inquiry(예약전), cancelled(취소), upcoming(예정), in_house(투숙중), checked_out(퇴실), past(과거)
		ReservationStatus string `json:"reservation_status"` // 원본 예약 상태
		MessageDate    string `json:"message_date"`
		// 감지 처리 성과
		ResolvedCount  int    `json:"resolved_count"`
		AvgResponseSec int    `json:"avg_response_sec"`
		LastHandler    string `json:"last_handler"`
		LastStatus     string `json:"last_status"`
		AiAssisted     bool   `json:"ai_assisted"`
	}

	// 벌크: 감지 건수 (conversation_id별)
	type detCount struct {
		ConversationID string
		Count          int64
		MaxSev         string
	}
	var detCounts []detCount
	config.DB.Model(&models.IssueDetection{}).
		Select("conversation_id, COUNT(*) as count, MAX(CASE WHEN severity='critical' THEN 3 WHEN severity='high' THEN 2 WHEN severity='medium' THEN 1 ELSE 0 END) as max_sev").
		Where("status = ?", "pending").
		Group("conversation_id").
		Find(&detCounts)
	detMap := map[string]detCount{}
	for _, dc := range detCounts {
		detMap[dc.ConversationID] = dc
	}

	// 벌크: 감지 처리 성과 (conversation_id별 — 전체 상태)
	type detPerf struct {
		ConversationID string
		Resolved       int
		AvgResp        int
		LastHandler    string
		LastStatus     string
		HasAI          bool
	}
	convIDs := make([]string, len(convs))
	for i, c := range convs {
		convIDs[i] = c.ConversationID
	}
	detPerfMap := map[string]detPerf{}
	if len(convIDs) > 0 {
		// 해결 건수 + 평균 응답시간
		type perfRow struct {
			ConversationID string
			ResolvedCnt    int
			AvgResp        int
		}
		var perfRows []perfRow
		config.DB.Model(&models.IssueDetection{}).
			Select("conversation_id, COUNT(*) as resolved_cnt, AVG(response_time_sec) as avg_resp").
			Where("conversation_id IN ? AND status IN ?", convIDs, []string{"resolved", "issue_created", "dismissed"}).
			Group("conversation_id").
			Find(&perfRows)
		for _, pr := range perfRows {
			detPerfMap[pr.ConversationID] = detPerf{
				ConversationID: pr.ConversationID,
				Resolved:       pr.ResolvedCnt,
				AvgResp:        pr.AvgResp,
			}
		}

		// 최근 처리자 + 상태 (서브쿼리 대신 전체 조회 후 매핑)
		var recentDets []models.IssueDetection
		config.DB.Where("conversation_id IN ? AND status != ?", convIDs, "pending").
			Order("created_at DESC").
			Find(&recentDets)
		seen := map[string]bool{}
		for _, d := range recentDets {
			if seen[d.ConversationID] {
				continue
			}
			seen[d.ConversationID] = true
			p := detPerfMap[d.ConversationID]
			p.ConversationID = d.ConversationID
			p.LastHandler = d.AssignedTo
			p.LastStatus = d.Status
			p.HasAI = d.AiAssisted
			detPerfMap[d.ConversationID] = p
		}
	}

	// 전체 성과 요약 (이 페이지의 500개 대화 대상)
	type perfSummary struct {
		TotalDetected  int            `json:"total_detected"`
		TotalResolved  int            `json:"total_resolved"`
		TotalPending   int            `json:"total_pending"`
		AvgResponseSec int            `json:"avg_response_sec"`
		AICount        int            `json:"ai_count"`
		ByHandler      map[string]int `json:"by_handler"`
		ByCategory     map[string]int `json:"by_category"`
		ByStatus       map[string]int `json:"by_status"`
	}
	summary := perfSummary{
		ByHandler:  map[string]int{},
		ByCategory: map[string]int{},
		ByStatus:   map[string]int{},
	}
	if len(convIDs) > 0 {
		var allDets []models.IssueDetection
		config.DB.Where("conversation_id IN ?", convIDs).Find(&allDets)
		totalResp := 0
		respCount := 0
		for _, d := range allDets {
			summary.TotalDetected++
			summary.ByCategory[d.DetectedCategory]++
			summary.ByStatus[d.Status]++
			if d.Status == "pending" || d.Status == "responding" {
				summary.TotalPending++
			} else {
				summary.TotalResolved++
			}
			if d.AiAssisted {
				summary.AICount++
			}
			if d.AssignedTo != "" {
				summary.ByHandler[d.AssignedTo]++
			}
			if d.ResponseTimeSec > 0 {
				totalResp += d.ResponseTimeSec
				respCount++
			}
		}
		if respCount > 0 {
			summary.AvgResponseSec = totalResp / respCount
		}
	}

	// 벌크: 예약 정보 (reservation_code별)
	resCodes := []string{}
	for _, conv := range convs {
		if conv.ReservationCode != "" {
			resCodes = append(resCodes, conv.ReservationCode)
		}
	}
	type rsvInfo struct {
		ReservationCode string
		CheckInDate     string
		CheckOutDate    string
		InternalPropID  *uint
		Status          string
		CancelledAt     *string
	}
	var rsvs []rsvInfo
	if len(resCodes) > 0 {
		config.DB.Model(&models.Reservation{}).
			Select("reservation_code, check_in_date, check_out_date, internal_prop_id, status, cancelled_at").
			Where("reservation_code IN ?", resCodes).
			Find(&rsvs)
	}
	rsvMap := map[string]rsvInfo{}
	for _, r := range rsvs {
		rsvMap[r.ReservationCode] = r
	}

	// 벌크: 숙소 이름
	propIDs := []uint{}
	for _, r := range rsvs {
		if r.InternalPropID != nil {
			propIDs = append(propIDs, *r.InternalPropID)
		}
	}
	propNames := map[uint]string{}
	if len(propIDs) > 0 {
		var props []models.Property
		config.DB.Select("id, name, display_name").Where("id IN ?", propIDs).Find(&props)
		for _, p := range props {
			if p.DisplayName != "" {
				propNames[p.ID] = p.DisplayName
			} else {
				propNames[p.ID] = p.Name
			}
		}
	}

	// 조립
	sevLabels := map[string]string{"3": "critical", "2": "high", "1": "medium", "0": "low"}
	enriched := make([]EnrichedConv, len(convs))
	for i, conv := range convs {
		e := EnrichedConv{Conversation: conv}

		if dc, ok := detMap[conv.ConversationID]; ok {
			e.DetectionCount = dc.Count
			e.MaxSeverity = sevLabels[dc.MaxSev]
		}
		if dp, ok := detPerfMap[conv.ConversationID]; ok {
			e.ResolvedCount = dp.Resolved
			e.AvgResponseSec = dp.AvgResp
			e.LastHandler = dp.LastHandler
			e.LastStatus = dp.LastStatus
			e.AiAssisted = dp.HasAI
		}

		if conv.ReservationCode == "" {
			// 예약코드 없음 = 예약 전 문의
			e.GuestType = "inquiry"
		} else if rsv, ok := rsvMap[conv.ReservationCode]; ok {
			e.CheckIn = rsv.CheckInDate
			e.CheckOut = rsv.CheckOutDate
			e.ReservationStatus = rsv.Status
			if rsv.InternalPropID != nil {
				e.PropertyName = propNames[*rsv.InternalPropID]
			}
			// GuestType 결정
			if rsv.CancelledAt != nil && *rsv.CancelledAt != "" {
				e.GuestType = "cancelled"
				e.StayStatus = "cancelled"
			} else if rsv.Status == "cancelled" || rsv.Status == "declined" {
				e.GuestType = "cancelled"
				e.StayStatus = "cancelled"
			} else if rsv.CheckInDate == today {
				e.GuestType = "checking_in"
				e.StayStatus = "checking_in"
			} else if rsv.CheckInDate <= today && rsv.CheckOutDate > today {
				e.GuestType = "in_house"
				e.StayStatus = "in_house"
			} else if rsv.CheckOutDate == today {
				e.GuestType = "checked_out"
				e.StayStatus = "checked_out"
			} else if rsv.CheckInDate > today {
				e.GuestType = "upcoming"
				e.StayStatus = "upcoming"
			} else {
				e.GuestType = "past"
				e.StayStatus = "past"
			}
		} else {
			// reservation_code는 있지만 예약 DB에 없음 (삭제됨 등)
			e.GuestType = "inquiry"
		}

		if conv.LastMessageAt != nil {
			msgDate := conv.LastMessageAt.Format("2006-01-02")
			if msgDate == today {
				e.MessageDate = "today"
			} else if msgDate == yesterday {
				e.MessageDate = "yesterday"
			} else {
				e.MessageDate = "older"
			}
		}

		enriched[i] = e
	}

	c.JSON(http.StatusOK, gin.H{
		"conversations":      enriched,
		"total":              total,
		"page":               page,
		"page_size":          pageSize,
		"performance_summary": summary,
	})
}

// GetConversation — 대화 상세 + 메시지 + 요청
func (h *MessageHandler) GetConversation(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	conv, err := h.msgSvc.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "대화를 찾을 수 없습니다"})
		return
	}

	msgs, _ := h.msgSvc.GetMessages(conversationID)
	requests := h.reqSvc.ListByConversation(conversationID)

	// 예약 정보 (체크인/아웃/숙소)
	var reservationInfo map[string]interface{}
	if conv.ReservationCode != "" {
		var rsv models.Reservation
		if err := config.DB.Where("reservation_code = ?", conv.ReservationCode).First(&rsv).Error; err == nil {
			propName := ""
			if rsv.InternalPropID != nil {
				var p models.Property
				if config.DB.First(&p, *rsv.InternalPropID).Error == nil {
					propName = p.DisplayName
					if propName == "" {
						propName = p.Name
					}
				}
			}
			reservationInfo = map[string]interface{}{
				"reservation_code": rsv.ReservationCode,
				"check_in":        rsv.CheckInDate,
				"check_out":       rsv.CheckOutDate,
				"nights":          rsv.Nights,
				"status":          rsv.Status,
				"guest_name":      rsv.GuestName,
				"property_name":   propName,
				"channel":         rsv.ChannelName,
				"total_rate":      rsv.TotalRate,
			}
		}
	}

	// 이 대화에서 감지된 이슈
	var detections []models.IssueDetection
	config.DB.Where("conversation_id = ?", conversationID).
		Order("created_at DESC").Limit(10).Find(&detections)

	// 읽음 처리
	h.msgSvc.MarkRead(conversationID)

	c.JSON(http.StatusOK, gin.H{
		"conversation": conv,
		"messages":     msgs,
		"requests":     requests,
		"reservation":  reservationInfo,
		"detections":   detections,
	})
}

// SendMessage — 메시지 발송
func (h *MessageHandler) SendMessage(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	var body struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "메시지를 입력해주세요"})
		return
	}

	msg, err := h.msgSvc.SendMessage(conversationID, body.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "메시지 발송 실패: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": msg})
}

// MarkRead — 읽음 처리
func (h *MessageHandler) MarkRead(c *gin.Context) {
	conversationID := c.Param("conversation_id")
	h.msgSvc.MarkRead(conversationID)
	c.JSON(http.StatusOK, gin.H{"message": "읽음 처리 완료"})
}

// SyncMessages — 대화 + 메시지 동기화
func (h *MessageHandler) SyncMessages(c *gin.Context) {
	go func() {
		h.msgSvc.SyncConversationsWithMessages()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "대화 + 메시지 동기화 시작됨"})
}

// SyncAllMessages — 모든 대화의 메시지 전체 동기화
func (h *MessageHandler) SyncAllMessages(c *gin.Context) {
	go func() {
		h.msgSvc.SyncAllMessages()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "전체 메시지 동기화 시작됨 (백그라운드 진행 중)"})
}

// SyncConversationMessages — 특정 대화 메시지 동기화
func (h *MessageHandler) SyncConversationMessages(c *gin.Context) {
	conversationID := c.Param("conversation_id")
	count, err := h.msgSvc.SyncConversationMessages(conversationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "동기화 완료", "synced": count})
}

// CreateGuestRequest — 게스트 요청 생성
func (h *MessageHandler) CreateGuestRequest(c *gin.Context) {
	conversationID := c.Param("conversation_id")

	var body struct {
		RequestType string `json:"request_type" binding:"required"`
		Note        string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 타입을 선택해주세요"})
		return
	}

	// 대화에서 예약/숙소 정보 가져오기
	conv, err := h.msgSvc.GetConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "대화를 찾을 수 없습니다"})
		return
	}

	req := models.GuestRequest{
		ConversationID:  conversationID,
		ReservationCode: conv.ReservationCode,
		PropertyID:      conv.PropertyID,
		InternalPropID:  conv.InternalPropID,
		RequestType:     body.RequestType,
		Note:            body.Note,
		Status:          "pending",
	}

	created, err := h.reqSvc.Create(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"request": created})
}

// UpdateGuestRequestStatus — 요청 상태 변경
func (h *MessageHandler) UpdateGuestRequestStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "상태를 입력해주세요"})
		return
	}

	if err := h.reqSvc.UpdateStatus(uint(id), body.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "상태 변경 완료"})
}

// ListPendingRequests — 미처리 요청 전체
func (h *MessageHandler) ListPendingRequests(c *gin.Context) {
	reqs := h.reqSvc.ListPending()
	c.JSON(http.StatusOK, gin.H{"requests": reqs})
}

// SyncReviews — 리뷰 동기화
func (h *MessageHandler) SyncReviews(c *gin.Context) {
	go func() {
		h.reviewSvc.SyncReviews()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "리뷰 동기화 시작됨"})
}

// AnalyzeMessages — 기간별 메시지+리뷰 이슈 분석 (day/week/month)
func (h *MessageHandler) AnalyzeMessages(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	result, err := h.analysisSvc.Analyze(period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// AnalyzeInsight — 게스트 인사이트 분석 (왜 여기를 골랐는가)
func (h *MessageHandler) AnalyzeInsight(c *gin.Context) {
	startDate := c.DefaultQuery("start", "")
	endDate := c.DefaultQuery("end", "")
	result, err := h.analysisSvc.AnalyzeInsight(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GET /admin/messages/stats?start=2026-04-01&end=2026-04-30 — 기간별 메시지 통계
func (h *MessageHandler) Stats(c *gin.Context) {
	start := c.DefaultQuery("start", time.Now().Format("2006-01-02"))
	end := c.DefaultQuery("end", time.Now().Format("2006-01-02"))

	var total, guest, host int64
	config.DB.Model(&models.Message{}).Where("DATE(sent_at) >= ? AND DATE(sent_at) <= ?", start, end).Count(&total)
	config.DB.Model(&models.Message{}).Where("DATE(sent_at) >= ? AND DATE(sent_at) <= ? AND sender_type = ?", start, end, "guest").Count(&guest)
	config.DB.Model(&models.Message{}).Where("DATE(sent_at) >= ? AND DATE(sent_at) <= ? AND sender_type = ?", start, end, "host").Count(&host)

	var convs int64
	config.DB.Model(&models.Message{}).Where("DATE(sent_at) >= ? AND DATE(sent_at) <= ?", start, end).
		Distinct("conversation_id").Count(&convs)

	c.JSON(http.StatusOK, gin.H{
		"total": total, "guest": guest, "host": host, "convs": convs,
		"period": gin.H{"start": start, "end": end},
	})
}
