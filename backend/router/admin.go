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
