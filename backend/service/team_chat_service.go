package service

import (
	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type TeamChatService struct{}

func NewTeamChatService() *TeamChatService {
	return &TeamChatService{}
}

// --- 채널 ---

func (s *TeamChatService) ListChannels(userRoleLayer string) []models.ChatChannel {
	var channels []models.ChatChannel
	config.DB.Where("role_filter = '' OR role_filter = ?", userRoleLayer).
		Order("channel_type ASC, name ASC").
		Find(&channels)
	return channels
}

func (s *TeamChatService) CreateChannel(name, channelType, roleFilter string, createdByID uint) models.ChatChannel {
	ch := models.ChatChannel{
		Name:        name,
		ChannelType: channelType,
		RoleFilter:  roleFilter,
		CreatedByID: &createdByID,
	}
	config.DB.Create(&ch)
	return ch
}

// --- 메시지 ---

type ChatMessageWithUnread struct {
	models.ChatMessage
	IsNew bool `json:"is_new"`
}

func (s *TeamChatService) GetMessages(channelID uint, limit int) []models.ChatMessage {
	if limit <= 0 {
		limit = 50
	}
	var messages []models.ChatMessage
	config.DB.Where("channel_id = ?", channelID).
		Order("created_at DESC").
		Limit(limit).
		Find(&messages)

	// 역순으로 반환 (오래된 것 → 최신)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages
}

func (s *TeamChatService) SendMessage(channelID, senderID uint, senderName, senderRole, content string) models.ChatMessage {
	msg := models.ChatMessage{
		ChannelID:   channelID,
		SenderID:    senderID,
		SenderName:  senderName,
		SenderRole:  senderRole,
		Content:     content,
		MessageType: "text",
	}
	config.DB.Create(&msg)

	// 멤버 last_read 업데이트
	s.UpdateLastRead(channelID, senderID)

	return msg
}

// SendIssueLink — 이슈 링크 메시지 (이슈가 에스컬레이트 되거나 생성될 때)
func (s *TeamChatService) SendIssueLink(channelID, senderID uint, senderName string, issueID uint, content string) models.ChatMessage {
	msg := models.ChatMessage{
		ChannelID:   channelID,
		SenderID:    senderID,
		SenderName:  senderName,
		Content:     content,
		MessageType: "issue_link",
		RefIssueID:  &issueID,
	}
	config.DB.Create(&msg)
	return msg
}

// --- 읽음 처리 ---

func (s *TeamChatService) UpdateLastRead(channelID, userID uint) {
	var member models.ChatChannelMember
	if err := config.DB.Where("channel_id = ? AND user_id = ?", channelID, userID).First(&member).Error; err != nil {
		member = models.ChatChannelMember{
			ChannelID: channelID,
			UserID:    userID,
		}
		config.DB.Create(&member)
	}
	config.DB.Model(&member).Update("last_read", config.DB.NowFunc())
}

// GetUnreadCounts — 사용자별 채널 미읽음 수
func (s *TeamChatService) GetUnreadCounts(userID uint) map[uint]int64 {
	channels := s.ListChannels("")
	result := make(map[uint]int64, len(channels))

	for _, ch := range channels {
		var member models.ChatChannelMember
		var count int64

		if err := config.DB.Where("channel_id = ? AND user_id = ?", ch.ID, userID).First(&member).Error; err != nil {
			// 아직 멤버가 아니면 전체 메시지 수
			config.DB.Model(&models.ChatMessage{}).Where("channel_id = ?", ch.ID).Count(&count)
		} else {
			config.DB.Model(&models.ChatMessage{}).
				Where("channel_id = ? AND created_at > ?", ch.ID, member.LastRead).
				Count(&count)
		}
		result[ch.ID] = count
	}

	return result
}

// ChannelSummary — 채널 목록 + 마지막 메시지 + 미읽음
type ChannelSummary struct {
	models.ChatChannel
	LastMessage string `json:"last_message"`
	LastSender  string `json:"last_sender"`
	UnreadCount int64  `json:"unread_count"`
}

func (s *TeamChatService) ListChannelSummaries(userID uint, userRoleLayer string) []ChannelSummary {
	channels := s.ListChannels(userRoleLayer)
	unreads := s.GetUnreadCounts(userID)

	summaries := make([]ChannelSummary, 0, len(channels))
	for _, ch := range channels {
		var lastMsg models.ChatMessage
		config.DB.Where("channel_id = ?", ch.ID).Order("created_at DESC").First(&lastMsg)

		summaries = append(summaries, ChannelSummary{
			ChatChannel: ch,
			LastMessage: truncateStr(lastMsg.Content, 50),
			LastSender:  lastMsg.SenderName,
			UnreadCount: unreads[ch.ID],
		})
	}
	return summaries
}
