package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type DirectiveHandler struct {
	svc *service.DirectiveService
}

func NewDirectiveHandler() *DirectiveHandler {
	return &DirectiveHandler{svc: service.NewDirectiveService()}
}

// POST /admin/directives — 업무지시/보고/협의 생성
func (h *DirectiveHandler) Create(c *gin.Context) {
	var input service.CreateDirectiveInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	directive, err := h.svc.Create(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, directive)
}

// GET /admin/directives/sent?user_id=N — 내가 보낸 지시
func (h *DirectiveHandler) ListSent(c *gin.Context) {
	uid, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	list := h.svc.ListSent(uint(uid))
	c.JSON(http.StatusOK, gin.H{"directives": list})
}

// GET /admin/directives/received?role=ceo — 내가 받은 지시/보고
func (h *DirectiveHandler) ListReceived(c *gin.Context) {
	role := c.Query("role")
	list := h.svc.ListReceived(role)
	c.JSON(http.StatusOK, gin.H{"directives": list})
}

// GET /admin/directives — 전체 목록
func (h *DirectiveHandler) ListAll(c *gin.Context) {
	list := h.svc.ListAll()
	c.JSON(http.StatusOK, gin.H{"directives": list})
}

// GET /admin/directives/relationship — ETF 관계 분석
func (h *DirectiveHandler) Relationship(c *gin.Context) {
	rel := h.svc.GetRelationship()
	c.JSON(http.StatusOK, rel)
}

// PATCH /admin/directives/:id/acknowledge — 확인
func (h *DirectiveHandler) Acknowledge(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.svc.Acknowledge(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "확인 처리됨"})
}

// PATCH /admin/directives/:id/start — 진행 시작
func (h *DirectiveHandler) Start(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.svc.Start(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "진행 시작"})
}

// PATCH /admin/directives/:id/complete — 완료
func (h *DirectiveHandler) Complete(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		ResultMemo string `json:"result_memo"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Complete(uint(id), body.ResultMemo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "완료 처리됨"})
}

// PATCH /admin/directives/:id/reject — 반려
func (h *DirectiveHandler) Reject(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Reject(uint(id), body.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "반려 처리됨"})
}
