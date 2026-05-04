package hostex

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const baseURL = "https://api.hostex.io/v3"

type Client struct {
	token      string
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		token: os.Getenv("HOSTEX_API_TOKEN"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) request(method, path string, params map[string]string) ([]byte, error) {
	req, err := http.NewRequest(method, baseURL+path, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Hostex-Access-Token", c.token)

	if params != nil {
		q := req.URL.Query()
		for k, v := range params {
			q.Add(k, v)
		}
		req.URL.RawQuery = q.Encode()
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[Hostex] %s %s → %d (%d bytes, token_len: %d)", method, path, resp.StatusCode, len(body), len(c.token))

	if len(body) == 0 {
		return nil, fmt.Errorf("호스텍스에서 빈 응답 (HTTP %d)", resp.StatusCode)
	}

	return body, nil
}

func (c *Client) requestWithBody(method, path string, bodyData interface{}) ([]byte, error) {
	jsonBody, err := json.Marshal(bodyData)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(method, baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Hostex-Access-Token", c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[Hostex] %s %s → %d (%d bytes)", method, path, resp.StatusCode, len(body))

	return body, nil
}

// --- 응답 구조체 ---

type APIResponse struct {
	RequestID string          `json:"request_id"`
	ErrorCode int             `json:"error_code"`
	ErrorMsg  string          `json:"error_msg"`
	Data      json.RawMessage `json:"data"`
}

type Property struct {
	ID                 int64            `json:"id"`
	Title              string           `json:"title"`
	Address            string           `json:"address"`
	Longitude          json.Number      `json:"longitude"`
	Latitude           json.Number      `json:"latitude"`
	Channels           []Channel        `json:"channels"`
	Groups             []Group          `json:"groups"`
	Tags               []Tag            `json:"tags"`
	Cover              *Cover           `json:"cover"`
	DefaultCheckinTime string           `json:"default_checkin_time"`
	DefaultCheckoutTime string          `json:"default_checkout_time"`
	Timezone           string           `json:"timezone"`
	WifiSSID           string           `json:"wifi_ssid"`
	WifiPassword       string           `json:"wifi_password"`
}

type Channel struct {
	ChannelType string `json:"channel_type"`
	ListingID   string `json:"listing_id"`
	Currency    string `json:"currency"`
}

type Group struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Tag struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type Cover struct {
	OriginalURL string `json:"original_url"`
	SmallURL    string `json:"small_url"`
	MediumURL   string `json:"medium_url"`
}

type Reservation struct {
	ReservationCode string          `json:"reservation_code"`
	PropertyID      int64           `json:"property_id"`
	ChannelType     string          `json:"channel_type"`
	ListingID       string          `json:"listing_id"`
	CheckInDate     string          `json:"check_in_date"`
	CheckOutDate    string          `json:"check_out_date"`
	NumberOfGuests  int             `json:"number_of_guests"`
	Status          string          `json:"status"`
	StayStatus      string          `json:"stay_status"`
	GuestName       string          `json:"guest_name"`
	GuestPhone      string          `json:"guest_phone"`
	GuestEmail      string          `json:"guest_email"`
	BookedAt        string          `json:"booked_at"`
	CreatedAt       string          `json:"created_at"` // Hostex 예약 최초 생성 시점 (진짜 예약일)
	CancelledAt     *string         `json:"cancelled_at"`
	Remarks         string           `json:"remarks"`
	ConversationID  string           `json:"conversation_id"`
	Rates           *ReservationRate `json:"rates"`
	CustomChannel   *CustomChannel   `json:"custom_channel"`
	Tags            json.RawMessage  `json:"tags"`
}

type ReservationRate struct {
	TotalRate      Money `json:"total_rate"`
	TotalCommission Money `json:"total_commission"`
}

type Money struct {
	Currency string  `json:"currency"`
	Amount   float64 `json:"amount"`
}

type CustomChannel struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// --- API 메서드 ---

func (c *Client) GetProperties(limit, offset int) ([]Property, int, error) {
	body, err := c.request("GET", "/properties", map[string]string{
		"limit":  fmt.Sprintf("%d", limit),
		"offset": fmt.Sprintf("%d", offset),
	})
	if err != nil {
		return nil, 0, err
	}

	var resp APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, 0, err
	}

	var data struct {
		Properties []Property `json:"properties"`
		Total      int        `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, 0, err
	}

	return data.Properties, data.Total, nil
}

func (c *Client) GetReservations(params map[string]string) ([]Reservation, error) {
	body, err := c.request("GET", "/reservations", params)
	if err != nil {
		return nil, err
	}

	var resp APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	var data struct {
		Reservations []Reservation `json:"reservations"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, err
	}

	return data.Reservations, nil
}

func (c *Client) GetTodayReservations() (checkIns []Reservation, checkOuts []Reservation, inHouse []Reservation, err error) {
	today := time.Now().Format("2006-01-02")

	// 오늘 체크인
	checkIns, err = c.GetReservations(map[string]string{
		"start_check_in_date": today,
		"end_check_in_date":   today,
		"status":              "accepted",
		"limit":               "100",
	})
	if err != nil {
		return
	}

	// 오늘 체크아웃
	checkOuts, err = c.GetReservations(map[string]string{
		"start_check_out_date": today,
		"end_check_out_date":   today,
		"status":               "accepted",
		"limit":                "100",
	})
	if err != nil {
		return
	}

	// 현재 투숙 중: 최근 30일 내 체크인 + 체크아웃이 내일~30일 이후
	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")
	tomorrow := time.Now().Add(24 * time.Hour).Format("2006-01-02")
	thirtyDaysLater := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")
	allReservations, err := c.GetReservations(map[string]string{
		"start_check_in_date":   thirtyDaysAgo,
		"end_check_in_date":     today,
		"start_check_out_date":  tomorrow,
		"end_check_out_date":    thirtyDaysLater,
		"status":                "accepted",
		"limit":                 "100",
	})
	if err != nil {
		return
	}

	inHouse = allReservations

	return
}

// GetAllProperties - 전체 숙소를 페이징으로 가져오기
func (c *Client) GetAllProperties() ([]Property, error) {
	var all []Property
	offset := 0
	for {
		props, total, err := c.GetProperties(100, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, props...)
		if len(all) >= total || len(props) == 0 {
			break
		}
		offset += len(props)
	}
	return all, nil
}

// GetCEODashboard - 의사결정용 대시보드 데이터
func (c *Client) GetCEODashboard() (map[string]interface{}, error) {
	today := time.Now().Format("2006-01-02")
	tomorrow := time.Now().Add(24 * time.Hour).Format("2006-01-02")
	threeDaysLater := time.Now().Add(3 * 24 * time.Hour).Format("2006-01-02")
	sevenDaysLater := time.Now().Add(7 * 24 * time.Hour).Format("2006-01-02")
	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour).Format("2006-01-02")
	thirtyDaysLater := time.Now().Add(30 * 24 * time.Hour).Format("2006-01-02")

	// 1. 오늘 체크인 예약 (매출 계산용)
	checkIns, err := c.GetReservations(map[string]string{
		"start_check_in_date": today,
		"end_check_in_date":   today,
		"status":              "accepted",
		"limit":               "100",
	})
	if err != nil {
		return nil, err
	}

	// 2. 오늘 체크아웃
	checkOuts, err := c.GetReservations(map[string]string{
		"start_check_out_date": today,
		"end_check_out_date":   today,
		"status":               "accepted",
		"limit":                "100",
	})
	if err != nil {
		return nil, err
	}

	// 3. 현재 투숙 중
	inHouse, err := c.GetReservations(map[string]string{
		"start_check_in_date":  thirtyDaysAgo,
		"end_check_in_date":    today,
		"start_check_out_date": tomorrow,
		"end_check_out_date":   thirtyDaysLater,
		"status":               "accepted",
		"limit":                "100",
	})
	if err != nil {
		return nil, err
	}

	// 4. 오늘 신규 예약 (booked_at 기준으로 필터)
	recentBookings, err := c.GetReservations(map[string]string{
		"start_check_in_date": today,
		"end_check_in_date":   thirtyDaysLater,
		"status":              "accepted",
		"limit":               "100",
		"order_by":            "booked_at",
	})
	if err != nil {
		return nil, err
	}

	todayBookings := []Reservation{}
	for _, r := range recentBookings {
		if len(r.BookedAt) >= 10 && r.BookedAt[:10] == today {
			todayBookings = append(todayBookings, r)
		}
	}

	// 5. 내일~3일 예약 (공실 계산용)
	upcoming3d, err := c.GetReservations(map[string]string{
		"start_check_in_date": tomorrow,
		"end_check_in_date":   threeDaysLater,
		"status":              "accepted",
		"limit":               "100",
	})
	if err != nil {
		return nil, err
	}

	// 6. 7일 예약 (성장 지표)
	upcoming7d, err := c.GetReservations(map[string]string{
		"start_check_in_date": tomorrow,
		"end_check_in_date":   sevenDaysLater,
		"status":              "accepted",
		"limit":               "100",
	})
	if err != nil {
		return nil, err
	}

	// 7. 전체 숙소
	properties, err := c.GetAllProperties()
	if err != nil {
		return nil, err
	}

	// --- 계산 ---

	// 숙소별 마지막 체크아웃 날짜 계산 (공실 일수용)
	// 최근 60일 체크아웃 데이터
	sixtyDaysAgo := time.Now().Add(-60 * 24 * time.Hour).Format("2006-01-02")
	recentCheckouts, _ := c.GetReservations(map[string]string{
		"start_check_out_date": sixtyDaysAgo,
		"end_check_out_date":   today,
		"status":               "accepted",
		"limit":                "100",
	})

	lastCheckout := map[int64]string{} // propertyID -> 마지막 체크아웃 날짜
	for _, r := range recentCheckouts {
		if existing, ok := lastCheckout[r.PropertyID]; !ok || r.CheckOutDate > existing {
			lastCheckout[r.PropertyID] = r.CheckOutDate
		}
	}

	// 💰 매출 계산
	var todayRevenue, todayCommission int64
	for _, r := range checkIns {
		if r.Rates != nil {
			todayRevenue += int64(r.Rates.TotalRate.Amount)
			todayCommission += int64(r.Rates.TotalCommission.Amount)
		}
	}

	var inHouseRevenue int64
	for _, r := range inHouse {
		if r.Rates != nil {
			nights := dateDiffDays(r.CheckInDate, r.CheckOutDate)
			if nights > 0 {
				inHouseRevenue += int64(r.Rates.TotalRate.Amount) / int64(nights)
			}
		}
	}

	// 숙소별 점유 상태 (오늘 + 3일)
	occupiedToday := map[int64]bool{}
	occupied3d := map[int64]bool{}
	for _, r := range inHouse {
		occupiedToday[r.PropertyID] = true
		occupied3d[r.PropertyID] = true
	}
	for _, r := range checkIns {
		occupiedToday[r.PropertyID] = true
		occupied3d[r.PropertyID] = true
	}
	for _, r := range upcoming3d {
		occupied3d[r.PropertyID] = true
	}

	// 숙소별 ADR 계산
	propertyADR := map[int64]int64{}
	for _, r := range inHouse {
		if r.Rates != nil {
			nights := dateDiffDays(r.CheckInDate, r.CheckOutDate)
			if nights > 0 {
				propertyADR[r.PropertyID] = int64(r.Rates.TotalRate.Amount) / int64(nights)
			}
		}
	}

	// 채널별 ADR
	channelADRSum := map[string]int64{}
	channelADRCount := map[string]int{}
	for _, r := range inHouse {
		if r.Rates != nil {
			ch := r.ChannelType
			if r.CustomChannel != nil && r.CustomChannel.Name != "" {
				ch = r.CustomChannel.Name
			}
			nights := dateDiffDays(r.CheckInDate, r.CheckOutDate)
			if nights > 0 {
				adr := int64(r.Rates.TotalRate.Amount) / int64(nights)
				channelADRSum[ch] += adr
				channelADRCount[ch]++
			}
		}
	}

	// 🔴 리스크: 공실 분석 (며칠 공실 + 위험도 정렬)
	type VacantProperty struct {
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		VacantDays int   `json:"vacant_days"`
		Severity   string `json:"severity"` // critical, warning, info
		Action     string `json:"action"`
	}

	var vacantProperties []VacantProperty
	var vacantCritical, vacantWarning int
	for _, p := range properties {
		if !occupiedToday[p.ID] {
			vacantDays := 1
			if lc, ok := lastCheckout[p.ID]; ok {
				vacantDays = dateDiffDays(lc, today)
				if vacantDays < 1 {
					vacantDays = 1
				}
			} else {
				vacantDays = 30 // 최근 60일 내 체크아웃 기록 없으면 장기 공실
			}

			severity := "info"
			action := "모니터링"
			if vacantDays >= 7 {
				severity = "critical"
				action = "즉시 가격 인하 필요"
				vacantCritical++
			} else if vacantDays >= 3 {
				severity = "warning"
				action = "가격 조정 검토"
				vacantWarning++
			}

			vacantProperties = append(vacantProperties, VacantProperty{
				ID:         p.ID,
				Title:      p.Title,
				VacantDays: vacantDays,
				Severity:   severity,
				Action:     action,
			})
		}
	}

	// 공실 위험도 순 정렬 (critical > warning > info)
	for i := 0; i < len(vacantProperties); i++ {
		for j := i + 1; j < len(vacantProperties); j++ {
			if vacantProperties[j].VacantDays > vacantProperties[i].VacantDays {
				vacantProperties[i], vacantProperties[j] = vacantProperties[j], vacantProperties[i]
			}
		}
	}

	// 📈 성장: 채널별 신규 예약
	channelCount := map[string]int{}
	channelRevenue := map[string]int64{}
	for _, r := range todayBookings {
		ch := r.ChannelType
		if r.CustomChannel != nil && r.CustomChannel.Name != "" {
			ch = r.CustomChannel.Name
		}
		channelCount[ch]++
		if r.Rates != nil {
			channelRevenue[ch] += int64(r.Rates.TotalRate.Amount)
		}
	}

	channels := []map[string]interface{}{}
	for ch, cnt := range channelCount {
		channels = append(channels, map[string]interface{}{
			"channel": ch,
			"count":   cnt,
			"revenue": channelRevenue[ch],
		})
	}

	// ADR 계산
	var totalADR int64
	adrCount := 0
	for _, r := range inHouse {
		if r.Rates != nil {
			nights := dateDiffDays(r.CheckInDate, r.CheckOutDate)
			if nights > 0 {
				totalADR += int64(r.Rates.TotalRate.Amount) / int64(nights)
				adrCount++
			}
		}
	}
	avgADR := int64(0)
	if adrCount > 0 {
		avgADR = totalADR / int64(adrCount)
	}

	occupancyRate := float64(0)
	if len(properties) > 0 {
		occupancyRate = float64(len(inHouse)) / float64(len(properties)) * 100
	}

	// 가격 분석
	channelPricing := []map[string]interface{}{}
	for ch, sum := range channelADRSum {
		cnt := channelADRCount[ch]
		if cnt > 0 {
			channelPricing = append(channelPricing, map[string]interface{}{
				"channel":  ch,
				"avg_adr":  sum / int64(cnt),
				"count":    cnt,
				"diff_pct": fmt.Sprintf("%.1f", float64(sum/int64(cnt)-avgADR)/float64(avgADR)*100),
			})
		}
	}

	// 🔥 오늘 해야 할 액션 자동 생성
	targetOccupancy := 82.0
	targetADR := int64(120000)

	actions := []map[string]interface{}{}

	// 공실 숙소 ID 목록
	vacantPropertyIDs := []int64{}
	for _, vp := range vacantProperties {
		vacantPropertyIDs = append(vacantPropertyIDs, vp.ID)
	}

	// 숙소 ID → 이름 맵
	propTitleMap := map[int64]string{}
	for _, p := range properties {
		propTitleMap[p.ID] = p.Title
	}

	// 체크아웃 숙소 ID 목록
	checkOutPropertyIDs := []int64{}
	for _, r := range checkOuts {
		checkOutPropertyIDs = append(checkOutPropertyIDs, r.PropertyID)
	}

	// 체크인 숙소 ID 목록
	checkInPropertyIDs := []int64{}
	checkInNames := []string{}
	for _, r := range checkIns {
		checkInPropertyIDs = append(checkInPropertyIDs, r.PropertyID)
		if title, ok := propTitleMap[r.PropertyID]; ok {
			checkInNames = append(checkInNames, title)
		} else {
			checkInNames = append(checkInNames, fmt.Sprintf("#%d", r.PropertyID))
		}
	}

	// 액션 1: 공실 위험
	if vacantCritical > 0 {
		vacantDesc := fmt.Sprintf("7일 이상 공실 %d개, 3일 이상 %d개.\n", vacantCritical, vacantWarning)
		for _, vp := range vacantProperties {
			if vp.Severity == "critical" {
				vacantDesc += fmt.Sprintf("- %s (%d일 공실)\n", vp.Title, vp.VacantDays)
			}
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "risk",
			"title":    fmt.Sprintf("장기 공실 %d개 — 즉시 가격 인하 필요", vacantCritical),
			"detail":   fmt.Sprintf("7일 이상 공실 %d개, 3일 이상 %d개. 일 손실 추정 ₩%s", vacantCritical, vacantWarning, formatAmount(int64(vacantCritical)*avgADR)),
			"action":   "공실 숙소 가격 10~20% 인하 적용",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P0",
				"title":       fmt.Sprintf("장기 공실 %d개 — 즉시 가격 인하 필요", vacantCritical),
				"description": vacantDesc,
			},
			"property_ids": vacantPropertyIDs,
		})
	}

	// 액션 2: 가동률 목표 미달
	if occupancyRate < targetOccupancy {
		gap := targetOccupancy - occupancyRate
		lostRevenue := int64(gap / 100 * float64(len(properties)) * float64(avgADR))
		actions = append(actions, map[string]interface{}{
			"priority": "P1",
			"type":     "occupancy",
			"title":    fmt.Sprintf("가동률 %.1f%% — 목표 %.0f%% 대비 -%.1f%%p", occupancyRate, targetOccupancy, gap),
			"detail":   fmt.Sprintf("일 손실 추정 ₩%s", formatAmount(lostRevenue)),
			"action":   "공실 숙소 프로모션 또는 가격 조정",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P1",
				"title":       fmt.Sprintf("가동률 %.1f%% — 목표 대비 -%.1f%%p, 가격 조정 검토", occupancyRate, gap),
				"description": fmt.Sprintf("현재 가동률 %.1f%%, 목표 %.0f%%. 일 손실 추정 ₩%s. 공실 숙소 프로모션 또는 가격 조정 필요.", occupancyRate, targetOccupancy, formatAmount(lostRevenue)),
			},
			"property_ids": vacantPropertyIDs,
		})
	}

	// 액션 3: ADR 목표 미달
	if avgADR < targetADR && avgADR > 0 {
		diffPct := float64(targetADR-avgADR) / float64(targetADR) * 100
		pricingDesc := fmt.Sprintf("현재 평균 ADR ₩%s, 목표 ₩%s (-%0.f%%).\n채널별 현황:\n", formatAmount(avgADR), formatAmount(targetADR), diffPct)
		for ch, sum := range channelADRSum {
			cnt := channelADRCount[ch]
			if cnt > 0 {
				pricingDesc += fmt.Sprintf("- %s: ₩%s (%d건)\n", ch, formatAmount(sum/int64(cnt)), cnt)
			}
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P1",
			"type":     "pricing",
			"title":    fmt.Sprintf("평균 ADR ₩%s — 목표 ₩%s 대비 -%.0f%%", formatAmount(avgADR), formatAmount(targetADR), diffPct),
			"detail":   "채널별 가격 차이 확인 필요",
			"action":   "저가 채널 가격 조정 또는 최소 숙박일 변경",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "decision",
				"priority":    "P1",
				"title":       fmt.Sprintf("ADR ₩%s — 목표 대비 -%.0f%%, 채널 가격 조정 필요", formatAmount(avgADR), diffPct),
				"description": pricingDesc,
			},
		})
	}

	// 액션 4: 오늘 체크아웃 → 청소 확인
	if len(checkOuts) > 0 {
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "operation",
			"title":    fmt.Sprintf("오늘 체크아웃 %d건 — 청소 배정 확인", len(checkOuts)),
			"detail":   "체크아웃 숙소 청소 완료 여부 확인 필요",
			"action":   "청소팀 배정 상태 체크",
			"dispatch_target": "cleaning",
			"dispatch_payload": map[string]interface{}{
				"date": today,
			},
			"property_ids": checkOutPropertyIDs,
		})
	}

	// 액션 5: 오늘 체크인 준비
	if len(checkIns) > 0 {
		checkInDesc := fmt.Sprintf("오늘 체크인 %d건. 청소 완료 + 가이드 발송 확인 필요.\n", len(checkIns))
		for _, name := range checkInNames {
			checkInDesc += fmt.Sprintf("- %s\n", name)
		}
		actions = append(actions, map[string]interface{}{
			"priority": "P0",
			"type":     "operation",
			"title":    fmt.Sprintf("오늘 체크인 %d건 — 준비 상태 확인", len(checkIns)),
			"detail":   "체크인 숙소 청소 완료 + 가이드 발송 확인",
			"action":   "체크인 가이드 발송 여부 확인",
			"dispatch_target": "issues",
			"dispatch_payload": map[string]interface{}{
				"issue_type":  "cleaning",
				"priority":    "P0",
				"title":       fmt.Sprintf("오늘 체크인 %d건 — 준비 상태 확인", len(checkIns)),
				"description": checkInDesc,
			},
			"property_ids": checkInPropertyIDs,
		})
	}

	return map[string]interface{}{
		// 🔥 오늘 해야 할 액션
		"actions": actions,
		// 💰 돈
		"revenue": map[string]interface{}{
			"today_revenue":    todayRevenue,
			"today_commission": todayCommission,
			"today_net":        todayRevenue - todayCommission,
			"daily_in_house":   inHouseRevenue,
		},
		// 🔴 리스크
		"risk": map[string]interface{}{
			"vacant_count":    len(vacantProperties),
			"critical_count":  vacantCritical,
			"warning_count":   vacantWarning,
			"vacant_properties": vacantProperties,
			"total_properties": len(properties),
		},
		// 💲 가격
		"pricing": map[string]interface{}{
			"avg_adr":          avgADR,
			"target_adr":       targetADR,
			"adr_gap_pct":      fmt.Sprintf("%.1f", float64(avgADR-targetADR)/float64(targetADR)*100),
			"channel_pricing":  channelPricing,
		},
		// 📈 성장
		"growth": map[string]interface{}{
			"today_new_bookings":   len(todayBookings),
			"upcoming_7d_bookings": len(upcoming7d),
			"channels":            channels,
		},
		// 📊 지표
		"metrics": map[string]interface{}{
			"occupancy_rate":   fmt.Sprintf("%.1f", occupancyRate),
			"target_occupancy": fmt.Sprintf("%.0f", targetOccupancy),
			"avg_adr":          avgADR,
			"check_in_count":   len(checkIns),
			"check_out_count":  len(checkOuts),
			"in_house_count":   len(inHouse),
			"total_properties": len(properties),
		},
	}, nil
}

func formatAmount(amount int64) string {
	if amount >= 100000000 {
		return fmt.Sprintf("%.1f억", float64(amount)/100000000)
	}
	if amount >= 10000 {
		return fmt.Sprintf("%.0f만", float64(amount)/10000)
	}
	return fmt.Sprintf("%d", amount)
}

func dateDiffDays(from, to string) int {
	f, err1 := time.Parse("2006-01-02", from)
	t, err2 := time.Parse("2006-01-02", to)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(t.Sub(f).Hours() / 24)
}

// === Conversation / Message API ===

type ConversationSummary struct {
	ID            string              `json:"id"`
	ChannelType   string              `json:"channel_type"`
	LastMessageAt string              `json:"last_message_at"`
	Guest         ConversationGuest   `json:"guest"`
	PropertyTitle string              `json:"property_title"`
	CheckInDate   string              `json:"check_in_date"`
	CheckOutDate  string              `json:"check_out_date"`
}

type ConversationGuest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

type HostexMessage struct {
	ID          string  `json:"id"`
	SenderRole  string  `json:"sender_role"` // guest, host
	DisplayType string  `json:"display_type"` // Text, Image
	Content     string  `json:"content"`
	Attachment  *string `json:"attachment"`
	CreatedAt   string  `json:"created_at"`
}

// GetConversations — 대화 목록 조회
func (c *Client) GetConversations(limit, offset int) ([]ConversationSummary, int, error) {
	body, err := c.request("GET", "/conversations", map[string]string{
		"limit":  fmt.Sprintf("%d", limit),
		"offset": fmt.Sprintf("%d", offset),
	})
	if err != nil {
		return nil, 0, err
	}

	var resp APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, 0, err
	}

	var data struct {
		Conversations []ConversationSummary `json:"conversations"`
		Total         int                   `json:"total"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, 0, err
	}

	return data.Conversations, data.Total, nil
}

// GetAllConversations — 전체 대화 목록 페이징 조회
func (c *Client) GetAllConversations() ([]ConversationSummary, error) {
	var all []ConversationSummary
	offset := 0
	for {
		convs, total, err := c.GetConversations(100, offset)
		if err != nil {
			return nil, err
		}
		all = append(all, convs...)
		if len(all) >= total || len(convs) == 0 {
			break
		}
		offset += len(convs)
	}
	return all, nil
}

// GetConversationMessages — 대화 메시지 목록 조회 (페이징 포함)
func (c *Client) GetConversationMessages(conversationID string) ([]HostexMessage, string, error) {
	var allMessages []HostexMessage
	var resCode string
	offset := 0

	for {
		params := map[string]string{
			"limit":  "100",
			"offset": fmt.Sprintf("%d", offset),
		}
		body, err := c.request("GET", "/conversations/"+conversationID, params)
		if err != nil {
			return nil, "", err
		}

		var resp APIResponse
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, "", err
		}

		var data struct {
			Messages   []HostexMessage `json:"messages"`
			Total      int             `json:"total"`
			Activities []struct {
				ReservationCode string `json:"reservation_code"`
				Property        struct {
					ID int64 `json:"id"`
				} `json:"property"`
			} `json:"activities"`
		}
		if err := json.Unmarshal(resp.Data, &data); err != nil {
			return nil, "", err
		}

		// 첫 번째 activity에서 reservation_code 추출
		if resCode == "" {
			for _, a := range data.Activities {
				if a.ReservationCode != "" {
					resCode = a.ReservationCode
					break
				}
			}
		}

		allMessages = append(allMessages, data.Messages...)

		// 페이징 종료 조건: 반환 0건, total 도달, 또는 total 필드 없음
		if len(data.Messages) == 0 || (data.Total > 0 && len(allMessages) >= data.Total) {
			break
		}
		// total이 0이면 API가 페이징을 지원하지 않는 것 → 1회로 종료
		if data.Total == 0 {
			break
		}
		offset += len(data.Messages)
	}

	return allMessages, resCode, nil
}

// SendTextMessage — 텍스트 메시지 발송
func (c *Client) SendTextMessage(conversationID string, message string) error {
	_, err := c.requestWithBody("POST", "/conversations/"+conversationID, map[string]string{
		"message": message,
	})
	return err
}

// === Review API ===

type HostexReview struct {
	ReservationCode string        `json:"reservation_code"`
	PropertyID      int64         `json:"property_id"`
	ChannelType     string        `json:"channel_type"`
	CheckInDate     string        `json:"check_in_date"`
	CheckOutDate    string        `json:"check_out_date"`
	GuestReview     *ReviewDetail `json:"guest_review"`
	HostReview      *ReviewDetail `json:"host_review"`
	HostReply       *string       `json:"host_reply"`
}

type ReviewDetail struct {
	Score    int              `json:"score"`
	SubScore []ReviewSubScore `json:"sub_score"`
	Content  string           `json:"content"`
	CreatedAt string          `json:"created_at"`
}

type ReviewSubScore struct {
	Category string `json:"category"`
	Rating   int    `json:"rating"`
}

// GetReviews — 리뷰 목록 조회
func (c *Client) GetReviews(params map[string]string) ([]HostexReview, error) {
	body, err := c.request("GET", "/reviews", params)
	if err != nil {
		return nil, err
	}

	var resp APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	var data struct {
		Reviews []HostexReview `json:"reviews"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return nil, err
	}

	return data.Reviews, nil
}

// SendImageMessage — 이미지 메시지 발송
func (c *Client) SendImageMessage(conversationID string, jpegBase64 string) error {
	_, err := c.requestWithBody("POST", "/conversations/"+conversationID, map[string]string{
		"jpeg_base64": jpegBase64,
	})
	return err
}
