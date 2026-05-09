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

// PATCH /admin/directives/:id/verify — 발신자 완료 확인
func (h *DirectiveHandler) Verify(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Verify(uint(id), body.UserName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "완료 확인됨"})
}

// PATCH /admin/directives/:id/reopen — 재작업 요청
func (h *DirectiveHandler) Reopen(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
		Memo     string `json:"memo"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Reopen(uint(id), body.UserName, body.Memo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "재작업 요청됨"})
}

// PATCH /admin/directives/:id/approve — 보고 승인
func (h *DirectiveHandler) Approve(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
		Comment  string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Approve(uint(id), body.UserName, body.Comment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "승인됨"})
}

// PATCH /admin/directives/:id/request-revision — 수정 요청
func (h *DirectiveHandler) RequestRevision(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
		Memo     string `json:"memo"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.RequestRevision(uint(id), body.UserName, body.Memo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "수정 요청됨"})
}

// PATCH /admin/directives/:id/agree — lateral 합의
func (h *DirectiveHandler) Agree(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Agree(uint(id), body.UserName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "합의 완료"})
}

// PATCH /admin/directives/:id/counter — lateral 대안 제시
func (h *DirectiveHandler) Counter(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
		Proposal string `json:"proposal"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.Counter(uint(id), body.UserName, body.Proposal); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "대안 제시됨"})
}

// PATCH /admin/directives/:id/escalate — Founder 중재 요청
func (h *DirectiveHandler) Escalate(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var body struct {
		UserName string `json:"user_name"`
		Reason   string `json:"reason"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.EscalateToGOT(uint(id), body.UserName, body.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Founder 중재 요청됨"})
}

// GET /admin/directives/visible — 역할 기반 열람
func (h *DirectiveHandler) ListVisible(c *gin.Context) {
	uid, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	roleTitle := c.Query("role_title")
	roleLayer := c.Query("role_layer")
	list := h.svc.ListVisible(uint(uid), roleTitle, roleLayer)
	c.JSON(http.StatusOK, gin.H{"directives": list})
}

// GET /admin/directives/overdue — 기한 초과 목록
func (h *DirectiveHandler) ListOverdue(c *gin.Context) {
	list := h.svc.ListOverdue()
	c.JSON(http.StatusOK, gin.H{"directives": list, "count": len(list)})
}
