package service

import (
	"log"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

// SeedCleaners — 엑셀 "운영 정보" 시트 기반 청소자 시드
func SeedCleaners() {
	var count int64
	config.DB.Model(&models.Cleaner{}).Count(&count)
	if count > 0 {
		log.Printf("[Seed] Cleaner 이미 %d건 존재, 스킵", count)
		return
	}

	cleaners := []models.Cleaner{
		// --- 강동 천호 권역 ---
		{
			Name:          "마디나",
			Phone:         "010-8447-3332",
			Region:        "A",
			Regions:       "A,A2",
			AvailableDays: "mon,tue,wed,fri,sat,sun", // 목요일 제외
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        false,
			MaxDaily:      5,
			Active:        true,
			Memo:          "선불 필요",
		},
		{
			Name:          "김정은",
			Phone:         "010-4737-7534",
			Region:        "A",
			Regions:       "A,A2",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},

		// --- 강동 중길동/남길동 권역 ---
		{
			Name:          "유민정",
			Phone:         "010-5906-7472",
			Region:        "C",
			Regions:       "C,D,E",
			AvailableDays: "mon,tue,wed,thu,fri", // 주말 제외
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
			Memo:          "2건 이상 배정",
		},
		{
			Name:          "박연실",
			Phone:         "010-8752-8202",
			Region:        "C",
			Regions:       "C,D,E,F",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportBike,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      6,
			Active:        true,
		},
		{
			Name:          "장승연",
			Phone:         "010-2773-2244",
			Region:        "C",
			Regions:       "C",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        false,
			MaxDaily:      4,
			Active:        true,
		},

		// --- 강동 전역 ---
		{
			Name:          "류지영",
			Phone:         "010-4509-5717",
			Region:        "A2",
			Regions:       "강동 전역",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportCar,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      6,
			Active:        true,
			Memo:          "남편 동행, 자차 이동",
		},
		{
			Name:          "김정한",
			Phone:         "010-7626-1955",
			Region:        "A",
			Regions:       "강동 전역",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportBike,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},
		{
			Name:          "공숙길",
			Phone:         "010-5520-3206",
			Region:        "A",
			Regions:       "A,A2,C,D,E,F,G",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},

		// --- 강동 성내 / 송파 오금 ---
		{
			Name:          "강수미",
			Phone:         "010-2272-4424",
			Region:        "G",
			Regions:       "G,H",
			AvailableDays: "mon,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      4,
			Active:        true,
			Memo:          "H권역 빨래 수거 포함",
		},
		{
			Name:          "박진성",
			Phone:         "010-6288-7469",
			Region:        "H",
			Regions:       "H",
			AvailableDays: "tue,wed,thu,sat",
			Transport:     models.TransportWalk,
			CanLaundry:    false,
			CanDry:        false,
			MaxDaily:      4,
			Active:        true,
		},

		// --- 하남 미사 ---
		{
			Name:          "김민주",
			Phone:         "010-3265-0145",
			Region:        "I",
			Regions:       "I",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      4,
			Active:        true,
		},

		// --- 동대문 / 서울 기타 ---
		{
			Name:          "김영숙",
			Phone:         "010-3319-8759",
			Region:        "K",
			Regions:       "K",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},
		{
			Name:          "안현기",
			Phone:         "010-6261-2659",
			Region:        "K",
			Regions:       "K,L",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        false,
			MaxDaily:      5,
			Active:        true,
			Memo:          "동대문, 중화 담당",
		},
		{
			Name:          "장미숙",
			Phone:         "010-3767-3054",
			Region:        "K",
			Regions:       "K,L",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
			Memo:          "방학, 동대문, 중화 담당",
		},

		// --- 중구 ---
		{
			Name:          "이기섭",
			Phone:         "",
			Region:        "J",
			Regions:       "J",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},

		// --- 가산 ---
		{
			Name:          "황월규",
			Phone:         "010-8442-7877",
			Region:        "L",
			Regions:       "L",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},

		// --- 인천 ---
		{
			Name:          "김정의",
			Phone:         "010-8860-6157",
			Region:        "M",
			Regions:       "M",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},

		// --- 최근 활동 청소자 (이번주 시트 기반) ---
		{
			Name:          "손혜영",
			Phone:         "010-6252-7845",
			Region:        "A2",
			Regions:       "A2,D",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    true,
			CanDry:        true,
			MaxDaily:      5,
			Active:        true,
		},
		{
			Name:          "주경태",
			Phone:         "010-4299-8076",
			Region:        "A2",
			Regions:       "A2,G",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    false,
			CanDry:        false,
			MaxDaily:      4,
			Active:        true,
		},
		{
			Name:          "김우현",
			Phone:         "",
			Region:        "A2",
			Regions:       "A2",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    false,
			CanDry:        false,
			MaxDaily:      4,
			Active:        true,
		},
		{
			Name:          "김남주",
			Phone:         "010-9066-3663",
			Region:        "V",
			Regions:       "V",
			AvailableDays: "mon,tue,wed,thu,fri,sat,sun",
			Transport:     models.TransportWalk,
			CanLaundry:    false,
			CanDry:        false,
			MaxDaily:      4,
			Active:        true,
			Memo:          "강남 대치 담당",
		},
	}

	for i := range cleaners {
		if err := config.DB.Create(&cleaners[i]).Error; err != nil {
			log.Printf("[Seed] Cleaner %s 생성 실패: %v", cleaners[i].Name, err)
		}
	}

	log.Printf("[Seed] Cleaner %d명 시드 완료", len(cleaners))
}
