package service

import (
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CSAgentService struct{}

func NewCSAgentService() *CSAgentService {
	return &CSAgentService{}
}

// CSResponse — 민원 대응 제안
type CSResponse struct {
	Category     string `json:"category"`
	Severity     string `json:"severity"`
	SuggestedReply string `json:"suggested_reply"`
	ManualRef    string `json:"manual_ref"`
	AssignTo     string `json:"assign_to"`
	AssignRole   string `json:"assign_role"`
}

// AnalyzeAndSuggest — 게스트 메시지 분석 + 응답 제안
func (s *CSAgentService) AnalyzeAndSuggest(guestMessage string, guestName string) CSResponse {
	msg := strings.ToLower(guestMessage)

	// 카테고리 감지
	category := detectCategory(msg)
	severity := categorySeverity[category]
	if severity == "" {
		severity = "low"
	}

	// 매뉴얼에서 대응 가이드 조회
	manualRef := ""
	var manual models.ManualEntry
	if err := config.DB.Where("page = ? AND section = ?", "cs", category).First(&manual).Error; err == nil {
		manualRef = manual.Content
	}

	// 응답 템플릿 생성
	reply := generateReply(category, guestName, guestMessage, manualRef)

	// 담당자 배정
	target := AssignIssueByType(categoryIssueType[category])

	return CSResponse{
		Category:       category,
		Severity:       severity,
		SuggestedReply: reply,
		ManualRef:      truncateStr(manualRef, 300),
		AssignTo:       target.Name,
		AssignRole:     target.RoleTitle,
	}
}

func detectCategory(msg string) string {
	for cat, keywords := range categoryKeywords {
		for _, kw := range keywords {
			if strings.Contains(msg, strings.ToLower(kw)) {
				return cat
			}
		}
	}
	return "general"
}

func generateReply(category, guestName, originalMsg, manualRef string) string {
	name := guestName
	if name == "" {
		name = "고객"
	}

	// 카테고리별 응답 템플릿
	templates := map[string]string{
		"checkin": name + "님 안녕하세요.\n체크인 관련 문의 감사합니다.\n안내 드린 비밀번호와 출입 방법을 다시 확인 부탁드립니다.\n공동현관과 객실 비밀번호가 다를 수 있으니, 안내 메시지를 한번 더 확인해 주세요.\n계속 문제가 있으시면 바로 연락 주시면 빠르게 도와드리겠습니다.",

		"parking": name + "님 안녕하세요.\n주차 관련 문의 감사합니다.\n차량번호를 알려주시면 주차 등록을 도와드리겠습니다.\n기계식 주차장의 경우 차량 크기에 따라 이용이 제한될 수 있으니, 차종도 함께 알려주시면 확인해 드리겠습니다.",

		"boiler": name + "님 안녕하세요.\n온수/보일러 관련 불편을 드려 죄송합니다.\n먼저 보일러 전원이 켜져 있는지, 온수 모드가 설정되어 있는지 확인해 주세요.\n에러코드가 보이시면 사진을 보내주시면 빠르게 확인해 드리겠습니다.\n계속 온수가 나오지 않으면 바로 조치하겠습니다.",

		"cleaning": name + "님 안녕하세요.\n청소/시설 관련 불편을 드려 죄송합니다.\n불편하신 부분을 사진으로 보내주시면 확인 후 바로 조치하겠습니다.\n추가 수건이나 비품이 필요하시면 말씀해 주세요.",

		"reservation": name + "님 안녕하세요.\n예약 관련 문의 감사합니다.\n예약 내용을 확인하고 가능한 빠르게 안내 드리겠습니다.\n추가 문의사항이 있으시면 편하게 말씀해 주세요.",

		"emergency": name + "님 안녕하세요.\n먼저 안전한 곳에 계신지 확인 부탁드립니다.\n상황을 자세히 알려주시면 즉시 도움을 드리겠습니다.\n위급한 상황이시면 119 또는 112에 먼저 연락해 주세요.",
	}

	if reply, ok := templates[category]; ok {
		return reply
	}

	return name + "님 안녕하세요.\n문의 감사합니다. 확인 후 빠르게 안내 드리겠습니다."
}
