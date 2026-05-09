package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ETFBoardHandler struct {
	svc          *service.ETFBoardService
	directiveSvc *service.DirectiveService
}

func NewETFBoardHandler() *ETFBoardHandler {
	return &ETFBoardHandler{
		svc:          service.NewETFBoardService(),
		directiveSvc: service.NewDirectiveService(),
	}
}

// GET /admin/etf-board — 통합 개요
func (h *ETFBoardHandler) Overview(c *gin.Context) {
	data := h.svc.GetOverview()
	c.JSON(http.StatusOK, data)
}

// GET /admin/etf-board/ceo
func (h *ETFBoardHandler) CEOBoard(c *gin.Context) {
	data := h.svc.GetCEOBoard()
	c.JSON(http.StatusOK, data)
}

// GET /admin/etf-board/cto
func (h *ETFBoardHandler) CTOBoard(c *gin.Context) {
	data := h.svc.GetCTOBoard()
	c.JSON(http.StatusOK, data)
}

// GET /admin/etf-board/cfo
func (h *ETFBoardHandler) CFOBoard(c *gin.Context) {
	data := h.svc.GetCFOBoard()
	c.JSON(http.StatusOK, data)
}

// GET /admin/etf-board/cfo/financial?start_date=&end_date= — CFO 재무 흐름 (기간 선택)
func (h *ETFBoardHandler) CFOFinancial(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	data := h.svc.BuildFinancialFlow(startDate, endDate)
	c.JSON(http.StatusOK, data)
}

// GET /admin/etf-board/cross-activity — ETF 교차 현황 (relationship 래핑)
func (h *ETFBoardHandler) CrossActivity(c *gin.Context) {
	rel := h.directiveSvc.GetRelationship()
	c.JSON(http.StatusOK, rel)
}

// GET /admin/etf-board/got — GOT 레이어 요약
func (h *ETFBoardHandler) GOTSummary(c *gin.Context) {
	summary := h.directiveSvc.GetGOTSummary()
	c.JSON(http.StatusOK, summary)
}
