package service

import (
	"time"

	"hiero-workflow/backend/config"
)

// Data3Service Data 1(예약) + Data 2(정산CSV) JOIN 기반 분석 서비스
type Data3Service struct{}

func NewData3Service() *Data3Service {
	return &Data3Service{}
}

// Data3Record JOIN된 단일 레코드
type Data3Record struct {
	// Data 1 (예약)
	ReservationID   uint   `json:"reservation_id"`
	ReservationCode string `json:"reservation_code"`
	PropertyID      *uint  `json:"property_id"`
	PropertyName    string `json:"property_name"`
	ChannelName     string `json:"channel_name"`
	ChannelType     string `json:"channel_type"`
	ReservationDate string `json:"reservation_date"` // 매출 기준일
	CheckInDate     string `json:"check_in_date"`
	CheckOutDate    string `json:"check_out_date"`
	Nights          int    `json:"nights"`
	TotalRate       int64  `json:"total_rate"`
	TotalCommission int64  `json:"total_commission"`
	Status          string `json:"status"`
	GuestName       string `json:"guest_name"`

	// 계산 필드
	DepositDate string `json:"deposit_date"` // 입금 예정일

	// Data 2 집계 (해당 예약의 CSV 수입/비용)
	CsvIncome  int64 `json:"csv_income"`  // CSV 기준 실제 입금액
	CsvExpense int64 `json:"csv_expense"` // CSV 기준 비용
}

// Data3Summary 기간별 집계
type Data3Summary struct {
	// 발생 매출 (reservation_date 기준)
	AccruedRevenue    int64 `json:"accrued_revenue"`
	AccruedCommission int64 `json:"accrued_commission"`
	AccruedNet        int64 `json:"accrued_net"`

	// 입금 예정 (deposit_date 기준)
	ExpectedDeposit int64 `json:"expected_deposit"`

	// 실제 입금 (CSV transaction_at 기준)
	ActualIncome int64 `json:"actual_income"`

	// 비용 (cost_allocations 기준)
	AllocatedCost int64 `json:"allocated_cost"`

	// 순이익
	NetProfit int64 `json:"net_profit"` // accrued_revenue - allocated_cost

	// 건수
	ReservationCount int `json:"reservation_count"`
	AvgADR           int64 `json:"avg_adr"`
	TotalNights      int   `json:"total_nights"`
}

// DepositDateOffset 채널별 입금일 오프셋
func DepositDateOffset(channelName, checkIn, checkOut string) string {
	ch := normalizeChannel(channelName)
	switch ch {
	case "airbnb":
		return addDays(checkIn, 1)
	case "agoda":
		return checkOut // 체크아웃일
	case "jaritalk", "자리톡":
		return addDays(checkIn, 5)
	default:
		// liv, 리브애니웨어, 삼삼엠투, booking.com, 기타 → check_in_date
		return checkIn
	}
}

// GetData3Records 기간 조건으로 JOIN 데이터 조회
func (s *Data3Service) GetData3Records(startDate, endDate, dateField string, propertyID *uint, channel string) ([]Data3Record, error) {
	query := `
		SELECT
			r.id as reservation_id,
			r.reservation_code,
			r.internal_prop_id as property_id,
			COALESCE(p.title, '') as property_name,
			r.channel_name,
			r.channel_type,
			LEFT(r.booked_at, 10) as reservation_date,
			r.check_in_date,
			r.check_out_date,
			r.nights,
			r.total_rate,
			r.total_commission,
			r.status,
			r.guest_name,
			COALESCE(SUM(CASE WHEN ht.type = '수입' THEN ht.amount ELSE 0 END), 0) as csv_income,
			COALESCE(SUM(CASE WHEN ht.type = '비용' THEN ht.amount ELSE 0 END), 0) as csv_expense
		FROM reservations r
		LEFT JOIN properties p ON r.internal_prop_id = p.id
		LEFT JOIN hostex_transactions ht ON r.reservation_code = ht.reservation_ref
		WHERE r.status IN ('accepted', 'checked_in', 'checked_out')
	`
	args := []interface{}{}

	// 날짜 필터
	dateCol := "r.check_in_date"
	switch dateField {
	case "reservation_date":
		dateCol = "LEFT(r.booked_at, 10)"
	case "check_in_date":
		dateCol = "r.check_in_date"
	}

	if startDate != "" {
		query += " AND " + dateCol + " >= ?"
		args = append(args, startDate)
	}
	if endDate != "" {
		query += " AND " + dateCol + " <= ?"
		args = append(args, endDate)
	}
	if propertyID != nil {
		query += " AND r.internal_prop_id = ?"
		args = append(args, *propertyID)
	}
	if channel != "" {
		query += " AND r.channel_name LIKE ?"
		args = append(args, "%"+channel+"%")
	}

	query += " GROUP BY r.id ORDER BY r.check_in_date DESC"

	var records []Data3Record
	if err := config.DB.Raw(query, args...).Scan(&records).Error; err != nil {
		return nil, err
	}

	// deposit_date 계산
	for i := range records {
		records[i].DepositDate = DepositDateOffset(records[i].ChannelName, records[i].CheckInDate, records[i].CheckOutDate)
	}

	return records, nil
}

// GetData3Summary 기간별 3대 금액 집계
func (s *Data3Service) GetData3Summary(startDate, endDate string) (*Data3Summary, error) {
	summary := &Data3Summary{}

	// 1. 발생 매출 (booked_at 기준)
	config.DB.Raw(`
		SELECT COALESCE(SUM(total_rate), 0), COALESCE(SUM(total_commission), 0), COUNT(*), COALESCE(SUM(nights), 0)
		FROM reservations
		WHERE status IN ('accepted', 'checked_in', 'checked_out')
		AND LEFT(booked_at, 10) >= ?
		AND LEFT(booked_at, 10) <= ?`,
		startDate, endDate,
	).Row().Scan(&summary.AccruedRevenue, &summary.AccruedCommission, &summary.ReservationCount, &summary.TotalNights)
	summary.AccruedNet = summary.AccruedRevenue - summary.AccruedCommission

	if summary.TotalNights > 0 {
		summary.AvgADR = summary.AccruedRevenue / int64(summary.TotalNights)
	}

	// 2. 입금 예정 (deposit_date 기준) — 각 레코드의 deposit_date를 Go에서 계산 후 필터
	var allReservations []struct {
		TotalRate    int64
		ChannelName  string
		CheckInDate  string
		CheckOutDate string
	}
	config.DB.Raw(`
		SELECT total_rate, channel_name, check_in_date, check_out_date
		FROM reservations
		WHERE status IN ('accepted', 'checked_in', 'checked_out')
		AND check_in_date >= ? AND check_in_date <= ?`,
		addDays(startDate, -5), addDays(endDate, 5), // 넉넉하게 가져와서 Go에서 필터
	).Scan(&allReservations)

	for _, r := range allReservations {
		dd := DepositDateOffset(r.ChannelName, r.CheckInDate, r.CheckOutDate)
		if dd >= startDate && dd <= endDate {
			summary.ExpectedDeposit += r.TotalRate
		}
	}

	// 3. 실제 입금 (CSV transaction_at 기준)
	config.DB.Raw(`
		SELECT COALESCE(SUM(amount), 0) FROM hostex_transactions
		WHERE type = '수입' AND transaction_at >= ? AND transaction_at < ?`,
		startDate, endDate+"T23:59:59",
	).Row().Scan(&summary.ActualIncome)

	// 4. 비용 (cost_allocations 기준, 해당 월 배분)
	// startDate의 YYYY-MM ~ endDate의 YYYY-MM
	startMonth := startDate[:7]
	endMonth := endDate[:7]
	config.DB.Raw(`
		SELECT COALESCE(SUM(allocated_amount), 0) FROM cost_allocations
		WHERE allocated_month >= ? AND allocated_month <= ?`,
		startMonth, endMonth,
	).Row().Scan(&summary.AllocatedCost)

	summary.NetProfit = summary.AccruedRevenue - summary.AllocatedCost

	return summary, nil
}

// --- helpers ---

func normalizeChannel(ch string) string {
	lower := ""
	for _, c := range ch {
		if c >= 'A' && c <= 'Z' {
			lower += string(c + 32)
		} else {
			lower += string(c)
		}
	}
	if contains(lower, "airbnb") {
		return "airbnb"
	}
	if contains(lower, "agoda") {
		return "agoda"
	}
	if contains(lower, "자리톡") || contains(lower, "jaritalk") {
		return "jaritalk"
	}
	if contains(lower, "booking") {
		return "booking"
	}
	if contains(lower, "리브") || contains(lower, "liv") {
		return "liv"
	}
	if contains(lower, "삼삼") || contains(lower, "samsamm") {
		return "samsamm2"
	}
	return "other"
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && findSubstring(s, sub))
}

func findSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func addDays(dateStr string, days int) string {
	if len(dateStr) < 10 {
		return dateStr
	}
	t, err := time.Parse("2006-01-02", dateStr[:10])
	if err != nil {
		return dateStr
	}
	return t.AddDate(0, 0, days).Format("2006-01-02")
}
