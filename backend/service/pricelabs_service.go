package service

import (
	"log"
	"strconv"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/pricelabs"
)

func toFloat64Any(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int64:
		return float64(n)
	case int:
		return float64(n)
	case string:
		if f, err := strconv.ParseFloat(n, 64); err == nil {
			return f
		}
		return 0
	default:
		return 0
	}
}

func toInt64Any(v interface{}) int64 {
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	case string:
		if i, err := strconv.ParseInt(n, 10, 64); err == nil {
			return i
		}
		return 0
	default:
		return 0
	}
}

type PriceLabsService struct {
	client *pricelabs.Client
}

func NewPriceLabsService() *PriceLabsService {
	return &PriceLabsService{client: pricelabs.NewClient()}
}

// SyncAll — PriceLabs 전체 동기화 (listings + prices)
func (s *PriceLabsService) SyncAll() error {
	log.Println("[PriceLabs] 전체 동기화 시작...")

	// 1. 리스팅 동기화
	count, err := s.SyncListings()
	if err != nil {
		log.Printf("[PriceLabs] 리스팅 동기화 실패: %v", err)
		return err
	}
	log.Printf("[PriceLabs] 리스팅 동기화 완료: %d개", count)

	// 2. 가격 동기화 (5개씩 배치)
	priceCount, err := s.SyncPrices()
	if err != nil {
		log.Printf("[PriceLabs] 가격 동기화 실패: %v", err)
		return err
	}
	log.Printf("[PriceLabs] 가격 동기화 완료: %d건", priceCount)

	return nil
}

// SyncListings — PriceLabs 리스팅 → DB 매핑 + KPI 저장
func (s *PriceLabsService) SyncListings() (int, error) {
	listings, err := s.client.GetListings()
	if err != nil {
		return 0, err
	}

	// 내부 Property를 hostex_id로 매핑
	var properties []models.Property
	config.DB.Where("hostex_id > 0").Find(&properties)
	hostexToInternal := map[int64]uint{}
	for _, p := range properties {
		hostexToInternal[p.HostexID] = p.ID
	}

	count := 0
	now := time.Now()
	for _, l := range listings {
		// PriceLabs ID에서 hostex_id 추출: "18848_12142094_house" → 12142094
		hostexID := extractHostexID(l.ID)
		if hostexID == 0 {
			continue
		}

		propID := hostexToInternal[hostexID]

		pl := models.PriceLabsListing{
			PropertyID:            propID,
			HostexID:              hostexID,
			PriceLabsID:           l.ID,
			PMS:                   l.PMS,
			Currency:              "KRW",
			MinPrice:              toInt64Any(l.Min),
			BasePrice:             toInt64Any(l.Base),
			RecommendedBase:       toInt64Any(l.RecommendedBasePrice),
			OccupancyNext7:        l.OccupancyNext7,
			OccupancyNext30:       l.OccupancyNext30,
			OccupancyNext60:       l.OccupancyNext60,
			MarketOccupancyNext7:  l.MarketOccupancyNext7,
			MarketOccupancyNext30: l.MarketOccupancyNext30,
			MarketOccupancyNext60: l.MarketOccupancyNext60,
			ADRPast90:             toInt64Any(l.ADRPast90),
			ADRPast90STLY:         toInt64Any(l.ADRPast90STLY),
			BookingPickup30:       int(toInt64Any(l.BookingPickup30)),
			MPINext7:              toFloat64Any(l.MPINext7),
			SyncedAt:              now,
		}

		var existing models.PriceLabsListing
		err := config.DB.Where("pricelabs_id = ?", l.ID).First(&existing).Error
		if err != nil {
			config.DB.Create(&pl)
		} else {
			pl.ID = existing.ID
			pl.CreatedAt = existing.CreatedAt
			config.DB.Save(&pl)
		}
		count++
	}

	return count, nil
}

// SyncPrices — PriceLabs 일별 가격 → DB 캐시 (5개씩 배치)
func (s *PriceLabsService) SyncPrices() (int, error) {
	var plListings []models.PriceLabsListing
	config.DB.Where("property_id > 0").Find(&plListings)

	if len(plListings) == 0 {
		return 0, nil
	}

	total := 0
	batchSize := 5

	for i := 0; i < len(plListings); i += batchSize {
		end := i + batchSize
		if end > len(plListings) {
			end = len(plListings)
		}
		batch := plListings[i:end]

		// API 요청 구성
		var reqListings []struct {
			ID  string `json:"id"`
			PMS string `json:"pms"`
		}
		idToProperty := map[string]uint{}

		for _, pl := range batch {
			reqListings = append(reqListings, struct {
				ID  string `json:"id"`
				PMS string `json:"pms"`
			}{ID: pl.PriceLabsID, PMS: pl.PMS})
			idToProperty[pl.PriceLabsID] = pl.PropertyID
		}

		responses, err := s.client.GetListingPrices(reqListings)
		if err != nil {
			log.Printf("[PriceLabs] 가격 배치 실패 (%d~%d): %v", i, end, err)
			continue
		}

		now := time.Now()
		for _, resp := range responses {
			propID := idToProperty[resp.ID]
			if propID == 0 {
				continue
			}

			for _, day := range resp.Data {
				pp := models.PriceLabsPrice{
					PropertyID:        propID,
					Date:              day.Date,
					Price:             day.Price,
					UncustomizedPrice: day.UncustomizedPrice,
					UserPrice:         day.UserPrice,
					MinStay:           day.MinStay,
					BookingStatus:     day.BookingStatus,
					BookingStatusSTLY: day.BookingStatusSTLY,
					ADR:               int64(day.ADR),
					ADRSTLY:           int64(day.ADRSTLY),
					BookedDate:        day.BookedDate,
					DemandColor:       day.DemandColor,
					DemandDesc:        day.DemandDesc,
					WeeklyDiscount:    day.WeeklyDiscount,
					MonthlyDiscount:   day.MonthlyDiscount,
					SyncedAt:          now,
				}

				var existing models.PriceLabsPrice
				err := config.DB.Where("property_id = ? AND date = ?", propID, day.Date).First(&existing).Error
				if err != nil {
					config.DB.Create(&pp)
				} else {
					pp.ID = existing.ID
					config.DB.Save(&pp)
				}
				total++
			}
		}

		log.Printf("[PriceLabs] 가격 배치 %d~%d 완료 (%d건)", i, end, total)
	}

	return total, nil
}

// GetPriceComparison — 날짜 범위의 Hostex vs PriceLabs 가격 비교 데이터
func (s *PriceLabsService) GetPriceComparison(startDate, endDate string) (map[uint]map[string]PriceCompareDay, error) {
	var plPrices []models.PriceLabsPrice
	config.DB.Where("date >= ? AND date <= ?", startDate, endDate).Find(&plPrices)

	var hostexPrices []models.ListingCalendar
	config.DB.Where("date >= ? AND date <= ?", startDate, endDate).Find(&hostexPrices)

	// Hostex 가격 맵
	hostexMap := map[uint]map[string]models.ListingCalendar{}
	for _, h := range hostexPrices {
		if hostexMap[h.PropertyID] == nil {
			hostexMap[h.PropertyID] = map[string]models.ListingCalendar{}
		}
		hostexMap[h.PropertyID][h.Date] = h
	}

	// 비교 데이터 생성
	result := map[uint]map[string]PriceCompareDay{}
	for _, pl := range plPrices {
		if result[pl.PropertyID] == nil {
			result[pl.PropertyID] = map[string]PriceCompareDay{}
		}

		hostex := hostexMap[pl.PropertyID][pl.Date]

		var diffPct float64
		if pl.Price > 0 {
			diffPct = float64(hostex.Price-pl.Price) / float64(pl.Price) * 100
		}

		result[pl.PropertyID][pl.Date] = PriceCompareDay{
			HostexPrice:       hostex.Price,
			PriceLabsPrice:    pl.Price,
			AIRecommended:     pl.UncustomizedPrice,
			DiffPercent:        diffPct,
			MinStay:           pl.MinStay,
			BookingStatus:     pl.BookingStatus,
			BookingStatusSTLY: pl.BookingStatusSTLY,
			ADR:               pl.ADR,
			ADRSTLY:           pl.ADRSTLY,
			DemandColor:       pl.DemandColor,
			DemandDesc:        pl.DemandDesc,
			Available:         hostex.Available,
		}
	}

	return result, nil
}

// GetListingKPIs — 전체 리스팅 KPI
func (s *PriceLabsService) GetListingKPIs() ([]models.PriceLabsListing, error) {
	var listings []models.PriceLabsListing
	config.DB.Where("property_id > 0").Order("property_id ASC").Find(&listings)
	return listings, nil
}

// PriceCompareDay — 날짜별 가격 비교
type PriceCompareDay struct {
	HostexPrice       int64   `json:"hostex_price"`
	PriceLabsPrice    int64   `json:"pricelabs_price"`
	AIRecommended     int64   `json:"ai_recommended"`
	DiffPercent       float64 `json:"diff_percent"`         // Hostex vs PriceLabs 차이(%)
	MinStay           int     `json:"min_stay"`
	BookingStatus     string  `json:"booking_status"`       // Booked/Available
	BookingStatusSTLY string  `json:"booking_status_stly"`  // 작년
	ADR               int64   `json:"adr"`
	ADRSTLY           int64   `json:"adr_stly"`
	DemandColor       string  `json:"demand_color"`
	DemandDesc        string  `json:"demand_desc"`
	Available         bool    `json:"available"`
}

// --- helper ---

func extractHostexID(priceLabsID string) int64 {
	parts := strings.Split(priceLabsID, "_")
	if len(parts) < 2 {
		return 0
	}
	id, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0
	}
	return id
}
