package service

import (
	"log"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"golang.org/x/crypto/bcrypt"
)

// SeedCleaners — 엑셀 "운영 정보" 시트 기반 청소자 시드
func SeedCleaners() {
	var count int64
	config.DB.Model(&models.Cleaner{}).Count(&count)
	if count > 0 {
		// 기존 청소자에 login_id가 없으면 업데이트
		migrateCleanerLogins()
		return
	}

	// 기본 비밀번호: 0000 (청소자가 앱에서 변경)
	pw, _ := bcrypt.GenerateFromPassword([]byte("0000"), bcrypt.DefaultCost)
	p := string(pw)

	cleaners := []models.Cleaner{
		{LoginID: "madina", Password: p, Name: "마디나", Phone: "010-8447-3332", Region: "A", Regions: "A,A2", AvailableDays: "mon,tue,wed,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: false, MaxDaily: 5, Active: true, Memo: "선불 필요"},
		{LoginID: "kimje", Password: p, Name: "김정은", Phone: "010-4737-7534", Region: "A", Regions: "A,A2", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "yumj", Password: p, Name: "유민정", Phone: "010-5906-7472", Region: "C", Regions: "C,D,E", AvailableDays: "mon,tue,wed,thu,fri", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true, Memo: "2건 이상 배정"},
		{LoginID: "parkys", Password: p, Name: "박연실", Phone: "010-8752-8202", Region: "C", Regions: "C,D,E,F", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportBike, CanLaundry: true, CanDry: true, MaxDaily: 6, Active: true},
		{LoginID: "jangsy", Password: p, Name: "장승연", Phone: "010-2773-2244", Region: "C", Regions: "C", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: false, MaxDaily: 4, Active: true},
		{LoginID: "ryujy", Password: p, Name: "류지영", Phone: "010-4509-5717", Region: "A2", Regions: "강동 전역", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportCar, CanLaundry: true, CanDry: true, MaxDaily: 6, Active: true, Memo: "남편 동행, 자차 이동"},
		{LoginID: "kimjh", Password: p, Name: "김정한", Phone: "010-7626-1955", Region: "A", Regions: "강동 전역", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportBike, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "gongsg", Password: p, Name: "공숙길", Phone: "010-5520-3206", Region: "A", Regions: "A,A2,C,D,E,F,G", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "kangsm", Password: p, Name: "강수미", Phone: "010-2272-4424", Region: "G", Regions: "G,H", AvailableDays: "mon,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 4, Active: true, Memo: "H권역 빨래 수거 포함"},
		{LoginID: "parkjs", Password: p, Name: "박진성", Phone: "010-6288-7469", Region: "H", Regions: "H", AvailableDays: "tue,wed,thu,sat", Transport: models.TransportWalk, CanLaundry: false, CanDry: false, MaxDaily: 4, Active: true},
		{LoginID: "kimmj", Password: p, Name: "김민주", Phone: "010-3265-0145", Region: "I", Regions: "I", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 4, Active: true},
		{LoginID: "kimys", Password: p, Name: "김영숙", Phone: "010-3319-8759", Region: "K", Regions: "K", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "anhg", Password: p, Name: "안현기", Phone: "010-6261-2659", Region: "K", Regions: "K,L", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: false, MaxDaily: 5, Active: true, Memo: "동대문, 중화 담당"},
		{LoginID: "jangms", Password: p, Name: "장미숙", Phone: "010-3767-3054", Region: "K", Regions: "K,L", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true, Memo: "방학, 동대문, 중화 담당"},
		{LoginID: "leegs", Password: p, Name: "이기섭", Phone: "", Region: "J", Regions: "J", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "hwangwg", Password: p, Name: "황월규", Phone: "010-8442-7877", Region: "L", Regions: "L", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "kimji", Password: p, Name: "김정의", Phone: "010-8860-6157", Region: "M", Regions: "M", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "sonhy", Password: p, Name: "손혜영", Phone: "010-6252-7845", Region: "A2", Regions: "A2,D", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: true, CanDry: true, MaxDaily: 5, Active: true},
		{LoginID: "joogt", Password: p, Name: "주경태", Phone: "010-4299-8076", Region: "A2", Regions: "A2,G", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: false, CanDry: false, MaxDaily: 4, Active: true},
		{LoginID: "kimwh", Password: p, Name: "김우현", Phone: "", Region: "A2", Regions: "A2", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: false, CanDry: false, MaxDaily: 4, Active: true},
		{LoginID: "kimnj", Password: p, Name: "김남주", Phone: "010-9066-3663", Region: "V", Regions: "V", AvailableDays: "mon,tue,wed,thu,fri,sat,sun", Transport: models.TransportWalk, CanLaundry: false, CanDry: false, MaxDaily: 4, Active: true, Memo: "강남 대치 담당"},
	}

	for i := range cleaners {
		if err := config.DB.Create(&cleaners[i]).Error; err != nil {
			log.Printf("[Seed] Cleaner %s 생성 실패: %v", cleaners[i].Name, err)
		}
	}

	log.Printf("[Seed] Cleaner %d명 시드 완료 (기본 비밀번호: 0000)", len(cleaners))
}

// migrateCleanerLogins — 기존 청소자에 login_id/password가 없으면 추가
func migrateCleanerLogins() {
	nameToLogin := map[string]string{
		"마디나": "madina", "김정은": "kimje", "유민정": "yumj", "박연실": "parkys",
		"장승연": "jangsy", "류지영": "ryujy", "김정한": "kimjh", "공숙길": "gongsg",
		"강수미": "kangsm", "박진성": "parkjs", "김민주": "kimmj", "김영숙": "kimys",
		"안현기": "anhg", "장미숙": "jangms", "이기섭": "leegs", "황월규": "hwangwg",
		"김정의": "kimji", "손혜영": "sonhy", "주경태": "joogt", "김우현": "kimwh",
		"김남주": "kimnj",
	}

	var cleaners []models.Cleaner
	config.DB.Where("login_id IS NULL OR login_id = ''").Find(&cleaners)
	if len(cleaners) == 0 {
		return
	}

	pw, _ := bcrypt.GenerateFromPassword([]byte("0000"), bcrypt.DefaultCost)
	updated := 0
	for _, c := range cleaners {
		loginID, ok := nameToLogin[c.Name]
		if !ok {
			// 이름에서 자동 생성
			loginID = "cleaner" + string(rune('0'+c.ID))
		}
		config.DB.Model(&c).Updates(map[string]interface{}{
			"login_id": loginID,
			"password": string(pw),
		})
		updated++
	}
	if updated > 0 {
		log.Printf("[Seed] Cleaner login_id %d명 마이그레이션 완료 (비밀번호: 0000)", updated)
	}
}
