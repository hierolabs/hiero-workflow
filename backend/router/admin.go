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
	messageHandler := handler.NewMessageHandler()
	leadHandler := handler.NewLeadHandler()
	manualHandler := handler.NewManualHandler()
	transactionHandler := handler.NewTransactionHandler()
	dashboardHandler := handler.NewDashboardHandler()

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
			protected.PATCH("/properties/reorder", propertyHandler.Reorder)

			// 운영 캘린더
			protected.GET("/calendar", calendarHandler.GetCalendar)
			protected.GET("/calendar/summary", calendarHandler.GetSummary)

			// 예약 관리
			protected.GET("/reservations", reservationHandler.List)
			protected.GET("/reservations/:id", reservationHandler.Get)
			protected.PATCH("/reservations/:id", reservationHandler.UpdateRemarks)
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

			// 청소코드
			protected.GET("/cleaning-codes", cleaningHandler.ListCleaningCodes)
			protected.GET("/cleaning/workload", cleaningHandler.CleanerWorkload)
			protected.GET("/cleaning/extensions", cleaningHandler.Extensions)

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

			// Hostex 거래 내역
			protected.POST("/transactions/upload", transactionHandler.Upload)
			protected.GET("/transactions/summary", transactionHandler.Summary)
			protected.GET("/transactions/months", transactionHandler.Months)
			protected.GET("/transactions/channels", transactionHandler.Channels)

			// 5엔진 사업 진단
			protected.GET("/diagnosis", diagnosisHandler.ListAll)
			protected.GET("/diagnosis/portfolio", diagnosisHandler.Portfolio)
			protected.POST("/diagnosis/generate", diagnosisHandler.Generate)
			protected.GET("/diagnosis/:property_id", diagnosisHandler.GetOne)
			protected.PUT("/diagnosis/:property_id", diagnosisHandler.Update)

			// 액션 엔진 — 오늘 할 일 자동 생성 → 이슈 등록
			protected.POST("/dashboard/execute-actions", dashboardHandler.ExecuteActions)

			// 정산 관리 (거래 기반 — 기간별 숙소 정산)
			protected.GET("/settlement/summary", transactionHandler.Settlement)
			protected.GET("/settlement/export", transactionHandler.ExportSettlement)
			protected.GET("/reservations/export", transactionHandler.ExportReservations)
			protected.GET("/transactions/export", transactionHandler.ExportTransactions)

			// 게스트 메시지 (채팅)
			protected.GET("/messages/conversations", messageHandler.ListConversations)
			protected.GET("/messages/conversations/:conversation_id", messageHandler.GetConversation)
			protected.POST("/messages/conversations/:conversation_id/messages", messageHandler.SendMessage)
			protected.POST("/messages/conversations/:conversation_id/read", messageHandler.MarkRead)
			protected.POST("/messages/conversations/:conversation_id/sync", messageHandler.SyncConversationMessages)
			protected.POST("/messages/sync", messageHandler.SyncMessages)
			protected.POST("/messages/sync-all", messageHandler.SyncAllMessages)
			protected.GET("/messages/analysis", messageHandler.AnalyzeMessages)
			protected.POST("/messages/sync-reviews", messageHandler.SyncReviews)
			protected.POST("/messages/conversations/:conversation_id/requests", messageHandler.CreateGuestRequest)
			protected.PATCH("/messages/requests/:id/status", messageHandler.UpdateGuestRequestStatus)
			protected.GET("/messages/requests/pending", messageHandler.ListPendingRequests)

			// 멀티박스 (응대 기록)
			protected.GET("/communications/recent", commHandler.ListRecent)
			protected.GET("/communications/reservation/:id", commHandler.ListByReservation)
			protected.GET("/communications/property/:id", commHandler.ListByProperty)
			protected.POST("/communications", commHandler.Create)

			// 위탁운영 마케팅 CRM
			marketing := protected.Group("/marketing")
			{
				marketing.GET("/dashboard", leadHandler.Dashboard)
				marketing.GET("/leads", leadHandler.List)
				marketing.POST("/leads", leadHandler.Create)
				marketing.GET("/leads/:id", leadHandler.Get)
				marketing.PUT("/leads/:id", leadHandler.Update)
				marketing.PATCH("/leads/:id/status", leadHandler.UpdateStatus)
				marketing.POST("/leads/:id/score", leadHandler.RecalculateScore)
				marketing.POST("/leads/:id/message", leadHandler.GenerateMessage)
				marketing.POST("/leads/:id/diagnosis", leadHandler.SaveDiagnosis)
				marketing.POST("/leads/:id/revenue", leadHandler.CalculateRevenue)
				marketing.POST("/leads/:id/proposal", leadHandler.SaveProposal)
				marketing.POST("/leads/:id/activity", leadHandler.AddActivity)
			}

			// 운영 매뉴얼 (위키)
			protected.GET("/manual", manualHandler.List)
			protected.GET("/manual/entry", manualHandler.Get)
			protected.POST("/manual", manualHandler.Upsert)
			protected.DELETE("/manual", manualHandler.Delete)

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
