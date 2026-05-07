package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type TeamChatHandler struct {
	svc *service.TeamChatService
}

func NewTeamChatHandler() *TeamChatHandler {
	return &TeamChatHandler{svc: service.NewTeamChatService()}
}

// GET /admin/chat/channels — 채널 목록 + 미읽음
func (h *TeamChatHandler) ListChannels(c *gin.Context) {
	userID, _ := c.Get("user_id")
	roleLayer, _ := c.Get("role_layer")
	rl := ""
	if roleLayer != nil {
		rl, _ = roleLayer.(string)
	}

	summaries := h.svc.ListChannelSummaries(userID.(uint), rl)
	c.JSON(http.StatusOK, summaries)
}

// GET /admin/chat/channels/:id/messages — 채널 메시지 목록
func (h *TeamChatHandler) GetMessages(c *gin.Context) {
	channelID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	messages := h.svc.GetMessages(uint(channelID), limit)

	// 읽음 처리
	userID, _ := c.Get("user_id")
	h.svc.UpdateLastRead(uint(channelID), userID.(uint))

	c.JSON(http.StatusOK, messages)
}

// POST /admin/chat/channels/:id/messages — 메시지 전송
func (h *TeamChatHandler) SendMessage(c *gin.Context) {
	channelID, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var body struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "메시지를 입력해주세요"})
		return
	}

	userID, _ := c.Get("user_id")
	var user models.AdminUser
	config.DB.First(&user, userID)

	msg := h.svc.SendMessage(uint(channelID), user.ID, user.Name, user.RoleTitle, body.Content)
	c.JSON(http.StatusOK, msg)
}

// POST /admin/chat/channels — 채널 생성
func (h *TeamChatHandler) CreateChannel(c *gin.Context) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		ChannelType string `json:"channel_type"`
		RoleFilter  string `json:"role_filter"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "채널 이름을 입력해주세요"})
		return
	}

	if body.ChannelType == "" {
		body.ChannelType = "team"
	}

	userID, _ := c.Get("user_id")
	ch := h.svc.CreateChannel(body.Name, body.ChannelType, body.RoleFilter, userID.(uint))
	c.JSON(http.StatusCreated, ch)
}

// POST /admin/chat/forward-issue — 이슈를 담당자에게 채팅으로 전달
func (h *TeamChatHandler) ForwardIssue(c *gin.Context) {
	var body struct {
		IssueID   uint   `json:"issue_id" binding:"required"`
		ChannelID uint   `json:"channel_id" binding:"required"`
		Message   string `json:"message"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "이슈ID와 채널ID를 입력해주세요"})
		return
	}

	userID, _ := c.Get("user_id")
	var user models.AdminUser
	config.DB.First(&user, userID)

	// 이슈 정보 가져오기
	var issue models.Issue
	if err := config.DB.First(&issue, body.IssueID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "이슈를 찾을 수 없습니다"})
		return
	}

	content := body.Message
	if content == "" {
		content = fmt.Sprintf("[이슈 전달] #%d %s\n담당: %s | %s\n%s",
			issue.ID, issue.Title, issue.AssigneeName, issue.Priority, issue.Description)
	}

	msg := h.svc.SendIssueLink(body.ChannelID, user.ID, user.Name, issue.ID, content)
	c.JSON(http.StatusOK, msg)
}
