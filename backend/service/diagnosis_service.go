package service

import (
	"fmt"
	"sort"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// ─── 응답 구조체 ─────────────────────────────────────────────

type EngineScore struct {
	Engine     string                 `json:"engine"`
	Label      string                 `json:"label"`
	Score      float64                `json:"score"`
	Status     string                 `json:"status"`
	BottleNeck string                 `json:"bottleneck"`
	Details    map[string]interface{} `json:"details"`
	Actions    []string               `json:"actions"`
}

type DiagnosisResult struct {
	PropertyID      uint          `json:"property_id"`
	PropertyCode    string        `json:"property_code"`
	PropertyName    string        `json:"property_name"`
	OverallScore    float64       `json:"overall_score"`
	OverallGrade    string        `json:"overall_grade"`
	Engines         []EngineScore `json:"engines"`
	WeakestEngine   string        `json:"weakest_engine"`
	StrongestEngine string        `json:"strongest_engine"`

	// 재무 계산값
	MonthlyRevenue     int     `json:"monthly_revenue"`
	MonthlyCost        int     `json:"monthly_cost"`
	MonthlyProfit      int     `json:"monthly_profit"`
	ProfitRate         float64 `json:"profit_rate"`
	BreakEvenOccupancy float64 `json:"break_even_occupancy"`

	Headline  string `json:"headline"`
	RootCause string `json:"root_cause"`
	Note      string `json:"note,omitempty"`
}

type PortfolioResult struct {
	TotalListings    int                `json:"total_listings"`
	Averages         map[string]float64 `json:"averages"`
	Distribution     map[string]int     `json:"distribution"`
	BottleneckCount  map[string]int     `json:"bottleneck_counts"`
	PortfolioFinance map[string]int     `json:"portfolio_finance"`
}

// ─── 액션맵 (엔진 × 약점 → 추천 액션) ──────────────────────

var actionMap = map[string]map[string][]string{
	"value_creation": {
		"location_score":    {"입지 한계 → 타겟 고객 재설정", "가격 포지션 재검토"},
		"room_type_score":   {"침대 구성 재검토 (싱글 2 → 더블 1+싱글 1?)", "수요 맞는 룸타입 조사"},
		"price_value_score": {"가격 대비 체감가치 강화", "어메니티 보완"},
		"interior_score":    {"인테리어/비품 개선", "경쟁 숙소 대비 차별점 보강"},
		"target_fit_score":  {"타겟 고객 재정의", "플랫폼별 노출 대상 조정"},
	},
	"marketing": {
		"photo_score":               {"대표사진 교체 (특히 아고다)", "플랫폼별 썸네일 다르게 운영"},
		"channel_exposure_score":    {"노출 부스트 캠페인 검토", "멀티 플랫폼 등록 확인"},
		"listing_score":             {"제목/설명 SEO 키워드 보강", "주변 명소/교통 강조"},
		"review_score":              {"후기 확보 전략 실행", "부정 리뷰 응답 보강"},
		"channel_performance_score": {"채널별 ROI 분석", "저성과 채널 광고비 재배분"},
	},
	"sales": {
		"occupancy_rate":       {"가격 -10~15% 하향 테스트", "비수기 최소 가동률 방어가 운영"},
		"inquiry_conversion":   {"문의 응답 시간 단축 (목표 5분 이내)", "자동응답 메시지 설정"},
		"booking_conversion":   {"즉시예약 활성화", "예약 허들 낮추기 (보증금/규칙 완화)"},
		"price_flexibility":    {"PriceLabs 자동 가격 적용", "요일별/시즌별 가격 차등"},
		"long_stay_conversion": {"장기숙박 할인 설정 (7박/30박)", "월세형 상품 기획"},
	},
	"value_delivery": {
		"cleaning_score": {"청소 체크리스트 강화", "청소업체 재교육"},
		"checkin_score":  {"체크인 메시지 자동화", "도어락 매뉴얼 정비"},
		"cs_score":       {"민원 유형별 대응 매뉴얼 작성", "CS 응답 시간 단축"},
		"amenity_score":  {"비품 체크리스트 점검 루틴화", "소모품 자동 보충 시스템"},
		"claim_rate":     {"클레임 원인 분석 → 반복 이슈 제거", "퇴실 후 즉시 점검 강화"},
	},
	"finance": {
		"profit_negative": {"손실 숙소 → 비용 구조부터 점검", "월세/관리비 재협상"},
		"profit_low":      {"청소비/수수료 절감 검토", "최소 가동률 방어가 설정"},
		"break_even_far":  {"BEP 미달 → 비용 문제 우선 점검", "운영 중단 검토"},
	},
}

// ─── 서비스 ──────────────────────────────────────────────────

type DiagnosisService struct{}

func NewDiagnosisService() *DiagnosisService {
	return &DiagnosisService{}
}

func (s *DiagnosisService) DiagnoseAll() ([]DiagnosisResult, error) {
	var items []models.PropertyBusinessDiagnosis
	if err := config.DB.Find(&items).Error; err != nil {
		return nil, err
	}

	results := make([]DiagnosisResult, 0, len(items))
	for _, d := range items {
		prop := s.findProperty(d.PropertyID)
		results = append(results, s.diagnose(d, prop))
	}

	// 점수 낮은 순 정렬
	sort.Slice(results, func(i, j int) bool {
		return results[i].OverallScore < results[j].OverallScore
	})

	return results, nil
}

func (s *DiagnosisService) DiagnoseOne(propertyID uint) (*DiagnosisResult, error) {
	var d models.PropertyBusinessDiagnosis
	if err := config.DB.Where("property_id = ?", propertyID).First(&d).Error; err != nil {
		return nil, err
	}
	prop := s.findProperty(d.PropertyID)
	result := s.diagnose(d, prop)
	return &result, nil
}

func (s *DiagnosisService) Portfolio() (*PortfolioResult, error) {
	results, err := s.DiagnoseAll()
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return &PortfolioResult{}, nil
	}

	sums := map[string]float64{}
	dist := map[string]int{"healthy": 0, "warning": 0, "critical": 0}
	bnCount := map[string]int{}
	var totalRev, totalCost int

	for _, r := range results {
		for _, e := range r.Engines {
			sums[e.Engine] += e.Score
		}
		switch {
		case r.OverallScore < 40:
			dist["critical"]++
		case r.OverallScore < 65:
			dist["warning"]++
		default:
			dist["healthy"]++
		}
		bnCount[r.WeakestEngine]++
		totalRev += r.MonthlyRevenue
		totalCost += r.MonthlyCost
	}

	n := float64(len(results))
	avgs := map[string]float64{}
	for k, v := range sums {
		avgs[k] = round1(v / n)
	}

	return &PortfolioResult{
		TotalListings:   len(results),
		Averages:        avgs,
		Distribution:    dist,
		BottleneckCount: bnCount,
		PortfolioFinance: map[string]int{
			"total_revenue": totalRev,
			"total_cost":    totalCost,
			"total_profit":  totalRev - totalCost,
		},
	}, nil
}

func (s *DiagnosisService) findProperty(id uint) *models.Property {
	var p models.Property
	config.DB.First(&p, id)
	return &p
}

// ─── 핵심: 5엔진 진단 ────────────────────────────────────────

func (s *DiagnosisService) diagnose(d models.PropertyBusinessDiagnosis, prop *models.Property) DiagnosisResult {
	// 1. 가치 창출 (5개)
	vc := buildEngine("value_creation", "가치 창출", map[string]int{
		"location_score":    d.LocationScore,
		"room_type_score":   d.RoomTypeScore,
		"price_value_score": d.PriceValueScore,
		"interior_score":    d.InteriorScore,
		"target_fit_score":  d.TargetFitScore,
	})

	// 2. 마케팅 (5개)
	mk := buildEngine("marketing", "마케팅", map[string]int{
		"photo_score":               d.PhotoScore,
		"channel_exposure_score":    d.ChannelExposureScore,
		"listing_score":             d.ListingScore,
		"review_score":              d.ReviewScore,
		"channel_performance_score": d.ChannelPerformanceScore,
	})

	// 3. 판매 (5개)
	sl := buildEngine("sales", "판매", map[string]int{
		"occupancy_rate":       int(d.OccupancyRate),
		"inquiry_conversion":   d.InquiryConversion,
		"booking_conversion":   d.BookingConversion,
		"price_flexibility":    d.PriceFlexibility,
		"long_stay_conversion": d.LongStayConversion,
	})
	// 실제 수치 details에 표시
	sl.Details["occupancy_rate"] = d.OccupancyRate

	// 4. 운영 전달 (5개)
	dl := buildEngine("value_delivery", "운영 전달", map[string]int{
		"cleaning_score": d.CleaningScore,
		"checkin_score":  d.CheckinScore,
		"cs_score":       d.CSScore,
		"amenity_score":  d.AmenityScore,
		"claim_rate":     d.ClaimRate,
	})

	// 5. 재무 (계산)
	cost := d.MonthlyRent + d.MonthlyMgmtFee + d.MonthlyCleanFee + d.PlatformFee
	profit := d.MonthlyRevenue - cost
	var profitRate float64
	if d.MonthlyRevenue > 0 {
		profitRate = float64(profit) / float64(d.MonthlyRevenue) * 100
	} else if cost > 0 {
		profitRate = -100
	}

	var breakEvenOcc float64
	if d.ADR > 0 {
		nightsNeeded := float64(cost) / float64(d.ADR)
		breakEvenOcc = nightsNeeded / 30 * 100
	}

	fnScore := financeScore(profitRate)
	fn := EngineScore{
		Engine: "finance",
		Label:  "재무",
		Score:  fnScore,
		Status: scoreStatus(fnScore),
		Details: map[string]interface{}{
			"monthly_revenue":      d.MonthlyRevenue,
			"monthly_rent":         d.MonthlyRent,
			"monthly_mgmt_fee":     d.MonthlyMgmtFee,
			"monthly_clean_fee":    d.MonthlyCleanFee,
			"platform_fee":         d.PlatformFee,
			"monthly_cost":         cost,
			"profit":               profit,
			"profit_rate":          round1(profitRate),
			"break_even_occupancy": round1(breakEvenOcc),
		},
	}
	if profit < 0 {
		fn.BottleNeck = "profit_negative"
	} else if breakEvenOcc > 80 {
		fn.BottleNeck = "break_even_far"
	} else {
		fn.BottleNeck = "profit_low"
	}
	fn.Actions = actionMap["finance"][fn.BottleNeck]

	engines := []EngineScore{vc, mk, sl, dl, fn}
	overall := 0.0
	for _, e := range engines {
		overall += e.Score
	}
	overall /= 5

	sorted := make([]EngineScore, len(engines))
	copy(sorted, engines)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Score < sorted[j].Score })

	headline := generateHeadline(sorted[0], d, cost, breakEvenOcc)
	rootCause := generateRootCause(sorted[0])

	return DiagnosisResult{
		PropertyID:         d.PropertyID,
		PropertyCode:       prop.Code,
		PropertyName:       func() string { if prop.DisplayName != "" { return prop.DisplayName }; return prop.Name }(),
		OverallScore:       round1(overall),
		OverallGrade:       grade(overall),
		Engines:            engines,
		WeakestEngine:      sorted[0].Engine,
		StrongestEngine:    sorted[len(sorted)-1].Engine,
		MonthlyRevenue:     d.MonthlyRevenue,
		MonthlyCost:        cost,
		MonthlyProfit:      profit,
		ProfitRate:         round1(profitRate),
		BreakEvenOccupancy: round1(breakEvenOcc),
		Headline:           headline,
		RootCause:          rootCause,
		Note:               d.Note,
	}
}

// ─── 엔진 빌더 ───────────────────────────────────────────────

func buildEngine(engine, label string, scores map[string]int) EngineScore {
	avg := avgInt(scores)
	bn := minKey(scores)
	details := map[string]interface{}{}
	for k, v := range scores {
		details[k] = v
	}
	return EngineScore{
		Engine:     engine,
		Label:      label,
		Score:      round1(avg),
		Status:     scoreStatus(avg),
		BottleNeck: bn,
		Details:    details,
		Actions:    actionMap[engine][bn],
	}
}

// ─── 헤드라인 / 원인 생성 ────────────────────────────────────

func generateHeadline(weakest EngineScore, d models.PropertyBusinessDiagnosis, cost int, beo float64) string {
	switch weakest.Engine {
	case "finance":
		if d.MonthlyRevenue < cost {
			return fmt.Sprintf("월 %s원 손실 · 비용 구조 재검토 필요", formatKRW(cost-d.MonthlyRevenue))
		}
		return fmt.Sprintf("BEP 가동률 %.0f%% · 현재 %.0f%%로 여유 부족", beo, d.OccupancyRate)
	case "sales":
		return fmt.Sprintf("가동률 %.0f%% · 가격 또는 노출 문제", d.OccupancyRate)
	case "marketing":
		return fmt.Sprintf("마케팅 약함 (점수 %.0f) · 사진/리뷰부터 점검", weakest.Score)
	case "value_creation":
		return fmt.Sprintf("상품성 약함 (점수 %.0f) · 룸타입/인테리어 재검토", weakest.Score)
	case "value_delivery":
		return "운영 전달 약함 · 청소/체크인/CS 점검 필요"
	}
	return "전반적 재점검 필요"
}

func generateRootCause(weakest EngineScore) string {
	labels := map[string]string{
		"location_score":            "입지",
		"room_type_score":           "침대 구성",
		"price_value_score":         "가격 대비 가치",
		"interior_score":            "인테리어",
		"target_fit_score":          "타겟 적합성",
		"photo_score":               "사진 퀄리티",
		"channel_exposure_score":    "플랫폼 노출",
		"listing_score":             "리스팅 제목/설명",
		"review_score":              "리뷰/평점",
		"channel_performance_score": "채널별 성과",
		"occupancy_rate":            "가동률",
		"inquiry_conversion":        "문의 전환율",
		"booking_conversion":        "예약 전환율",
		"price_flexibility":         "가격 조정",
		"long_stay_conversion":      "장기숙박 전환",
		"cleaning_score":            "청소 품질",
		"checkin_score":             "체크인",
		"cs_score":                  "CS 응답",
		"amenity_score":             "비품 관리",
		"claim_rate":                "클레임 발생률",
		"profit_negative":           "비용 > 매출",
		"profit_low":                "이익률 낮음",
		"break_even_far":            "BEP 미달",
	}
	label := labels[weakest.BottleNeck]
	if label == "" {
		label = weakest.BottleNeck
	}
	return fmt.Sprintf("%s 엔진 · 핵심 원인: %s", weakest.Label, label)
}

// ─── 유틸 ────────────────────────────────────────────────────

func avgInt(m map[string]int) float64 {
	if len(m) == 0 {
		return 0
	}
	sum := 0
	for _, v := range m {
		sum += v
	}
	return float64(sum) / float64(len(m))
}

func minKey(m map[string]int) string {
	var k string
	min := 101
	for key, v := range m {
		if v < min {
			min = v
			k = key
		}
	}
	return k
}

func scoreStatus(s float64) string {
	switch {
	case s >= 75:
		return "healthy"
	case s >= 55:
		return "warning"
	default:
		return "critical"
	}
}

func financeScore(profitRate float64) float64 {
	switch {
	case profitRate >= 25:
		return 90
	case profitRate >= 15:
		return 75
	case profitRate >= 5:
		return 60
	case profitRate >= 0:
		return 45
	default:
		return 20
	}
}

func grade(score float64) string {
	switch {
	case score >= 85:
		return "S"
	case score >= 70:
		return "A"
	case score >= 55:
		return "B"
	case score >= 40:
		return "C"
	default:
		return "D"
	}
}

func round1(f float64) float64 {
	return float64(int(f*10)) / 10
}

func formatKRW(n int) string {
	if n >= 10000 {
		return fmt.Sprintf("%d만%d천", n/10000, (n%10000)/1000)
	}
	return fmt.Sprintf("%d,000", n/1000)
}
