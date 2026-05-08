package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type PricingHandler struct {
	svc      *service.PricingService
	samsam   *service.SamsamService
}

func NewPricingHandler() *PricingHandler {
	return &PricingHandler{
		svc:    service.NewPricingService(),
		samsam: service.NewSamsamService(),
	}
}

// POST /admin/pricing/sync — Hostex → DB 가격 동기화
func (h *PricingHandler) Sync(c *gin.Context) {
	go func() {
		h.svc.SyncAllPricing()
	}()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "가격 동기화 시작됨 (백그라운드)"})
}

// GET /admin/pricing/links — 숙소별 외부 플랫폼 링크
func (h *PricingHandler) Links(c *gin.Context) {
	type PlatformLink struct {
		PropertyID uint   `json:"property_id"`
		Platform   string `json:"platform"`
		ListingID  string `json:"listing_id"`
	}
	var links []PlatformLink
	config.DB.Raw(`SELECT property_id, platform, listing_id FROM property_platforms WHERE listing_id != ''`).Scan(&links)

	// property_id → { airbnb: listing_id, ... }
	result := map[uint]map[string]string{}
	for _, l := range links {
		if result[l.PropertyID] == nil {
			result[l.PropertyID] = map[string]string{}
		}
		result[l.PropertyID][l.Platform] = l.ListingID
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// GET /admin/pricing/calendar?start=2026-05-08&end=2026-05-15
func (h *PricingHandler) GetCalendar(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")
	if start == "" || end == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start, end 필수"})
		return
	}

	pricing, err := h.svc.GetPricingForProperties(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": pricing})
}

// PUT /admin/pricing/price
func (h *PricingHandler) UpdatePrice(c *gin.Context) {
	var req struct {
		PropertyID uint   `json:"property_id"`
		StartDate  string `json:"start_date"`
		EndDate    string `json:"end_date"`
		Price      int64  `json:"price"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.PropertyID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "property_id, start_date, end_date, price 필수"})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	userName := ""
	if name, ok := c.Get("login_id"); ok {
		userName, _ = name.(string)
	}

	if err := h.svc.UpdatePrice(req.PropertyID, req.StartDate, req.EndDate, req.Price, &uid, userName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "가격 변경 완료"})
}

// PUT /admin/pricing/restrictions
func (h *PricingHandler) UpdateRestrictions(c *gin.Context) {
	var req struct {
		PropertyID uint   `json:"property_id"`
		StartDate  string `json:"start_date"`
		EndDate    string `json:"end_date"`
		MinStay    int    `json:"min_stay"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.PropertyID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "property_id, start_date, end_date, min_stay 필수"})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	userName := ""
	if name, ok := c.Get("login_id"); ok {
		userName, _ = name.(string)
	}

	if err := h.svc.UpdateMinStay(req.PropertyID, req.StartDate, req.EndDate, req.MinStay, &uid, userName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "최소숙박 변경 완료"})
}

// PUT /admin/pricing/availability
func (h *PricingHandler) UpdateAvailability(c *gin.Context) {
	var req struct {
		PropertyID uint   `json:"property_id"`
		StartDate  string `json:"start_date"`
		EndDate    string `json:"end_date"`
		Blocked    bool   `json:"blocked"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.PropertyID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "property_id, start_date, end_date, blocked 필수"})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	userName := ""
	if name, ok := c.Get("login_id"); ok {
		userName, _ = name.(string)
	}

	var err error
	if req.Blocked {
		err = h.svc.BlockDates(req.PropertyID, req.StartDate, req.EndDate, &uid, userName)
	} else {
		err = h.svc.UnblockDates(req.PropertyID, req.StartDate, req.EndDate, &uid, userName)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "가용성 변경 완료"})
}

// POST /admin/pricing/samsam/check — 삼삼엠투 연동 상태 확인
func (h *PricingHandler) SamsamCheck(c *gin.Context) {
	result := h.samsam.CheckReadiness()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}
