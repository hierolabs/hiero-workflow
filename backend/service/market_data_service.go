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
			PropertyName:       prop.Name,
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
