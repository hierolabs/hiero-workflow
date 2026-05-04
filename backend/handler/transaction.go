package handler

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/service"

	"github.com/gin-gonic/gin"
)

type TransactionHandler struct {
	svc *service.TransactionService
}

func NewTransactionHandler() *TransactionHandler {
	return &TransactionHandler{svc: service.NewTransactionService()}
}

// POST /admin/transactions/upload — CSV 파일 업로드
func (h *TransactionHandler) Upload(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 선택해주세요"})
		return
	}
	defer file.Close()

	imported, skipped, err := h.svc.ImportCSV(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "업로드 완료",
		"imported": imported,
		"skipped":  skipped,
	})
}

// GET /admin/transactions/summary?year_month=2025-12 — 월간 집계
func (h *TransactionHandler) Summary(c *gin.Context) {
	yearMonth := c.Query("year_month")

	results, err := h.svc.GetMonthlySummary(yearMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"year_month": yearMonth,
		"total":      len(results),
		"results":    results,
	})
}

// GET /admin/settlement/summary?start_date=&end_date= — 기간 기반 정산
func (h *TransactionHandler) Settlement(c *gin.Context) {
	var query service.SettlementQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 파라미터: " + err.Error()})
		return
	}

	result, err := h.svc.GetSettlement(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GET /admin/settlement/export?start_date=&end_date= — 정산 CSV 다운로드
func (h *TransactionHandler) ExportSettlement(c *gin.Context) {
	var query service.SettlementQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 파라미터"})
		return
	}

	result, err := h.svc.GetSettlement(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("settlement_%s_%s.csv", query.StartDate, query.EndDate)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	// BOM for Excel Korean
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{
		"숙소", "매출", "기타수입", "환불", "순매출",
		"청소비", "관리비", "월세", "운영비", "인건비", "소모품", "수선유지", "인테리어", "이자", "배당", "재산세", "기타비용",
		"총비용", "순이익", "이익률(%)",
	})

	for _, p := range result.Properties {
		w.Write([]string{
			p.PropertyName,
			strconv.FormatInt(p.Revenue, 10),
			strconv.FormatInt(p.OtherRevenue, 10),
			strconv.FormatInt(p.Refund, 10),
			strconv.FormatInt(p.NetRevenue, 10),
			strconv.FormatInt(p.CleaningFee, 10),
			strconv.FormatInt(p.MgmtFee, 10),
			strconv.FormatInt(p.RentOut, 10),
			strconv.FormatInt(p.OperationFee, 10),
			strconv.FormatInt(p.LaborFee, 10),
			strconv.FormatInt(p.SuppliesFee, 10),
			strconv.FormatInt(p.Maintenance, 10),
			strconv.FormatInt(p.InteriorFee, 10),
			strconv.FormatInt(p.InterestFee, 10),
			strconv.FormatInt(p.DividendFee, 10),
			strconv.FormatInt(p.PropertyFee, 10),
			strconv.FormatInt(p.OtherCost, 10),
			strconv.FormatInt(p.TotalCost, 10),
			strconv.FormatInt(p.Profit, 10),
			fmt.Sprintf("%.1f", p.ProfitRate),
		})
	}
	w.Flush()
}

// GET /admin/reservations/export?start_date=&end_date= — 예약 CSV 다운로드
func (h *TransactionHandler) ExportReservations(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var reservations []models.Reservation
	db := config.DB.Where("status = ?", "accepted")
	if startDate != "" {
		db = db.Where("check_in_date >= ?", startDate)
	}
	if endDate != "" {
		db = db.Where("check_in_date <= ?", endDate)
	}
	db.Order("check_in_date ASC").Find(&reservations)

	filename := fmt.Sprintf("reservations_%s_%s.csv", startDate, endDate)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{
		"예약코드", "게스트", "숙소ID", "채널", "체크인", "체크아웃",
		"숙박일수", "매출", "수수료", "예약일",
	})

	for _, r := range reservations {
		w.Write([]string{
			r.ReservationCode,
			r.GuestName,
			fmt.Sprintf("%d", r.PropertyID),
			r.ChannelType,
			r.CheckInDate,
			r.CheckOutDate,
			fmt.Sprintf("%d", r.Nights),
			fmt.Sprintf("%d", r.TotalRate),
			fmt.Sprintf("%d", r.TotalCommission),
			r.BookedAt,
		})
	}
	w.Flush()
}

// GET /admin/transactions/export?year_month= — 거래내역 CSV 다운로드
func (h *TransactionHandler) ExportTransactions(c *gin.Context) {
	yearMonth := c.Query("year_month") // optional

	var txns []models.HostexTransaction
	db := config.DB.Order("`year_month`, property_name")
	if yearMonth != "" {
		db = db.Where("`year_month` = ?", yearMonth)
	}
	db.Find(&txns)

	filename := "transactions_all.csv"
	if yearMonth != "" {
		filename = fmt.Sprintf("transactions_%s.csv", yearMonth)
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	w := csv.NewWriter(c.Writer)
	w.Write([]string{
		"거래일", "유형", "카테고리", "금액", "결제수단", "예약번호",
		"체크인", "체크아웃", "게스트", "채널", "숙소명", "숙소ID", "월",
	})

	for _, t := range txns {
		w.Write([]string{
			t.TransactionAt.Format("2006-01-02"),
			t.Type,
			t.Category,
			fmt.Sprintf("%d", t.Amount),
			t.PaymentMethod,
			t.ReservationRef,
			t.CheckIn,
			t.CheckOut,
			t.GuestName,
			t.Channel,
			t.PropertyName,
			func() string { if t.PropertyID != nil { return fmt.Sprintf("%d", *t.PropertyID) }; return "" }(),
			t.YearMonth,
		})
	}
	w.Flush()
}

// GET /admin/transactions/months — 데이터 있는 월 목록
func (h *TransactionHandler) Months(c *gin.Context) {
	var months []string
	config.DB.Model(&models.HostexTransaction{}).
		Select("DISTINCT `year_month`").
		Order("`year_month` DESC").
		Pluck("`year_month`", &months)
	c.JSON(http.StatusOK, months)
}

// GET /admin/transactions/channels — 거래 채널 목록
func (h *TransactionHandler) Channels(c *gin.Context) {
	var channels []string
	config.DB.Model(&models.HostexTransaction{}).
		Select("DISTINCT channel").
		Where("channel != '' AND channel IS NOT NULL").
		Order("channel").
		Pluck("channel", &channels)
	c.JSON(http.StatusOK, channels)
}

// GET /admin/transactions/list?property_id=&start_date=&end_date=&category=&type= — 개별 거래 목록
func (h *TransactionHandler) ListTransactions(c *gin.Context) {
	pid, _ := strconv.Atoi(c.Query("property_id"))
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	category := c.Query("category")
	txType := c.Query("type")

	txs, err := h.svc.ListTransactions(uint(pid), startDate, endDate, category, txType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, txs)
}

// PATCH /admin/transactions/:id/category — 거래 카테고리 변경
func (h *TransactionHandler) UpdateCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "잘못된 ID"})
		return
	}
	var body struct {
		Category string `json:"category" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "카테고리를 입력해주세요"})
		return
	}
	if err := h.svc.UpdateTransactionCategory(uint(id), body.Category); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "카테고리 변경 완료"})
}

// GET /admin/transactions/categories — 전체 카테고리 목록
func (h *TransactionHandler) Categories(c *gin.Context) {
	c.JSON(http.StatusOK, h.svc.AllCategories())
}

// POST /admin/transactions/backfill-accounting — 기존 데이터 계정코드 일괄 매핑
func (h *TransactionHandler) BackfillAccounting(c *gin.Context) {
	count, err := h.svc.BackfillAccountingFields()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "백필 완료", "updated": count})
}
