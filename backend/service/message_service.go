package service

import (
	"log"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/hostex"
	"hiero-workflow/backend/models"
)

type MessageService struct {
	client *hostex.Client
}

func NewMessageService() *MessageService {
	return &MessageService{
		client: hostex.NewClient(),
	}
}

// SyncConversations — Hostex 대화 목록 전체 동기화
func (s *MessageService) SyncConversations() (int, error) {
	convs, err := s.client.GetAllConversations()
	if err != nil {
		return 0, err
	}

	total := 0
	for _, c := range convs {
		s.upsertConversation(c)
		total++
	}

	log.Printf("[MessageSync] 대화 동기화 완료: %d건", total)
	return total, nil
}

// SyncConversationsWithMessages — 대화 + 메시지 본문까지 한 번에 동기화
func (s *MessageService) SyncConversationsWithMessages() (int, int, error) {
	convCount, err := s.SyncConversations()
	if err != nil {
		return 0, 0, err
	}

	// 1순위: preview 없는 대화
	var emptyConvs []models.Conversation
	config.DB.Where("last_message_preview = '' OR last_message_preview IS NULL").
		Order("last_message_at DESC").
		Limit(50).
		Find(&emptyConvs)

	// 2순위: 최근 24시간 내 메시지가 있는 대화 (새 메시지 확인)
	cutoff := time.Now().Add(-24 * time.Hour)
	var recentConvs []models.Conversation
	config.DB.Where("last_message_at > ? AND (last_message_preview != '' AND last_message_preview IS NOT NULL)", cutoff).
		Order("last_message_at DESC").
		Limit(30).
		Find(&recentConvs)

	// 중복 제거
	seen := map[string]bool{}
	var toSync []models.Conversation
	for _, c := range emptyConvs {
		if !seen[c.ConversationID] {
			seen[c.ConversationID] = true
			toSync = append(toSync, c)
		}
	}
	for _, c := range recentConvs {
		if !seen[c.ConversationID] {
			seen[c.ConversationID] = true
			toSync = append(toSync, c)
		}
	}

	msgCount := 0
	for _, conv := range toSync {
		count, err := s.SyncConversationMessages(conv.ConversationID)
		if err != nil {
			log.Printf("[MessageSync] 메시지 동기화 실패 (%s): %s", conv.ConversationID, err)
			continue
		}
		msgCount += count
	}

	log.Printf("[MessageSync] 대화 %d건, 동기화 대상 %d건 (빈 %d + 최근 %d), 새 메시지 %d건",
		convCount, len(toSync), len(emptyConvs), len(recentConvs), msgCount)
	return convCount, msgCount, nil
}

func (s *MessageService) upsertConversation(c hostex.ConversationSummary) {
	var internalPropID *uint
	var propertyID int64
	var reservationCode string

	// 1차: conversation_id로 예약 직접 매칭 (가장 정확)
	var resByConv models.Reservation
	if err := config.DB.Where("conversation_id = ?", c.ID).First(&resByConv).Error; err == nil {
		reservationCode = resByConv.ReservationCode
		if resByConv.InternalPropID != nil {
			internalPropID = resByConv.InternalPropID
		}
		propertyID = resByConv.PropertyID
	}

	// 2차: property_title로 property 찾기
	if internalPropID == nil {
		var prop models.Property
		if c.PropertyTitle != "" {
			if err := config.DB.Where("name = ?", c.PropertyTitle).First(&prop).Error; err == nil {
				internalPropID = &prop.ID
				propertyID = prop.HostexID
			}
		}
	}

	// 3차: 체크인/체크아웃으로 예약 매칭
	if reservationCode == "" && internalPropID != nil && c.CheckInDate != "" {
		var res models.Reservation
		if err := config.DB.Where("internal_prop_id = ? AND check_in_date = ?", *internalPropID, c.CheckInDate).
			First(&res).Error; err == nil {
			reservationCode = res.ReservationCode
		}
	}

	var lastMsgAt *time.Time
	if c.LastMessageAt != "" {
		if t, err := time.Parse(time.RFC3339, c.LastMessageAt); err == nil {
			lastMsgAt = &t
		}
	}

	conv := models.Conversation{
		ConversationID:  c.ID,
		ReservationCode: reservationCode,
		PropertyID:      propertyID,
		InternalPropID:  internalPropID,
		GuestName:       c.Guest.Name,
		ChannelType:     c.ChannelType,
		LastMessageAt:   lastMsgAt,
	}

	var existing models.Conversation
	if err := config.DB.Where("conversation_id = ?", c.ID).First(&existing).Error; err != nil {
		config.DB.Create(&conv)
	} else {
		config.DB.Model(&existing).Updates(map[string]interface{}{
			"reservation_code": conv.ReservationCode,
			"property_id":     conv.PropertyID,
			"internal_prop_id": conv.InternalPropID,
			"guest_name":      conv.GuestName,
			"channel_type":    conv.ChannelType,
			"last_message_at": conv.LastMessageAt,
		})
	}
}

// SyncConversationMessages — 특정 대화의 메시지 동기화
func (s *MessageService) SyncConversationMessages(conversationID string) (int, error) {
	msgs, resCode, err := s.client.GetConversationMessages(conversationID)
	if err != nil {
		return 0, err
	}

	// reservation_code가 있으면 대화에 연결
	if resCode != "" {
		config.DB.Model(&models.Conversation{}).
			Where("conversation_id = ? AND (reservation_code = '' OR reservation_code IS NULL)", conversationID).
			Update("reservation_code", resCode)
	}

	total := 0
	for _, m := range msgs {
		sentAt, _ := time.Parse(time.RFC3339, m.CreatedAt)

		msgType := "text"
		if m.DisplayType == "Image" {
			msgType = "image"
		}

		imageURL := m.GetAttachmentURL()

		msg := models.Message{
			ConversationID:  conversationID,
			HostexMessageID: m.ID,
			SenderType:      m.SenderRole,
			Content:         m.Content,
			MessageType:     msgType,
			ImageURL:        imageURL,
			SentAt:          sentAt,
		}

		var existing models.Message
		if err := config.DB.Where("hostex_message_id = ?", m.ID).First(&existing).Error; err != nil {
			config.DB.Create(&msg)
			total++
		}
	}

	// last_message 업데이트
	if len(msgs) > 0 {
		last := msgs[len(msgs)-1]
		sentAt, _ := time.Parse(time.RFC3339, last.CreatedAt)
		config.DB.Model(&models.Conversation{}).
			Where("conversation_id = ?", conversationID).
			Updates(map[string]interface{}{
				"last_message_at":      sentAt,
				"last_message_preview": truncate(last.Content, 500),
			})
	}

	return total, nil
}

// SyncAllMessages — 모든 대화의 메시지를 전부 동기화
func (s *MessageService) SyncAllMessages() (int, int, error) {
	var conversations []models.Conversation
	config.DB.Find(&conversations)

	totalConvs := 0
	totalMsgs := 0
	for _, conv := range conversations {
		count, err := s.SyncConversationMessages(conv.ConversationID)
		if err != nil {
			log.Printf("[MessageSync] 메시지 동기화 실패 (%s): %s", conv.ConversationID, err)
			continue
		}
		totalConvs++
		totalMsgs += count
		if count > 0 {
			log.Printf("[MessageSync] %s: %d건 새 메시지 (누적 대화 %d/%d)", conv.GuestName, count, totalConvs, len(conversations))
		}
	}

	log.Printf("[MessageSync] 전체 메시지 동기화 완료: %d개 대화, %d건 새 메시지", totalConvs, totalMsgs)
	return totalConvs, totalMsgs, nil
}

// HandleIncomingMessage — 웹훅 message_created 처리
func (s *MessageService) HandleIncomingMessage(reservationCode string) {
	if reservationCode == "" {
		return
	}

	// 예약에서 conversation_id 조회
	var res models.Reservation
	if err := config.DB.Where("reservation_code = ?", reservationCode).First(&res).Error; err != nil {
		log.Printf("[Message] 예약 없음: %s", reservationCode)
		return
	}

	conversationID := res.ConversationID

	// conversation_id가 없으면 Hostex API에서 예약 다시 조회해서 가져오기
	if conversationID == "" {
		log.Printf("[Message] conversation_id 없음, Hostex에서 재조회: %s", reservationCode)
		syncSvc := NewHostexSyncService()
		reservations, err := syncSvc.FetchReservationByCode(reservationCode)
		if err == nil && len(reservations) > 0 {
			conversationID = reservations[0].ConversationID
			if conversationID != "" {
				// DB에 conversation_id 업데이트
				config.DB.Model(&res).Update("conversation_id", conversationID)
				log.Printf("[Message] conversation_id 업데이트: %s → %s", reservationCode, conversationID)
			}
		}
	}

	if conversationID == "" {
		// 마지막 시도: reservation_code로 대화 DB 검색
		var conv models.Conversation
		if err := config.DB.Where("reservation_code = ?", reservationCode).First(&conv).Error; err == nil {
			conversationID = conv.ConversationID
		}
	}

	if conversationID == "" {
		log.Printf("[Message] conversation_id를 찾을 수 없음: %s", reservationCode)
		return
	}

	// 대화가 DB에 없으면 생성
	var conv models.Conversation
	if err := config.DB.Where("conversation_id = ?", conversationID).First(&conv).Error; err != nil {
		conv = models.Conversation{
			ConversationID:  conversationID,
			ReservationCode: reservationCode,
			PropertyID:      res.PropertyID,
			InternalPropID:  res.InternalPropID,
			GuestName:       res.GuestName,
			ChannelType:     res.ChannelType,
		}
		config.DB.Create(&conv)
	}

	// 최신 메시지 동기화
	newCount, err := s.SyncConversationMessages(conversationID)
	if err != nil {
		log.Printf("[Message] 메시지 동기화 실패 (%s): %s", conversationID, err)
		return
	}

	// unread_count 증가
	if newCount > 0 {
		config.DB.Model(&models.Conversation{}).
			Where("conversation_id = ?", conversationID).
			Update("unread_count", conv.UnreadCount+newCount)

		// 새 게스트 메시지 자동 감지
		detector := NewIssueDetectorService()
		var recentMsgs []models.Message
		config.DB.Where("conversation_id = ? AND sender_type = ?", conversationID, "guest").
			Order("sent_at DESC").Limit(newCount).Find(&recentMsgs)
		for _, msg := range recentMsgs {
			if d := detector.DetectFromMessage(msg, conv); d != nil {
				log.Printf("[Webhook→Detect] 자동 감지: %s (%s) — %s",
					conv.GuestName, d.DetectedCategory, d.Severity)
			}
		}
	}

	log.Printf("[Message] 새 메시지 %d건 동기화: %s (reservation: %s)", newCount, conversationID, reservationCode)
}

// SendMessage — 메시지 발송 + DB 저장
func (s *MessageService) SendMessage(conversationID string, content string) (*models.Message, error) {
	if err := s.client.SendTextMessage(conversationID, content); err != nil {
		return nil, err
	}

	now := time.Now()
	msg := models.Message{
		ConversationID:  conversationID,
		HostexMessageID: "host_" + now.Format("20060102150405"),
		SenderType:      "host",
		Content:         content,
		MessageType:     "text",
		SentAt:          now,
	}
	config.DB.Create(&msg)

	// last_message 업데이트
	config.DB.Model(&models.Conversation{}).
		Where("conversation_id = ?", conversationID).
		Updates(map[string]interface{}{
			"last_message_at":      now,
			"last_message_preview": truncate(content, 500),
		})

	return &msg, nil
}

// MarkRead — 읽음 처리
func (s *MessageService) MarkRead(conversationID string) {
	config.DB.Model(&models.Conversation{}).
		Where("conversation_id = ?", conversationID).
		Update("unread_count", 0)
}

// ListConversations — 대화 목록 (필터, 페이징)
func (s *MessageService) ListConversations(propertyID int64, keyword string, hasUnread bool, page, pageSize int) ([]models.Conversation, int64, error) {
	query := config.DB.Model(&models.Conversation{})

	if propertyID > 0 {
		query = query.Where("property_id = ?", propertyID)
	}
	if keyword != "" {
		query = query.Where("guest_name LIKE ?", "%"+keyword+"%")
	}
	if hasUnread {
		query = query.Where("unread_count > 0")
	}

	var total int64
	query.Count(&total)

	var convs []models.Conversation
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 30
	}
	query.Order("last_message_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&convs)

	return convs, total, nil
}

// GetMessages — 대화 메시지 목록
func (s *MessageService) GetMessages(conversationID string) ([]models.Message, error) {
	var msgs []models.Message
	err := config.DB.Where("conversation_id = ?", conversationID).
		Order("sent_at ASC").
		Find(&msgs).Error
	return msgs, err
}

// GetConversation — 대화 상세
func (s *MessageService) GetConversation(conversationID string) (*models.Conversation, error) {
	var conv models.Conversation
	err := config.DB.Where("conversation_id = ?", conversationID).First(&conv).Error
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen])
}
