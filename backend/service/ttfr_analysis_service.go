package service

import (
	"hiero-workflow/backend/config"
	"math"
	"sort"
	"time"
)

// TTFRAnalysisService — 첫 응답 시간(Time to First Reply) 분석
type TTFRAnalysisService struct{}

func NewTTFRAnalysisService() *TTFRAnalysisService {
	return &TTFRAnalysisService{}
}

// ---------- 결과 구조체 ----------

// TTFRResult — 전체 분석 결과
type TTFRResult struct {
	Summary       TTFRSummary          `json:"summary"`
	Buckets       []TTFRBucket         `json:"buckets"`
	ByProperty    []TTFRPropertyStat   `json:"by_property"`
	ByChannel     []TTFRChannelStat    `json:"by_channel"`
	Hypothesis    TTFRHypothesis       `json:"hypothesis"`
	DataQuality   TTFRDataQuality      `json:"data_quality"`
}

type TTFRSummary struct {
	TotalConversations int     `json:"total_conversations"`
	WithGuestMsg       int     `json:"with_guest_msg"`
	WithHostReply      int     `json:"with_host_reply"`
	NoReply            int     `json:"no_reply"`
	MedianMinutes      float64 `json:"median_minutes"`
	P90Minutes         float64 `json:"p90_minutes"`
	MeanMinutes        float64 `json:"mean_minutes"`
	Within15Min        int     `json:"within_15min"`
	Within15MinPct     float64 `json:"within_15min_pct"`
}

type TTFRBucket struct {
	Label             string  `json:"label"`
	MinMinutes        float64 `json:"min_minutes"`
	MaxMinutes        float64 `json:"max_minutes"`
	Count             int     `json:"count"`
	Pct               float64 `json:"pct"`
	AcceptedCount     int     `json:"accepted_count"`
	CancelledCount    int     `json:"cancelled_count"`
	NoReservation     int     `json:"no_reservation"`
	ConversionRate    float64 `json:"conversion_rate"`
	AvgRevenue        float64 `json:"avg_revenue"`
}

type TTFRPropertyStat struct {
	PropertyID     int64   `json:"property_id"`
	PropertyName   string  `json:"property_name"`
	ConvCount      int     `json:"conv_count"`
	MedianMinutes  float64 `json:"median_minutes"`
	Within15MinPct float64 `json:"within_15min_pct"`
	ConversionRate float64 `json:"conversion_rate"`
	AvgRevenue     float64 `json:"avg_revenue"`
}

type TTFRChannelStat struct {
	Channel        string  `json:"channel"`
	ConvCount      int     `json:"conv_count"`
	MedianMinutes  float64 `json:"median_minutes"`
	Within15MinPct float64 `json:"within_15min_pct"`
	ConversionRate float64 `json:"conversion_rate"`
}

type TTFRHypothesis struct {
	H1Statement    string  `json:"h1_statement"`
	Fast15MinRate  float64 `json:"fast_15min_conversion_rate"`
	Slow15MinRate  float64 `json:"slow_15min_conversion_rate"`
	Lift           float64 `json:"lift"`
	Validated      bool    `json:"validated"`
	Confidence     string  `json:"confidence"`
	SampleSize     int     `json:"sample_size"`
}

type TTFRDataQuality struct {
	TotalMessages      int64  `json:"total_messages"`
	GuestMessages      int64  `json:"guest_messages"`
	HostMessages       int64  `json:"host_messages"`
	SystemMessages     int64  `json:"system_messages"`
	ConversationsTotal int64  `json:"conversations_total"`
	WithReservation    int    `json:"with_reservation"`
	WithoutReservation int    `json:"without_reservation"`
	DateRange          string `json:"date_range"`
}

// ---------- 내부 구조체 ----------

type convTTFR struct {
	conversationID string
	propertyID     int64
	channelType    string
	guestFirstAt   time.Time
	hostFirstAt    *time.Time
	ttfrMinutes    *float64 // nil = 미응답
	rsvStatus      string   // accepted, cancelled, ""
	totalRate      int64
	propertyName   string
}

// ---------- 메인 분석 ----------

func (s *TTFRAnalysisService) Analyze(startDate, endDate string) (*TTFRResult, error) {
	db := config.DB

	// 1단계: 대화별 첫 게스트 메시지 시각
	type firstMsg struct {
		ConversationID string    `gorm:"column:conversation_id"`
		FirstGuestAt   time.Time `gorm:"column:first_guest_at"`
	}
	var guestFirsts []firstMsg
	db.Raw(`
		SELECT conversation_id, MIN(sent_at) AS first_guest_at
		FROM messages
		WHERE sender_type = 'guest'
		  AND sent_at >= ? AND sent_at < ?
		GROUP BY conversation_id
	`, startDate, endDate).Scan(&guestFirsts)

	if len(guestFirsts) == 0 {
		return &TTFRResult{
			Summary:     TTFRSummary{},
			DataQuality: s.dataQuality(startDate, endDate),
		}, nil
	}

	// conversation_id → firstGuestAt 맵
	guestMap := make(map[string]time.Time, len(guestFirsts))
	convIDs := make([]string, 0, len(guestFirsts))
	for _, g := range guestFirsts {
		guestMap[g.ConversationID] = g.FirstGuestAt
		convIDs = append(convIDs, g.ConversationID)
	}

	// 2단계: 대화별 첫 호스트 응답 시각
	type hostReply struct {
		ConversationID string    `gorm:"column:conversation_id"`
		FirstHostAt    time.Time `gorm:"column:first_host_at"`
	}
	var hostFirsts []hostReply
	db.Raw(`
		SELECT m.conversation_id, MIN(m.sent_at) AS first_host_at
		FROM messages m
		INNER JOIN (
			SELECT conversation_id, MIN(sent_at) AS first_guest_at
			FROM messages
			WHERE sender_type = 'guest'
			  AND sent_at >= ? AND sent_at < ?
			GROUP BY conversation_id
		) g ON m.conversation_id = g.conversation_id
		WHERE m.sender_type = 'host'
		  AND m.sent_at > g.first_guest_at
		GROUP BY m.conversation_id
	`, startDate, endDate).Scan(&hostFirsts)

	hostMap := make(map[string]time.Time, len(hostFirsts))
	for _, h := range hostFirsts {
		hostMap[h.ConversationID] = h.FirstHostAt
	}

	// 3단계: 대화 → 예약 + 숙소 매핑
	type convMeta struct {
		ConversationID string `gorm:"column:conversation_id"`
		PropertyID     int64  `gorm:"column:property_id"`
		ChannelType    string `gorm:"column:channel_type"`
		RsvStatus      string `gorm:"column:rsv_status"`
		TotalRate      int64  `gorm:"column:total_rate"`
		PropertyName   string `gorm:"column:property_name"`
	}
	var metas []convMeta
	db.Raw(`
		SELECT
			c.conversation_id,
			c.property_id,
			c.channel_type,
			COALESCE(r.status, '') AS rsv_status,
			COALESCE(r.total_rate, 0) AS total_rate,
			COALESCE(p.name, '') AS property_name
		FROM conversations c
		LEFT JOIN reservations r ON (
			(c.reservation_code != '' AND r.reservation_code = c.reservation_code)
			OR (c.reservation_code = '' AND r.conversation_id = c.conversation_id)
		)
		LEFT JOIN properties p ON p.hostex_id = c.property_id
		WHERE c.conversation_id IN ?
	`, convIDs).Scan(&metas)

	metaMap := make(map[string]convMeta, len(metas))
	for _, m := range metas {
		metaMap[m.ConversationID] = m
	}

	// 4단계: 통합 — convTTFR 리스트 구성
	records := make([]convTTFR, 0, len(guestFirsts))
	for _, g := range guestFirsts {
		cid := g.ConversationID
		rec := convTTFR{
			conversationID: cid,
			guestFirstAt:   g.FirstGuestAt,
		}
		if meta, ok := metaMap[cid]; ok {
			rec.propertyID = meta.PropertyID
			rec.channelType = meta.ChannelType
			rec.rsvStatus = meta.RsvStatus
			rec.totalRate = meta.TotalRate
			rec.propertyName = meta.PropertyName
		}
		if hostAt, ok := hostMap[cid]; ok {
			rec.hostFirstAt = &hostAt
			mins := hostAt.Sub(g.FirstGuestAt).Minutes()
			rec.ttfrMinutes = &mins
		}
		records = append(records, rec)
	}

	// 5단계: 분석
	result := &TTFRResult{
		Summary:     s.calcSummary(records),
		Buckets:     s.calcBuckets(records),
		ByProperty:  s.calcByProperty(records),
		ByChannel:   s.calcByChannel(records),
		Hypothesis:  s.testH1(records),
		DataQuality: s.dataQuality(startDate, endDate),
	}

	return result, nil
}

// ---------- Summary ----------

func (s *TTFRAnalysisService) calcSummary(records []convTTFR) TTFRSummary {
	sum := TTFRSummary{TotalConversations: len(records)}

	var ttfrs []float64
	for _, r := range records {
		sum.WithGuestMsg++
		if r.ttfrMinutes != nil {
			sum.WithHostReply++
			ttfrs = append(ttfrs, *r.ttfrMinutes)
			if *r.ttfrMinutes <= 15 {
				sum.Within15Min++
			}
		} else {
			sum.NoReply++
		}
	}

	if len(ttfrs) > 0 {
		sort.Float64s(ttfrs)
		sum.MedianMinutes = percentile(ttfrs, 0.5)
		sum.P90Minutes = percentile(ttfrs, 0.9)
		total := 0.0
		for _, v := range ttfrs {
			total += v
		}
		sum.MeanMinutes = math.Round(total/float64(len(ttfrs))*10) / 10
	}
	if sum.WithHostReply > 0 {
		sum.Within15MinPct = math.Round(float64(sum.Within15Min)/float64(sum.WithHostReply)*1000) / 10
	}

	return sum
}

// ---------- Buckets ----------

func (s *TTFRAnalysisService) calcBuckets(records []convTTFR) []TTFRBucket {
	type bucketDef struct {
		label string
		min   float64
		max   float64
	}
	defs := []bucketDef{
		{"0~5분", 0, 5},
		{"5~15분", 5, 15},
		{"15~30분", 15, 30},
		{"30~60분", 30, 60},
		{"1~3시간", 60, 180},
		{"3~12시간", 180, 720},
		{"12시간+", 720, 999999},
		{"미응답", -1, -1},
	}

	buckets := make([]TTFRBucket, len(defs))
	for i, d := range defs {
		buckets[i] = TTFRBucket{Label: d.label, MinMinutes: d.min, MaxMinutes: d.max}
	}

	for _, r := range records {
		var idx int
		if r.ttfrMinutes == nil {
			idx = len(defs) - 1 // 미응답
		} else {
			mins := *r.ttfrMinutes
			switch {
			case mins <= 5:
				idx = 0
			case mins <= 15:
				idx = 1
			case mins <= 30:
				idx = 2
			case mins <= 60:
				idx = 3
			case mins <= 180:
				idx = 4
			case mins <= 720:
				idx = 5
			default:
				idx = 6
			}
		}
		buckets[idx].Count++
		switch r.rsvStatus {
		case "accepted":
			buckets[idx].AcceptedCount++
			buckets[idx].AvgRevenue += float64(r.totalRate)
		case "cancelled":
			buckets[idx].CancelledCount++
		default:
			buckets[idx].NoReservation++
		}
	}

	total := len(records)
	for i := range buckets {
		b := &buckets[i]
		if total > 0 {
			b.Pct = math.Round(float64(b.Count)/float64(total)*1000) / 10
		}
		withRsv := b.AcceptedCount + b.CancelledCount
		if withRsv > 0 {
			b.ConversionRate = math.Round(float64(b.AcceptedCount)/float64(withRsv)*1000) / 10
		}
		if b.AcceptedCount > 0 {
			b.AvgRevenue = math.Round(b.AvgRevenue / float64(b.AcceptedCount))
		}
	}

	return buckets
}

// ---------- By Property ----------

func (s *TTFRAnalysisService) calcByProperty(records []convTTFR) []TTFRPropertyStat {
	type propAcc struct {
		name      string
		ttfrs     []float64
		accepted  int
		cancelled int
		revenue   int64
		total     int
	}
	pm := make(map[int64]*propAcc)

	for _, r := range records {
		if r.propertyID == 0 {
			continue
		}
		acc, ok := pm[r.propertyID]
		if !ok {
			acc = &propAcc{name: r.propertyName}
			pm[r.propertyID] = acc
		}
		acc.total++
		if r.ttfrMinutes != nil {
			acc.ttfrs = append(acc.ttfrs, *r.ttfrMinutes)
		}
		if r.rsvStatus == "accepted" {
			acc.accepted++
			acc.revenue += r.totalRate
		} else if r.rsvStatus == "cancelled" {
			acc.cancelled++
		}
	}

	result := make([]TTFRPropertyStat, 0, len(pm))
	for pid, acc := range pm {
		if acc.total < 3 {
			continue // 최소 3건 이상
		}
		stat := TTFRPropertyStat{
			PropertyID: pid,
			PropertyName: acc.name,
			ConvCount:  acc.total,
		}
		if len(acc.ttfrs) > 0 {
			sort.Float64s(acc.ttfrs)
			stat.MedianMinutes = percentile(acc.ttfrs, 0.5)
			within15 := 0
			for _, t := range acc.ttfrs {
				if t <= 15 {
					within15++
				}
			}
			stat.Within15MinPct = math.Round(float64(within15)/float64(len(acc.ttfrs))*1000) / 10
		}
		withRsv := acc.accepted + acc.cancelled
		if withRsv > 0 {
			stat.ConversionRate = math.Round(float64(acc.accepted)/float64(withRsv)*1000) / 10
		}
		if acc.accepted > 0 {
			stat.AvgRevenue = math.Round(float64(acc.revenue) / float64(acc.accepted))
		}
		result = append(result, stat)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].MedianMinutes < result[j].MedianMinutes
	})

	return result
}

// ---------- By Channel ----------

func (s *TTFRAnalysisService) calcByChannel(records []convTTFR) []TTFRChannelStat {
	type chAcc struct {
		ttfrs     []float64
		accepted  int
		cancelled int
		total     int
	}
	cm := make(map[string]*chAcc)

	for _, r := range records {
		ch := r.channelType
		if ch == "" {
			ch = "unknown"
		}
		acc, ok := cm[ch]
		if !ok {
			acc = &chAcc{}
			cm[ch] = acc
		}
		acc.total++
		if r.ttfrMinutes != nil {
			acc.ttfrs = append(acc.ttfrs, *r.ttfrMinutes)
		}
		if r.rsvStatus == "accepted" {
			acc.accepted++
		} else if r.rsvStatus == "cancelled" {
			acc.cancelled++
		}
	}

	result := make([]TTFRChannelStat, 0, len(cm))
	for ch, acc := range cm {
		stat := TTFRChannelStat{
			Channel:   ch,
			ConvCount: acc.total,
		}
		if len(acc.ttfrs) > 0 {
			sort.Float64s(acc.ttfrs)
			stat.MedianMinutes = percentile(acc.ttfrs, 0.5)
			within15 := 0
			for _, t := range acc.ttfrs {
				if t <= 15 {
					within15++
				}
			}
			stat.Within15MinPct = math.Round(float64(within15)/float64(len(acc.ttfrs))*1000) / 10
		}
		withRsv := acc.accepted + acc.cancelled
		if withRsv > 0 {
			stat.ConversionRate = math.Round(float64(acc.accepted)/float64(withRsv)*1000) / 10
		}
		result = append(result, stat)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].ConvCount > result[j].ConvCount
	})

	return result
}

// ---------- 가설 H1 검증 ----------

func (s *TTFRAnalysisService) testH1(records []convTTFR) TTFRHypothesis {
	h := TTFRHypothesis{
		H1Statement: "TTFR ≤ 15분 응답 시 결제 전환율이 15분 초과보다 유의미하게 높다",
	}

	var fastAccepted, fastTotal, slowAccepted, slowTotal int

	for _, r := range records {
		if r.ttfrMinutes == nil {
			continue
		}
		hasRsv := r.rsvStatus == "accepted" || r.rsvStatus == "cancelled"
		if !hasRsv {
			continue
		}
		isAccepted := r.rsvStatus == "accepted"

		if *r.ttfrMinutes <= 15 {
			fastTotal++
			if isAccepted {
				fastAccepted++
			}
		} else {
			slowTotal++
			if isAccepted {
				slowAccepted++
			}
		}
	}

	h.SampleSize = fastTotal + slowTotal

	if fastTotal > 0 {
		h.Fast15MinRate = math.Round(float64(fastAccepted)/float64(fastTotal)*1000) / 10
	}
	if slowTotal > 0 {
		h.Slow15MinRate = math.Round(float64(slowAccepted)/float64(slowTotal)*1000) / 10
	}
	if h.Slow15MinRate > 0 {
		h.Lift = math.Round((h.Fast15MinRate-h.Slow15MinRate)/h.Slow15MinRate*1000) / 10
	}

	h.Validated = h.Fast15MinRate > h.Slow15MinRate && h.SampleSize >= 30
	switch {
	case h.SampleSize >= 200 && h.Lift > 10:
		h.Confidence = "strong"
	case h.SampleSize >= 50 && h.Lift > 5:
		h.Confidence = "moderate"
	case h.SampleSize >= 30:
		h.Confidence = "weak"
	default:
		h.Confidence = "insufficient_data"
	}

	return h
}

// ---------- 데이터 품질 ----------

func (s *TTFRAnalysisService) dataQuality(startDate, endDate string) TTFRDataQuality {
	db := config.DB
	dq := TTFRDataQuality{
		DateRange: startDate + " ~ " + endDate,
	}

	db.Raw(`SELECT COUNT(*) FROM messages WHERE sent_at >= ? AND sent_at < ?`, startDate, endDate).Scan(&dq.TotalMessages)
	db.Raw(`SELECT COUNT(*) FROM messages WHERE sender_type = 'guest' AND sent_at >= ? AND sent_at < ?`, startDate, endDate).Scan(&dq.GuestMessages)
	db.Raw(`SELECT COUNT(*) FROM messages WHERE sender_type = 'host' AND sent_at >= ? AND sent_at < ?`, startDate, endDate).Scan(&dq.HostMessages)
	db.Raw(`SELECT COUNT(*) FROM messages WHERE sender_type = 'system' AND sent_at >= ? AND sent_at < ?`, startDate, endDate).Scan(&dq.SystemMessages)
	db.Raw(`SELECT COUNT(*) FROM conversations`).Scan(&dq.ConversationsTotal)

	return dq
}

// ---------- 유틸 ----------

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := p * float64(len(sorted)-1)
	lower := int(math.Floor(idx))
	upper := int(math.Ceil(idx))
	if lower == upper || upper >= len(sorted) {
		return math.Round(sorted[lower]*10) / 10
	}
	weight := idx - float64(lower)
	return math.Round((sorted[lower]*(1-weight)+sorted[upper]*weight)*10) / 10
}
