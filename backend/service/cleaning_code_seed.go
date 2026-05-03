package service

import (
	"log"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// SeedCleaningCodes — 엑셀 "청소코드" 시트 112건을 DB에 시드
func SeedCleaningCodes() {
	var count int64
	config.DB.Model(&models.CleaningCode{}).Count(&count)
	if count > 0 {
		log.Printf("[Seed] CleaningCode 이미 %d건 존재, 스킵", count)
		return
	}

	codes := []models.CleaningCode{
		// A — 강동 천호 (예건)
		{Code: "A22", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 202", RoomCount: 1, BasePrice: 18000},
		{Code: "A24", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 204", RoomCount: 1, BasePrice: 18000},
		{Code: "A25", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 205", RoomCount: 1, BasePrice: 18000},
		{Code: "A33", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 303", RoomCount: 2, BasePrice: 23000},
		{Code: "A44", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 404", RoomCount: 1, BasePrice: 18000},
		{Code: "A62", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 602", RoomCount: 1, BasePrice: 18000},
		{Code: "A72", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 702", RoomCount: 1, BasePrice: 18000},
		{Code: "A82", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 802", RoomCount: 1, BasePrice: 18000},
		{Code: "A92", RegionCode: "A", RegionName: "강동 천호", BuildingName: "예건", RoomName: "예건 902", RoomCount: 1, BasePrice: 18000},

		// A2 — 강동 북천호 (더하임)
		{Code: "B101", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1001", RoomCount: 1, BasePrice: 18000},
		{Code: "B102", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1002", RoomCount: 1, BasePrice: 18000},
		{Code: "B103", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1003", RoomCount: 1, BasePrice: 18000},
		{Code: "B104", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1004", RoomCount: 1, BasePrice: 18000},
		{Code: "B105", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1005", RoomCount: 1, BasePrice: 18000},
		{Code: "B106", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 1006", RoomCount: 1.5, BasePrice: 20000},
		{Code: "B22", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 202", RoomCount: 1, BasePrice: 18000},
		{Code: "B23", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 203", RoomCount: 1, BasePrice: 18000},
		{Code: "B24", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 204", RoomCount: 1, BasePrice: 18000},
		{Code: "B25", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 205", RoomCount: 1, BasePrice: 18000},
		{Code: "B34", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 304", RoomCount: 1, BasePrice: 18000},
		{Code: "B35", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 305", RoomCount: 1, BasePrice: 18000},
		{Code: "B36", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 306", RoomCount: 1.5, BasePrice: 20000},
		{Code: "B46", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 406", RoomCount: 1.5, BasePrice: 20000},
		{Code: "B54", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 504", RoomCount: 1, BasePrice: 18000},
		{Code: "B55", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 505", RoomCount: 1, BasePrice: 18000},
		{Code: "B56", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 506", RoomCount: 1.5, BasePrice: 20000},
		{Code: "B64", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 604", RoomCount: 1, BasePrice: 18000},
		{Code: "B76", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 706", RoomCount: 1.5, BasePrice: 20000},
		{Code: "B91", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 901", RoomCount: 1, BasePrice: 18000},
		{Code: "B93", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 903", RoomCount: 1, BasePrice: 18000},
		{Code: "B94", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 904", RoomCount: 1, BasePrice: 18000},
		{Code: "B95", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "더하임", RoomName: "더하임 905", RoomCount: 1, BasePrice: 18000},

		// C — 강동 ���길동 (청광1차, 길동다성)
		{Code: "C", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 207", RoomCount: 0, BasePrice: 10000, Memo: "관리실"},
		{Code: "C2", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 608", RoomCount: 1, BasePrice: 18000},
		{Code: "C3", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 609", RoomCount: 1, BasePrice: 18000},
		{Code: "C4", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 709", RoomCount: 1, BasePrice: 18000},
		{Code: "C5", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 910", RoomCount: 1, BasePrice: 18000},
		{Code: "C6", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "청광1차", RoomName: "청광1차 1303", RoomCount: 1, BasePrice: 18000},
		{Code: "C7", RegionCode: "C", RegionName: "강동 북길동", BuildingName: "길동다성", RoomName: "길동다성 506", RoomCount: 1, BasePrice: 18000},

		// D — 강동 남길동 (청광3차, SK2차, 강동QV)
		{Code: "D1", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 1416", RoomCount: 1, BasePrice: 18000},
		{Code: "D2", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 214", RoomCount: 1, BasePrice: 18000},
		{Code: "D3", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 507", RoomCount: 1, BasePrice: 18000},
		{Code: "D4", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 806", RoomCount: 1, BasePrice: 18000},
		{Code: "D5", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 1315", RoomCount: 1, BasePrice: 18000},
		{Code: "D6", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "청광3차", RoomName: "청광3차 1412", RoomCount: 1, BasePrice: 18000},
		{Code: "D7", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "SK2차", RoomName: "SK2차 623", RoomCount: 1, BasePrice: 18000},
		{Code: "D8", RegionCode: "D", RegionName: "강동 남길동", BuildingName: "강동QV", RoomName: "강동QV 1604", RoomCount: 1, BasePrice: 18000},

		// E — 강동 남길동 (르센티, 렘브, 동구햇살)
		{Code: "E1", RegionCode: "E", RegionName: "강동 남길동", BuildingName: "르센티", RoomName: "르센티 1801", RoomCount: 1.5, BasePrice: 20000},
		{Code: "E2", RegionCode: "E", RegionName: "강동 남길동", BuildingName: "르센티", RoomName: "르센티 1106", RoomCount: 1.5, BasePrice: 20000},
		{Code: "E3", RegionCode: "E", RegionName: "강동 남길동", BuildingName: "렘브", RoomName: "렘브 204", RoomCount: 1, BasePrice: 18000},
		{Code: "E4", RegionCode: "E", RegionName: "강동 남길동", BuildingName: "렘브", RoomName: "렘브 505", RoomCount: 1, BasePrice: 18000},
		{Code: "E5", RegionCode: "E", RegionName: "강동 남길동", BuildingName: "동구햇살", RoomName: "동구햇살 1203", RoomCount: 1.5, BasePrice: 20000},

		// F — 강동 둔촌 (한양립스, 오앤, 태상)
		{Code: "F1", RegionCode: "F", RegionName: "강동 둔촌", BuildingName: "한양립스", RoomName: "한양립스 503", RoomCount: 1, BasePrice: 18000},
		{Code: "F2", RegionCode: "F", RegionName: "강동 둔촌", BuildingName: "오앤", RoomName: "오앤 401", RoomCount: 1, BasePrice: 18000},
		{Code: "F3", RegionCode: "F", RegionName: "강동 둔촌", BuildingName: "태상", RoomName: "태상 501", RoomCount: 2, BasePrice: 23000},

		// G — 강동 성내 (si)
		{Code: "G1", RegionCode: "G", RegionName: "강동 성내", BuildingName: "si", RoomName: "si 403", RoomCount: 1, BasePrice: 18000},
		{Code: "G2", RegionCode: "G", RegionName: "강동 성내", BuildingName: "si", RoomName: "si 502", RoomCount: 1, BasePrice: 20000},
		{Code: "G3", RegionCode: "G", RegionName: "강동 성내", BuildingName: "si", RoomName: "si 602", RoomCount: 1, BasePrice: 20000},

		// H — 송파 오금 (오금스타)
		{Code: "H", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금 빨래 수거", RoomCount: 0, BasePrice: 0, Memo: "빨래 수거 전용"},
		{Code: "H12", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 102", RoomCount: 1, BasePrice: 18000},
		{Code: "H13", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 103", RoomCount: 1, BasePrice: 18000},
		{Code: "H21", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 201", RoomCount: 1, BasePrice: 18000},
		{Code: "H23", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 203", RoomCount: 1, BasePrice: 18000},
		{Code: "H25", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 205", RoomCount: 1, BasePrice: 18000},
		{Code: "H33", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 303", RoomCount: 1, BasePrice: 18000},
		{Code: "H41", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 401", RoomCount: 1, BasePrice: 18000},
		{Code: "H42", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 402", RoomCount: 1, BasePrice: 18000},
		{Code: "H52", RegionCode: "H", RegionName: "송파 오금", BuildingName: "오금스타", RoomName: "오금스타 502", RoomCount: 1, BasePrice: 18000},

		// I — 하남 미사
		{Code: "I1", RegionCode: "I", RegionName: "하남 미사", BuildingName: "미사 마이움", RoomName: "미사 마이움 102-803", RoomCount: 1, BasePrice: 25000},
		{Code: "I2", RegionCode: "I", RegionName: "하남 미사", BuildingName: "미사 힐스", RoomName: "미사 힐스 804", RoomCount: 1, BasePrice: 25000},
		{Code: "I3", RegionCode: "I", RegionName: "하남 미사", BuildingName: "미사 롯데", RoomName: "미사 롯데 960", RoomCount: 1, BasePrice: 25000},

		// J — 강동 북천호/중길동 (천호다성, 은성, 영무)
		{Code: "J1", RegionCode: "A2", RegionName: "강동 북천호", BuildingName: "천호다성", RoomName: "천호다성 603", RoomCount: 2, BasePrice: 23000},
		{Code: "J2", RegionCode: "B", RegionName: "강동 중길동", BuildingName: "은성", RoomName: "은성 603", RoomCount: 1, BasePrice: 18000},
		{Code: "J4", RegionCode: "B", RegionName: "강동 중길동", BuildingName: "영무", RoomName: "영무 302", RoomCount: 1.5, BasePrice: 20000},
		{Code: "J5", RegionCode: "B", RegionName: "강동 중길동", BuildingName: "영무", RoomName: "영무 1008", RoomCount: 1, BasePrice: 18000},

		// K — 동대문 (선일, 태솔, 뉴시티)
		{Code: "K1", RegionCode: "K", RegionName: "동대문", BuildingName: "선일", RoomName: "선일 101", RoomCount: 2, BasePrice: 23000},
		{Code: "K2", RegionCode: "K", RegionName: "동대문", BuildingName: "태솔", RoomName: "태솔 205", RoomCount: 3, BasePrice: 30000},
		{Code: "K3", RegionCode: "K", RegionName: "동대문", BuildingName: "뉴시티", RoomName: "뉴시티 1413", RoomCount: 1, BasePrice: 18000},
		{Code: "K4", RegionCode: "L", RegionName: "서울 기타", BuildingName: "세종에코", RoomName: "세종에코 304", RoomCount: 2, BasePrice: 23000},
		{Code: "K5", RegionCode: "L", RegionName: "서울 기타", BuildingName: "방학", RoomName: "방학 709", RoomCount: 1.5, BasePrice: 25000},

		// L — 서울 기타 / 중구 (가산 지웰, 하람휴, 가온빌)
		{Code: "L1", RegionCode: "L", RegionName: "서울 기타", BuildingName: "가산 지웰", RoomName: "가산 지웰 328", RoomCount: 1, BasePrice: 30000},
		{Code: "L2", RegionCode: "J", RegionName: "중구", BuildingName: "하람휴", RoomName: "하람휴 902", RoomCount: 2, BasePrice: 23000},
		{Code: "L3", RegionCode: "J", RegionName: "중구", BuildingName: "하람휴", RoomName: "하람휴 1102", RoomCount: 2, BasePrice: 23000},
		{Code: "L4", RegionCode: "J", RegionName: "중구", BuildingName: "하람휴", RoomName: "하람휴 901", RoomCount: 2, BasePrice: 23000},
		{Code: "L5", RegionCode: "J", RegionName: "중구", BuildingName: "하람휴", RoomName: "하람휴 1001", RoomCount: 2, BasePrice: 23000},
		{Code: "L6", RegionCode: "L", RegionName: "서울 기타", BuildingName: "가온빌", RoomName: "가온빌 102", RoomCount: 2, BasePrice: 30000},

		// M — 인천 (카이저)
		{Code: "M1", RegionCode: "M", RegionName: "인천", BuildingName: "카이저", RoomName: "카이저 101-1204", RoomCount: 3, BasePrice: 50000},
		{Code: "M2", RegionCode: "M", RegionName: "인천", BuildingName: "카이저", RoomName: "카이저 203-308", RoomCount: 2, BasePrice: 30000},

		// N — 지방/울산
		{Code: "N1", RegionCode: "N", RegionName: "지방", BuildingName: "울산 블루", RoomName: "울산 블루 307", RoomCount: 1.5, BasePrice: 30000},
		{Code: "N2", RegionCode: "N", RegionName: "지방", BuildingName: "울산 블루", RoomName: "울산 블루 315", RoomCount: 1.5, BasePrice: 30000},
		{Code: "N3", RegionCode: "N", RegionName: "지방", BuildingName: "울산 수아", RoomName: "울산 수아 1007", RoomCount: 2, BasePrice: 30000},
		{Code: "N4", RegionCode: "N", RegionName: "지방", BuildingName: "울산 자이", RoomName: "울산 자이 101-2407", RoomCount: 1, BasePrice: 18000},

		// S — 센텀
		{Code: "S", RegionCode: "S", RegionName: "센텀 1차", BuildingName: "센텀", RoomName: "센�� 101", RoomCount: 0, BasePrice: 10000, Memo: "관리"},
		{Code: "S1", RegionCode: "S", RegionName: "천호", BuildingName: "미사아름채", RoomName: "미사아름채 1310호", RoomCount: 1.5, BasePrice: 20000},

		// T — 센텀 2차
		{Code: "T31", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 301", RoomCount: 1.5, BasePrice: 20000},
		{Code: "T32", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 302", RoomCount: 1.5, BasePrice: 20000},
		{Code: "T46", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 406", RoomCount: 1.5, BasePrice: 20000},
		{Code: "T51", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 501", RoomCount: 1.5, BasePrice: 20000},
		{Code: "T66", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 606", RoomCount: 1.5, BasePrice: 20000},
		{Code: "T71", RegionCode: "T", RegionName: "센텀 2차", BuildingName: "센텀 2차", RoomName: "센텀 2차 701", RoomCount: 1.5, BasePrice: 20000},

		// U — 성우스타
		{Code: "U21", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 201", RoomCount: 2, BasePrice: 23000},
		{Code: "U24", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 204", RoomCount: 2, BasePrice: 23000},
		{Code: "U31", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 301", RoomCount: 2, BasePrice: 23000},
		{Code: "U34", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 304", RoomCount: 2, BasePrice: 23000},
		{Code: "U42", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 402", RoomCount: 3, BasePrice: 30000},
		{Code: "U51", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 501", RoomCount: 2, BasePrice: 23000},
		{Code: "U83", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 803", RoomCount: 3, BasePrice: 30000},
		{Code: "U93", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 903", RoomCount: 3, BasePrice: 30000},
		{Code: "U94", RegionCode: "U", RegionName: "성우스타", BuildingName: "성우", RoomName: "성우 904", RoomCount: 2, BasePrice: 23000},

		// V — 강남 대치
		{Code: "V11", RegionCode: "V", RegionName: "강남 대치", BuildingName: "대치동", RoomName: "대치동 101호", RoomCount: 2, BasePrice: 23000},
		{Code: "V12", RegionCode: "V", RegionName: "강남 대치", BuildingName: "대치동", RoomName: "대치동 102호", RoomCount: 1, BasePrice: 18000},
		{Code: "V13", RegionCode: "V", RegionName: "강남 대치", BuildingName: "대치동", RoomName: "대치동 103호", RoomCount: 1.5, BasePrice: 20000},
	}

	for i := range codes {
		if err := config.DB.Create(&codes[i]).Error; err != nil {
			log.Printf("[Seed] CleaningCode %s 생성 실패: %v", codes[i].Code, err)
		}
	}

	log.Printf("[Seed] CleaningCode %d건 시드 완료", len(codes))
}
