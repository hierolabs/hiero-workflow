package router

import (
	"hiero-workflow/backend/handler"

	"github.com/gin-gonic/gin"
)

func registerAPIRoutes(r *gin.Engine) {
	taskHandler := handler.NewTaskHandler()
	reservationHandler := handler.NewReservationHandler()
	webhookHandler := handler.NewWebhookHandler()
	dashboardHandler := handler.NewDashboardHandler()

	api := r.Group("/api")
	{
		// 태스크
		api.GET("/tasks", taskHandler.GetTasks)
		api.POST("/tasks", taskHandler.CreateTask)
		api.PATCH("/tasks/:id/status", taskHandler.UpdateTaskStatus)

		// 대시보드 (DB 기반 — Hostex API 미호출)
		api.GET("/dashboard/ceo", dashboardHandler.GetCEODashboard)

		// 예약 (호스텍스)
		api.GET("/reservations/today", reservationHandler.GetToday)
		api.GET("/reservations", reservationHandler.GetReservations)
		api.GET("/properties", reservationHandler.GetProperties)

		// 웹훅
		api.POST("/webhooks/hostex", webhookHandler.HandleHostex)
		api.GET("/webhooks/logs", webhookHandler.GetLogs)
		api.POST("/webhooks/sync", webhookHandler.InitialSync)
	}
}
