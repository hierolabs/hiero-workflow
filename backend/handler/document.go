package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type DocumentHandler struct{}

func NewDocumentHandler() *DocumentHandler { return &DocumentHandler{} }

const uploadDir = "./uploads"

func init() {
	// 카테고리별 디렉토리 생성
	dirs := []string{
		"contract", "report", "tax", "hr",
		"operation", "csv_backup", "photo", "other",
	}
	for _, d := range dirs {
		os.MkdirAll(filepath.Join(uploadDir, d), 0755)
	}
}

// POST /admin/documents/upload
func (h *DocumentHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 선택해주세요"})
		return
	}

	category := c.PostForm("category")
	if category == "" {
		category = "other"
	}
	subCategory := c.PostForm("sub_category")
	description := c.PostForm("description")
	propertyID := c.PostForm("property_id")
	wikiArticleID := c.PostForm("wiki_article_id")
	yearStr := c.PostForm("year")
	monthStr := c.PostForm("month")

	userID, _ := c.Get("user_id")
	loginID, _ := c.Get("login_id")

	// 파일명 생성: YYYYMMDD_HHMMSS_원본명
	now := time.Now()
	safeName := fmt.Sprintf("%s_%s", now.Format("20060102_150405"), file.Filename)
	storagePath := filepath.Join(uploadDir, category, safeName)

	if err := c.SaveUploadedFile(file, storagePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "파일 저장 실패: " + err.Error()})
		return
	}

	doc := models.Document{
		FileName:     file.Filename,
		StoragePath:  storagePath,
		FileSize:     file.Size,
		MimeType:     file.Header.Get("Content-Type"),
		Category:     category,
		SubCategory:  subCategory,
		Description:  description,
		UploadedBy:   userID.(uint),
		UploaderName: loginID.(string),
		Year:         now.Year(),
	}

	if propertyID != "" {
		if v, err := strconv.ParseUint(propertyID, 10, 64); err == nil {
			pid := uint(v)
			doc.PropertyID = &pid
		}
	}
	if wikiArticleID != "" {
		if v, err := strconv.ParseUint(wikiArticleID, 10, 64); err == nil {
			wid := uint(v)
			doc.WikiArticleID = &wid
		}
	}
	if yearStr != "" {
		if v, err := strconv.Atoi(yearStr); err == nil {
			doc.Year = v
		}
	}
	if monthStr != "" {
		if v, err := strconv.Atoi(monthStr); err == nil {
			doc.Month = v
		}
	}

	config.DB.Create(&doc)
	c.JSON(http.StatusOK, doc)
}

// GET /admin/documents
func (h *DocumentHandler) List(c *gin.Context) {
	category := c.Query("category")
	wikiID := c.Query("wiki_article_id")
	propertyID := c.Query("property_id")
	year := c.Query("year")

	q := config.DB.Model(&models.Document{}).Order("created_at DESC")
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if wikiID != "" {
		q = q.Where("wiki_article_id = ?", wikiID)
	}
	if propertyID != "" {
		q = q.Where("property_id = ?", propertyID)
	}
	if year != "" {
		q = q.Where("year = ?", year)
	}

	var docs []models.Document
	q.Limit(200).Find(&docs)

	c.JSON(http.StatusOK, gin.H{"documents": docs})
}

// GET /admin/documents/:id/download
func (h *DocumentHandler) Download(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var doc models.Document
	if err := config.DB.First(&doc, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "문서를 찾을 수 없습니다"})
		return
	}

	if _, err := os.Stat(doc.StoragePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "파일이 서버에 존재하지 않습니다"})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", doc.FileName))
	c.File(doc.StoragePath)
}

// DELETE /admin/documents/:id
func (h *DocumentHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var doc models.Document
	if err := config.DB.First(&doc, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "문서를 찾을 수 없습니다"})
		return
	}

	os.Remove(doc.StoragePath)
	config.DB.Delete(&doc)
	c.JSON(http.StatusOK, gin.H{"message": "삭제되었습니다"})
}

// GET /admin/documents/summary
func (h *DocumentHandler) Summary(c *gin.Context) {
	type catStat struct {
		Category string `json:"category"`
		Count    int64  `json:"count"`
		SizeMB   float64 `json:"size_mb"`
	}

	var stats []catStat
	config.DB.Model(&models.Document{}).
		Select("category, COUNT(*) as count, ROUND(SUM(file_size)/1024/1024, 2) as size_mb").
		Group("category").
		Order("count DESC").
		Scan(&stats)

	// 전체 합계
	var total int64
	var totalSize float64
	for _, s := range stats {
		total += s.Count
		totalSize += s.SizeMB
	}

	// uploads 폴더 실제 크기
	var diskMB float64
	filepath.Walk(uploadDir, func(_ string, info os.FileInfo, _ error) error {
		if info != nil && !info.IsDir() {
			diskMB += float64(info.Size()) / 1024 / 1024
		}
		return nil
	})

	catLabels := map[string]string{
		"contract": "계약서", "report": "보고서", "tax": "세무",
		"hr": "인사·급여", "operation": "운영", "csv_backup": "CSV 백업",
		"photo": "사진", "other": "기타",
	}

	type result struct {
		Label string `json:"label"`
		catStat
	}
	labeled := []result{}
	for _, s := range stats {
		labeled = append(labeled, result{
			Label:   catLabels[s.Category],
			catStat: s,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"categories":  labeled,
		"total_files": total,
		"total_mb":    fmt.Sprintf("%.2f", totalSize),
		"disk_mb":     fmt.Sprintf("%.2f", diskMB),
		"storage_path": func() string { abs, _ := filepath.Abs(uploadDir); return abs }(),
	})
}

// 확장자에서 카테고리 추천
func suggestCategory(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".csv", ".xlsx", ".xls":
		return "csv_backup"
	case ".jpg", ".jpeg", ".png", ".heic", ".webp":
		return "photo"
	case ".pdf":
		return "contract" // PDF는 보통 계약서
	default:
		return "other"
	}
}
