package service

import (
	"log"
	"strings"
	"time"

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

// 자동 메시지 패턴 — 호스트가 보낸 자동 안내 메시지
var autoMessagePatterns = []string{
	"숙박 일정이 예약되셨습니다",
	"체크인 정보는 입실 당일",
	"request to book accepted",
	"booking confirmed",
	"reservation confirmed",
	"체크인 시간",
	"체크아웃 시간",
	"안내사항",
	"이용 안내",
}

// 에스컬레이션 대상 카테고리 — 실제 민원/하자로 올려야 하는 것
var escalateCategories = map[string]bool{
	"boiler": true, "cleaning": true, "emergency": true, "parking": true,
}

// DetectFromMessage — 단일 메시지에서 이슈 감지
// HS(자동처리) vs 사람개입 vs 에스컬레이션(민원) 3단 분류
func (s *IssueDetectorService) DetectFromMessage(msg models.Message, conv models.Conversation) *models.IssueDetection {
	if msg.SenderType != "guest" {
		return nil
	}

	content := strings.ToLower(msg.Content)
	if len(content) < 5 {
		return nil
	}

	// 호스트가 이미 응답했는지 확인
	var hostReplyCount int64
	config.DB.Model(&models.Message{}).
		Where("conversation_id = ? AND sender_type = ? AND sent_at > ?",
			conv.ConversationID, "host", msg.SentAt).
		Count(&hostReplyCount)
	hostReplied := hostReplyCount > 0

	for category, keywords := range categoryKeywords {
		matched := []string{}
		for _, kw := range keywords {
			if strings.Contains(content, strings.ToLower(kw)) {
				matched = append(matched, kw)
			}
		}

		if len(matched) < 1 {
			continue
		}

		// 중복 감지 방지 — 같은 대화+카테고리+최근 상태
		var existing models.IssueDetection
		if err := config.DB.Where(
			"conversation_id = ? AND detected_category = ? AND status IN ?",
			conv.ConversationID, category, []string{"pending", "responding", "resolved"},
		).First(&existing).Error; err == nil {
			continue
		}

		// 숙소 이름
		propName := ""
		if conv.InternalPropID != nil {
			var prop models.Property
			if err := config.DB.First(&prop, *conv.InternalPropID).Error; err == nil {
				propName = prop.Name
			}
		}

		detection := &models.IssueDetection{
			ConversationID:   conv.ConversationID,
			ReservationCode:  conv.ReservationCode,
			MessageID:        msg.ID,
			GuestName:        conv.GuestName,
			PropertyName:     propName,
			DetectedCategory: category,
			DetectedKeywords: strings.Join(matched, ", "),
			Severity:         categorySeverity[category],
			MessageContent:   truncateStr(msg.Content, 500),
		}

		now := time.Now()

		if hostReplied {
			// 호스트가 이미 응답 → HS 자동 처리 완료
			detection.Status = "resolved"
			detection.ResolutionSource = "hs"
			detection.ResolutionType = "guide"
			detection.ResolutionTeam = "office"
			detection.ResolvedAt = &now
			detection.ResolutionNote = "HS 자동 — 호스트 응답 완료"
		} else if escalateCategories[category] {
			// 시설/청소/긴급 → 에스컬레이션 (pending + 이슈 자동 생성)
			detection.Status = "pending"
			detection.ResolutionSource = "escalated"
			detection.Severity = categorySeverity[category]
		} else {
			// 예약/체크인 문의 → 사람 대응 필요
			detection.Status = "pending"
			detection.ResolutionSource = "human"
		}

		config.DB.Create(detection)

		// 에스컬레이션: 이슈 자동 생성
		if detection.ResolutionSource == "escalated" && detection.Status == "pending" {
			issue, err := s.CreateIssueFromDetection(detection.ID)
			if err == nil {
				log.Printf("[HS→이슈] 자동 에스컬레이션: %s (%s) → Issue #%d",
					conv.GuestName, category, issue.ID)
			}
		}

		label := "HS"
		if detection.ResolutionSource == "human" {
			label = "HUMAN"
		} else if detection.ResolutionSource == "escalated" {
			label = "ESCALATED"
		}
		log.Printf("[Detect/%s] %s (%s) — %s [%s]",
			label, conv.GuestName, category, strings.Join(matched, ","), detection.Severity)

		return detection
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
		Title:           "[고객문의] " + detection.DetectedCategory + ": " + truncateStr(detection.MessageContent, 50),
		Description:     "게스트: " + detection.GuestName + "\n키워드: " + detection.DetectedKeywords + "\n원문: " + detection.MessageContent,
		IssueType:       issueType,
		Priority:        priority,
		PropertyName:    detection.PropertyName,
		ReservationCode: detection.ReservationCode,
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
