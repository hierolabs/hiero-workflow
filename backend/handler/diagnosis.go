package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type DiagnosisHandler struct {
	svc *service.DiagnosisService
}

func NewDiagnosisHandler() *DiagnosisHandler {
	return &DiagnosisHandler{svc: service.NewDiagnosisService()}
}

// GET /admin/diagnosis — 전체 숙소 진단 리스트 (점수 낮은 순)
func (h *DiagnosisHandler) ListAll(c *gin.Context) {
	results, err := h.svc.DiagnoseAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total":   len(results),
		"results": results,
	})
}

// GET /admin/diagnosis/:property_id — 특정 숙소 상세 진단
func (h *DiagnosisHandler) GetOne(c *gin.Context) {
	pid, err := strconv.ParseUint(c.Param("property_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid property_id"})
		return
	}

	result, err := h.svc.DiagnoseOne(uint(pid))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "diagnosis not found"})
		return
	}
	c.JSON(http.StatusOK, result)
}

// PUT /admin/diagnosis/:property_id — 운영자 수동 점수 업데이트
type UpdateDiagnosisRequest struct {
	// 가치창출 (5개)
	LocationScore   *int `json:"location_score,omitempty"`
	RoomTypeScore   *int `json:"room_type_score,omitempty"`
	PriceValueScore *int `json:"price_value_score,omitempty"`
	InteriorScore   *int `json:"interior_score,omitempty"`
	TargetFitScore  *int `json:"target_fit_score,omitempty"`
	// 마케팅 (5개)
	PhotoScore              *int `json:"photo_score,omitempty"`
	ChannelExposureScore    *int `json:"channel_exposure_score,omitempty"`
	ListingScore            *int `json:"listing_score,omitempty"`
	ReviewScore             *int `json:"review_score,omitempty"`
	ChannelPerformanceScore *int `json:"channel_performance_score,omitempty"`
	// 판매 (5개)
	OccupancyRate      *float64 `json:"occupancy_rate,omitempty"`
	InquiryConversion  *int     `json:"inquiry_conversion,omitempty"`
	BookingConversion  *int     `json:"booking_conversion,omitempty"`
	PriceFlexibility   *int     `json:"price_flexibility,omitempty"`
	LongStayConversion *int     `json:"long_stay_conversion,omitempty"`
	// 운영전달 (5개)
	CleaningScore *int `json:"cleaning_score,omitempty"`
	CheckinScore  *int `json:"checkin_score,omitempty"`
	CSScore       *int `json:"cs_score,omitempty"`
	AmenityScore  *int `json:"amenity_score,omitempty"`
	ClaimRate     *int `json:"claim_rate,omitempty"`
	// 재무
	MonthlyRevenue  *int `json:"monthly_revenue,omitempty"`
	MonthlyRent     *int `json:"monthly_rent,omitempty"`
	MonthlyMgmtFee  *int `json:"monthly_mgmt_fee,omitempty"`
	MonthlyCleanFee *int `json:"monthly_clean_fee,omitempty"`
	PlatformFee     *int `json:"platform_fee,omitempty"`
	ADR             *int `json:"adr,omitempty"`
	// 메모
	Note *string `json:"note,omitempty"`
}

func (h *DiagnosisHandler) Update(c *gin.Context) {
	pid, err := strconv.ParseUint(c.Param("property_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid property_id"})
		return
	}

	var req UpdateDiagnosisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	// 가치창출
	if req.LocationScore != nil {
		updates["location_score"] = *req.LocationScore
	}
	if req.RoomTypeScore != nil {
		updates["room_type_score"] = *req.RoomTypeScore
	}
	if req.PriceValueScore != nil {
		updates["price_value_score"] = *req.PriceValueScore
	}
	if req.InteriorScore != nil {
		updates["interior_score"] = *req.InteriorScore
	}
	if req.TargetFitScore != nil {
		updates["target_fit_score"] = *req.TargetFitScore
	}
	// 마케팅
	if req.PhotoScore != nil {
		updates["photo_score"] = *req.PhotoScore
	}
	if req.ChannelExposureScore != nil {
		updates["channel_exposure_score"] = *req.ChannelExposureScore
	}
	if req.ListingScore != nil {
		updates["listing_score"] = *req.ListingScore
	}
	if req.ReviewScore != nil {
		updates["review_score"] = *req.ReviewScore
	}
	if req.ChannelPerformanceScore != nil {
		updates["channel_performance_score"] = *req.ChannelPerformanceScore
	}
	// 판매
	if req.OccupancyRate != nil {
		updates["occupancy_rate"] = *req.OccupancyRate
	}
	if req.InquiryConversion != nil {
		updates["inquiry_conversion"] = *req.InquiryConversion
	}
	if req.BookingConversion != nil {
		updates["booking_conversion"] = *req.BookingConversion
	}
	if req.PriceFlexibility != nil {
		updates["price_flexibility"] = *req.PriceFlexibility
	}
	if req.LongStayConversion != nil {
		updates["long_stay_conversion"] = *req.LongStayConversion
	}
	// 운영전달
	if req.CleaningScore != nil {
		updates["cleaning_score"] = *req.CleaningScore
	}
	if req.CheckinScore != nil {
		updates["checkin_score"] = *req.CheckinScore
	}
	if req.CSScore != nil {
		updates["cs_score"] = *req.CSScore
	}
	if req.AmenityScore != nil {
		updates["amenity_score"] = *req.AmenityScore
	}
	if req.ClaimRate != nil {
		updates["claim_rate"] = *req.ClaimRate
	}
	// 재무
	if req.MonthlyRevenue != nil {
		updates["monthly_revenue"] = *req.MonthlyRevenue
	}
	if req.MonthlyRent != nil {
		updates["monthly_rent"] = *req.MonthlyRent
	}
	if req.MonthlyMgmtFee != nil {
		updates["monthly_mgmt_fee"] = *req.MonthlyMgmtFee
	}
	if req.MonthlyCleanFee != nil {
		updates["monthly_clean_fee"] = *req.MonthlyCleanFee
	}
	if req.PlatformFee != nil {
		updates["platform_fee"] = *req.PlatformFee
	}
	if req.ADR != nil {
		updates["adr"] = *req.ADR
	}
	// 메모
	if req.Note != nil {
		updates["note"] = *req.Note
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	result := config.DB.Model(&models.PropertyBusinessDiagnosis{}).
		Where("property_id = ?", pid).
		Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "diagnosis not found"})
		return
	}

	updated, err := h.svc.DiagnoseOne(uint(pid))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"updated": true})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// GET /admin/diagnosis/portfolio — 포트폴리오 요약
func (h *DiagnosisHandler) Portfolio(c *gin.Context) {
	result, err := h.svc.Portfolio()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}
