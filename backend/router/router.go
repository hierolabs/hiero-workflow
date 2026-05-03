package router

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()
	r.Use(cors.Default())

	registerAPIRoutes(r)
	registerAdminRoutes(r)

	return r
}
