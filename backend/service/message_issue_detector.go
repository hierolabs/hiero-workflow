package service

import (
	"log"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type IssueDetectorService struct {
	issueSvc *IssueService
}

func NewIssueDetectorService() *IssueDetectorService {
	return &IssueDetectorService{issueSvc: NewIssueService()}
}

// 카테고리별 키워드 (통화분석 기반 6대 이슈)
var categoryKeywords = map[string][]string{
	"checkin": {
		"비밀번호", "비번", "출입", "현관", "도어락", "문이 안", "열리지", "잠겨", "체크인",
		"입실", "호실", "방 번호", "얼리체크인", "짐 보관", "열쇠",
	},
	"parking": {
		"주차", "차량", "출차", "주차비", "주차 등록", "기계식", "SUV", "전기차",
		"차 빼", "주차장", "주차권", "정기권",
	},
	"boiler": {
		"온수", "보일러", "난방", "에러코드", "뜨거운 물", "차가운 물", "가스",
		"히터", "온도", "따뜻", "춥", "추워", "안 나와",
	},
	"cleaning": {
		"청소", "더러", "냄새", "머리카락", "수건", "침구", "이불", "베개",
		"바퀴벌레", "벌레", "곰팡이", "세탁기", "TV", "리모컨", "와이파이", "wifi",
		"인터넷", "고장", "안 켜", "작동", "누수",
	},
	"reservation": {
		"연장", "환불", "취소", "결제", "입금", "추가 요금", "영수증", "세금계산서",
		"위약금", "퇴실", "체크아웃", "레이트체크아웃",
	},
	"emergency": {
		"위험", "화재", "불이", "연기", "119", "경찰", "112", "누군가", "침입",
		"도둑", "응급", "다쳤", "깨진", "폭발", "가스 냄새",
	},
}

var categorySeverity = map[string]string{
	"checkin":     "medium",
	"parking":     "medium",
	"boiler":      "high",
	"cleaning":    "medium",
	"reservation": "low",
	"emergency":   "critical",
}

var categoryIssueType = map[string]string{
	"checkin":     "guest",
	"parking":     "facility",
	"boiler":      "facility",
	"cleaning":    "cleaning",
	"reservation": "settlement",
	"emergency":   "decision",
}

// DetectFromMessage — 단일 메시지에서 이슈 감지
func (s *IssueDetectorService) DetectFromMessage(msg models.Message, conv models.Conversation) *models.IssueDetection {
	if msg.SenderType != "guest" {
		return nil
	}

	content := strings.ToLower(msg.Content)
	if len(content) < 5 {
		return nil
	}

	for category, keywords := range categoryKeywords {
		matched := []string{}
		for _, kw := range keywords {
			if strings.Contains(content, strings.ToLower(kw)) {
				matched = append(matched, kw)
			}
		}

		if len(matched) >= 1 {
			// 중복 감지 방지 — 같은 대화+카테고리+pending 있으면 스킵
			var existing models.IssueDetection
			if err := config.DB.Where(
				"conversation_id = ? AND detected_category = ? AND status = ?",
				conv.ConversationID, category, "pending",
			).First(&existing).Error; err == nil {
				continue
			}

			detection := &models.IssueDetection{
				ConversationID:   conv.ConversationID,
				MessageID:        msg.ID,
				GuestName:        conv.GuestName,
				PropertyName:     "",
				DetectedCategory: category,
				DetectedKeywords: strings.Join(matched, ", "),
				Severity:         categorySeverity[category],
				MessageContent:   truncateStr(msg.Content, 500),
				Status:           "pending",
			}

			// 숙소 이름 가져오기
			if conv.InternalPropID != nil {
				var prop models.Property
				if err := config.DB.First(&prop, *conv.InternalPropID).Error; err == nil {
					detection.PropertyName = prop.Name
				}
			}

			config.DB.Create(detection)
			log.Printf("[IssueDetect] 감지: %s (%s) — %s [%s]",
				conv.GuestName, category, strings.Join(matched, ","), detection.Severity)

			return detection
		}
	}

	return nil
}

// ScanRecentMessages — 최근 미스캔 메시지에서 이슈 감지
func (s *IssueDetectorService) ScanRecentMessages(limit int) int {
	if limit <= 0 {
		limit = 100
	}

	// 아직 스캔 안 된 guest 메시지 조회
	var messages []models.Message
	config.DB.Where("sender_type = ?", "guest").
		Order("created_at DESC").
		Limit(limit).
		Find(&messages)

	detected := 0
	for _, msg := range messages {
		// 이미 감지된 메시지인지 확인
		var existing models.IssueDetection
		if err := config.DB.Where("message_id = ?", msg.ID).First(&existing).Error; err == nil {
			continue
		}

		var conv models.Conversation
		if err := config.DB.Where("conversation_id = ?", msg.ConversationID).First(&conv).Error; err != nil {
			continue
		}

		if d := s.DetectFromMessage(msg, conv); d != nil {
			detected++
		}
	}

	if detected > 0 {
		log.Printf("[IssueDetect] %d건 새 이슈 감지", detected)
	}
	return detected
}

// CreateIssueFromDetection — 감지된 이슈를 실제 이슈로 생성
func (s *IssueDetectorService) CreateIssueFromDetection(detectionID uint) (*models.Issue, error) {
	var detection models.IssueDetection
	if err := config.DB.First(&detection, detectionID).Error; err != nil {
		return nil, err
	}

	if detection.Status != "pending" {
		return nil, ErrNotFound
	}

	issueType := categoryIssueType[detection.DetectedCategory]
	if issueType == "" {
		issueType = "other"
	}

	priority := "P2"
	if detection.Severity == "critical" {
		priority = "P0"
	} else if detection.Severity == "high" {
		priority = "P1"
	}

	issue := models.Issue{
		Title:        "[고객문의] " + detection.DetectedCategory + ": " + truncateStr(detection.MessageContent, 50),
		Description:  "게스트: " + detection.GuestName + "\n키워드: " + detection.DetectedKeywords + "\n원문: " + detection.MessageContent,
		IssueType:    issueType,
		Priority:     priority,
		PropertyName: detection.PropertyName,
	}

	created, err := s.issueSvc.Create(issue)
	if err != nil {
		return nil, err
	}

	// 감지 상태 업데이트
	config.DB.Model(&detection).Updates(map[string]interface{}{
		"status":           "issue_created",
		"created_issue_id": created.ID,
	})

	return &created, nil
}

// DismissDetection — 감지 무시
func (s *IssueDetectorService) DismissDetection(detectionID uint) error {
	return config.DB.Model(&models.IssueDetection{}).
		Where("id = ?", detectionID).
		Update("status", "dismissed").Error
}

// ListPending — 미처리 감지 목록
func (s *IssueDetectorService) ListPending() []models.IssueDetection {
	var detections []models.IssueDetection
	config.DB.Where("status = ?", "pending").
		Order("FIELD(severity, 'critical', 'high', 'medium', 'low'), created_at DESC").
		Limit(50).
		Find(&detections)
	return detections
}

func truncateStr(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen]) + "..."
}
