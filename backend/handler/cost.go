package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type CostHandler struct {
	allocSvc *service.CostAllocationService
}

func NewCostHandler() *CostHandler {
	return &CostHandler{allocSvc: service.NewCostAllocationService()}
}

// ListRawCosts GET /admin/costs/raw?property_id=&cost_type=&month=
func (h *CostHandler) ListRawCosts(c *gin.Context) {
	db := config.DB.Model(&models.CostRaw{}).Order("payment_date DESC")

	if pid := c.Query("property_id"); pid != "" {
		db = db.Where("property_id = ?", pid)
	}
	if ct := c.Query("cost_type"); ct != "" {
		db = db.Where("cost_type = ?", ct)
	}
	if month := c.Query("month"); month != "" {
		db = db.Where("payment_date LIKE ?", month+"%")
	}

	var costs []models.CostRaw
	db.Find(&costs)
	c.JSON(http.StatusOK, gin.H{"costs": costs, "count": len(costs)})
}

// ListAllocations GET /admin/costs/allocations?property_id=&month=&cost_type=
func (h *CostHandler) ListAllocations(c *gin.Context) {
	db := config.DB.Model(&models.CostAllocation{}).Order("allocated_month DESC")

	if pid := c.Query("property_id"); pid != "" {
		db = db.Where("property_id = ?", pid)
	}
	if month := c.Query("month"); month != "" {
		db = db.Where("allocated_month = ?", month)
	}
	if ct := c.Query("cost_type"); ct != "" {
		db = db.Where("cost_type = ?", ct)
	}

	var allocations []models.CostAllocation
	db.Find(&allocations)

	// 합계
	var total int64
	for _, a := range allocations {
		total += a.AllocatedAmount
	}

	c.JSON(http.StatusOK, gin.H{"allocations": allocations, "count": len(allocations), "total": total})
}

// MonthlySummary GET /admin/costs/monthly?start_month=&end_month=&property_id=
func (h *CostHandler) MonthlySummary(c *gin.Context) {
	startMonth := c.DefaultQuery("start_month", "2025-01")
	endMonth := c.DefaultQuery("end_month", "2026-12")

	type MonthCost struct {
		AllocatedMonth string `json:"allocated_month"`
		CostType       string `json:"cost_type"`
		Total          int64  `json:"total"`
	}

	db := config.DB.Raw(`
		SELECT allocated_month, cost_type, SUM(allocated_amount) as total
		FROM cost_allocations
		WHERE allocated_month >= ? AND allocated_month <= ?
		`+propertyFilter(c.Query("property_id"))+`
		GROUP BY allocated_month, cost_type
		ORDER BY allocated_month DESC, cost_type`,
		startMonth, endMonth,
	)

	var results []MonthCost
	db.Scan(&results)
	c.JSON(http.StatusOK, gin.H{"data": results})
}

// ImportFromTransactions POST /admin/costs/import-from-transactions
func (h *CostHandler) ImportFromTransactions(c *gin.Context) {
	count, err := h.allocSvc.ImportFromTransactions("hostex_transactions_migration")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"imported": count, "message": "비용 데이터 마이그레이션 완료"})
}

// ReallocateAll POST /admin/costs/reallocate
func (h *CostHandler) ReallocateAll(c *gin.Context) {
	count, err := h.allocSvc.AllocateAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reallocated": count})
}

func propertyFilter(pid string) string {
	if pid != "" {
		return " AND property_id = " + pid
	}
	return ""
}
