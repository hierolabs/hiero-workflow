package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type CSVPropertyRow struct {
	Region           string
	Code             string
	RoomName         string // 숙소_호수
	BuildingName     string
	Address          string
	EntrancePassword string
	RoomPassword     string
	PasswordChanged  string
	Bedrooms         string
	BedType          string
	TvType           string
	Platforms        string
	ManagementOffice string
	Notes            string
	Rooms            string // 방 (1, 1.5, 2, 복층 등)
}

type ImportResult struct {
	Total    int              `json:"total"`
	Matched  int              `json:"matched"`
	Updated  int              `json:"updated"`
	Skipped  int              `json:"skipped"`
	Details  []ImportDetail   `json:"details"`
}

type ImportDetail struct {
	CSVRoom    string `json:"csv_room"`
	DBName     string `json:"db_name"`
	DBID       uint   `json:"db_id"`
	Status     string `json:"status"` // matched, not_found, skipped
	Fields     []string `json:"fields,omitempty"`
}

func ImportPropertyDetailsFromCSV(filePath string, dryRun bool) (*ImportResult, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("CSV 파일 열기 실패: %w", err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.LazyQuotes = true

	// 헤더 스킵
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("헤더 읽기 실패: %w", err)
	}

	// 전체 Property 로드
	var allProps []models.Property
	config.DB.Find(&allProps)

	result := &ImportResult{}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		// 빈 행 스킵
		if len(record) < 5 || strings.TrimSpace(record[2]) == "" {
			continue
		}

		row := parseCSVRow(record)
		result.Total++

		// 매칭: 숙소_호수에서 건물명+호수 추출 → DB name에서 검색
		searchName := strings.ReplaceAll(row.RoomName, "_", " ")
		searchName = strings.TrimSpace(searchName)

		var matched *models.Property
		for i := range allProps {
			if containsRoom(allProps[i].Name, searchName) {
				matched = &allProps[i]
				break
			}
		}

		if matched == nil {
			result.Skipped++
			result.Details = append(result.Details, ImportDetail{
				CSVRoom: row.RoomName,
				Status:  "not_found",
			})
			continue
		}

		result.Matched++
		detail := ImportDetail{
			CSVRoom: row.RoomName,
			DBName:  matched.Name,
			DBID:    matched.ID,
			Status:  "matched",
		}

		// 업데이트할 필드 수집
		updates := map[string]interface{}{}
		var fields []string

		if row.BuildingName != "" && matched.BuildingName == "" {
			updates["building_name"] = row.BuildingName
			fields = append(fields, "building_name")
		}
		if row.EntrancePassword != "" && matched.EntrancePassword == "" {
			updates["entrance_password"] = row.EntrancePassword
			fields = append(fields, "entrance_password")
		}
		if row.RoomPassword != "" && matched.RoomPassword == "" {
			updates["room_password"] = row.RoomPassword
			fields = append(fields, "room_password")
		}
		if row.PasswordChanged != "" && matched.PasswordChangedAt == nil {
			if t, err := time.Parse("2006-01-02", row.PasswordChanged); err == nil {
				updates["password_changed_at"] = t
				fields = append(fields, "password_changed_at")
			}
		}
		if row.BedType != "" && matched.BedType == "" {
			updates["bed_type"] = row.BedType
			fields = append(fields, "bed_type")
		}
		if row.TvType != "" && matched.TvType == "" {
			updates["tv_type"] = row.TvType
			fields = append(fields, "tv_type")
		}
		if row.ManagementOffice != "" && matched.ManagementOffice == "" {
			updates["management_office"] = row.ManagementOffice
			fields = append(fields, "management_office")
		}
		if row.Address != "" && matched.Address == "" {
			updates["address"] = row.Address
			fields = append(fields, "address")
		}
		if row.Notes != "" && matched.Memo == "" {
			updates["memo"] = row.Notes
			fields = append(fields, "memo")
		}

		detail.Fields = fields

		if len(updates) > 0 && !dryRun {
			config.DB.Model(&models.Property{}).Where("id = ?", matched.ID).Updates(updates)
			result.Updated++
			detail.Status = "updated"
			log.Printf("[CSVImport] %s → %s (id:%d) 업데이트: %v", row.RoomName, matched.Name, matched.ID, fields)
		} else if len(updates) == 0 {
			detail.Status = "no_change"
		}

		result.Details = append(result.Details, detail)
	}

	return result, nil
}

func parseCSVRow(record []string) CSVPropertyRow {
	get := func(i int) string {
		if i < len(record) {
			return strings.TrimSpace(record[i])
		}
		return ""
	}
	return CSVPropertyRow{
		Region:           get(0),
		Code:             get(1),
		RoomName:         get(2),
		BuildingName:     get(3),
		Address:          get(4),
		EntrancePassword: get(5),
		RoomPassword:     get(6),
		PasswordChanged:  get(7),
		Bedrooms:         get(8),
		BedType:          get(9),
		TvType:           get(10),
		Platforms:        get(11),
		ManagementOffice: get(12),
		Notes:            get(13),
		Rooms:            get(14),
	}
}

// CSV 숙소명 → DB 숙소명 별칭 매핑 (축약이 다른 경우)
var roomAliases = map[string]string{
	"청광1":    "청광1차",
	"렘브란트":  "렘브",
	"성내si":   "si",
	"오금스타":  "송파오금",
	"강동qv1":  "강동qv",
	"한양립":   "한양립스",
	"미사푸르":  "미사마이움", // 확인 필요
}

// containsRoom — DB 이름에서 CSV 숙소_호수가 포함되는지 확인
func containsRoom(dbName, searchName string) bool {
	if searchName == "" {
		return false
	}
	dbLower := strings.ToLower(dbName)
	searchLower := strings.ToLower(searchName)

	// 괄호 접두어 제거: (둔촌)태상 → 태상
	if idx := strings.Index(searchLower, ")"); idx >= 0 {
		searchLower = searchLower[idx+1:]
	}

	// 직접 포함
	if strings.Contains(dbLower, searchLower) {
		return true
	}

	// 공백 제거 비교
	noSpace := strings.ReplaceAll(searchLower, " ", "")
	dbNoSpace := strings.ReplaceAll(dbLower, " ", "")
	if strings.Contains(dbNoSpace, noSpace) {
		return true
	}

	// 별칭 매핑: 건물명 부분 + 호수 분리
	parts := strings.SplitN(searchLower, " ", 2)
	if len(parts) == 2 {
		building := parts[0]
		roomNum := parts[1]

		// 별칭 변환
		if alias, ok := roomAliases[building]; ok {
			aliasSearch := alias + " " + roomNum
			if strings.Contains(dbLower, aliasSearch) {
				return true
			}
			aliasNoSpace := strings.ReplaceAll(aliasSearch, " ", "")
			if strings.Contains(dbNoSpace, aliasNoSpace) {
				return true
			}
		}

		// 호수 번호만으로 부분 매칭 (건물 첫 글자 + 호수)
		// "은성 401" → DB에서 "은성" + "401" 둘 다 포함
		if strings.Contains(dbLower, building) && strings.Contains(dbLower, roomNum) {
			return true
		}
	}

	return false
}
