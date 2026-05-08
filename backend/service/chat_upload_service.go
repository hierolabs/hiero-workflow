package service

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type ChatUploadService struct{}

func NewChatUploadService() *ChatUploadService { return &ChatUploadService{} }

// 파싱된 메시지
type ParsedMsg struct {
	Sender    string
	Content   string
	Timestamp time.Time
	MsgDate   string
	MsgTime   string
	MsgType   string // text, photo, system, assignment, completion, issue, supply
}

// 분석 결과
type ChatAnalysisResult struct {
	TotalMessages   int                `json:"total_messages"`
	Saved           int                `json:"saved"`
	DateRange       string             `json:"date_range"`
	Assignments     []AssignmentRecord `json:"assignments"`
	Completions     []CompletionRecord `json:"completions"`
	Issues          []IssueRecord      `json:"issues"`
	SupplyReports   []SupplyRecord     `json:"supply_reports"`
	UnmatchedTasks  []string           `json:"unmatched_tasks"`
	CompletionRate  int                `json:"completion_rate"`
	Summary         string             `json:"summary"`
}

type AssignmentRecord struct {
	Cleaner      string `json:"cleaner"`
	PropertyCode string `json:"property_code"`
	PropertyName string `json:"property_name"`
	CleaningType string `json:"cleaning_type"` // Q1, Q2, 수동 등
	Note         string `json:"note"`
	Matched      bool   `json:"matched"` // CleaningTask와 매칭됨
	TaskID       uint   `json:"task_id"`
}

type CompletionRecord struct {
	Cleaner      string `json:"cleaner"`
	PropertyCode string `json:"property_code"`
	Content      string `json:"content"`
	HasPhoto     bool   `json:"has_photo"`
	Matched      bool   `json:"matched"`
	TaskID       uint   `json:"task_id"`
}

type IssueRecord struct {
	Cleaner      string `json:"cleaner"`
	PropertyCode string `json:"property_code"`
	Content      string `json:"content"`
	Severity     string `json:"severity"` // low, medium, high
}

type SupplyRecord struct {
	Cleaner      string `json:"cleaner"`
	PropertyCode string `json:"property_code"`
	Items        string `json:"items"` // 수건, 침구, 휴지 등
}

// 카카오톡 메시지 패턴
var msgPattern = regexp.MustCompile(`(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.+)`)
var assignPattern = regexp.MustCompile(`<(\d{1,2})월 (\d{1,2})일 [^>]*>`)
var propertyPattern = regexp.MustCompile(`([A-Z]\d+)[_\s]+(.+?)(?:\s+Q\d|\s+수동|\s*$)`)
var cleanerMention = regexp.MustCompile(`@(.+?)[\s\n]`)

// 완료 키워드
var completionKeywords = []string{"끝", "완료", "done", "완", "청소끝", "마감"}
var issueKeywords = []string{"오염", "곰팡이", "깨진", "고장", "파손", "벌레", "냄새", "누수", "막힘", "안됨", "고장남"}
var supplyKeywords = []string{"수건", "침구", "이불", "베개", "휴지", "샴푸", "비품", "세제", "락스", "돌돌이"}

func parseTime(year, month, day, ampm, hour, minute string) time.Time {
	h := atoi(hour)
	if ampm == "오후" && h != 12 {
		h += 12
	} else if ampm == "오전" && h == 12 {
		h = 0
	}
	return time.Date(atoi(year), time.Month(atoi(month)), atoi(day), h, atoi(minute), 0, 0, time.Local)
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n
}

// UploadAndAnalyze — txt 업로드 → 파싱 → DB 저장 → 분석
func (s *ChatUploadService) UploadAndAnalyze(content string, room string) (*ChatAnalysisResult, error) {
	if room == "" {
		room = "cleaning"
	}

	// 1. 파싱
	msgs := s.parseKakaoTalk(content)
	if len(msgs) == 0 {
		return nil, fmt.Errorf("파싱된 메시지가 없습니다")
	}

	// 2. DB 저장 (중복 방지)
	saved := 0
	for _, m := range msgs {
		var existing models.ChatHistory
		if err := config.DB.Where("room = ? AND sender = ? AND msg_date = ? AND msg_time = ? AND content = ?",
			room, m.Sender, m.MsgDate, m.MsgTime, m.Content).First(&existing).Error; err != nil {
			season := 3
			if m.MsgDate < "2025-06" {
				season = 1
			} else if m.MsgDate < "2026-01" {
				season = 2
			}
			config.DB.Create(&models.ChatHistory{
				Room: room, Sender: m.Sender, Content: m.Content,
				MsgDate: m.MsgDate, MsgTime: m.MsgTime, MsgType: m.MsgType,
				Timestamp: m.Timestamp, Season: season,
			})
			saved++
		}
	}

	// 3. 분석
	result := s.analyze(msgs, room)
	result.TotalMessages = len(msgs)
	result.Saved = saved
	if len(msgs) > 0 {
		result.DateRange = msgs[0].MsgDate + " ~ " + msgs[len(msgs)-1].MsgDate
	}

	log.Printf("[ChatUpload] %s: %d건 파싱, %d건 저장, 배정 %d건, 완료 %d건, 이슈 %d건",
		room, len(msgs), saved, len(result.Assignments), len(result.Completions), len(result.Issues))

	return result, nil
}

func (s *ChatUploadService) parseKakaoTalk(content string) []ParsedMsg {
	var msgs []ParsedMsg
	lines := strings.Split(content, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		m := msgPattern.FindStringSubmatch(line)
		if m == nil {
			// 이전 메시지의 연속
			if len(msgs) > 0 {
				msgs[len(msgs)-1].Content += "\n" + line
			}
			continue
		}

		ts := parseTime(m[1], m[2], m[3], m[4], m[5], m[6])
		sender := strings.TrimSpace(m[7])
		ct := strings.TrimSpace(m[8])

		msgType := s.classifyMessage(ct)

		msgs = append(msgs, ParsedMsg{
			Sender: sender, Content: ct,
			Timestamp: ts, MsgDate: ts.Format("2006-01-02"), MsgTime: ts.Format("15:04"),
			MsgType: msgType,
		})
	}

	return msgs
}

func (s *ChatUploadService) classifyMessage(content string) string {
	lower := strings.ToLower(content)

	if strings.HasPrefix(content, "<") && (strings.Contains(content, "청소>") || strings.Contains(content, "업무>")) {
		return "assignment"
	}
	if content == "사진" || content == "동영상" {
		return "photo"
	}

	for _, kw := range completionKeywords {
		if strings.Contains(lower, kw) {
			return "completion"
		}
	}
	for _, kw := range issueKeywords {
		if strings.Contains(lower, kw) {
			return "issue"
		}
	}
	for _, kw := range supplyKeywords {
		if strings.Contains(lower, kw) {
			return "supply"
		}
	}

	return "text"
}

func (s *ChatUploadService) analyze(msgs []ParsedMsg, room string) *ChatAnalysisResult {
	result := &ChatAnalysisResult{}

	// 날짜 추출 (배정 날짜 기준)
	assignDate := ""
	currentCleaner := ""

	for i, m := range msgs {
		// 배정표 감지
		if am := assignPattern.FindStringSubmatch(m.Content); am != nil {
			month := am[1]
			day := am[2]
			if len(month) == 1 { month = "0" + month }
			if len(day) == 1 { day = "0" + day }
			assignDate = "2026-" + month + "-" + day // 시즌3 기준
		}

		// @멘션으로 청소자 감지
		if cm := cleanerMention.FindStringSubmatch(m.Content); cm != nil {
			currentCleaner = strings.TrimSpace(cm[1])
		}

		// 숙소 코드 감지 (배정표 내)
		if pm := propertyPattern.FindStringSubmatch(m.Content); pm != nil {
			code := pm[1]
			name := strings.TrimSpace(pm[2])
			cleanType := ""
			if strings.Contains(m.Content, "Q1") { cleanType = "Q1" }
			if strings.Contains(m.Content, "Q2") { cleanType = "Q2" }
			if strings.Contains(m.Content, "수동") { cleanType = "수동" }

			assignee := currentCleaner
			if assignee == "" { assignee = m.Sender }

			ar := AssignmentRecord{
				Cleaner: assignee, PropertyCode: code, PropertyName: name,
				CleaningType: cleanType,
			}

			// CleaningTask 매칭
			if assignDate != "" {
				var task models.CleaningTask
				if err := config.DB.Where("property_code = ? AND cleaning_date = ?", code, assignDate).
					First(&task).Error; err == nil {
					ar.Matched = true
					ar.TaskID = task.ID
				}
			}

			result.Assignments = append(result.Assignments, ar)
		}

		// 완료 보고 감지
		if m.MsgType == "completion" {
			propCode := ""
			if pm := propertyPattern.FindStringSubmatch(m.Content); pm != nil {
				propCode = pm[1]
			}
			// 이전 메시지에서 숙소 코드 찾기
			if propCode == "" {
				for j := i - 1; j >= 0 && j > i-5; j-- {
					if pm := propertyPattern.FindStringSubmatch(msgs[j].Content); pm != nil {
						propCode = pm[1]
						break
					}
				}
			}

			cr := CompletionRecord{
				Cleaner: m.Sender, PropertyCode: propCode, Content: m.Content,
			}

			// 사진 있는지 (다음 메시지가 사진인지)
			if i+1 < len(msgs) && msgs[i+1].MsgType == "photo" {
				cr.HasPhoto = true
			}

			// CleaningTask 매칭 + 완료 상태 확인
			if propCode != "" && assignDate != "" {
				var task models.CleaningTask
				if err := config.DB.Where("property_code = ? AND cleaning_date = ?", propCode, assignDate).
					First(&task).Error; err == nil {
					cr.Matched = true
					cr.TaskID = task.ID
				}
			}

			result.Completions = append(result.Completions, cr)
		}

		// 이슈 감지
		if m.MsgType == "issue" {
			propCode := ""
			if pm := propertyPattern.FindStringSubmatch(m.Content); pm != nil {
				propCode = pm[1]
			}
			severity := "medium"
			for _, kw := range []string{"파손", "깨진", "누수", "벌레"} {
				if strings.Contains(m.Content, kw) { severity = "high"; break }
			}

			result.Issues = append(result.Issues, IssueRecord{
				Cleaner: m.Sender, PropertyCode: propCode,
				Content: m.Content, Severity: severity,
			})
		}

		// 비품 보고
		if m.MsgType == "supply" {
			propCode := ""
			if pm := propertyPattern.FindStringSubmatch(m.Content); pm != nil {
				propCode = pm[1]
			}
			items := []string{}
			for _, kw := range supplyKeywords {
				if strings.Contains(m.Content, kw) { items = append(items, kw) }
			}
			result.SupplyReports = append(result.SupplyReports, SupplyRecord{
				Cleaner: m.Sender, PropertyCode: propCode,
				Items: strings.Join(items, ", "),
			})
		}
	}

	// 완료율 계산
	if len(result.Assignments) > 0 {
		result.CompletionRate = len(result.Completions) * 100 / len(result.Assignments)
	}

	// 요약
	result.Summary = fmt.Sprintf("배정 %d건, 완료 %d건 (%d%%), 이슈 %d건, 비품 %d건",
		len(result.Assignments), len(result.Completions), result.CompletionRate,
		len(result.Issues), len(result.SupplyReports))

	return result
}
