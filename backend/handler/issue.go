package handler

import (
	"net/http"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type IssueHandler struct {
	svc     *service.IssueService
	commSvc *service.CommunicationService
}

func NewIssueHandler() *IssueHandler {
	return &IssueHandler{
		svc:     service.NewIssueService(),
		commSvc: service.NewCommunicationService(),
	}
}

func (h *IssueHandler) List(c *gin.Context) {
	var query service.IssueListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "목록 조회 실패"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *IssueHandler) Get(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	issue, err := h.svc.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "이슈를 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, issue)
}

func (h *IssueHandler) Create(c *gin.Context) {
	var issue models.Issue
	if err := c.ShouldBindJSON(&issue); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if issue.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "제목은 필수입니다"})
		return
	}
	if issue.IssueType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "이슈 유형은 필수입니다"})
		return
	}

	// 생성자 정보
	userID, _ := c.Get("user_id")
	if uid, ok := userID.(uint); ok {
		issue.CreatedByID = &uid
	}

	created, err := h.svc.Create(issue)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	// 시스템 로그
	h.commSvc.LogSystemEvent(issue.PropertyID, issue.ReservationID, issue.ReservationCode,
		"이슈 생성: ["+issue.IssueType+"] "+issue.Title)

	c.JSON(http.StatusCreated, created)
}

func (h *IssueHandler) UpdateStatus(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		Status     string `json:"status"`
		Resolution string `json:"resolution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	issue, err := h.svc.UpdateStatus(id, req.Status, req.Resolution)
	if err != nil {
		if err == service.ErrInvalidStatus {
			c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 상태입니다"})
			return
		}
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, issue)
}

func (h *IssueHandler) UpdateAssignee(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		AssigneeName string `json:"assignee_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	issue, err := h.svc.UpdateAssignee(id, req.AssigneeName)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, issue)
}

func (h *IssueHandler) GetSummary(c *gin.Context) {
	summary := h.svc.GetSummary()
	c.JSON(http.StatusOK, summary)
}

// POST /admin/issues/:id/escalate — 이슈를 한 단계 위로 에스컬레이트
func (h *IssueHandler) Escalate(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	roleLayer, _ := c.Get("role_layer")
	roleTitle, _ := c.Get("role_title")
	layer, _ := roleLayer.(string)
	title, _ := roleTitle.(string)

	if layer == "" || title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "역할 정보가 필요합니다"})
		return
	}

	issue, err := h.svc.EscalateIssue(id, layer, title)
	if err != nil {
		if err.Error() == "cannot_escalate_from_this_layer" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "이 레이어에서는 에스컬레이트할 수 없습니다"})
			return
		}
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, issue)
}
