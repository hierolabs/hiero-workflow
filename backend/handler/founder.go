package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type FounderHandler struct {
	svc       *service.FounderService
	reportSvc *service.GOTReportService
}

func NewFounderHandler() *FounderHandler {
	return &FounderHandler{
		svc:       service.NewFounderService(),
		reportSvc: service.NewGOTReportService(),
	}
}

// GET /admin/founder/daily-brief
func (h *FounderHandler) DailyBrief(c *gin.Context) {
	data := h.svc.GetDailyBrief()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/top-decisions
func (h *FounderHandler) TopDecisions(c *gin.Context) {
	data := h.svc.GetTopDecisions()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/etf-summary
func (h *FounderHandler) ETFSummary(c *gin.Context) {
	data := h.svc.GetETFSummary()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/cycle — 3카테고리 순환 분석
func (h *FounderHandler) CycleAnalysis(c *gin.Context) {
	data := h.svc.GetCycleAnalysis()
	c.JSON(http.StatusOK, data)
}

// GET /admin/founder/reports — 재무 보고서 목록
func (h *FounderHandler) Reports(c *gin.Context) {
	reportType := c.Query("type")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	reports := h.reportSvc.List(reportType, limit)
	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

// GET /admin/founder/reports/latest — 최신 보고서 (daily+weekly+monthly)
func (h *FounderHandler) ReportsLatest(c *gin.Context) {
	latest := h.reportSvc.GetLatest()
	c.JSON(http.StatusOK, latest)
}

// PATCH /admin/founder/reports/:id/read — 읽음 처리
func (h *FounderHandler) ReportRead(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.reportSvc.MarkRead(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "읽음 처리됨"})
}

// GET /admin/founder/anomalies — 실시간 이상 감지
func (h *FounderHandler) Anomalies(c *gin.Context) {
	alerts := h.reportSvc.DetectAlerts()
	c.JSON(http.StatusOK, gin.H{"alerts": alerts, "total": len(alerts)})
}

// POST /admin/founder/reports/generate — 수동 생성
func (h *FounderHandler) ReportGenerate(c *gin.Context) {
	reportType := c.DefaultQuery("type", "daily")
	var report interface{}
	var err error

	switch reportType {
	case "daily":
		report, err = h.reportSvc.BuildDailyReport()
	case "weekly":
		report, err = h.reportSvc.BuildWeeklyReport()
	case "monthly":
		report, err = h.reportSvc.BuildMonthlyReport()
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid type"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, report)
}
