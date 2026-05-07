package handler

import (
	"net/http"

	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type LifecycleHandler struct {
	svc *service.LifecycleService
}

func NewLifecycleHandler() *LifecycleHandler {
	return &LifecycleHandler{svc: service.NewLifecycleService()}
}

// PATCH /admin/properties/:id/lifecycle
func (h *LifecycleHandler) UpdateStatus(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status 필수"})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	userName := ""
	if name, ok := c.Get("login_id"); ok {
		userName, _ = name.(string)
	}

	if err := h.svc.UpdateLifecycleStatus(id, req.Status, &uid, userName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "상태 변경 실패"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GET /admin/properties/:id/onboarding
func (h *LifecycleHandler) GetOnboarding(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	// 체크리스트 없으면 자동 생성
	h.svc.InitOnboarding(id)

	checks := h.svc.GetOnboarding(id)
	c.JSON(http.StatusOK, gin.H{"checks": checks})
}

// PATCH /admin/properties/:id/onboarding/:checkId
func (h *LifecycleHandler) ToggleCheck(c *gin.Context) {
	checkID, err := parseUint(c.Param("checkId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	userID, _ := c.Get("user_id")
	uid, _ := userID.(uint)
	userName := ""
	if name, ok := c.Get("login_id"); ok {
		userName, _ = name.(string)
	}

	check, err := h.svc.ToggleCheck(checkID, &uid, userName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "체크 토글 실패"})
		return
	}

	c.JSON(http.StatusOK, check)
}

// GET /admin/properties/:id/platforms
func (h *LifecycleHandler) GetPlatforms(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	platforms := h.svc.GetPlatforms(id)
	c.JSON(http.StatusOK, gin.H{"platforms": platforms})
}

// POST /admin/properties/:id/platforms
func (h *LifecycleHandler) UpsertPlatform(c *gin.Context) {
	id, err := parseUint(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID"})
		return
	}

	var p models.PropertyPlatform
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터 오류"})
		return
	}

	p.PropertyID = id
	result, err := h.svc.UpsertPlatform(p)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "저장 실패"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GET /admin/lifecycle/pipeline
func (h *LifecycleHandler) Pipeline(c *gin.Context) {
	summary := h.svc.GetPipeline()
	c.JSON(http.StatusOK, summary)
}

// GET /admin/investors
func (h *LifecycleHandler) ListInvestors(c *gin.Context) {
	investors := h.svc.ListInvestors()
	c.JSON(http.StatusOK, gin.H{"investors": investors})
}

// POST /admin/investors
func (h *LifecycleHandler) CreateInvestor(c *gin.Context) {
	var inv models.Investor
	if err := c.ShouldBindJSON(&inv); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터 오류"})
		return
	}

	result, err := h.svc.CreateInvestor(inv)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성 실패"})
		return
	}

	c.JSON(http.StatusCreated, result)
}
