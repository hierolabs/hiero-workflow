package handler

import (
	"io"
	"net/http"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type ChatUploadHandler struct {
	svc *service.ChatUploadService
}

func NewChatUploadHandler() *ChatUploadHandler {
	return &ChatUploadHandler{svc: service.NewChatUploadService()}
}

// POST /admin/chat-history/upload — 카카오톡 대화 txt 업로드 → 파싱 + 분석 + DB 저장
func (h *ChatUploadHandler) Upload(c *gin.Context) {
	room := c.DefaultPostForm("room", "cleaning")

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 업로드해주세요"})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "파일 읽기 실패"})
		return
	}

	content := string(data)
	// BOM 제거
	if len(content) > 3 && content[:3] == "\xef\xbb\xbf" {
		content = content[3:]
	}

	result, err := h.svc.UploadAndAnalyze(content, room)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// POST /admin/chat-history/upload-text — 텍스트 직접 붙여넣기
func (h *ChatUploadHandler) UploadText(c *gin.Context) {
	var body struct {
		Content string `json:"content" binding:"required"`
		Room    string `json:"room"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content 필요"})
		return
	}
	if body.Room == "" {
		body.Room = "cleaning"
	}

	result, err := h.svc.UploadAndAnalyze(body.Content, body.Room)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
