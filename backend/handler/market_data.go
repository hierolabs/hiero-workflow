package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type MarketDataHandler struct {
	svc *service.MarketDataService
}

func NewMarketDataHandler() *MarketDataHandler {
	return &MarketDataHandler{
		svc: service.NewMarketDataService(),
	}
}

// POST /admin/market/import/rooms — JSON 파일 업로드로 매물 가격 임포트
func (h *MarketDataHandler) ImportRooms(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 선택해주세요"})
		return
	}
	defer file.Close()

	job, err := h.svc.ImportRoomDetailsJSON(file, header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "data": job})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "매물 가격 임포트 완료",
		"data":    job,
	})
}

// POST /admin/market/import/contracts — CSV 파일 업로드로 계약 데이터 임포트
func (h *MarketDataHandler) ImportContracts(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 선택해주세요"})
		return
	}
	defer file.Close()

	job, err := h.svc.ImportContractsCSV(file, header.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "data": job})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "계약 데이터 임포트 완료",
		"data":    job,
	})
}

// POST /admin/market/import/auto — docs/samsam/ 최신 파일 자동 임포트
func (h *MarketDataHandler) AutoImport(c *gin.Context) {
	job, err := h.svc.ImportFromLatestFiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "자동 임포트 완료",
		"data":    job,
	})
}

// GET /admin/market/prices?platform=33m2&date=2026-05-08
func (h *MarketDataHandler) GetPrices(c *gin.Context) {
	platform := c.DefaultQuery("platform", "33m2")
	date := c.Query("date")

	prices, err := h.svc.GetMarketPrices(platform, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": prices})
}

// GET /admin/market/compare?platform=33m2
func (h *MarketDataHandler) GetComparison(c *gin.Context) {
	platform := c.DefaultQuery("platform", "33m2")

	results, err := h.svc.GetMarketComparison(platform)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": results})
}

// GET /admin/market/summary?platform=33m2
func (h *MarketDataHandler) GetSummary(c *gin.Context) {
	platform := c.DefaultQuery("platform", "33m2")

	summary, err := h.svc.GetMarketSummary(platform)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": summary})
}

// GET /admin/market/vacancy — 공실 분석 대시보드
func (h *MarketDataHandler) GetVacancyAnalysis(c *gin.Context) {
	result, err := h.svc.GetVacancyAnalysis()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// GET /admin/market/jobs?limit=20
func (h *MarketDataHandler) GetJobs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	jobs, err := h.svc.GetCrawlJobs(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": jobs})
}
