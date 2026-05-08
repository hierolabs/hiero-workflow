package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type ChatHistoryHandler struct{}

func NewChatHistoryHandler() *ChatHistoryHandler { return &ChatHistoryHandler{} }

// GET /admin/chat-history — 단톡방 메시지 검색/조회
func (h *ChatHistoryHandler) Search(c *gin.Context) {
	room := c.DefaultQuery("room", "")       // work, cleaning
	sender := c.DefaultQuery("sender", "")
	keyword := c.DefaultQuery("keyword", "")
	season := c.DefaultQuery("season", "")
	startDate := c.DefaultQuery("start", "")
	endDate := c.DefaultQuery("end", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if page < 1 { page = 1 }
	if pageSize > 200 { pageSize = 200 }

	q := config.DB.Model(&models.ChatHistory{})
	if room != "" { q = q.Where("room = ?", room) }
	if sender != "" { q = q.Where("sender LIKE ?", "%"+sender+"%") }
	if keyword != "" { q = q.Where("content LIKE ?", "%"+keyword+"%") }
	if season != "" { q = q.Where("season = ?", season) }
	if startDate != "" { q = q.Where("msg_date >= ?", startDate) }
	if endDate != "" { q = q.Where("msg_date <= ?", endDate) }

	var total int64
	q.Count(&total)

	var msgs []models.ChatHistory
	q.Order("timestamp DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&msgs)

	c.JSON(http.StatusOK, gin.H{
		"messages": msgs, "total": total,
		"page": page, "page_size": pageSize,
	})
}

// GET /admin/chat-history/stats — 통계 요약
func (h *ChatHistoryHandler) Stats(c *gin.Context) {
	room := c.DefaultQuery("room", "")
	season := c.DefaultQuery("season", "")

	type senderCount struct {
		Sender string
		Count  int64
	}

	q := config.DB.Model(&models.ChatHistory{}).Where("sender != 'system'")
	if room != "" { q = q.Where("room = ?", room) }
	if season != "" { q = q.Where("season = ?", season) }

	// 방별 건수
	type roomCount struct { Room string; Count int64 }
	var rooms []roomCount
	config.DB.Model(&models.ChatHistory{}).Select("room, COUNT(*) as count").Group("room").Find(&rooms)

	// 발화자 TOP
	var topSenders []senderCount
	q.Select("sender, COUNT(*) as count").Group("sender").Order("count DESC").Limit(15).Find(&topSenders)

	// 월별 추이
	type monthCount struct { Month string; Count int64 }
	var monthly []monthCount
	q2 := config.DB.Model(&models.ChatHistory{}).Where("sender != 'system'")
	if room != "" { q2 = q2.Where("room = ?", room) }
	if season != "" { q2 = q2.Where("season = ?", season) }
	q2.Select("LEFT(msg_date,7) as month, COUNT(*) as count").Group("month").Order("month").Find(&monthly)

	c.JSON(http.StatusOK, gin.H{
		"rooms": rooms,
		"top_senders": topSenders,
		"monthly": monthly,
	})
}

// GET /admin/chat-history/property — 특정 숙소 관련 대화 검색
func (h *ChatHistoryHandler) PropertyHistory(c *gin.Context) {
	keyword := c.Query("keyword") // 숙소명 또는 코드
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "keyword 필요"})
		return
	}

	var msgs []models.ChatHistory
	config.DB.Where("content LIKE ?", "%"+keyword+"%").
		Order("timestamp DESC").Limit(100).Find(&msgs)

	c.JSON(http.StatusOK, gin.H{"messages": msgs, "total": len(msgs), "keyword": keyword})
}
