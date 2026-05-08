package handler

import (
	"net/http"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type CSKnowledgeHandler struct{}

func NewCSKnowledgeHandler() *CSKnowledgeHandler {
	return &CSKnowledgeHandler{}
}

// GET /admin/cs-knowledge — 전체 대응 프로세스 목록
func (h *CSKnowledgeHandler) List(c *gin.Context) {
	category := c.Query("category")
	keyword := c.Query("keyword")

	q := config.DB.Where("is_active = ?", true)
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if keyword != "" {
		q = q.Where("keywords LIKE ? OR title LIKE ? OR faq LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	var items []models.CSKnowledge
	q.Order("category, id").Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"items":      items,
		"total":      len(items),
		"categories": models.CSCategories,
	})
}

// GET /admin/cs-knowledge/:id — 단일 조회
func (h *CSKnowledgeHandler) Get(c *gin.Context) {
	var item models.CSKnowledge
	if err := config.DB.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// GET /admin/cs-knowledge/match?text=온수가안나와요 — 키워드 매칭
func (h *CSKnowledgeHandler) Match(c *gin.Context) {
	text := c.Query("text")
	if text == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "text required"})
		return
	}

	var all []models.CSKnowledge
	config.DB.Where("is_active = ?", true).Find(&all)

	type MatchResult struct {
		models.CSKnowledge
		Score int `json:"score"`
	}

	var results []MatchResult
	for _, kb := range all {
		score := 0
		// 키워드 매칭
		for _, kw := range splitKeywords(kb.Keywords) {
			if kw != "" && contains(text, kw) {
				score += 10
			}
		}
		// FAQ 매칭
		if contains(text, kb.FAQ) {
			score += 5
		}
		if score > 0 {
			results = append(results, MatchResult{CSKnowledge: kb, Score: score})
		}
	}

	// 점수 순 정렬
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// 상위 3개만
	if len(results) > 3 {
		results = results[:3]
	}

	c.JSON(http.StatusOK, gin.H{"matches": results})
}

// POST /admin/cs-knowledge — 추가
func (h *CSKnowledgeHandler) Create(c *gin.Context) {
	var item models.CSKnowledge
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.IsActive = true
	config.DB.Create(&item)
	c.JSON(http.StatusCreated, item)
}

// PUT /admin/cs-knowledge/:id — 수정
func (h *CSKnowledgeHandler) Update(c *gin.Context) {
	var item models.CSKnowledge
	if err := config.DB.First(&item, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	config.DB.Save(&item)
	c.JSON(http.StatusOK, item)
}

func splitKeywords(s string) []string {
	var result []string
	current := ""
	for _, ch := range s {
		if ch == ',' {
			result = append(result, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func contains(text, keyword string) bool {
	if keyword == "" {
		return false
	}
	return len(text) >= len(keyword) && indexStr(text, keyword) >= 0
}

func indexStr(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
