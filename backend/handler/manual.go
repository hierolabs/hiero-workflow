package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type ManualHandler struct{}

func NewManualHandler() *ManualHandler {
	return &ManualHandler{}
}

// List returns all manual entries for a given page
func (h *ManualHandler) List(c *gin.Context) {
	page := c.Query("page")
	if page == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page 파라미터가 필요합니다"})
		return
	}

	var entries []models.ManualEntry
	config.DB.Where("page = ?", page).Order("section ASC").Find(&entries)

	c.JSON(http.StatusOK, gin.H{"entries": entries})
}

// Get returns a single manual entry by page+section
func (h *ManualHandler) Get(c *gin.Context) {
	page := c.Query("page")
	section := c.Query("section")

	var entry models.ManualEntry
	if err := config.DB.Where("page = ? AND section = ?", page, section).First(&entry).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "매뉴얼 항목을 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, entry)
}

// Upsert creates or updates a manual entry
func (h *ManualHandler) Upsert(c *gin.Context) {
	var req struct {
		Page    string `json:"page" binding:"required"`
		Section string `json:"section" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "필수 항목을 입력해주세요"})
		return
	}

	userID, _ := c.Get("user_id")
	userName := ""
	if loginID, exists := c.Get("login_id"); exists {
		userName = loginID.(string)
	}

	var entry models.ManualEntry
	result := config.DB.Where("page = ? AND section = ?", req.Page, req.Section).First(&entry)

	if result.Error != nil {
		// Create new
		entry = models.ManualEntry{
			Page:        req.Page,
			Section:     req.Section,
			Title:       req.Title,
			Content:     req.Content,
			UpdatedBy:   userID.(uint),
			UpdatedName: userName,
		}
		config.DB.Create(&entry)
	} else {
		// Update existing
		entry.Title = req.Title
		entry.Content = req.Content
		entry.UpdatedBy = userID.(uint)
		entry.UpdatedName = userName
		config.DB.Save(&entry)
	}

	c.JSON(http.StatusOK, entry)
}

// Delete removes a manual entry
func (h *ManualHandler) Delete(c *gin.Context) {
	page := c.Query("page")
	section := c.Query("section")

	if page == "" || section == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page, section 파라미터가 필요합니다"})
		return
	}

	config.DB.Where("page = ? AND section = ?", page, section).Delete(&models.ManualEntry{})
	c.JSON(http.StatusOK, gin.H{"message": "삭제되었습니다"})
}
