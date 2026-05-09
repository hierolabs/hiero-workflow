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

// GET /admin/founder/anomalies — 이상 감지 (DB 상태 포함)
func (h *FounderHandler) Anomalies(c *gin.Context) {
	// 실시간 감지 실행 (새 알림 DB 저장)
	h.reportSvc.DetectAlerts()
	// DB에서 상태별 조회
	active := h.reportSvc.GetActiveAlerts()
	dismissed := h.reportSvc.GetDismissedAlerts(10)
	c.JSON(http.StatusOK, gin.H{
		"active":    active,
		"dismissed": dismissed,
		"total":     len(active),
	})
}

// PATCH /admin/founder/alerts/:id/acknowledge
func (h *FounderHandler) AlertAcknowledge(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userName, _ := c.Get("user_name")
	name, _ := userName.(string)
	if err := h.reportSvc.AcknowledgeAlert(uint(id), name); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "확인됨"})
}

// PATCH /admin/founder/alerts/:id/forward
func (h *FounderHandler) AlertForward(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userName, _ := c.Get("user_name")
	name, _ := userName.(string)
	var req struct {
		ToRole string `json:"to_role"`
		Memo   string `json:"memo"`
	}
	c.ShouldBindJSON(&req)
	if err := h.reportSvc.ForwardAlert(uint(id), name, req.ToRole, req.Memo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "전송됨"})
}

// PATCH /admin/founder/alerts/:id/approve
func (h *FounderHandler) AlertApprove(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userName, _ := c.Get("user_name")
	name, _ := userName.(string)
	var req struct{ Memo string `json:"memo"` }
	c.ShouldBindJSON(&req)
	if err := h.reportSvc.ApproveAlert(uint(id), name, req.Memo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "승인됨"})
}

// PATCH /admin/founder/alerts/:id/reject
func (h *FounderHandler) AlertReject(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	userName, _ := c.Get("user_name")
	name, _ := userName.(string)
	var req struct{ Memo string `json:"memo"` }
	c.ShouldBindJSON(&req)
	if err := h.reportSvc.RejectAlert(uint(id), name, req.Memo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "반려됨"})
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
