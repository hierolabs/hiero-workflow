package handler

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type GuestHandler struct{}

func NewGuestHandler() *GuestHandler { return &GuestHandler{} }

// GuestSummary — 게스트별 집계 결과
type GuestSummary struct {
	GuestName      string  `json:"guest_name"`
	GuestNameClean string  `json:"guest_name_clean"`
	AllNames       string  `json:"all_names"` // 동일인의 모든 이름
	GuestPhone   string  `json:"guest_phone"`
	GuestEmail   string  `json:"guest_email"`
	TotalVisits  int     `json:"total_visits"`
	TotalNights  int     `json:"total_nights"`
	TotalSpent   int64   `json:"total_spent"`
	FirstVisit   string  `json:"first_visit"`
	LastVisit    string  `json:"last_visit"`
	LastProperty string  `json:"last_property"`
	Channels     string  `json:"channels"`
	ChannelGroup string  `json:"channel_group"` // OTA글로벌 / 국내플랫폼 / 개인입금 / 복합
	Properties   string  `json:"properties"`
	AvgNights    float64 `json:"avg_nights"`
}

// ChannelGroupSummary — 채널 그룹별 집계
type ChannelGroupSummary struct {
	Group        string `json:"group"`
	GuestCount   int    `json:"guest_count"`
	Reservations int    `json:"reservations"`
	Nights       int    `json:"nights"`
	Revenue      int64  `json:"revenue"`
}

// ---- Union-Find ----
type uf struct {
	parent []int
	rank   []int
}

func newUF(n int) *uf {
	p := make([]int, n)
	r := make([]int, n)
	for i := range p {
		p[i] = i
	}
	return &uf{parent: p, rank: r}
}

func (u *uf) find(x int) int {
	for u.parent[x] != x {
		u.parent[x] = u.parent[u.parent[x]]
		x = u.parent[x]
	}
	return x
}

func (u *uf) union(a, b int) {
	ra, rb := u.find(a), u.find(b)
	if ra == rb {
		return
	}
	if u.rank[ra] < u.rank[rb] {
		ra, rb = rb, ra
	}
	u.parent[rb] = ra
	if u.rank[ra] == u.rank[rb] {
		u.rank[ra]++
	}
}

// ---- 채널 그룹 분류 ----
func classifyChannel(ch string) string {
	lower := strings.ToLower(ch)
	if strings.Contains(lower, "airbnb") || strings.Contains(lower, "booking") || strings.Contains(lower, "agoda") {
		return "OTA글로벌"
	}
	if strings.Contains(lower, "삼삼") || strings.Contains(lower, "33m2") ||
		strings.Contains(lower, "리브") || strings.Contains(lower, "liv") ||
		strings.Contains(lower, "자리톡") || strings.Contains(lower, "jaritalk") {
		return "국내플랫폼"
	}
	return "개인입금"
}

// reservationRow — DB에서 가져올 예약 행
type reservationRow struct {
	GuestName   string
	GuestPhone  string
	GuestEmail  string
	ChannelName string
	CheckInDate string
	Nights      int
	TotalRate   int64
	PropName    string
}

// fetchReservations — 필터 적용하여 예약 조회
func fetchReservations(search, channel, dateFrom, dateTo string) ([]reservationRow, error) {
	db := config.DB
	query := db.Table("reservations r").
		Select(`r.guest_name, r.guest_phone, r.guest_email, r.channel_name,
			r.check_in_date, r.nights, r.total_rate, COALESCE(p.display_name, p.name, '') as prop_name`).
		Joins("LEFT JOIN properties p ON r.internal_prop_id = p.id").
		Where("r.guest_name != '' AND r.status != 'cancelled'")

	if dateFrom != "" {
		query = query.Where("r.check_in_date >= ?", dateFrom)
	}
	if dateTo != "" {
		query = query.Where("r.check_in_date <= ?", dateTo)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("r.guest_name LIKE ? OR r.guest_phone LIKE ? OR r.guest_email LIKE ?", like, like, like)
	}
	if channel != "" {
		query = query.Where("r.channel_name = ?", channel)
	}

	var rows []reservationRow
	err := query.Order("r.check_in_date ASC").Find(&rows).Error
	return rows, err
}

// buildGuestSummaries — Union-Find로 동일인 합산
func buildGuestSummaries(rows []reservationRow) []GuestSummary {
	if len(rows) == 0 {
		return nil
	}

	// 1. 각 예약에 인덱스 부여, Union-Find 초기화
	u := newUF(len(rows))

	// name → 첫 인덱스, phone → 첫 인덱스
	nameIdx := map[string]int{}
	phoneIdx := map[string]int{}

	for i, r := range rows {
		name := strings.TrimSpace(r.GuestName)
		phone := strings.TrimSpace(r.GuestPhone)

		// 이름으로 연결
		if name != "" {
			if prev, ok := nameIdx[name]; ok {
				u.union(prev, i)
			} else {
				nameIdx[name] = i
			}
		}
		// 연락처로 연결
		if phone != "" {
			if prev, ok := phoneIdx[phone]; ok {
				u.union(prev, i)
			} else {
				phoneIdx[phone] = i
			}
		}
	}

	// 2. 그룹별 집계
	type group struct {
		names      map[string]bool
		phones     map[string]bool
		emails     map[string]bool
		channels   map[string]bool
		properties map[string]bool
		visits     int
		nights     int
		spent      int64
		firstVisit string
		lastVisit  string
		lastProp   string
	}

	groups := map[int]*group{}
	for i, r := range rows {
		root := u.find(i)
		g, ok := groups[root]
		if !ok {
			g = &group{
				names: map[string]bool{}, phones: map[string]bool{},
				emails: map[string]bool{}, channels: map[string]bool{},
				properties: map[string]bool{},
			}
			groups[root] = g
		}

		if r.GuestName != "" {
			g.names[r.GuestName] = true
		}
		if r.GuestPhone != "" {
			g.phones[r.GuestPhone] = true
		}
		if r.GuestEmail != "" {
			g.emails[r.GuestEmail] = true
		}
		if r.ChannelName != "" {
			g.channels[r.ChannelName] = true
		}
		if r.PropName != "" {
			g.properties[r.PropName] = true
		}

		g.visits++
		g.nights += r.Nights
		g.spent += r.TotalRate

		if g.firstVisit == "" || r.CheckInDate < g.firstVisit {
			g.firstVisit = r.CheckInDate
		}
		if r.CheckInDate > g.lastVisit {
			g.lastVisit = r.CheckInDate
			g.lastProp = r.PropName
		}
	}

	// 3. GuestSummary 변환
	result := make([]GuestSummary, 0, len(groups))
	for _, g := range groups {
		names := setToSorted(g.names)
		phones := setToSorted(g.phones)
		emails := setToSorted(g.emails)
		channels := setToSorted(g.channels)
		props := setToSorted(g.properties)

		// 채널 그룹 판별
		chGroups := map[string]bool{}
		for ch := range g.channels {
			chGroups[classifyChannel(ch)] = true
		}
		channelGroup := ""
		if len(chGroups) > 1 {
			channelGroup = "복합"
		} else {
			for cg := range chGroups {
				channelGroup = cg
			}
		}

		avgNights := float64(0)
		if g.visits > 0 {
			avgNights = float64(g.nights) / float64(g.visits)
		}

		primaryName := names[0]
		if len(names) > 1 {
			// 가장 긴 이름을 대표명으로
			for _, n := range names {
				if len(n) > len(primaryName) {
					primaryName = n
				}
			}
		}

		result = append(result, GuestSummary{
			GuestName:      primaryName,
			GuestNameClean: models.MakeCleanName(primaryName),
			AllNames:       strings.Join(names, ", "),
			GuestPhone:   strings.Join(phones, ", "),
			GuestEmail:   strings.Join(emails, ", "),
			TotalVisits:  g.visits,
			TotalNights:  g.nights,
			TotalSpent:   g.spent,
			FirstVisit:   g.firstVisit,
			LastVisit:    g.lastVisit,
			LastProperty: g.lastProp,
			Channels:     strings.Join(channels, ", "),
			ChannelGroup: channelGroup,
			Properties:   strings.Join(props, ", "),
			AvgNights:    avgNights,
		})
	}

	return result
}

func setToSorted(m map[string]bool) []string {
	s := make([]string, 0, len(m))
	for k := range m {
		if k != "" {
			s = append(s, k)
		}
	}
	sort.Strings(s)
	return s
}

// sortGuests — 정렬 적용
func sortGuests(guests []GuestSummary, sortBy, order string) {
	less := func(i, j int) bool {
		switch sortBy {
		case "total_visits":
			return guests[i].TotalVisits < guests[j].TotalVisits
		case "total_spent":
			return guests[i].TotalSpent < guests[j].TotalSpent
		case "total_nights":
			return guests[i].TotalNights < guests[j].TotalNights
		case "guest_name":
			return guests[i].GuestName < guests[j].GuestName
		default: // last_visit
			return guests[i].LastVisit < guests[j].LastVisit
		}
	}
	if order == "desc" {
		sort.Slice(guests, func(i, j int) bool { return !less(i, j) })
	} else {
		sort.Slice(guests, less)
	}
}

// List — 전체 게스트 리스트 (Union-Find 기반 동일인 합산)
func (h *GuestHandler) List(c *gin.Context) {
	rows, err := fetchReservations(c.Query("search"), c.Query("channel"), c.Query("from"), c.Query("to"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	guests := buildGuestSummaries(rows)
	sortGuests(guests, c.DefaultQuery("sort", "last_visit"), c.DefaultQuery("order", "desc"))

	// 채널 목록 (필터용)
	var channelList []string
	config.DB.Model(&models.Reservation{}).
		Where("channel_name != '' AND status != 'cancelled'").
		Distinct("channel_name").
		Pluck("channel_name", &channelList)

	// 통계
	totalGuests := len(guests)
	repeatGuests := 0
	var totalRevenue int64
	for _, g := range guests {
		totalRevenue += g.TotalSpent
		if g.TotalVisits > 1 {
			repeatGuests++
		}
	}

	// 채널 그룹별 집계
	cgMap := map[string]*ChannelGroupSummary{}
	for _, g := range guests {
		cg := g.ChannelGroup
		if cg == "" {
			cg = "기타"
		}
		s, ok := cgMap[cg]
		if !ok {
			s = &ChannelGroupSummary{Group: cg}
			cgMap[cg] = s
		}
		s.GuestCount++
		s.Reservations += g.TotalVisits
		s.Nights += g.TotalNights
		s.Revenue += g.TotalSpent
	}
	channelGroups := make([]ChannelGroupSummary, 0, len(cgMap))
	for _, s := range cgMap {
		channelGroups = append(channelGroups, *s)
	}
	sort.Slice(channelGroups, func(i, j int) bool {
		return channelGroups[i].Revenue > channelGroups[j].Revenue
	})

	c.JSON(http.StatusOK, gin.H{
		"guests":         guests,
		"channels":       channelList,
		"channel_groups": channelGroups,
		"stats": gin.H{
			"total_guests":       totalGuests,
			"total_reservations": len(rows),
			"total_revenue":      totalRevenue,
			"repeat_guests":      repeatGuests,
		},
	})
}

// ExportCSV — 게스트 데이터 CSV 다운로드
func (h *GuestHandler) ExportCSV(c *gin.Context) {
	rows, err := fetchReservations(c.Query("search"), c.Query("channel"), c.Query("from"), c.Query("to"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	guests := buildGuestSummaries(rows)
	sortGuests(guests, "last_visit", "desc")

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=guests.csv")
	c.Writer.Write([]byte("\xEF\xBB\xBF"))

	c.Writer.WriteString("게스트명,사용한 이름들,전화번호,이메일,채널그룹,채널,방문횟수,총숙박일,총매출,첫방문,최근방문,숙소\n")
	for _, g := range guests {
		line := fmt.Sprintf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%d,%d,%d,\"%s\",\"%s\",\"%s\"\n",
			g.GuestName, g.AllNames, g.GuestPhone, g.GuestEmail,
			g.ChannelGroup, g.Channels,
			g.TotalVisits, g.TotalNights, g.TotalSpent,
			g.FirstVisit, g.LastVisit, g.Properties)
		c.Writer.WriteString(line)
	}
}

// 국적 분류 SQL CASE (전화번호 기반 + 오입력 보정)
const nationalitySQL = `CASE
	WHEN guest_phone LIKE '+82%' OR guest_phone LIKE '82 %' THEN '한국'
	WHEN guest_phone LIKE '+1 010%' OR guest_phone LIKE '+1 01%' OR guest_phone LIKE '+1 +%' THEN '한국'
	WHEN guest_phone LIKE '+1 10%' AND LENGTH(REPLACE(guest_phone,' ','')) <= 14 THEN '한국'
	WHEN guest_phone LIKE '010%' THEN '한국'
	WHEN guest_phone = '' OR guest_phone IS NULL THEN
		CASE WHEN guest_name REGEXP '[가-힣]' THEN '한국(추정)' ELSE '외국(추정)' END
	WHEN guest_phone LIKE '+86%' THEN '중국'
	WHEN guest_phone LIKE '+886%' THEN '대만'
	WHEN guest_phone LIKE '+81%' OR guest_phone LIKE '81 %' THEN '일본'
	WHEN guest_phone LIKE '+1%' THEN '미국/캐나다'
	WHEN guest_phone LIKE '+62%' THEN '인도네시아'
	WHEN guest_phone LIKE '+61%' THEN '호주'
	WHEN guest_phone LIKE '+44%' THEN '영국'
	WHEN guest_phone LIKE '+7 %' THEN '러시아'
	WHEN guest_phone LIKE '+33%' THEN '프랑스'
	WHEN guest_phone LIKE '+49%' THEN '독일'
	WHEN guest_phone LIKE '+65%' THEN '싱가포르'
	WHEN guest_phone LIKE '+60%' THEN '말레이시아'
	WHEN guest_phone LIKE '+66%' THEN '태국'
	WHEN guest_phone LIKE '+84%' THEN '베트남'
	WHEN guest_phone LIKE '+%' THEN '기타외국'
	ELSE '판단불가'
END`

// 내/외국인 대분류 SQL CASE
const domesticSQL = `CASE
	WHEN guest_phone LIKE '+82%' OR guest_phone LIKE '82 %' THEN '내국인'
	WHEN guest_phone LIKE '+1 010%' OR guest_phone LIKE '+1 01%' OR guest_phone LIKE '+1 +%' THEN '내국인'
	WHEN guest_phone LIKE '+1 10%' AND LENGTH(REPLACE(guest_phone,' ','')) <= 14 THEN '내국인'
	WHEN guest_phone LIKE '010%' THEN '내국인'
	WHEN guest_phone = '' OR guest_phone IS NULL THEN
		CASE WHEN guest_name REGEXP '[가-힣]' THEN '내국인' ELSE '외국인' END
	WHEN guest_phone LIKE '+%' THEN '외국인'
	ELSE '내국인'
END`

// 채널그룹 SQL CASE
const channelGroupSQL = `CASE
	WHEN channel_name IN ('Airbnb','에어비앤비','Agoda','Booking.com') THEN 'OTA글로벌'
	WHEN channel_name IN ('삼삼엠투','리브','자리톡') THEN '국내플랫폼'
	ELSE '개인입금'
END`

// 시즌 SQL CASE
const seasonSQL = `CASE WHEN LEFT(check_in_date, 4) = '2026' THEN '시즌2(2026)' ELSE '시즌1(2025)' END`

// 숙박기간 SQL CASE
const stayRangeSQL = `CASE
	WHEN nights <= 2 THEN '1~2박'
	WHEN nights <= 6 THEN '3~6박'
	WHEN nights <= 13 THEN '7~13박'
	WHEN nights <= 29 THEN '14~29박'
	ELSE '30박+'
END`

// 숙박기간 정렬 SQL CASE
const stayRangeOrderSQL = `CASE
	WHEN nights <= 2 THEN 1
	WHEN nights <= 6 THEN 2
	WHEN nights <= 13 THEN 3
	WHEN nights <= 29 THEN 4
	ELSE 5
END`

// Analytics — 다축 교차 분석 (row/col 필드 선택 가능)
func (h *GuestHandler) Analytics(c *gin.Context) {
	db := config.DB

	// 사용 가능한 축 (dimension)
	dimSQL := map[string]string{
		"channel_group": channelGroupSQL,
		"channel":       "channel_name",
		"season":        seasonSQL,
		"domestic":      domesticSQL,      // 내/외국인 (2분류)
		"nationality":   nationalitySQL,   // 국적 상세 (20개국)
		"stay_range":    stayRangeSQL,
		"handler":       "channel_name",
	}

	// 파라미터에서 row/col 축 선택
	rowDim := c.DefaultQuery("row", "channel_group")
	colDim := c.DefaultQuery("col", "nationality")
	dateFrom := c.Query("from")
	dateTo := c.Query("to")

	rowSQL, rok := dimSQL[rowDim]
	colSQL, cok := dimSQL[colDim]
	if !rok {
		rowSQL = channelGroupSQL
		rowDim = "channel_group"
	}
	if !cok {
		colSQL = nationalitySQL
		colDim = "nationality"
	}

	// 공통 WHERE 절 (기간 포함)
	baseWhere := "guest_name != '' AND status != 'cancelled'"
	whereArgs := []interface{}{}
	if dateFrom != "" {
		baseWhere += " AND check_in_date >= ?"
		whereArgs = append(whereArgs, dateFrom)
	}
	if dateTo != "" {
		baseWhere += " AND check_in_date <= ?"
		whereArgs = append(whereArgs, dateTo)
	}

	// 1. 메인 교차 테이블
	type pivotRow struct {
		RowKey  string  `json:"row_key"`
		ColKey  string  `json:"col_key"`
		Cnt     int     `json:"cnt"`
		Revenue int64   `json:"revenue"`
		Nights  int     `json:"nights"`
		AvgN    float64 `json:"avg_nights"`
		Guests  int     `json:"guests"`
	}
	var pivotData []pivotRow

	orderBy := "cnt DESC"
	if rowDim == "stay_range" {
		orderBy = stayRangeOrderSQL
	}

	q := fmt.Sprintf(`
		SELECT
			%s as row_key,
			%s as col_key,
			COUNT(*) as cnt,
			SUM(total_rate) as revenue,
			SUM(nights) as nights,
			ROUND(AVG(nights), 1) as avg_n,
			COUNT(DISTINCT COALESCE(NULLIF(guest_phone, ''), guest_name)) as guests
		FROM reservations
		WHERE %s
		GROUP BY row_key, col_key
		ORDER BY %s
	`, rowSQL, colSQL, baseWhere, orderBy)
	db.Raw(q, whereArgs...).Scan(&pivotData)

	// 2. 행 합계
	type totalRow struct {
		Key     string  `json:"key"`
		Cnt     int     `json:"cnt"`
		Revenue int64   `json:"revenue"`
		Nights  int     `json:"nights"`
		AvgN    float64 `json:"avg_nights"`
		Guests  int     `json:"guests"`
	}
	var rowTotals []totalRow
	q2 := fmt.Sprintf(`
		SELECT %s as `+"`key`"+`,
			COUNT(*) as cnt, SUM(total_rate) as revenue, SUM(nights) as nights,
			ROUND(AVG(nights), 1) as avg_n,
			COUNT(DISTINCT COALESCE(NULLIF(guest_phone, ''), guest_name)) as guests
		FROM reservations WHERE %s
		GROUP BY `+"`key`"+` ORDER BY revenue DESC
	`, rowSQL, baseWhere)
	db.Raw(q2, whereArgs...).Scan(&rowTotals)

	var colTotals []totalRow
	q3 := fmt.Sprintf(`
		SELECT %s as `+"`key`"+`,
			COUNT(*) as cnt, SUM(total_rate) as revenue, SUM(nights) as nights,
			ROUND(AVG(nights), 1) as avg_n,
			COUNT(DISTINCT COALESCE(NULLIF(guest_phone, ''), guest_name)) as guests
		FROM reservations WHERE %s
		GROUP BY `+"`key`"+` ORDER BY revenue DESC
	`, colSQL, baseWhere)
	db.Raw(q3, whereArgs...).Scan(&colTotals)

	// 3. 채널 전환 게스트
	var crossChannelGuests int64
	var crossChannelBookings int64
	db.Raw(fmt.Sprintf(`
		SELECT COUNT(*), SUM(visits) FROM (
			SELECT COALESCE(NULLIF(guest_phone, ''), guest_name) as gk, COUNT(*) as visits,
				COUNT(DISTINCT CASE
					WHEN channel_name IN ('Airbnb','에어비앤비','Agoda','Booking.com') THEN 'OTA'
					WHEN channel_name IN ('삼삼엠투','리브','자리톡') THEN '국내'
					ELSE '개인'
				END) as gc
			FROM reservations WHERE %s
			GROUP BY gk HAVING gc > 1
		) t
	`, baseWhere), whereArgs...).Row().Scan(&crossChannelGuests, &crossChannelBookings)

	// 4. 전체 합계
	var grandTotal struct {
		Cnt     int   `json:"cnt"`
		Revenue int64 `json:"revenue"`
		Nights  int   `json:"nights"`
		Guests  int   `json:"guests"`
	}
	db.Raw(fmt.Sprintf(`
		SELECT COUNT(*) as cnt, SUM(total_rate) as revenue, SUM(nights) as nights,
			COUNT(DISTINCT COALESCE(NULLIF(guest_phone, ''), guest_name)) as guests
		FROM reservations WHERE %s
	`, baseWhere), whereArgs...).Scan(&grandTotal)

	c.JSON(http.StatusOK, gin.H{
		"row_dim":    rowDim,
		"col_dim":    colDim,
		"pivot":      pivotData,
		"row_totals": rowTotals,
		"col_totals": colTotals,
		"grand_total": grandTotal,
		"cross_channel_guests":   crossChannelGuests,
		"cross_channel_bookings": crossChannelBookings,
		"available_dimensions": []string{"channel_group", "channel", "season", "domestic", "nationality", "stay_range", "handler"},
	})
}

// Detail — 특정 게스트의 전체 예약 이력 (이름 OR 연락처 매칭)
func (h *GuestHandler) Detail(c *gin.Context) {
	name := c.Param("name")
	db := config.DB

	// 이름으로 검색 + 해당 게스트의 연락처로도 검색 (동일인 합산)
	var phones []string
	db.Model(&models.Reservation{}).
		Where("guest_name = ? AND guest_phone != ''", name).
		Distinct("guest_phone").
		Pluck("guest_phone", &phones)

	query := db.Where("guest_name = ?", name)
	if len(phones) > 0 {
		query = db.Where("guest_name = ? OR guest_phone IN ?", name, phones)
	}

	var reservations []models.Reservation
	query.Order("check_in_date DESC").Find(&reservations)

	for i, r := range reservations {
		if r.InternalPropID != nil {
			var prop models.Property
			if db.First(&prop, *r.InternalPropID).Error == nil {
				name := prop.DisplayName
				if name == "" {
					name = prop.Name
				}
				reservations[i].PropertyName = name
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"guest_name":   name,
		"reservations": reservations,
	})
}
