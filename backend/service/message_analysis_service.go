package service

import (
	"fmt"
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

// IssueKeyword — 이슈 키워드 매핑
type IssueKeyword struct {
	Category string
	Keywords []string
}

var issueKeywords = []IssueKeyword{
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

// MessageIssue — 발견된 이슈
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

// ReviewIssue — 리뷰에서 발견된 문제
type ReviewIssue struct {
	ReservationCode string  `json:"reservation_code"`
	PropertyName    string  `json:"property_name"`
	GuestScore      int     `json:"guest_score"`
	GuestContent    string  `json:"guest_content"`
	CheckInDate     string  `json:"check_in_date"`
	CheckOutDate    string  `json:"check_out_date"`
	ChannelType     string  `json:"channel_type"`
	LowCategories   []string `json:"low_categories"`
}

// ReviewSummary — 리뷰 통계
type ReviewSummary struct {
	TotalReviews    int           `json:"total_reviews"`
	AvgScore        float64       `json:"avg_score"`
	LowScoreCount   int           `json:"low_score_count"`
	LowScoreReviews []ReviewIssue `json:"low_score_reviews"`
	CategoryAvgs    map[string]float64 `json:"category_avgs"`
}

// KPIComparison — 기간 대비 KPI
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
	Period        string  `json:"period"`
	TotalMessages int     `json:"total_messages"`
	IssueCount    int     `json:"issue_count"`
	IssueRate     float64 `json:"issue_rate"`
	PraiseCount   int     `json:"praise_count"`
	PraiseRate    float64 `json:"praise_rate"`
	AvgReviewScore float64 `json:"avg_review_score"`
	LowReviewCount int    `json:"low_review_count"`
}

type KPIChange struct {
	IssueRate      float64 `json:"issue_rate"`       // 이슈율 변화 (%p)
	PraiseRate     float64 `json:"praise_rate"`      // 칭찬율 변화 (%p)
	ReviewScore    float64 `json:"review_score"`     // 리뷰 점수 변화
	MessageVolume  float64 `json:"message_volume"`   // 메시지 수 변화율 (%)
}

// AnalysisSummary — 기간별 분석 결과
type AnalysisSummary struct {
	Period          string                  `json:"period"`
	StartDate       string                  `json:"start_date"`
	EndDate         string                  `json:"end_date"`
	TotalMessages   int64                   `json:"total_messages"`
	TotalGuest      int64                   `json:"total_guest"`
	TotalHost       int64                   `json:"total_host"`
	Issues          []MessageIssue          `json:"issues"`
	CategoryCounts  map[string]int          `json:"category_counts"`
	PropertyIssues  map[string]int          `json:"property_issues"`
	TopProperties   []PropertyIssueSummary  `json:"top_properties"`
	Reviews         *ReviewSummary          `json:"reviews"`
	KPI             *KPIComparison          `json:"kpi"`
}

type PropertyIssueSummary struct {
	PropertyName string `json:"property_name"`
	IssueCount   int    `json:"issue_count"`
	Categories   []string `json:"categories"`
}

// Analyze — 기간별 메시지 분석
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

	// 해당 기간 메시지 조회
	var messages []models.Message
	config.DB.Where("sent_at >= ?", startDate).Order("sent_at DESC").Find(&messages)

	// 메시지 통계
	var totalGuest, totalHost int64
	for _, m := range messages {
		if m.SenderType == "guest" {
			totalGuest++
		} else if m.SenderType == "host" {
			totalHost++
		}
	}

	// 대화 정보 캐시
	convMap := map[string]models.Conversation{}
	var convs []models.Conversation
	config.DB.Find(&convs)
	for _, c := range convs {
		convMap[c.ConversationID] = c
	}

	// 숙소 이름 캐시
	propMap := map[uint]string{}
	var props []models.Property
	config.DB.Find(&props)
	for _, p := range props {
		propMap[p.ID] = p.Name
	}

	// 이슈 감지
	var issues []MessageIssue
	categoryCounts := map[string]int{}
	propertyIssues := map[string]int{}

	for _, msg := range messages {
		for _, ik := range issueKeywords {
			if containsAny(msg.Content, ik.Keywords) {
				conv := convMap[msg.ConversationID]
				propName := ""
				if conv.InternalPropID != nil {
					propName = propMap[*conv.InternalPropID]
				}

				issues = append(issues, MessageIssue{
					ConversationID: msg.ConversationID,
					GuestName:      conv.GuestName,
					PropertyName:   propName,
					Category:       ik.Category,
					Content:        truncate(msg.Content, 200),
					SenderType:     msg.SenderType,
					SentAt:         msg.SentAt,
					ChannelType:    conv.ChannelType,
				})

				categoryCounts[ik.Category]++
				if propName != "" {
					propertyIssues[propName]++
				}
				break // 한 메시지에 하나의 카테고리만
			}
		}
	}

	// 숙소별 이슈 Top 정리
	var topProperties []PropertyIssueSummary
	propCategories := map[string]map[string]bool{}
	for _, issue := range issues {
		if issue.PropertyName == "" {
			continue
		}
		if propCategories[issue.PropertyName] == nil {
			propCategories[issue.PropertyName] = map[string]bool{}
		}
		propCategories[issue.PropertyName][issue.Category] = true
	}

	for propName, count := range propertyIssues {
		cats := []string{}
		for cat := range propCategories[propName] {
			cats = append(cats, cat)
		}
		topProperties = append(topProperties, PropertyIssueSummary{
			PropertyName: propName,
			IssueCount:   count,
			Categories:   cats,
		})
	}

	// 이슈 수 기준 정렬
	for i := 0; i < len(topProperties); i++ {
		for j := i + 1; j < len(topProperties); j++ {
			if topProperties[j].IssueCount > topProperties[i].IssueCount {
				topProperties[i], topProperties[j] = topProperties[j], topProperties[i]
			}
		}
	}

	// 상위 10개만
	if len(topProperties) > 10 {
		topProperties = topProperties[:10]
	}

	// 이슈도 최근 50개만
	if len(issues) > 50 {
		issues = issues[:50]
	}

	// === 리뷰 분석 ===
	days := 7
	switch period {
	case "day":
		days = 1
	case "month":
		days = 30
	}

	recentReviews := s.reviewSvc.ListRecent(days)
	lowReviews := s.reviewSvc.GetLowScoreReviews(days)

	// 평균 점수 계산
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

	// 낮은 점수 리뷰 → 이슈
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

	reviewSummary := &ReviewSummary{
		TotalReviews:    len(recentReviews),
		AvgScore:        avgScore,
		LowScoreCount:   len(lowReviews),
		LowScoreReviews: reviewIssues,
		CategoryAvgs:    catAvgs,
	}

	// === KPI 비교 계산 ===
	praiseCount := categoryCounts["칭찬"]
	totalIssues := calcTotalIssues(categoryCounts)
	currentKPI := KPIMetrics{
		Period:         period,
		TotalMessages:  int(int64(len(messages))),
		IssueCount:     totalIssues - praiseCount, // 칭찬 제외
		PraiseCount:    praiseCount,
		AvgReviewScore: avgScore,
		LowReviewCount: len(lowReviews),
	}
	if currentKPI.TotalMessages > 0 {
		currentKPI.IssueRate = float64(currentKPI.IssueCount) / float64(currentKPI.TotalMessages) * 100
		currentKPI.PraiseRate = float64(currentKPI.PraiseCount) / float64(currentKPI.TotalMessages) * 100
	}

	// 이전 기간 KPI 계산
	prevDayKPI := s.calcPeriodKPI(now.Add(-24*time.Hour), now.Add(-48*time.Hour), 1)
	prevWeekKPI := s.calcPeriodKPI(now.Add(-7*24*time.Hour), now.Add(-14*24*time.Hour), 7)
	prevMonthKPI := s.calcPeriodKPI(now.Add(-30*24*time.Hour), now.Add(-60*24*time.Hour), 30)

	kpi := &KPIComparison{
		Current:   currentKPI,
		PrevDay:   prevDayKPI,
		PrevWeek:  prevWeekKPI,
		PrevMonth: prevMonthKPI,
		DayChange: calcChange(currentKPI, prevDayKPI),
		WeekChange: calcChange(currentKPI, prevWeekKPI),
		MonthChange: calcChange(currentKPI, prevMonthKPI),
	}

	return &AnalysisSummary{
		Period:         period,
		StartDate:      startDate.Format("2006-01-02"),
		EndDate:        now.Format("2006-01-02"),
		TotalMessages:  int64(len(messages)),
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

// totalIssues 변수를 계산하는 헬퍼 (칭찬 포함)
func calcTotalIssues(categoryCounts map[string]int) int {
	total := 0
	for _, cnt := range categoryCounts {
		total += cnt
	}
	return total
}

// calcPeriodKPI — 특정 기간의 KPI 계산
func (s *MessageAnalysisService) calcPeriodKPI(end, start time.Time, days int) KPIMetrics {
	var messages []models.Message
	config.DB.Where("sent_at >= ? AND sent_at < ?", start, end).Find(&messages)

	issueCount := 0
	praiseCount := 0
	for _, msg := range messages {
		for _, ik := range issueKeywords {
			if containsAny(msg.Content, ik.Keywords) {
				if ik.Category == "칭찬" {
					praiseCount++
				} else {
					issueCount++
				}
				break
			}
		}
	}

	// 리뷰 점수
	var reviews []models.Review
	config.DB.Where("guest_review_at >= ? AND guest_review_at < ? AND guest_score > 0", start, end).Find(&reviews)
	var totalScore int
	lowCount := 0
	for _, r := range reviews {
		totalScore += r.GuestScore
		if r.GuestScore <= 4 {
			lowCount++
		}
	}
	avgScore := float64(0)
	if len(reviews) > 0 {
		avgScore = float64(totalScore) / float64(len(reviews))
	}

	kpi := KPIMetrics{
		Period:         fmt.Sprintf("%s~%s", start.Format("01-02"), end.Format("01-02")),
		TotalMessages:  len(messages),
		IssueCount:     issueCount,
		PraiseCount:    praiseCount,
		AvgReviewScore: avgScore,
		LowReviewCount: lowCount,
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

func containsAny(text string, keywords []string) bool {
	lower := strings.ToLower(text)
	for _, kw := range keywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}
