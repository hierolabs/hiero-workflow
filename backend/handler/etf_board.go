package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ETFBoardHandler struct {
	svc *service.ETFBoardService
}

func NewETFBoardHandler() *ETFBoardHandler {
	return &ETFBoardHandler{svc: service.NewETFBoardService()}
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
