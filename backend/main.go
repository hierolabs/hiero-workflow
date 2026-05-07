package main

import (
	"log"
	"os"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/router"
	"hiero-workflow/backend/service"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env 파일을 찾을 수 없습니다")
	}

	config.ConnectDB()
	config.DB.AutoMigrate(
		&models.Task{},
		&models.AdminUser{},
		&models.Property{},
		&models.Reservation{},
		&models.WebhookLog{},
		&models.Cleaner{},
		&models.CleaningTask{},
		&models.Issue{},
		&models.CommunicationLog{},
		&models.PropertyBusinessDiagnosis{},
		&models.Conversation{},
		&models.Message{},
		&models.GuestRequest{},
		&models.Review{},
		&models.OutsourcingLead{},
		&models.LeadActivityLog{},
		&models.MessageTemplate{},
		&models.Campaign{},
		&models.HostexTransaction{},
		&models.ManualEntry{},
		&models.CleaningCode{},
		&models.PropertyCost{},
		&models.MonthlyPropertyReport{},
		&models.CostRaw{},
		&models.CostAllocation{},
		&models.ChecklistItem{},
		&models.AiConversation{},
		&models.AiMemory{},
		&models.Notification{},
		&models.ActivityLog{},
		&models.ChatChannel{},
		&models.ChatMessage{},
		&models.ChatChannelMember{},
		&models.IssueDetection{},
		&models.WikiArticle{},
		&models.WikiRevision{},
		&models.UserSession{},
		&models.UserActivity{},
		&models.Document{},
		&models.PropertyPlatform{},
		&models.OnboardingCheck{},
		&models.Investor{},
		&models.PropertyInvestor{},
		&models.PropertyParking{},
	)
	seedAdminUser()
	seedProperties()
	seedDiagnosisSample()
	seedChatChannels()
	service.SeedCleaningCodes()
	service.SeedCleaners()
	seedWikiArticles()

	// Hostex 전체 동기화 (백그라운드)
	go func() {
		log.Println("[Boot] Hostex 전체 동기화 시작...")
		syncSvc := service.NewHostexSyncService()
		syncSvc.SyncAll()

		log.Println("[Boot] 대화 + 메시지 동기화 시작...")
		msgSvc := service.NewMessageService()
		msgSvc.SyncConversationsWithMessages()

		log.Println("[Boot] 리뷰 동기화 시작...")
		reviewSvc := service.NewReviewService()
		reviewSvc.SyncReviews()
	}()

	// 1시간마다 자동 동기화
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("[Cron] 정기 동기화 시작...")
			syncSvc := service.NewHostexSyncService()
			syncSvc.SyncReservations()

			msgSvc := service.NewMessageService()
			msgSvc.SyncConversationsWithMessages()

			reviewSvc := service.NewReviewService()
			reviewSvc.SyncReviews()
			log.Println("[Cron] 정기 동기화 완료")
		}
	}()

	r := router.Setup()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("서버 시작: http://localhost:%s\n", port)
	r.Run(":" + port)
}

func seedAdminUser() {
	// 조직구조 시드 — login_id 기준으로 upsert
	pw := "hiero2026"
	hashed, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("비밀번호 해싱 실패:", err)
	}

	users := []models.AdminUser{
		{LoginID: "admin", Name: "관리자", Role: models.RoleSuperAdmin, RoleLayer: "founder", RoleTitle: "founder"},
		{LoginID: "jinwoo", Name: "김진우", Role: models.RoleSuperAdmin, RoleLayer: "founder", RoleTitle: "founder"},
		{LoginID: "jihoon", Name: "김지훈", Role: models.RoleAdmin, RoleLayer: "etf", RoleTitle: "ceo"},
		{LoginID: "yujin", Name: "변유진", Role: models.RoleAdmin, RoleLayer: "etf", RoleTitle: "cto"},
		{LoginID: "subin", Name: "박수빈", Role: models.RoleAdmin, RoleLayer: "etf", RoleTitle: "cfo"},
		{LoginID: "yerin", Name: "이예린", Role: models.RoleAdmin, RoleLayer: "execution", RoleTitle: "marketing"},
		{LoginID: "jaekwan", Name: "오재관", Role: models.RoleAdmin, RoleLayer: "execution", RoleTitle: "operations"},
		{LoginID: "woohyun", Name: "김우현", Role: models.RoleAdmin, RoleLayer: "execution", RoleTitle: "cleaning_dispatch"},
		{LoginID: "jintae", Name: "김진태", Role: models.RoleAdmin, RoleLayer: "execution", RoleTitle: "field"},
	}

	for _, u := range users {
		var existing models.AdminUser
		if err := config.DB.Where("login_id = ?", u.LoginID).First(&existing).Error; err != nil {
			u.Password = string(hashed)
			config.DB.Create(&u)
			log.Printf("계정 생성: %s (%s / %s)\n", u.Name, u.RoleLayer, u.RoleTitle)
		} else {
			// role_layer, role_title만 업데이트 (기존 계정 보존)
			config.DB.Model(&existing).Updates(map[string]interface{}{
				"role_layer": u.RoleLayer,
				"role_title": u.RoleTitle,
				"name":       u.Name,
			})
		}
	}
	log.Println("조직구조 시드 완료")
}

func seedProperties() {
	seeds := []models.Property{
		{
			Code:            "B105",
			Name:            "다하임 1005",
			Region:          "gangdong",
			Address:         "서울특별시 강동구",
			PropertyType:    "apartment",
			RoomType:        "entire",
			MaxGuests:       4,
			Bedrooms:        1,
			Beds:            2,
			Bathrooms:       1,
			MonthlyRent:     800000,
			ManagementFee:   150000,
			Deposit:         5000000,
			Status:          models.PropertyStatusActive,
			OperationStatus: models.OperationStatusAvailable,
			CheckInTime:     "15:00",
			CheckOutTime:    "11:00",
		},
		{
			Code:            "C6",
			Name:            "청광차 1303",
			Region:          "songpa",
			Address:         "서울특별시 송파구",
			PropertyType:    "apartment",
			RoomType:        "entire",
			MaxGuests:       6,
			Bedrooms:        2,
			Beds:            3,
			Bathrooms:       1,
			MonthlyRent:     1200000,
			ManagementFee:   200000,
			Deposit:         10000000,
			Status:          models.PropertyStatusActive,
			OperationStatus: models.OperationStatusOccupied,
			CheckInTime:     "16:00",
			CheckOutTime:    "11:00",
		},
		{
			Code:            "U24",
			Name:            "성우 204",
			Region:          "gangnam",
			Address:         "서울특별시 강남구",
			PropertyType:    "officetel",
			RoomType:        "entire",
			MaxGuests:       2,
			Bedrooms:        1,
			Beds:            1,
			Bathrooms:       1,
			MonthlyRent:     900000,
			ManagementFee:   100000,
			Deposit:         3000000,
			Status:          models.PropertyStatusPreparing,
			OperationStatus: models.OperationStatusInactive,
			CheckInTime:     "15:00",
			CheckOutTime:    "11:00",
		},
	}

	for _, seed := range seeds {
		var existing models.Property
		if err := config.DB.Where("code = ?", seed.Code).First(&existing).Error; err != nil {
			config.DB.Create(&seed)
			log.Printf("시드 공간 생성: %s (%s)\n", seed.Name, seed.Code)
		}
	}
}

func seedDiagnosisSample() {
	var count int64
	config.DB.Model(&models.PropertyBusinessDiagnosis{}).Count(&count)
	if count > 0 {
		return
	}

	// 기존 properties에서 ID 조��
	var properties []models.Property
	config.DB.Order("id asc").Find(&properties)
	if len(properties) == 0 {
		log.Println("[seed] properties가 없어서 진단 시드 스킵")
		return
	}

	diagnoses := []models.PropertyBusinessDiagnosis{}

	if len(properties) >= 1 {
		diagnoses = append(diagnoses, models.PropertyBusinessDiagnosis{
			PropertyID: properties[0].ID,
			// 가치창출
			LocationScore: 70, RoomTypeScore: 45, PriceValueScore: 55, InteriorScore: 50, TargetFitScore: 55,
			// 마케팅
			PhotoScore: 40, ChannelExposureScore: 50, ListingScore: 45, ReviewScore: 60, ChannelPerformanceScore: 45,
			// 판매
			OccupancyRate: 26, InquiryConversion: 40, BookingConversion: 35, PriceFlexibility: 60, LongStayConversion: 30,
			// 운영전달
			CleaningScore: 80, CheckinScore: 75, CSScore: 70, AmenityScore: 65, ClaimRate: 75,
			// 재무
			MonthlyRevenue: 770000, MonthlyRent: 700000, MonthlyMgmtFee: 200000, MonthlyCleanFee: 150000, PlatformFee: 90000, ADR: 78000,
			Note: "사진 퀄리티가 가장 약함. 침대 구성 재검토 필요.",
		})
	}
	if len(properties) >= 2 {
		diagnoses = append(diagnoses, models.PropertyBusinessDiagnosis{
			PropertyID: properties[1].ID,
			// 가치창출
			LocationScore: 60, RoomTypeScore: 50, PriceValueScore: 45, InteriorScore: 50, TargetFitScore: 50,
			// 마케팅
			PhotoScore: 50, ChannelExposureScore: 30, ListingScore: 50, ReviewScore: 30, ChannelPerformanceScore: 25,
			// 판매
			OccupancyRate: 0, InquiryConversion: 0, BookingConversion: 0, PriceFlexibility: 30, LongStayConversion: 0,
			// 운영전달
			CleaningScore: 60, CheckinScore: 60, CSScore: 50, AmenityScore: 55, ClaimRate: 90,
			// 재무
			MonthlyRevenue: 0, MonthlyRent: 650000, MonthlyMgmtFee: 180000, MonthlyCleanFee: 0, PlatformFee: 0, ADR: 0,
			Note: "운영 중단 상태. 재개 또는 정리 결정 필요.",
		})
	}
	if len(properties) >= 3 {
		diagnoses = append(diagnoses, models.PropertyBusinessDiagnosis{
			PropertyID: properties[2].ID,
			// 가치창출
			LocationScore: 85, RoomTypeScore: 70, PriceValueScore: 65, InteriorScore: 65, TargetFitScore: 70,
			// 마케팅
			PhotoScore: 65, ChannelExposureScore: 60, ListingScore: 60, ReviewScore: 70, ChannelPerformanceScore: 60,
			// 판매
			OccupancyRate: 68, InquiryConversion: 55, BookingConversion: 60, PriceFlexibility: 65, LongStayConversion: 50,
			// 운영전달
			CleaningScore: 80, CheckinScore: 80, CSScore: 75, AmenityScore: 70, ClaimRate: 85,
			// 재무
			MonthlyRevenue: 2240000, MonthlyRent: 1100000, MonthlyMgmtFee: 250000, MonthlyCleanFee: 280000, PlatformFee: 320000, ADR: 110000,
		})
	}

	for i := range diagnoses {
		config.DB.Where("property_id = ?", diagnoses[i].PropertyID).
			FirstOrCreate(&diagnoses[i])
	}
	log.Printf("[seed] %d건 사업 진단 시드 생성 완료", len(diagnoses))
}

func seedChatChannels() {
	channels := []models.ChatChannel{
		{Name: "전체", ChannelType: "team", RoleFilter: ""},
		{Name: "ETF", ChannelType: "role", RoleFilter: "etf"},
		{Name: "운영팀", ChannelType: "role", RoleFilter: "execution"},
		{Name: "긴급", ChannelType: "team", RoleFilter: ""},
	}
	for _, ch := range channels {
		var existing models.ChatChannel
		if err := config.DB.Where("name = ? AND channel_type = ?", ch.Name, ch.ChannelType).First(&existing).Error; err != nil {
			config.DB.Create(&ch)
			log.Printf("[seed] 채팅 채널 생성: %s (%s)", ch.Name, ch.ChannelType)
		}
	}
}

func seedWikiArticles() {
	// 기존 섹션 수 확인 — 새 파트가 추가되면 없는 것만 INSERT
	var existingCount int64
	config.DB.Model(&models.WikiArticle{}).Count(&existingCount)
	type s struct {
		P  int; PT string; C int; CT string; S string; T string; A string
	}
	data := []s{
		{0,"HIERO Ontology",0,"HIERO Ontology란 무엇인가","0.1","온톨로지의 정의","cto"},
		{0,"HIERO Ontology",0,"HIERO Ontology란 무엇인가","0.2","왜 숙박·중단기 임대에 온톨로지가 필요한가","cto"},
		{0,"HIERO Ontology",0,"HIERO Ontology란 무엇인가","0.3","핵심 엔티티 15개","cto"},
		{0,"HIERO Ontology",0,"HIERO Ontology란 무엇인가","0.4","엔티티 간 관계","cto"},
		{0,"HIERO Ontology",0,"HIERO Ontology란 무엇인가","0.5","온톨로지의 목적","cto"},
		{1,"Vision & Structure",1,"heiro.labs란 무엇인가","1.1","공유숙박·중단기 임대 운영의 문제 정의","ceo"},
		{1,"Vision & Structure",1,"heiro.labs란 무엇인가","1.2","100채 → 300채, 엑셀에서 OS로","ceo"},
		{1,"Vision & Structure",1,"heiro.labs란 무엇인가","1.3","핵심 가설: 운영 자동화 = 인당 관리 숙소 3배","ceo"},
		{1,"Vision & Structure",1,"heiro.labs란 무엇인가","1.4","4개 모듈: HIERO Core / ThingDone / Back Office / AI Agent","cto"},
		{1,"Vision & Structure",2,"시스템 아키텍처","2.1","전체 레이어 구조","cto"},
		{1,"Vision & Structure",2,"시스템 아키텍처","2.2","기술 스택: Go + React + Vercel","cto"},
		{1,"Vision & Structure",2,"시스템 아키텍처","2.3","데이터 3층 구조: Data1 API / Data2 CSV / Data3 JOIN","cto"},
		{1,"Vision & Structure",2,"시스템 아키텍처","2.4","권한 체계: 7등급 역할 기반 접근","cto"},
		{1,"Vision & Structure",2,"시스템 아키텍처","2.5","운영 데이터의 흐름","cto"},
		{1,"Vision & Structure",3,"팀과 역할","3.1","운영팀 구조와 각 역할","ceo"},
		{1,"Vision & Structure",3,"팀과 역할","3.2","매뉴얼 3모드: 의사결정 / 관리 / 실행","ceo"},
		{1,"Vision & Structure",3,"팀과 역할","3.3","이슈 자동 배정 규칙","ceo"},
		{1,"Vision & Structure",3,"팀과 역할","3.4","팀원 Dashboard와 KPI","ceo"},
		{1,"Vision & Structure",99,"비즈니스 모델","1.5.1","내부 운영 효율화 모델","ceo"},
		{1,"Vision & Structure",99,"비즈니스 모델","1.5.2","외부 SaaS 모델","ceo"},
		{1,"Vision & Structure",99,"비즈니스 모델","1.5.3","데이터 플랫폼 모델","ceo"},
		{2,"HIERO Core",4,"Hostex 연동","4.1","Hostex API 숙소·예약 동기화","operations"},
		{2,"HIERO Core",4,"Hostex 연동","4.2","Webhook 수신","cto"},
		{2,"HIERO Core",4,"Hostex 연동","4.3","내부 Property DB 매칭","cto"},
		{2,"HIERO Core",4,"Hostex 연동","4.4","동기화 정합성 문제와 해결","cto"},
		{2,"HIERO Core",4,"Hostex 연동","4.5","API 누락과 CSV 보완 구조","cfo"},
		{2,"HIERO Core",5,"예약 관리","5.1","Daily Operation Board","operations"},
		{2,"HIERO Core",5,"예약 관리","5.2","오늘 체크인 / 오늘 체크아웃","operations"},
		{2,"HIERO Core",5,"예약 관리","5.3","예약 상태 관리","operations"},
		{2,"HIERO Core",5,"예약 관리","5.4","기간별 정렬·필터·프리셋","cto"},
		{2,"HIERO Core",5,"예약 관리","5.5","연장예약 감지와 청소 스킵 로직","cleaning_dispatch"},
		{2,"HIERO Core",6,"랜딩페이지와 리드 확보","6.1","통합 랜딩 구조","marketing"},
		{2,"HIERO Core",6,"랜딩페이지와 리드 확보","6.2","CTA → 리드 자동 생성 파이프라인","marketing"},
		{2,"HIERO Core",6,"랜딩페이지와 리드 확보","6.3","타겟별 광고 랜딩 확장 전략","marketing"},
		{2,"HIERO Core",6,"랜딩페이지와 리드 확보","6.4","메시지 분리","cto"},
		{3,"ThingDone",7,"제품 정의","7.1","HIERO vs ThingDone의 관계","cto"},
		{3,"ThingDone",7,"제품 정의","7.2","카카오톡 배정 → 앱 자동화","cleaning_dispatch"},
		{3,"ThingDone",7,"제품 정의","7.3","핵심 7기능과 MVP 범위","cto"},
		{3,"ThingDone",7,"제품 정의","7.4","첫 목표: 배정 1~2시간 → 20분","ceo"},
		{3,"ThingDone",8,"청소코드와 청소자 DB화","8.1","엑셀 → DB 전환 설계","cto"},
		{3,"ThingDone",8,"청소코드와 청소자 DB화","8.2","14권역 체계 A~N","cleaning_dispatch"},
		{3,"ThingDone",8,"청소코드와 청소자 DB화","8.3","단가 체계","cfo"},
		{3,"ThingDone",8,"청소코드와 청소자 DB화","8.4","청소자 22명 프로필","cleaning_dispatch"},
		{3,"ThingDone",8,"청소코드와 청소자 DB화","8.5","권역/요일/이동수단/역량 데이터화","cleaning_dispatch"},
		{3,"ThingDone",9,"청소 업무 자동 생성","9.1","체크아웃 → CleaningTask 자동 생성","cto"},
		{3,"ThingDone",9,"청소 업무 자동 생성","9.2","청소코드 매칭 → 단가 자동 연결","cto"},
		{3,"ThingDone",9,"청소 업무 자동 생성","9.3","동일 게스트 연장 예약 감지","cto"},
		{3,"ThingDone",9,"청소 업무 자동 생성","9.4","우선순위 분류","operations"},
		{3,"ThingDone",10,"매니저 대시보드","10.1","권역별 뷰 vs 전체 목록 뷰","cleaning_dispatch"},
		{3,"ThingDone",10,"매니저 대시보드","10.2","청소자별 워크로드 게이지","cleaning_dispatch"},
		{3,"ThingDone",10,"매니저 대시보드","10.3","미배정 경고","cleaning_dispatch"},
		{3,"ThingDone",10,"매니저 대시보드","10.4","연장 감지 알림","cleaning_dispatch"},
		{3,"ThingDone",10,"매니저 대시보드","10.5","청소코드·청소자 관리 탭","cleaning_dispatch"},
		{3,"ThingDone",11,"청소자 모바일 앱","11.1","청소자 JWT 인증","cto"},
		{3,"ThingDone",11,"청소자 모바일 앱","11.2","모바일 API","cto"},
		{3,"ThingDone",11,"청소자 모바일 앱","11.3","배정 확인 → 시작 → 완료 → 문제등록","cleaning_dispatch"},
		{3,"ThingDone",11,"청소자 모바일 앱","11.4","주간 지급액 조회","cfo"},
		{3,"ThingDone",12,"배정 메시지 자동 생성","12.1","메시지 포맷","cleaning_dispatch"},
		{3,"ThingDone",12,"배정 메시지 자동 생성","12.2","숙소명/주소/시간/특이사항","cleaning_dispatch"},
		{3,"ThingDone",12,"배정 메시지 자동 생성","12.3","카카오톡/SMS 연동 계획","cto"},
		{3,"ThingDone",12,"배정 메시지 자동 생성","12.4","자동 발송 전 관리자 승인 구조","ceo"},
		{3,"ThingDone",13,"사진·이슈·추가비","13.1","비포/애프터 사진 업로드","cleaning_dispatch"},
		{3,"ThingDone",13,"사진·이슈·추가비","13.2","문제 등록 → 유지보수 이슈 전환","field"},
		{3,"ThingDone",13,"사진·이슈·추가비","13.3","추가비 입력","cfo"},
		{3,"ThingDone",13,"사진·이슈·추가비","13.4","소모품/택시비/기상악화/세탁비 정산","cfo"},
		{3,"ThingDone",14,"주간 정산과 KPI","14.1","청소자별 주간 정산 자동 생성","cfo"},
		{3,"ThingDone",14,"주간 정산과 KPI","14.2","운영 KPI","ceo"},
		{3,"ThingDone",14,"주간 정산과 KPI","14.3","비용 KPI","cfo"},
		{3,"ThingDone",14,"주간 정산과 KPI","14.4","효율 KPI","ceo"},
		{3,"ThingDone",14,"주간 정산과 KPI","14.5","외부 SaaS 판매 기준 KPI","ceo"},
		{4,"Back Office",15,"데이터 정합성","15.1","CSV가 유일한 신뢰 소스인 이유","cfo"},
		{4,"Back Office",15,"데이터 정합성","15.2","API 78% 누락 사례","cto"},
		{4,"Back Office",15,"데이터 정합성","15.3","hostex_transactions 16개월 12,990건","cfo"},
		{4,"Back Office",15,"데이터 정합성","15.4","카테고리 매핑: 수입 3종 / 비용 13종","cfo"},
		{4,"Back Office",15,"데이터 정합성","15.5","Data1+Data2 → Data3 JOIN 구조","cto"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.1","OTA 단기임대 과세","cfo"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.2","중기임대 기간 기준 분류","cfo"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.3","면세 전대임대료","cfo"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.4","과세 숙박매출","cfo"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.5","과세 서비스매출","cfo"},
		{4,"Back Office",16,"매출 과세/면세 분류","16.6","인라인 확장 UI 설계","cto"},
		{4,"Back Office",17,"숙소별 P&L","17.1","property_costs 모델","cfo"},
		{4,"Back Office",17,"숙소별 P&L","17.2","소유구조 4종","cfo"},
		{4,"Back Office",17,"숙소별 P&L","17.3","월세/위탁료/공과금/관리비","cfo"},
		{4,"Back Office",17,"숙소별 P&L","17.4","monthly_property_reports 스냅샷","cfo"},
		{4,"Back Office",17,"숙소별 P&L","17.5","Settlement 페이지","cfo"},
		{4,"Back Office",17,"숙소별 P&L","17.6","연도별 그리드/다중 필터/CSV Export","cto"},
		{4,"Back Office",18,"세무·회계 구조","18.1","매출 3분류","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.2","계정과목 체계 4101~6117","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.3","operation_type 5종","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.4","tax_category 4종","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.5","숙소별 구분회계","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.6","REVIEW 항목 처리","cfo"},
		{4,"Back Office",18,"세무·회계 구조","18.7","세무사 전달자료 생성","cfo"},
		{5,"AI Agent",21,"AI Agent의 역할","21.1","운영 판단 보조자","cto"},
		{5,"AI Agent",21,"AI Agent의 역할","21.2","예약 데이터 해석","cto"},
		{5,"AI Agent",21,"AI Agent의 역할","21.3","청소 누락 위험 감지","cto"},
		{5,"AI Agent",21,"AI Agent의 역할","21.4","정산 이상치 감지","cto"},
		{5,"AI Agent",21,"AI Agent의 역할","21.5","세무 분류 보조","cfo"},
		{5,"AI Agent",21,"AI Agent의 역할","21.6","월간 운영 리포트 자동 작성","cto"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.1","예약 Agent","cto"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.2","청소 Agent","cto"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.3","정산 Agent","cfo"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.4","세무 Agent","cfo"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.5","CS Agent","operations"},
		{5,"AI Agent",22,"Agent별 역할 분리","22.6","대표 보고 Agent","cto"},
		{5,"AI Agent",23,"AI 의사결정 권한","23.1","자동 실행 가능한 일","cto"},
		{5,"AI Agent",23,"AI 의사결정 권한","23.2","관리자 승인 필요한 일","ceo"},
		{5,"AI Agent",23,"AI 의사결정 권한","23.3","절대 자동화하면 안 되는 일","ceo"},
		{5,"AI Agent",23,"AI 의사결정 권한","23.4","감사 로그와 책임 구조","cto"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.1","property_costs CRUD","cfo"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.2","CSV Import 고도화","cto"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.3","배정 메시지 자동화","cleaning_dispatch"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.4","우연 배정시간 20분 목표 달성","cleaning_dispatch"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.5","멀티인박스","operations"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.6","AI 응대","cto"},
		{6,"Scale-up",19,"다음 단계 로드맵","19.7","통화 녹음 분석","cto"},
		{6,"Scale-up",20,"300채 스케일링","20.1","월 3.5억, 팀 27명 목표 구조","ceo"},
		{6,"Scale-up",20,"300채 스케일링","20.2","인당 관리 숙소 수","ceo"},
		{6,"Scale-up",20,"300채 스케일링","20.3","띵동 SaaS 외부 판매 전략","ceo"},
		{6,"Scale-up",20,"300채 스케일링","20.4","임대인 포털 구상","ceo"},
		{6,"Scale-up",20,"300채 스케일링","20.5","중단기 주거 운영 OS로 확장","cto"},
		{6,"Scale-up",20,"300채 스케일링","20.6","MORO와의 수요 안착 연동","cto"},
		{7,"Business Model",24,"내부 효율화 → 외부 판매 → 데이터 플랫폼","24.1","3대 비즈니스 모델 상세","ceo"},
		{7,"Business Model",24,"내부 효율화 → 외부 판매 → 데이터 플랫폼","24.2","매출 구조와 가격 전략","ceo"},
		{7,"Business Model",24,"내부 효율화 → 외부 판매 → 데이터 플랫폼","24.3","시장 규모와 타겟","ceo"},
		{99,"부록",90,"부록","A","핵심 파일 맵","cto"},
		{99,"부록",90,"부록","B","API 엔드포인트 전체 목록","cto"},
		{99,"부록",90,"부록","C","DB 스키마","cto"},
		{99,"부록",90,"부록","D","운영 전략 흐름도","ceo"},
		{99,"부록",90,"부록","E","청소자 계정 및 권역 배정표","cleaning_dispatch"},
		{99,"부록",90,"부록","F","계정과목 매핑표","cfo"},
		{99,"부록",90,"부록","G","세무사 확인 질문 리스트","cfo"},
		{99,"부록",90,"부록","H","Claude Code 개발 지시문 모음","cto"},

		// Part 8: ETF 보고서
		{8,"ETF 보고서",25,"CEO 월간 보고서","25.1","월간 경영 현황 리포트","ceo"},
		{8,"ETF 보고서",25,"CEO 월간 보고서","25.2","투자 제안서 / 피칭 자료","ceo"},
		{8,"ETF 보고서",25,"CEO 월간 보고서","25.3","사업계획서 업데이트","ceo"},
		{8,"ETF 보고서",25,"CEO 월간 보고서","25.4","팀 성과 리포트","ceo"},
		{8,"ETF 보고서",26,"CFO 월간 보고서","26.1","월간 재무제표","cfo"},
		{8,"ETF 보고서",26,"CFO 월간 보고서","26.2","결산 보고서","cfo"},
		{8,"ETF 보고서",26,"CFO 월간 보고서","26.3","세무 신고 자료","cfo"},
		{8,"ETF 보고서",26,"CFO 월간 보고서","26.4","비용 분석 리포트","cfo"},
		{8,"ETF 보고서",26,"CFO 월간 보고서","26.5","숙소별 P&L 월간 스냅샷","cfo"},
		{8,"ETF 보고서",27,"CTO 월간 보고서","27.1","기술 현황 리포트","cto"},
		{8,"ETF 보고서",27,"CTO 월간 보고서","27.2","콘텐츠 파이프라인 현황","cto"},
		{8,"ETF 보고서",27,"CTO 월간 보고서","27.3","연구 산출물 현황","cto"},
		{8,"ETF 보고서",27,"CTO 월간 보고서","27.4","데이터 아키텍처 변경 이력","cto"},

		// Part 9: 공문서·계약
		{9,"공문서·계약",28,"임대차 계약","28.1","전대차 계약서 (임대인↔heiro)","cfo"},
		{9,"공문서·계약",28,"임대차 계약","28.2","위탁운영 계약서 (임대인↔heiro)","cfo"},
		{9,"공문서·계약",28,"임대차 계약","28.3","렌탈·리스 계약서 (가전·가구)","cfo"},
		{9,"공문서·계약",28,"임대차 계약","28.4","계약 갱신·해지 이력","cfo"},
		{9,"공문서·계약",29,"노동·인사","29.1","근로계약서 (정규직)","cfo"},
		{9,"공문서·계약",29,"노동·인사","29.2","업무위탁계약서 (청소자·프리랜서)","cfo"},
		{9,"공문서·계약",29,"노동·인사","29.3","급여 대장 / 지급 내역","cfo"},
		{9,"공문서·계약",29,"노동·인사","29.4","4대보험 관리","cfo"},
		{9,"공문서·계약",29,"노동·인사","29.5","인사 기록 (입사·퇴사·이동)","ceo"},
		{9,"공문서·계약",30,"사업자·행정","30.1","사업자등록증 / 변경 이력","cfo"},
		{9,"공문서·계약",30,"사업자·행정","30.2","숙박업·전대업 신고서","cfo"},
		{9,"공문서·계약",30,"사업자·행정","30.3","보험 증권 (화재·배상·상해)","cfo"},
		{9,"공문서·계약",30,"사업자·행정","30.4","관공서 공문 수발 이력","ceo"},
		{9,"공문서·계약",31,"파트너·외부 계약","31.1","OTA 채널 계약 (Airbnb·Booking 등)","operations"},
		{9,"공문서·계약",31,"파트너·외부 계약","31.2","세무사·법무사 위임 계약","cfo"},
		{9,"공문서·계약",31,"파트너·외부 계약","31.3","외주 개발·디자인 계약","cto"},
		{9,"공문서·계약",31,"파트너·외부 계약","31.4","제휴·협업 MOU","ceo"},

		// Part 10: 운영 데이터 자동 축적
		{10,"운영 데이터",32,"예약 데이터","32.1","월별 예약 건수 / 가동률 추이","operations"},
		{10,"운영 데이터",32,"예약 데이터","32.2","채널별 예약 비중","operations"},
		{10,"운영 데이터",32,"예약 데이터","32.3","ADR / RevPAR 추이","cfo"},
		{10,"운영 데이터",32,"예약 데이터","32.4","게스트 국적·체류기간 분석","cto"},
		{10,"운영 데이터",33,"이슈 데이터","33.1","월별 이슈 건수 / 유형 분류","operations"},
		{10,"운영 데이터",33,"이슈 데이터","33.2","반복 이슈 TOP 10","ceo"},
		{10,"운영 데이터",33,"이슈 데이터","33.3","평균 해결 시간 추이","ceo"},
		{10,"운영 데이터",34,"자산·비용 데이터","34.1","관리 숙소 수 / 객실 수 추이","ceo"},
		{10,"운영 데이터",34,"자산·비용 데이터","34.2","월별 매출 / 비용 / 순이익 추이","cfo"},
		{10,"운영 데이터",34,"자산·비용 데이터","34.3","권역별 수익률 비교","cfo"},
		{10,"운영 데이터",34,"자산·비용 데이터","34.4","인당 관리 숙소 수 추이","ceo"},
		{10,"운영 데이터",35,"청소 데이터","35.1","월별 청소 건수 / 평균 소요시간","cleaning_dispatch"},
		{10,"운영 데이터",35,"청소 데이터","35.2","청소자별 생산성 추이","cleaning_dispatch"},
		{10,"운영 데이터",35,"청소 데이터","35.3","청소 비용 / 매출 비율 추이","cfo"},
	}
	created := 0
	for i, d := range data {
		var exists int64
		config.DB.Model(&models.WikiArticle{}).Where("part_number = ? AND section = ?", d.P, d.S).Count(&exists)
		if exists > 0 {
			continue
		}
		config.DB.Create(&models.WikiArticle{
			PartNumber: d.P, PartTitle: d.PT, Chapter: d.C, ChapterTitle: d.CT,
			Section: d.S, Title: d.T, Status: "empty", AssignedTo: d.A, SortOrder: int(existingCount) + i,
		})
		created++
	}
	if created > 0 {
		log.Printf("[seed] Hestory %d건 새 섹션 추가 (전체 %d건)", created, len(data))
	}
}
