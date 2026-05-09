package handler

import (
	"github.com/gin-gonic/gin"
)

// getUserID JWT에서 user_id 추출
func getUserID(c *gin.Context) *uint {
	v, exists := c.Get("user_id")
	if !exists {
		return nil
	}
	uid, ok := v.(uint)
	if !ok {
		return nil
	}
	return &uid
}

// getUserName JWT에서 login_id 추출 (이름 대용)
func getUserName(c *gin.Context) string {
	v, exists := c.Get("login_id")
	if !exists {
		return ""
	}
	s, _ := v.(string)
	return s
}

