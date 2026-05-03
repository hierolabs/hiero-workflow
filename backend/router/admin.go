package router

import (
	"hiero-workflow/backend/handler"
	"hiero-workflow/backend/middleware"

	"github.com/gin-gonic/gin"
)

func registerAdminRoutes(r *gin.Engine) {
	authHandler := handler.NewAdminAuthHandler()
	taskHandler := handler.NewAdminTaskHandler()
	userHandler := handler.NewAdminUserHandler()
	propertyHandler := handler.NewPropertyHandler()
	reservationHandler := handler.NewAdminReservationHandler()
	hostexSyncHandler := handler.NewHostexSyncHandler()
	cleaningHandler := handler.NewCleaningHandler()
	issueHandler := handler.NewIssueHandler()
	commHandler := handler.NewCommunicationHandler()
	calendarHandler := handler.NewCalendarHandler()
	diagnosisHandler := handler.NewDiagnosisHandler()

	admin := r.Group("/admin")
	{
		// 인증 불필요
		admin.POST("/login", authHandler.Login)

		// 인증 필요 (모든 admin)
		protected := admin.Group("")
		protected.Use(middleware.AdminAuth())
		{
			protected.GET("/me", authHandler.Me)

			// 태스크
			protected.GET("/tasks", taskHandler.GetAllTasks)
			protected.POST("/tasks", taskHandler.CreateTask)
			protected.PATCH("/tasks/:id/status", taskHandler.UpdateTaskStatus)
			protected.DELETE("/tasks/:id", taskHandler.DeleteTask)

			// 공간 관리
			protected.GET("/properties", propertyHandler.List)
			protected.GET("/properties/export", propertyHandler.ExportProperties)
			protected.POST("/properties/import", propertyHandler.ImportProperties)
			protected.GET("/properties/:id", propertyHandler.Get)
			protected.POST("/properties", propertyHandler.Create)
			protected.PUT("/properties/:id", propertyHandler.Update)
			protected.DELETE("/properties/:id", propertyHandler.Delete)
			protected.PATCH("/properties/:id/status", propertyHandler.UpdateStatus)
			protected.PATCH("/properties/:id/operation-status", propertyHandler.UpdateOperationStatus)

			// 운영 캘린더
			protected.GET("/calendar", calendarHandler.GetCalendar)
			protected.GET("/calendar/summary", calendarHandler.GetSummary)

			// 예약 관리
			protected.GET("/reservations", reservationHandler.List)
			protected.GET("/reservations/:id", reservationHandler.Get)
			protected.POST("/reservations/rematch", reservationHandler.Rematch)

			// 매출 집계
			protected.GET("/revenue/summary", reservationHandler.RevenueSummary)

			// Hostex 연동
			protected.GET("/hostex/mappings", hostexSyncHandler.GetMappings)
			protected.POST("/hostex/link", hostexSyncHandler.LinkProperty)
			protected.DELETE("/hostex/unlink/:id", hostexSyncHandler.UnlinkProperty)
			protected.POST("/hostex/sync", hostexSyncHandler.TriggerSync)
			protected.POST("/hostex/sync-all", hostexSyncHandler.TriggerFullSync)

			// 청소 관리
			protected.GET("/cleaning/tasks", cleaningHandler.ListTasks)
			protected.GET("/cleaning/summary", cleaningHandler.GetSummary)
			protected.POST("/cleaning/generate", cleaningHandler.Generate)
			protected.PATCH("/cleaning/tasks/:id/assign", cleaningHandler.Assign)
			protected.PATCH("/cleaning/tasks/:id/start", cleaningHandler.Start)
			protected.PATCH("/cleaning/tasks/:id/complete", cleaningHandler.Complete)
			protected.PATCH("/cleaning/tasks/:id/issue", cleaningHandler.ReportIssue)

			// 청소자 관리
			protected.GET("/cleaners", cleaningHandler.ListCleaners)
			protected.POST("/cleaners", cleaningHandler.CreateCleaner)
			protected.PUT("/cleaners/:id", cleaningHandler.UpdateCleaner)
			protected.DELETE("/cleaners/:id", cleaningHandler.DeleteCleaner)

			// 이슈 트래킹
			protected.GET("/issues", issueHandler.List)
			protected.GET("/issues/summary", issueHandler.GetSummary)
			protected.GET("/issues/:id", issueHandler.Get)
			protected.POST("/issues", issueHandler.Create)
			protected.PATCH("/issues/:id/status", issueHandler.UpdateStatus)
			protected.PATCH("/issues/:id/assignee", issueHandler.UpdateAssignee)

			// 5엔진 사업 진단
			protected.GET("/diagnosis", diagnosisHandler.ListAll)
			protected.GET("/diagnosis/portfolio", diagnosisHandler.Portfolio)
			protected.GET("/diagnosis/:property_id", diagnosisHandler.GetOne)
			protected.PUT("/diagnosis/:property_id", diagnosisHandler.Update)

			// 정산 관리 (이슈 기반 — settlement 타입 필터)
			protected.GET("/settlement/summary", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "settlement module — use issues API with issue_type=settlement"})
			})

			// 멀티박스 (응대 기록)
			protected.GET("/communications/recent", commHandler.ListRecent)
			protected.GET("/communications/reservation/:id", commHandler.ListByReservation)
			protected.GET("/communications/property/:id", commHandler.ListByProperty)
			protected.POST("/communications", commHandler.Create)

			// 관리자 목록 (일반 admin도 조회 가능)
			protected.GET("/users", userHandler.GetUsers)
		}

		// super_admin 전용
		superAdmin := admin.Group("")
		superAdmin.Use(middleware.AdminAuth(), middleware.SuperAdminOnly())
		{
			superAdmin.POST("/users", userHandler.CreateUser)
			superAdmin.PATCH("/users/:id", userHandler.UpdateUser)
			superAdmin.PATCH("/users/:id/password", userHandler.ResetPassword)
			superAdmin.DELETE("/users/:id", userHandler.DeleteUser)
		}
	}
}
