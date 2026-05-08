package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"

	"github.com/gin-gonic/gin"
)

type CleaningRecordsHandler struct{}

func NewCleaningRecordsHandler() *CleaningRecordsHandler { return &CleaningRecordsHandler{} }

// 청소 기록 행
type CleaningRecord struct {
	ID           uint    `json:"id" gorm:"primaryKey"`
	CleaningDate string  `json:"cleaning_date"`
	DayOfWeek    string  `json:"day_of_week"`
	PropertyCode string  `json:"property_code"`
	PropertyName string  `json:"property_name"`
	RoomCount    string  `json:"room_count"`
	CleanerName  string  `json:"cleaner_name"`
	CheckNote    string  `json:"check_note"`
	PaymentCheck string  `json:"payment_check"`
	InputCheck   string  `json:"input_check"`
	TotalCost    int     `json:"total_cost"`
	BaseCost     int     `json:"base_cost"`
	ExtraCost    int     `json:"extra_cost"`
	BeddingCost  int     `json:"bedding_cost"`
	LaundryCost  int     `json:"laundry_cost"`
	BackupName   string  `json:"backup_name"`
}

// GET /admin/cleaning-records — 목록 (필터)
func (h *CleaningRecordsHandler) List(c *gin.Context) {
	cleaner := c.Query("cleaner")
	code := c.Query("code")
	startDate := c.DefaultQuery("start", "")
	endDate := c.DefaultQuery("end", "")
	month := c.Query("month") // 2026-04
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if page < 1 { page = 1 }
	if pageSize > 500 { pageSize = 500 }

	q := config.DB.Table("cleaning_records")
	if cleaner != "" { q = q.Where("cleaner_name = ?", cleaner) }
	if code != "" { q = q.Where("property_code = ?", code) }
	if month != "" {
		q = q.Where("cleaning_date >= ? AND cleaning_date < DATE_ADD(?, INTERVAL 1 MONTH)", month+"-01", month+"-01")
	}
	if startDate != "" { q = q.Where("cleaning_date >= ?", startDate) }
	if endDate != "" { q = q.Where("cleaning_date <= ?", endDate) }

	var total int64
	q.Count(&total)

	var records []CleaningRecord
	q.Order("cleaning_date DESC, property_code ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&records)

	c.JSON(http.StatusOK, gin.H{
		"records": records, "total": total,
		"page": page, "page_size": pageSize,
	})
}

// GET /admin/cleaning-records/summary — 청소자별/월별/숙소별 요약
func (h *CleaningRecordsHandler) Summary(c *gin.Context) {
	month := c.DefaultQuery("month", "")
	startDate := c.DefaultQuery("start", "")
	endDate := c.DefaultQuery("end", "")

	where := "1=1"
	args := []interface{}{}
	if month != "" {
		where += " AND cleaning_date >= ? AND cleaning_date < DATE_ADD(?, INTERVAL 1 MONTH)"
		args = append(args, month+"-01", month+"-01")
	}
	if startDate != "" { where += " AND cleaning_date >= ?"; args = append(args, startDate) }
	if endDate != "" { where += " AND cleaning_date <= ?"; args = append(args, endDate) }

	// 청소자별
	type cleanerStat struct {
		CleanerName string `json:"cleaner_name"`
		Count       int64  `json:"count"`
		TotalCost   int64  `json:"total_cost"`
		BaseCost    int64  `json:"base_cost"`
		ExtraCost   int64  `json:"extra_cost"`
	}
	var byCleaner []cleanerStat
	config.DB.Table("cleaning_records").
		Select("cleaner_name, COUNT(*) as count, SUM(total_cost) as total_cost, SUM(base_cost) as base_cost, SUM(extra_cost) as extra_cost").
		Where(where, args...).
		Group("cleaner_name").Order("total_cost DESC").Find(&byCleaner)

	// 월별
	type monthStat struct {
		Month     string `json:"month"`
		Count     int64  `json:"count"`
		TotalCost int64  `json:"total_cost"`
	}
	var byMonth []monthStat
	config.DB.Table("cleaning_records").
		Select("LEFT(cleaning_date,7) as month, COUNT(*) as count, SUM(total_cost) as total_cost").
		Where(where, args...).
		Group("month").Order("month").Find(&byMonth)

	// 숙소별 TOP
	type propStat struct {
		PropertyCode string `json:"property_code"`
		PropertyName string `json:"property_name"`
		Count        int64  `json:"count"`
		TotalCost    int64  `json:"total_cost"`
	}
	var byProperty []propStat
	config.DB.Table("cleaning_records").
		Select("property_code, property_name, COUNT(*) as count, SUM(total_cost) as total_cost").
		Where(where, args...).
		Group("property_code, property_name").Order("total_cost DESC").Limit(20).Find(&byProperty)

	// 전체 합계
	type totalStat struct {
		Count     int64 `json:"count"`
		TotalCost int64 `json:"total_cost"`
		BaseCost  int64 `json:"base_cost"`
		ExtraCost int64 `json:"extra_cost"`
	}
	var grand totalStat
	config.DB.Table("cleaning_records").
		Select("COUNT(*) as count, SUM(total_cost) as total_cost, SUM(base_cost) as base_cost, SUM(extra_cost) as extra_cost").
		Where(where, args...).Find(&grand)

	c.JSON(http.StatusOK, gin.H{
		"grand":       grand,
		"by_cleaner":  byCleaner,
		"by_month":    byMonth,
		"by_property": byProperty,
	})
}

type ReservationLink struct {
	ID              uint   `json:"id"`
	ReservationCode string `json:"reservation_code"`
	GuestName       string `json:"guest_name"`
	CheckIn         string `json:"check_in"`
	CheckOut        string `json:"check_out"`
	ConversationID  string `json:"conversation_id"`
}

// GET /admin/cleaning-records/linked/:id — 청소 기록 → 예약 → 대화 링크
func (h *CleaningRecordsHandler) LinkedInfo(c *gin.Context) {
	id := c.Param("id")

	var record CleaningRecord
	if err := config.DB.Table("cleaning_records").First(&record, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "기록 없음"})
		return
	}

	type LinkedResult struct {
		Record       CleaningRecord    `json:"record"`
		PropertyID   uint              `json:"property_id"`
		PropertyName string            `json:"property_name"`
		Reservations []ReservationLink `json:"reservations"`
	}

	result := LinkedResult{Record: record}

	// property 찾기
	type propRow struct { ID uint; Name string }
	var prop propRow
	config.DB.Table("properties").Select("id, name").
		Where("name LIKE ?", record.PropertyCode+"%").First(&prop)
	result.PropertyID = prop.ID
	result.PropertyName = prop.Name

	// 예약 찾기 (체크아웃 = 청소일)
	if prop.ID > 0 {
		var rsvs []ReservationLink
		config.DB.Table("reservations").
			Select("id, reservation_code, guest_name, check_in_date as check_in, check_out_date as check_out, conversation_id").
			Where("internal_prop_id = ? AND check_out_date = ?", prop.ID, func() string { s := record.CleaningDate; if len(s) >= 10 { return s[:10] }; return s }()).
			Find(&rsvs)
		result.Reservations = rsvs
	}

	c.JSON(http.StatusOK, result)
}

// 예약 연결 포함 청소 기록
type LinkedCleaningRecord struct {
	CleaningRecord
	GuestName        string `json:"guest_name"`
	ReservationID    uint   `json:"reservation_id"`
	ReservationCode  string `json:"reservation_code"`
	ConversationID   string `json:"conversation_id"`
	CheckIn          string `json:"check_in"`
	PropertyID       uint   `json:"property_id"`
	SettlementAmount int64  `json:"settlement_amount"` // hostex_transactions 금액
	SettlementID     uint   `json:"settlement_id"`     // hostex_transactions ID
}

// GET /admin/cleaning-records/cleaner/:name — 청소자 상세 내역 (예약 연결 포함)
func (h *CleaningRecordsHandler) CleanerDetail(c *gin.Context) {
	name := c.Param("name")
	month := c.DefaultQuery("month", "")
	startDate := c.DefaultQuery("start", "")
	endDate := c.DefaultQuery("end", "")

	q := config.DB.Table("cleaning_records").Where("cleaner_name = ?", name)
	if startDate != "" && endDate != "" {
		q = q.Where("cleaning_date >= ? AND cleaning_date <= ?", startDate, endDate)
	} else if month != "" {
		q = q.Where("cleaning_date >= ? AND cleaning_date < DATE_ADD(?, INTERVAL 1 MONTH)", month+"-01", month+"-01")
	}

	// 온톨로지 JOIN: cleaning_records(배정) + properties(숙소) + reservations(예약) + hostex_transactions(정산)
	whereClause := "cr.cleaner_name = ?"
	args2 := []interface{}{name}
	if startDate != "" && endDate != "" {
		whereClause += " AND cr.cleaning_date >= ? AND cr.cleaning_date <= ?"
		args2 = append(args2, startDate, endDate)
	} else if month != "" {
		whereClause += " AND cr.cleaning_date >= ? AND cr.cleaning_date < DATE_ADD(?, INTERVAL 1 MONTH)"
		args2 = append(args2, month+"-01", month+"-01")
	}

	var linked []LinkedCleaningRecord
	config.DB.Raw(`
		SELECT cr.id, cr.cleaning_date, cr.day_of_week, cr.property_code, cr.property_name,
			cr.room_count, cr.cleaner_name, cr.check_note, cr.payment_check, cr.input_check,
			cr.total_cost, cr.base_cost, cr.extra_cost, cr.bedding_cost, cr.laundry_cost, cr.backup_name,
			p.id AS property_id,
			r.guest_name, r.id AS reservation_id, r.reservation_code, r.conversation_id, r.check_in_date AS check_in,
			ht.amount AS settlement_amount, ht.id AS settlement_id
		FROM cleaning_records cr
		LEFT JOIN properties p ON p.name LIKE CONCAT(cr.property_code, '%')
		LEFT JOIN reservations r ON r.internal_prop_id = p.id AND r.check_out_date = DATE_FORMAT(cr.cleaning_date, '%Y-%m-%d')
		LEFT JOIN hostex_transactions ht ON ht.category = '청소 비용'
			AND ht.property_name LIKE CONCAT(cr.property_code, '%')
			AND DATE(ht.transaction_at) >= DATE_SUB(cr.cleaning_date, INTERVAL WEEKDAY(cr.cleaning_date) DAY)
			AND DATE(ht.transaction_at) <= DATE_ADD(cr.cleaning_date, INTERVAL (6 - WEEKDAY(cr.cleaning_date)) DAY)
		WHERE `+whereClause+`
		GROUP BY cr.id
		ORDER BY cr.cleaning_date ASC, cr.property_code ASC
	`, args2...).Scan(&linked)

	records := make([]CleaningRecord, len(linked))
	for i := range linked {
		records[i] = linked[i].CleaningRecord
	}

	// 주간별 요약
	type weekStat struct {
		WeekStart string `json:"week_start"`
		Count     int64  `json:"count"`
		TotalCost int64  `json:"total_cost"`
		BaseCost  int64  `json:"base_cost"`
		ExtraCost int64  `json:"extra_cost"`
	}
	var byWeek []weekStat
	q2 := config.DB.Table("cleaning_records").Where("cleaner_name = ?", name)
	if startDate != "" && endDate != "" {
		q2 = q2.Where("cleaning_date >= ? AND cleaning_date <= ?", startDate, endDate)
	} else if month != "" {
		q2 = q2.Where("cleaning_date >= ? AND cleaning_date < DATE_ADD(?, INTERVAL 1 MONTH)", month+"-01", month+"-01")
	}
	q2.Select("DATE_SUB(cleaning_date, INTERVAL WEEKDAY(cleaning_date) DAY) as week_start, COUNT(*) as count, SUM(total_cost) as total_cost, SUM(base_cost) as base_cost, SUM(extra_cost) as extra_cost").
		Group("week_start").Order("week_start").Find(&byWeek)

	var totalCost int64
	for _, r := range records {
		totalCost += int64(r.TotalCost)
	}

	c.JSON(http.StatusOK, gin.H{
		"cleaner_name": name,
		"records":      linked,
		"by_week":      byWeek,
		"total_count":  len(records),
		"total_cost":   totalCost,
	})
}
