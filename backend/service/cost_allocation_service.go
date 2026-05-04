package service

import (
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CostAllocationService struct{}

func NewCostAllocationService() *CostAllocationService {
	return &CostAllocationService{}
}

// AllocateCost cost_raw 1건 → cost_allocations N건 생성 (일할 배분)
func (s *CostAllocationService) AllocateCost(raw *models.CostRaw) error {
	// 기존 배분 삭제 후 재생성
	config.DB.Where("raw_cost_id = ?", raw.ID).Delete(&models.CostAllocation{})

	startDate, err := time.Parse("2006-01-02", raw.CostStartDate)
	if err != nil {
		// 시작/종료일 없으면 결제일 기준 단일 월 배분
		return s.allocateFullMonth(raw)
	}
	endDate, err := time.Parse("2006-01-02", raw.CostEndDate)
	if err != nil {
		return s.allocateFullMonth(raw)
	}

	// 총 일수
	totalDays := int(endDate.Sub(startDate).Hours()/24) + 1
	if totalDays <= 0 {
		return s.allocateFullMonth(raw)
	}

	// 월별 분할
	current := startDate
	for current.Before(endDate) || current.Equal(endDate) {
		// 이번 달의 시작/종료
		monthStart := current
		if monthStart.Before(startDate) {
			monthStart = startDate
		}
		monthEnd := time.Date(current.Year(), current.Month()+1, 0, 0, 0, 0, 0, time.UTC) // 해당 월 마지막일
		if monthEnd.After(endDate) {
			monthEnd = endDate
		}

		// 이번 달 일수
		daysInMonth := int(monthEnd.Sub(monthStart).Hours()/24) + 1
		allocatedAmount := raw.OriginalAmount * int64(daysInMonth) / int64(totalDays)

		allocation := models.CostAllocation{
			RawCostID:          raw.ID,
			PropertyID:         raw.PropertyID,
			AllocatedMonth:     fmt.Sprintf("%04d-%02d", monthStart.Year(), monthStart.Month()),
			AllocatedStartDate: monthStart.Format("2006-01-02"),
			AllocatedEndDate:   monthEnd.Format("2006-01-02"),
			AllocatedAmount:    allocatedAmount,
			AllocationMethod:   models.AllocMethodDailyProrate,
			CostType:           raw.CostType,
		}
		if err := config.DB.Create(&allocation).Error; err != nil {
			return err
		}

		// 다음 달 1일로 이동
		current = time.Date(current.Year(), current.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	}

	return nil
}

// allocateFullMonth 기간 정보 없을 때 결제일 월에 전액 배분
func (s *CostAllocationService) allocateFullMonth(raw *models.CostRaw) error {
	month := ""
	if len(raw.PaymentDate) >= 7 {
		month = raw.PaymentDate[:7]
	} else if len(raw.CostStartDate) >= 7 {
		month = raw.CostStartDate[:7]
	} else {
		month = time.Now().Format("2006-01")
	}

	allocation := models.CostAllocation{
		RawCostID:          raw.ID,
		PropertyID:         raw.PropertyID,
		AllocatedMonth:     month,
		AllocatedStartDate: month + "-01",
		AllocatedEndDate:   month + "-28",
		AllocatedAmount:    raw.OriginalAmount,
		AllocationMethod:   models.AllocMethodFullMonth,
		CostType:           raw.CostType,
	}
	return config.DB.Create(&allocation).Error
}

// AllocateAll 전체 cost_raw에 대해 재배분
func (s *CostAllocationService) AllocateAll() (int, error) {
	var raws []models.CostRaw
	config.DB.Find(&raws)

	count := 0
	for i := range raws {
		if err := s.AllocateCost(&raws[i]); err == nil {
			count++
		}
	}
	return count, nil
}

// ImportFromTransactions 기존 hostex_transactions 비용 데이터를 cost_raw로 마이그레이션
func (s *CostAllocationService) ImportFromTransactions(fileName string) (int, error) {
	type txRow struct {
		ID             uint
		TransactionAt  time.Time
		Type           string
		Category       string
		Amount         int64
		ReservationRef string
		CheckIn        string
		CheckOut       string
		Channel        string
		PropertyName   string
		PropertyID     *uint
		Note           string
	}

	var rows []txRow
	config.DB.Raw(`
		SELECT id, transaction_at, type, category, amount, reservation_ref,
		       check_in, check_out, channel, property_name, property_id, note
		FROM hostex_transactions WHERE type = '비용'
	`).Scan(&rows)

	count := 0
	for i, row := range rows {
		costType := mapCategoryToCostType(row.Category)

		startDate := row.CheckIn
		endDate := row.CheckOut
		if startDate == "" {
			startDate = row.TransactionAt.Format("2006-01-02")
		}
		if endDate == "" {
			endDate = startDate
		}

		raw := models.CostRaw{
			PropertyID:      row.PropertyID,
			PropertyName:    row.PropertyName,
			CostType:        costType,
			OriginalAmount:  row.Amount,
			CostStartDate:   startDate,
			CostEndDate:     endDate,
			PaymentDate:     row.TransactionAt.Format("2006-01-02"),
			ReservationRef:  row.ReservationRef,
			SourceFileName:  fileName,
			SourceRowNumber: i + 1,
			Channel:         row.Channel,
			Memo:            row.Note,
		}

		if err := config.DB.Create(&raw).Error; err != nil {
			continue
		}
		s.AllocateCost(&raw)
		count++
	}
	return count, nil
}

func mapCategoryToCostType(category string) string {
	switch category {
	case models.TxCatCleaning:
		return models.CostTypeCleaning
	case models.TxCatRentOut, models.TxCatRentIn:
		return models.CostTypeRent
	case models.TxCatMgmt:
		return models.CostTypeMgmt
	case models.TxCatMaintenance:
		return models.CostTypeMaintenance
	case models.TxCatSupplies:
		return models.CostTypeSupplies
	case models.TxCatOperation:
		return models.CostTypeOperation
	case models.TxCatLabor:
		return models.CostTypeLabor
	case models.TxCatInterior:
		return models.CostTypeInterior
	case models.TxCatDividend, models.TxCatDividendOnly:
		return models.CostTypeDividend
	case models.TxCatInterest:
		return models.CostTypeInterest
	default:
		return models.CostTypeOther
	}
}
