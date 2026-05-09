package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"unicode/utf8"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type TransactionService struct{}

func NewTransactionService() *TransactionService {
	return &TransactionService{}
}

// ImportCSV CSV 파일을 파싱하여 hostex_transactions에 저장
func (s *TransactionService) ImportCSV(reader io.Reader) (int, int, error) {
	// BOM 제거
	bomReader := newBOMReader(reader)
	csvReader := csv.NewReader(bomReader)
	csvReader.LazyQuotes = true
	csvReader.FieldsPerRecord = -1 // 가변 필드 허용

	// 헤더 읽기
	header, err := csvReader.Read()
	if err != nil {
		return 0, 0, fmt.Errorf("헤더 읽기 실패: %w", err)
	}
	colMap := map[string]int{}
	for i, h := range header {
		colMap[strings.TrimSpace(h)] = i
	}

	// 숙소명 → property_id 매핑 캐시
	propCache := s.buildPropertyCache()

	// 모든 행 파싱
	var parsed []models.HostexTransaction
	skipped := 0
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			skipped++
			continue
		}
		tx, ok := s.parseRow(record, colMap, propCache)
		if !ok {
			skipped++
			continue
		}
		MapAccountingFields(&tx)
		parsed = append(parsed, tx)
	}

	// 배치 삽입 (100건씩)
	imported := 0
	batchSize := 100
	for i := 0; i < len(parsed); i += batchSize {
		end := i + batchSize
		if end > len(parsed) {
			end = len(parsed)
		}
		batch := parsed[i:end]
		result := config.DB.Create(&batch)
		if result.Error == nil {
			imported += int(result.RowsAffected)
		}
	}

	log.Printf("[transaction] CSV 임포트: %d건 저장, %d건 스킵", imported, skipped)
	return imported, skipped, nil
}

// Summary 숙소별 월간 집계
type MonthlySummary struct {
	PropertyID   uint   `json:"property_id"`
	PropertyName string `json:"property_name"`
	YearMonth    string `json:"year_month"`
	// 매출
	Revenue          int64  `json:"revenue"`             // 총 객실 요금 (합산)
	ShortTermRevenue int64  `json:"short_term_revenue"`  // 단기임대 과세 (Airbnb, Booking, Agoda) — VAT 10%
	MidTermTaxable   int64  `json:"mid_term_taxable"`    // 중기임대 과세 (삼삼엠투 등, 29일 미만) — VAT 10%
	MidTermExempt    int64  `json:"mid_term_exempt"`     // 중기임대 면세 (삼삼엠투 등, 29일 이상)
	ServiceRevenue   int64  `json:"service_revenue"`     // 과세 서비스매출 (향후 사용)
	OtherRevenue     int64  `json:"other_revenue"`       // 기타 수입 (배당및월세, 기타 등)
	Refund         int64  `json:"refund"`            // 환불
	Commission     int64  `json:"commission"`        // 플랫폼 수수료 (reservations.total_commission)
	AirbnbVat      int64  `json:"airbnb_vat"`        // 에어비앤비 부가세 10%
	NetRevenue     int64  `json:"net_revenue"`       // 순매출 (Revenue + OtherRevenue - Refund - Commission - AirbnbVat)
	// 비용
	CleaningFee  int64  `json:"cleaning_fee"`    // 청소 비용
	MgmtFee      int64  `json:"mgmt_fee"`        // 관리비
	RentOut      int64  `json:"rent_out"`         // 월세 지출
	RentIn       int64  `json:"rent_in"`          // 임대 수입 (비용 항목이지만 마이너스 비용)
	OperationFee int64  `json:"operation_fee"`    // 운영비
	LaborFee     int64  `json:"labor_fee"`        // 노동비
	SuppliesFee  int64  `json:"supplies_fee"`     // 소모품
	Maintenance  int64  `json:"maintenance"`      // 유지보수
	InteriorFee  int64  `json:"interior_fee"`     // 인테리어
	InterestFee  int64  `json:"interest_fee"`     // 임대이자
	DividendFee  int64  `json:"dividend_fee"`     // 배당
	PropertyFee  int64  `json:"property_fee"`     // 재산 요금
	OtherCost    int64  `json:"other_cost"`       // 기타 비용
	TotalCost    int64  `json:"total_cost"`       // 총 비용
	Profit       int64  `json:"profit"`           // 순이익
	ProfitRate   float64 `json:"profit_rate"`     // 이익률
}

func (s *TransactionService) GetMonthlySummary(yearMonth string) ([]MonthlySummary, error) {
	type row struct {
		PropertyID   *uint
		PropertyName string
		Category     string
		Type         string
		Channel      string
		RevenueClass string
		Total        int64
	}
	var rows []row
	query := config.DB.Model(&models.HostexTransaction{}).
		Select(`property_id, property_name, category, type, channel,
			CASE
				WHEN type = '수입' AND category = '객실 요금' AND LOWER(channel) IN ('airbnb','에어비앤비','booking.com','booking','agoda') THEN 'short_term'
				WHEN type = '수입' AND category = '객실 요금' AND DATEDIFF(check_out, check_in) < 29 THEN 'mid_term_taxable'
				WHEN type = '수입' AND category = '객실 요금' THEN 'mid_term_exempt'
				ELSE ''
			END as revenue_class,
			SUM(amount) as total`).
		Group("property_id, property_name, category, type, channel, revenue_class")

	if yearMonth != "" {
		query = query.Where("`year_month` = ?", yearMonth)
	}
	query.Scan(&rows)

	// 숙소별 집계
	type key struct {
		pid  uint
		name string
	}
	summaryMap := map[key]*MonthlySummary{}

	for _, r := range rows {
		pid := uint(0)
		if r.PropertyID != nil {
			pid = *r.PropertyID
		}
		k := key{pid, r.PropertyName}
		sm, ok := summaryMap[k]
		if !ok {
			sm = &MonthlySummary{
				PropertyID:   pid,
				PropertyName: r.PropertyName,
				YearMonth:    yearMonth,
			}
			summaryMap[k] = sm
		}

		mapCategoryToSummary(sm, r.Type, r.Category, r.RevenueClass, r.Total)
	}

	results := make([]MonthlySummary, 0, len(summaryMap))
	for _, sm := range summaryMap {
		calcSummaryTotals(sm)
		sm.Profit = sm.NetRevenue - sm.TotalCost
		if sm.NetRevenue > 0 {
			sm.ProfitRate = float64(sm.Profit) / float64(sm.NetRevenue) * 100
		}
		results = append(results, *sm)
	}

	return results, nil
}

// SettlementQuery — 기간 기반 정산 조회
type SettlementQuery struct {
	StartDate   string `form:"start_date"`   // 2026-04-01
	EndDate     string `form:"end_date"`     // 2026-04-30
	PropertyID  uint   `form:"property_id"`  // 특정 숙소만 (단일)
	PropertyIDs string `form:"property_ids"` // 콤마 구분 다중 숙소
	Channel     string `form:"channel"`      // 특정 채널만 (단일)
	Channels    string `form:"channels"`     // 콤마 구분 다중 채널
}

// SettlementResult — 정산 결과
type SettlementResult struct {
	StartDate  string           `json:"start_date"`
	EndDate    string           `json:"end_date"`
	Properties []MonthlySummary `json:"properties"`
	Total      MonthlySummary   `json:"total"`
}

// GetSettlement — 기간 기반 정산 (숙소별 수입/비용/이익)
func (s *TransactionService) GetSettlement(query SettlementQuery) (*SettlementResult, error) {
	if query.StartDate == "" || query.EndDate == "" {
		// 기본값: 이번 달
		now := time.Now()
		query.StartDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
		query.EndDate = now.Format("2006-01-02")
	}

	type row struct {
		PropertyID   *uint
		PropertyName string
		Category     string
		Type         string
		Channel      string
		RevenueClass string
		Total        int64
	}
	var rows []row
	db := config.DB.Model(&models.HostexTransaction{}).
		Select(`property_id, property_name, category, type, channel,
			CASE
				WHEN type = '수입' AND category = '객실 요금' AND LOWER(channel) IN ('airbnb','에어비앤비','booking.com','booking','agoda') THEN 'short_term'
				WHEN type = '수입' AND category = '객실 요금' AND DATEDIFF(check_out, check_in) < 29 THEN 'mid_term_taxable'
				WHEN type = '수입' AND category = '객실 요금' THEN 'mid_term_exempt'
				ELSE ''
			END as revenue_class,
			SUM(amount) as total`).
		Where("transaction_at >= ? AND transaction_at <= ?", query.StartDate, query.EndDate+" 23:59:59")
	if query.PropertyIDs != "" {
		ids := strings.Split(query.PropertyIDs, ",")
		db = db.Where("property_id IN ?", ids)
	} else if query.PropertyID > 0 {
		db = db.Where("property_id = ?", query.PropertyID)
	}
	if query.Channels != "" {
		chs := strings.Split(query.Channels, ",")
		db = db.Where("channel IN ?", chs)
	} else if query.Channel != "" {
		db = db.Where("channel = ?", query.Channel)
	}
	db.Group("property_id, property_name, category, type, channel, revenue_class").
		Scan(&rows)

	// 숙소별 집계
	type key struct {
		pid  uint
		name string
	}
	summaryMap := map[key]*MonthlySummary{}

	for _, r := range rows {
		pid := uint(0)
		if r.PropertyID != nil {
			pid = *r.PropertyID
		}
		k := key{pid, r.PropertyName}
		sm, ok := summaryMap[k]
		if !ok {
			sm = &MonthlySummary{
				PropertyID:   pid,
				PropertyName: r.PropertyName,
				YearMonth:    query.StartDate + "~" + query.EndDate,
			}
			summaryMap[k] = sm
		}

		mapCategoryToSummary(sm, r.Type, r.Category, r.RevenueClass, r.Total)
	}

	// reservations에서 숙소별 수수료 + 에어비앤비 매출 조회
	type commRow struct {
		PropertyID      uint
		TotalCommission int64
		AirbnbRevenue   int64
	}
	var commRows []commRow
	commDB := config.DB.Model(&models.Reservation{}).
		Select(`property_id,
			SUM(total_commission) as total_commission,
			SUM(CASE WHEN channel_name IN ('Airbnb','에어비앤비') THEN total_rate ELSE 0 END) as airbnb_revenue`).
		Where("status = 'accepted' AND booked_at >= ? AND booked_at <= ?", query.StartDate, query.EndDate+" 23:59:59")
	if query.PropertyIDs != "" {
		ids := strings.Split(query.PropertyIDs, ",")
		commDB = commDB.Where("property_id IN ?", ids)
	} else if query.PropertyID > 0 {
		commDB = commDB.Where("property_id = ?", query.PropertyID)
	}
	commDB.Group("property_id").Scan(&commRows)

	// 수수료/부가세를 summaryMap에 반영
	for _, cr := range commRows {
		for k, sm := range summaryMap {
			if sm.PropertyID == uint(cr.PropertyID) {
				sm.Commission = cr.TotalCommission
				sm.AirbnbVat = int64(float64(cr.AirbnbRevenue) * 0.1)
				summaryMap[k] = sm
				break
			}
		}
	}

	// 결과 + 합계
	var total MonthlySummary
	total.YearMonth = query.StartDate + "~" + query.EndDate
	results := make([]MonthlySummary, 0, len(summaryMap))

	for _, sm := range summaryMap {
		calcSummaryTotals(sm)
		results = append(results, *sm)
		addToTotal(&total, sm)
	}
	if total.NetRevenue > 0 {
		total.ProfitRate = float64(total.Profit) / float64(total.NetRevenue) * 100
	}

	return &SettlementResult{
		StartDate:  query.StartDate,
		EndDate:    query.EndDate,
		Properties: results,
		Total:      total,
	}, nil
}

// ─── 카테고리 매핑 헬퍼 ──────────────────────────────────────

// mapCategoryToSummary 수입/비용 카테고리를 MonthlySummary 필드에 매핑
func mapCategoryToSummary(sm *MonthlySummary, txType, category, revenueClass string, amount int64) {
	if txType == models.TxTypeIncome {
		switch category {
		case models.TxCatRoomRate:
			sm.Revenue += amount
			switch revenueClass {
			case "short_term":
				sm.ShortTermRevenue += amount
			case "mid_term_taxable":
				sm.MidTermTaxable += amount
			case "mid_term_exempt":
				sm.MidTermExempt += amount
			}
		case models.TxCatRoomRefund:
			sm.Refund += amount
		default:
			sm.OtherRevenue += amount
		}
	} else {
		switch category {
		case models.TxCatCleaning:
			sm.CleaningFee += amount
		case models.TxCatMgmt:
			sm.MgmtFee += amount
		case models.TxCatRentOut:
			sm.RentOut += amount
		case models.TxCatRentIn:
			sm.RentIn += amount
		case models.TxCatOperation:
			sm.OperationFee += amount
		case models.TxCatLabor:
			sm.LaborFee += amount
		case models.TxCatSupplies:
			sm.SuppliesFee += amount
		case models.TxCatMaintenance:
			sm.Maintenance += amount
		case models.TxCatInterior:
			sm.InteriorFee += amount
		case models.TxCatInterest:
			sm.InterestFee += amount
		case models.TxCatDividend, models.TxCatDividendOnly:
			sm.DividendFee += amount
		case models.TxCatPropertyFee:
			sm.PropertyFee += amount
		default:
			sm.OtherCost += amount
		}
	}
}

// calcSummaryTotals 순매출/총비용/이익 계산
func calcSummaryTotals(sm *MonthlySummary) {
	sm.NetRevenue = sm.Revenue + sm.OtherRevenue - sm.Refund - sm.Commission - sm.AirbnbVat
	sm.TotalCost = sm.CleaningFee + sm.MgmtFee + sm.RentOut + sm.RentIn +
		sm.OperationFee + sm.LaborFee + sm.SuppliesFee + sm.Maintenance +
		sm.InteriorFee + sm.InterestFee + sm.DividendFee + sm.PropertyFee + sm.OtherCost
	sm.Profit = sm.NetRevenue - sm.TotalCost
	if sm.NetRevenue > 0 {
		sm.ProfitRate = float64(sm.Profit) / float64(sm.NetRevenue) * 100
	}
}

// addToTotal 합계 누적
func addToTotal(total *MonthlySummary, sm *MonthlySummary) {
	total.Revenue += sm.Revenue
	total.ShortTermRevenue += sm.ShortTermRevenue
	total.MidTermTaxable += sm.MidTermTaxable
	total.MidTermExempt += sm.MidTermExempt
	total.ServiceRevenue += sm.ServiceRevenue
	total.OtherRevenue += sm.OtherRevenue
	total.Refund += sm.Refund
	total.Commission += sm.Commission
	total.AirbnbVat += sm.AirbnbVat
	total.NetRevenue += sm.NetRevenue
	total.CleaningFee += sm.CleaningFee
	total.MgmtFee += sm.MgmtFee
	total.RentOut += sm.RentOut
	total.RentIn += sm.RentIn
	total.OperationFee += sm.OperationFee
	total.LaborFee += sm.LaborFee
	total.SuppliesFee += sm.SuppliesFee
	total.Maintenance += sm.Maintenance
	total.InteriorFee += sm.InteriorFee
	total.InterestFee += sm.InterestFee
	total.DividendFee += sm.DividendFee
	total.PropertyFee += sm.PropertyFee
	total.OtherCost += sm.OtherCost
	total.TotalCost += sm.TotalCost
	total.Profit += sm.Profit
}

// ─── 개별 거래 조회 (셀 드릴다운) ─────────────────────────────

// ListTransactions 숙소 + 기간 + 카테고리 조건으로 개별 거래 목록 반환
func (s *TransactionService) ListTransactions(propertyID uint, startDate, endDate, category, txType string) ([]models.HostexTransaction, error) {
	var txs []models.HostexTransaction
	db := config.DB.Where("transaction_at >= ? AND transaction_at <= ?", startDate, endDate+" 23:59:59")
	if propertyID > 0 {
		db = db.Where("property_id = ?", propertyID)
	}
	if category != "" {
		db = db.Where("category = ?", category)
	}
	if txType != "" {
		db = db.Where("type = ?", txType)
	}
	err := db.Order("transaction_at DESC").Find(&txs).Error
	return txs, err
}

// UpdateTransactionCategory 거래 카테고리 변경
func (s *TransactionService) UpdateTransactionCategory(id uint, newCategory string) error {
	var tx models.HostexTransaction
	if err := config.DB.First(&tx, id).Error; err != nil {
		return err
	}
	tx.Category = newCategory
	MapAccountingFields(&tx)
	return config.DB.Save(&tx).Error
}

// AllCategories 사용 가능한 모든 카테고리 목록
func (s *TransactionService) AllCategories() []string {
	return []string{
		models.TxCatRoomRate, models.TxCatRoomRefund,
		models.TxCatCleaning, models.TxCatMgmt,
		models.TxCatRentOut, models.TxCatRentIn,
		models.TxCatOperation, models.TxCatLabor,
		models.TxCatSupplies, models.TxCatMaintenance,
		models.TxCatInterior, models.TxCatPropertyFee,
		models.TxCatDividend, models.TxCatDividendOnly, models.TxCatInterest,
	}
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────

func (s *TransactionService) buildPropertyCache() map[string]uint {
	var properties []models.Property
	config.DB.Select("id, name").Find(&properties)
	cache := map[string]uint{}
	for _, p := range properties {
		cache[p.Name] = p.ID
	}
	return cache
}

func (s *TransactionService) parseRow(record []string, colMap map[string]int, propCache map[string]uint) (models.HostexTransaction, bool) {
	get := func(col string) string {
		if idx, ok := colMap[col]; ok && idx < len(record) {
			return strings.TrimSpace(record[idx])
		}
		return ""
	}

	dateStr := get("날짜")
	txType := get("유형")
	category := get("항목")
	amountStr := get("금액")

	if dateStr == "" || txType == "" || amountStr == "" {
		return models.HostexTransaction{}, false
	}

	// 수입/비용만 처리
	if txType != "수입" && txType != "비용" {
		return models.HostexTransaction{}, false
	}

	// 날짜 파싱
	txTime, err := time.Parse("2006-01-02 15:04:05", dateStr)
	if err != nil {
		txTime, err = time.Parse("2006-01-02 15:04", dateStr)
		if err != nil {
			return models.HostexTransaction{}, false
		}
	}

	// 금액 파싱
	amountStr = strings.ReplaceAll(amountStr, ",", "")
	amountStr = strings.ReplaceAll(amountStr, "\"", "")
	amount, err := strconv.ParseInt(amountStr, 10, 64)
	if err != nil {
		return models.HostexTransaction{}, false
	}

	propName := get("관련 숙박 시설")
	var propID *uint
	if pid, ok := propCache[propName]; ok {
		propID = &pid
	}

	yearMonth := txTime.Format("2006-01")

	return models.HostexTransaction{
		TransactionAt:  txTime,
		Type:           txType,
		Category:       category,
		Amount:         amount,
		PaymentMethod:  get("결제 방법"),
		ReservationRef: get("관련 예약"),
		CheckIn:        get("체크인"),
		CheckOut:       get("체크아웃"),
		GuestName:      get("게스트"),
		Channel:        get("채널"),
		PropertyName:   propName,
		PropertyID:     propID,
		Operator:       get("운영자"),
		Note:           get("비고"),
		YearMonth:      yearMonth,
	}, true
}

// BOM 제거용 Reader
type bomReader struct {
	r       io.Reader
	checked bool
}

func newBOMReader(r io.Reader) io.Reader {
	return &bomReader{r: r}
}

func (b *bomReader) Read(p []byte) (int, error) {
	n, err := b.r.Read(p)
	if !b.checked && n >= 3 {
		b.checked = true
		if p[0] == 0xEF && p[1] == 0xBB && p[2] == 0xBF {
			copy(p, p[3:n])
			n -= 3
		}
	}
	// UTF-8 유효성 체크는 건너뜀
	_ = utf8.Valid(p[:n])
	return n, err
}

// ─── 계정과목 자동 매핑 ─────────────────────────────────────

// OTA 채널 (과세 숙박매출)
var otaChannels = map[string]bool{
	"Airbnb": true, "에어비앤비": true,
	"Agoda": true, "Booking.com": true,
}

// 장기 전대 채널 (면세 검토)
var exemptChannels = map[string]bool{
	"삼삼엠투": true, "리브": true, "자리톡": true,
	"Houfy": true,
}

// 미분류 채널
var reviewChannels = map[string]bool{
	"오류검토": true, "알 수 없음": true, "미납": true,
}

// MapAccountingFields 거래의 category/type/channel을 기반으로 계정코드/계정명/세무분류 자동 매핑
func MapAccountingFields(tx *models.HostexTransaction) {
	if tx.Type == models.TxTypeIncome {
		mapIncomeAccounting(tx)
	} else {
		mapExpenseAccounting(tx)
	}
}

func mapIncomeAccounting(tx *models.HostexTransaction) {
	switch tx.Category {
	case models.TxCatRoomRate:
		ch := tx.Channel
		if otaChannels[ch] {
			tx.AccountCode = "4201"
			tx.AccountName = "숙박공유매출"
			tx.TaxCategory = "VAT_TAXABLE_LODGING"
		} else if exemptChannels[ch] || strings.HasPrefix(ch, "개인") {
			tx.AccountCode = "4101"
			tx.AccountName = "주거전대임대료수입"
			tx.TaxCategory = "VAT_EXEMPT_RENT"
		} else if reviewChannels[ch] {
			tx.AccountCode = "9999"
			tx.AccountName = "미분류매출"
			tx.TaxCategory = "REVIEW_NEEDED"
		} else {
			// 알 수 없는 채널 → 검토 필요
			tx.AccountCode = "9999"
			tx.AccountName = "미분류매출"
			tx.TaxCategory = "REVIEW_NEEDED"
		}
	case models.TxCatRoomRefund:
		tx.AccountCode = "5114"
		tx.AccountName = "고객보상비"
		tx.TaxCategory = "VAT_TAXABLE_LODGING"
	case "기타":
		tx.AccountCode = "4901"
		tx.AccountName = "기타수입"
		tx.TaxCategory = "OTHER"
	case models.TxCatDividend:
		tx.AccountCode = "4901"
		tx.AccountName = "기타수입"
		tx.TaxCategory = "OTHER"
	default:
		tx.AccountCode = "9999"
		tx.AccountName = "미분류매출"
		tx.TaxCategory = "REVIEW_NEEDED"
	}
}

func mapExpenseAccounting(tx *models.HostexTransaction) {
	switch tx.Category {
	case models.TxCatRentOut, models.TxCatRentIn, models.TxCatInterest:
		tx.AccountCode = "5101"
		tx.AccountName = "원임차료"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatMgmt:
		tx.AccountCode = "5102"
		tx.AccountName = "원관리비"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatCleaning:
		tx.AccountCode = "5106"
		tx.AccountName = "청소용역비"
		tx.TaxCategory = "VAT_TAXABLE_SERVICE"
	case models.TxCatSupplies:
		tx.AccountCode = "5108"
		tx.AccountName = "소모품비"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatMaintenance:
		tx.AccountCode = "5109"
		tx.AccountName = "수선비"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatInterior, "프로모션 비용":
		tx.AccountCode = "5112"
		tx.AccountName = "비품비/시설장치"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatRoomRefund:
		tx.AccountCode = "5114"
		tx.AccountName = "고객보상비"
		tx.TaxCategory = "VAT_TAXABLE_LODGING"
	case models.TxCatPropertyFee:
		tx.AccountCode = "6107"
		tx.AccountName = "세금과공과"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatLabor, models.TxCatOperation, "부동산수수료":
		tx.AccountCode = "6109"
		tx.AccountName = "지급수수료"
		tx.TaxCategory = "COMMON_COST"
	case models.TxCatDividend, models.TxCatDividendOnly:
		tx.AccountCode = "9000"
		tx.AccountName = "이익처분(배당)"
		tx.TaxCategory = "NON_PL"
	case "기타":
		tx.AccountCode = "9999"
		tx.AccountName = "미분류비용"
		tx.TaxCategory = "REVIEW_NEEDED"
	default:
		tx.AccountCode = "9999"
		tx.AccountName = "미분류비용"
		tx.TaxCategory = "REVIEW_NEEDED"
	}
}

// BackfillAccountingFields 기존 데이터에 계정코드/세무분류 일괄 매핑
func (s *TransactionService) BackfillAccountingFields() (int64, error) {
	var total int64
	var txs []models.HostexTransaction

	result := config.DB.Where("account_code IS NULL OR account_code = ''").FindInBatches(&txs, 500, func(tx2 *gorm.DB, batch int) error {
		for i := range txs {
			MapAccountingFields(&txs[i])
		}
		tx2.Save(&txs)
		total += int64(len(txs))
		log.Printf("[backfill] batch %d: %d건 매핑 완료 (누적 %d)", batch, len(txs), total)
		return nil
	})

	if result.Error != nil {
		return total, result.Error
	}
	return total, nil
}
