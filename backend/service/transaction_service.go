package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"time"
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
	Revenue      int64  `json:"revenue"`       // 객실 요금
	Refund       int64  `json:"refund"`        // 환불
	NetRevenue   int64  `json:"net_revenue"`   // 순매출
	CleaningFee  int64  `json:"cleaning_fee"`  // 청소 비용
	MgmtFee      int64  `json:"mgmt_fee"`      // 관리비
	RentOut      int64  `json:"rent_out"`       // 월세
	OperationFee int64  `json:"operation_fee"`  // 운영비
	LaborFee     int64  `json:"labor_fee"`      // 노동비
	SuppliesFee  int64  `json:"supplies_fee"`   // 소모품
	Maintenance  int64  `json:"maintenance"`    // 유지보수
	OtherCost    int64  `json:"other_cost"`     // 기타 비용
	TotalCost    int64  `json:"total_cost"`     // 총 비용
	Profit       int64  `json:"profit"`         // 순이익
	ProfitRate   float64 `json:"profit_rate"`   // 이익률
}

func (s *TransactionService) GetMonthlySummary(yearMonth string) ([]MonthlySummary, error) {
	type row struct {
		PropertyID   *uint
		PropertyName string
		Category     string
		Type         string
		Total        int64
	}
	var rows []row
	query := config.DB.Model(&models.HostexTransaction{}).
		Select("property_id, property_name, category, type, SUM(amount) as total").
		Group("property_id, property_name, category, type")

	if yearMonth != "" {
		query = query.Where("year_month = ?", yearMonth)
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

		if r.Type == models.TxTypeIncome {
			switch r.Category {
			case models.TxCatRoomRate:
				sm.Revenue += r.Total
			case models.TxCatRoomRefund:
				sm.Refund += r.Total
			}
		} else {
			switch r.Category {
			case models.TxCatCleaning:
				sm.CleaningFee += r.Total
			case models.TxCatMgmt:
				sm.MgmtFee += r.Total
			case models.TxCatRentOut:
				sm.RentOut += r.Total
			case models.TxCatOperation:
				sm.OperationFee += r.Total
			case models.TxCatLabor:
				sm.LaborFee += r.Total
			case models.TxCatSupplies:
				sm.SuppliesFee += r.Total
			case models.TxCatMaintenance:
				sm.Maintenance += r.Total
			default:
				sm.OtherCost += r.Total
			}
		}
	}

	results := make([]MonthlySummary, 0, len(summaryMap))
	for _, sm := range summaryMap {
		sm.NetRevenue = sm.Revenue - sm.Refund
		sm.TotalCost = sm.CleaningFee + sm.MgmtFee + sm.RentOut + sm.OperationFee + sm.LaborFee + sm.SuppliesFee + sm.Maintenance + sm.OtherCost
		sm.Profit = sm.NetRevenue - sm.TotalCost
		if sm.NetRevenue > 0 {
			sm.ProfitRate = float64(sm.Profit) / float64(sm.NetRevenue) * 100
		}
		results = append(results, *sm)
	}

	return results, nil
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
