package service

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CleaningDispatchService struct{}

func NewCleaningDispatchService() *CleaningDispatchService { return &CleaningDispatchService{} }

// === 1. 붙여넣기 파싱 ===

type ParsedAssignment struct {
	Cleaner       string `json:"cleaner"`
	CleanerID     uint   `json:"cleaner_id"`
	CleanerMatch  bool   `json:"cleaner_match"`
	PropertyCode  string `json:"property_code"`
	PropertyName  string `json:"property_name"`
	PropertyID    uint   `json:"property_id"`
	PropertyMatch bool   `json:"property_match"`
	CleanType     string `json:"clean_type"` // Q1, Q2, 수동
	Note          string `json:"note"`       // 퇴실시간, 장기숙박 등
	TaskID        uint   `json:"task_id"`    // 기존 CleaningTask 매칭
	TaskMatch     bool   `json:"task_match"`
}

type ParseResult struct {
	Date         string             `json:"date"`
	Assignments  []ParsedAssignment `json:"assignments"`
	TotalCount   int                `json:"total_count"`
	MatchedCount int                `json:"matched_count"`
	Errors       []string           `json:"errors"`
}

var cleanerPattern = regexp.MustCompile(`@(.+?)[\s\n]`)
var propCodePattern = regexp.MustCompile(`([A-V]\d{1,3})[_\s]+(.+?)(?:\s+Q\d|\s+수동|\s+ss|\s*$)`)
var dateHeaderPattern = regexp.MustCompile(`<(\d{1,2})월\s*(\d{1,2})일\s*[^>]*>`)

// ParseAssignmentText — 카톡 배정표 텍스트를 파싱
func (s *CleaningDispatchService) ParseAssignmentText(text string, dateOverride string) *ParseResult {
	result := &ParseResult{}

	// 날짜 추출
	if dateOverride != "" {
		result.Date = dateOverride
	} else if dm := dateHeaderPattern.FindStringSubmatch(text); dm != nil {
		month := dm[1]; day := dm[2]
		if len(month) == 1 { month = "0" + month }
		if len(day) == 1 { day = "0" + day }
		year := time.Now().Format("2006")
		result.Date = year + "-" + month + "-" + day
	} else {
		result.Date = time.Now().Format("2006-01-02")
	}

	// 청소자 이름 → ID 맵
	var cleaners []models.Cleaner
	config.DB.Find(&cleaners)
	cleanerMap := map[string]*models.Cleaner{}
	for i := range cleaners {
		cleanerMap[cleaners[i].Name] = &cleaners[i]
		// 이름 일부 매칭도 (예: "박연실" → "박연실")
		if len([]rune(cleaners[i].Name)) >= 2 {
			cleanerMap[string([]rune(cleaners[i].Name)[:2])] = &cleaners[i]
		}
	}

	// 숙소 코드 → Property 맵
	var properties []models.Property
	config.DB.Find(&properties)
	propMap := map[string]*models.Property{}
	for i := range properties {
		propMap[properties[i].Code] = &properties[i]
	}

	// 파싱
	lines := strings.Split(text, "\n")
	currentCleaner := ""
	var currentCleanerObj *models.Cleaner

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" { continue }

		// @멘션 감지
		if cm := cleanerPattern.FindStringSubmatch(line + " "); cm != nil {
			name := strings.TrimSpace(cm[1])
			// 슬래시 이후 제거 (예: "류지영/여/강동" → "류지영")
			if idx := strings.Index(name, "/"); idx > 0 {
				name = name[:idx]
			}
			// 공백 이후 제거 (예: "김정은 60대" → "김정은")
			if idx := strings.Index(name, " "); idx > 0 {
				name = name[:idx]
			}
			currentCleaner = name
			currentCleanerObj = cleanerMap[name]
			continue
		}

		// 숙소 코드 감지
		if pm := propCodePattern.FindStringSubmatch(line); pm != nil {
			code := pm[1]
			propName := strings.TrimSpace(pm[2])

			cleanType := ""
			if strings.Contains(line, "Q1") { cleanType = "Q1" }
			if strings.Contains(line, "Q2") { cleanType = "Q2" }
			if strings.Contains(line, "수동") { cleanType = "수동" }

			note := ""
			if strings.Contains(line, "퇴실") || strings.Contains(line, "입실") {
				note = line
			}
			if strings.Contains(line, "장기") { note += " 장기숙박" }

			a := ParsedAssignment{
				Cleaner:      currentCleaner,
				PropertyCode: code,
				PropertyName: propName,
				CleanType:    cleanType,
				Note:         strings.TrimSpace(note),
			}

			// 청소자 매칭
			if currentCleanerObj != nil {
				a.CleanerID = currentCleanerObj.ID
				a.CleanerMatch = true
			}

			// 숙소 매칭
			if prop, ok := propMap[code]; ok {
				a.PropertyID = prop.ID
				a.PropertyMatch = true
				a.PropertyName = prop.Name
			}

			// CleaningTask 매칭
			if a.PropertyMatch && result.Date != "" {
				var task models.CleaningTask
				if err := config.DB.Where("property_code = ? AND cleaning_date = ?", code, result.Date).
					First(&task).Error; err == nil {
					a.TaskID = task.ID
					a.TaskMatch = true
				}
			}

			if a.CleanerMatch && a.PropertyMatch {
				result.MatchedCount++
			}

			result.Assignments = append(result.Assignments, a)
		}
	}

	result.TotalCount = len(result.Assignments)
	return result
}

// ConfirmAssignments — 파싱 결과를 실제 CleaningTask에 적용
func (s *CleaningDispatchService) ConfirmAssignments(assignments []ParsedAssignment, date string) (int, int, error) {
	assigned := 0
	created := 0

	for _, a := range assignments {
		if a.CleanerID == 0 { continue }

		if a.TaskMatch && a.TaskID > 0 {
			// 기존 태스크에 배정
			config.DB.Model(&models.CleaningTask{}).Where("id = ?", a.TaskID).Updates(map[string]interface{}{
				"cleaner_id":   a.CleanerID,
				"cleaner_name": a.Cleaner,
				"status":       models.CleaningStatusAssigned,
			})
			assigned++
		} else if a.PropertyMatch && a.PropertyID > 0 {
			// 태스크 없으면 생성
			task := models.CleaningTask{
				PropertyID:   &a.PropertyID,
				PropertyCode: a.PropertyCode,
				PropertyName: a.PropertyName,
				CleaningDate: date,
				CleanerID:    &a.CleanerID,
				CleanerName:  a.Cleaner,
				CleaningCode: a.CleanType,
				Status:       models.CleaningStatusAssigned,
				Priority:     models.CleaningPriorityNormal,
				Memo:         a.Note,
			}
			config.DB.Create(&task)
			created++
		}
	}

	return assigned, created, nil
}

// === 2. AI 자동 배정 ===

type AutoAssignResult struct {
	Date         string             `json:"date"`
	Assignments  []AutoAssignment   `json:"assignments"`
	Unassigned   []string           `json:"unassigned"` // 배정 못 한 숙소
}

type AutoAssignment struct {
	TaskID       uint   `json:"task_id"`
	PropertyCode string `json:"property_code"`
	PropertyName string `json:"property_name"`
	CleanerID    uint   `json:"cleaner_id"`
	CleanerName  string `json:"cleaner_name"`
	Reason       string `json:"reason"` // 왜 이 청소자인지
	Score        int    `json:"score"`  // 매칭 점수
}

// AutoAssign — 미배정 청소 업무에 자동 배정 제안
func (s *CleaningDispatchService) AutoAssign(date string) *AutoAssignResult {
	if date == "" { date = time.Now().Format("2006-01-02") }

	result := &AutoAssignResult{Date: date}

	// 미배정 태스크
	var tasks []models.CleaningTask
	config.DB.Where("cleaning_date = ? AND (cleaner_id IS NULL OR cleaner_id = 0) AND status = ?",
		date, models.CleaningStatusPending).Find(&tasks)

	if len(tasks) == 0 { return result }

	// 가용 청소자
	var cleaners []models.Cleaner
	config.DB.Where("active = ?", true).Find(&cleaners)

	// 요일
	dayMap := map[int]string{0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}
	d, _ := time.Parse("2006-01-02", date)
	today := dayMap[int(d.Weekday())]

	// 이미 배정된 건수
	type assignCount struct {
		CleanerID uint
		Count     int64
	}
	var counts []assignCount
	config.DB.Model(&models.CleaningTask{}).
		Select("cleaner_id, COUNT(*) as count").
		Where("cleaning_date = ? AND cleaner_id IS NOT NULL AND cleaner_id > 0", date).
		Group("cleaner_id").Find(&counts)
	countMap := map[uint]int64{}
	for _, c := range counts {
		countMap[c.CleanerID] = c.Count
	}

	for _, task := range tasks {
		bestScore := -1
		var bestCleaner *models.Cleaner
		var bestReason string

		propCode := task.PropertyCode
		// 숙소 코드에서 권역 추출 (예: "B104" → "B")
		region := ""
		if len(propCode) > 0 {
			region = string(propCode[0])
		}

		for i := range cleaners {
			c := &cleaners[i]
			score := 0
			reasons := []string{}

			// 1. 요일 가용 체크
			if c.AvailableDays != "" && !strings.Contains(c.AvailableDays, today) {
				continue // 오늘 가용 아님
			}

			// 2. 권역 매칭
			if c.Regions != "" && region != "" {
				if strings.Contains(strings.ToUpper(c.Regions), region) {
					score += 30
					reasons = append(reasons, "권역 매칭")
				}
			}

			// 3. 워크로드 (최대건수 대비 여유)
			current := countMap[c.ID]
			maxDaily := int64(c.MaxDaily)
			if maxDaily == 0 { maxDaily = 5 }
			if current >= maxDaily {
				continue // 풀
			}
			remaining := maxDaily - current
			score += int(remaining) * 5
			reasons = append(reasons, fmt.Sprintf("여유 %d건", remaining))

			// 4. 이동수단 보너스
			if c.Transport == "car" {
				score += 10
				reasons = append(reasons, "자차")
			}

			if score > bestScore {
				bestScore = score
				bestCleaner = c
				bestReason = strings.Join(reasons, ", ")
			}
		}

		if bestCleaner != nil {
			result.Assignments = append(result.Assignments, AutoAssignment{
				TaskID:       task.ID,
				PropertyCode: task.PropertyCode,
				PropertyName: task.PropertyName,
				CleanerID:    bestCleaner.ID,
				CleanerName:  bestCleaner.Name,
				Reason:       bestReason,
				Score:        bestScore,
			})
			// 카운트 업데이트 (다음 배정에 반영)
			countMap[bestCleaner.ID]++
		} else {
			result.Unassigned = append(result.Unassigned, task.PropertyCode+"_"+task.PropertyName)
		}
	}

	return result
}

// ConfirmAutoAssign — AI 배정 확정
func (s *CleaningDispatchService) ConfirmAutoAssign(assignments []AutoAssignment) int {
	count := 0
	for _, a := range assignments {
		if a.TaskID == 0 || a.CleanerID == 0 { continue }
		config.DB.Model(&models.CleaningTask{}).Where("id = ?", a.TaskID).Updates(map[string]interface{}{
			"cleaner_id":   a.CleanerID,
			"cleaner_name": a.CleanerName,
			"status":       models.CleaningStatusAssigned,
		})
		count++
	}
	return count
}
