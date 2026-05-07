package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type IssueDetectionHandler struct {
	svc *service.IssueDetectorService
}

func NewIssueDetectionHandler() *IssueDetectionHandler {
	return &IssueDetectionHandler{svc: service.NewIssueDetectorService()}
}

// GET /admin/issue-detections — 미처리 감지 목록
func (h *IssueDetectionHandler) ListPending(c *gin.Context) {
	detections := h.svc.ListPending()
	c.JSON(http.StatusOK, gin.H{
		"detections": detections,
		"total":      len(detections),
	})
}

// POST /admin/issue-detections/scan — 최근 메시지 스캔
func (h *IssueDetectionHandler) Scan(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	detected := h.svc.ScanRecentMessages(limit)
	c.JSON(http.StatusOK, gin.H{
		"message":  "스캔 완료",
		"detected": detected,
	})
}

// POST /admin/issue-detections/:id/create-issue — 감지 → 이슈 생성
func (h *IssueDetectionHandler) CreateIssue(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	issue, err := h.svc.CreateIssueFromDetection(uint(id))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, issue)
}

// POST /admin/issue-detections/:id/dismiss — 감지 무시
func (h *IssueDetectionHandler) Dismiss(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	if err := h.svc.DismissDetection(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "무시 처리 완료"})
}
