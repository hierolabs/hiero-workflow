package handler

import (
	"errors"
	"net/http"
	"strconv"

	"hiero-workflow/backend/dto"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type PropertyHandler struct {
	svc *service.PropertyService
}

func NewPropertyHandler() *PropertyHandler {
	return &PropertyHandler{
		svc: service.NewPropertyService(),
	}
}

func (h *PropertyHandler) List(c *gin.Context) {
	var query dto.PropertyListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 쿼리 파라미터입니다"})
		return
	}

	result, err := h.svc.List(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "목록 조회에 실패했습니다"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *PropertyHandler) Get(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	property, err := h.svc.GetByID(id)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewPropertyResponse(property))
}

func (h *PropertyHandler) Create(c *gin.Context) {
	var req dto.CreatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	adminUserID := userID.(uint)

	property, err := h.svc.Create(req, adminUserID)
	if err != nil {
		if errors.Is(err, service.ErrDuplicateCode) {
			c.JSON(http.StatusConflict, gin.H{"error": "이미 존재하는 코드입니다"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "생성에 실패했습니다"})
		return
	}

	c.JSON(http.StatusCreated, dto.NewPropertyResponse(property))
}

func (h *PropertyHandler) Update(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req dto.UpdatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	property, err := h.svc.Update(id, req)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewPropertyResponse(property))
}

func (h *PropertyHandler) Delete(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err := h.svc.Delete(id); err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "삭제되었습니다"})
}

func (h *PropertyHandler) UpdateStatus(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req dto.UpdatePropertyStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	property, err := h.svc.UpdateStatus(id, req.Status)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewPropertyResponse(property))
}

func (h *PropertyHandler) UpdateOperationStatus(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req dto.UpdatePropertyOperationStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	property, err := h.svc.UpdateOperationStatus(id, req.OperationStatus)
	if err != nil {
		handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.NewPropertyResponse(property))
}

// --- Helpers ---

func parseID(c *gin.Context) (uint, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID입니다"})
		return 0, err
	}
	return uint(id), nil
}

func handleServiceError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "공간을 찾을 수 없습니다"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "처리에 실패했습니다"})
}
