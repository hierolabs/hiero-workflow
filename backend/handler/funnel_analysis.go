package handler

import (
	"net/http"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type FunnelHandler struct{}

func NewFunnelHandler() *FunnelHandler { return &FunnelHandler{} }

// GET /admin/analysis/funnel?period=month&from=2026-04-12&to=2026-05-12
func (h *FunnelHandler) Analyze(c *gin.Context) {
	from := c.DefaultQuery("from", time.Now().Add(-30*24*time.Hour).Format("2006-01-02"))
	to := c.DefaultQuery("to", time.Now().Format("2006-01-02"))
	prevDays := int(time.Since(mustParseDate(from)).Hours()/24) * 2
	prevFrom := mustParseDate(from).Add(-time.Duration(prevDays/2) * 24 * time.Hour).Format("2006-01-02")
	prevTo := from

	// ═══ Stage 1: 문제 정의 (예약 추이) ═══
	type channelTrend struct {
		Month       string `json:"month"`
		ChannelType string `json:"channel_type"`
		Cnt         int    `json:"cnt"`
	}
	var trends []channelTrend
	config.DB.Model(&models.Reservation{}).
		Select("LEFT(check_in_date,7) as month, channel_type, COUNT(*) as cnt").
		Where("check_in_date >= ? AND check_in_date <= ? AND status NOT IN ('cancelled','canceled')", from, to).
		Group("month, channel_type").Order("month").
		Find(&trends)

	var prevTrends []channelTrend
	config.DB.Model(&models.Reservation{}).
		Select("LEFT(check_in_date,7) as month, channel_type, COUNT(*) as cnt").
		Where("check_in_date >= ? AND check_in_date < ? AND status NOT IN ('cancelled','canceled')", prevFrom, prevTo).
		Group("month, channel_type").Order("month").
		Find(&prevTrends)

	// 숙소별 증감
	type propChange struct {
		PropertyName string `json:"property_name"`
		Current      int    `json:"current"`
		Previous     int    `json:"previous"`
		Change       int    `json:"change"`
	}
	var propCurrent []struct {
		InternalPropID uint
		Cnt            int
	}
	config.DB.Model(&models.Reservation{}).
		Select("internal_prop_id, COUNT(*) as cnt").
		Where("check_in_date >= ? AND check_in_date <= ? AND status NOT IN ('cancelled','canceled') AND internal_prop_id IS NOT NULL", from, to).
		Group("internal_prop_id").Find(&propCurrent)

	var propPrev []struct {
		InternalPropID uint
		Cnt            int
	}
	config.DB.Model(&models.Reservation{}).
		Select("internal_prop_id, COUNT(*) as cnt").
		Where("check_in_date >= ? AND check_in_date < ? AND status NOT IN ('cancelled','canceled') AND internal_prop_id IS NOT NULL", prevFrom, prevTo).
		Group("internal_prop_id").Find(&propPrev)

	// 숙소 이름 캐시
	propNames := map[uint]string{}
	var props []models.Property
	config.DB.Find(&props)
	for _, p := range props {
		name := p.DisplayName
		if name == "" {
			name = p.Name
		}
		propNames[p.ID] = name
	}

	prevMap := map[uint]int{}
	for _, pp := range propPrev {
		prevMap[pp.InternalPropID] = pp.Cnt
	}
	var propChanges []propChange
	for _, pc := range propCurrent {
		prev := prevMap[pc.InternalPropID]
		propChanges = append(propChanges, propChange{
			PropertyName: propNames[pc.InternalPropID],
			Current:      pc.Cnt,
			Previous:     prev,
			Change:       pc.Cnt - prev,
		})
	}

	// ═══ Stage 2: 기능 분류 (메시지 태그 집계) ═══
	type tagSummary struct {
		Category     string `json:"category"`
		TagType      string `json:"tag_type"`
		Cnt          int    `json:"cnt"`
		PropertyName string `json:"property_name,omitempty"`
	}
	var tagsByCategory []tagSummary
	config.DB.Model(&models.MessageTag{}).
		Select("tag_type, category, COUNT(*) as cnt").
		Where("sent_at >= ? AND sent_at <= ?", from, to+" 23:59:59").
		Group("tag_type, category").Order("cnt DESC").
		Find(&tagsByCategory)

	var tagsByProperty []tagSummary
	config.DB.Model(&models.MessageTag{}).
		Select("property_name, category, COUNT(*) as cnt").
		Where("tag_type = 'insight' AND sent_at >= ? AND sent_at <= ? AND property_name != ''", from, to+" 23:59:59").
		Group("property_name, category").Order("cnt DESC").Limit(100).
		Find(&tagsByProperty)

	// ═══ Stage 3: 맥락 연결 (대화 케이스) ═══
	type conversationCase struct {
		ConversationID string  `json:"conversation_id"`
		GuestName      string  `json:"guest_name"`
		PropertyName   string  `json:"property_name"`
		ChannelType    string  `json:"channel_type"`
		CheckIn        string  `json:"check_in"`
		CheckOut       string  `json:"check_out"`
		Nights         int     `json:"nights"`
		TotalRate      int64   `json:"total_rate"`
		FirstMessage   string  `json:"first_message"`
		MessageCount   int     `json:"message_count"`
		IsRepeat       bool    `json:"is_repeat"`
	}

	// 최근 대화 + 예약 조인 (기간 내 메시지가 있는 대화)
	var convIDs []string
	config.DB.Model(&models.Message{}).
		Where("sent_at >= ? AND sent_at <= ? AND sender_type = 'guest'", from, to+" 23:59:59").
		Distinct("conversation_id").Limit(200).
		Pluck("conversation_id", &convIDs)

	var cases []conversationCase
	for _, cid := range convIDs {
		var conv models.Conversation
		if err := config.DB.Where("conversation_id = ?", cid).First(&conv).Error; err != nil {
			continue
		}

		// 첫 게스트 메시지 (길이 10 이상)
		var firstMsg models.Message
		config.DB.Where("conversation_id = ? AND sender_type = 'guest' AND CHAR_LENGTH(content) > 10", cid).
			Order("sent_at ASC").First(&firstMsg)

		// 메시지 수
		var msgCount int64
		config.DB.Model(&models.Message{}).Where("conversation_id = ?", cid).Count(&msgCount)

		// 예약 정보
		var res models.Reservation
		config.DB.Where("conversation_id = ? AND status NOT IN ('cancelled','canceled')", cid).First(&res)

		propName := ""
		if conv.InternalPropID != nil {
			propName = propNames[*conv.InternalPropID]
		}

		// 재방문 여부
		var prevCount int64
		if conv.GuestName != "" {
			config.DB.Model(&models.Conversation{}).
				Where("guest_name = ? AND conversation_id != ?", conv.GuestName, cid).
				Count(&prevCount)
		}

		firstContent := firstMsg.Content
		if len([]rune(firstContent)) > 200 {
			firstContent = string([]rune(firstContent)[:200]) + "…"
		}

		cases = append(cases, conversationCase{
			ConversationID: cid,
			GuestName:      conv.GuestName,
			PropertyName:   propName,
			ChannelType:    conv.ChannelType,
			CheckIn:        res.CheckInDate,
			CheckOut:       res.CheckOutDate,
			Nights:         res.Nights,
			TotalRate:      res.TotalRate,
			FirstMessage:   firstContent,
			MessageCount:   int(msgCount),
			IsRepeat:       prevCount > 0,
		})

		if len(cases) >= 50 {
			break
		}
	}

	// ═══ Stage 4: 패턴 감지 ═══
	type pattern struct {
		Name        string `json:"name"`
		Count       int    `json:"count"`
		Description string `json:"description"`
	}

	// 무응답 → 취소 패턴
	var noReplyCancel int64
	config.DB.Model(&models.Conversation{}).
		Joins("JOIN reservations ON reservations.conversation_id = conversations.conversation_id").
		Where("reservations.status IN ('cancelled','canceled') AND reservations.check_in_date >= ? AND reservations.check_in_date <= ?", from, to).
		Where("conversations.last_message_preview = '' OR conversations.last_message_preview IS NULL").
		Count(&noReplyCancel)

	// 1박 비중
	var oneNight, totalRes int64
	config.DB.Model(&models.Reservation{}).Where("check_in_date >= ? AND check_in_date <= ? AND status NOT IN ('cancelled','canceled')", from, to).Count(&totalRes)
	config.DB.Model(&models.Reservation{}).Where("check_in_date >= ? AND check_in_date <= ? AND status NOT IN ('cancelled','canceled') AND nights = 1", from, to).Count(&oneNight)

	// 재방문 게스트 수
	type guestCount struct {
		GuestName string
		Cnt       int
	}
	var repeatGuests []guestCount
	config.DB.Model(&models.Conversation{}).
		Select("guest_name, COUNT(DISTINCT conversation_id) as cnt").
		Where("guest_name != '' AND last_message_at >= ? AND last_message_at <= ?", from, to+" 23:59:59").
		Group("guest_name").Having("cnt > 1").
		Find(&repeatGuests)

	patterns := []pattern{
		{Name: "1박_비중", Count: int(oneNight), Description: "전체 " + itoa(int(totalRes)) + "건 중 1박 " + itoa(int(oneNight)) + "건"},
		{Name: "재방문_게스트", Count: len(repeatGuests), Description: itoa(len(repeatGuests)) + "명이 기간 내 2회 이상 대화"},
	}
	if noReplyCancel > 0 {
		patterns = append(patterns, pattern{Name: "무응답_취소", Count: int(noReplyCancel), Description: "호스트 미응답 후 취소 " + itoa(int(noReplyCancel)) + "건"})
	}

	// ═══ 응답 ═══
	c.JSON(http.StatusOK, gin.H{
		"period": gin.H{"from": from, "to": to, "prev_from": prevFrom, "prev_to": prevTo},
		"stage1": gin.H{
			"trends":       trends,
			"prev_trends":  prevTrends,
			"prop_changes": propChanges,
		},
		"stage2": gin.H{
			"by_category": tagsByCategory,
			"by_property": tagsByProperty,
		},
		"stage3": gin.H{
			"cases":      cases,
			"case_count": len(cases),
		},
		"stage4": gin.H{
			"patterns": patterns,
		},
	})
}

func mustParseDate(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Now()
	}
	return t
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
