package handler

import (
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type SchedulerHandler struct {
	sched *service.Scheduler
}

func NewSchedulerHandler(sched *service.Scheduler) *SchedulerHandler {
	return &SchedulerHandler{sched: sched}
}

// RunAll POST /admin/pipeline/run-all — 전체 파이프라인 즉시 실행
func (h *SchedulerHandler) RunAll(c *gin.Context) {
	results := h.sched.RunAll()
	c.JSON(http.StatusOK, gin.H{"message": "파이프라인 전체 실행 완료", "results": results})
}

// RunTarget POST /admin/pipeline/run?target=monthly_reports&month=2026-04
func (h *SchedulerHandler) RunTarget(c *gin.Context) {
	target := c.Query("target")
	month := c.Query("month")

	if target == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "target 필수. 가능한 값: monthly_reports, monthly_reports_all, diagnoses, cost_allocations, market_import",
		})
		return
	}

	result := h.sched.RunTarget(target, month)
	c.JSON(http.StatusOK, result)
}

// Status GET /admin/pipeline/status — 스케줄러 상태
func (h *SchedulerHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"schedules": []gin.H{
			{"name": "daily", "time": "08:00", "tasks": "진단 갱신 (DiagnosisSeedService)"},
			{"name": "weekly", "time": "월요일 09:00", "tasks": "시장 데이터 임포트 (삼삼엠투)"},
			{"name": "monthly", "time": "1일 06:00", "tasks": "월간 리포트 + 비용 재분배 + 진단 갱신"},
		},
		"manual_triggers": []string{
			"POST /admin/pipeline/run-all",
			"POST /admin/pipeline/run?target=monthly_reports&month=2026-04",
			"POST /admin/pipeline/run?target=monthly_reports_all",
			"POST /admin/pipeline/run?target=diagnoses",
			"POST /admin/pipeline/run?target=cost_allocations",
			"POST /admin/pipeline/run?target=market_import",
		},
	})
}
