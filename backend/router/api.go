package router

import (
	"hiero-workflow/backend/handler"

	"github.com/gin-gonic/gin"
)

func registerAPIRoutes(r *gin.Engine) {
	h := handler.NewTaskHandler()

	api := r.Group("/api")
	{
		api.GET("/tasks", h.GetTasks)
		api.POST("/tasks", h.CreateTask)
		api.PATCH("/tasks/:id/status", h.UpdateTaskStatus)
	}
}
