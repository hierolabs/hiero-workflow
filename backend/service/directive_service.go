package service

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type DirectiveService struct{}

func NewDirectiveService() *DirectiveService {
	return &DirectiveService{}
}

// --- 생성 ---

type CreateDirectiveInput struct {
	Type       string `json:"type"`        // directive, report, lateral
	FromUserID uint   `json:"from_user_id"`
	ToRole     string `json:"to_role"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	Priority   string `json:"priority"`
	ParentID   *uint  `json:"parent_id"`
	IssueID    *uint  `json:"issue_id"`
	PropertyID *uint  `json:"property_id"`
}

func (s *DirectiveService) Create(input CreateDirectiveInput) (*models.ETFDirective, error) {
	// 발신자 조회
	var fromUser models.AdminUser
	if err := config.DB.First(&fromUser, input.FromUserID).Error; err != nil {
		return nil, fmt.Errorf("발신자를 찾을 수 없습니다")
	}

	// 수신자 조회 (role 기반)
	var toUser models.AdminUser
	if err := config.DB.Where("role_title = ?", input.ToRole).First(&toUser).Error; err != nil {
		return nil, fmt.Errorf("수신자 역할(%s)을 찾을 수 없습니다", input.ToRole)
	}

	if input.Priority == "" {
		input.Priority = models.DirectivePriorityNormal
	}

	directive := models.ETFDirective{
		Type:         input.Type,
		FromUserID:   fromUser.ID,
		FromUserName: fromUser.Name,
		FromRole:     fromUser.RoleTitle,
		ToUserID:     toUser.ID,
		ToUserName:   toUser.Name,
		ToRole:       toUser.RoleTitle,
		Title:        input.Title,
		Content:      input.Content,
		Priority:     input.Priority,
		ParentID:     input.ParentID,
		IssueID:      input.IssueID,
		PropertyID:   input.PropertyID,
		Status:       models.DirectiveStatusPending,
	}

	// 서버 분석: 도메인 충돌 체크 + 중복 체크
	analysis, hasConflict := s.analyze(directive)
	directive.ServerAnalysis = analysis
	directive.HasConflict = hasConflict

	if err := config.DB.Create(&directive).Error; err != nil {
		return nil, err
	}

	// 백그라운드 AI 분석 (저장 후 서버가 "생각"하고 업데이트)
	go s.aiAnalyze(directive.ID)

	return &directive, nil
}

// --- 서버 분석 (저장 시 자동 실행) ---

func (s *DirectiveService) analyze(d models.ETFDirective) (string, bool) {
	var parts []string
	hasConflict := false

	// 1. 도메인 경계 체크 (같은 레벨 lateral인 경우)
	if d.Type == models.DirectiveTypeLateral {
		fromDomains := models.ETFDomains[d.FromRole]
		toDomains := models.ETFDomains[d.ToRole]
		overlap := findOverlap(fromDomains, toDomains)
		if len(overlap) > 0 {
			parts = append(parts, fmt.Sprintf("[도메인 경계] %s↔%s 공통 영역 없음 — 정상", d.FromRole, d.ToRole))
		} else {
			parts = append(parts, fmt.Sprintf("[도메인 분리] %s와 %s는 독립 도메인 — 마찰 없음", d.FromRole, d.ToRole))
		}
	}

	// 2. 지시 범위 체크 (directive인 경우)
	if d.Type == models.DirectiveTypeDirective {
		allowed := models.DirectiveScope[d.FromRole]
		canDirect := false
		for _, r := range allowed {
			if r == d.ToRole {
				canDirect = true
				break
			}
		}
		if !canDirect {
			parts = append(parts, fmt.Sprintf("[범위 초과] %s → %s 직접 지시 권한 없음", d.FromRole, d.ToRole))
			hasConflict = true
		} else {
			parts = append(parts, fmt.Sprintf("[지시 정상] %s → %s 지시 권한 확인", d.FromRole, d.ToRole))
		}
	}

	// 3. 중복 지시 체크 (최근 24시간 내 동일 수신자에게 비슷한 제목)
	var duplicateCount int64
	yesterday := time.Now().Add(-24 * time.Hour)
	config.DB.Model(&models.ETFDirective{}).
		Where("to_role = ? AND title LIKE ? AND created_at > ? AND id != ?",
			d.ToRole, "%"+truncate(d.Title, 10)+"%", yesterday, d.ID).
		Count(&duplicateCount)
	if duplicateCount > 0 {
		parts = append(parts, fmt.Sprintf("[중복 주의] 최근 24시간 내 %s에게 유사 지시 %d건 존재", d.ToRole, duplicateCount))
		hasConflict = true
	}

	// 4. 미완료 지시 적체 체크
	var pendingCount int64
	config.DB.Model(&models.ETFDirective{}).
		Where("to_role = ? AND status IN (?, ?)",
			d.ToRole, models.DirectiveStatusPending, models.DirectiveStatusInProgress).
		Count(&pendingCount)
	if pendingCount >= 5 {
		parts = append(parts, fmt.Sprintf("[적체 경고] %s 미완료 지시 %d건 — 과부하 가능", d.ToRole, pendingCount))
	}

	if len(parts) == 0 {
		return "분석 완료 — 이상 없음", false
	}
	return strings.Join(parts, "\n"), hasConflict
}

func findOverlap(a, b []string) []string {
	set := map[string]bool{}
	for _, v := range a {
		set[v] = true
	}
	var overlap []string
	for _, v := range b {
		if set[v] {
			overlap = append(overlap, v)
		}
	}
	return overlap
}

func truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	return string(runes[:maxLen])
}

// --- AI 분석 (서버 "생각" 레이어) ---

const directiveAIPrompt = `당신은 HIERO 조직의 업무 분석 시스템입니다.
GOT(Founder 김진우) → ETF(CEO/CTO/CFO) → Execution(운영/청소배정/현장/마케팅) 3계층 구조입니다.

도메인 규칙:
- CEO: 경영전략, 팀리더십, 승인권한, 파트너십, 병목해소
- CTO: 문서화, 연구, 기술전략, 메시지기록, 아카이빙, 지식관리
- CFO: 정산, 회계, 세무, 비용관리, 재무, 예산

지시 범위:
- CEO → 마케팅/운영/청소배정/현장 (4개 모두)
- CTO → 마케팅/운영 (2개)
- CFO → 운영/청소배정 (2개)
- 같은 레벨(lateral)은 "요청"이지 "지시"가 아님

마찰 방지 원칙:
- 도메인이 겹치면 Founder가 중재
- 같은 Execution에게 서로 다른 ETF가 동시 지시하면 마찰
- 미완료 5건 이상이면 과부하`

func (s *DirectiveService) aiAnalyze(directiveID uint) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return
	}

	var d models.ETFDirective
	if err := config.DB.First(&d, directiveID).Error; err != nil {
		return
	}

	// 수신자 미완료 건수
	var pendingCount int64
	config.DB.Model(&models.ETFDirective{}).
		Where("to_role = ? AND status IN (?, ?) AND id != ?",
			d.ToRole, models.DirectiveStatusPending, models.DirectiveStatusInProgress, d.ID).
		Count(&pendingCount)

	// 같은 수신자에게 다른 ETF가 보낸 활성 지시
	var otherETFDirectives []models.ETFDirective
	config.DB.Where("to_role = ? AND from_role != ? AND status IN (?, ?) AND id != ?",
		d.ToRole, d.FromRole,
		models.DirectiveStatusPending, models.DirectiveStatusInProgress, d.ID).
		Select("from_role, title").Limit(5).Find(&otherETFDirectives)

	otherInfo := ""
	if len(otherETFDirectives) > 0 {
		var lines []string
		for _, od := range otherETFDirectives {
			lines = append(lines, fmt.Sprintf("  - %s: %s", od.FromRole, od.Title))
		}
		otherInfo = "\n다른 ETF가 같은 수신자에게 보낸 활성 지시:\n" + strings.Join(lines, "\n")
	}

	typeLabel := map[string]string{"directive": "지시", "report": "보고", "lateral": "협의"}[d.Type]
	if typeLabel == "" {
		typeLabel = d.Type
	}

	userMsg := fmt.Sprintf(`분석 요청:
- 발신: %s (%s) → 수신: %s (%s)
- 유형: %s
- 우선순위: %s
- 제목: %s
- 내용: %s
- 수신자 현재 미완료 지시: %d건%s

규칙 체크 결과:
%s

위 정보를 바탕으로 4줄 이내로 분석해주세요:
1. 도메인 적합성
2. 마찰 가능성
3. 우선순위 적절성
4. 권장사항`,
		d.FromRole, d.FromUserName, d.ToRole, d.ToUserName,
		typeLabel, d.Priority, d.Title, d.Content,
		pendingCount, otherInfo, d.ServerAnalysis)

	aiResult, err := archivingCallOpenAI(apiKey, directiveAIPrompt, userMsg)
	if err != nil {
		log.Printf("[Directive AI] 분석 실패: %v", err)
		return
	}

	// 기존 규칙 분석 + AI 분석 합치기
	combined := d.ServerAnalysis + "\n\n[AI 분석]\n" + strings.TrimSpace(aiResult)
	config.DB.Model(&models.ETFDirective{}).Where("id = ?", d.ID).
		Update("server_analysis", combined)

	log.Printf("[Directive AI] #%d 분석 완료", d.ID)
}

// --- GOT 레이어 조회 ---

type GOTSummary struct {
	TopDecisionCount int64          `json:"top_decision_count"`
	ETFPending       map[string]int `json:"etf_pending"`
	ExecutionReports int64          `json:"execution_reports"`
}

func (s *DirectiveService) GetGOTSummary() GOTSummary {
	summary := GOTSummary{ETFPending: map[string]int{}}

	// Founder 결정 대기 건수
	config.DB.Model(&models.Issue{}).
		Where("(escalation_level = 'founder' OR priority = 'P0') AND status IN ('open', 'in_progress')").
		Count(&summary.TopDecisionCount)

	// ETF별 미완료 지시 건수
	for _, role := range []string{"ceo", "cto", "cfo"} {
		var count int64
		config.DB.Model(&models.ETFDirective{}).
			Where("to_role = ? AND status IN (?, ?)", role,
				models.DirectiveStatusPending, models.DirectiveStatusInProgress).
			Count(&count)
		summary.ETFPending[role] = int(count)
	}

	// Execution → ETF 보고 건수
	config.DB.Model(&models.ETFDirective{}).
		Where("type = ? AND status IN (?, ?)", models.DirectiveTypeReport,
			models.DirectiveStatusPending, models.DirectiveStatusAcknowledged).
		Count(&summary.ExecutionReports)

	return summary
}

// --- 상태 업데이트 ---

func (s *DirectiveService) Acknowledge(id uint) error {
	now := time.Now()
	return config.DB.Model(&models.ETFDirective{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":          models.DirectiveStatusAcknowledged,
			"acknowledged_at": &now,
		}).Error
}

func (s *DirectiveService) Start(id uint) error {
	return config.DB.Model(&models.ETFDirective{}).Where("id = ?", id).
		Update("status", models.DirectiveStatusInProgress).Error
}

func (s *DirectiveService) Complete(id uint, resultMemo string) error {
	now := time.Now()
	return config.DB.Model(&models.ETFDirective{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":       models.DirectiveStatusCompleted,
			"completed_at": &now,
			"result_memo":  resultMemo,
		}).Error
}

func (s *DirectiveService) Reject(id uint, reason string) error {
	return config.DB.Model(&models.ETFDirective{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":      models.DirectiveStatusRejected,
			"result_memo": reason,
		}).Error
}

// --- 조회 ---

// 내가 보낸 지시 목록
func (s *DirectiveService) ListSent(userID uint) []models.ETFDirective {
	var list []models.ETFDirective
	config.DB.Where("from_user_id = ?", userID).
		Order("created_at DESC").Limit(50).Find(&list)
	return list
}

// 내가 받은 지시/보고 목록
func (s *DirectiveService) ListReceived(role string) []models.ETFDirective {
	var list []models.ETFDirective
	config.DB.Where("to_role = ? AND status != ?", role, models.DirectiveStatusCompleted).
		Order("FIELD(priority, 'urgent', 'high', 'normal', 'low'), created_at DESC").
		Limit(50).Find(&list)
	return list
}

// ETF 전체 흐름 (ETF Board 용)
func (s *DirectiveService) ListAll() []models.ETFDirective {
	var list []models.ETFDirective
	config.DB.Order("created_at DESC").Limit(100).Find(&list)
	return list
}

// ETF 관계 분석 — 도메인 매트릭스 + 활성 지시 흐름
type ETFRelationship struct {
	// 도메인 경계
	Domains map[string][]string `json:"domains"`

	// 활성 지시 흐름 (방향별 카운트)
	Flows []DirectiveFlow `json:"flows"`

	// 충돌 감지
	Conflicts []models.ETFDirective `json:"conflicts"`

	// 역할별 부하
	Workload map[string]WorkloadStat `json:"workload"`
}

type DirectiveFlow struct {
	FromRole string `json:"from_role"`
	ToRole   string `json:"to_role"`
	Type     string `json:"type"`
	Count    int64  `json:"count"`
}

type WorkloadStat struct {
	Pending    int64 `json:"pending"`
	InProgress int64 `json:"in_progress"`
	Completed  int64 `json:"completed_today"`
	SentToday  int64 `json:"sent_today"`
}

func (s *DirectiveService) GetRelationship() ETFRelationship {
	today := time.Now().Format("2006-01-02")

	// 활성 지시 흐름 집계
	type flowRow struct {
		FromRole string
		ToRole   string
		Type     string
		Count    int64
	}
	var rows []flowRow
	config.DB.Model(&models.ETFDirective{}).
		Select("from_role, to_role, type, COUNT(*) as count").
		Where("status IN (?, ?, ?)",
			models.DirectiveStatusPending,
			models.DirectiveStatusAcknowledged,
			models.DirectiveStatusInProgress).
		Group("from_role, to_role, type").
		Find(&rows)

	flows := make([]DirectiveFlow, 0, len(rows))
	for _, r := range rows {
		flows = append(flows, DirectiveFlow{
			FromRole: r.FromRole, ToRole: r.ToRole,
			Type: r.Type, Count: r.Count,
		})
	}

	// 충돌 감지된 지시
	var conflicts []models.ETFDirective
	config.DB.Where("has_conflict = ? AND status != ?", true, models.DirectiveStatusCompleted).
		Order("created_at DESC").Limit(10).Find(&conflicts)

	// 역할별 부하
	workload := map[string]WorkloadStat{}
	roles := []string{"ceo", "cto", "cfo", "marketing", "operations", "cleaning_dispatch", "field"}
	for _, role := range roles {
		var ws WorkloadStat
		config.DB.Model(&models.ETFDirective{}).Where("to_role = ? AND status = ?", role, "pending").Count(&ws.Pending)
		config.DB.Model(&models.ETFDirective{}).Where("to_role = ? AND status = ?", role, "in_progress").Count(&ws.InProgress)
		config.DB.Model(&models.ETFDirective{}).Where("to_role = ? AND status = ? AND completed_at >= ?", role, "completed", today).Count(&ws.Completed)
		config.DB.Model(&models.ETFDirective{}).Where("from_role = ? AND created_at >= ?", role, today).Count(&ws.SentToday)
		workload[role] = ws
	}

	return ETFRelationship{
		Domains:   models.ETFDomains,
		Flows:     flows,
		Conflicts: conflicts,
		Workload:  workload,
	}
}
