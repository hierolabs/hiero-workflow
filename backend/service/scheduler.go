package service

import (
	"log"
	"time"
)

// Scheduler 데이터 파이프라인 자동 갱신 스케줄러
// ──────────────────────────────────────────────────
// 매일 08:00 — 청소 생성 + 진단 갱신
// 매주 월요일 09:00 — 시장 데이터 임포트
// 매월 1일 06:00 — 전월 월간 리포트 + 비용 재분배
type Scheduler struct {
	reportSvc    *MonthlyReportService
	diagSvc      *DiagnosisSeedService
	cleaningSvc  *CleaningService
	allocSvc     *CostAllocationService
	marketSvc    *MarketDataService
}

func NewScheduler() *Scheduler {
	return &Scheduler{
		reportSvc:   NewMonthlyReportService(),
		diagSvc:     NewDiagnosisSeedService(),
		cleaningSvc: NewCleaningService(),
		allocSvc:    NewCostAllocationService(),
		marketSvc:   NewMarketDataService(),
	}
}

// Start 스케줄러 시작 (goroutine으로 호출)
func (s *Scheduler) Start() {
	go s.runDaily()
	go s.runWeekly()
	go s.runMonthly()
	log.Println("[Scheduler] 데이터 파이프라인 스케줄러 시작")
	log.Println("[Scheduler]   매일 08:00 — 진단 갱신")
	log.Println("[Scheduler]   매주 월 09:00 — 시장 데이터")
	log.Println("[Scheduler]   매월 1일 06:00 — 월간 리포트 + 비용 재분배")
}

// RunAll 모든 파이프라인 즉시 실행 (수동 트리거용)
func (s *Scheduler) RunAll() map[string]interface{} {
	results := map[string]interface{}{}

	// 진단
	n, err := s.diagSvc.GenerateAll()
	results["diagnoses"] = map[string]interface{}{"processed": n, "error": errStr(err)}

	// 월간 리포트 (전월)
	n, err = s.reportSvc.GeneratePreviousMonth()
	results["monthly_report"] = map[string]interface{}{"inserted": n, "error": errStr(err)}

	// 비용 재분배
	n, err = s.allocSvc.AllocateAll()
	results["cost_allocations"] = map[string]interface{}{"reallocated": n, "error": errStr(err)}

	// 시장 데이터
	job, err := s.marketSvc.ImportFromLatestFiles()
	if job != nil {
		results["market_import"] = map[string]interface{}{"processed": job.ProcessedRecords, "error": errStr(err)}
	} else {
		results["market_import"] = map[string]interface{}{"processed": 0, "error": errStr(err)}
	}

	return results
}

// RunTarget 특정 파이프라인만 실행
func (s *Scheduler) RunTarget(target string, month string) map[string]interface{} {
	result := map[string]interface{}{"target": target}

	switch target {
	case "monthly_reports":
		if month != "" {
			n, err := s.reportSvc.GenerateMonth(month)
			result["inserted"] = n
			result["error"] = errStr(err)
		} else {
			n, err := s.reportSvc.GeneratePreviousMonth()
			result["inserted"] = n
			result["error"] = errStr(err)
		}
	case "monthly_reports_all":
		n, err := s.reportSvc.GenerateAll()
		result["inserted"] = n
		result["error"] = errStr(err)
	case "diagnoses":
		n, err := s.diagSvc.GenerateAll()
		result["processed"] = n
		result["error"] = errStr(err)
	case "cost_allocations":
		n, err := s.allocSvc.AllocateAll()
		result["reallocated"] = n
		result["error"] = errStr(err)
	case "market_import":
		job, err := s.marketSvc.ImportFromLatestFiles()
		if job != nil {
			result["processed"] = job.ProcessedRecords
		}
		result["error"] = errStr(err)
	default:
		result["error"] = "unknown target: " + target
	}

	return result
}

// ── 내부: 일간 스케줄 ───────────────────────────────────────

func (s *Scheduler) runDaily() {
	for {
		next := nextTime(8, 0) // 매일 08:00
		sleepDuration := time.Until(next)
		log.Printf("[Scheduler] 다음 일간 작업: %s (%.0f분 후)", next.Format("01/02 15:04"), sleepDuration.Minutes())
		time.Sleep(sleepDuration)

		log.Println("[Scheduler] 일간 작업 시작...")
		start := time.Now()

		// 진단 갱신
		n, err := s.diagSvc.GenerateAll()
		if err != nil {
			log.Printf("[Scheduler] 진단 오류: %v", err)
		} else {
			log.Printf("[Scheduler] 진단 갱신: %d개", n)
		}

		log.Printf("[Scheduler] 일간 작업 완료 (%.1f초)", time.Since(start).Seconds())
	}
}

// ── 내부: 주간 스케줄 ───────────────────────────────────────

func (s *Scheduler) runWeekly() {
	for {
		next := nextWeekday(time.Monday, 9, 0) // 매주 월요일 09:00
		sleepDuration := time.Until(next)
		log.Printf("[Scheduler] 다음 주간 작업: %s (%.0f시간 후)", next.Format("01/02 15:04"), sleepDuration.Hours())
		time.Sleep(sleepDuration)

		log.Println("[Scheduler] 주간 작업 시작...")
		start := time.Now()

		// 시장 데이터 임포트
		job, err := s.marketSvc.ImportFromLatestFiles()
		if err != nil {
			log.Printf("[Scheduler] 시장 데이터 오류: %v", err)
		} else if job != nil {
			log.Printf("[Scheduler] 시장 데이터: %d건 임포트", job.ProcessedRecords)
		}

		log.Printf("[Scheduler] 주간 작업 완료 (%.1f초)", time.Since(start).Seconds())
	}
}

// ── 내부: 월간 스케줄 ───────────────────────────────────────

func (s *Scheduler) runMonthly() {
	for {
		next := nextMonthFirst(6, 0) // 매월 1일 06:00
		sleepDuration := time.Until(next)
		log.Printf("[Scheduler] 다음 월간 작업: %s (%.0f시간 후)", next.Format("01/02 15:04"), sleepDuration.Hours())
		time.Sleep(sleepDuration)

		log.Println("[Scheduler] 월간 작업 시작...")
		start := time.Now()

		// 전월 월간 리포트
		n, err := s.reportSvc.GeneratePreviousMonth()
		if err != nil {
			log.Printf("[Scheduler] 월간 리포트 오류: %v", err)
		} else {
			log.Printf("[Scheduler] 월간 리포트: %d개 생성", n)
		}

		// 비용 재분배
		n, err = s.allocSvc.AllocateAll()
		if err != nil {
			log.Printf("[Scheduler] 비용 재분배 오류: %v", err)
		} else {
			log.Printf("[Scheduler] 비용 재분배: %d건", n)
		}

		// 진단 갱신
		n, err = s.diagSvc.GenerateAll()
		if err != nil {
			log.Printf("[Scheduler] 진단 오류: %v", err)
		} else {
			log.Printf("[Scheduler] 진단 갱신: %d개", n)
		}

		log.Printf("[Scheduler] 월간 작업 완료 (%.1f초)", time.Since(start).Seconds())
	}
}

// ── 시간 유틸리티 ───────────────────────────────────────────

// nextTime 다음 HH:MM 시각 (오늘 이미 지났으면 내일)
func nextTime(hour, min int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, min, 0, 0, now.Location())
	if now.After(next) {
		next = next.Add(24 * time.Hour)
	}
	return next
}

// nextWeekday 다음 특정 요일 HH:MM
func nextWeekday(day time.Weekday, hour, min int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, min, 0, 0, now.Location())

	daysUntil := int(day - now.Weekday())
	if daysUntil < 0 {
		daysUntil += 7
	}
	if daysUntil == 0 && now.After(next) {
		daysUntil = 7
	}
	next = next.AddDate(0, 0, daysUntil)
	return next
}

// nextMonthFirst 다음 달 1일 HH:MM (이번 달 1일이 아직 안 지났으면 이번 달)
func nextMonthFirst(hour, min int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), 1, hour, min, 0, 0, now.Location())
	if now.After(next) {
		next = next.AddDate(0, 1, 0)
	}
	return next
}

func errStr(err error) string {
	if err != nil {
		return err.Error()
	}
	return ""
}
