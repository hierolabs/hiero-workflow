package service

import (
	"log"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type MessageAnalysisService struct {
	reviewSvc *ReviewService
}

func NewMessageAnalysisService() *MessageAnalysisService {
	return &MessageAnalysisService{
		reviewSvc: NewReviewService(),
	}
}

// ================================================================
// 키워드 정의
// ================================================================

type IssueKeyword struct {
	Category string
	Keywords []string
}

var analysisIssueKeywords = []IssueKeyword{
	{Category: "시설 고장", Keywords: []string{"고장", "안돼", "안되", "작동", "broken", "not working", "doesn't work", "에어컨", "보일러", "온수", "냉방", "난방", "변기", "수도", "전등", "WiFi", "wifi", "인터넷", "리모컨", "리모콘"}},
	{Category: "청결 불만", Keywords: []string{"더러", "깨끗", "청소", "먼지", "벌레", "dirty", "clean", "hair", "머리카락", "곰팡이", "냄새", "smell"}},
	{Category: "소음", Keywords: []string{"소음", "시끄러", "noise", "noisy", "loud", "층간소음"}},
	{Category: "체크인 문제", Keywords: []string{"문 열", "비밀번호", "password", "lock", "잠김", "도어락", "출입", "열쇠", "key", "access", "도어", "입장"}},
	{Category: "소모품/비품", Keywords: []string{"수건", "towel", "침구", "베개", "pillow", "blanket", "이불", "드라이기", "dryer", "충전기", "charger", "비누", "샴푸", "치약", "칫솔", "휴지", "세제", "컵", "접시", "행거", "슬리퍼"}},
	{Category: "교통/주차", Keywords: []string{"주차", "parking", "위치", "location", "길 찾", "direction", "택시", "지하철", "교통", "주차장", "주차비", "네비"}},
	{Category: "변경/연장", Keywords: []string{"일찍", "early", "늦게", "late", "체크인 시간", "check-in time", "checkout time", "연장", "변경", "날짜 변경", "하루 더", "추가 숙박", "레이트"}},
	{Category: "환불/취소", Keywords: []string{"환불", "취소", "refund", "cancel"}},
	{Category: "칭찬", Keywords: []string{"감사", "좋았", "최고", "편했", "깨끗했", "만족", "추천", "thank", "great", "amazing", "perfect", "excellent", "wonderful", "love", "beautiful", "nice", "good", "또 올", "재방문", "친절"}},
}

type InsightKeywordDef struct {
	Category string
	Keywords []string
}

var insightKeywords = []InsightKeywordDef{
	{Category: "가격/가성비", Keywords: []string{"싸", "저렴", "가격", "가성비", "비싸", "cheap", "price", "affordable", "budget", "worth", "value", "합리적", "cost", "할인"}},
	{Category: "위치/교통", Keywords: []string{"역 가까", "역에서", "위치 좋", "위치가", "교통", "편리", "접근", "location", "convenient", "close to", "near", "station", "subway", "걸어서", "도보", "강남", "홍대", "명동", "강동", "잠실", "올림픽공원"}},
	{Category: "깨끗/청결", Keywords: []string{"깨끗", "청결", "깔끔", "clean", "tidy", "spotless", "새것", "쾌적", "위생", "정돈"}},
	{Category: "넓이/공간", Keywords: []string{"넓", "공간", "spacious", "room", "큰", "wide", "넉넉", "방이 크", "거실"}},
	{Category: "시설/옵션", Keywords: []string{"풀옵션", "세탁기", "건조기", "냉장고", "전자레인지", "kitchen", "washer", "dryer", "옵션", "가전", "인덕션", "밥솥", "커피"}},
	{Category: "장기/출장", Keywords: []string{"출장", "파견", "프로젝트", "업무", "work", "business", "회사", "장기", "한 달", "몇 달", "long term", "long stay", "워케이션", "remote", "재택"}},
	{Category: "이사/독립", Keywords: []string{"이사", "이사하", "독립", "집 구하", "전세", "월세", "보증금", "moving", "deposit", "계약 만료", "나가", "잠깐", "임시", "당분간"}},
	{Category: "여행/관광", Keywords: []string{"여행", "관광", "tourism", "travel", "vacation", "holiday", "trip", "놀러", "구경", "관광지", "맛집", "sightseeing"}},
	{Category: "재방문/단골", Keywords: []string{"또 왔", "다시", "저번에", "지난번", "again", "return", "last time", "before", "이전에", "재방문", "단골", "항상 여기"}},
	{Category: "추천받음", Keywords: []string{"추천", "소개", "친구가", "recommend", "referred", "후기 보고", "리뷰 보고", "review", "검색해서"}},
	{Category: "사진/기대", Keywords: []string{"사진", "사진과", "사진대로", "photo", "picture", "기대", "expect", "보고", "이미지", "실제로"}},
	{Category: "체류목적-의료", Keywords: []string{"병원", "수술", "치료", "진료", "hospital", "medical", "검진", "통원", "입원", "간병", "회복"}},
	{Category: "체류목적-학업", Keywords: []string{"학교", "대학", "학원", "시험", "공부", "study", "university", "school", "수업", "교육", "연수"}},
	{Category: "즉시입주", Keywords: []string{"오늘", "당장", "지금", "급하", "바로", "today", "immediately", "urgent", "asap", "tonight", "내일", "급히"}},
}

// ================================================================
// 태깅: 메시지 저장 시점에 호출
// ================================================================

// TagMessage — 메시지 1건에 대해 insight + issue 태그 생성
func (s *MessageAnalysisService) TagMessage(msg models.Message, conv models.Conversation, propName string) {
	lower := strings.ToLower(msg.Content)
	if lower == "" {
		return
	}

	// issue 태그
	for _, ik := range analysisIssueKeywords {
		matched := findMatchedKeyword(msg.Content, ik.Keywords)
		if matched != "" {
			tag := models.MessageTag{
				MessageID:      msg.ID,
				ConversationID: msg.ConversationID,
				TagType:        "issue",
				Category:       ik.Category,
				MatchedKeyword: matched,
				SenderType:     msg.SenderType,
				ChannelType:    conv.ChannelType,
				PropertyName:   propName,
				GuestName:      conv.GuestName,
				Content:        truncate(msg.Content, 500),
				SentAt:         msg.SentAt,
			}
			config.DB.Create(&tag)
			break // 한 메시지에 하나의 카테고리만
		}
	}

	// insight 태그
	for _, ik := range insightKeywords {
		matched := findMatchedKeyword(msg.Content, ik.Keywords)
		if matched != "" {
			tag := models.MessageTag{
				MessageID:      msg.ID,
				ConversationID: msg.ConversationID,
				TagType:        "insight",
				Category:       ik.Category,
				MatchedKeyword: matched,
				SenderType:     msg.SenderType,
				ChannelType:    conv.ChannelType,
				PropertyName:   propName,
				GuestName:      conv.GuestName,
				Content:        truncate(msg.Content, 500),
				SentAt:         msg.SentAt,
			}
			config.DB.Create(&tag)
			break
		}
	}
}

// TagUntaggedMessages — 기존 미태깅 메시지 일괄 처리 (배치 INSERT)
func (s *MessageAnalysisService) TagUntaggedMessages() {
	// 이미 태깅된 메시지 ID 목록
	var taggedIDs []uint
	config.DB.Model(&models.MessageTag{}).Distinct("message_id").Pluck("message_id", &taggedIDs)
	taggedSet := map[uint]bool{}
	for _, id := range taggedIDs {
		taggedSet[id] = true
	}

	// 대화+숙소 캐시
	convMap := map[string]models.Conversation{}
	var convs []models.Conversation
	config.DB.Find(&convs)
	for _, c := range convs {
		convMap[c.ConversationID] = c
	}
	propMap := map[uint]string{}
	var props []models.Property
	config.DB.Find(&props)
	for _, p := range props {
		name := p.DisplayName
		if name == "" {
			name = p.Name
		}
		propMap[p.ID] = name
	}

	// 최근 90일 메시지만
	since := time.Now().Add(-90 * 24 * time.Hour)
	var messages []models.Message
	config.DB.Where("sent_at >= ?", since).Order("sent_at DESC").Find(&messages)

	// 배치로 태그 생성
	var batch []models.MessageTag
	for _, msg := range messages {
		if taggedSet[msg.ID] || msg.Content == "" {
			continue
		}
		conv := convMap[msg.ConversationID]
		propName := ""
		if conv.InternalPropID != nil {
			propName = propMap[*conv.InternalPropID]
		}

		// issue 태그
		for _, ik := range analysisIssueKeywords {
			matched := findMatchedKeyword(msg.Content, ik.Keywords)
			if matched != "" {
				batch = append(batch, models.MessageTag{
					MessageID: msg.ID, ConversationID: msg.ConversationID,
					TagType: "issue", Category: ik.Category, MatchedKeyword: matched,
					SenderType: msg.SenderType, ChannelType: conv.ChannelType,
					PropertyName: propName, GuestName: conv.GuestName,
					Content: truncate(msg.Content, 500), SentAt: msg.SentAt,
				})
				break
			}
		}
		// insight 태그
		for _, ik := range insightKeywords {
			matched := findMatchedKeyword(msg.Content, ik.Keywords)
			if matched != "" {
				batch = append(batch, models.MessageTag{
					MessageID: msg.ID, ConversationID: msg.ConversationID,
					TagType: "insight", Category: ik.Category, MatchedKeyword: matched,
					SenderType: msg.SenderType, ChannelType: conv.ChannelType,
					PropertyName: propName, GuestName: conv.GuestName,
					Content: truncate(msg.Content, 500), SentAt: msg.SentAt,
				})
				break
			}
		}

		// 500건씩 배치 INSERT
		if len(batch) >= 500 {
			config.DB.CreateInBatches(batch, 500)
			log.Printf("[MessageTag] %d건 배치 저장...", len(batch))
			batch = batch[:0]
		}
	}
	// 나머지
	if len(batch) > 0 {
		config.DB.CreateInBatches(batch, 500)
	}
	log.Printf("[MessageTag] 기존 메시지 %d건 중 태그 생성 완료", len(messages))
}

// ================================================================
// 분석 API — DB 집계 (GROUP BY)
// ================================================================

// MessageIssue — 이슈 아이템 (API 응답용)
type MessageIssue struct {
	ConversationID string    `json:"conversation_id"`
	GuestName      string    `json:"guest_name"`
	PropertyName   string    `json:"property_name"`
	Category       string    `json:"category"`
	Content        string    `json:"content"`
	SenderType     string    `json:"sender_type"`
	SentAt         time.Time `json:"sent_at"`
	ChannelType    string    `json:"channel_type"`
}

type PropertyIssueSummary struct {
	PropertyName string   `json:"property_name"`
	IssueCount   int      `json:"issue_count"`
	Categories   []string `json:"categories"`
}

type ReviewIssue struct {
	ReservationCode string   `json:"reservation_code"`
	PropertyName    string   `json:"property_name"`
	GuestScore      int      `json:"guest_score"`
	GuestContent    string   `json:"guest_content"`
	CheckInDate     string   `json:"check_in_date"`
	CheckOutDate    string   `json:"check_out_date"`
	ChannelType     string   `json:"channel_type"`
	LowCategories   []string `json:"low_categories"`
}

type ReviewSummary struct {
	TotalReviews    int            `json:"total_reviews"`
	AvgScore        float64        `json:"avg_score"`
	LowScoreCount   int            `json:"low_score_count"`
	LowScoreReviews []ReviewIssue  `json:"low_score_reviews"`
	CategoryAvgs    map[string]float64 `json:"category_avgs"`
}

type KPIComparison struct {
	Current     KPIMetrics `json:"current"`
	PrevDay     KPIMetrics `json:"prev_day"`
	PrevWeek    KPIMetrics `json:"prev_week"`
	PrevMonth   KPIMetrics `json:"prev_month"`
	DayChange   KPIChange  `json:"day_change"`
	WeekChange  KPIChange  `json:"week_change"`
	MonthChange KPIChange  `json:"month_change"`
}

type KPIMetrics struct {
	Period         string  `json:"period"`
	TotalMessages  int     `json:"total_messages"`
	IssueCount     int     `json:"issue_count"`
	IssueRate      float64 `json:"issue_rate"`
	PraiseCount    int     `json:"praise_count"`
	PraiseRate     float64 `json:"praise_rate"`
	AvgReviewScore float64 `json:"avg_review_score"`
	LowReviewCount int     `json:"low_review_count"`
}

type KPIChange struct {
	IssueRate     float64 `json:"issue_rate"`
	PraiseRate    float64 `json:"praise_rate"`
	ReviewScore   float64 `json:"review_score"`
	MessageVolume float64 `json:"message_volume"`
}

type AnalysisSummary struct {
	Period         string                 `json:"period"`
	StartDate      string                 `json:"start_date"`
	EndDate        string                 `json:"end_date"`
	TotalMessages  int64                  `json:"total_messages"`
	TotalGuest     int64                  `json:"total_guest"`
	TotalHost      int64                  `json:"total_host"`
	Issues         []MessageIssue         `json:"issues"`
	CategoryCounts map[string]int         `json:"category_counts"`
	PropertyIssues map[string]int         `json:"property_issues"`
	TopProperties  []PropertyIssueSummary `json:"top_properties"`
	Reviews        *ReviewSummary         `json:"reviews"`
	KPI            *KPIComparison         `json:"kpi"`
}

// Analyze — 이슈 분석 (DB 집계)
func (s *MessageAnalysisService) Analyze(period string) (*AnalysisSummary, error) {
	now := time.Now()
	var startDate time.Time

	switch period {
	case "day":
		startDate = now.Add(-24 * time.Hour)
	case "week":
		startDate = now.Add(-7 * 24 * time.Hour)
	case "month":
		startDate = now.Add(-30 * 24 * time.Hour)
	default:
		startDate = now.Add(-7 * 24 * time.Hour)
		period = "week"
	}

	// 메시지 통계 — COUNT만
	var totalMessages, totalGuest, totalHost int64
	config.DB.Model(&models.Message{}).Where("sent_at >= ?", startDate).Count(&totalMessages)
	config.DB.Model(&models.Message{}).Where("sent_at >= ? AND sender_type = ?", startDate, "guest").Count(&totalGuest)
	config.DB.Model(&models.Message{}).Where("sent_at >= ? AND sender_type = ?", startDate, "host").Count(&totalHost)

	// 카테고리별 집계 — GROUP BY
	type catCount struct {
		Category string
		Cnt      int
	}
	var catCounts []catCount
	config.DB.Model(&models.MessageTag{}).
		Select("category, COUNT(*) as cnt").
		Where("tag_type = ? AND sent_at >= ?", "issue", startDate).
		Group("category").Order("cnt DESC").
		Find(&catCounts)

	categoryCounts := map[string]int{}
	for _, cc := range catCounts {
		categoryCounts[cc.Category] = cc.Cnt
	}

	// 숙소별 이슈 집계
	type propCount struct {
		PropertyName string
		Cnt          int
	}
	var propCounts []propCount
	config.DB.Model(&models.MessageTag{}).
		Select("property_name, COUNT(*) as cnt").
		Where("tag_type = ? AND sent_at >= ? AND property_name != ''", "issue", startDate).
		Group("property_name").Order("cnt DESC").Limit(10).
		Find(&propCounts)

	propertyIssues := map[string]int{}
	var topProperties []PropertyIssueSummary
	for _, pc := range propCounts {
		propertyIssues[pc.PropertyName] = pc.Cnt

		// 해당 숙소의 카테고리 목록
		var cats []string
		config.DB.Model(&models.MessageTag{}).
			Where("tag_type = ? AND sent_at >= ? AND property_name = ?", "issue", startDate, pc.PropertyName).
			Distinct("category").Pluck("category", &cats)

		topProperties = append(topProperties, PropertyIssueSummary{
			PropertyName: pc.PropertyName,
			IssueCount:   pc.Cnt,
			Categories:   cats,
		})
	}

	// 최근 이슈 메시지 (50건)
	var tags []models.MessageTag
	config.DB.Where("tag_type = ? AND sent_at >= ?", "issue", startDate).
		Order("sent_at DESC").Limit(50).Find(&tags)

	var issues []MessageIssue
	for _, t := range tags {
		issues = append(issues, MessageIssue{
			ConversationID: t.ConversationID,
			GuestName:      t.GuestName,
			PropertyName:   t.PropertyName,
			Category:       t.Category,
			Content:        t.Content,
			SenderType:     t.SenderType,
			SentAt:         t.SentAt,
			ChannelType:    t.ChannelType,
		})
	}

	// 리뷰 분석
	days := 7
	switch period {
	case "day":
		days = 1
	case "month":
		days = 30
	}
	reviewSummary := s.buildReviewSummary(days)

	// KPI
	praiseCount := categoryCounts["칭찬"]
	totalIssueCount := 0
	for _, cnt := range categoryCounts {
		totalIssueCount += cnt
	}

	currentKPI := KPIMetrics{
		Period:         period,
		TotalMessages:  int(totalMessages),
		IssueCount:     totalIssueCount - praiseCount,
		PraiseCount:    praiseCount,
		AvgReviewScore: reviewSummary.AvgScore,
		LowReviewCount: reviewSummary.LowScoreCount,
	}
	if currentKPI.TotalMessages > 0 {
		currentKPI.IssueRate = float64(currentKPI.IssueCount) / float64(currentKPI.TotalMessages) * 100
		currentKPI.PraiseRate = float64(currentKPI.PraiseCount) / float64(currentKPI.TotalMessages) * 100
	}

	// 이전 기간은 직전 주만 비교 (3번 → 1번으로 축소)
	prevWeekKPI := s.calcPeriodKPI(now.Add(-14*24*time.Hour), now.Add(-7*24*time.Hour))

	kpi := &KPIComparison{
		Current:     currentKPI,
		PrevDay:     prevWeekKPI, // 간소화: 주간만 비교
		PrevWeek:    prevWeekKPI,
		PrevMonth:   prevWeekKPI,
		DayChange:   calcChange(currentKPI, prevWeekKPI),
		WeekChange:  calcChange(currentKPI, prevWeekKPI),
		MonthChange: calcChange(currentKPI, prevWeekKPI),
	}

	if issues == nil {
		issues = []MessageIssue{}
	}
	if topProperties == nil {
		topProperties = []PropertyIssueSummary{}
	}

	return &AnalysisSummary{
		Period:         period,
		StartDate:      startDate.Format("2006-01-02"),
		EndDate:        now.Format("2006-01-02"),
		TotalMessages:  totalMessages,
		TotalGuest:     totalGuest,
		TotalHost:      totalHost,
		Issues:         issues,
		CategoryCounts: categoryCounts,
		PropertyIssues: propertyIssues,
		TopProperties:  topProperties,
		Reviews:        reviewSummary,
		KPI:            kpi,
	}, nil
}

// calcPeriodKPI — DB 집계 기반
func (s *MessageAnalysisService) calcPeriodKPI(start, end time.Time) KPIMetrics {
	var msgCount int64
	config.DB.Model(&models.Message{}).Where("sent_at >= ? AND sent_at < ?", start, end).Count(&msgCount)

	type catCount struct {
		Category string
		Cnt      int
	}
	var catCounts []catCount
	config.DB.Model(&models.MessageTag{}).
		Select("category, COUNT(*) as cnt").
		Where("tag_type = ? AND sent_at >= ? AND sent_at < ?", "issue", start, end).
		Group("category").Find(&catCounts)

	issueCount, praiseCount := 0, 0
	for _, cc := range catCounts {
		if cc.Category == "칭찬" {
			praiseCount = cc.Cnt
		} else {
			issueCount += cc.Cnt
		}
	}

	kpi := KPIMetrics{
		TotalMessages: int(msgCount),
		IssueCount:    issueCount,
		PraiseCount:   praiseCount,
	}
	if kpi.TotalMessages > 0 {
		kpi.IssueRate = float64(issueCount) / float64(kpi.TotalMessages) * 100
		kpi.PraiseRate = float64(praiseCount) / float64(kpi.TotalMessages) * 100
	}
	return kpi
}

func calcChange(current, prev KPIMetrics) KPIChange {
	change := KPIChange{
		IssueRate:   current.IssueRate - prev.IssueRate,
		PraiseRate:  current.PraiseRate - prev.PraiseRate,
		ReviewScore: current.AvgReviewScore - prev.AvgReviewScore,
	}
	if prev.TotalMessages > 0 {
		change.MessageVolume = float64(current.TotalMessages-prev.TotalMessages) / float64(prev.TotalMessages) * 100
	}
	return change
}

// ── 인사이트 분석 (DB 집계) ──

type InsightItem struct {
	ConversationID string    `json:"conversation_id"`
	GuestName      string    `json:"guest_name"`
	PropertyName   string    `json:"property_name"`
	Category       string    `json:"category"`
	Content        string    `json:"content"`
	SenderType     string    `json:"sender_type"`
	SentAt         time.Time `json:"sent_at"`
	ChannelType    string    `json:"channel_type"`
	MatchedKeyword string    `json:"matched_keyword"`
}

type InsightSummary struct {
	Period         string          `json:"period"`
	StartDate      string          `json:"start_date"`
	EndDate        string          `json:"end_date"`
	TotalMessages  int64           `json:"total_messages"`
	TotalGuest     int64           `json:"total_guest"`
	Items          []InsightItem   `json:"items"`
	CategoryCounts map[string]int  `json:"category_counts"`
	ChannelCounts  map[string]int  `json:"channel_counts"`
	TopReasons     []ReasonSummary `json:"top_reasons"`
}

type ReasonSummary struct {
	Category string   `json:"category"`
	Count    int      `json:"count"`
	Percent  float64  `json:"percent"`
	Examples []string `json:"examples"`
}

func (s *MessageAnalysisService) AnalyzeInsight(startDateStr, endDateStr string) (*InsightSummary, error) {
	startDate := time.Date(2023, 1, 1, 0, 0, 0, 0, time.Local)
	endDate := time.Now()

	if startDateStr != "" {
		if t, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = t
		}
	}
	if endDateStr != "" {
		if t, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endDate = t.Add(24*time.Hour - time.Second)
		}
	}

	// 메시지 통계 — COUNT만
	var totalAll, totalGuest int64
	config.DB.Model(&models.Message{}).Where("sent_at >= ? AND sent_at <= ?", startDate, endDate).Count(&totalAll)
	config.DB.Model(&models.Message{}).Where("sent_at >= ? AND sent_at <= ? AND sender_type = ?", startDate, endDate, "guest").Count(&totalGuest)

	// 카테고리별 집계
	type catCount struct {
		Category string
		Cnt      int
	}
	var catCounts []catCount
	config.DB.Model(&models.MessageTag{}).
		Select("category, COUNT(*) as cnt").
		Where("tag_type = ? AND sent_at >= ? AND sent_at <= ?", "insight", startDate, endDate).
		Group("category").Order("cnt DESC").
		Find(&catCounts)

	categoryCounts := map[string]int{}
	totalHits := 0
	for _, cc := range catCounts {
		categoryCounts[cc.Category] = cc.Cnt
		totalHits += cc.Cnt
	}

	// 채널별 집계
	type chCount struct {
		ChannelType string
		Cnt         int
	}
	var chCounts []chCount
	config.DB.Model(&models.MessageTag{}).
		Select("channel_type, COUNT(*) as cnt").
		Where("tag_type = ? AND sent_at >= ? AND sent_at <= ?", "insight", startDate, endDate).
		Group("channel_type").Order("cnt DESC").
		Find(&chCounts)

	channelCounts := map[string]int{}
	for _, cc := range chCounts {
		channelCounts[cc.ChannelType] = cc.Cnt
	}

	// TOP reasons
	var topReasons []ReasonSummary
	for _, cc := range catCounts {
		pct := float64(0)
		if totalHits > 0 {
			pct = float64(cc.Cnt) / float64(totalHits) * 100
		}
		// 예시 가져오기 (카테고리당 5개)
		var examples []string
		config.DB.Model(&models.MessageTag{}).
			Where("tag_type = ? AND category = ? AND sent_at >= ? AND sent_at <= ?", "insight", cc.Category, startDate, endDate).
			Limit(5).Pluck("content", &examples)

		topReasons = append(topReasons, ReasonSummary{
			Category: cc.Category,
			Count:    cc.Cnt,
			Percent:  pct,
			Examples: examples,
		})
	}

	// 최근 아이템 (100건)
	var tags []models.MessageTag
	config.DB.Where("tag_type = ? AND sent_at >= ? AND sent_at <= ?", "insight", startDate, endDate).
		Order("sent_at DESC").Limit(100).Find(&tags)

	var items []InsightItem
	for _, t := range tags {
		items = append(items, InsightItem{
			ConversationID: t.ConversationID,
			GuestName:      t.GuestName,
			PropertyName:   t.PropertyName,
			Category:       t.Category,
			Content:        t.Content,
			SenderType:     t.SenderType,
			SentAt:         t.SentAt,
			ChannelType:    t.ChannelType,
			MatchedKeyword: t.MatchedKeyword,
		})
	}

	// nil → 빈 slice (JSON null 방지)
	if items == nil {
		items = []InsightItem{}
	}
	if topReasons == nil {
		topReasons = []ReasonSummary{}
	}
	if categoryCounts == nil {
		categoryCounts = map[string]int{}
	}
	if channelCounts == nil {
		channelCounts = map[string]int{}
	}

	return &InsightSummary{
		Period:         startDateStr + "~" + endDateStr,
		StartDate:      startDate.Format("2006-01-02"),
		EndDate:        endDate.Format("2006-01-02"),
		TotalMessages:  totalAll,
		TotalGuest:     totalGuest,
		Items:          items,
		CategoryCounts: categoryCounts,
		ChannelCounts:  channelCounts,
		TopReasons:     topReasons,
	}, nil
}

// ================================================================
// 리뷰 헬퍼
// ================================================================

func (s *MessageAnalysisService) buildReviewSummary(days int) *ReviewSummary {
	recentReviews := s.reviewSvc.ListRecent(days)
	lowReviews := s.reviewSvc.GetLowScoreReviews(days)

	var totalScore int
	catSums := map[string]int{}
	catCounts := map[string]int{}
	scored := 0
	for _, r := range recentReviews {
		if r.GuestScore > 0 {
			totalScore += r.GuestScore
			scored++
		}
		if r.AccuracyScore > 0 { catSums["정확성"] += r.AccuracyScore; catCounts["정확성"]++ }
		if r.CheckinScore > 0 { catSums["체크인"] += r.CheckinScore; catCounts["체크인"]++ }
		if r.CleanlinessScore > 0 { catSums["청결도"] += r.CleanlinessScore; catCounts["청결도"]++ }
		if r.CommunicationScore > 0 { catSums["소통"] += r.CommunicationScore; catCounts["소통"]++ }
		if r.LocationScore > 0 { catSums["위치"] += r.LocationScore; catCounts["위치"]++ }
		if r.ValueScore > 0 { catSums["가성비"] += r.ValueScore; catCounts["가성비"]++ }
	}

	avgScore := float64(0)
	if scored > 0 {
		avgScore = float64(totalScore) / float64(scored)
	}
	catAvgs := map[string]float64{}
	for cat, sum := range catSums {
		if catCounts[cat] > 0 {
			catAvgs[cat] = float64(sum) / float64(catCounts[cat])
		}
	}

	var reviewIssues []ReviewIssue
	for _, r := range lowReviews {
		var lowCats []string
		if r.AccuracyScore > 0 && r.AccuracyScore <= 3 { lowCats = append(lowCats, "정확성") }
		if r.CheckinScore > 0 && r.CheckinScore <= 3 { lowCats = append(lowCats, "체크인") }
		if r.CleanlinessScore > 0 && r.CleanlinessScore <= 3 { lowCats = append(lowCats, "청결도") }
		if r.CommunicationScore > 0 && r.CommunicationScore <= 3 { lowCats = append(lowCats, "소통") }
		if r.LocationScore > 0 && r.LocationScore <= 3 { lowCats = append(lowCats, "위치") }
		if r.ValueScore > 0 && r.ValueScore <= 3 { lowCats = append(lowCats, "가성비") }
		reviewIssues = append(reviewIssues, ReviewIssue{
			ReservationCode: r.ReservationCode,
			PropertyName:    r.PropertyName,
			GuestScore:      r.GuestScore,
			GuestContent:    truncate(r.GuestContent, 300),
			CheckInDate:     r.CheckInDate,
			CheckOutDate:    r.CheckOutDate,
			ChannelType:     r.ChannelType,
			LowCategories:   lowCats,
		})
	}

	return &ReviewSummary{
		TotalReviews:    len(recentReviews),
		AvgScore:        avgScore,
		LowScoreCount:   len(lowReviews),
		LowScoreReviews: reviewIssues,
		CategoryAvgs:    catAvgs,
	}
}

// ================================================================
// 유틸
// ================================================================

func findMatchedKeyword(text string, keywords []string) string {
	lower := strings.ToLower(text)
	for _, kw := range keywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return kw
		}
	}
	return ""
}

func containsAny(text string, keywords []string) bool {
	return findMatchedKeyword(text, keywords) != ""
}

// truncate, msgTruncate는 directive_service.go, message_service.go에서 정의됨
