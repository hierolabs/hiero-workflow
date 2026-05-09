package router

import (
	"time"

	"hiero-workflow/backend/service"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var schedulerInstance *service.Scheduler

func Setup(sched *service.Scheduler) *gin.Engine {
	schedulerInstance = sched

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization", "ngrok-skip-browser-warning"},
		MaxAge:           12 * time.Hour,
	}))

	registerAPIRoutes(r)
	registerAdminRoutes(r)

	return r
}
