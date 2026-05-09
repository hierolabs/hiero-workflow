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
	config.ConnectLocalDB()

	// 로컬 SQLite에 근태/활동 테이블
	config.LocalDB.AutoMigrate(
		&models.UserSession{},
		&models.UserActivity{},
		&models.ActivityLog{},
	)

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
		&models.ChatChannel{},
		&models.ChatMessage{},
		&models.ChatChannelMember{},
		&models.IssueDetection{},
		&models.WikiArticle{},
		&models.WikiRevision{},
		&models.Document{},
		&models.PropertyPlatform{},
		&models.OnboardingCheck{},
		&models.Investor{},
		&models.PropertyInvestor{},
		&models.PropertyParking{},
		&models.CSKnowledge{},
		&models.ListingCalendar{},
		&models.PriceLabsListing{},
		&models.PriceLabsPrice{},
		&models.ChatHistory{},
		&models.MarketPrice{},
		&models.MarketContract{},
		&models.CrawlJob{},
	)
	seedAdminUser()
	service.SeedCSKnowledge()
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

		log.Println("[Boot] Hostex 가격 캘린더 동기화 시작...")
		pricingSvc := service.NewPricingService()
		pricingSvc.SyncAllPricing()

		log.Println("[Boot] PriceLabs 동기화 시작...")
		plSvc := service.NewPriceLabsService()
		plSvc.SyncAll()
	}()

	// 5분마다 메시지 동기화
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
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

	// 데이터 파이프라인 스케줄러
	scheduler := service.NewScheduler()
	scheduler.Start()

	r := router.Setup(scheduler)

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
			// role_layer, role_title + 비밀번호 통일
			config.DB.Model(&existing).Updates(map[string]interface{}{
				"role_layer": u.RoleLayer,
				"role_title": u.RoleTitle,
				"name":       u.Name,
				"password":   string(hashed),
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
	// v3 시드 마커 확인 — 백서 기반 구조
	var v3Count int64
	config.DB.Model(&models.WikiArticle{}).Where("part_title = ?", "서문 — 세 개의 자석").Count(&v3Count)
	if v3Count > 0 {
		return
	}
	// 기존 잔여 데이터 정리
	var existing int64
	config.DB.Model(&models.WikiArticle{}).Count(&existing)
	if existing > 0 {
		config.DB.Exec("DELETE FROM wiki_revisions")
		config.DB.Exec("DELETE FROM wiki_articles")
		log.Println("[seed] Hestory v3: 기존 위키 초기화")
	}

	type s struct {
		P  int; PT string; C int; CT string; S string; T string; A string
	}
	data := []s{
		// ═══ 서문 — 세 개의 자석 ═══
		{0,"서문 — 세 개의 자석",0,"서문","P.1","왜 지금 이 문제인가","ceo"},
		{0,"서문 — 세 개의 자석",0,"서문","P.2","세 개의 자석 — OTA·직거래·HIERO","ceo"},
		{0,"서문 — 세 개의 자석",0,"서문","P.3","기능 앱과 운영 OS의 차이","cto"},
		{0,"서문 — 세 개의 자석",0,"서문","P.4","이 백서를 읽는 방법","cto"},

		// ═══ Part 0. 온톨로지 ═══
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",1,"온톨로지","0.1","온톨로지란 무엇인가","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",1,"온톨로지","0.2","왜 숙박·중단기 임대에 온톨로지가 필요한가","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",2,"4대 온톨로지 레이어","0.3a","공간 Ontology — 건물, 호실, 생활권, 운영상태","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",2,"4대 온톨로지 레이어","0.3b","인간 Ontology — 거주자, 체류패턴, 감성, 관계","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",2,"4대 온톨로지 레이어","0.3c","운영 Ontology — 청소, 비용, 가격, KPI, 액션","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",2,"4대 온톨로지 레이어","0.3d","도시 Ontology — 권역, 생활권, 교통, 상권","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",3,"엔티티와 선언","0.4","핵심 엔티티 15개와 상태값","cto"},
		{1,"온톨로지 — 세계를 어떻게 구조화할 것인가",3,"엔티티와 선언","0.5","형태를 규제하되 기능을 해방한다","cto"},

		// ═══ Part 1. SPACE ═══
		{2,"SPACE — 공간 온톨로지",4,"공간의 문제","1.1","숙소는 토지다 — 도시계획가의 관점","ceo"},
		{2,"SPACE — 공간 온톨로지",4,"공간의 문제","1.2","Property 모델 — 숙소를 어떻게 정의했는가","cto"},
		{2,"SPACE — 공간 온톨로지",5,"권역과 등급","1.3","14권역 설계 — Neighborhood Unit으로 나눈 서울","cto"},
		{2,"SPACE — 공간 온톨로지",5,"권역과 등급","1.4","숙소 등급 체계 — FBC Transect T1→T6","cto"},
		{2,"SPACE — 공간 온톨로지",6,"공간 데이터","1.5","공간 데이터가 만드는 도시 인사이트","cto"},

		// ═══ Part 2. PEOPLE ═══
		{3,"PEOPLE — 인간 온톨로지",7,"게스트","2.1","게스트는 도시의 주민이다","operations"},
		{3,"PEOPLE — 인간 온톨로지",7,"게스트","2.2","메시지 분석 — 42,568건이 말하는 것","cto"},
		{3,"PEOPLE — 인간 온톨로지",7,"게스트","2.3","통화 분석 — 1,129건, 전화가 오는 순간의 의미","cto"},
		{3,"PEOPLE — 인간 온톨로지",8,"게스트 경험","2.4","게스트 멘탈맵 — Lynch 5요소 적용","cto"},
		{3,"PEOPLE — 인간 온톨로지",8,"게스트 경험","2.5","운영팀 — 도시의 시민들","ceo"},

		// ═══ Part 3. FLOW ═══
		{4,"FLOW — 데이터가 흐르는 길",9,"원본과 동기화","3.1","Hostex는 예약의 원본이다","cto"},
		{4,"FLOW — 데이터가 흐르는 길",9,"원본과 동기화","3.2","이중 동기화 — API와 Webhook의 역할 분담","cto"},
		{4,"FLOW — 데이터가 흐르는 길",10,"정합성과 증명","3.3","동기화 정합성 — Dynamo에서 배운 것","cto"},
		{4,"FLOW — 데이터가 흐르는 길",10,"정합성과 증명","3.4","Proof of Operation — 상태 전환에 실행 증거를 붙인다","cto"},
		{4,"FLOW — 데이터가 흐르는 길",10,"정합성과 증명","3.5","Smart Operation — 조건 충족 시 자동 실행","cto"},

		// ═══ Part 4. TURNOVER ═══
		{5,"TURNOVER — 현장 운영 엔진",11,"청소의 본질","4.1","청소는 도시의 신진대사다","cleaning_dispatch"},
		{5,"TURNOVER — 현장 운영 엔진",11,"청소의 본질","4.2","Operation Unit — Corbusier Modulor의 운영 번역","cto"},
		{5,"TURNOVER — 현장 운영 엔진",12,"권역과 청소자","4.3","14권역 × 22명 청소자 — 자급 운영 단위","cleaning_dispatch"},
		{5,"TURNOVER — 현장 운영 엔진",12,"권역과 청소자","4.4","자동 배정 알고리즘","cto"},
		{5,"TURNOVER — 현장 운영 엔진",12,"권역과 청소자","4.5","모바일 앱 — 청소자의 인터페이스","cto"},

		// ═══ Part 5. ECONOMY ═══
		{6,"ECONOMY — 돈의 흐름",13,"재정의 원칙","5.1","정산은 도시의 재정이다","cfo"},
		{6,"ECONOMY — 돈의 흐름",13,"재정의 원칙","5.2","데이터 3층 구조 — 신뢰할 수 있는 숫자의 원천","cto"},
		{6,"ECONOMY — 돈의 흐름",14,"정산과 세무","5.3","Settlement P&L — 숙소별 손익 자동 계산","cfo"},
		{6,"ECONOMY — 돈의 흐름",14,"정산과 세무","5.4","세무 분류 자동화","cfo"},
		{6,"ECONOMY — 돈의 흐름",14,"정산과 세무","5.5","재무 대시보드 — CFO 관점","cfo"},

		// ═══ Part 6. RISK ═══
		{7,"RISK — 위기 관리 체계",15,"위기의 패턴","6.1","위기는 예고 없이 온다 — 그러나 패턴이 있다","operations"},
		{7,"RISK — 위기 관리 체계",15,"위기의 패턴","6.2","HS 3-Tier 에스컬레이션 체계","cto"},
		{7,"RISK — 위기 관리 체계",16,"감지와 대응","6.3","이슈 감지 파이프라인","cto"},
		{7,"RISK — 위기 관리 체계",16,"감지와 대응","6.4","CS Knowledge Base — 위기를 학습으로","cto"},
		{7,"RISK — 위기 관리 체계",16,"감지와 대응","6.5","Ops Feed & Ops Pulse — 운영의 눈","operations"},

		// ═══ Part 7. INTELLIGENCE ═══
		{8,"INTELLIGENCE — OS의 두뇌",17,"판단의 구조","7.1","Attention Mechanism — 가장 중요한 것에 집중","cto"},
		{8,"INTELLIGENCE — OS의 두뇌",17,"판단의 구조","7.2","5엔진 진단 — 25개 지표로 보는 건강","cto"},
		{8,"INTELLIGENCE — OS의 두뇌",18,"의사결정 시스템","7.3","ETF Board — 세 관점의 동시 통치","cto"},
		{8,"INTELLIGENCE — OS의 두뇌",18,"의사결정 시스템","7.4","AI Agent — Pattern 205가 구현된 방식","cto"},
		{8,"INTELLIGENCE — OS의 두뇌",19,"지식 시스템","7.5","Hestory — 운영 지식의 그린벨트","cto"},

		// ═══ Part 8. BUSINESS ═══
		{9,"BUSINESS — 지속가능한 구조",20,"수익 모델","8.1","내부 운영 효율화 모델","ceo"},
		{9,"BUSINESS — 지속가능한 구조",20,"수익 모델","8.2","외부 SaaS 모델 — 타 운영사 라이선스","ceo"},
		{9,"BUSINESS — 지속가능한 구조",20,"수익 모델","8.3","데이터 플랫폼 모델","ceo"},
		{9,"BUSINESS — 지속가능한 구조",21,"영업과 확장","8.4","위탁영업 CRM — 신규 숙소 유치","marketing"},
		{9,"BUSINESS — 지속가능한 구조",21,"영업과 확장","8.5","HIERO Guide — 게스트 향 앱의 가능성","cto"},

		// ═══ Part 9. HORIZON ═══
		{10,"HORIZON — 다음 도시로",22,"확장","9.1","Social Cities — 하나의 도시에서 군집으로","ceo"},
		{10,"HORIZON — 다음 도시로",22,"확장","9.2","300채 로드맵 — 계획적 성장의 조건","ceo"},
		{10,"HORIZON — 다음 도시로",23,"생태계","9.3","플랫폼 생태계 — 오너·운영자·청소자·게스트","ceo"},
		{10,"HORIZON — 다음 도시로",23,"생태계","9.4","The Future of Seoul — 도시 운영 데이터의 가능성","cto"},

		// ═══ Part 10. THEORY ═══
		{11,"THEORY — 이론적 기반",24,"이론","10.1","도시계획 사조 계보와 HIERO의 위치","cto"},
		{11,"THEORY — 이론적 기반",24,"이론","10.2","기술 백서 계보와 HIERO의 위치","cto"},
		{11,"THEORY — 이론적 기반",24,"이론","10.3","인문학 계보와 HIERO의 위치","cto"},
		{11,"THEORY — 이론적 기반",24,"이론","10.4","HIERO의 핵심 명제 — 선언문","cto"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.1","도시계획가가 OS를 만드는 이유","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.2","끊어진 연결 — 비전은 있으나 실행이 없다","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.3","숙소 100채라는 작은 도시","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.4","온톨로지가 답이다","cto"},

		// ═══ 부록 ═══
		{99,"부록",90,"부록","A","핵심 지표 정의 glossary","cto"},
		{99,"부록",90,"부록","B","API 엔드포인트 목록","cto"},
		{99,"부록",90,"부록","C","데이터베이스 스키마 (핵심 테이블)","cto"},
		{99,"부록",90,"부록","D","참고문헌 9종 원문 및 번역","cto"},
		{99,"부록",90,"부록","E","HIERO 다이어그램 모음","cto"},
	}
	for i, d := range data {
		config.DB.Create(&models.WikiArticle{
			PartNumber: d.P, PartTitle: d.PT, Chapter: d.C, ChapterTitle: d.CT,
			Section: d.S, Title: d.T, Status: "empty", AssignedTo: d.A, SortOrder: i,
		})
	}
	log.Printf("[seed] Hestory v3 (백서 기반): %d건 목차 생성 완료", len(data))
}
