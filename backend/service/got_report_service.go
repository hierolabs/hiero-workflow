package service

import (
	"encoding/json"
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type GOTReportService struct {
	etfSvc   *ETFBoardService
	data3Svc *Data3Service
}

func NewGOTReportService() *GOTReportService {
	return &GOTReportService{
		etfSvc:   NewETFBoardService(),
		data3Svc: NewData3Service(),
	}
}

// --- Alert 구조 ---

type AnomalyAlert struct {
	Type        string  `json:"type"`         // cost_spike, revenue_drop, cash_gap, duplicate, refund_spike, occupancy_drop
	Severity    string  `json:"severity"`     // critical, warning, info
	Title       string  `json:"title"`        // 무엇이 이상한지
	Evidence    string  `json:"evidence"`     // 왜 이상한지 (근거)
	Impact      string  `json:"impact"`       // 얼마나 심각한지
	Action      string  `json:"action"`       // 어떻게 해야 하는지
	Value       int64   `json:"value"`        // 관련 금액
	ChangeRate  float64 `json:"change_rate"`  // 변동률
	Category    string  `json:"category"`     // 세부 카테고리 (비용 항목 등)
}

// 하위 호환
type CostAlert = AnomalyAlert

type DecisionItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`   // revenue, risk, strategy
	AssignTo    string `json:"assign_to"`  // 담당 ETF: ceo, cto, cfo
	Status      string `json:"status"`     // pending, approved, rejected, hold
	DirectiveID *uint  `json:"directive_id,omitempty"` // 승인 후 생성된 지시 ID
}

// --- Daily Report ---

func (s *GOTReportService) BuildDailyReport() (*models.GOTReport, error) {
	now := time.Now()
	period := now.Format("2006-01-02")

	// 이번 주 기준 (월~오늘)
	dow := int(now.Weekday())
	if dow == 0 {
		dow = 7
	}
	weekStart := now.AddDate(0, 0, -(dow - 1))
	weekStartStr := weekStart.Format("2006-01-02")
	todayStr := now.Format("2006-01-02")

	// 이번 주 Data 1/2/3
	fin := s.etfSvc.BuildFinancialFlow(weekStartStr, todayStr)

	// 7일 입금 예정
	weekEnd := now.AddDate(0, 0, 7).Format("2006-01-02")
	deposit7d := int64(0)
	if summary, err := s.data3Svc.GetData3Summary(todayStr, weekEnd); err == nil && summary != nil {
		deposit7d = summary.ExpectedDeposit
	}

	// 비용 이상 감지 (주간 기준)
	alerts := s.DetectAlertsWeekly(weekStartStr, todayStr)
	alertsJSON, _ := json.Marshal(alerts)

	// 어제 결정 실행 결과 조회
	prevResults := s.getPreviousDecisionResults()

	// 결정 사항 생성
	decisions := s.buildDecisions(fin, deposit7d, alerts)
	decisionsJSON, _ := json.Marshal(decisions)

	// 현금 갭
	cashGap := fin.Data2.ThisMonth - fin.Data1.ThisMonth

	// 최대 비용 카테고리 (주간)
	topCat := s.getTopCostCategoryRange(weekStartStr, todayStr)

	// 요약 생성
	summary := s.generateWeeklySummary(fin, cashGap, deposit7d, alerts, prevResults)

	report := &models.GOTReport{
		ReportType:        models.GOTReportDaily,
		Period:            period,
		Revenue:           fin.Data1.ThisMonth,
		Cost:              fin.Data2.ThisMonth,
		Net:               fin.Data3.ThisMonth,
		RevenuePrev:       fin.Data1.LastMonth,
		CostPrev:          fin.Data2.LastMonth,
		NetPrev:           fin.Data3.LastMonth,
		CashGap:           cashGap,
		ExpectedDeposit7d: deposit7d,
		TopCostCategory:   topCat,
		Alerts:            string(alertsJSON),
		Decisions:         string(decisionsJSON),
		Summary:           summary,
	}

	if err := config.DB.Create(report).Error; err != nil {
		return nil, err
	}

	// Founder에게 알림
	notifSvc := NewNotificationService()
	notifSvc.NotifyByRoleTitle("founder", "delegated",
		fmt.Sprintf("[일간 재무] 금주 매출 ₩%s · 비용 ₩%s", formatKRW(int(fin.Data1.ThisMonth)), formatKRW(int(fin.Data2.ThisMonth))),
		summary, nil, "시스템")

	LogActivity(nil, "시스템", "got_report_daily", "got_report", &report.ID, summary)

	return report, nil
}

// --- Weekly Report ---

func (s *GOTReportService) BuildWeeklyReport() (*models.GOTReport, error) {
	now := time.Now()
	_, week := now.ISOWeek()
	period := fmt.Sprintf("%d-W%02d", now.Year(), week)

	// 이번 주 범위
	dow := int(now.Weekday())
	if dow == 0 {
		dow = 7
	}
	weekStart := now.AddDate(0, 0, -(dow - 1))
	weekEnd := weekStart.AddDate(0, 0, 6)

	fin := s.etfSvc.BuildFinancialFlow(
		weekStart.Format("2006-01-02"),
		weekEnd.Format("2006-01-02"),
	)

	alerts := s.DetectAlerts()
	alertsJSON, _ := json.Marshal(alerts)

	cashGap := fin.Data2.ThisMonth - fin.Data1.ThisMonth
	summary := fmt.Sprintf("주간 P&L: 매출 ₩%s, 비용 ₩%s, 순이익 ₩%s. 전주 대비 매출 %+.1f%%",
		formatKRW(int(fin.Data1.ThisMonth)),
		formatKRW(int(fin.Data2.ThisMonth)),
		formatKRW(int(fin.Data3.ThisMonth)),
		fin.Data1.ChangeRate)

	report := &models.GOTReport{
		ReportType:      models.GOTReportWeekly,
		Period:          period,
		Revenue:         fin.Data1.ThisMonth,
		Cost:            fin.Data2.ThisMonth,
		Net:             fin.Data3.ThisMonth,
		RevenuePrev:     fin.Data1.LastMonth,
		CostPrev:        fin.Data2.LastMonth,
		NetPrev:         fin.Data3.LastMonth,
		CashGap:         cashGap,
		TopCostCategory: s.getTopCostCategoryRange("", ""),
		Alerts:          string(alertsJSON),
		Summary:         summary,
	}

	if err := config.DB.Create(report).Error; err != nil {
		return nil, err
	}

	notifSvc := NewNotificationService()
	notifSvc.NotifyByRoleTitle("founder", "delegated",
		fmt.Sprintf("[주간 재무] W%02d 순이익 ₩%s", week, formatKRW(int(fin.Data3.ThisMonth))),
		summary, nil, "시스템")

	return report, nil
}

// --- Monthly Report ---

func (s *GOTReportService) BuildMonthlyReport() (*models.GOTReport, error) {
	now := time.Now()
	// 전월 확정
	lastMonth := now.AddDate(0, -1, 0)
	period := lastMonth.Format("2006-01")
	start := fmt.Sprintf("%s-01", period)
	endDay := time.Date(lastMonth.Year(), lastMonth.Month()+1, 0, 0, 0, 0, 0, now.Location())
	end := endDay.Format("2006-01-02")

	fin := s.etfSvc.BuildFinancialFlow(start, end)

	// 적자 숙소 수
	var lossCount int64
	config.DB.Model(&models.MonthlyPropertyReport{}).
		Where("month = ? AND net < 0", period).Count(&lossCount)

	alerts := s.DetectAlerts()
	alertsJSON, _ := json.Marshal(alerts)

	margin := float64(0)
	if fin.Data1.ThisMonth > 0 {
		margin = float64(fin.Data3.ThisMonth) / float64(fin.Data1.ThisMonth) * 100
	}

	summary := fmt.Sprintf("월간 확정: 매출 ₩%s, 비용 ₩%s, 순이익 ₩%s (마진 %.1f%%). 적자 숙소 %d개.",
		formatKRW(int(fin.Data1.ThisMonth)),
		formatKRW(int(fin.Data2.ThisMonth)),
		formatKRW(int(fin.Data3.ThisMonth)),
		margin, lossCount)

	report := &models.GOTReport{
		ReportType:      models.GOTReportMonthly,
		Period:          period,
		Revenue:         fin.Data1.ThisMonth,
		Cost:            fin.Data2.ThisMonth,
		Net:             fin.Data3.ThisMonth,
		RevenuePrev:     fin.Data1.LastMonth,
		CostPrev:        fin.Data2.LastMonth,
		NetPrev:         fin.Data3.LastMonth,
		CashGap:         fin.Data2.ThisMonth - fin.Data1.ThisMonth,
		TopCostCategory: s.getTopCostCategoryRange("", ""),
		Alerts:          string(alertsJSON),
		Summary:         summary,
	}

	config.DB.Create(report)

	notifSvc := NewNotificationService()
	notifSvc.NotifyByRoleTitle("founder", "delegated",
		fmt.Sprintf("[월간 확정] %s 순이익 ₩%s", period, formatKRW(int(fin.Data3.ThisMonth))),
		summary, nil, "시스템")

	return report, nil
}

// --- 다차원 이상 감지 ---

func (s *GOTReportService) DetectAlerts() []AnomalyAlert {
	var alerts []AnomalyAlert

	now := time.Now()
	elapsed := now.Day()
	thisStart := fmt.Sprintf("%d-%02d-01", now.Year(), now.Month())
	thisEnd := now.Format("2006-01-02")
	lastMonth := now.AddDate(0, -1, 0)
	lastStart := fmt.Sprintf("%d-%02d-01", lastMonth.Year(), lastMonth.Month())
	lastEnd := time.Date(lastMonth.Year(), lastMonth.Month()+1, 0, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	daysLastMonth := time.Date(lastMonth.Year(), lastMonth.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()

	// ① 비용 카테고리별 급증 (일평균 기준 보정)
	categories := []string{"청소 비용", "관리비", "Rent_out", "운영 비용", "노동 비용", "소모품 비용", "인테리어"}
	for _, cat := range categories {
		var thisAmt, lastAmt int64
		config.DB.Model(&models.HostexTransaction{}).
			Where("type = '비용' AND category = ? AND transaction_at >= ? AND transaction_at < ?", cat, thisStart, thisEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&thisAmt)
		config.DB.Model(&models.HostexTransaction{}).
			Where("type = '비용' AND category = ? AND transaction_at >= ? AND transaction_at < ?", cat, lastStart, lastEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&lastAmt)

		if lastAmt > 0 && elapsed > 0 {
			dailyThis := float64(thisAmt) / float64(elapsed)
			dailyLast := float64(lastAmt) / float64(daysLastMonth)
			rate := (dailyThis - dailyLast) / dailyLast * 100
			if rate > 30 {
				sev := "warning"
				if rate > 50 {
					sev = "critical"
				}
				alerts = append(alerts, AnomalyAlert{
					Type:       "cost_spike",
					Severity:   sev,
					Title:      fmt.Sprintf("%s 일평균 %.0f%% 증가", cat, rate),
					Evidence:   fmt.Sprintf("이번달 일평균 ₩%s vs 전월 일평균 ₩%s", formatKRW(int(dailyThis)), formatKRW(int(dailyLast))),
					Impact:     fmt.Sprintf("월말 예상 ₩%s (전월 ₩%s)", formatKRW(int(dailyThis*30)), formatKRW(int(lastAmt))),
					Action:     "해당 카테고리 거래 내역 확인 → /settlement",
					Value:      thisAmt,
					ChangeRate: rate,
					Category:   cat,
				})
			}
		}
	}

	// ② 매출 급감 (일평균 기준)
	var revThis, revLast int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = '수입' AND transaction_at >= ? AND transaction_at < ?", thisStart, thisEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&revThis)
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = '수입' AND transaction_at >= ? AND transaction_at < ?", lastStart, lastEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&revLast)

	if revLast > 0 && elapsed > 0 {
		dailyRevThis := float64(revThis) / float64(elapsed)
		dailyRevLast := float64(revLast) / float64(daysLastMonth)
		revRate := (dailyRevThis - dailyRevLast) / dailyRevLast * 100
		if revRate < -20 {
			sev := "warning"
			if revRate < -40 {
				sev = "critical"
			}
			alerts = append(alerts, AnomalyAlert{
				Type:       "revenue_drop",
				Severity:   sev,
				Title:      fmt.Sprintf("매출 일평균 %.0f%% 감소", -revRate),
				Evidence:   fmt.Sprintf("이번달 일평균 ₩%s vs 전월 일평균 ₩%s", formatKRW(int(dailyRevThis)), formatKRW(int(dailyRevLast))),
				Impact:     fmt.Sprintf("월말 예상 매출 ₩%s (전월 ₩%s)", formatKRW(int(dailyRevThis*30)), formatKRW(int(revLast))),
				Action:     "가동률·가격 점검 → /revenue",
				Value:      revThis,
				ChangeRate: revRate,
			})
		}
	}

	// ③ 현금 갭 (비용 > 매출)
	if revThis > 0 && revThis < (revThis+revLast)/3 {
		// 의미있는 데이터가 있을 때만
		cashGap := int64(0)
		config.DB.Model(&models.HostexTransaction{}).
			Where("type = '비용' AND transaction_at >= ? AND transaction_at < ?", thisStart, thisEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&cashGap)
		if cashGap > revThis {
			gap := cashGap - revThis
			alerts = append(alerts, AnomalyAlert{
				Type:     "cash_gap",
				Severity: "critical",
				Title:    fmt.Sprintf("현금 갭 ₩%s", formatKRW(int(gap))),
				Evidence: fmt.Sprintf("비용 ₩%s > 매출 ₩%s", formatKRW(int(cashGap)), formatKRW(int(revThis))),
				Impact:   "운전 자금 부족 위험",
				Action:   "입금 예정 확인 + 비용 이연 검토",
				Value:    gap,
			})
		}
	}

	// ④ 중복 거래 감지
	var dupCount int64
	config.DB.Model(&models.HostexTransaction{}).
		Select("COUNT(*) - COUNT(DISTINCT reservation_ref, category, amount)").
		Where("transaction_at >= ?", thisStart).
		Scan(&dupCount)
	if dupCount > 5 {
		alerts = append(alerts, AnomalyAlert{
			Type:     "duplicate",
			Severity: "warning",
			Title:    fmt.Sprintf("중복 거래 %d건 감지", dupCount),
			Evidence: "동일 예약코드+항목+금액이 여러 번 기록됨",
			Impact:   "매출/비용 집계가 부풀려질 수 있음",
			Action:   "CSV 업로드 이력 확인 → 중복 정리 필요",
			Value:    dupCount,
		})
	}

	// ⑤ 환불 급증
	var refundThis, refundLast int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("category = '객실 요금 환불' AND transaction_at >= ? AND transaction_at < ?", thisStart, thisEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&refundThis)
	config.DB.Model(&models.HostexTransaction{}).
		Where("category = '객실 요금 환불' AND transaction_at >= ? AND transaction_at < ?", lastStart, lastEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&refundLast)

	if refundLast > 0 && elapsed > 0 {
		dailyRefThis := float64(refundThis) / float64(elapsed)
		dailyRefLast := float64(refundLast) / float64(daysLastMonth)
		if dailyRefLast > 0 {
			refRate := (dailyRefThis - dailyRefLast) / dailyRefLast * 100
			if refRate > 50 {
				alerts = append(alerts, AnomalyAlert{
					Type:       "refund_spike",
					Severity:   "warning",
					Title:      fmt.Sprintf("환불 일평균 %.0f%% 증가", refRate),
					Evidence:   fmt.Sprintf("이번달 ₩%s (%d일) vs 전월 ₩%s", formatKRW(int(refundThis)), elapsed, formatKRW(int(refundLast))),
					Impact:     "CS 이슈 또는 품질 문제 가능성",
					Action:     "환불 건별 사유 확인 → /issues",
					Value:      refundThis,
					ChangeRate: refRate,
				})
			}
		}
	}

	// DB에 저장 (upsert by alert_key)
	period := now.Format("2006-01-02")
	for _, a := range alerts {
		key := fmt.Sprintf("%s_%s_%s", a.Type, a.Category, period)
		var existing models.GOTAlert
		if err := config.DB.Where("alert_key = ?", key).First(&existing).Error; err != nil {
			// 새 알림
			config.DB.Create(&models.GOTAlert{
				AlertKey: key,
				Type:     a.Type,
				Severity: a.Severity,
				Title:    a.Title,
				Evidence: a.Evidence,
				Impact:   a.Impact,
				Action:   a.Action,
				Value:    a.Value,
				Category: a.Category,
				Status:   models.AlertStatusNew,
				Period:   period,
			})
		}
	}

	return alerts
}

// --- 알림 상태 조회 (DB 기반, new만 팝업 / 나머지 접힘) ---

func (s *GOTReportService) GetActiveAlerts() []models.GOTAlert {
	var alerts []models.GOTAlert
	config.DB.Where("status IN (?, ?)", models.AlertStatusNew, models.AlertStatusForwarded).
		Order("FIELD(severity, 'critical', 'warning', 'info'), created_at DESC").
		Find(&alerts)
	return alerts
}

func (s *GOTReportService) GetDismissedAlerts(limit int) []models.GOTAlert {
	if limit <= 0 {
		limit = 20
	}
	var alerts []models.GOTAlert
	config.DB.Where("status NOT IN (?, ?)", models.AlertStatusNew, models.AlertStatusForwarded).
		Order("action_at DESC").Limit(limit).Find(&alerts)
	return alerts
}

// --- 7단계 의사결정 프로세스 ---

// Step 1→2: 검토 (Founder가 데이터 확인)
func (s *GOTReportService) AcknowledgeAlert(id uint, userName string) error {
	now := time.Now()
	return config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status": models.AlertStatusAcknowledged, "action_by": userName,
			"action_at": now, "step": models.AlertStep2Reviewed,
		}).Error
}

// Step 2→3: 판단 (승인 — 다음 단계에서 지시 자동 생성)
func (s *GOTReportService) ApproveAlert(id uint, userName, memo string) error {
	var alert models.GOTAlert
	if err := config.DB.First(&alert, id).Error; err != nil {
		return err
	}

	now := time.Now()
	assignTo := alert.AssignTo
	if assignTo == "" {
		assignTo = models.AlertAssignMap[alert.Type]
	}
	if assignTo == "" {
		assignTo = "ceo" // 기본값
	}

	// Step 3: 판단 기록
	if err := config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"status": models.AlertStatusApproved, "action_by": userName,
			"action_at": now, "action_memo": memo,
			"step": models.AlertStep3Decided, "decision": "approved",
			"assign_to": assignTo,
		}).Error; err != nil {
		return err
	}

	// Step 3→4: 자동 전달 — directive 생성
	return s.forwardAlertAsDirective(id, userName, assignTo, memo)
}

// Step 3→4: 판단 후 자동 전달 (directive 생성)
func (s *GOTReportService) forwardAlertAsDirective(alertID uint, userName, toRole, memo string) error {
	var alert models.GOTAlert
	if err := config.DB.First(&alert, alertID).Error; err != nil {
		return err
	}

	// Founder 사용자 조회
	var founder models.AdminUser
	config.DB.Where("role_title = 'founder' AND login_id != 'admin'").First(&founder)

	content := fmt.Sprintf("[시스템 감지] %s\n\n근거: %s\n영향: %s", alert.Title, alert.Evidence, alert.Impact)
	if memo != "" {
		content = memo + "\n\n" + content
	}

	dirSvc := NewDirectiveService()
	dir, err := dirSvc.Create(CreateDirectiveInput{
		Type:       models.DirectiveTypeDirective,
		FromUserID: founder.ID,
		ToRole:     toRole,
		Title:      alert.Title,
		Content:    content,
		Priority:   "high",
	})
	if err != nil {
		return fmt.Errorf("지시 생성 실패: %v", err)
	}

	// Step 4 업데이트
	now := time.Now()
	config.DB.Model(&models.GOTAlert{}).Where("id = ?", alertID).
		Updates(map[string]interface{}{
			"step":         models.AlertStep4Forwarded,
			"directive_id": dir.ID,
			"forwarded_to": toRole,
			"status":       models.AlertStatusForwarded,
			"action_at":    now,
		})

	LogActivity(&founder.ID, userName, "alert_directive_created", "got_alert", &alertID,
		fmt.Sprintf("→ %s(directive #%d): %s", toRole, dir.ID, alert.Title))

	return nil
}

// Step 2→3: 판단 (보류 — 추가 정보 필요)
func (s *GOTReportService) HoldAlert(id uint, userName, memo string) error {
	now := time.Now()
	return config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"step": models.AlertStep3Decided, "decision": "hold",
			"action_by": userName, "action_at": now, "action_memo": memo,
			"status": models.AlertStatusAcknowledged,
		}).Error
}

// Step 2→3: 판단 (반려 — 조치 불필요)
func (s *GOTReportService) RejectAlert(id uint, userName, memo string) error {
	now := time.Now()
	return config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"step": models.AlertStep3Decided, "decision": "rejected",
			"status": models.AlertStatusRejected, "action_by": userName,
			"action_at": now, "action_memo": memo,
		}).Error
}

// Step 4→5: 전송 (특정 역할에게 직접 지시 — approve 안 거치고 바로 전송)
func (s *GOTReportService) ForwardAlert(id uint, userName, toRole, memo string) error {
	var alert models.GOTAlert
	if err := config.DB.First(&alert, id).Error; err != nil {
		return err
	}

	now := time.Now()
	config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"step": models.AlertStep3Decided, "decision": "approved",
			"assign_to": toRole, "action_by": userName, "action_at": now,
			"action_memo": memo,
		})

	return s.forwardAlertAsDirective(id, userName, toRole, memo)
}

// Step 5→6: Founder 결과 확인 (directive가 completed 되면 호출)
func (s *GOTReportService) VerifyAlertResult(id uint, userName string) error {
	now := time.Now()
	return config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"step": models.AlertStep6Verified, "action_by": userName, "action_at": now,
		}).Error
}

// Step 6→7: 아카이빙 (자동 — 다음 일간 보고서 생성 시 호출)
func (s *GOTReportService) ArchiveAlert(id uint) error {
	return config.DB.Model(&models.GOTAlert{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"step": models.AlertStep7Archived, "status": "archived",
		}).Error
}

// 연결된 directive 상태 동기화 (Step 5 자동 감지)
func (s *GOTReportService) SyncAlertDirectiveStatus() {
	var alerts []models.GOTAlert
	config.DB.Where("directive_id IS NOT NULL AND step = ?", models.AlertStep4Forwarded).Find(&alerts)
	for _, a := range alerts {
		if a.DirectiveID == nil {
			continue
		}
		var dir models.ETFDirective
		if err := config.DB.First(&dir, *a.DirectiveID).Error; err != nil {
			continue
		}
		if dir.Status == models.DirectiveStatusInProgress ||
			dir.Status == models.DirectiveStatusAcknowledged {
			config.DB.Model(&models.GOTAlert{}).Where("id = ?", a.ID).
				Update("step", models.AlertStep5Executing)
		}
		if dir.Status == models.DirectiveStatusCompleted {
			config.DB.Model(&models.GOTAlert{}).Where("id = ?", a.ID).
				Updates(map[string]interface{}{
					"step":        models.AlertStep5Executing,
					"action_memo": dir.ResultMemo,
				})
		}
		if dir.Status == models.DirectiveStatusVerified {
			config.DB.Model(&models.GOTAlert{}).Where("id = ?", a.ID).
				Updates(map[string]interface{}{
					"step":   models.AlertStep6Verified,
					"status": models.AlertStatusApproved,
				})
		}
	}
}

// 활성 알림 조회 시 directive 상태 동기화
func (s *GOTReportService) GetActiveAlertsWithSync() []models.GOTAlert {
	s.SyncAlertDirectiveStatus()
	return s.GetActiveAlerts()
}

// --- 결정 사항 생성 (담당 ETF 자동 매핑) ---

func (s *GOTReportService) buildDecisions(fin FinancialFlow, deposit7d int64, alerts []CostAlert) []DecisionItem {
	var decisions []DecisionItem

	// 현금 갭 → CFO
	cashGap := fin.Data2.ThisMonth - fin.Data1.ThisMonth
	if cashGap > 0 {
		decisions = append(decisions, DecisionItem{
			Title:       fmt.Sprintf("현금 갭 ₩%s — 운전 자금 확보 필요", formatKRW(int(cashGap))),
			Description: fmt.Sprintf("비용 ₩%s이 매출 ₩%s보다 많음. 7일내 입금 예정 ₩%s", formatKRW(int(fin.Data2.ThisMonth)), formatKRW(int(fin.Data1.ThisMonth)), formatKRW(int(deposit7d))),
			Category:    "risk",
			AssignTo:    "cfo",
			Status:      "pending",
		})
	}

	// 비용 이상 → CFO
	if len(alerts) > 0 {
		desc := ""
		for _, a := range alerts {
			desc += fmt.Sprintf("%s +%.0f%%, ", a.Category, a.ChangeRate)
		}
		decisions = append(decisions, DecisionItem{
			Title:       fmt.Sprintf("비용 이상 %d건 감지", len(alerts)),
			Description: desc,
			Category:    "risk",
			AssignTo:    "cfo",
			Status:      "pending",
		})
	}

	// 매출 하락 → CEO
	if fin.Data1.ChangeRate < -20 {
		decisions = append(decisions, DecisionItem{
			Title:       fmt.Sprintf("매출 %.0f%% 하락 — 가동률/가격 점검 필요", fin.Data1.ChangeRate),
			Description: fmt.Sprintf("이전 기간 ₩%s → 현재 ₩%s", formatKRW(int(fin.Data1.LastMonth)), formatKRW(int(fin.Data1.ThisMonth))),
			Category:    "revenue",
			AssignTo:    "ceo",
			Status:      "pending",
		})
	}

	return decisions
}

// --- 주간 기준 이상 감지 ---

func (s *GOTReportService) DetectAlertsWeekly(weekStart, weekEnd string) []AnomalyAlert {
	var alerts []AnomalyAlert

	// 전주 기간 계산
	ws, _ := time.Parse("2006-01-02", weekStart)
	we, _ := time.Parse("2006-01-02", weekEnd)
	days := int(we.Sub(ws).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	prevStart := ws.AddDate(0, 0, -7).Format("2006-01-02")
	prevEnd := ws.Format("2006-01-02")

	// ① 비용 카테고리별 급증 (주간 vs 전주)
	categories := []string{"청소 비용", "관리비", "Rent_out", "운영 비용", "노동 비용", "소모품 비용", "인테리어"}
	for _, cat := range categories {
		var thisAmt, lastAmt int64
		config.DB.Model(&models.HostexTransaction{}).
			Where("type = '비용' AND category = ? AND transaction_at >= ? AND transaction_at <= ?", cat, weekStart, weekEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&thisAmt)
		config.DB.Model(&models.HostexTransaction{}).
			Where("type = '비용' AND category = ? AND transaction_at >= ? AND transaction_at < ?", cat, prevStart, prevEnd).
			Select("COALESCE(SUM(amount), 0)").Scan(&lastAmt)

		if lastAmt > 0 {
			rate := (float64(thisAmt) - float64(lastAmt)) / float64(lastAmt) * 100
			if rate > 30 {
				sev := "warning"
				if rate > 50 {
					sev = "critical"
				}
				alerts = append(alerts, AnomalyAlert{
					Type: "cost_spike", Severity: sev,
					Title:      fmt.Sprintf("%s 금주 %.0f%% 증가", cat, rate),
					Evidence:   fmt.Sprintf("금주 ₩%s vs 전주 ₩%s", formatKRW(int(thisAmt)), formatKRW(int(lastAmt))),
					Impact:     fmt.Sprintf("주간 초과 ₩%s", formatKRW(int(thisAmt-lastAmt))),
					Action:     "해당 카테고리 거래 내역 확인 → /settlement",
					Value:      thisAmt, ChangeRate: rate, Category: cat,
				})
			}
		}
	}

	// ② 매출 급감 (주간 vs 전주)
	var revThis, revLast int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = '수입' AND transaction_at >= ? AND transaction_at <= ?", weekStart, weekEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&revThis)
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = '수입' AND transaction_at >= ? AND transaction_at < ?", prevStart, prevEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&revLast)

	if revLast > 0 {
		revRate := (float64(revThis) - float64(revLast)) / float64(revLast) * 100
		if revRate < -20 {
			sev := "warning"
			if revRate < -40 {
				sev = "critical"
			}
			alerts = append(alerts, AnomalyAlert{
				Type: "revenue_drop", Severity: sev,
				Title:      fmt.Sprintf("매출 금주 %.0f%% 감소", -revRate),
				Evidence:   fmt.Sprintf("금주 ₩%s vs 전주 ₩%s", formatKRW(int(revThis)), formatKRW(int(revLast))),
				Impact:     fmt.Sprintf("주간 감소 ₩%s", formatKRW(int(revLast-revThis))),
				Action:     "가동률·가격 점검 → /revenue",
				Value:      revThis, ChangeRate: revRate,
			})
		}
	}

	// ③ 현금 갭 (금주 비용 > 금주 매출)
	var costThis int64
	config.DB.Model(&models.HostexTransaction{}).
		Where("type = '비용' AND transaction_at >= ? AND transaction_at <= ?", weekStart, weekEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&costThis)
	if costThis > revThis && revThis > 0 {
		gap := costThis - revThis
		alerts = append(alerts, AnomalyAlert{
			Type: "cash_gap", Severity: "critical",
			Title:    fmt.Sprintf("금주 현금 갭 ₩%s", formatKRW(int(gap))),
			Evidence: fmt.Sprintf("비용 ₩%s > 매출 ₩%s", formatKRW(int(costThis)), formatKRW(int(revThis))),
			Impact:   "운전 자금 부족 위험",
			Action:   "입금 예정 확인 + 비용 이연 검토",
			Value:    gap,
		})
	}

	// DB 저장
	period := time.Now().Format("2006-01-02")
	for _, a := range alerts {
		key := fmt.Sprintf("%s_%s_%s", a.Type, a.Category, period)
		var existing models.GOTAlert
		if err := config.DB.Where("alert_key = ?", key).First(&existing).Error; err != nil {
			config.DB.Create(&models.GOTAlert{
				AlertKey: key, Type: a.Type, Severity: a.Severity,
				Title: a.Title, Evidence: a.Evidence, Impact: a.Impact,
				Action: a.Action, Value: a.Value, Category: a.Category,
				Status: models.AlertStatusNew, Period: period,
			})
		}
	}
	return alerts
}

// --- 어제 결정 실행 결과 조회 ---

func (s *GOTReportService) getPreviousDecisionResults() []string {
	var results []string
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	// 어제 일간 보고서의 decisions에서 승인된 것 → 연결된 directive 상태 확인
	var prevReport models.GOTReport
	if err := config.DB.Where("report_type = 'daily' AND period = ?", yesterday).
		Order("created_at DESC").First(&prevReport).Error; err != nil {
		return results
	}

	var decisions []DecisionItem
	if err := json.Unmarshal([]byte(prevReport.Decisions), &decisions); err != nil {
		return results
	}

	for _, d := range decisions {
		if d.DirectiveID != nil {
			var dir models.ETFDirective
			if err := config.DB.First(&dir, *d.DirectiveID).Error; err == nil {
				status := "미완료"
				if dir.Status == models.DirectiveStatusCompleted || dir.Status == models.DirectiveStatusVerified {
					status = "완료"
				} else if dir.Status == models.DirectiveStatusInProgress {
					status = "진행 중"
				}
				results = append(results, fmt.Sprintf("[%s] %s → %s(%s)", status, d.Title, dir.ToUserName, dir.ToRole))
			}
		}
	}
	return results
}

// --- Decision 승인 → Directive 자동 생성 ---

func (s *GOTReportService) ApproveDecision(reportID uint, decisionIndex int, founderUserID uint, memo string) (*models.ETFDirective, error) {
	var report models.GOTReport
	if err := config.DB.First(&report, reportID).Error; err != nil {
		return nil, fmt.Errorf("보고서를 찾을 수 없습니다")
	}

	var decisions []DecisionItem
	if err := json.Unmarshal([]byte(report.Decisions), &decisions); err != nil {
		return nil, fmt.Errorf("결정 사항 파싱 실패")
	}

	if decisionIndex < 0 || decisionIndex >= len(decisions) {
		return nil, fmt.Errorf("유효하지 않은 결정 인덱스: %d", decisionIndex)
	}

	d := &decisions[decisionIndex]
	if d.Status != "pending" {
		return nil, fmt.Errorf("이미 처리된 결정입니다: %s", d.Status)
	}

	// Directive 생성
	dirSvc := NewDirectiveService()
	content := d.Description
	if memo != "" {
		content = memo + "\n\n[자동생성 근거]\n" + d.Description
	}

	dir, err := dirSvc.Create(CreateDirectiveInput{
		Type:       models.DirectiveTypeDirective,
		FromUserID: founderUserID,
		ToRole:     d.AssignTo,
		Title:      d.Title,
		Content:    content,
		Priority:   "high",
	})
	if err != nil {
		return nil, fmt.Errorf("지시 생성 실패: %v", err)
	}

	// Decision 상태 업데이트
	d.Status = "approved"
	d.DirectiveID = &dir.ID
	updatedJSON, _ := json.Marshal(decisions)
	config.DB.Model(&models.GOTReport{}).Where("id = ?", reportID).
		Update("decisions", string(updatedJSON))

	LogActivity(&founderUserID, "김진우", "decision_approved", "got_report", &reportID,
		fmt.Sprintf("결정 #%d 승인 → directive #%d → %s", decisionIndex, dir.ID, d.AssignTo))

	return dir, nil
}

// --- Decision 보류/반려 ---

func (s *GOTReportService) HoldDecision(reportID uint, decisionIndex int, status, memo string) error {
	var report models.GOTReport
	if err := config.DB.First(&report, reportID).Error; err != nil {
		return err
	}

	var decisions []DecisionItem
	if err := json.Unmarshal([]byte(report.Decisions), &decisions); err != nil {
		return err
	}

	if decisionIndex < 0 || decisionIndex >= len(decisions) {
		return fmt.Errorf("유효하지 않은 결정 인덱스")
	}

	decisions[decisionIndex].Status = status // "hold" or "rejected"
	if memo != "" {
		decisions[decisionIndex].Description += "\n\n[" + status + "] " + memo
	}
	updatedJSON, _ := json.Marshal(decisions)
	config.DB.Model(&models.GOTReport{}).Where("id = ?", reportID).
		Update("decisions", string(updatedJSON))
	return nil
}

// --- 최대 비용 카테고리 (기간 지정) ---

func (s *GOTReportService) getTopCostCategoryRange(start, end string) string {
	now := time.Now()
	if start == "" {
		start = fmt.Sprintf("%d-%02d-01", now.Year(), now.Month())
	}
	if end == "" {
		end = now.Format("2006-01-02")
	}
	type catRow struct {
		Category string
		Total    int64
	}
	var top catRow
	config.DB.Model(&models.HostexTransaction{}).
		Select("category, SUM(amount) as total").
		Where("type = '비용' AND transaction_at >= ? AND transaction_at <= ?", start, end).
		Group("category").Order("total DESC").Limit(1).Scan(&top)
	return top.Category
}

// --- 주간 요약 생성 ---

func (s *GOTReportService) generateWeeklySummary(fin FinancialFlow, cashGap, deposit7d int64, alerts []CostAlert, prevResults []string) string {
	line1 := fmt.Sprintf("금주 매출 ₩%s, 비용 ₩%s, 순이익 ₩%s.",
		formatKRW(int(fin.Data1.ThisMonth)),
		formatKRW(int(fin.Data2.ThisMonth)),
		formatKRW(int(fin.Data3.ThisMonth)))

	line2 := ""
	if cashGap > 0 {
		line2 = fmt.Sprintf("현금 갭 ₩%s. 7일내 입금 예정 ₩%s.", formatKRW(int(cashGap)), formatKRW(int(deposit7d)))
	} else {
		line2 = "현금 흐름 양호."
	}

	line3 := ""
	if len(alerts) > 0 {
		line3 = fmt.Sprintf("이상 %d건: %s.", len(alerts), alerts[0].Title)
	} else {
		line3 = "이상 없음."
	}

	line4 := ""
	if len(prevResults) > 0 {
		line4 = fmt.Sprintf(" 어제 결정 %d건: %s.", len(prevResults), prevResults[0])
	}

	return line1 + " " + line2 + " " + line3 + line4
}

// --- 조회 ---

func (s *GOTReportService) List(reportType string, limit int) []models.GOTReport {
	if limit <= 0 {
		limit = 20
	}
	db := config.DB.Model(&models.GOTReport{})
	if reportType != "" {
		db = db.Where("report_type = ?", reportType)
	}
	var reports []models.GOTReport
	db.Order("created_at DESC").Limit(limit).Find(&reports)
	return reports
}

func (s *GOTReportService) GetLatest() map[string]*models.GOTReport {
	result := map[string]*models.GOTReport{}
	types := []string{models.GOTReportDaily, models.GOTReportWeekly, models.GOTReportMonthly}
	for _, t := range types {
		var r models.GOTReport
		if err := config.DB.Where("report_type = ?", t).Order("created_at DESC").First(&r).Error; err == nil {
			result[t] = &r
		}
	}
	return result
}

func (s *GOTReportService) MarkRead(id uint) error {
	now := time.Now()
	return config.DB.Model(&models.GOTReport{}).Where("id = ?", id).
		Updates(map[string]interface{}{"is_read": true, "read_at": now}).Error
}
