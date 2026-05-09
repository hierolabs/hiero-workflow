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
	data3Handler := handler.NewData3Handler()
	costHandler := handler.NewCostHandler()
	checklistHandler := handler.NewChecklistHandler()
	aiChatHandler := handler.NewAiChatHandler()
	aiAgentHandler := handler.NewAiAgentHandler()
	founderHandler := handler.NewFounderHandler()
	etfBoardHandler := handler.NewETFBoardHandler()
	directiveHandler := handler.NewDirectiveHandler()
	executionHandler := handler.NewExecutionHandler()
	teamChatHandler := handler.NewTeamChatHandler()
	issueDetectionHandler := handler.NewIssueDetectionHandler()
	opsFeedHandler := handler.NewOpsFeedHandler()
	opsPulseHandler := handler.NewOpsPulseHandler()
	csAgentHandler := handler.NewCSAgentHandler()
	notifHandler := handler.NewNotificationHandler()
	wikiHandler := handler.NewWikiHandler()
	multidataHandler := handler.NewMultidataHandler()
	attendanceHandler := handler.NewAttendanceHandler()
	lifecycleHandler := handler.NewLifecycleHandler()
	infraHandler := handler.NewInfraHandler()
	documentHandler := handler.NewDocumentHandler()
	chatHistoryHandler := handler.NewChatHistoryHandler()
	chatUploadHandler := handler.NewChatUploadHandler()
	cleaningDispatchHandler := handler.NewCleaningDispatchHandler()
	cleaningRecordsHandler := handler.NewCleaningRecordsHandler()
	csKnowledgeHandler := handler.NewCSKnowledgeHandler()
	archivingHandler := handler.NewArchivingHandler()
	pricingHandler := handler.NewPricingHandler()
	priceLabsHandler := handler.NewPriceLabsHandler()
	marketDataHandler := handler.NewMarketDataHandler()
	monthlyReportHandler := handler.NewMonthlyReportHandler()
	schedulerHandler := handler.NewSchedulerHandler(schedulerInstance)
	devProjectHandler := handler.NewDevProjectHandler()

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
			protected.POST("/properties/import-details", propertyHandler.ImportDetails)
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

			// 가격/캘린더 관리 (Hostex 연동)
			protected.POST("/pricing/sync", pricingHandler.Sync)
			protected.GET("/pricing/calendar", pricingHandler.GetCalendar)
			protected.GET("/pricing/links", pricingHandler.Links)
			protected.PUT("/pricing/price", pricingHandler.UpdatePrice)
			protected.PUT("/pricing/restrictions", pricingHandler.UpdateRestrictions)
			protected.PUT("/pricing/availability", pricingHandler.UpdateAvailability)
			protected.POST("/pricing/samsam/check", pricingHandler.SamsamCheck)

			// PriceLabs 연동
			protected.POST("/pricelabs/sync", priceLabsHandler.Sync)
			protected.GET("/pricelabs/compare", priceLabsHandler.Compare)
			protected.GET("/pricelabs/kpi", priceLabsHandler.KPIs)

			// 시장 데이터 (외부 OTA 크롤링)
			protected.POST("/market/import/rooms", marketDataHandler.ImportRooms)
			protected.POST("/market/import/contracts", marketDataHandler.ImportContracts)
			protected.POST("/market/import/auto", marketDataHandler.AutoImport)
			protected.GET("/market/prices", marketDataHandler.GetPrices)
			protected.GET("/market/compare", marketDataHandler.GetComparison)
			protected.GET("/market/summary", marketDataHandler.GetSummary)
			protected.GET("/market/jobs", marketDataHandler.GetJobs)

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
			protected.PATCH("/cleaning/tasks/:id/dispatch", cleaningHandler.Dispatch)
			protected.GET("/cleaning/tasks/:id/message", cleaningHandler.GetDispatchMessage)
			protected.POST("/cleaning/bulk-dispatch", cleaningHandler.BulkDispatch)
			protected.GET("/cleaning/weekly-settlement", cleaningHandler.WeeklySettlement)
			protected.GET("/cleaning/records", cleaningHandler.AllRecords)
			protected.GET("/cleaning/export", cleaningHandler.ExportCSV)
			protected.GET("/cleaning/cost-match", cleaningHandler.CostMatch)

			// 띵동 배정 시스템
			protected.POST("/cleaning/parse-assignment", cleaningDispatchHandler.ParseAssignment)
			protected.POST("/cleaning/confirm-assignment", cleaningDispatchHandler.ConfirmAssignment)
			protected.GET("/cleaning/auto-assign", cleaningDispatchHandler.AutoAssign)
			protected.POST("/cleaning/confirm-auto-assign", cleaningDispatchHandler.ConfirmAutoAssign)

			// 청소비 대장
			protected.GET("/cleaning-records", cleaningRecordsHandler.List)
			protected.GET("/cleaning-records/summary", cleaningRecordsHandler.Summary)
			protected.GET("/cleaning-records/cleaner/:name", cleaningRecordsHandler.CleanerDetail)
			protected.GET("/cleaning-records/linked/:id", cleaningRecordsHandler.LinkedInfo)

			// 청소코드
			protected.GET("/cleaning-codes", cleaningHandler.ListCleaningCodes)
			protected.GET("/cleaning/time-analysis", cleaningHandler.TimeAnalysis)
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
			protected.POST("/issues/:id/escalate", issueHandler.Escalate)

			// Hostex 거래 내역
			protected.POST("/transactions/upload", transactionHandler.Upload)
			protected.GET("/transactions/summary", transactionHandler.Summary)
			protected.GET("/transactions/months", transactionHandler.Months)
			protected.GET("/transactions/channels", transactionHandler.Channels)
			protected.GET("/transactions/list", transactionHandler.ListTransactions)
			protected.PATCH("/transactions/:id/category", transactionHandler.UpdateCategory)
			protected.GET("/transactions/categories", transactionHandler.Categories)
			protected.POST("/transactions/backfill-accounting", transactionHandler.BackfillAccounting)

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
			protected.GET("/messages/stats", messageHandler.Stats)
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

			// Data 3 통합 분석 (reservation + transaction JOIN)
			protected.GET("/data3/records", data3Handler.GetRecords)
			protected.GET("/data3/summary", data3Handler.GetSummary)

			// 월간 리포트 (monthly_property_reports)
			protected.GET("/reports/monthly", monthlyReportHandler.List)
			protected.GET("/reports/months", monthlyReportHandler.Months)
			protected.GET("/reports/property/:id", monthlyReportHandler.PropertyDetail)

			// 데이터 파이프라인 스케줄러
			protected.GET("/pipeline/status", schedulerHandler.Status)
			protected.POST("/pipeline/run", schedulerHandler.RunTarget)
			protected.POST("/pipeline/run-all", schedulerHandler.RunAll)

			// 운영 체크리스트
			protected.GET("/checklist/today", checklistHandler.GetToday)
			protected.GET("/checklist/summary", checklistHandler.Summary)
			protected.PATCH("/checklist/:id/toggle", checklistHandler.Toggle)

			// 비용 관리 (cost_raw + cost_allocations)
			protected.GET("/costs/raw", costHandler.ListRawCosts)
			protected.GET("/costs/allocations", costHandler.ListAllocations)
			protected.GET("/costs/monthly", costHandler.MonthlySummary)
			protected.POST("/costs/import-from-transactions", costHandler.ImportFromTransactions)
			protected.POST("/costs/reallocate", costHandler.ReallocateAll)

			// AI 채팅
			protected.POST("/ai/chat", aiChatHandler.Chat)

			// AI Agent (페이지별 — 기억 + 크로스페이지)
			protected.POST("/ai/agent", aiAgentHandler.Ask)
			protected.GET("/ai/agent/history", aiAgentHandler.GetHistory)
			protected.DELETE("/ai/agent/history", aiAgentHandler.ClearHistory)
			protected.GET("/ai/agent/memories", aiAgentHandler.GetMemories)

			// 운영 매뉴얼 (위키)
			protected.GET("/manual", manualHandler.List)
			protected.GET("/manual/entry", manualHandler.Get)
			protected.POST("/manual", manualHandler.Upsert)
			protected.DELETE("/manual", manualHandler.Delete)

			// 근퇴 + 생산성
			attendance := protected.Group("/attendance")
			{
				attendance.POST("/heartbeat", attendanceHandler.Heartbeat)
				attendance.POST("/logout", attendanceHandler.Logout)
				attendance.POST("/logout-others", attendanceHandler.LogoutOthers)
				attendance.GET("/today", attendanceHandler.Today)
				attendance.GET("/report", attendanceHandler.Report)
				attendance.GET("/productivity", attendanceHandler.Productivity)
			}

			// Multidata (ETF 데이터 폴더)
			protected.GET("/multidata", multidataHandler.Overview)

			// 인프라 현황
			protected.GET("/infra", infraHandler.Overview)

			// 문서 아카이빙
			docs := protected.Group("/documents")
			{
				docs.POST("/upload", documentHandler.Upload)
				docs.GET("", documentHandler.List)
				docs.GET("/summary", documentHandler.Summary)
				docs.GET("/:id/download", documentHandler.Download)
				docs.DELETE("/:id", documentHandler.Delete)
			}

			// Knowledge Base (기술백서 위키)
			wiki := protected.Group("/wiki")
			{
				wiki.GET("/toc", wikiHandler.GetTOC)
				wiki.GET("/progress", wikiHandler.GetProgress)
				wiki.POST("/articles", wikiHandler.CreateArticle)
				wiki.GET("/articles/:id", wikiHandler.GetArticle)
				wiki.PUT("/articles/:id", wikiHandler.UpdateArticle)
				wiki.PATCH("/articles/:id/assign", wikiHandler.AssignArticle)
				wiki.GET("/articles/:id/revisions", wikiHandler.GetRevisions)
			}

			// Founder OS
			protected.GET("/founder/daily-brief", founderHandler.DailyBrief)
			protected.GET("/founder/top-decisions", founderHandler.TopDecisions)
			protected.GET("/founder/etf-summary", founderHandler.ETFSummary)
			protected.GET("/founder/cycle", founderHandler.CycleAnalysis)
			protected.GET("/founder/reports", founderHandler.Reports)
			protected.GET("/founder/reports/latest", founderHandler.ReportsLatest)
			protected.PATCH("/founder/reports/:id/read", founderHandler.ReportRead)
			protected.POST("/founder/reports/generate", founderHandler.ReportGenerate)
			protected.GET("/founder/anomalies", founderHandler.Anomalies)
			protected.PATCH("/founder/alerts/:id/acknowledge", founderHandler.AlertAcknowledge)
			protected.PATCH("/founder/alerts/:id/forward", founderHandler.AlertForward)
			protected.PATCH("/founder/alerts/:id/approve", founderHandler.AlertApprove)
			protected.PATCH("/founder/alerts/:id/reject", founderHandler.AlertReject)

			// ETF Board
			protected.GET("/etf-board", etfBoardHandler.Overview)
			protected.GET("/etf-board/ceo", etfBoardHandler.CEOBoard)
			protected.GET("/etf-board/cto", etfBoardHandler.CTOBoard)
			protected.GET("/etf-board/cfo", etfBoardHandler.CFOBoard)
			protected.GET("/etf-board/cfo/financial", etfBoardHandler.CFOFinancial)
			protected.GET("/etf-board/cross-activity", etfBoardHandler.CrossActivity)
			protected.GET("/etf-board/got", etfBoardHandler.GOTSummary)

			// 개발 프로젝트 추적
			protected.GET("/dev-projects", devProjectHandler.List)
			protected.GET("/dev-projects/progress", devProjectHandler.AllProgress)
			protected.GET("/dev-projects/:id", devProjectHandler.Get)
			protected.GET("/dev-projects/:id/progress", devProjectHandler.Progress)
			protected.PATCH("/dev-milestones/:id/status", devProjectHandler.UpdateMilestoneStatus)

			// ETF 업무지시/보고 시스템
			protected.POST("/directives", directiveHandler.Create)
			protected.GET("/directives", directiveHandler.ListAll)
			protected.GET("/directives/sent", directiveHandler.ListSent)
			protected.GET("/directives/received", directiveHandler.ListReceived)
			protected.GET("/directives/visible", directiveHandler.ListVisible)
			protected.GET("/directives/overdue", directiveHandler.ListOverdue)
			protected.GET("/directives/relationship", directiveHandler.Relationship)
			protected.PATCH("/directives/:id/acknowledge", directiveHandler.Acknowledge)
			protected.PATCH("/directives/:id/start", directiveHandler.Start)
			protected.PATCH("/directives/:id/complete", directiveHandler.Complete)
			protected.PATCH("/directives/:id/reject", directiveHandler.Reject)
			protected.PATCH("/directives/:id/verify", directiveHandler.Verify)
			protected.PATCH("/directives/:id/reopen", directiveHandler.Reopen)
			protected.PATCH("/directives/:id/approve", directiveHandler.Approve)
			protected.PATCH("/directives/:id/request-revision", directiveHandler.RequestRevision)
			protected.PATCH("/directives/:id/agree", directiveHandler.Agree)
			protected.PATCH("/directives/:id/counter", directiveHandler.Counter)
			protected.PATCH("/directives/:id/escalate", directiveHandler.Escalate)

			// 알림 + 업무 로그
			protected.GET("/notifications", notifHandler.List)
			protected.GET("/notifications/unread", notifHandler.UnreadCount)
			protected.PATCH("/notifications/:id/read", notifHandler.MarkRead)
			protected.PATCH("/notifications/read-all", notifHandler.MarkAllRead)
			protected.GET("/activity-logs", notifHandler.ActivityLogs)

			// Execution Dashboard
			protected.GET("/execution/:role", executionHandler.Dashboard)

			// 숙소 라이프사이클
			protected.PATCH("/properties/:id/lifecycle", lifecycleHandler.UpdateStatus)
			protected.GET("/properties/:id/onboarding", lifecycleHandler.GetOnboarding)
			protected.PATCH("/properties/:id/onboarding/:checkId", lifecycleHandler.ToggleCheck)
			protected.GET("/properties/:id/platforms", lifecycleHandler.GetPlatforms)
			protected.POST("/properties/:id/platforms", lifecycleHandler.UpsertPlatform)
			protected.GET("/lifecycle/pipeline", lifecycleHandler.Pipeline)
			protected.GET("/investors", lifecycleHandler.ListInvestors)
			protected.POST("/investors", lifecycleHandler.CreateInvestor)

			// 오늘 운영 피드
			protected.GET("/ops/feed", opsFeedHandler.Feed)
			protected.GET("/ops/pulse", opsPulseHandler.Pulse)

			// 팀 채팅
			protected.GET("/chat/channels", teamChatHandler.ListChannels)
			protected.POST("/chat/channels", teamChatHandler.CreateChannel)
			protected.GET("/chat/channels/:id/messages", teamChatHandler.GetMessages)
			protected.POST("/chat/channels/:id/messages", teamChatHandler.SendMessage)
			protected.POST("/chat/forward-issue", teamChatHandler.ForwardIssue)

			// 고객 메시지 이슈 감지
			protected.GET("/issue-detections", issueDetectionHandler.ListPending)
			protected.POST("/issue-detections/scan", issueDetectionHandler.Scan)
			protected.POST("/issue-detections/backfill-reservation", issueDetectionHandler.BackfillReservation)
			protected.POST("/issue-detections/batch-resolve", issueDetectionHandler.BatchResolve)
			protected.POST("/issue-detections/reset-handlers", issueDetectionHandler.ResetHandlers)
			protected.POST("/issue-detections/backfill-source", issueDetectionHandler.BackfillSource)
			protected.GET("/issue-detections/ledger", issueDetectionHandler.Ledger)
			protected.GET("/issue-detections/by-reservation/:code", issueDetectionHandler.ByReservation)
			protected.POST("/issue-detections/:id/create-issue", issueDetectionHandler.CreateIssue)
			protected.POST("/issue-detections/:id/dismiss", issueDetectionHandler.Dismiss)
			protected.POST("/issue-detections/:id/respond", issueDetectionHandler.Respond)
			protected.POST("/issue-detections/:id/resolve", issueDetectionHandler.Resolve)
			protected.GET("/issue-detections/resolved", issueDetectionHandler.ListResolved)

			// CS Agent (민원 대응 AI)
			protected.POST("/cs-agent/suggest", csAgentHandler.Suggest)

			// 운영 대화 히스토리 (단톡방 DB)
			protected.GET("/chat-history", chatHistoryHandler.Search)
			protected.GET("/chat-history/stats", chatHistoryHandler.Stats)
			protected.GET("/chat-history/property", chatHistoryHandler.PropertyHistory)
			protected.POST("/chat-history/upload", chatUploadHandler.Upload)
			protected.POST("/chat-history/upload-text", chatUploadHandler.UploadText)

			// CS 대응 프로세스 지식베이스
			protected.GET("/cs-knowledge", csKnowledgeHandler.List)
			protected.GET("/cs-knowledge/match", csKnowledgeHandler.Match)
			protected.GET("/cs-knowledge/:id", csKnowledgeHandler.Get)
			protected.POST("/cs-knowledge", csKnowledgeHandler.Create)
			protected.PUT("/cs-knowledge/:id", csKnowledgeHandler.Update)

			// 아카이빙 파이프라인
			protected.POST("/archiving/generate", archivingHandler.Generate)
			protected.POST("/archiving/weekly", archivingHandler.Weekly)
			protected.POST("/archiving/monthly-notify", archivingHandler.MonthlyNotify)
			protected.GET("/archiving/jobs", archivingHandler.ListJobs)
			protected.GET("/archiving/status", archivingHandler.Status)
			protected.POST("/archiving/review/:id", archivingHandler.Review)
			protected.GET("/archiving/review/:id", archivingHandler.GetReviews)
			protected.GET("/archiving/review-summary", archivingHandler.ReviewSummary)
			protected.POST("/archiving/rewrite/:id", archivingHandler.Rewrite)

			// 관리자 목록 (일반 admin도 조회 가능)
			protected.GET("/users", userHandler.GetUsers)
			protected.GET("/users/team-stats", userHandler.TeamStats)
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
