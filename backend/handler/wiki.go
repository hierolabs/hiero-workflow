package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type WikiHandler struct {
	svc *service.WikiService
}

func NewWikiHandler() *WikiHandler {
	return &WikiHandler{svc: service.NewWikiService()}
}

// GET /admin/wiki/toc
func (h *WikiHandler) GetTOC(c *gin.Context) {
	items, err := h.svc.GetTOC()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /admin/wiki/progress
func (h *WikiHandler) GetProgress(c *gin.Context) {
	prog, err := h.svc.GetProgress()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, prog)
}

// GET /admin/wiki/articles/:id
func (h *WikiHandler) GetArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	article, err := h.svc.GetArticle(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}
	c.JSON(http.StatusOK, article)
}

// PUT /admin/wiki/articles/:id
func (h *WikiHandler) UpdateArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req service.UpdateArticleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	authorID := uint(0)
	authorName := "unknown"
	if uid, exists := c.Get("user_id"); exists {
		authorID = uid.(uint)
	}
	if lid, exists := c.Get("login_id"); exists {
		authorName = lid.(string)
	}
	article, err := h.svc.UpdateArticle(uint(id), req, authorID, authorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, article)
}

// PATCH /admin/wiki/articles/:id/assign
func (h *WikiHandler) AssignArticle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req struct {
		AssignedTo string `json:"assigned_to"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.AssignArticle(uint(id), req.AssignedTo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "assigned"})
}

// POST /admin/wiki/articles
func (h *WikiHandler) CreateArticle(c *gin.Context) {
	var req service.CreateArticleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	authorID := uint(0)
	authorName := "unknown"
	if uid, exists := c.Get("user_id"); exists {
		authorID = uid.(uint)
	}
	if lid, exists := c.Get("login_id"); exists {
		authorName = lid.(string)
	}
	article, err := h.svc.CreateArticle(req, authorID, authorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, article)
}

// GET /admin/wiki/articles/:id/revisions
func (h *WikiHandler) GetRevisions(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	revs, err := h.svc.GetRevisions(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"revisions": revs})
}
