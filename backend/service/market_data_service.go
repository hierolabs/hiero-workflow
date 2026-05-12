package service

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type MarketDataService struct{}

func NewMarketDataService() *MarketDataService {
	return &MarketDataService{}
}

// ---------- JSON import structs ----------

type samsamRoomDetailsFile struct {
	CollectedAt string           `json:"collected_at"`
	Summary     json.RawMessage  `json:"summary"`
	Rooms       []samsamRoomJSON `json:"rooms"`
}

type samsamRoomJSON struct {
	Page                     int                    `json:"page"`
	ListIndex                int                    `json:"list_index"`
	RoomID                   string                 `json:"room_id"`
	Name                     string                 `json:"name"`
	Address                  string                 `json:"address"`
	WeeklyPrice              string                 `json:"weekly_price"`
	Visibility               string                 `json:"visibility"`
	RentWeekly               string                 `json:"rent_weekly"`
	Deposit                  string                 `json:"deposit"`
	LongTermDiscountRaw      string                 `json:"long_term_discount_raw"`
	ImmediateMoveInDiscount  string                 `json:"immediate_move_in_discount_raw"`
	MaintenanceWeekly        string                 `json:"maintenance_weekly"`
	MaintenanceIncluded      map[string]string      `json:"maintenance_included"`
	MaintenanceDescription   string                 `json:"maintenance_description"`
	CleaningFee              string                 `json:"cleaning_fee"`
	RefundPolicy             string                 `json:"refund_policy"`
	RentWeeklyNumber         int                    `json:"rent_weekly_number"`
	DepositNumber            int                    `json:"deposit_number"`
	MaintenanceWeeklyNumber  int                    `json:"maintenance_weekly_number"`
	CleaningFeeNumber        int                    `json:"cleaning_fee_number"`
}

// ---------- Response structs ----------

type MarketCompareResult struct {
	PropertyID         uint                `json:"property_id"`
	PropertyName       string              `json:"property_name"`
	PropertyRegion     string              `json:"property_region"`
	OurRentWeekly      int                 `json:"our_rent_weekly"`
	MarketAvgWeekly    int                 `json:"market_avg_weekly"`
	MarketMedianWeekly int                 `json:"market_median_weekly"`
	MarketMinWeekly    int                 `json:"market_min_weekly"`
	MarketMaxWeekly    int                 `json:"market_max_weekly"`
	CompetitorCount    int                 `json:"competitor_count"`
	PricePosition      string              `json:"price_position"` // "below_avg", "avg", "above_avg"
	Percentile         float64             `json:"percentile"`
	DiffPercent        float64             `json:"diff_percent"` // (우리 - 시장평균) / 시장평균 * 100
	NearbyCompetitors  []NearbyCompetitor  `json:"nearby_competitors"`
}

type NearbyCompetitor struct {
	RoomName          string `json:"room_name"`
	Address           string `json:"address"`
	RentWeekly        int    `json:"rent_weekly"`
	MaintenanceWeekly int    `json:"maintenance_weekly"`
	CleaningFee       int    `json:"cleaning_fee"`
	Deposit           int    `json:"deposit"`
}

type MarketSummary struct {
	Platform          string            `json:"platform"`
	TotalRooms        int               `json:"total_rooms"`
	AvgRentWeekly     int               `json:"avg_rent_weekly"`
	MedianRentWeekly  int               `json:"median_rent_weekly"`
	MinRentWeekly     int               `json:"min_rent_weekly"`
	MaxRentWeekly     int               `json:"max_rent_weekly"`
	AvgMaintenance    int               `json:"avg_maintenance"`
	AvgCleaningFee    int               `json:"avg_cleaning_fee"`
	LatestSnapshot    string            `json:"latest_snapshot"`
	ByRegion          []RegionSummary   `json:"by_region"`
	RefundPolicyCounts map[string]int   `json:"refund_policy_counts"`
}

type RegionSummary struct {
	Region         string `json:"region"`
	Count          int    `json:"count"`
	AvgRentWeekly  int    `json:"avg_rent_weekly"`
	MinRentWeekly  int    `json:"min_rent_weekly"`
	MaxRentWeekly  int    `json:"max_rent_weekly"`
}

// ---------- Import: Room Details JSON ----------

func (s *MarketDataService) ImportRoomDetailsJSON(reader io.Reader, fileName string) (*models.CrawlJob, error) {
	now := time.Now()
	job := models.CrawlJob{
		Platform:  models.Platform33m2,
		JobType:   "rooms",
		Status:    "processing",
		Source:    "file_upload",
		FileName:  fileName,
		StartedAt: &now,
	}
	config.DB.Create(&job)

	data, err := io.ReadAll(reader)
	if err != nil {
		return s.failJob(&job, fmt.Sprintf("파일 읽기 실패: %v", err))
	}

	var file samsamRoomDetailsFile
	if err := json.Unmarshal(data, &file); err != nil {
		return s.failJob(&job, fmt.Sprintf("JSON 파싱 실패: %v", err))
	}

	snapshotDate := now
	if file.CollectedAt != "" {
		if t, err := time.Parse(time.RFC3339, file.CollectedAt); err == nil {
			snapshotDate = t
		}
	}

	// property_platforms에서 33m2 매칭 맵 조회
	matchMap := s.buildPlatformMatchMap()

	job.TotalRecords = len(file.Rooms)
	processed := 0

	for _, room := range file.Rooms {
		maintJSON, _ := json.Marshal(room.MaintenanceIncluded)
		rawJSON, _ := json.Marshal(room)

		mp := models.MarketPrice{
			CrawlJobID:           job.ID,
			Platform:             models.Platform33m2,
			ExternalRoomID:       room.RoomID,
			RoomName:             room.Name,
			Address:              room.Address,
			Region:               extractMarketRegion(room.Address),
			Visibility:           room.Visibility,
			RentWeekly:           room.RentWeeklyNumber,
			Deposit:              room.DepositNumber,
			MaintenanceWeekly:    room.MaintenanceWeeklyNumber,
			CleaningFee:          room.CleaningFeeNumber,
			RefundPolicy:         room.RefundPolicy,
			LongTermDiscountRaw:  room.LongTermDiscountRaw,
			ImmediateDiscountRaw: room.ImmediateMoveInDiscount,
			MaintenanceIncluded:  string(maintJSON),
			SnapshotDate:         snapshotDate,
			RawJSON:              string(rawJSON),
		}

		if propID, ok := matchMap[room.RoomID]; ok {
			mp.PropertyID = &propID
		}

		config.DB.Create(&mp)
		processed++
	}

	completedAt := time.Now()
	job.ProcessedRecords = processed
	job.Status = "completed"
	job.CompletedAt = &completedAt
	config.DB.Save(&job)

	return &job, nil
}

// ---------- Import: Contracts CSV ----------

func (s *MarketDataService) ImportContractsCSV(reader io.Reader, fileName string) (*models.CrawlJob, error) {
	now := time.Now()
	job := models.CrawlJob{
		Platform:  models.Platform33m2,
		JobType:   "contracts",
		Status:    "processing",
		Source:    "file_upload",
		FileName:  fileName,
		StartedAt: &now,
	}
	config.DB.Create(&job)

	csvReader := csv.NewReader(reader)
	headers, err := csvReader.Read()
	if err != nil {
		return s.failJob(&job, fmt.Sprintf("CSV 헤더 읽기 실패: %v", err))
	}

	colIdx := map[string]int{}
	for i, h := range headers {
		colIdx[h] = i
	}

	processed := 0
	total := 0

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		total++

		mc := models.MarketContract{
			CrawlJobID:         job.ID,
			Platform:           models.Platform33m2,
			ExternalContractID: getCol(record, colIdx, "contract_id"),
			ChatID:             getCol(record, colIdx, "chat_id"),
			RoomName:           getCol(record, colIdx, "room_name"),
			TenantName:         getCol(record, colIdx, "tenant"),
			Status:             getCol(record, colIdx, "status"),
			PaymentStatus:      getCol(record, colIdx, "payment_status"),
			PeriodRaw:          getCol(record, colIdx, "period"),
			Amount:             parseNumber(getCol(record, colIdx, "amount_number")),
			SnapshotDate:       now,
		}

		start, end := parsePeriod(mc.PeriodRaw)
		mc.PeriodStart = start
		mc.PeriodEnd = end

		config.DB.Create(&mc)
		processed++
	}

	completedAt := time.Now()
	job.TotalRecords = total
	job.ProcessedRecords = processed
	job.Status = "completed"
	job.CompletedAt = &completedAt
	config.DB.Save(&job)

	return &job, nil
}

// ---------- Auto Import from docs/samsam/ ----------

func (s *MarketDataService) ImportFromLatestFiles() (*models.CrawlJob, error) {
	baseDir := "../docs/samsam"
	pattern := filepath.Join(baseDir, "33m2_room_details_all_*.json")
	matches, _ := filepath.Glob(pattern)
	if len(matches) == 0 {
		return nil, fmt.Errorf("docs/samsam/에 33m2_room_details_all_*.json 파일이 없습니다")
	}

	sort.Strings(matches)
	latest := matches[len(matches)-1]

	f, err := os.Open(latest)
	if err != nil {
		return nil, fmt.Errorf("파일 열기 실패: %v", err)
	}
	defer f.Close()

	return s.ImportRoomDetailsJSON(f, filepath.Base(latest))
}

// ---------- Query: Market Prices ----------

func (s *MarketDataService) GetMarketPrices(platform string, snapshotDate string) ([]models.MarketPrice, error) {
	var prices []models.MarketPrice
	q := config.DB.Where("platform = ?", platform)

	if snapshotDate != "" {
		q = q.Where("DATE(snapshot_date) = ?", snapshotDate)
	} else {
		// 가장 최근 crawl_job_id 기준으로 조회
		var latestJobID uint
		config.DB.Model(&models.MarketPrice{}).
			Where("platform = ?", platform).
			Select("MAX(crawl_job_id)").
			Scan(&latestJobID)
		if latestJobID > 0 {
			q = q.Where("crawl_job_id = ?", latestJobID)
		}
	}

	q.Order("rent_weekly DESC").Find(&prices)
	return prices, nil
}

// ---------- Query: Market Comparison ----------

func (s *MarketDataService) GetMarketComparison(platform string) ([]MarketCompareResult, error) {
	// 1) HIERO 숙소 중 해당 플랫폼에 등록된 숙소 조회
	type propMatch struct {
		PropertyID uint
		ListingID  string
	}
	var matches []propMatch
	config.DB.Raw(`
		SELECT pp.property_id, pp.listing_id
		FROM property_platforms pp
		WHERE pp.platform = ? AND pp.listing_id != ''
	`, platform).Scan(&matches)

	// 2) 최신 시장 데이터 조회
	prices, _ := s.GetMarketPrices(platform, "")
	if len(prices) == 0 {
		return nil, nil
	}

	// 지역별 그룹핑
	regionPrices := map[string][]int{}
	regionRooms := map[string][]models.MarketPrice{}
	for _, p := range prices {
		if p.RentWeekly > 0 {
			regionPrices[p.Region] = append(regionPrices[p.Region], p.RentWeekly)
			regionRooms[p.Region] = append(regionRooms[p.Region], p)
		}
	}

	// 전체 가격 리스트 (지역 무관)
	allPrices := []int{}
	for _, p := range prices {
		if p.RentWeekly > 0 {
			allPrices = append(allPrices, p.RentWeekly)
		}
	}
	sort.Ints(allPrices)

	// 3) 매칭된 숙소 → 시장 비교
	var results []MarketCompareResult

	// externalID → MarketPrice 맵
	extMap := map[string]models.MarketPrice{}
	for _, p := range prices {
		extMap[p.ExternalRoomID] = p
	}

	for _, m := range matches {
		mp, found := extMap[m.ListingID]
		if !found {
			continue
		}

		var prop models.Property
		config.DB.First(&prop, m.PropertyID)

		region := mp.Region
		rp := regionPrices[region]
		if len(rp) == 0 {
			rp = allPrices
		}

		avg := calcAvg(rp)
		median := calcMedian(rp)
		minP, maxP := rp[0], rp[len(rp)-1]
		sort.Ints(rp)

		position := "avg"
		if mp.RentWeekly < avg*90/100 {
			position = "below_avg"
		} else if mp.RentWeekly > avg*110/100 {
			position = "above_avg"
		}

		pct := calcPercentile(rp, mp.RentWeekly)
		diffPct := 0.0
		if avg > 0 {
			diffPct = float64(mp.RentWeekly-avg) / float64(avg) * 100
		}

		// 가까운 경쟁 매물 (같은 지역, 가격 근접 상위 5개)
		nearby := findNearbyCompetitors(regionRooms[region], mp.RentWeekly, mp.ExternalRoomID, 5)

		results = append(results, MarketCompareResult{
			PropertyID:         m.PropertyID,
			PropertyName:       func() string { if prop.DisplayName != "" { return prop.DisplayName }; return prop.Name }(),
			PropertyRegion:     region,
			OurRentWeekly:      mp.RentWeekly,
			MarketAvgWeekly:    avg,
			MarketMedianWeekly: median,
			MarketMinWeekly:    minP,
			MarketMaxWeekly:    maxP,
			CompetitorCount:    len(rp),
			PricePosition:      position,
			Percentile:         pct,
			DiffPercent:        math.Round(diffPct*10) / 10,
			NearbyCompetitors:  nearby,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].PropertyName < results[j].PropertyName
	})

	return results, nil
}

// ---------- Query: Market Summary ----------

func (s *MarketDataService) GetMarketSummary(platform string) (*MarketSummary, error) {
	prices, _ := s.GetMarketPrices(platform, "")
	if len(prices) == 0 {
		return &MarketSummary{Platform: platform}, nil
	}

	rents := []int{}
	maintenances := []int{}
	cleaningFees := []int{}
	refundCounts := map[string]int{}
	regionMap := map[string][]int{}

	for _, p := range prices {
		if p.RentWeekly > 0 {
			rents = append(rents, p.RentWeekly)
		}
		maintenances = append(maintenances, p.MaintenanceWeekly)
		cleaningFees = append(cleaningFees, p.CleaningFee)
		if p.RefundPolicy != "" {
			refundCounts[p.RefundPolicy]++
		}
		if p.RentWeekly > 0 {
			regionMap[p.Region] = append(regionMap[p.Region], p.RentWeekly)
		}
	}

	sort.Ints(rents)

	var regions []RegionSummary
	for region, rp := range regionMap {
		sort.Ints(rp)
		regions = append(regions, RegionSummary{
			Region:        region,
			Count:         len(rp),
			AvgRentWeekly: calcAvg(rp),
			MinRentWeekly: rp[0],
			MaxRentWeekly: rp[len(rp)-1],
		})
	}
	sort.Slice(regions, func(i, j int) bool { return regions[i].Count > regions[j].Count })

	snapshot := prices[0].SnapshotDate.Format("2006-01-02")

	return &MarketSummary{
		Platform:           platform,
		TotalRooms:         len(prices),
		AvgRentWeekly:      calcAvg(rents),
		MedianRentWeekly:   calcMedian(rents),
		MinRentWeekly:      rents[0],
		MaxRentWeekly:      rents[len(rents)-1],
		AvgMaintenance:     calcAvg(maintenances),
		AvgCleaningFee:     calcAvg(cleaningFees),
		LatestSnapshot:     snapshot,
		ByRegion:           regions,
		RefundPolicyCounts: refundCounts,
	}, nil
}

// ---------- Query: Vacancy Analysis ----------

type VacancyItem struct {
	PropertyID      uint   `json:"property_id"`
	DisplayName     string `json:"display_name"`
	ZoneCode        string `json:"zone_code"`
	Building        string `json:"building"`
	RoomType        string `json:"room_type"`
	CurrentBooking  *VacancyBooking `json:"current_booking"`
	NextBooking     *VacancyBooking `json:"next_booking"`
	VacantDays      int    `json:"vacant_days"`
	Urgency         string `json:"urgency"`
	// 우리 실제 판매 데이터
	OurAvgNightly     int     `json:"our_avg_nightly"`      // 우리 평균 박당 가격
	OurAirbnbNightly  int     `json:"our_airbnb_nightly"`   // Airbnb 평균 박당
	OurSamsamNightly  int     `json:"our_samsam_nightly"`   // 삼삼엠투 평균 박당
	OurOtherNightly   int     `json:"our_other_nightly"`    // 기타 채널 평균 박당
	ZoneAvgNightly    int     `json:"zone_avg_nightly"`     // 같은 권역 평균 박당
	ZoneAirbnbAvg     int     `json:"zone_airbnb_avg"`      // 같은 권역 Airbnb 평균
	ZoneSamsamAvg     int     `json:"zone_samsam_avg"`      // 같은 권역 삼삼엠투 평균
	TotalBookings     int     `json:"total_bookings"`       // 총 예약 수
	// 시장 데이터 (삼삼엠투 매물)
	MarketAvgWeekly int    `json:"market_avg_weekly"`
	MarketMinWeekly int    `json:"market_min_weekly"`
	MarketMaxWeekly int    `json:"market_max_weekly"`
	CompetitorCount int    `json:"competitor_count"`
	// 추천 가격 (우리 데이터 기반)
	SuggestedNightly      int    `json:"suggested_nightly"`       // 추천 실질 박당
	SuggestedWeekly       int    `json:"suggested_weekly"`        // 추천 실질 주당
	SuggestedMonthly      int    `json:"suggested_monthly"`       // 추천 실질 월당
	SuggestedHeadline     int    `json:"suggested_headline"`      // 추천 표시가 (임대료만, 삼투 설정값)
	CurrentHeadline       int    `json:"current_headline"`        // 현재 삼투 표시가
	HeadlineDiff          int    `json:"headline_diff"`           // 현재 - 추천 (양수면 내려야 함)
	MaintenanceWeekly     int    `json:"maintenance_weekly"`      // 관리비/주
	CleaningFee           int    `json:"cleaning_fee"`            // 청소비(1회)
	PriceDropPct          int    `json:"price_drop_pct"`
	PriceReason      string `json:"price_reason"`         // 추천 근거
	RecentBookings30 int    `json:"recent_bookings_30"`
	OccupancyRate30  float64 `json:"occupancy_rate_30"`
}

type VacancyBooking struct {
	CheckIn     string `json:"check_in"`
	CheckOut    string `json:"check_out"`
	Channel     string `json:"channel"`
	GuestName   string `json:"guest_name"`
	TotalRate   int    `json:"total_rate"`
}

type VacancyAnalysis struct {
	TotalProperties   int             `json:"total_properties"`
	VacantNow         int             `json:"vacant_now"`
	VacantIn7Days     int             `json:"vacant_in_7_days"`
	CriticalCount     int             `json:"critical_count"`
	WarningCount      int             `json:"warning_count"`
	AvgOccupancy30    float64         `json:"avg_occupancy_30"`
	Items             []VacancyItem   `json:"items"`
	ZoneSummary       []ZoneVacancy   `json:"zone_summary"`
	RoomTypeSummary   []RoomTypeVacancy `json:"room_type_summary"`
	ZonePricing       []ZonePricing       `json:"zone_pricing"`
	MarketEffective   []MarketEffective   `json:"market_effective"`
}

type ZoneVacancy struct {
	ZoneCode    string  `json:"zone_code"`
	Building    string  `json:"building"`
	Total       int     `json:"total"`
	Vacant      int     `json:"vacant"`
	Occupancy   float64 `json:"occupancy"`
}

type RoomTypeVacancy struct {
	RoomType        string  `json:"room_type"`
	Total           int     `json:"total"`
	Vacant          int     `json:"vacant"`
	Occupancy       float64 `json:"occupancy"`
	MarketAvgWeekly int     `json:"market_avg_weekly"`
}

type ZonePricing struct {
	ZoneCode        string `json:"zone_code"`
	Building        string `json:"building"`
	AvgNightly      int    `json:"avg_nightly"`       // 중기채널 평균 박당
	SamsamAvg       int    `json:"samsam_avg"`
	LiveAvg         int    `json:"live_avg"`
	PersonalAvg     int    `json:"personal_avg"`
	AirbnbAvg       int    `json:"airbnb_avg"`        // Airbnb 평균 박당 (참고용)
	AirbnbBookings  int    `json:"airbnb_bookings"`   // Airbnb 예약 수
	TotalBookings   int    `json:"total_bookings"`    // 중기채널 총 예약수
	AvgNights       int    `json:"avg_nights"`
	MarketAvgWeekly int    `json:"market_avg_weekly"`
}

// 체류기간별 실질 박당 비용
type EffectiveCost struct {
	Weeks     int `json:"weeks"`
	TotalCost int `json:"total_cost"` // 총 비용 (임대+관리비+청소비)
	Nightly   int `json:"nightly"`    // 실질 박당
	Weekly    int `json:"weekly"`     // 실질 주당 (총비용/주수)
}

type LongTermDiscount struct {
	MinWeeks int `json:"min_weeks"` // N주 이상
	Percent  int `json:"percent"`   // X% 할인
}

type ImmediateDiscount struct {
	WithinDays int `json:"within_days"` // N일 이내 입주
	Amount     int `json:"amount"`      // X만원 할인
}

type MarketEffective struct {
	RoomName           string              `json:"room_name"`
	RentWeekly         int                 `json:"rent_weekly"`
	MaintenanceWeekly  int                 `json:"maintenance_weekly"`
	CleaningFee        int                 `json:"cleaning_fee"`
	Deposit            int                 `json:"deposit"`
	HeadlineWeekly     int                 `json:"headline_weekly"`
	Costs              []EffectiveCost     `json:"costs"`
	PropertyID         *uint               `json:"property_id"`
	DisplayName        string              `json:"display_name"`
	Region             string              `json:"region"`
	LongTermDiscounts  []LongTermDiscount  `json:"long_term_discounts"`
	ImmediateDiscounts []ImmediateDiscount `json:"immediate_discounts"`
}

func calcEffectiveCosts(rent, maint, cleaning int) []EffectiveCost {
	var costs []EffectiveCost
	for _, w := range []int{1, 2, 3, 4} {
		total := (rent+maint)*w + cleaning
		nights := w * 7
		costs = append(costs, EffectiveCost{
			Weeks:     w,
			TotalCost: total,
			Nightly:   total / nights,
			Weekly:    total / w,
		})
	}
	return costs
}

func calcEffectiveCostsWithDiscount(rent, maint, cleaning int, longDiscounts []LongTermDiscount, immDiscounts []ImmediateDiscount) []EffectiveCost {
	// 즉시 입주 할인: 가장 큰 할인 적용 (1회성)
	bestImm := 0
	for _, d := range immDiscounts {
		if d.Amount > bestImm {
			bestImm = d.Amount
		}
	}

	var costs []EffectiveCost
	for _, w := range []int{1, 2, 3, 4} {
		// 장기 할인: 해당 주수에 적용 가능한 가장 높은 할인율
		discountPct := 0
		for _, d := range longDiscounts {
			if w >= d.MinWeeks && d.Percent > discountPct {
				discountPct = d.Percent
			}
		}
		discountedRent := rent * (100 - discountPct) / 100
		total := (discountedRent+maint)*w + cleaning - bestImm
		if total < 0 {
			total = 0
		}
		nights := w * 7
		costs = append(costs, EffectiveCost{
			Weeks:     w,
			TotalCost: total,
			Nightly:   total / nights,
			Weekly:    total / w,
		})
	}
	return costs
}

var longTermRe = regexp.MustCompile(`(\d+)주\s*이상\s*계약\s*시[,]?\s*(\d+)%\s*할인`)
var immediateRe = regexp.MustCompile(`(\d+)일\s*이내\s*입주\s*시[,]?\s*(\d+)\s*만?\s*원?\s*할인`)

func parseLongTermDiscounts(raw string) []LongTermDiscount {
	matches := longTermRe.FindAllStringSubmatch(raw, -1)
	seen := map[string]bool{}
	var result []LongTermDiscount
	for _, m := range matches {
		key := m[1] + ":" + m[2]
		if seen[key] {
			continue
		}
		seen[key] = true
		weeks, _ := strconv.Atoi(m[1])
		pct, _ := strconv.Atoi(m[2])
		if weeks > 0 && pct > 0 {
			result = append(result, LongTermDiscount{MinWeeks: weeks, Percent: pct})
		}
	}
	return result
}

func parseImmediateDiscounts(raw string) []ImmediateDiscount {
	matches := immediateRe.FindAllStringSubmatch(raw, -1)
	seen := map[string]bool{}
	var result []ImmediateDiscount
	for _, m := range matches {
		key := m[1] + ":" + m[2]
		if seen[key] {
			continue
		}
		seen[key] = true
		days, _ := strconv.Atoi(m[1])
		amount, _ := strconv.Atoi(m[2])
		if days > 0 && amount > 0 {
			result = append(result, ImmediateDiscount{WithinDays: days, Amount: amount * 10000})
		}
	}
	return result
}

// 중기임대 채널 판별 (Airbnb/Agoda/Booking 제외)
func isMidTermChannel(channel string) bool {
	lower := strings.ToLower(channel)
	if strings.Contains(lower, "airbnb") || strings.Contains(lower, "agoda") ||
		strings.Contains(lower, "booking") || strings.Contains(lower, "에어비앤비") {
		return false
	}
	return true
}

func extractRoomTypeFromName(name string) string {
	lower := strings.ToLower(name)
	if strings.Contains(name, "3룸") || strings.Contains(lower, "3room") || strings.Contains(name, "쓰리룸") {
		return "3룸"
	}
	if strings.Contains(name, "2룸") || strings.Contains(lower, "2room") || strings.Contains(name, "투룸") {
		return "2룸"
	}
	if strings.Contains(name, "1.5룸") {
		return "1.5룸"
	}
	if strings.Contains(name, "1룸") || strings.Contains(lower, "1room") || strings.Contains(name, "원룸") {
		return "1룸"
	}
	if strings.Contains(name, "복층") {
		return "복층"
	}
	return ""
}

func (s *MarketDataService) GetVacancyAnalysis() (*VacancyAnalysis, error) {
	// 1) 운영 중 숙소 목록
	var props []models.Property
	config.DB.Where("deleted_at IS NULL AND display_name REGEXP ?", "^[A-Z][0-9]").Find(&props)

	today := time.Now().Format("2006-01-02")
	in7 := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	ago30 := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	// 2) 우리 실제 판매 데이터: 숙소별 중기채널 가격 (Airbnb/Agoda 제외)
	type priceRow struct {
		PropertyID  int64  `gorm:"column:property_id"`
		ChannelName string `gorm:"column:channel_name"`
		Bookings    int    `gorm:"column:bookings"`
		AvgNightly  int    `gorm:"column:avg_nightly"`
		AvgNights   int    `gorm:"column:avg_nights"`
	}
	var priceRows []priceRow
	config.DB.Raw(`
		SELECT r.property_id, r.channel_name,
			COUNT(*) as bookings,
			ROUND(AVG(CASE WHEN DATEDIFF(r.check_out_date, r.check_in_date) > 0
				THEN r.total_rate / DATEDIFF(r.check_out_date, r.check_in_date) ELSE 0 END)) as avg_nightly,
			ROUND(AVG(DATEDIFF(r.check_out_date, r.check_in_date))) as avg_nights
		FROM reservations r
		WHERE r.status = 'accepted' AND r.total_rate > 0
			AND r.check_in_date >= '2026-01-01'
		GROUP BY r.property_id, r.channel_name
	`).Scan(&priceRows)

	// 숙소별 → 채널별 가격 맵
	type propPricing struct {
		samsamNightly   int
		samsamCount     int
		liveNightly     int
		liveCount       int
		personalNightly int
		personalCount   int
		airbnbNightly   int
		airbnbCount     int
		allMidNightly   []int // 중기채널 전체 (분석 기준)
		totalBookings   int   // 중기채널 예약수
	}
	propPriceMap := map[int64]*propPricing{}
	for _, row := range priceRows {
		pp, ok := propPriceMap[row.PropertyID]
		if !ok {
			pp = &propPricing{}
			propPriceMap[row.PropertyID] = pp
		}

		lower := strings.ToLower(row.ChannelName)
		isAirbnb := strings.Contains(lower, "airbnb") || strings.Contains(lower, "에어비앤비")
		isAgoda := strings.Contains(lower, "agoda")
		isBooking := strings.Contains(lower, "booking")

		if isAirbnb {
			pp.airbnbNightly = row.AvgNightly
			pp.airbnbCount = row.Bookings
		} else if isAgoda || isBooking {
			// Agoda/Booking은 표시도 분석도 제외
		} else {
			// 중기채널: 삼삼엠투, 리브, 개인 등
			pp.totalBookings += row.Bookings
			pp.allMidNightly = append(pp.allMidNightly, row.AvgNightly)

			if strings.Contains(lower, "삼삼") || strings.Contains(lower, "samsam") || strings.Contains(lower, "33m2") {
				pp.samsamNightly = row.AvgNightly
				pp.samsamCount = row.Bookings
			} else if strings.Contains(lower, "리브") || strings.Contains(lower, "liv") {
				pp.liveNightly = row.AvgNightly
				pp.liveCount = row.Bookings
			} else {
				pp.personalNightly = row.AvgNightly
				pp.personalCount += row.Bookings
			}
		}
	}

	// 3) 시장 데이터 (삼삼엠투 매물)
	marketPrices, _ := s.GetMarketPrices("33m2", "")
	roomTypePrices := map[string][]int{}
	for _, mp := range marketPrices {
		rt := extractRoomTypeFromName(mp.RoomName)
		if rt != "" && mp.RentWeekly > 0 {
			roomTypePrices[rt] = append(roomTypePrices[rt], mp.RentWeekly)
		}
	}

	var items []VacancyItem
	zoneStat := map[string]*ZoneVacancy{}
	rtStat := map[string]*RoomTypeVacancy{}
	// 권역별 가격 집계
	zonePriceData := map[string]*struct {
		building       string
		samsamPrices   []int
		livePrices     []int
		personalPrices []int
		airbnbPrices   []int
		airbnbBookings int
		allPrices      []int
		totalBookings  int
		totalNights    int
	}{}

	totalVacantNow := 0
	totalVacantIn7 := 0
	criticalCount := 0
	warningCount := 0
	totalOcc := 0.0
	propCount := 0

	for _, p := range props {
		dn := p.DisplayName
		if dn == "" {
			dn = p.Name
		}
		zoneCode := ""
		if len(dn) > 0 {
			zoneCode = string(dn[0])
		}
		parts := strings.Fields(dn)
		building := ""
		if len(parts) >= 2 {
			building = parts[1]
		}

		// 현재 예약
		var currentRes []struct {
			CheckInDate  string `gorm:"column:check_in_date"`
			CheckOutDate string `gorm:"column:check_out_date"`
			ChannelName  string `gorm:"column:channel_name"`
			GuestName    string `gorm:"column:guest_name"`
			TotalRate    int    `gorm:"column:total_rate"`
		}
		config.DB.Raw(`
			SELECT check_in_date, check_out_date, channel_name, guest_name, total_rate
			FROM reservations
			WHERE property_id = ? AND status = 'accepted'
			  AND check_in_date <= ? AND check_out_date > ?
			ORDER BY check_in_date LIMIT 1
		`, p.HostexID, today, today).Scan(&currentRes)

		// 다음 예약
		var nextRes []struct {
			CheckInDate  string `gorm:"column:check_in_date"`
			CheckOutDate string `gorm:"column:check_out_date"`
			ChannelName  string `gorm:"column:channel_name"`
			GuestName    string `gorm:"column:guest_name"`
			TotalRate    int    `gorm:"column:total_rate"`
		}
		config.DB.Raw(`
			SELECT check_in_date, check_out_date, channel_name, guest_name, total_rate
			FROM reservations
			WHERE property_id = ? AND status = 'accepted'
			  AND check_in_date > ?
			ORDER BY check_in_date LIMIT 1
		`, p.HostexID, today).Scan(&nextRes)

		// 최근 30일 가동률
		var recentCount int64
		config.DB.Raw(`
			SELECT COUNT(*) FROM reservations
			WHERE property_id = ? AND status = 'accepted' AND check_in_date >= ?
		`, p.HostexID, ago30).Scan(&recentCount)

		var occupiedDays int
		config.DB.Raw(`
			SELECT COALESCE(SUM(DATEDIFF(LEAST(check_out_date, ?), GREATEST(check_in_date, ?))), 0)
			FROM reservations
			WHERE property_id = ? AND status = 'accepted'
			  AND check_out_date > ? AND check_in_date < ?
		`, today, ago30, p.HostexID, ago30, today).Scan(&occupiedDays)
		occRate := float64(occupiedDays) / 30.0 * 100
		if occRate > 100 {
			occRate = 100
		}

		item := VacancyItem{
			PropertyID:       p.ID,
			DisplayName:      dn,
			ZoneCode:         zoneCode,
			Building:         building,
			RecentBookings30: int(recentCount),
			OccupancyRate30:  math.Round(occRate*10) / 10,
		}

		// 우리 실제 판매 가격 (중기채널만)
		if pp, ok := propPriceMap[int64(p.HostexID)]; ok {
			item.OurSamsamNightly = pp.samsamNightly
			item.OurOtherNightly = pp.personalNightly
			item.TotalBookings = pp.totalBookings
			if len(pp.allMidNightly) > 0 {
				item.OurAvgNightly = calcAvg(pp.allMidNightly)
			}
			// 권역 가격 집계
			if _, ok := zonePriceData[zoneCode]; !ok {
				zonePriceData[zoneCode] = &struct {
					building       string
					samsamPrices   []int
					livePrices     []int
					personalPrices []int
					airbnbPrices   []int
					airbnbBookings int
					allPrices      []int
					totalBookings  int
					totalNights    int
				}{building: building}
			}
			zpd := zonePriceData[zoneCode]
			zpd.totalBookings += pp.totalBookings
			if pp.samsamNightly > 0 {
				zpd.samsamPrices = append(zpd.samsamPrices, pp.samsamNightly)
			}
			if pp.liveNightly > 0 {
				zpd.livePrices = append(zpd.livePrices, pp.liveNightly)
			}
			if pp.personalNightly > 0 {
				zpd.personalPrices = append(zpd.personalPrices, pp.personalNightly)
			}
			if pp.airbnbNightly > 0 {
				zpd.airbnbPrices = append(zpd.airbnbPrices, pp.airbnbNightly)
				zpd.airbnbBookings += pp.airbnbCount
			}
			zpd.allPrices = append(zpd.allPrices, pp.allMidNightly...)
		}

		if len(currentRes) > 0 {
			item.CurrentBooking = &VacancyBooking{
				CheckIn: currentRes[0].CheckInDate, CheckOut: currentRes[0].CheckOutDate,
				Channel: currentRes[0].ChannelName, GuestName: currentRes[0].GuestName,
				TotalRate: currentRes[0].TotalRate,
			}
		}
		if len(nextRes) > 0 {
			item.NextBooking = &VacancyBooking{
				CheckIn: nextRes[0].CheckInDate, CheckOut: nextRes[0].CheckOutDate,
				Channel: nextRes[0].ChannelName, GuestName: nextRes[0].GuestName,
				TotalRate: nextRes[0].TotalRate,
			}
		}

		// 공실일수
		isVacantNow := len(currentRes) == 0
		if isVacantNow {
			if len(nextRes) > 0 {
				nextIn, _ := time.Parse("2006-01-02", nextRes[0].CheckInDate)
				item.VacantDays = int(nextIn.Sub(time.Now()).Hours()/24) + 1
			} else {
				item.VacantDays = 999
			}
		} else {
			checkOut, _ := time.Parse("2006-01-02", currentRes[0].CheckOutDate)
			if len(nextRes) > 0 {
				nextIn, _ := time.Parse("2006-01-02", nextRes[0].CheckInDate)
				item.VacantDays = int(nextIn.Sub(checkOut).Hours() / 24)
			} else {
				remaining := int(checkOut.Sub(time.Now()).Hours() / 24)
				item.VacantDays = -remaining
			}
		}

		// 긴급도
		if isVacantNow && item.VacantDays > 7 {
			item.Urgency = "critical"
			criticalCount++
		} else if isVacantNow || item.VacantDays <= 3 {
			item.Urgency = "warning"
			warningCount++
		} else {
			item.Urgency = "ok"
		}
		if isVacantNow {
			totalVacantNow++
		}
		vacantIn7 := isVacantNow
		if !isVacantNow && len(currentRes) > 0 {
			if currentRes[0].CheckOutDate <= in7 && len(nextRes) == 0 {
				vacantIn7 = true
			}
		}
		if vacantIn7 {
			totalVacantIn7++
		}

		// 룸타입
		roomType := "1룸"
		if p.Bedrooms >= 3 {
			roomType = "3룸"
		} else if p.Bedrooms == 2 {
			roomType = "2룸"
		}
		item.RoomType = roomType

		// 시장가
		if rtPrices, ok := roomTypePrices[roomType]; ok && len(rtPrices) > 0 {
			sort.Ints(rtPrices)
			item.MarketAvgWeekly = calcAvg(rtPrices)
			item.MarketMinWeekly = rtPrices[0]
			item.MarketMaxWeekly = rtPrices[len(rtPrices)-1]
			item.CompetitorCount = len(rtPrices)
		}

		items = append(items, item)
		totalOcc += occRate
		propCount++

		if _, ok := zoneStat[zoneCode]; !ok {
			zoneStat[zoneCode] = &ZoneVacancy{ZoneCode: zoneCode, Building: building}
		}
		zoneStat[zoneCode].Total++
		if isVacantNow {
			zoneStat[zoneCode].Vacant++
		}

		if _, ok := rtStat[roomType]; !ok {
			rtStat[roomType] = &RoomTypeVacancy{RoomType: roomType}
		}
		rtStat[roomType].Total++
		if isVacantNow {
			rtStat[roomType].Vacant++
		}
	}

	// 숙소 → 삼투 매물 매칭 맵
	// 1) property_id 직접 매칭
	marketByPropID := map[uint]models.MarketPrice{}
	for _, mp := range marketPrices {
		if mp.PropertyID != nil && mp.RentWeekly > 0 {
			marketByPropID[*mp.PropertyID] = mp
		}
	}
	// 2) 매물명에서 숙소 코드 추출하여 매칭 (예: "강동역1.5룸 B16" → "B16")
	propCodeMap := map[string]uint{} // 코드 → property.ID
	codeRe := regexp.MustCompile(`^([A-Z]+\d+)`)
	for _, p := range props {
		dn := p.DisplayName
		if dn == "" {
			dn = p.Name
		}
		m := codeRe.FindString(dn)
		if m != "" {
			propCodeMap[m] = p.ID
		}
	}
	marketCodeRe := regexp.MustCompile(`\b([A-Z]\d{1,3})\b`)
	for _, mp := range marketPrices {
		if mp.RentWeekly <= 0 {
			continue
		}
		matches := marketCodeRe.FindAllString(mp.RoomName, -1)
		for _, code := range matches {
			if propID, ok := propCodeMap[code]; ok {
				if _, exists := marketByPropID[propID]; !exists {
					marketByPropID[propID] = mp
				}
			}
		}
	}

	// 권역별 평균 가격 계산 후 items에 반영
	zoneAvgMap := map[string]int{}
	zoneSamsamMap := map[string]int{}
	for zone, zpd := range zonePriceData {
		if len(zpd.allPrices) > 0 {
			zoneAvgMap[zone] = calcAvg(zpd.allPrices)
		}
		if len(zpd.samsamPrices) > 0 {
			zoneSamsamMap[zone] = calcAvg(zpd.samsamPrices)
		}
	}

	for i := range items {
		item := &items[i]
		item.ZoneAvgNightly = zoneAvgMap[item.ZoneCode]
		item.ZoneSamsamAvg = zoneSamsamMap[item.ZoneCode]

		// 추천 가격: 우리 데이터 기반
		basePrice := item.OurAvgNightly
		if basePrice == 0 {
			basePrice = item.ZoneAvgNightly
		}
		if basePrice == 0 && item.MarketAvgWeekly > 0 {
			basePrice = item.MarketAvgWeekly / 7 // 주간 → 박당 환산
		}

		// 삼투 매칭 데이터에서 현재 표시가·관리비·청소비
		if mp, ok := marketByPropID[item.PropertyID]; ok {
			item.CurrentHeadline = mp.RentWeekly
			item.MaintenanceWeekly = mp.MaintenanceWeekly
			item.CleaningFee = mp.CleaningFee
		}

		// 추천 가격: 현재 표시가 × (1 - 할인율)
		switch item.Urgency {
		case "critical":
			item.PriceDropPct = 15
			item.PriceReason = "7일+ 공실, 표시가 15% 할인 추천"
		case "warning":
			item.PriceDropPct = 8
			item.PriceReason = "공실 주의, 표시가 8% 할인 추천"
		default:
			item.PriceDropPct = 0
			item.PriceReason = "현재 가격 유지"
		}

		if item.CurrentHeadline > 0 {
			// 삼투 매칭 있음: 현재 표시가 기준 할인
			item.SuggestedHeadline = item.CurrentHeadline * (100 - item.PriceDropPct) / 100
			item.HeadlineDiff = item.CurrentHeadline - item.SuggestedHeadline
			// 실질 환산
			item.SuggestedWeekly = item.SuggestedHeadline + item.MaintenanceWeekly
			item.SuggestedNightly = item.SuggestedWeekly / 7
			item.SuggestedMonthly = item.SuggestedWeekly * 4
		} else if basePrice > 0 {
			// 삼투 매칭 없음: 우리 판매 평균 기반
			item.SuggestedNightly = basePrice * (100 - item.PriceDropPct) / 100
			item.SuggestedWeekly = item.SuggestedNightly * 7
			item.SuggestedMonthly = item.SuggestedNightly * 30
			item.SuggestedHeadline = item.SuggestedWeekly
		}
	}

	// 정렬
	urgencyOrder := map[string]int{"critical": 0, "warning": 1, "ok": 2}
	sort.Slice(items, func(i, j int) bool {
		if urgencyOrder[items[i].Urgency] != urgencyOrder[items[j].Urgency] {
			return urgencyOrder[items[i].Urgency] < urgencyOrder[items[j].Urgency]
		}
		return items[i].VacantDays > items[j].VacantDays
	})

	// zone 가동률
	var zones []ZoneVacancy
	for _, z := range zoneStat {
		z.Occupancy = math.Round(float64(z.Total-z.Vacant) / float64(z.Total) * 100)
		zones = append(zones, *z)
	}
	sort.Slice(zones, func(i, j int) bool { return zones[i].Occupancy < zones[j].Occupancy })

	// zone pricing
	var zonePricingSlice []ZonePricing
	for zone, zpd := range zonePriceData {
		zp := ZonePricing{
			ZoneCode:      zone,
			Building:      zpd.building,
			TotalBookings: zpd.totalBookings,
		}
		if len(zpd.allPrices) > 0 {
			zp.AvgNightly = calcAvg(zpd.allPrices)
		}
		if len(zpd.samsamPrices) > 0 {
			zp.SamsamAvg = calcAvg(zpd.samsamPrices)
		}
		if len(zpd.livePrices) > 0 {
			zp.LiveAvg = calcAvg(zpd.livePrices)
		}
		if len(zpd.personalPrices) > 0 {
			zp.PersonalAvg = calcAvg(zpd.personalPrices)
		}
		if len(zpd.airbnbPrices) > 0 {
			zp.AirbnbAvg = calcAvg(zpd.airbnbPrices)
			zp.AirbnbBookings = zpd.airbnbBookings
		}
		zonePricingSlice = append(zonePricingSlice, zp)
	}
	sort.Slice(zonePricingSlice, func(i, j int) bool {
		return zonePricingSlice[i].AvgNightly > zonePricingSlice[j].AvgNightly
	})

	// roomType
	var rtSlice []RoomTypeVacancy
	for _, r := range rtStat {
		r.Occupancy = math.Round(float64(r.Total-r.Vacant) / float64(r.Total) * 100)
		if ps, ok := roomTypePrices[r.RoomType]; ok && len(ps) > 0 {
			r.MarketAvgWeekly = calcAvg(ps)
		}
		rtSlice = append(rtSlice, *r)
	}
	sort.Slice(rtSlice, func(i, j int) bool { return rtSlice[i].Occupancy < rtSlice[j].Occupancy })

	avgOcc := 0.0
	if propCount > 0 {
		avgOcc = math.Round(totalOcc/float64(propCount)*10) / 10
	}

	// 시장 매물 실질비용 (우리 매물 매칭 포함)
	var marketEffective []MarketEffective
	propDisplayMap := map[uint]string{}
	for _, p := range props {
		dn := p.DisplayName
		if dn == "" {
			dn = p.Name
		}
		propDisplayMap[p.ID] = dn
	}
	for _, mp := range marketPrices {
		if mp.RentWeekly <= 0 {
			continue
		}
		longDisc := parseLongTermDiscounts(mp.LongTermDiscountRaw)
		immDisc := parseImmediateDiscounts(mp.ImmediateDiscountRaw)
		me := MarketEffective{
			RoomName:           mp.RoomName,
			RentWeekly:         mp.RentWeekly,
			MaintenanceWeekly:  mp.MaintenanceWeekly,
			CleaningFee:        mp.CleaningFee,
			Deposit:            mp.Deposit,
			HeadlineWeekly:     mp.RentWeekly,
			Costs:              calcEffectiveCosts(mp.RentWeekly, mp.MaintenanceWeekly, mp.CleaningFee),
			PropertyID:         mp.PropertyID,
			Region:             mp.Region,
			LongTermDiscounts:  longDisc,
			ImmediateDiscounts: immDisc,
		}
		if mp.PropertyID != nil {
			if dn, ok := propDisplayMap[*mp.PropertyID]; ok {
				me.DisplayName = dn
			}
		}
		marketEffective = append(marketEffective, me)
	}
	// 실질 1주 박당 기준 정렬
	sort.Slice(marketEffective, func(i, j int) bool {
		if len(marketEffective[i].Costs) > 0 && len(marketEffective[j].Costs) > 0 {
			return marketEffective[i].Costs[0].Nightly < marketEffective[j].Costs[0].Nightly
		}
		return false
	})

	return &VacancyAnalysis{
		TotalProperties: len(props),
		VacantNow:       totalVacantNow,
		VacantIn7Days:   totalVacantIn7,
		CriticalCount:   criticalCount,
		WarningCount:    warningCount,
		AvgOccupancy30:  avgOcc,
		Items:           items,
		ZoneSummary:     zones,
		RoomTypeSummary: rtSlice,
		ZonePricing:     zonePricingSlice,
		MarketEffective: marketEffective,
	}, nil
}

// ---------- Query: Crawl Jobs ----------

func (s *MarketDataService) GetCrawlJobs(limit int) ([]models.CrawlJob, error) {
	if limit <= 0 {
		limit = 20
	}
	var jobs []models.CrawlJob
	config.DB.Order("created_at DESC").Limit(limit).Find(&jobs)
	return jobs, nil
}

// ---------- helpers ----------

func (s *MarketDataService) failJob(job *models.CrawlJob, msg string) (*models.CrawlJob, error) {
	job.Status = "failed"
	job.ErrorMessage = msg
	now := time.Now()
	job.CompletedAt = &now
	config.DB.Save(job)
	return job, fmt.Errorf(msg)
}

func (s *MarketDataService) buildPlatformMatchMap() map[string]uint {
	type match struct {
		ListingID  string
		PropertyID uint
	}
	var matches []match
	config.DB.Raw(`
		SELECT listing_id, property_id
		FROM property_platforms
		WHERE platform = ? AND listing_id != ''
	`, models.Platform33m2).Scan(&matches)

	m := map[string]uint{}
	for _, v := range matches {
		m[v.ListingID] = v.PropertyID
	}
	return m
}

var regionRe = regexp.MustCompile(`(서울특별시\s+)?(\S+구)`)

func extractMarketRegion(address string) string {
	m := regionRe.FindStringSubmatch(address)
	if len(m) >= 3 {
		return m[2]
	}
	return ""
}

func parseNumber(s string) int {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	n, _ := strconv.Atoi(s)
	return n
}

func parsePeriod(raw string) (*time.Time, *time.Time) {
	// "2026.05.11(월) ~ 2026.05.24(일)"
	re := regexp.MustCompile(`(\d{4}\.\d{2}\.\d{2})`)
	matches := re.FindAllString(raw, 2)
	if len(matches) < 2 {
		return nil, nil
	}
	layout := "2006.01.02"
	start, err1 := time.Parse(layout, matches[0])
	end, err2 := time.Parse(layout, matches[1])
	if err1 != nil || err2 != nil {
		return nil, nil
	}
	return &start, &end
}

func getCol(record []string, colIdx map[string]int, key string) string {
	idx, ok := colIdx[key]
	if !ok || idx >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[idx])
}

func calcAvg(nums []int) int {
	if len(nums) == 0 {
		return 0
	}
	sum := 0
	for _, n := range nums {
		sum += n
	}
	return sum / len(nums)
}

func calcMedian(sorted []int) int {
	if len(sorted) == 0 {
		return 0
	}
	n := len(sorted)
	if n%2 == 0 {
		return (sorted[n/2-1] + sorted[n/2]) / 2
	}
	return sorted[n/2]
}

func calcPercentile(sorted []int, value int) float64 {
	if len(sorted) == 0 {
		return 0
	}
	count := 0
	for _, v := range sorted {
		if v <= value {
			count++
		}
	}
	return math.Round(float64(count) / float64(len(sorted)) * 100)
}

func findNearbyCompetitors(rooms []models.MarketPrice, ourPrice int, excludeID string, limit int) []NearbyCompetitor {
	type scored struct {
		room models.MarketPrice
		diff int
	}
	var candidates []scored
	for _, r := range rooms {
		if r.ExternalRoomID == excludeID || r.RentWeekly == 0 {
			continue
		}
		diff := ourPrice - r.RentWeekly
		if diff < 0 {
			diff = -diff
		}
		candidates = append(candidates, scored{room: r, diff: diff})
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].diff < candidates[j].diff })

	var result []NearbyCompetitor
	for i, c := range candidates {
		if i >= limit {
			break
		}
		result = append(result, NearbyCompetitor{
			RoomName:          c.room.RoomName,
			Address:           c.room.Address,
			RentWeekly:        c.room.RentWeekly,
			MaintenanceWeekly: c.room.MaintenanceWeekly,
			CleaningFee:       c.room.CleaningFee,
			Deposit:           c.room.Deposit,
		})
	}
	return result
}
