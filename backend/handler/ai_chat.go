package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type AiChatHandler struct {
	reservationSvc *service.ReservationService
}

func NewAiChatHandler() *AiChatHandler {
	return &AiChatHandler{
		reservationSvc: service.NewReservationService(),
	}
}

type ChatRequest struct {
	Message string            `json:"message" binding:"required"`
	Context ChatContext       `json:"context"`
}

type ChatContext struct {
	Page       string `json:"page"`
	ViewMode   string `json:"view_mode"`
	Period     string `json:"period"`
	DateFrom   string `json:"date_from"`
	DateTo     string `json:"date_to"`
	Total      int    `json:"total"`
	SumRate    int64  `json:"sum_rate"`
	SumNights  int    `json:"sum_nights"`
}

// Chat — AI 채팅 (예약 데이터 기반 응답)
func (h *AiChatHandler) Chat(c *gin.Context) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OPENAI_API_KEY가 설정되지 않았습니다"})
		return
	}

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 요청입니다"})
		return
	}

	// 현재 필터 기준으로 예약 데이터 조회 (최대 200건)
	query := service.ReservationListQuery{
		Page:     1,
		PageSize: 200,
	}
	if req.Context.ViewMode != "" {
		query.ViewMode = req.Context.ViewMode
	}
	if req.Context.DateFrom != "" && req.Context.DateTo != "" {
		switch req.Context.ViewMode {
		case "booked":
			query.BookedFrom = req.Context.DateFrom
			query.BookedTo = req.Context.DateTo
		case "checkin":
			query.CheckInFrom = req.Context.DateFrom
			query.CheckInTo = req.Context.DateTo
		case "checkout":
			query.CheckOutFrom = req.Context.DateFrom
			query.CheckOutTo = req.Context.DateTo
		case "extension":
			query.CheckInFrom = req.Context.DateFrom
			query.CheckInTo = req.Context.DateTo
		case "cancelled":
			query.Status = "cancelled"
			query.CheckInFrom = req.Context.DateFrom
			query.CheckInTo = req.Context.DateTo
		default:
			query.BookedFrom = req.Context.DateFrom
			query.BookedTo = req.Context.DateTo
		}
	}

	result, err := h.reservationSvc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "예약 데이터 조회 실패"})
		return
	}

	// 데이터가 없으면 이번달 전체로 재조회
	if len(result.Reservations) == 0 {
		now := time.Now()
		firstDay := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastDay := firstDay.AddDate(0, 1, -1)
		fallbackQuery := service.ReservationListQuery{
			Page:        1,
			PageSize:    200,
			ViewMode:    "booked",
			BookedFrom:  firstDay.Format("2006-01-02"),
			BookedTo:    lastDay.Format("2006-01-02"),
		}
		result, _ = h.reservationSvc.List(fallbackQuery)
	}

	// 예약 데이터를 요약 텍스트로 변환
	dataSummary := buildReservationSummary(result)

	// OpenAI API 호출
	systemPrompt := fmt.Sprintf(`당신은 HIERO 숙소 운영 플랫폼의 예약 관리 AI 어시스턴트입니다.
사용자가 보고 있는 예약 관리 화면의 데이터를 기반으로 질문에 답변합니다.

현재 화면 상태:
- 보기 모드: %s
- 기간: %s ~ %s
- 총 예약: %d건
- 총 박수: %d박
- 총 매출: %s원

아래는 현재 조회된 예약 데이터입니다:
%s

답변 규칙:
- 한국어로 답변
- 데이터에 기반한 구체적인 수치와 근거를 제시
- 간결하고 실용적으로 답변
- 데이터에 없는 내용은 추측하지 않고 "현재 데이터에서 확인할 수 없습니다"라고 안내
- 숙소 운영 관점에서 인사이트를 제공`,
		req.Context.ViewMode,
		req.Context.DateFrom,
		req.Context.DateTo,
		req.Context.Total,
		req.Context.SumNights,
		formatWon(req.Context.SumRate),
		dataSummary,
	)

	answer, err := callOpenAI(apiKey, systemPrompt, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("AI 응답 실패: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"answer": answer})
}

func buildReservationSummary(result service.ReservationListResult) string {
	if len(result.Reservations) == 0 {
		return "조회된 예약이 없습니다."
	}

	var buf bytes.Buffer

	// 채널별 집계
	channelStats := map[string]struct {
		count  int
		rate   int64
		nights int
	}{}
	// 숙소별 집계
	propStats := map[string]struct {
		count  int
		rate   int64
		nights int
	}{}

	for _, r := range result.Reservations {
		ch := r.ChannelType
		cs := channelStats[ch]
		cs.count++
		cs.rate += r.TotalRate
		cs.nights += r.Nights
		channelStats[ch] = cs

		pn := r.PropertyName
		if pn == "" {
			pn = "(미매칭)"
		}
		ps := propStats[pn]
		ps.count++
		ps.rate += r.TotalRate
		ps.nights += r.Nights
		propStats[pn] = ps
	}

	buf.WriteString(fmt.Sprintf("총 %d건 조회됨 (전체 %d건)\n\n", len(result.Reservations), result.Total))

	buf.WriteString("[채널별 집계]\n")
	for ch, s := range channelStats {
		buf.WriteString(fmt.Sprintf("- %s: %d건, %d박, %s원\n", ch, s.count, s.nights, formatWon(s.rate)))
	}

	buf.WriteString("\n[숙소별 집계]\n")
	for pn, s := range propStats {
		buf.WriteString(fmt.Sprintf("- %s: %d건, %d박, %s원\n", pn, s.count, s.nights, formatWon(s.rate)))
	}

	// 개별 예약 목록 (최대 50건)
	buf.WriteString("\n[예약 목록]\n")
	limit := len(result.Reservations)
	if limit > 50 {
		limit = 50
	}
	for i := 0; i < limit; i++ {
		r := result.Reservations[i]
		buf.WriteString(fmt.Sprintf("- %s | %s | %s | %s~%s (%d박) | %s원 | %s | %s\n",
			r.PropertyName, r.ReservationCode, r.GuestName,
			r.CheckInDate, r.CheckOutDate, r.Nights,
			formatWon(r.TotalRate), r.ChannelType, r.Status,
		))
	}
	if len(result.Reservations) > 50 {
		buf.WriteString(fmt.Sprintf("... 외 %d건\n", len(result.Reservations)-50))
	}

	return buf.String()
}

func formatWon(v int64) string {
	if v == 0 {
		return "0"
	}
	s := fmt.Sprintf("%d", v)
	// 3자리 콤마
	n := len(s)
	if n <= 3 {
		return s
	}
	var result []byte
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}

type openAIRequest struct {
	Model    string          `json:"model"`
	Messages []openAIMessage `json:"messages"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func callOpenAI(apiKey, systemPrompt, userMessage string) (string, error) {
	reqBody := openAIRequest{
		Model: "gpt-4o-mini",
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
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
