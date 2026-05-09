package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type MonthlyReportHandler struct{}

func NewMonthlyReportHandler() *MonthlyReportHandler {
	return &MonthlyReportHandler{}
}

// List GET /admin/reports/monthly?month=2026-04 OR ?start_date=2026-01-01&end_date=2026-05-10
func (h *MonthlyReportHandler) List(c *gin.Context) {
	month := c.Query("month")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	db := config.DB.Model(&models.MonthlyPropertyReport{}).Order("gross DESC")
	if month != "" {
		db = db.Where("month = ?", month)
	} else if startDate != "" && endDate != "" {
		// start_date/end_date → 해당 기간에 포함되는 월들 (YYYY-MM)
		startMonth := startDate[:7] // "2026-01"
		endMonth := endDate[:7]     // "2026-05"
		db = db.Where("month >= ? AND month <= ?", startMonth, endMonth)
	}

	var reports []models.MonthlyPropertyReport
	db.Find(&reports)

	// 합계
	var totalGross, totalCost, totalNet int64
	var totalAOR float64
	for _, r := range reports {
		totalGross += r.Gross
		totalCost += r.TotalCost
		totalNet += r.Net
		totalAOR += r.AOR
	}
	avgAOR := 0.0
	if len(reports) > 0 {
		avgAOR = totalAOR / float64(len(reports))
	}
	avgMargin := 0.0
	if totalGross > 0 {
		avgMargin = float64(totalNet) / float64(totalGross) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"reports": reports,
		"count":   len(reports),
		"month":   month,
		"summary": gin.H{
			"total_gross":  totalGross,
			"total_cost":   totalCost,
			"total_net":    totalNet,
			"avg_aor":      avgAOR,
			"avg_margin":   avgMargin,
		},
	})
}

// Months GET /admin/reports/months — 집계된 월 목록
func (h *MonthlyReportHandler) Months(c *gin.Context) {
	var months []string
	config.DB.Model(&models.MonthlyPropertyReport{}).
		Select("DISTINCT month").
		Order("month DESC").
		Pluck("month", &months)

	c.JSON(http.StatusOK, months)
}

// PropertyDetail GET /admin/reports/property/:id — 숙소별 월간 추이
func (h *MonthlyReportHandler) PropertyDetail(c *gin.Context) {
	propID := c.Param("id")

	var reports []models.MonthlyPropertyReport
	config.DB.Where("property_id = ?", propID).Order("month DESC").Find(&reports)

	c.JSON(http.StatusOK, gin.H{
		"reports": reports,
		"count":   len(reports),
	})
}
