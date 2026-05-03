package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ExportProperties — 전체 공간 목록을 Excel 파일로 다운로드
func (h *PropertyHandler) ExportProperties(c *gin.Context) {
	var properties []models.Property
	config.DB.Order("code ASC").Find(&properties)

	f := excelize.NewFile()
	sheet := "공간목록"
	f.SetSheetName("Sheet1", sheet)

	// 헤더
	headers := []string{
		"ID", "코드", "이름", "Hostex ID",
		"지역", "주소", "상세주소",
		"공간유형", "객실유형",
		"최대인원", "침실", "침대", "욕실",
		"월세", "관리비", "보증금",
		"상태", "운영상태",
		"체크인시간", "체크아웃시간",
		"메모",
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"333333"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})

	for i, h := range headers {
		cell := fmt.Sprintf("%s1", string(rune('A'+i)))
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	// 데이터
	for row, p := range properties {
		r := row + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", r), p.ID)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", r), p.Code)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", r), p.Name)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", r), p.HostexID)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", r), p.Region)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", r), p.Address)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", r), p.DetailAddress)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", r), p.PropertyType)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", r), p.RoomType)
		f.SetCellValue(sheet, fmt.Sprintf("J%d", r), p.MaxGuests)
		f.SetCellValue(sheet, fmt.Sprintf("K%d", r), p.Bedrooms)
		f.SetCellValue(sheet, fmt.Sprintf("L%d", r), p.Beds)
		f.SetCellValue(sheet, fmt.Sprintf("M%d", r), p.Bathrooms)
		f.SetCellValue(sheet, fmt.Sprintf("N%d", r), p.MonthlyRent)
		f.SetCellValue(sheet, fmt.Sprintf("O%d", r), p.ManagementFee)
		f.SetCellValue(sheet, fmt.Sprintf("P%d", r), p.Deposit)
		f.SetCellValue(sheet, fmt.Sprintf("Q%d", r), p.Status)
		f.SetCellValue(sheet, fmt.Sprintf("R%d", r), p.OperationStatus)
		f.SetCellValue(sheet, fmt.Sprintf("S%d", r), p.CheckInTime)
		f.SetCellValue(sheet, fmt.Sprintf("T%d", r), p.CheckOutTime)
		f.SetCellValue(sheet, fmt.Sprintf("U%d", r), p.Memo)
	}

	// 컬럼 너비 조정
	widths := map[string]float64{
		"A": 6, "B": 15, "C": 30, "D": 12,
		"E": 10, "F": 35, "G": 15,
		"H": 12, "I": 10,
		"J": 10, "K": 8, "L": 8, "M": 8,
		"N": 12, "O": 12, "P": 12,
		"Q": 10, "R": 10,
		"S": 12, "T": 12,
		"U": 30,
	}
	for col, w := range widths {
		f.SetColWidth(sheet, col, col, w)
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=properties.xlsx")

	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "파일 생성 실패"})
	}
}

// ImportProperties — Excel 파일 업로드로 공간 일괄 수정/등록
// ID가 있으면 업데이트, 없으면 신규 생성. 코드 기준으로도 매칭.
func (h *PropertyHandler) ImportProperties(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일이 필요합니다"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "파일을 열 수 없습니다"})
		return
	}
	defer src.Close()

	f, err := excelize.OpenReader(src)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 Excel 파일입니다"})
		return
	}

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "시트가 없습니다"})
		return
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "시트 읽기 실패"})
		return
	}

	if len(rows) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "데이터가 없습니다 (헤더만 있음)"})
		return
	}

	created, updated, skipped := 0, 0, 0
	var errors []string

	for i, row := range rows[1:] { // 헤더 건너뛰기
		rowNum := i + 2
		if len(row) < 3 {
			skipped++
			continue
		}

		// 셀 안전하게 읽기
		get := func(idx int) string {
			if idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}
		getInt := func(idx int) int {
			v, _ := strconv.Atoi(get(idx))
			return v
		}
		getInt64 := func(idx int) int64 {
			v, _ := strconv.ParseInt(get(idx), 10, 64)
			return v
		}
		getFloat := func(idx int) float64 {
			v, _ := strconv.ParseFloat(get(idx), 64)
			return v
		}

		idStr := get(0)
		code := get(1)
		name := get(2)

		if code == "" && name == "" {
			skipped++
			continue
		}

		// 기존 레코드 찾기: ID 우선, 없으면 코드로
		var existing models.Property
		found := false

		if idStr != "" {
			id, _ := strconv.ParseUint(idStr, 10, 32)
			if id > 0 {
				if err := config.DB.First(&existing, id).Error; err == nil {
					found = true
				}
			}
		}
		if !found && code != "" {
			if err := config.DB.Where("code = ?", code).First(&existing).Error; err == nil {
				found = true
			}
		}

		maxGuests := getInt(9)
		if maxGuests < 1 {
			maxGuests = 1
		}

		prop := models.Property{
			Code:            code,
			Name:            name,
			HostexID:        getInt64(3),
			Region:          get(4),
			Address:         get(5),
			DetailAddress:   get(6),
			PropertyType:    get(7),
			RoomType:        get(8),
			MaxGuests:       maxGuests,
			Bedrooms:        getInt(10),
			Beds:            getInt(11),
			Bathrooms:       getFloat(12),
			MonthlyRent:     getInt64(13),
			ManagementFee:   getInt64(14),
			Deposit:         getInt64(15),
			Status:          get(16),
			OperationStatus: get(17),
			CheckInTime:     get(18),
			CheckOutTime:    get(19),
			Memo:            get(20),
		}

		// 상태 기본값
		if prop.Status == "" {
			prop.Status = "active"
		}
		if prop.OperationStatus == "" {
			prop.OperationStatus = "available"
		}

		if found {
			// 업데이트 — Code와 HostexID는 변경하지 않음 (기존 값 유지)
			prop.ID = existing.ID
			if prop.Code == "" {
				prop.Code = existing.Code
			}
			if prop.HostexID == 0 {
				prop.HostexID = existing.HostexID
			}
			config.DB.Model(&existing).Updates(prop)
			updated++
		} else {
			// 신규 생성
			if prop.Code == "" {
				errors = append(errors, fmt.Sprintf("행 %d: 코드가 비어 있어 건너뜀", rowNum))
				skipped++
				continue
			}
			config.DB.Create(&prop)
			created++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("처리 완료: 신규 %d건, 수정 %d건, 건너뜀 %d건", created, updated, skipped),
		"created": created,
		"updated": updated,
		"skipped": skipped,
		"errors":  errors,
	})
}
