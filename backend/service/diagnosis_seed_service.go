package service

import (
	"log"
	"math"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// DiagnosisSeedService 예약/청소/이슈 데이터로 진단 자동 생성/갱신
type DiagnosisSeedService struct{}

func NewDiagnosisSeedService() *DiagnosisSeedService {
	return &DiagnosisSeedService{}
}

type propStats struct {
	PropertyID uint

	// 예약 기반
	MonthlyRevenue   int
	MonthlyComm      int
	TotalNights      int
	ReservationCount int
	ADR              int
	LongStayCount    int // 7박 이상
	TotalCount       int // 전체 (확정+취소 포함)
	CancelCount      int
	ADRStdDev        float64 // ADR 표준편차 (가격 유연성)

	// 청소 기반
	CleaningTotal     int
	CleaningCompleted int
	CleaningIssues    int

	// 이슈 기반
	IssueTotal       int
	IssueGuest       int     // guest 타입 (체크인 관련)
	IssueFacility    int     // facility 타입 (비품/시설)
	IssueCleaning    int     // cleaning 타입
	AvgResolveHours  float64 // 평균 해결 시간

	// 숙소 마스터
	Rent    int64
	MgmtFee int64

	// Hostex 거래 기반 (CSV 업로드)
	TxRevenue    int64 // 객실 요금 합계
	TxRefund     int64 // 환불
	TxCleanFee   int64 // 청소 비용
	TxMgmtFee    int64 // 관리비
	TxRentOut    int64 // 월세
	TxOperFee    int64 // 운영비
	TxLaborFee   int64 // 노동비
	TxSupplies   int64 // 소모품
	TxMaint      int64 // 유지보수
	TxOther      int64 // 기타 비용
	HasTxData    bool  // 거래 데이터 존재 여부
}

// GenerateAll 전체 Hostex 연결 숙소에 진단 생성/갱신
func (s *DiagnosisSeedService) GenerateAll() (int, error) {
	var properties []models.Property
	config.DB.Where("hostex_id > 0 AND status = ?", "active").Find(&properties)
	if len(properties) == 0 {
		return 0, nil
	}

	now := time.Now()
	startDate := now.AddDate(0, -1, 0).Format("2006-01-02")
	endDate := now.Format("2006-01-02")

	// 숙소별 통계 초기화
	statsMap := map[uint]*propStats{}
	for _, p := range properties {
		statsMap[p.ID] = &propStats{
			PropertyID: p.ID,
			Rent:       p.MonthlyRent,
			MgmtFee:    p.ManagementFee,
		}
	}

	// ─── 1. 예약 데이터 집계 ─────────────────────────────────
	s.queryReservations(statsMap, startDate, endDate)
	s.queryADRVariance(statsMap, startDate, endDate)
	s.queryCancelRate(statsMap, startDate, endDate)

	// ─── 2. 청소 데이터 집계 ─────────────────────────────────
	s.queryCleaningStats(statsMap, startDate)

	// ─── 3. 이슈 데이터 집계 ─────────────────────────────────
	s.queryIssueStats(statsMap, startDate)

	// ─── 4. Hostex 거래 데이터 집계 (CSV 업로드분) ────────────
	s.queryTransactionStats(statsMap)

	// ─── 4. 진단 레코드 생성/업데이트 ────────────────────────
	created := 0
	for _, p := range properties {
		st := statsMap[p.ID]
		diag := buildDiagnosisFromStats(p, st)

		var existing models.PropertyBusinessDiagnosis
		err := config.DB.Where("property_id = ?", p.ID).First(&existing).Error
		if err != nil {
			config.DB.Create(&diag)
			created++
		} else {
			// 자동 계산 지표만 갱신 (수동 입력한 가치창출/마케팅은 보호)
			config.DB.Model(&existing).Updates(map[string]interface{}{
				// 판매
				"occupancy_rate":       diag.OccupancyRate,
				"inquiry_conversion":   diag.InquiryConversion,
				"booking_conversion":   diag.BookingConversion,
				"price_flexibility":    diag.PriceFlexibility,
				"long_stay_conversion": diag.LongStayConversion,
				// 운영전달
				"cleaning_score": diag.CleaningScore,
				"checkin_score":  diag.CheckinScore,
				"cs_score":       diag.CSScore,
				"amenity_score":  diag.AmenityScore,
				"claim_rate":     diag.ClaimRate,
				// 재무
				"monthly_revenue":  diag.MonthlyRevenue,
				"monthly_rent":     diag.MonthlyRent,
				"monthly_mgmt_fee": diag.MonthlyMgmtFee,
				"monthly_clean_fee": diag.MonthlyCleanFee,
				"platform_fee":     diag.PlatformFee,
				"adr":              diag.ADR,
			})
		}
	}

	log.Printf("[diagnosis] %d개 신규 생성, %d개 갱신 (총 %d개)", created, len(properties)-created, len(properties))
	return len(properties), nil
}

// ─── 쿼리: 예약 기본 통계 ────────────────────────────────────

func (s *DiagnosisSeedService) queryReservations(statsMap map[uint]*propStats, startDate, endDate string) {
	type revRow struct {
		InternalPropID uint
		TotalRevenue   int64
		TotalComm      int64
		TotalNights    int
		ResCount       int
		LongStay       int
	}
	var rows []revRow
	config.DB.Model(&models.Reservation{}).
		Select(`internal_prop_id,
			SUM(total_rate) as total_revenue,
			SUM(total_commission) as total_comm,
			SUM(nights) as total_nights,
			COUNT(*) as res_count,
			SUM(CASE WHEN nights >= 7 THEN 1 ELSE 0 END) as long_stay`).
		Where("internal_prop_id IS NOT NULL AND check_in_date >= ? AND check_in_date <= ? AND status IN ?",
			startDate, endDate, []string{"accepted", "checked_in", "checked_out"}).
		Group("internal_prop_id").
		Scan(&rows)

	for _, r := range rows {
		if st, ok := statsMap[r.InternalPropID]; ok {
			st.MonthlyRevenue = int(r.TotalRevenue)
			st.MonthlyComm = int(r.TotalComm)
			st.TotalNights = r.TotalNights
			st.ReservationCount = r.ResCount
			st.LongStayCount = r.LongStay
			if r.TotalNights > 0 {
				st.ADR = int(r.TotalRevenue) / r.TotalNights
			}
		}
	}
}

// ─── 쿼리: 취소율 (확정+취소 전체) ──────────────────────────

func (s *DiagnosisSeedService) queryCancelRate(statsMap map[uint]*propStats, startDate, endDate string) {
	type cancelRow struct {
		InternalPropID uint
		TotalAll       int
		Cancelled      int
	}
	var rows []cancelRow
	config.DB.Model(&models.Reservation{}).
		Select(`internal_prop_id,
			COUNT(*) as total_all,
			SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled`).
		Where("internal_prop_id IS NOT NULL AND check_in_date >= ? AND check_in_date <= ?",
			startDate, endDate).
		Group("internal_prop_id").
		Scan(&rows)

	for _, r := range rows {
		if st, ok := statsMap[r.InternalPropID]; ok {
			st.TotalCount = r.TotalAll
			st.CancelCount = r.Cancelled
		}
	}
}

// ─── 쿼리: ADR 변동성 (가격 유연성) ─────────────────────────

func (s *DiagnosisSeedService) queryADRVariance(statsMap map[uint]*propStats, startDate, endDate string) {
	type adrRow struct {
		InternalPropID uint
		AdrStddev      float64
	}
	var rows []adrRow
	config.DB.Model(&models.Reservation{}).
		Select(`internal_prop_id,
			STDDEV(CASE WHEN nights > 0 THEN total_rate / nights ELSE 0 END) as adr_stddev`).
		Where("internal_prop_id IS NOT NULL AND check_in_date >= ? AND check_in_date <= ? AND status IN ? AND nights > 0",
			startDate, endDate, []string{"accepted", "checked_in", "checked_out"}).
		Group("internal_prop_id").
		Scan(&rows)

	for _, r := range rows {
		if st, ok := statsMap[r.InternalPropID]; ok {
			st.ADRStdDev = r.AdrStddev
		}
	}
}

// ─── 쿼리: 청소 통계 ────────────────────────────────────────

func (s *DiagnosisSeedService) queryCleaningStats(statsMap map[uint]*propStats, startDate string) {
	type cleanRow struct {
		PropertyID uint
		Total      int
		Completed  int
		Issues     int
	}
	var rows []cleanRow
	config.DB.Model(&models.CleaningTask{}).
		Select(`property_id,
			COUNT(*) as total,
			SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN status = 'issue' THEN 1 ELSE 0 END) as issues`).
		Where("property_id IS NOT NULL AND cleaning_date >= ?", startDate).
		Group("property_id").
		Scan(&rows)

	for _, r := range rows {
		if st, ok := statsMap[r.PropertyID]; ok {
			st.CleaningTotal = r.Total
			st.CleaningCompleted = r.Completed
			st.CleaningIssues = r.Issues
		}
	}
}

// ─── 쿼리: 이슈 통계 (유형별 + 평균 해결시간) ───────────────

func (s *DiagnosisSeedService) queryIssueStats(statsMap map[uint]*propStats, startDate string) {
	type issueRow struct {
		PropertyID   uint
		Total        int
		GuestCount   int
		FacilCount   int
		CleanCount   int
		AvgResolveH  float64
	}
	var rows []issueRow
	config.DB.Model(&models.Issue{}).
		Select(`property_id,
			COUNT(*) as total,
			SUM(CASE WHEN issue_type = 'guest' THEN 1 ELSE 0 END) as guest_count,
			SUM(CASE WHEN issue_type = 'facility' THEN 1 ELSE 0 END) as facil_count,
			SUM(CASE WHEN issue_type = 'cleaning' THEN 1 ELSE 0 END) as clean_count,
			AVG(CASE WHEN resolved_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, created_at, resolved_at) ELSE NULL END) as avg_resolve_h`).
		Where("property_id IS NOT NULL AND created_at >= ?", startDate).
		Group("property_id").
		Scan(&rows)

	for _, r := range rows {
		if st, ok := statsMap[r.PropertyID]; ok {
			st.IssueTotal = r.Total
			st.IssueGuest = r.GuestCount
			st.IssueFacility = r.FacilCount
			st.IssueCleaning = r.CleanCount
			st.AvgResolveHours = r.AvgResolveH
		}
	}
}

// ─── 쿼리: Hostex 거래 통계 (최근 3개월 평균 → 월간) ────────

func (s *DiagnosisSeedService) queryTransactionStats(statsMap map[uint]*propStats) {
	// 최근 3개월의 거래 데이터를 월 평균으로 계산
	type txRow struct {
		PropertyID  uint
		Category    string
		Type        string
		TotalAmount int64
		MonthCount  int
	}
	var rows []txRow
	config.DB.Model(&models.HostexTransaction{}).
		Select(`property_id, category, type, SUM(amount) as total_amount,
			COUNT(DISTINCT year_month) as month_count`).
		Where("property_id IS NOT NULL").
		Group("property_id, category, type").
		Scan(&rows)

	for _, r := range rows {
		st, ok := statsMap[r.PropertyID]
		if !ok {
			continue
		}
		st.HasTxData = true
		months := r.MonthCount
		if months < 1 {
			months = 1
		}
		monthlyAvg := r.TotalAmount / int64(months)

		if r.Type == models.TxTypeIncome {
			switch r.Category {
			case models.TxCatRoomRate:
				st.TxRevenue = monthlyAvg
			case models.TxCatRoomRefund:
				st.TxRefund = monthlyAvg
			}
		} else {
			switch r.Category {
			case models.TxCatCleaning:
				st.TxCleanFee = monthlyAvg
			case models.TxCatMgmt:
				st.TxMgmtFee = monthlyAvg
			case models.TxCatRentOut:
				st.TxRentOut = monthlyAvg
			case models.TxCatOperation:
				st.TxOperFee = monthlyAvg
			case models.TxCatLabor:
				st.TxLaborFee = monthlyAvg
			case models.TxCatSupplies:
				st.TxSupplies = monthlyAvg
			case models.TxCatMaintenance:
				st.TxMaint = monthlyAvg
			default:
				st.TxOther += monthlyAvg
			}
		}
	}
}

// ─── 점수 계산 ───────────────────────────────────────────────

func buildDiagnosisFromStats(p models.Property, st *propStats) models.PropertyBusinessDiagnosis {
	// ── 판매 엔진 ──
	occupancyRate := math.Min(float64(st.TotalNights)/30.0*100, 100)

	// 문의 전환율: 확정 / (확정+취소) — 취소 없으면 높은 점수
	inquiryConv := 80
	if st.TotalCount > 0 {
		confirmRate := float64(st.TotalCount-st.CancelCount) / float64(st.TotalCount) * 100
		inquiryConv = clamp(int(confirmRate), 0, 100)
	}
	if st.ReservationCount == 0 {
		inquiryConv = 0
	}

	bookingConv := occupancyToScore(occupancyRate)

	// 가격 유연성: ADR 표준편차가 적당히 있으면 유연
	priceFlexibility := 50
	if st.ADR > 0 && st.ADRStdDev > 0 {
		varianceRatio := st.ADRStdDev / float64(st.ADR) * 100
		switch {
		case varianceRatio >= 30: // 높은 변동 = 적극적 가격 조정
			priceFlexibility = 85
		case varianceRatio >= 20:
			priceFlexibility = 75
		case varianceRatio >= 10:
			priceFlexibility = 65
		case varianceRatio >= 5:
			priceFlexibility = 55
		default: // 거의 고정가 = 유연성 낮음
			priceFlexibility = 40
		}
	}

	// 장기숙박 전환
	longStayConv := 20
	if st.ReservationCount > 0 {
		longStayConv = clamp(st.LongStayCount*100/st.ReservationCount, 0, 100)
		if longStayConv < 20 {
			longStayConv = 20
		}
	}

	// ── 운영전달 엔진 ──

	// 청소 품질: 완료율 기반
	cleaningScore := 80
	if st.CleaningTotal > 0 {
		completionRate := float64(st.CleaningCompleted) / float64(st.CleaningTotal) * 100
		cleaningScore = clamp(int(completionRate), 20, 100)
		// 이슈 있으면 추가 감점
		if st.CleaningIssues > 0 {
			penalty := st.CleaningIssues * 5
			cleaningScore = clamp(cleaningScore-penalty, 20, 100)
		}
	}

	// 체크인 점수: 게스트 이슈 적을수록 높음
	checkinScore := 85
	if st.IssueGuest > 0 {
		checkinScore = clamp(85-st.IssueGuest*10, 30, 85)
	}

	// CS 응답: 평균 해결시간 기반
	csScore := 75
	if st.AvgResolveHours > 0 {
		switch {
		case st.AvgResolveHours <= 2:
			csScore = 95
		case st.AvgResolveHours <= 6:
			csScore = 85
		case st.AvgResolveHours <= 12:
			csScore = 70
		case st.AvgResolveHours <= 24:
			csScore = 55
		case st.AvgResolveHours <= 48:
			csScore = 40
		default:
			csScore = 25
		}
	}

	// 비품 관리: 시설 이슈 적을수록 높음
	amenityScore := 80
	if st.IssueFacility > 0 {
		amenityScore = clamp(80-st.IssueFacility*12, 25, 80)
	}

	// 클레임 발생률: 전체 이슈 대비 예약 건수
	claimRate := 90
	if st.IssueTotal > 0 {
		if st.ReservationCount > 0 {
			issueRatio := float64(st.IssueTotal) / float64(st.ReservationCount) * 100
			claimRate = clamp(int(100-issueRatio*3), 20, 100)
		} else {
			claimRate = clamp(100-st.IssueTotal*15, 20, 100)
		}
	}

	// ── 재무 엔진 (거래 데이터 우선, 없으면 예약 데이터) ──
	var revenue, rent, mgmt, cleanFee, platformFee int
	adr := st.ADR

	if st.HasTxData {
		// Hostex 거래 CSV 기반 (월 평균)
		revenue = int(st.TxRevenue - st.TxRefund)
		rent = int(st.TxRentOut)
		mgmt = int(st.TxMgmtFee)
		cleanFee = int(st.TxCleanFee)
		platformFee = int(st.TxOperFee + st.TxLaborFee + st.TxSupplies + st.TxMaint + st.TxOther)
	} else {
		// 예약 데이터 기반 폴백
		revenue = st.MonthlyRevenue
		rent = int(p.MonthlyRent)
		mgmt = int(p.ManagementFee)
		cleanFee = st.ReservationCount * 25000
		platformFee = st.MonthlyComm
	}

	return models.PropertyBusinessDiagnosis{
		PropertyID: p.ID,
		// 가치창출 — 수동 (기본값 50)
		LocationScore: 50, RoomTypeScore: 50, PriceValueScore: 50,
		InteriorScore: 50, TargetFitScore: 50,
		// 마케팅 — 수동 (기본값 50)
		PhotoScore: 50, ChannelExposureScore: 50, ListingScore: 50,
		ReviewScore: 50, ChannelPerformanceScore: 50,
		// 판매 — 자동
		OccupancyRate:      math.Round(occupancyRate*10) / 10,
		InquiryConversion:  inquiryConv,
		BookingConversion:  bookingConv,
		PriceFlexibility:   priceFlexibility,
		LongStayConversion: longStayConv,
		// 운영전달 — 자동
		CleaningScore: cleaningScore,
		CheckinScore:  checkinScore,
		CSScore:       csScore,
		AmenityScore:  amenityScore,
		ClaimRate:     claimRate,
		// 재무 — 거래 데이터 우선
		MonthlyRevenue:  revenue,
		MonthlyRent:     rent,
		MonthlyMgmtFee:  mgmt,
		MonthlyCleanFee: cleanFee,
		PlatformFee:     platformFee,
		ADR:             adr,
	}
}

func occupancyToScore(rate float64) int {
	switch {
	case rate >= 85:
		return 90
	case rate >= 70:
		return 75
	case rate >= 50:
		return 60
	case rate >= 30:
		return 40
	default:
		return 20
	}
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
