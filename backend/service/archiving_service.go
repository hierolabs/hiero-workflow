package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// ── 상수 ──────────────────────────────────────────────────────────

// 탭 순서 (글쓰기 가이드 v2)
var tabOrder = []string{
	"작업 기록", "시스템 흐름도", "개념 설명", "업무 지침",
	"에세이", "논문형", "블로그", "검토/퇴고",
}

var tabMarkerRe = regexp.MustCompile(`<!-- TAB: (.+?) -->`)

// ── 서비스 ────────────────────────────────────────────────────────

type ArchivingService struct {
	wikiSvc  *WikiService
	notifSvc *NotificationService
}

func NewArchivingService() *ArchivingService {
	return &ArchivingService{
		wikiSvc:  NewWikiService(),
		notifSvc: NewNotificationService(),
	}
}

// ── 요청/응답 ────────────────────────────────────────────────────

type FileChange struct {
	Path   string `json:"path"`
	Action string `json:"action"` // created | modified | deleted
}

type GenerateSessionReq struct {
	SessionSummary string       `json:"session_summary" binding:"required"`
	ArticleIDs     []uint       `json:"article_ids"`
	TopicKeywords  []string     `json:"topic_keywords"`
	FilesChanged   []FileChange `json:"files_changed"`
}

type GenerateWeeklyReq struct {
	ArticleIDs []uint `json:"article_ids"`
}

type ArticleResult struct {
	ID        uint     `json:"id"`
	Title     string   `json:"title"`
	Status    string   `json:"status"`
	TabsAdded []string `json:"tabs_added"`
}

type GenerateResult struct {
	JobID           uint            `json:"job_id"`
	ArticlesUpdated []ArticleResult `json:"articles_updated"`
}

// ── 세션 TAB 1~4 생성 ─────────────────────────────────────────

func (s *ArchivingService) GenerateSessionTabs(req GenerateSessionReq, authorName string) (*GenerateResult, error) {
	// 작업 이력 생성
	articleIDsJSON, _ := json.Marshal(req.ArticleIDs)
	job := models.ArchivingJob{
		Type:          "session",
		Status:        "processing",
		InputSummary:  req.SessionSummary,
		ArticleIDs:    string(articleIDsJSON),
		CreatedByName: authorName,
	}
	config.DB.Create(&job)

	// 대상 아티클 결정
	articleIDs := req.ArticleIDs
	if len(articleIDs) == 0 && len(req.TopicKeywords) > 0 {
		articleIDs = s.matchArticlesByKeywords(req.TopicKeywords)
	}
	if len(articleIDs) == 0 {
		s.failJob(&job, "대상 아티클을 지정해주세요 (article_ids 또는 topic_keywords)")
		return nil, fmt.Errorf("대상 아티클 없음")
	}

	// 파일 변경 요약
	filesText := ""
	if len(req.FilesChanged) > 0 {
		var lines []string
		for _, f := range req.FilesChanged {
			lines = append(lines, fmt.Sprintf("- %s (%s)", f.Path, f.Action))
		}
		filesText = "\n\n### 변경 파일\n" + strings.Join(lines, "\n")
	}

	baseInput := req.SessionSummary + filesText

	// 각 아티클별로 독립적으로 TAB 생성 (아티클마다 맥락이 다르므로)
	var results []ArticleResult
	for _, aid := range articleIDs {
		article, err := s.wikiSvc.GetArticle(aid)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d 조회 실패: %v", aid, err)
			continue
		}

		// 이 아티클의 앞뒤 맥락 수집
		neighborCtx := s.getNeighborContext(aid)
		contextBlock := ""
		if neighborCtx != "" {
			contextBlock = "\n\n### 현재 아티클: " + article.Section + " " + article.Title +
				"\n\n### 목차 맥락 (앞뒤 3개)\n" + neighborCtx + "\n\n" + contextGuidePrompt
		}

		userInput := baseInput + contextBlock

		// TAB 1 생성
		tab1, err := s.generateTab("작업 기록", promptTab1, userInput)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 1 실패: %v", aid, err)
			continue
		}

		// TAB 2~4: TAB 1 + 맥락을 함께 전달
		tab1WithCtx := tab1 + contextBlock

		tab2, err := s.generateTab("시스템 흐름도", promptTab2, tab1WithCtx)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 2 실패: %v", aid, err)
			continue
		}

		tab3, err := s.generateTab("개념 설명", promptTab3, tab1WithCtx)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 3 실패: %v", aid, err)
			continue
		}

		tab4, err := s.generateTab("업무 지침", promptTab4, tab1WithCtx)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 4 실패: %v", aid, err)
			continue
		}

		newTabs := map[string]string{
			"작업 기록":   tab1,
			"시스템 흐름도": tab2,
			"개념 설명":   tab3,
			"업무 지침":   tab4,
		}

		merged := mergeTabs(article.Content, newTabs)
		_, err = s.wikiSvc.UpdateArticle(aid, UpdateArticleReq{
			Content:      merged,
			Status:       "draft",
			RevisionNote: "아카이빙 파이프라인 — TAB 1~4 자동 생성 (맥락 반영)",
		}, 1, "ArchivingBot")
		if err != nil {
			log.Printf("[Archiving] 아티클 %d 업데이트 실패: %v", aid, err)
			continue
		}

		results = append(results, ArticleResult{
			ID:        aid,
			Title:     article.Title,
			Status:    "draft",
			TabsAdded: []string{"작업 기록", "시스템 흐름도", "개념 설명", "업무 지침"},
		})
	}

	// 작업 완료
	now := time.Now()
	job.Status = "completed"
	job.TabsGenerated = "1,2,3,4"
	job.CompletedAt = &now
	config.DB.Save(&job)

	uid := uint(1)
	LogActivity(&uid, authorName, "archiving_session", "archiving_job", &job.ID,
		fmt.Sprintf("TAB 1~4 생성: %d개 아티클", len(results)))

	return &GenerateResult{JobID: job.ID, ArticlesUpdated: results}, nil
}

// ── 주간 TAB 5~7 생성 ─────────────────────────────────────────

func (s *ArchivingService) GenerateWeeklyTabs(req GenerateWeeklyReq, authorName string) (*GenerateResult, error) {
	articleIDsJSON, _ := json.Marshal(req.ArticleIDs)
	job := models.ArchivingJob{
		Type:          "weekly",
		Status:        "processing",
		ArticleIDs:    string(articleIDsJSON),
		CreatedByName: authorName,
	}
	config.DB.Create(&job)

	// 대상 아티클 결정: 지정 없으면 이번 주 업데이트된 draft 아티클
	articleIDs := req.ArticleIDs
	if len(articleIDs) == 0 {
		weekAgo := time.Now().AddDate(0, 0, -7)
		var articles []models.WikiArticle
		config.DB.Where("status = ? AND updated_at >= ?", "draft", weekAgo).
			Select("id").Find(&articles)
		for _, a := range articles {
			articleIDs = append(articleIDs, a.ID)
		}
	}
	if len(articleIDs) == 0 {
		s.failJob(&job, "이번 주 업데이트된 draft 아티클 없음")
		return nil, fmt.Errorf("대상 아티클 없음")
	}

	var results []ArticleResult
	for _, aid := range articleIDs {
		article, err := s.wikiSvc.GetArticle(aid)
		if err != nil {
			continue
		}

		// TAB 1~4 내용 추출
		tabs14 := extractTabs14(article.Content)
		if tabs14 == "" {
			log.Printf("[Archiving] 아티클 %d에 TAB 1~4 없음, 스킵", aid)
			continue
		}

		// 앞뒤 맥락 수집
		neighborCtx := s.getNeighborContext(aid)
		if neighborCtx != "" {
			tabs14 = tabs14 + "\n\n### 목차 맥락 (앞뒤 3개)\n" + neighborCtx + "\n\n" + contextGuidePrompt
		}

		// TAB 5~7 생성
		tab5, err := s.generateTab("에세이", promptTab5, tabs14)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 5 실패: %v", aid, err)
			continue
		}

		tab6, err := s.generateTab("논문형", promptTab6, tabs14)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 6 실패: %v", aid, err)
			continue
		}

		tab7, err := s.generateTab("블로그", promptTab7, tabs14)
		if err != nil {
			log.Printf("[Archiving] 아티클 %d TAB 7 실패: %v", aid, err)
			continue
		}

		newTabs := map[string]string{
			"에세이": tab5,
			"논문형": tab6,
			"블로그": tab7,
		}
		merged := mergeTabs(article.Content, newTabs)
		_, err = s.wikiSvc.UpdateArticle(aid, UpdateArticleReq{
			Content:      merged,
			Status:       "review",
			RevisionNote: "아카이빙 파이프라인 — TAB 5~7 주간 자동 생성",
		}, 1, "ArchivingBot")
		if err != nil {
			continue
		}

		results = append(results, ArticleResult{
			ID:        aid,
			Title:     article.Title,
			Status:    "review",
			TabsAdded: []string{"에세이", "논문형", "블로그"},
		})
	}

	now := time.Now()
	job.Status = "completed"
	job.TabsGenerated = "5,6,7"
	job.CompletedAt = &now
	config.DB.Save(&job)

	uid2 := uint(1)
	LogActivity(&uid2, authorName, "archiving_weekly", "archiving_job", &job.ID,
		fmt.Sprintf("TAB 5~7 생성: %d개 아티클", len(results)))

	return &GenerateResult{JobID: job.ID, ArticlesUpdated: results}, nil
}

// ── 월간 알림 ─────────────────────────────────────────────────

func (s *ArchivingService) MonthlyNotify() (int, error) {
	var count int64
	config.DB.Model(&models.WikiArticle{}).Where("status = ?", "review").Count(&count)

	if count > 0 {
		s.notifSvc.NotifyByName("김진우", "archiving",
			fmt.Sprintf("위키 검토 대기 %d건", count),
			fmt.Sprintf("TAB 5~7(에세이/논문/블로그)이 완성된 아티클 %d건이 검토/퇴고(TAB 8) 대기 중입니다.", count),
			nil, "ArchivingBot")
	}

	uid3 := uint(1)
	zeroID := uint(0)
	LogActivity(&uid3, "ArchivingBot", "archiving_monthly", "wiki", &zeroID,
		fmt.Sprintf("월간 알림: review 대기 %d건", count))

	return int(count), nil
}

// ── 작업 이력 조회 ─────────────────────────────────────────────

func (s *ArchivingService) ListJobs(limit int) ([]models.ArchivingJob, error) {
	var jobs []models.ArchivingJob
	if limit <= 0 {
		limit = 30
	}
	err := config.DB.Order("created_at DESC").Limit(limit).Find(&jobs).Error
	return jobs, err
}

// ── 현황 ──────────────────────────────────────────────────────

type ArchivingStatus struct {
	TotalArticles  int `json:"total_articles"`
	EmptyArticles  int `json:"empty_articles"`
	DraftArticles  int `json:"draft_articles"`
	ReviewArticles int `json:"review_articles"`
	PublishedCount int `json:"published_count"`
	RecentJobs     int `json:"recent_jobs"` // 최근 7일
}

func (s *ArchivingService) GetStatus() (*ArchivingStatus, error) {
	status := &ArchivingStatus{}

	config.DB.Model(&models.WikiArticle{}).Count(new(int64))
	var articles []models.WikiArticle
	config.DB.Select("status").Find(&articles)
	for _, a := range articles {
		status.TotalArticles++
		switch a.Status {
		case "empty":
			status.EmptyArticles++
		case "draft":
			status.DraftArticles++
		case "review":
			status.ReviewArticles++
		case "published":
			status.PublishedCount++
		}
	}

	weekAgo := time.Now().AddDate(0, 0, -7)
	var jobCount int64
	config.DB.Model(&models.ArchivingJob{}).Where("created_at >= ?", weekAgo).Count(&jobCount)
	status.RecentJobs = int(jobCount)

	return status, nil
}

// ── TAB 파싱 & 머지 ──────────────────────────────────────────

// parseTabs: content → map[tabName]tabContent
func parseTabs(content string) map[string]string {
	tabs := map[string]string{}
	if content == "" {
		return tabs
	}

	markers := tabMarkerRe.FindAllStringIndex(content, -1)
	names := tabMarkerRe.FindAllStringSubmatch(content, -1)

	if len(markers) == 0 {
		return tabs
	}

	for i, m := range markers {
		name := names[i][1]
		start := m[1] // 마커 끝
		var end int
		if i+1 < len(markers) {
			end = markers[i+1][0] // 다음 마커 시작
		} else {
			end = len(content)
		}
		tabs[name] = strings.TrimSpace(content[start:end])
	}
	return tabs
}

// mergeTabs: 기존 content + 새 tabs → 합친 content (새 탭은 기존 탭을 교체)
func mergeTabs(existing string, newTabs map[string]string) string {
	existingTabs := parseTabs(existing)

	// 새 탭으로 교체 (append가 아닌 replace)
	for name, newContent := range newTabs {
		existingTabs[name] = newContent
	}

	// 탭 순서대로 조합
	var buf strings.Builder
	for _, name := range tabOrder {
		content, ok := existingTabs[name]
		if !ok || content == "" {
			continue
		}
		if buf.Len() > 0 {
			buf.WriteString("\n\n")
		}
		buf.WriteString("<!-- TAB: " + name + " -->\n\n")
		buf.WriteString(content)
	}
	return buf.String()
}

// extractTabs14: TAB 1~4 내용만 추출하여 하나의 텍스트로
func extractTabs14(content string) string {
	tabs := parseTabs(content)
	var parts []string
	for _, name := range tabOrder[:4] { // 작업기록, 흐름도, 개념설명, 업무지침
		if t, ok := tabs[name]; ok && t != "" {
			parts = append(parts, "## "+name+"\n\n"+t)
		}
	}
	return strings.Join(parts, "\n\n---\n\n")
}

// ── 토픽 → 아티클 매핑 ────────────────────────────────────────

func (s *ArchivingService) matchArticlesByKeywords(keywords []string) []uint {
	// 키워드 → Part 번호 매핑
	topicPart := map[string]int{
		"ontology":    1,
		"온톨로지":       1,
		"space":       2,
		"property":    2,
		"숙소":         2,
		"people":      3,
		"team":        3,
		"팀":          3,
		"flow":        4,
		"reservation": 4,
		"예약":         4,
		"message":     4,
		"메시지":        4,
		"turnover":    5,
		"cleaning":    5,
		"청소":         5,
		"띵동":         5,
		"economy":     6,
		"pricing":     6,
		"settlement":  6,
		"가격":         6,
		"정산":         6,
		"risk":        7,
		"issue":       7,
		"이슈":         7,
		"intelligence": 8,
		"ai":          8,
		"business":    9,
		"bm":          9,
		"horizon":     10,
	}

	partNumbers := map[int]bool{}
	for _, kw := range keywords {
		kw = strings.ToLower(kw)
		if pn, ok := topicPart[kw]; ok {
			partNumbers[pn] = true
		}
	}

	if len(partNumbers) == 0 {
		return nil
	}

	var pns []int
	for pn := range partNumbers {
		pns = append(pns, pn)
	}

	var articles []models.WikiArticle
	config.DB.Where("part_number IN ?", pns).Select("id").Find(&articles)

	var ids []uint
	for _, a := range articles {
		ids = append(ids, a.ID)
	}
	return ids
}

// ── 맥락 수집 (앞뒤 3개 아티클) ───────────────────────────────

// getNeighborContext 목차에서 대상 아티클 앞뒤 3개의 제목+요약을 수집
// 반복 방지, 용어 흐름, 논리적 연결을 위해 사용
func (s *ArchivingService) getNeighborContext(articleID uint) string {
	// 전체 목차를 sort_order 순으로 가져오기
	var allArticles []models.WikiArticle
	config.DB.Select("id, sort_order, part_number, part_title, section, title, content, word_count").
		Order("sort_order ASC, part_number ASC, chapter ASC, section ASC").
		Find(&allArticles)

	// 대상 아티클의 인덱스 찾기
	targetIdx := -1
	for i, a := range allArticles {
		if a.ID == articleID {
			targetIdx = i
			break
		}
	}
	if targetIdx < 0 {
		return ""
	}

	var parts []string

	// 앞 3개
	start := targetIdx - 3
	if start < 0 {
		start = 0
	}
	for i := start; i < targetIdx; i++ {
		a := allArticles[i]
		snippet := summarizeContent(a.Content, 200)
		parts = append(parts, fmt.Sprintf("[앞 %d] %s %s (Part %d) — %s",
			targetIdx-i, a.Section, a.Title, a.PartNumber, snippet))
	}

	// 현재
	parts = append(parts, fmt.Sprintf("[현재] %s %s (Part %d)",
		allArticles[targetIdx].Section, allArticles[targetIdx].Title, allArticles[targetIdx].PartNumber))

	// 뒤 3개
	end := targetIdx + 4
	if end > len(allArticles) {
		end = len(allArticles)
	}
	for i := targetIdx + 1; i < end; i++ {
		a := allArticles[i]
		snippet := summarizeContent(a.Content, 200)
		parts = append(parts, fmt.Sprintf("[뒤 %d] %s %s (Part %d) — %s",
			i-targetIdx, a.Section, a.Title, a.PartNumber, snippet))
	}

	return strings.Join(parts, "\n")
}

func summarizeContent(content string, maxRunes int) string {
	if content == "" {
		return "(아직 비어있음)"
	}
	// TAB 마커 제거하고 순수 텍스트만
	clean := tabMarkerRe.ReplaceAllString(content, "")
	clean = strings.TrimSpace(clean)
	runes := []rune(clean)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes]) + "..."
	}
	return clean
}

// 맥락 안내 프롬프트 (모든 글쓰기 AI에 공통 적용)
const contextGuidePrompt = `
## 맥락 규칙 (필수)
아래는 이 글의 앞뒤 아티클 요약입니다. 반드시 참고하세요:
1. 앞 아티클에서 이미 설명한 개념/용어를 반복하지 마세요 — "앞서 살펴본 ~"으로 연결
2. 뒤 아티클에서 다룰 내용을 미리 깊게 설명하지 마세요 — "이후 ~에서 다룬다"로 예고만
3. 전문 용어가 처음 등장하면 반드시 한 줄 설명을 붙이세요
4. 앞 글의 결론이 이 글의 전제가 되어야 합니다 — 논리적 흐름
5. 같은 비유/예시를 반복하지 마세요 — 앞에서 쓴 비유는 피하고 새로운 비유를 쓰세요
`

// ── 내부 헬퍼 ─────────────────────────────────────────────────

func (s *ArchivingService) failJob(job *models.ArchivingJob, msg string) {
	job.Status = "failed"
	job.ErrorMessage = msg
	now := time.Now()
	job.CompletedAt = &now
	config.DB.Save(job)
	log.Printf("[Archiving] 작업 실패: %s", msg)
}

func (s *ArchivingService) generateTab(tabName, systemPrompt, userInput string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY 미설정")
	}

	log.Printf("[Archiving] %s 생성 중...", tabName)
	result, err := archivingCallOpenAI(apiKey, systemPrompt, userInput)
	if err != nil {
		return "", fmt.Errorf("%s 생성 실패: %w", tabName, err)
	}

	// TAB 마커가 결과에 포함되어 있으면 제거 (프롬프트에서 요청하지만 머지 시 별도 추가)
	result = tabMarkerRe.ReplaceAllString(result, "")
	result = strings.TrimSpace(result)

	log.Printf("[Archiving] %s 생성 완료 (%d자)", tabName, len([]rune(result)))
	return result, nil
}

// ── OpenAI 호출 ──────────────────────────────────────────────

type archivingOAIRequest struct {
	Model    string              `json:"model"`
	Messages []archivingOAIMsg   `json:"messages"`
}

type archivingOAIMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type archivingOAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func archivingCallOpenAI(apiKey, systemPrompt, userMessage string) (string, error) {
	reqBody := archivingOAIRequest{
		Model: "gpt-4o-mini",
		Messages: []archivingOAIMsg{
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

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result archivingOAIResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("응답 파싱 실패: %w", err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("OpenAI 오류: %s", result.Error.Message)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("OpenAI 응답 없음")
	}
	return result.Choices[0].Message.Content, nil
}

// ── 프롬프트 상수 (글쓰기 가이드 v2 기반) ──────────────────────

const promptTab1 = `당신은 HIERO 개발 아카이빙 시스템입니다.
개발 세션의 작업 내용을 위키 작업 기록으로 정리합니다.

HIERO는 숙박 운영의 모든 상태 변화를 추적하고 연결하는 AI 운영 OS입니다.
도시공학 박사(김진우)가 설계한 온톨로지 기반 시스템입니다.

규칙:
- 배경/구조/변경내역/기술결정/데이터/다음단계 구조로 정리
- 파일 변경은 마크다운 테이블로 (| 파일 | 변경 내용 |)
- "왜 A를 선택하고 B를 버렸는가" 반드시 포함
- 코드 블록은 핵심 부분만 (전체 복붙 금지)
- 분량: 500~1,500자
- 한국어로 작성
- <!-- TAB: 작업 기록 --> 마커를 포함하지 마세요`

const promptTab2 = `당신은 HIERO 시스템 흐름도 작성자입니다.
작업 기록을 바탕으로 데이터 흐름과 시스템 연결을 정리합니다.

규칙:
- 데이터 흐름을 텍스트 다이어그램으로 (입력 → 처리 → 출력)
- 관련 코드 위치 (파일:함수) 테이블
- 관련 엔티티와 상태 전환 (State Transition)
- 의사결정 포인트 (자동/수동/에스컬레이션)
- HIERO 온톨로지(reservation_code 조인키 등)와의 연결
- 분량: 300~800자
- 한국어로 작성
- <!-- TAB: 시스템 흐름도 --> 마커를 포함하지 마세요`

const promptTab3 = `당신은 HIERO 개념 설명 작성자입니다.
기술 결정을 비기술자도 이해할 수 있게 설명합니다.
도시계획적 관점에서의 해석을 포함합니다.

HIERO 창업자는 서울시립대 도시공학 박사로, 18년간 도시계획을 강의했습니다.
HIERO의 모든 시스템 설계는 도시관리계획 부문 체계(토지이용/인구/교통/환경/경제/안전)와 대응됩니다.

규칙:
- 코드, API, 테이블명 사용 금지 — 개념만
- 도시계획 부문(토지이용/인구/교통/환경/경제/안전)과 연결
- 비유를 최소 1개 포함
- "왜 이렇게 만들었는가"와 "왜 다른 방식을 안 했는가" 모두 포함
- 한계를 솔직하게 인정
- 분량: 300~600자
- 한국어로 작성
- <!-- TAB: 개념 설명 --> 마커를 포함하지 마세요`

const promptTab4 = `당신은 HIERO 업무 지침 작성자입니다.
이 기능을 실무에서 쓰는 사람을 위한 가이드를 작성합니다.

HIERO 운영팀: 오재관(운영), 우연(청소배정), 김진태(현장), 박수빈(CFO)

규칙:
- 3모드(의사결정/관리/실행)로 반드시 구분
- 직급명 금지, 모드명만 사용
- 트리거 조건 + 판단 기준 + 에스컬레이션 포함
- 금지 사항 최소 1개
- 체크리스트 형식 적극 활용
- 분량: 300~600자
- 한국어로 작성
- <!-- TAB: 업무 지침 --> 마커를 포함하지 마세요`

const promptTab5 = `당신은 HIERO 프로젝트의 에세이 작성자입니다.
서울시립대 도시공학 박사(김진우)가 기술 사업을 만드는 과정을 1인칭으로 솔직하게 써야 합니다.

규칙:
- 1인칭 시점, 솔직한 톤
- 도시공학 전공자(박사, 18년 강의)가 기술 사업을 만드는 과정
- "놀라운 발견", "틀렸다고 느낀 순간", "도시공학과의 연결" 중 1개 이상
- AI가 쓴 티가 나면 안 됨 — 완벽한 문장보다 솔직한 생각
- 분량: 800~1,500자
- 한국어로 작성
- <!-- TAB: 에세이 --> 마커를 포함하지 마세요`

const promptTab6 = `당신은 HIERO 프로젝트의 논문형 글 작성자입니다.
기술 결정의 논리적 정당화와 지식 축적을 위한 구조적 글을 작성합니다.

필수 구조:
1. 배경 — 이 문제가 왜 존재하는가
2. 문제 정의 — 구체적으로 뭐가 안 되는가, 데이터로 보면
3. 접근 방법 — 어떤 선택지가 있었고, 왜 이 방법인가
4. 구현 — 무엇을 만들었는가
5. 결과 — 수치로 뭐가 바뀌었는가
6. 시사점 — 의미, 한계, 다음 방향
7. 참고 자료 — 출처, 유사 사례

규칙:
- 인과관계가 명확해야 함
- 근거 데이터, 수치, 비교 포함
- 도시계획/스마트시티 관련 학술 참조 가능하면 포함
- 분량: 1,500~3,000자
- 한국어로 작성
- <!-- TAB: 논문형 --> 마커를 포함하지 마세요`

const promptTab7 = `당신은 HIERO 프로젝트의 블로그 작성자입니다.
잠재 고객(숙소 오너), 업계 관계자, 일반인이 읽는 대외용 글을 작성합니다.

필수 구조:
1. 후킹 — "혹시 이런 경험 있으신가요?"
2. 문제 제기 — 이게 왜 문제인지 쉽게
3. 우리의 접근 — 비유, 예시로 설명
4. 결과/인사이트 — 구체적 숫자 1~2개만
5. 마무리 — 핵심 메시지 한 문장 반복

규칙:
- 일반인이 이해할 수 있는 쉬운 언어
- "우리는 이런 문제를 이렇게 풀고 있다"는 메시지
- 도시공학 + 기술 + 숙박 운영의 교차점
- 핵심 메시지가 도입/중간/마무리에서 반복
- 구체적 숫자 1~2개 포함
- 분량: 1,000~2,000자
- 한국어로 작성
- <!-- TAB: 블로그 --> 마커를 포함하지 마세요`

// ── 글 평가 시스템 (다관점 AI 리뷰) ─────────────────────────────

type ReviewPerspective struct {
	Key    string `json:"key"`
	Name   string `json:"name"`
	Review string `json:"review"`
	Score  int    `json:"score"` // 1~10
}

type ArticleReviewResult struct {
	ArticleID    uint                `json:"article_id"`
	ArticleTitle string              `json:"article_title"`
	Perspectives []ReviewPerspective `json:"perspectives"`
	Summary      string              `json:"summary"`
}

var reviewPrompts = map[string]struct {
	name   string
	prompt string
}{
	"investor": {
		name: "투자자",
		prompt: `당신은 시드~시리즈A 단계 프롭테크/SaaS 스타트업에 투자하는 VC 심사역입니다.

## 나의 평가 철학
나는 Peter Thiel의 "0 to 1" 관점으로 봅니다. 경쟁이 아니라 독점을 만드는가?
Paul Graham의 "Do things that don't scale"를 초기 스타트업의 핵심 검증 기준으로 삼습니다.
숙박 운영은 "속도보다 깊이"가 중요한 도메인이므로, TAM보다 단위 경제(unit economics)를 먼저 봅니다.

## 평가 구조
반드시 아래 4섹션으로 작성하세요:

### 1. 내가 이 글을 보는 관점
어떤 투자 철학과 기준으로 이 글을 읽었는지 2~3줄로 서술.

### 2. 평가
- 시장 기회: (1~2줄)
- 해결 방식의 차별화: (1~2줄)
- 실행 증거: (1~2줄)
- 확장성: (1~2줄)
- 팀 역량: (1~2줄)

### 3. 보완 방향
이 글이 투자 심사 자료로 쓰이려면 구체적으로 무엇을 추가/수정해야 하는지.
"~하면 좋겠다"가 아니라 "~를 이렇게 바꿔라" 수준으로 구체적으로.

### 4. 점수
점수: N/10

한국어, 500자 이내.`,
	},
	"academic": {
		name: "도시계획 학자",
		prompt: `당신은 서울대 환경대학원 도시계획학 교수입니다. 도시계획사, 스마트시티, 도시 거버넌스를 연구합니다.

## 나의 평가 철학
나는 Jane Jacobs의 "도시는 복잡계"라는 관점에서 봅니다. 단순한 효율화가 아니라 다양성과 자생적 질서를 존중하는가?
Alexander의 "A City Is Not a Tree" — 기능별 분리(Tree)가 아니라 관계가 교차하는 Semi-lattice를 만들고 있는가?
이론과 실천의 간극을 메우는 것이 도시계획학의 본질이라고 봅니다.

## 평가 구조
반드시 아래 4섹션으로 작성하세요:

### 1. 내가 이 글을 보는 관점
어떤 도시계획 사조와 학술적 기준으로 이 글을 읽었는지 2~3줄로 서술.

### 2. 평가
- 이론적 근거의 적절성: (인용된 이론이 맥락에 맞는가?)
- 논리 구조: (인과관계가 명확한가?)
- 실증 데이터: (주장을 뒷받침하는 근거가 있는가?)
- 학술 기여: (기존 연구와 다른 새로운 관점이 있는가?)
- 이론-실천 연결: (이론이 실무에 어떻게 구현되었는가?)

### 3. 보완 방향
학술 논문이나 백서 수준으로 올리려면 어떤 이론적 보강, 데이터 추가, 논리 수정이 필요한지.
구체적인 참고문헌이나 방법론을 제시하세요.

### 4. 점수
점수: N/10

한국어, 500자 이내.`,
	},
	"operator": {
		name: "숙소 운영자",
		prompt: `당신은 에어비앤비/삼삼엠투에서 80채를 운영하는 숙박업 대표입니다. 5년 경력, 직원 8명.

## 나의 평가 철학
나는 "현장에서 돌아가는가?"만 봅니다. 이론이 아무리 좋아도 청소자가 못 쓰면 의미 없습니다.
도구는 "일을 줄여주는 것"이어야 하고, "새로운 일을 만드는 것"이면 실패합니다.
엑셀과 카카오톡 조합을 이기려면, 그것보다 확실히 빨라야 합니다.

## 평가 구조
반드시 아래 4섹션으로 작성하세요:

### 1. 내가 이 글을 보는 관점
어떤 운영 경험과 기준으로 이 글을 읽었는지 2~3줄로 서술.

### 2. 평가
- 현실 진단: (실제 운영 현장의 문제를 정확히 짚었는가?)
- 실용성: (도입하면 시간/비용이 줄어드는가?)
- 비용 대비 효과: (월 구독료 대비 절감되는 인건비/실수비용)
- 사용 편의: (운영팀 교육 없이 쓸 수 있는 수준인가?)
- 엑셀 대비 차별화: (정말 엑셀+카톡을 대체할 수 있는가?)

### 3. 보완 방향
실제 운영자가 "이건 쓰겠다"라고 느끼려면 무엇이 추가/변경되어야 하는지.
현장 기준으로 구체적인 시나리오를 들어 설명하세요.

### 4. 점수
점수: N/10

한국어, 500자 이내.`,
	},
	"reader": {
		name: "일반 독자",
		prompt: `당신은 기술 블로그를 즐겨 읽는 비전문가입니다. IT/스타트업에 관심 있지만 개발자는 아닙니다.

## 나의 평가 철학
나는 "좋은 글은 모르는 사람도 끄덕이게 만든다"고 생각합니다.
전문 용어가 나오면 바로 설명이 따라와야 하고, 왜 이게 중요한지 나의 일상과 연결되어야 합니다.
기술 자랑이 아니라 "이 사람이 왜 이걸 만들었는지"가 느껴져야 합니다.

## 평가 구조
반드시 아래 4섹션으로 작성하세요:

### 1. 내가 이 글을 보는 관점
어떤 독서 습관과 기준으로 이 글을 읽었는지 2~3줄로 서술.

### 2. 평가
- 이해도: (전문 용어 없이 따라갈 수 있었는가?)
- 흥미도: (끝까지 읽고 싶었는가? 어디서 지루해졌는가?)
- 스토리: (이야기가 있는가? 건조한 나열인가?)
- 공감: (공감되는 순간이 있었는가?)
- 기억에 남는 것: (읽고 나서 뭐가 남는가?)

### 3. 보완 방향
일반인이 브런치/네이버 블로그에서 "좋아요"를 누르려면 어떻게 고쳐야 하는지.
도입부, 비유, 마무리 등 구체적으로 제안하세요.

### 4. 점수
점수: N/10

한국어, 500자 이내.`,
	},
	"tech": {
		name: "시니어 개발자",
		prompt: `당신은 10년 경력의 백엔드/풀스택 시니어 엔지니어입니다. 대규모 SaaS 운영 경험이 있습니다.

## 나의 평가 철학
나는 "3년 후에 이 코드를 유지보수할 사람"의 관점으로 봅니다.
YAGNI(You Ain't Gonna Need It)와 KISS를 중시합니다. 과도한 추상화보다 명확한 구조.
Martin Fowler의 "리팩토링은 행동을 보존하면서 구조를 개선하는 것"이 기준입니다.
2일 만에 42페이지+250 API를 만든 속도는 인상적이지만, 기술 부채도 동시에 봐야 합니다.

## 평가 구조
반드시 아래 4섹션으로 작성하세요:

### 1. 내가 이 글을 보는 관점
어떤 엔지니어링 철학과 경험으로 이 글을 읽었는지 2~3줄로 서술.

### 2. 평가
- 아키텍처: (Go+React+MySQL 구조가 이 규모에 적합한가?)
- 확장성: (100채→300채→1000채 갈 때 병목은 어디인가?)
- 유지보수: (57테이블, 250 API — 한 사람이 관리 가능한가?)
- 기술 선택: (GORM, Gin, Vite 등 각 선택의 타당성)
- 자동화 수준: (cron, webhook, AI 분석 — 적절한가?)

### 3. 보완 방향
프로덕션 레벨로 가려면 기술적으로 무엇을 해야 하는지.
테스트, 모니터링, 배포, 보안 등 구체적으로 제시하세요.

### 4. 점수
점수: N/10

한국어, 500자 이내.`,
	},
}

func (s *ArchivingService) ReviewArticle(articleID uint, perspectives []string) (*ArticleReviewResult, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY 미설정")
	}

	article, err := s.wikiSvc.GetArticle(articleID)
	if err != nil {
		return nil, fmt.Errorf("아티클 조회 실패: %w", err)
	}

	if article.Content == "" {
		return nil, fmt.Errorf("비어있는 아티클은 평가할 수 없습니다")
	}

	// 콘텐츠 요약 (너무 길면 앞 3000자만)
	content := article.Content
	if len([]rune(content)) > 3000 {
		content = string([]rune(content)[:3000]) + "\n\n... (이하 생략)"
	}

	userMsg := fmt.Sprintf("글 제목: %s\nPart %d. %s\n\n---\n\n%s",
		article.Title, article.PartNumber, article.PartTitle, content)

	// 지정된 관점이 없으면 전체
	if len(perspectives) == 0 {
		perspectives = []string{"investor", "academic", "operator", "reader", "tech"}
	}

	result := &ArticleReviewResult{
		ArticleID:    articleID,
		ArticleTitle: article.Title,
	}

	for _, key := range perspectives {
		rp, ok := reviewPrompts[key]
		if !ok {
			continue
		}

		log.Printf("[Review] %s 관점 평가 중... (아티클 #%d)", rp.name, articleID)
		review, err := archivingCallOpenAI(apiKey, rp.prompt, userMsg)
		if err != nil {
			log.Printf("[Review] %s 평가 실패: %v", rp.name, err)
			review = "평가 실패: " + err.Error()
		}

		// 점수 추출
		score := 0
		for _, line := range strings.Split(review, "\n") {
			line = strings.TrimSpace(line)
			if strings.Contains(line, "점수:") || strings.Contains(line, "점수 :") {
				fmt.Sscanf(strings.ReplaceAll(line, " ", ""), "점수:%d", &score)
				if score == 0 {
					fmt.Sscanf(strings.ReplaceAll(line, " ", ""), "점수:%d/10", &score)
				}
			}
		}

		result.Perspectives = append(result.Perspectives, ReviewPerspective{
			Key:    key,
			Name:   rp.name,
			Review: strings.TrimSpace(review),
			Score:  score,
		})
	}

	// 종합 요약
	if len(result.Perspectives) > 0 {
		var scores []string
		for _, p := range result.Perspectives {
			scores = append(scores, fmt.Sprintf("%s %d점", p.Name, p.Score))
		}
		result.Summary = strings.Join(scores, " · ")
	}

	// DB에 저장 (기존 평가 삭제 후 새로 저장)
	config.DB.Where("article_id = ?", articleID).Delete(&models.ArticleReview{})
	contentSnap := article.Content
	if len([]rune(contentSnap)) > 500 {
		contentSnap = string([]rune(contentSnap)[:500]) + "..."
	}
	for _, p := range result.Perspectives {
		config.DB.Create(&models.ArticleReview{
			ArticleID:   articleID,
			Perspective: p.Key,
			Name:        p.Name,
			Score:       p.Score,
			Review:      p.Review,
			ContentSnap: contentSnap,
			WordCountAt: article.WordCount,
			RequestedBy: "admin",
		})
	}

	return result, nil
}

// RewriteWithFeedback 특정 평가자의 피드백을 반영하여 글 재작성
func (s *ArchivingService) RewriteWithFeedback(articleID uint, perspectiveKeys []string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY 미설정")
	}

	article, err := s.wikiSvc.GetArticle(articleID)
	if err != nil {
		return "", fmt.Errorf("아티클 조회 실패: %w", err)
	}

	// 선택된 평가자의 리뷰 가져오기
	var reviews []models.ArticleReview
	if len(perspectiveKeys) > 0 {
		config.DB.Where("article_id = ? AND perspective IN ?", articleID, perspectiveKeys).Find(&reviews)
	} else {
		config.DB.Where("article_id = ?", articleID).Find(&reviews)
	}

	if len(reviews) == 0 {
		return "", fmt.Errorf("선택된 평가가 없습니다. 먼저 평가를 실행하세요.")
	}

	// 피드백 텍스트 조합
	var feedbackParts []string
	for _, r := range reviews {
		feedbackParts = append(feedbackParts, fmt.Sprintf("[%s — %d/10]\n%s", r.Name, r.Score, r.Review))
	}
	feedback := strings.Join(feedbackParts, "\n\n---\n\n")

	// 원문 (너무 길면 잘라냄)
	content := article.Content
	if len([]rune(content)) > 4000 {
		content = string([]rune(content)[:4000]) + "\n... (이하 생략)"
	}

	// 앞뒤 3개 아티클 맥락 수집
	neighborCtx := s.getNeighborContext(articleID)

	systemPrompt := `당신은 HIERO 백서의 전문 편집자입니다.
원문을 평가 피드백에 따라 개선합니다.

규칙:
1. 기존 TAB 구조(<!-- TAB: 이름 --> 마커)를 반드시 유지하세요
2. 평가자가 지적한 약점을 구체적으로 보완하세요
3. 원문의 핵심 메시지와 사실 정보는 보존하세요
4. 평가자의 관점과 사상을 이해하고, 그 관점에서 납득할 수 있도록 개선하세요
5. 삭제하지 말고, 부족한 부분을 추가/보강하세요
6. 한국어로 작성
7. 개선한 부분 앞에 주석으로 표시하지 마세요 — 자연스럽게 녹여주세요
` + contextGuidePrompt

	userMsg := fmt.Sprintf(`## 목차 맥락 (앞뒤 3개)

%s

## 반영할 평가 피드백

%s

## 원문

%s

위 맥락과 평가 피드백을 반영하여 원문을 개선해주세요.
앞 아티클과 내용이 겹치지 않게, 뒤 아티클로 자연스럽게 이어지게 작성하세요.`, neighborCtx, feedback, content)

	log.Printf("[Rewrite] 아티클 #%d — %d개 평가 반영하여 재작성 중...", articleID, len(reviews))
	result, err := archivingCallOpenAI(apiKey, systemPrompt, userMsg)
	if err != nil {
		return "", fmt.Errorf("AI 재작성 실패: %w", err)
	}

	return strings.TrimSpace(result), nil
}

// GetArticleReviews 저장된 평가 결과 조회
func (s *ArchivingService) GetArticleReviews(articleID uint) ([]models.ArticleReview, error) {
	var reviews []models.ArticleReview
	err := config.DB.Where("article_id = ?", articleID).
		Order("created_at DESC").Find(&reviews).Error
	return reviews, err
}

// GetReviewSummary CTO Board용 — 평가된 아티클 수 + 최저 점수
type ReviewSummaryItem struct {
	ArticleID    uint   `json:"article_id"`
	ArticleTitle string `json:"article_title"`
	AvgScore     int    `json:"avg_score"`
	MinScore     int    `json:"min_score"`
	ReviewCount  int    `json:"review_count"`
	ReviewedAt   string `json:"reviewed_at"`
}

func (s *ArchivingService) GetReviewSummary() ([]ReviewSummaryItem, error) {
	type row struct {
		ArticleID  uint
		AvgScore   float64
		MinScore   int
		Count      int64
		ReviewedAt string
	}
	var rows []row
	err := config.DB.Model(&models.ArticleReview{}).
		Select("article_id, AVG(score) as avg_score, MIN(score) as min_score, COUNT(*) as count, MAX(created_at) as reviewed_at").
		Group("article_id").
		Order("avg_score ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	var result []ReviewSummaryItem
	for _, r := range rows {
		var article models.WikiArticle
		config.DB.Select("title").First(&article, r.ArticleID)
		result = append(result, ReviewSummaryItem{
			ArticleID:    r.ArticleID,
			ArticleTitle: article.Title,
			AvgScore:     int(r.AvgScore),
			MinScore:     r.MinScore,
			ReviewCount:  int(r.Count),
			ReviewedAt:   r.ReviewedAt,
		})
	}
	return result, nil
}
