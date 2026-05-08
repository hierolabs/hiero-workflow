package pricelabs

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

const baseURL = "https://api.pricelabs.co/v1"

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		apiKey: os.Getenv("PRICELABS_API_KEY"),
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// --- 응답 구조체 ---

type Listing struct {
	ID                    string  `json:"id"`
	PMS                   string  `json:"pms"`
	Name                  string  `json:"name"`
	Latitude              string  `json:"latitude"`
	Longitude             string  `json:"longitude"`
	Country               string  `json:"country"`
	CityName              string  `json:"city_name"`
	NoBedrooms            int     `json:"no_of_bedrooms"`
	Min                   interface{} `json:"min"`
	Base                  interface{} `json:"base"`
	Max                   interface{} `json:"max"`
	Group                 *string `json:"group"`
	IsHidden              bool    `json:"isHidden"`
	PushEnabled           bool    `json:"push_enabled"`
	LastDatePushed        string  `json:"last_date_pushed"`
	OccupancyNext7        string  `json:"occupancy_next_7"`
	OccupancyNext30       string  `json:"occupancy_next_30"`
	OccupancyNext60       string  `json:"occupancy_next_60"`
	MarketOccupancyNext7  string  `json:"market_occupancy_next_7"`
	MarketOccupancyNext30 string  `json:"market_occupancy_next_30"`
	MarketOccupancyNext60 string  `json:"market_occupancy_next_60"`
	ADRPast90             interface{} `json:"adr_past_90"`
	ADRPast90STLY         interface{} `json:"stly_adr_past_90"`
	BookingPickup30       interface{} `json:"booking_pickup_past_30"`
	MPINext7              interface{} `json:"mpi_next_7"`
	RecommendedBasePrice  interface{} `json:"recommended_base_price"`
	LastRefreshedAt       string  `json:"last_refreshed_at"`
}

type DayPrice struct {
	Date              string  `json:"date"`
	Price             int64   `json:"price"`
	UserPrice         int64   `json:"user_price"`
	UncustomizedPrice int64   `json:"uncustomized_price"`
	MinStay           int     `json:"min_stay"`
	BookingStatus     string  `json:"booking_status"`
	BookingStatusSTLY string  `json:"booking_status_STLY"`
	ADR               float64 `json:"ADR"`
	ADRSTLY           float64 `json:"ADR_STLY"`
	BookedDate        string  `json:"booked_date"`
	BookedDateSTLY    string  `json:"booked_date_STLY"`
	Unbookable        int     `json:"unbookable"`
	WeeklyDiscount    float64 `json:"weekly_discount"`
	MonthlyDiscount   float64 `json:"monthly_discount"`
	DemandColor       string  `json:"demand_color"`
	DemandDesc        string  `json:"demand_desc"`
}

type ListingPricesResponse struct {
	ID               string     `json:"id"`
	PMS              string     `json:"pms"`
	Group            string     `json:"group"`
	Currency         string     `json:"currency"`
	LastRefreshedAt  string     `json:"last_refreshed_at"`
	Data             []DayPrice `json:"data"`
}

// --- API 메서드 ---

func (c *Client) get(path string) ([]byte, error) {
	req, err := http.NewRequest("GET", baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	log.Printf("[PriceLabs] GET %s → %d (%d bytes)", path, resp.StatusCode, len(body))
	return body, nil
}

func (c *Client) post(path string, payload interface{}) ([]byte, error) {
	jsonBody, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.apiKey)
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

	log.Printf("[PriceLabs] POST %s → %d (%d bytes)", path, resp.StatusCode, len(body))
	return body, nil
}

// GetListings — 전체 리스팅 목록 + KPI
func (c *Client) GetListings() ([]Listing, error) {
	body, err := c.get("/listings")
	if err != nil {
		return nil, err
	}

	var data struct {
		Listings []Listing `json:"listings"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("listings 파싱 실패: %w", err)
	}

	return data.Listings, nil
}

// GetListingPrices — 리스팅별 일별 가격 상세 (최대 541일)
func (c *Client) GetListingPrices(listings []struct {
	ID  string `json:"id"`
	PMS string `json:"pms"`
}) ([]ListingPricesResponse, error) {
	body, err := c.post("/listing_prices", map[string]interface{}{
		"listings": listings,
	})
	if err != nil {
		return nil, err
	}

	var data []ListingPricesResponse
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("listing_prices 파싱 실패: %w", err)
	}

	return data, nil
}
