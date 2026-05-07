package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type AiAgentHandler struct{}

func NewAiAgentHandler() *AiAgentHandler {
	return &AiAgentHandler{}
}

type AgentRequest struct {
	Page    string `json:"page" binding:"required"`
	Message string `json:"message" binding:"required"`
	Data    string `json:"data"`
}

var pagePrompts = map[string]string{
	"dashboard": `당신은 HIERO 경영 대시보드 AI 에이전트입니다.
역할: CEO/운영자가 의사결정을 빠르게 내릴 수 있도록 경영 데이터를 분석합니다.
할 수 있는 일:
- KPI 이상치 탐지 및 원인 분석
- 매출 추이 해석 및 예측
- 채널별/권역별 성과 비교
- 문제 숙소 식별 및 조치 제안
- 비용 구조 분석 및 절감 포인트 제안
답변 시 반드시 수치와 근거를 제시하세요.`,

	"reservations": `당신은 HIERO 예약 관리 AI 에이전트입니다.
역할: 예약 데이터를 분석하고 운영 인사이트를 제공합니다.
할 수 있는 일:
- 예약 패턴 분석 (요일별, 채널별, 숙소별)
- 노쇼/취소 위험 예측
- 가동률 최적화 제안
- ADR(평균 객실 단가) 분석
- 체크인/체크아웃 집중 시간대 분석
- 장기 체류 vs 단기 체류 비율 분석`,

	"settlement": `당신은 HIERO 정산 관리 AI 에이전트입니다.
역할: 정산 데이터를 분석하고 재무 이상을 탐지합니다.
할 수 있는 일:
- 3가지 매출 기준(예약일/입금일/숙박일) 차이 분석
- 미정산 건 알림 및 추적
- 채널별 수수료율 비교
- 정산 이상치 탐지 (비정상 금액, 중복 등)
- 월별 정산 추이 분석
- 비용 항목별 비중 분석`,

	"profit": `당신은 HIERO 수익성 분석 AI 에이전트입니다.
역할: 숙소별 수익성을 분석하고 투자 판단을 지원합니다.
할 수 있는 일:
- 숙소별 ROI 분석
- 적자 숙소 원인 분석 및 개선 제안
- 권역별 수익률 비교
- 비용 구조 최적화 제안
- 임대료 적정성 평가
- 신규 숙소 투자 타당성 분석`,

	"cleaning": `당신은 HIERO 청소 관리 AI 에이전트입니다.
역할: 청소 작업을 분석하고 배정 최적화를 지원합니다.
할 수 있는 일:
- 청소 완료율 분석 및 병목 탐지
- 청소자별 작업량/효율 비교
- 배정 최적화 제안 (동선, 시간대)
- 추가 비용 발생 패턴 분석
- 청소 누락 위험 감지
- 권역별 청소 수요 예측`,

	"issues": `당신은 HIERO 민원/하자 관리 AI 에이전트입니다.
역할: 이슈를 분석하고 대응 우선순위를 제안합니다.
할 수 있는 일:
- 이슈 우선순위 자동 분류
- 반복 이슈 패턴 탐지 (같은 숙소, 같은 유형)
- 대응 시간 분석 및 SLA 모니터링
- 비용 영향 분석
- 예방 조치 제안
- 게스트 응대 스크립트 생성`,

	"team": `당신은 HIERO 팀 관리 AI 에이전트입니다.
역할: 팀원별 업무량과 성과를 분석합니다.
할 수 있는 일:
- 팀원별 KPI 분석 및 비교
- 업무 부하 균형 분석
- 권역별 인력 배치 최적화
- 이슈 해결 속도 분석
- 청소 작업 효율 비교
- 팀 성과 리포트 생성`,

	"properties": `당신은 HIERO 숙소 관리 AI 에이전트입니다.
역할: 숙소 현황을 분석하고 운영 최적화를 지원합니다.
할 수 있는 일:
- 숙소 상태별 분석 (운영중/중단/수리)
- 권역별 포트폴리오 분석
- 숙소 타입별 성과 비교
- 운영 중단 숙소 복구 우선순위 제안
- 신규 숙소 추가 시 권역 분석
- 임대 계약 만료 알림`,
}

// Ask — 페이지별 AI Agent 대화 (기억 + 크로스페이지 컨텍스트 포함)
func (h *AiAgentHandler) Ask(c *gin.Context) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OPENAI_API_KEY가 설정되지 않았습니다"})
		return
	}

	var req AgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
		return
	}

	userID, _ := c.Get("user_id")
	userName, _ := c.Get("login_id")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}
	uname := ""
	if name, ok := userName.(string); ok {
		uname = name
	}

	// 1. 시스템 프롬프트 구성
	systemPrompt, ok := pagePrompts[req.Page]
	if !ok {
		systemPrompt = "당신은 HIERO 운영 OS의 AI 어시스턴트입니다. 숙소 운영에 관한 질문에 답변합니다."
	}

	// 2. 장기 기억 주입
	memories := loadMemories(uid, req.Page)
	if memories != "" {
		systemPrompt += fmt.Sprintf("\n\n[장기 기억 — 이전 대화에서 축적된 인사이트]\n%s", memories)
	}

	// 3. 크로스페이지 인사이트 주입
	crossInsights := loadCrossPageInsights(uid, req.Page)
	if crossInsights != "" {
		systemPrompt += fmt.Sprintf("\n\n[다른 페이지 Agent들의 최근 인사이트]\n%s", crossInsights)
	}

	// 4. 현재 화면 데이터 주입
	if req.Data != "" {
		systemPrompt += fmt.Sprintf("\n\n[현재 화면 데이터]\n%s", req.Data)
	}

	systemPrompt += `

답변 규칙:
- 한국어로 답변
- 데이터 기반 수치와 근거 제시
- 간결하고 실용적으로
- 다른 페이지 Agent의 인사이트가 관련되면 연결하여 분석
- 중요한 발견이 있으면 마지막에 [인사이트] 태그로 한 줄 요약 (다른 Agent와 공유됨)
- 데이터에 없는 내용은 추측하지 않기`

	// 5. 이전 대화 히스토리 로드 (최근 10개)
	history := loadConversationHistory(uid, req.Page, 10)

	// 6. OpenAI API 호출 (히스토리 포함)
	messages := []openAIMessage{{Role: "system", Content: systemPrompt}}
	for _, h := range history {
		messages = append(messages, openAIMessage{Role: h.Role, Content: h.Content})
	}
	messages = append(messages, openAIMessage{Role: "user", Content: req.Message})

	answer, err := callOpenAIWithMessages(apiKey, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("AI 응답 실패: %v", err)})
		return
	}

	// 7. 대화 저장
	saveConversation(uid, uname, req.Page, "user", req.Message)
	saveConversation(uid, uname, req.Page, "assistant", answer)

	// 8. [인사이트] 태그 추출 → 장기 기억으로 저장
	extractAndSaveInsight(uid, req.Page, answer)

	// 9. 대화 5회마다 자동 요약 → 장기 기억
	count := countConversations(uid, req.Page)
	if count > 0 && count%10 == 0 {
		go summarizeAndSave(apiKey, uid, req.Page)
	}

	c.JSON(http.StatusOK, gin.H{"answer": answer, "page": req.Page})
}

// GetHistory — 페이지별 대화 히스토리 조회
func (h *AiAgentHandler) GetHistory(c *gin.Context) {
	page := c.Query("page")
	userID, _ := c.Get("user_id")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	history := loadConversationHistory(uid, page, 50)

	type HistoryItem struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		Timestamp string `json:"timestamp"`
	}
	items := make([]HistoryItem, len(history))
	for i, h := range history {
		items[i] = HistoryItem{
			Role:      h.Role,
			Content:   h.Content,
			Timestamp: h.CreatedAt.Format("15:04"),
		}
	}

	c.JSON(http.StatusOK, gin.H{"history": items, "page": page})
}

// ClearHistory — 페이지별 대화 초기화
func (h *AiAgentHandler) ClearHistory(c *gin.Context) {
	page := c.Query("page")
	userID, _ := c.Get("user_id")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	config.DB.Where("user_id = ? AND page = ?", uid, page).Delete(&models.AiConversation{})
	c.JSON(http.StatusOK, gin.H{"message": "대화 기록이 초기화되었습니다"})
}

// GetMemories — 장기 기억 조회
func (h *AiAgentHandler) GetMemories(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid := uint(0)
	if id, ok := userID.(float64); ok {
		uid = uint(id)
	}

	var mems []models.AiMemory
	config.DB.Where("user_id = ? OR user_id = 0", uid).
		Where("expires_at IS NULL OR expires_at > ?", time.Now()).
		Order("created_at DESC").Limit(50).Find(&mems)

	c.JSON(http.StatusOK, gin.H{"memories": mems})
}

// --- Internal helpers ---

func loadConversationHistory(userID uint, page string, limit int) []models.AiConversation {
	var convs []models.AiConversation
	config.DB.Where("user_id = ? AND page = ?", userID, page).
		Order("created_at DESC").Limit(limit).Find(&convs)

	// 역순으로 뒤집기 (오래된 것부터)
	for i, j := 0, len(convs)-1; i < j; i, j = i+1, j-1 {
		convs[i], convs[j] = convs[j], convs[i]
	}
	return convs
}

func saveConversation(userID uint, userName, page, role, content string) {
	conv := models.AiConversation{
		UserID:   userID,
		UserName: userName,
		Page:     page,
		Role:     role,
		Content:  content,
	}
	config.DB.Create(&conv)
}

func countConversations(userID uint, page string) int64 {
	var count int64
	config.DB.Model(&models.AiConversation{}).
		Where("user_id = ? AND page = ?", userID, page).Count(&count)
	return count
}

func loadMemories(userID uint, page string) string {
	var mems []models.AiMemory
	config.DB.Where("(user_id = ? OR user_id = 0) AND (page = ? OR page = 'global')", userID, page).
		Where("expires_at IS NULL OR expires_at > ?", time.Now()).
		Order("created_at DESC").Limit(10).Find(&mems)

	if len(mems) == 0 {
		return ""
	}

	var parts []string
	for _, m := range mems {
		prefix := ""
		switch m.Type {
		case "summary":
			prefix = "[요약]"
		case "insight":
			prefix = "[인사이트]"
		case "decision":
			prefix = "[결정]"
		}
		parts = append(parts, fmt.Sprintf("%s %s (%s)", prefix, m.Content, m.CreatedAt.Format("01/02")))
	}
	return strings.Join(parts, "\n")
}

func loadCrossPageInsights(userID uint, currentPage string) string {
	var mems []models.AiMemory
	config.DB.Where("(user_id = ? OR user_id = 0) AND page != ? AND page != 'global' AND type = 'insight'",
		userID, currentPage).
		Where("expires_at IS NULL OR expires_at > ?", time.Now()).
		Where("created_at > ?", time.Now().AddDate(0, 0, -7)). // 최근 7일
		Order("created_at DESC").Limit(5).Find(&mems)

	if len(mems) == 0 {
		return ""
	}

	var parts []string
	for _, m := range mems {
		parts = append(parts, fmt.Sprintf("[%s] %s (%s)", m.Page, m.Content, m.CreatedAt.Format("01/02")))
	}
	return strings.Join(parts, "\n")
}

func extractAndSaveInsight(userID uint, page, answer string) {
	// [인사이트] 태그가 있으면 추출하여 저장
	lines := strings.Split(answer, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[인사이트]") {
			insight := strings.TrimPrefix(line, "[인사이트]")
			insight = strings.TrimSpace(insight)
			if insight == "" {
				continue
			}
			mem := models.AiMemory{
				UserID:  userID,
				Page:    page,
				Type:    "insight",
				Content: insight,
			}
			config.DB.Create(&mem)
		}
	}
}

func summarizeAndSave(apiKey string, userID uint, page string) {
	// 최근 20개 대화를 요약하여 장기 기억으로 저장
	convs := loadConversationHistory(userID, page, 20)
	if len(convs) < 6 {
		return
	}

	var dialogue strings.Builder
	for _, c := range convs {
		dialogue.WriteString(fmt.Sprintf("[%s] %s\n", c.Role, c.Content))
	}

	summaryPrompt := fmt.Sprintf(`아래는 HIERO %s 페이지에서의 AI Agent 대화 기록입니다.
이 대화에서 나온 핵심 인사이트, 결정사항, 반복 패턴을 3줄 이내로 요약하세요.
각 줄은 독립적인 사실이어야 합니다.

대화 기록:
%s`, page, dialogue.String())

	summary, err := callOpenAI(apiKey, "당신은 대화 요약 전문가입니다. 핵심만 간결하게 요약합니다.", summaryPrompt)
	if err != nil {
		return
	}

	// 기존 같은 페이지 요약은 만료 처리
	now := time.Now()
	config.DB.Model(&models.AiMemory{}).
		Where("user_id = ? AND page = ? AND type = 'summary'", userID, page).
		Update("expires_at", now)

	mem := models.AiMemory{
		UserID:  userID,
		Page:    page,
		Type:    "summary",
		Content: summary,
	}
	config.DB.Create(&mem)
}

// callOpenAIWithMessages — 메시지 배열로 OpenAI 호출
func callOpenAIWithMessages(apiKey string, messages []openAIMessage) (string, error) {
	reqBody := openAIRequest{
		Model:    "gpt-4o-mini",
		Messages: messages,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result openAIResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("응답 파싱 실패: %s", string(respBody))
	}

	if result.Error != nil {
		return "", fmt.Errorf("OpenAI 오류: %s", result.Error.Message)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("응답이 비어있습니다")
	}

	return result.Choices[0].Message.Content, nil
}
