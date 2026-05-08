package service

import (
	"fmt"
	"log"
	"sync"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/hostex"
	"hiero-workflow/backend/models"
)

type PricingService struct {
	client *hostex.Client
}

func NewPricingService() *PricingService {
	return &PricingService{client: hostex.NewClient()}
}

// DayPricing — 날짜별 가격/제한 정보 (API 응답용)
type DayPricing struct {
	Price             int64 `json:"price"`
	MinStay           int   `json:"min_stay"`
	Available         bool  `json:"available"`
	ClosedOnArrival   bool  `json:"closed_on_arrival"`
	ClosedOnDeparture bool  `json:"closed_on_departure"`
}

// PropertyPricingMap — propertyID → date → DayPricing
type PropertyPricingMap map[uint]map[string]DayPricing

// ================================================================
// 읽기: DB 캐시에서 조회 (빠름)
// ================================================================

// GetPricingForProperties — DB 캐시에서 가격 조회
func (s *PricingService) GetPricingForProperties(startDate, endDate string) (PropertyPricingMap, error) {
	var rows []models.ListingCalendar
	config.DB.Where("date >= ? AND date <= ?", startDate, endDate).Find(&rows)

	result := PropertyPricingMap{}
	for _, r := range rows {
		if result[r.PropertyID] == nil {
			result[r.PropertyID] = map[string]DayPricing{}
		}
		result[r.PropertyID][r.Date] = DayPricing{
			Price:             r.Price,
			MinStay:           r.MinStay,
			Available:         r.Available,
			ClosedOnArrival:   r.ClosedOnArrival,
			ClosedOnDeparture: r.ClosedOnDeparture,
		}
	}
	return result, nil
}

// ================================================================
// 동기화: Hostex → DB 캐시 (서버 시작 시 / 수동 트리거)
// ================================================================

// SyncAllPricing — 전체 숙소 가격 동기화 (Hostex → DB)
func (s *PricingService) SyncAllPricing() (int, error) {
	var platforms []models.PropertyPlatform
	config.DB.Where("platform = ? AND listing_id != ''", models.PlatformAirbnb).Find(&platforms)

	if len(platforms) == 0 {
		return 0, nil
	}

	// 30일 전부터 90일 후까지
	startDate := time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	endDate := time.Now().AddDate(0, 3, 0).Format("2006-01-02")

	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5) // 동시 5개
	totalSynced := 0

	for _, pp := range platforms {
		wg.Add(1)
		go func(pp models.PropertyPlatform) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			calendar, err := s.client.GetListingCalendar(pp.ListingID, "airbnb", startDate, endDate)
			if err != nil {
				log.Printf("[Pricing] 동기화 실패 property %d: %v", pp.PropertyID, err)
				return
			}

			now := time.Now()
			for _, day := range calendar {
				lc := models.ListingCalendar{
					PropertyID:        pp.PropertyID,
					Date:              day.Date,
					Price:             day.Price,
					MinStay:           day.Restrictions.MinStayOnArrival,
					Available:         day.Inventory > 0 && !day.Restrictions.ClosedOnArrival,
					ClosedOnArrival:   day.Restrictions.ClosedOnArrival,
					ClosedOnDeparture: day.Restrictions.ClosedOnDeparture,
					SyncedAt:          now,
				}

				// Upsert: property_id + date 기준
				var existing models.ListingCalendar
				err := config.DB.Where("property_id = ? AND date = ?", pp.PropertyID, day.Date).First(&existing).Error
				if err != nil {
					config.DB.Create(&lc)
				} else {
					config.DB.Model(&existing).Updates(map[string]interface{}{
						"price":               lc.Price,
						"min_stay":             lc.MinStay,
						"available":            lc.Available,
						"closed_on_arrival":    lc.ClosedOnArrival,
						"closed_on_departure":  lc.ClosedOnDeparture,
						"synced_at":            now,
					})
				}
			}

			mu.Lock()
			totalSynced += len(calendar)
			mu.Unlock()
		}(pp)
	}

	wg.Wait()
	log.Printf("[Pricing] 가격 동기화 완료: %d개 숙소, %d일 데이터", len(platforms), totalSynced)
	return totalSynced, nil
}

// ================================================================
// 쓰기: HIERO → Hostex → DB 캐시 업데이트
// ================================================================

// UpdatePrice — 가격 변경 + Hostex 푸시 + DB 캐시 업데이트
func (s *PricingService) UpdatePrice(propertyID uint, startDate, endDate string, price int64, userID *uint, userName string) error {
	pp, err := s.getAirbnbListing(propertyID)
	if err != nil {
		return err
	}

	dates, err := dateRange(startDate, endDate)
	if err != nil {
		return err
	}

	// Hostex에 푸시
	var entries []hostex.PriceUpdateEntry
	for _, d := range dates {
		entries = append(entries, hostex.PriceUpdateEntry{
			ListingID: pp.ListingID, ChannelType: "airbnb", Date: d, Price: price,
		})
	}
	if err := s.client.UpdateListingPrices(entries); err != nil {
		return fmt.Errorf("Hostex 가격 변경 실패: %w", err)
	}

	// DB 캐시 업데이트
	now := time.Now()
	for _, d := range dates {
		config.DB.Model(&models.ListingCalendar{}).
			Where("property_id = ? AND date = ?", propertyID, d).
			Updates(map[string]interface{}{"price": price, "synced_at": now})
	}

	LogActivity(userID, userName, "pricing_price_updated", "property", &propertyID,
		fmt.Sprintf("₩%d → %s~%s", price, startDate, endDate))
	return nil
}

// UpdateMinStay — 최소숙박 변경
func (s *PricingService) UpdateMinStay(propertyID uint, startDate, endDate string, minStay int, userID *uint, userName string) error {
	pp, err := s.getAirbnbListing(propertyID)
	if err != nil {
		return err
	}

	dates, err := dateRange(startDate, endDate)
	if err != nil {
		return err
	}

	var entries []hostex.RestrictionUpdateEntry
	for _, d := range dates {
		ms := minStay
		entries = append(entries, hostex.RestrictionUpdateEntry{
			ListingID: pp.ListingID, ChannelType: "airbnb", Date: d, MinStay: &ms,
		})
	}
	if err := s.client.UpdateListingRestrictions(entries); err != nil {
		return fmt.Errorf("Hostex 최소숙박 변경 실패: %w", err)
	}

	now := time.Now()
	for _, d := range dates {
		config.DB.Model(&models.ListingCalendar{}).
			Where("property_id = ? AND date = ?", propertyID, d).
			Updates(map[string]interface{}{"min_stay": minStay, "synced_at": now})
	}

	LogActivity(userID, userName, "pricing_min_stay_updated", "property", &propertyID,
		fmt.Sprintf("최소 %d박 → %s~%s", minStay, startDate, endDate))
	return nil
}

// BlockDates — 날짜 차단
func (s *PricingService) BlockDates(propertyID uint, startDate, endDate string, userID *uint, userName string) error {
	pp, err := s.getAirbnbListing(propertyID)
	if err != nil {
		return err
	}

	dates, err := dateRange(startDate, endDate)
	if err != nil {
		return err
	}

	closed := true
	var entries []hostex.RestrictionUpdateEntry
	for _, d := range dates {
		entries = append(entries, hostex.RestrictionUpdateEntry{
			ListingID: pp.ListingID, ChannelType: "airbnb", Date: d, ClosedArr: &closed,
		})
	}
	if err := s.client.UpdateListingRestrictions(entries); err != nil {
		return fmt.Errorf("Hostex 차단 실패: %w", err)
	}

	now := time.Now()
	for _, d := range dates {
		config.DB.Model(&models.ListingCalendar{}).
			Where("property_id = ? AND date = ?", propertyID, d).
			Updates(map[string]interface{}{"available": false, "closed_on_arrival": true, "synced_at": now})
	}

	LogActivity(userID, userName, "pricing_blocked", "property", &propertyID,
		fmt.Sprintf("차단: %s~%s", startDate, endDate))
	return nil
}

// UnblockDates — 차단 해제
func (s *PricingService) UnblockDates(propertyID uint, startDate, endDate string, userID *uint, userName string) error {
	pp, err := s.getAirbnbListing(propertyID)
	if err != nil {
		return err
	}

	dates, err := dateRange(startDate, endDate)
	if err != nil {
		return err
	}

	opened := false
	var entries []hostex.RestrictionUpdateEntry
	for _, d := range dates {
		entries = append(entries, hostex.RestrictionUpdateEntry{
			ListingID: pp.ListingID, ChannelType: "airbnb", Date: d, ClosedArr: &opened,
		})
	}
	if err := s.client.UpdateListingRestrictions(entries); err != nil {
		return fmt.Errorf("Hostex 차단 해제 실패: %w", err)
	}

	now := time.Now()
	for _, d := range dates {
		config.DB.Model(&models.ListingCalendar{}).
			Where("property_id = ? AND date = ?", propertyID, d).
			Updates(map[string]interface{}{"available": true, "closed_on_arrival": false, "synced_at": now})
	}

	LogActivity(userID, userName, "pricing_unblocked", "property", &propertyID,
		fmt.Sprintf("해제: %s~%s", startDate, endDate))
	return nil
}

// --- helpers ---

func (s *PricingService) getAirbnbListing(propertyID uint) (*models.PropertyPlatform, error) {
	var pp models.PropertyPlatform
	err := config.DB.Where("property_id = ? AND platform = ? AND listing_id != ''",
		propertyID, models.PlatformAirbnb).First(&pp).Error
	if err != nil {
		return nil, fmt.Errorf("Airbnb listing 없음 (property %d)", propertyID)
	}
	return &pp, nil
}

func dateRange(start, end string) ([]string, error) {
	s, err := time.Parse("2006-01-02", start)
	if err != nil {
		return nil, err
	}
	e, err := time.Parse("2006-01-02", end)
	if err != nil {
		return nil, err
	}
	var dates []string
	for d := s; !d.After(e); d = d.AddDate(0, 0, 1) {
		dates = append(dates, d.Format("2006-01-02"))
	}
	return dates, nil
}
