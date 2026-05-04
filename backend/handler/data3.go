package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type Data3Handler struct {
	svc *service.Data3Service
}

func NewData3Handler() *Data3Handler {
	return &Data3Handler{svc: service.NewData3Service()}
}

// GetRecords GET /admin/data3/records?start_date=&end_date=&date_field=&property_id=&channel=
func (h *Data3Handler) GetRecords(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	dateField := c.DefaultQuery("date_field", "check_in_date")
	channel := c.Query("channel")

	var propID *uint
	if pid := c.Query("property_id"); pid != "" {
		if v, err := strconv.ParseUint(pid, 10, 64); err == nil {
			id := uint(v)
			propID = &id
		}
	}

	records, err := h.svc.GetData3Records(startDate, endDate, dateField, propID, channel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"records": records, "count": len(records)})
}

// GetSummary GET /admin/data3/summary?start_date=&end_date=
func (h *Data3Handler) GetSummary(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date, end_date 필수"})
		return
	}

	summary, err := h.svc.GetData3Summary(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}
