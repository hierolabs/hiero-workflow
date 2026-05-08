package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type PriceLabsHandler struct {
	svc *service.PriceLabsService
}

func NewPriceLabsHandler() *PriceLabsHandler {
	return &PriceLabsHandler{svc: service.NewPriceLabsService()}
}

// POST /admin/pricelabs/sync — PriceLabs 전체 동기화
func (h *PriceLabsHandler) Sync(c *gin.Context) {
	go func() {
		h.svc.SyncAll()
	}()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "PriceLabs 동기화 시작됨"})
}

// GET /admin/pricelabs/compare?start=&end= — Hostex vs PriceLabs 비교
func (h *PriceLabsHandler) Compare(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")
	if start == "" || end == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start, end 필수"})
		return
	}

	data, err := h.svc.GetPriceComparison(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// GET /admin/pricelabs/kpi — 전체 리스팅 KPI
func (h *PriceLabsHandler) KPIs(c *gin.Context) {
	listings, err := h.svc.GetListingKPIs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": listings})
}
