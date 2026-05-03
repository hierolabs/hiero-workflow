package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type HostexSyncHandler struct {
	svc *service.HostexSyncService
}

func NewHostexSyncHandler() *HostexSyncHandler {
	return &HostexSyncHandler{
		svc: service.NewHostexSyncService(),
	}
}

// GetMappings — Hostex 숙소 ↔ 내부 Property 매핑 목록
func (h *HostexSyncHandler) GetMappings(c *gin.Context) {
	mappings, err := h.svc.GetPropertyMappings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Hostex 숙소 조회 실패: " + err.Error()})
		return
	}

	unmatched := h.svc.GetUnmappedInternalProperties()

	c.JSON(http.StatusOK, gin.H{
		"mappings":              mappings,
		"unmapped_properties":   unmatched,
	})
}

// LinkProperty — Hostex 숙소를 내부 Property에 연결
func (h *HostexSyncHandler) LinkProperty(c *gin.Context) {
	var req struct {
		InternalPropID uint  `json:"internal_prop_id"`
		HostexID       int64 `json:"hostex_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "요청 데이터가 올바르지 않습니다"})
		return
	}

	if req.InternalPropID == 0 || req.HostexID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "internal_prop_id와 hostex_id는 필수입니다"})
		return
	}

	if err := h.svc.LinkProperty(req.InternalPropID, req.HostexID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "공간을 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "연결 완료"})
}

// TriggerSync — 일반 동기화 (과거 30일 ~ 미래 90일)
func (h *HostexSyncHandler) TriggerSync(c *gin.Context) {
	go func() {
		h.svc.SyncAll()
	}()
	c.JSON(http.StatusOK, gin.H{"message": "동기화 시작됨 (과거 30일 ~ 미래 90일)"})
}

// TriggerFullSync — 전체 동기화 (과거 2년 ~ 미래 90일, 6000건+)
func (h *HostexSyncHandler) TriggerFullSync(c *gin.Context) {
	go func() {
		count, err := h.svc.SyncAllReservations()
		if err != nil {
			return
		}
		_ = count
	}()
	c.JSON(http.StatusOK, gin.H{"message": "전체 동기화 시작됨 (과거 2년 ~ 미래 90일). 백그라운드에서 진행 중."})
}

// UnlinkProperty — 내부 Property에서 Hostex 연결 해제
func (h *HostexSyncHandler) UnlinkProperty(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 ID입니다"})
		return
	}

	if err := h.svc.UnlinkProperty(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "공간을 찾을 수 없습니다"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "연결 해제 완료"})
}
