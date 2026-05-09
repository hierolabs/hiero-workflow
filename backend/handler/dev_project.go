package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type DevProjectHandler struct {
	svc *service.DevProjectService
}

func NewDevProjectHandler() *DevProjectHandler {
	return &DevProjectHandler{svc: service.NewDevProjectService()}
}

// GET /admin/dev-projects — 프로젝트 목록 (마일스톤 포함)
func (h *DevProjectHandler) List(c *gin.Context) {
	projects, err := h.svc.ListProjects()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": projects})
}

// GET /admin/dev-projects/:id — 프로젝트 상세
func (h *DevProjectHandler) Get(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	p, err := h.svc.GetProject(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "프로젝트를 찾을 수 없습니다"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// GET /admin/dev-projects/progress — 전체 진행률 (CTO Board용)
func (h *DevProjectHandler) AllProgress(c *gin.Context) {
	result, err := h.svc.GetAllProgress()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": result})
}

// GET /admin/dev-projects/:id/progress — 프로젝트별 진행률
func (h *DevProjectHandler) Progress(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	prog, err := h.svc.GetProjectProgress(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "프로젝트를 찾을 수 없습니다"})
		return
	}
	c.JSON(http.StatusOK, prog)
}

// PATCH /admin/dev-milestones/:id/status — 마일스톤 상태 변경
func (h *DevProjectHandler) UpdateMilestoneStatus(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status 필수"})
		return
	}
	if err := h.svc.UpdateMilestoneStatus(uint(id), req.Status, req.Notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
