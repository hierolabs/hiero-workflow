package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type TransactionHandler struct {
	svc *service.TransactionService
}

func NewTransactionHandler() *TransactionHandler {
	return &TransactionHandler{svc: service.NewTransactionService()}
}

// POST /admin/transactions/upload — CSV 파일 업로드
func (h *TransactionHandler) Upload(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 선택해주세요"})
		return
	}
	defer file.Close()

	imported, skipped, err := h.svc.ImportCSV(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "업로드 완료",
		"imported": imported,
		"skipped":  skipped,
	})
}

// GET /admin/transactions/summary?year_month=2025-12 — 월간 집계
func (h *TransactionHandler) Summary(c *gin.Context) {
	yearMonth := c.Query("year_month")

	results, err := h.svc.GetMonthlySummary(yearMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"year_month": yearMonth,
		"total":      len(results),
		"results":    results,
	})
}

// GET /admin/transactions/months — 데이터 있는 월 목록
func (h *TransactionHandler) Months(c *gin.Context) {
	var months []string
	config.DB.Model(&models.HostexTransaction{}).
		Select("DISTINCT year_month").
		Order("year_month DESC").
		Pluck("year_month", &months)
	c.JSON(http.StatusOK, months)
}
