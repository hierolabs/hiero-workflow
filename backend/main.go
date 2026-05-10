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
	)

	config.DB.AutoMigrate(
		&models.Task{},
		&models.AdminUser{},
		&models.ActivityLog{},
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
		&models.ArchivingJob{},
		&models.ArticleReview{},
		&models.ETFDirective{},
		&models.GOTReport{},
		&models.GOTAlert{},
		&models.DailyTaskCheck{},
		&models.DevProject{},
		&models.DevMilestone{},
	)
	seedAdminUser()
	service.SeedCSKnowledge()
	seedProperties()
	seedDiagnosisSample()
	seedChatChannels()
	service.SeedCleaningCodes()
	service.SeedCleaners()
	seedWikiArticles()
	seedMoroWikiArticles()
	seedDevProjects()

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

func seedMoroWikiArticles() {
	// MORO 위키 마커 확인
	var moroCount int64
	config.DB.Model(&models.WikiArticle{}).Where("section = ?", "9.5").Count(&moroCount)
	if moroCount > 0 {
		return
	}

	// 기존 위키 마지막 sort_order 가져오기
	var maxSort int
	config.DB.Model(&models.WikiArticle{}).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)

	type s struct {
		P int; PT string; C int; CT string; S string; T string; A string
	}
	data := []s{
		{10, "HORIZON — 다음 도시로", 25, "MORO — 동네 안착 OS", "9.5", "MORO Positioning — 동네 탐색→안착 전담 구간", "cto"},
		{10, "HORIZON — 다음 도시로", 25, "MORO — 동네 안착 OS", "9.6", "중간영역 이론 — 집 밖 10분이 결정한다", "cto"},
		{10, "HORIZON — 다음 도시로", 25, "MORO — 동네 안착 OS", "9.7", "MORO Score Stack 7종 — Walk·Transit·Café·Safe·Bike·Run·Bakery", "cto"},
		{10, "HORIZON — 다음 도시로", 25, "MORO — 동네 안착 OS", "9.8", "페르소나 가중치 — 같은 동네, 다른 점수", "cto"},
		{10, "HORIZON — 다음 도시로", 26, "MORO — 레퍼런스와 프레임", "9.9", "5개 도시 벤치마크 — San Sebastián·Düsseldorf·Bologna·Basel·Almere", "cto"},
		{10, "HORIZON — 다음 도시로", 26, "MORO — 레퍼런스와 프레임", "9.10", "8개 레퍼런스 — AreaVibes·Walk Score·Sony CSL·GOAT 외", "cto"},
		{10, "HORIZON — 다음 도시로", 26, "MORO — 레퍼런스와 프레임", "9.11", "Take·Own·Differ — 벤치마킹 전략", "cto"},
		{10, "HORIZON — 다음 도시로", 27, "MORO — 4 Layer 프레임", "9.12", "4 Layer 구조 — L1 포기불가·L2 골목바이브·L3 외부연결·L4 비용리스크", "cto"},
		{10, "HORIZON — 다음 도시로", 27, "MORO — 4 Layer 프레임", "9.13", "레이어 구성 상세 — 지표·데이터출처·시각화", "cto"},
		{10, "HORIZON — 다음 도시로", 27, "MORO — 4 Layer 프레임", "9.14", "One Screen — 한 화면에서 4 Layer가 보이는 법", "cto"},
		{10, "HORIZON — 다음 도시로", 28, "MORO — MVP와 기술", "9.15", "5-Step User Journey — 동네발견→매물도킹", "cto"},
		{10, "HORIZON — 다음 도시로", 28, "MORO — MVP와 기술", "9.16", "데이터소스 9종 — 외부 의존도가 곧 리스크", "cto"},
		{10, "HORIZON — 다음 도시로", 28, "MORO — MVP와 기술", "9.17", "MVP 8주 스코프 — 강동구 한 권역으로 좁히기", "cto"},
		{10, "HORIZON — 다음 도시로", 28, "MORO — MVP와 기술", "9.18", "기술스택 결정 — Bubble vs Code vs 하이브리드", "cto"},
	}
	for i, d := range data {
		config.DB.Create(&models.WikiArticle{
			PartNumber: d.P, PartTitle: d.PT, Chapter: d.C, ChapterTitle: d.CT,
			Section: d.S, Title: d.T, Status: "empty", AssignedTo: d.A, SortOrder: maxSort + i + 1,
		})
	}
	log.Printf("[seed] MORO 위키 아티클 %d건 추가 완료", len(data))
}

func seedDevProjects() {
	type ms struct {
		N string; D string; Cat string; Ph string; W int; Ord int
	}

	// 가짜 done 상태 일괄 리셋 (1회성)
	var doneCount int64
	config.DB.Model(&models.DevMilestone{}).Where("status = ?", "done").Count(&doneCount)
	if doneCount > 0 {
		config.DB.Model(&models.DevMilestone{}).Where("status = ?", "done").Update("status", "not_started")
		config.DB.Model(&models.DevMilestone{}).Where("status = ?", "in_progress").Update("status", "not_started")
		log.Printf("[seed] DevMilestone 가짜 상태 %d건 → not_started 리셋", doneCount)
	}

	// ── MORO ──
	var moroExists int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "moro").Count(&moroExists)
	if moroExists == 0 {
	moro := models.DevProject{
		Name:        "MORO — 동네 안착 OS",
		Code:        "moro",
		Description: "중기임대 시대의 동네 라이프스타일 OS. 7개 Score Stack + 4 Layer + 페르소나 가중치로 동네를 매칭하고, HIERO 매물과 도킹.",
		Status:      models.DevProjectStatusPlanning,
		OwnerRole:   "cto",
		Phase:       "mvp",
		StartDate:   "2026-05-02",
		TargetDate:  "2026-06-27",
		WeekCount:   8,
	}
	config.DB.Create(&moro)
	milestones := []ms{
		// ── Score Stack (7종) ──
		{"Walk Score 구현", "중간영역 보행 품질 — 가로수·벤치·보행안전성·골목 다양성", "score", "P1", 4, 1},
		{"Transit Score 구현", "맞춤 통근 — 카카오맵 API 경로탐색 + TAGO 교통DB", "score", "P1", 5, 2},
		{"Café Score 구현", "혼자 시간 보내기 — 독립카페 비율·밀도·심야영업·3년+운영", "score", "P1", 4, 3},
		{"Safe Score 구현", "밤 10시 귀갓길 — 가로등·CCTV·파출소 밀도 가중", "score", "P1", 4, 4},
		{"Bike Score 구현", "따릉이 생활권 — 대여소 위치·자전거도로", "score", "P2", 0, 5},
		{"Run Score 구현", "퇴근 후 러닝 루트 — 공원·하천 연결", "score", "P2", 0, 6},
		{"Bakery Score 구현", "아침 루틴 — 3년+ 운영 빵집·아침영업", "score", "P2", 0, 7},

		// ── 4 Layer ──
		{"L1 포기불가 레이어", "경사도(DEM) + 야간안전 + 의료접근 + 층/반지하 필터. 여기서 통과 못하면 다른 매력 무의미.", "layer", "P1", 4, 10},
		{"L2 골목 바이브 레이어", "Café+Bakery+Walk Score + 골목다양성. 중간영역 이론 기반. 모로의 핵심 차별점.", "layer", "P1", 4, 11},
		{"L3 외부 연결 레이어", "Transit+Bike+Run Score + 등시권 polygon. 직장 입력 시 활성화.", "layer", "P1", 5, 12},
		{"L4 비용·리스크 레이어", "예상 월비용 + 보증금 + 전세사기 위험 + 침수·노후도. 한국 미드텀 특화.", "layer", "P1", 6, 13},

		// ── 데이터소스 연동 (9종) ──
		{"경사도·DEM 데이터 전처리", "국토지리정보원 DEM 다운로드 + 격자별 평균 경사도 사전계산", "data", "P1", 3, 20},
		{"서울 공공데이터 연동", "가로등·CCTV·파출소·병의원·약국 API → DB 캐싱", "data", "P1", 3, 21},
		{"카카오 로컬 API 연동", "POI·운영시간·평점 — 호출한도 관리 + 캐싱 전략", "data", "P1", 4, 22},
		{"카카오 맵 경로탐색 연동", "실시간 통근시간 + 등시권 polygon 생성", "data", "P1", 5, 23},
		{"TAGO 교통DB 연동", "버스·지하철 노선 접근성", "data", "P1", 5, 24},
		{"따릉이 API 연동", "대여소 위치·자전거도로 데이터", "data", "P2", 0, 25},
		{"서울 상권분석 데이터", "우리마을가게 상권 — 매출·점포·업종 데이터", "data", "P1", 4, 26},
		{"가로수·공원 GIS 데이터", "서울 열린데이터 — 녹지·벤치 레이어", "data", "P1", 4, 27},
		{"HIERO 매물 인벤토리 연결", "100채 매물 메타 — 가격·층·즉시입주 여부", "data", "P1", 6, 28},

		// ── UI/UX ──
		{"온보딩 퀴즈 (Step 1)", "직장 주소·라이프스타일 4~6문항 → 페르소나 가중치 산출", "ui", "P1", 3, 30},
		{"생존지표 선택 (Step 2)", "포기불가 조건 체크 UI — 경사·반지하·안전·층 필터", "ui", "P1", 4, 31},
		{"H3 격자 지도 + 레이어 토글", "Mapbox/Kakao SDK + H3 hexagon 색칠 + L1~L4 ON/OFF", "ui", "P1", 5, 32},
		{"동네 결과 페이지 (One Screen)", "학점(A~F) + 7축 레이더 + 4 Layer 학점 + 매물 도킹 한 화면", "ui", "P1", 6, 33},
		{"등시권 polygon 오버레이", "직장 입력 → 30분 통근권 polygon → 범위 밖 격자 제외", "ui", "P1", 5, 34},
		{"골목 맥싱 (라이트)", "좋아하는 골목 저장 기능 — MVP 최소 버전", "ui", "P1", 7, 35},
		{"매물 매칭 카드 (Step 4)", "추천 동네 내 HIERO 매물 카드 + 상담 신청 폼 (Step 5)", "ui", "P1", 6, 36},

		// ── 인프라/기술스택 ──
		{"기술스택 최종 결정", "Bubble vs Next.js+Python vs 하이브리드 — 개발자 미팅 결과 반영", "infra", "P1", 1, 40},
		{"H3 격자 사전계산 파이프라인", "강동구 250m 격자 ≈ 100~150셀, 7개 점수 raw value 격자별 사전계산", "infra", "P1", 3, 41},
		{"PostGIS + 공간 쿼리 셋업", "격자 단위 공간 연산 + 등시권 계산 인프라", "infra", "P1", 3, 42},
		{"페르소나 가중치 엔진", "클라이언트 즉시 합산 — 슬라이더 변경 시 0.1초 내 격자 재렌더", "infra", "P1", 4, 43},

		// ── 기술 의사결정 ──
		{"격자 사전계산 vs 실시간 호출", "스코어를 동별 사전 계산 vs 사용자 요청 시 실시간. 카카오/TAGO는 통근만 실시간.", "decision", "P1", 1, 50},
		{"페르소나 매핑 방식", "온보딩 퀴즈 자동매핑 vs 직접 가중치 조절 vs 둘 다(디폴트+슬라이더)", "decision", "P1", 2, 51},
		{"강동구 데이터 범위 확정", "MVP 파일럿 강동구 — 어느 행정동까지, 격자 해상도, POI 범위", "decision", "P1", 1, 52},
		{"학점 임계값 매핑", "90+ A, 80+ B, ... 임계값 확정 + 페르소나별 학점 차이 UX 검증", "decision", "P1", 3, 53},
		{"Methodology 페이지 초안", "모로 점수 계산 방법 투명 공개 — AreaVibes 참조 — 신뢰 자산", "decision", "P1", 7, 54},
	}

	for _, m := range milestones {
		config.DB.Create(&models.DevMilestone{
			ProjectID:   moro.ID,
			Name:        m.N,
			Description: m.D,
			Category:    m.Cat,
			Status:      models.MilestoneStatusNotStarted,
			Phase:       m.Ph,
			DueWeek:     m.W,
			SortOrder:   m.Ord,
		})
	}
	log.Printf("[seed] MORO 프로젝트 + %d개 마일스톤 생성 완료", len(milestones))
	} // end moro

	// ══════════════════════════════════════════
	// 띵동(ThingDone) — 청소·정산 SaaS
	// ══════════════════════════════════════════
	var tdCount int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "thingdone").Count(&tdCount)
	if tdCount == 0 {
		td := models.DevProject{
			Name: "띵동(ThingDone) — 청소·정산 SaaS", Code: "thingdone",
			Description: "Hostex 체크아웃→청소배정→사진→정산→KPI 자동화. 12단계 중 1~6 완료.",
			Status: models.DevProjectStatusActive, OwnerRole: "cto", Phase: "mvp",
			StartDate: "2026-04-28", TargetDate: "2026-06-27", WeekCount: 8,
		}
		config.DB.Create(&td)
		tdMs := []ms{
			{"청소코드 DB화 (112건)", "18개 권역(A~V), 단가체계(10k~50k원)", "data", "P1", 1, 1},
			{"청소자 DB화 (22명)", "다중권역, 가용요일, 이동수단, 로그인 계정", "data", "P1", 1, 2},
			{"체크아웃→CleaningTask 자동생성", "Hostex 체크아웃 기준, 연장감지, 단가 자동연결", "infra", "P1", 2, 3},
			{"우선순위 자동분류", "urgent(당일체크인)/normal(내일)/low(없음)", "infra", "P1", 2, 4},
			{"Cleaning Manager Dashboard", "권역별/전체 뷰, 워크로드 바, 미배정 경고, 연장알림", "ui", "P1", 3, 5},
			{"청소자 모바일 로그인+API", "JWT 인증, 내 배정, 시작/완료/문제, 주간 지급액", "ui", "P1", 3, 6},
			{"배정 메시지 자동 생성", "숙소명·주소·체크아웃시간·다음체크인·특이사항 텍스트 생성", "infra", "P1", 5, 7},
			{"비포/애프터 사진 업로드", "청소자 모바일 사진 촬영→업로드, CleaningTask 연결", "ui", "P1", 6, 8},
			{"문제→유지보수 이슈 전환", "청소 중 발견 문제 → Issue 자동 전환", "infra", "P1", 6, 9},
			{"추가비 입력", "소모품·택시비·기상악화 건별 추가비용 기록", "ui", "P1", 7, 10},
			{"주간 정산 자동 생성", "청소자별 주간 건수×단가+추가비 = 지급액 집계", "infra", "P1", 7, 11},
			{"KPI 대시보드", "자동생성률, 배정완료율, 체크인전완료율, 사진업로드율, 미처리이슈", "ui", "P1", 8, 12},
		}
		for _, m := range tdMs {
			config.DB.Create(&models.DevMilestone{
				ProjectID: td.ID, Name: m.N, Description: m.D, Category: m.Cat,
				Status: models.MilestoneStatusNotStarted, Phase: m.Ph, DueWeek: m.W, SortOrder: m.Ord,
			})
		}
		log.Println("[seed] ThingDone 프로젝트 + 12개 마일스톤")
	}

	// ══════════════════════════════════════════
	// HIERO 데이터 파이프라인
	// ══════════════════════════════════════════
	var dpCount int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "data-pipeline").Count(&dpCount)
	if dpCount == 0 {
		dp := models.DevProject{
			Name: "데이터 파이프라인 — 매출·비용·정산", Code: "data-pipeline",
			Description: "Hostex CSV→DB, 비용 1/n 분할, 월간 P&L 자동집계, 5엔진 진단 데이터 파이프라인",
			Status: models.DevProjectStatusActive, OwnerRole: "cto", Phase: "v1",
			StartDate: "2026-05-01", TargetDate: "2026-06-30", WeekCount: 8,
		}
		config.DB.Create(&dp)
		dpMs := []ms{
			{"Hostex CSV 임포트 (12,990건)", "hostex_transactions 16개월 데이터, CSV가 유일한 신뢰소스", "data", "P1", 1, 1},
			{"property_costs 엑셀→DB (79행)", "월세/관리비/계약 3개 엑셀 파싱", "data", "P1", 2, 2},
			{"cost_raw 마이그레이션 (5,166행)", "hostex_transactions 비용 항목 분리", "data", "P1", 2, 3},
			{"cost_allocations 일할분배 (6,823행)", "비용 1/n 분할, 원본추적, 15.2억원", "data", "P1", 2, 4},
			{"monthly_property_reports (1,401행)", "17개월×숙소별 P&L 자동집계", "data", "P1", 3, 5},
			{"market_prices 삼삼엠투 (211행)", "92개 숙소 크롤링→DB", "data", "P1", 3, 6},
			{"5엔진 진단 데이터 연동", "property_costs+transactions→25개 지표 자동계산", "infra", "P1", 3, 7},
			{"매출 과세/면세 4분류", "단기과세/중기과세/중기면세/서비스매출, DATEDIFF<29 기준", "infra", "P1", 4, 8},
			{"CFO Data 1/2/3 페이지 분리", "매출(Data1)/비용(Data2)/수익성(Data3) 독립 페이지", "ui", "P1", 5, 9},
			{"Go cron 스케줄러", "매월 monthly_reports 자동생성, 매주 market 갱신", "infra", "P1", 6, 10},
			{"Settlement API gross=0 수정", "기존 정산 집계 버그", "infra", "P1", 6, 11},
			{"property_costs CRUD UI", "숙소별 소유구조/월세/위탁료/공과금 입력 화면", "ui", "P1", 7, 12},
			{"hostex_transactions 308건 중복 클린업", "CSV 중복 업로드 데이터 정리", "data", "P1", 7, 13},
		}
		for _, m := range dpMs {
			config.DB.Create(&models.DevMilestone{
				ProjectID: dp.ID, Name: m.N, Description: m.D, Category: m.Cat,
				Status: models.MilestoneStatusNotStarted, Phase: m.Ph, DueWeek: m.W, SortOrder: m.Ord,
			})
		}
		log.Println("[seed] 데이터 파이프라인 프로젝트 + 13개 마일스톤")
	}

	// ══════════════════════════════════════════
	// 아카이빙 & 콘텐츠 파이프라인
	// ══════════════════════════════════════════
	var arCount int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "archiving").Count(&arCount)
	if arCount == 0 {
		ar := models.DevProject{
			Name: "아카이빙 — Hestory 위키 & 콘텐츠", Code: "archiving",
			Description: "세션→TAB 1~4→주간 TAB 5~7→월간 검수→발행. 8-TAB 파이프라인 + 다관점 AI 평가 + 콘텐츠 변환",
			Status: models.DevProjectStatusActive, OwnerRole: "cto", Phase: "v1",
			StartDate: "2026-05-10", TargetDate: "2026-07-31", WeekCount: 12,
		}
		config.DB.Create(&ar)
		arMs := []ms{
			{"TAB 1~4 자동 생성 (세션→위키)", "OpenAI gpt-4o-mini로 세션 요약→4탭 자동 채움", "infra", "P1", 1, 1},
			{"TAB 5~7 주간 자동 생성", "세션 TABs 1~4 종합→에세이/학술/블로그 변환", "infra", "P1", 2, 2},
			{"다관점 AI 평가 (5관점)", "투자자/학자/운영자/독자/개발자 관점별 10점 평가", "infra", "P1", 2, 3},
			{"위키 69개 중 50개 TAB 채움 (72%)", "자동+수동 혼합으로 기본 콘텐츠 확보", "data", "P1", 3, 4},
			{"글쓰기 맥락 강화", "아티클별 독립 TAB + 앞뒤 3개 맥락 + 반복금지 5규칙", "infra", "P1", 3, 5},
			{"AI 기반 재작성", "평가자 선택→보완 방향 반영→자동 리라이팅", "infra", "P1", 3, 6},
			{"자유 글쓰기 모드 (포커스)", "전체화면 3단계 편집 모드", "ui", "P1", 3, 7},
			{"위키 순서 네비게이션", "1~69 순번 + 프로그레스 바 + 이전/다음", "ui", "P1", 3, 8},
			{"나머지 19개 아티클 채우기", "Part 0 서문/Part 1 온톨로지 중심 미채움 콘텐츠", "data", "P1", 5, 9},
			{"TAB 5~7 주간 자동실행 검증", "매주 금 18:00 스케줄 실행 + 결과 품질 확인", "infra", "P1", 5, 10},
			{"맥락 반영 전체 재생성 (50개)", "50개 아티클 맥락 흐름 보정 일괄 재생성", "data", "P1", 6, 11},
			{"블로그 변환 파이프라인", "TAB 5→블로그 글→자동 발행 구조", "infra", "P2", 8, 12},
			{"에세이/논문 변환", "TAB 6→학술 에세이, TAB 7→강의/백서 변환", "infra", "P2", 10, 13},
			{"월간 TAB 8 Founder 검수", "매월 1일 자동 알림→Founder 리뷰→published", "infra", "P2", 12, 14},
		}
		for _, m := range arMs {
			config.DB.Create(&models.DevMilestone{
				ProjectID: ar.ID, Name: m.N, Description: m.D, Category: m.Cat,
				Status: models.MilestoneStatusNotStarted, Phase: m.Ph, DueWeek: m.W, SortOrder: m.Ord,
			})
		}
		log.Println("[seed] 아카이빙 프로젝트 + 14개 마일스톤")
	}

	// ══════════════════════════════════════════
	// AI Agent & 자동화
	// ══════════════════════════════════════════
	var aiCount int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "ai-agent").Count(&aiCount)
	if aiCount == 0 {
		ai := models.DevProject{
			Name: "AI Agent — 페이지별 지능 + HS 자동화", Code: "ai-agent",
			Description: "GPT-4o-mini 페이지별 Agent + 3단계 기억 + HS 자동처리율 KPI",
			Status: models.DevProjectStatusActive, OwnerRole: "cto", Phase: "v1",
			StartDate: "2026-05-07", TargetDate: "2026-07-31", WeekCount: 12,
		}
		config.DB.Create(&ai)
		aiMs := []ms{
			{"페이지별 AI Agent (8페이지)", "각 페이지 컨텍스트에 맞는 Agent 프롬프트", "infra", "P1", 1, 1},
			{"대화 저장 + 복원", "ai_conversations DB, 새로고침 후 복원", "infra", "P1", 1, 2},
			{"크로스페이지 인사이트 공유", "다른 페이지 Agent 인사이트 최근 7일분 자동 주입", "infra", "P1", 1, 3},
			{"장기기억 자동 요약", "[인사이트] 태그 추출 + 10턴마다 대화 요약→ai_memories", "infra", "P1", 2, 4},
			{"HS 3-Tier 에스컬레이션", "HS=자동처리, human=사람개입, escalated=민원전달", "infra", "P1", 3, 5},
			{"이슈 감지 파이프라인", "감지→대응→해결, 42,568건 메시지 분석 기반", "infra", "P1", 3, 6},
			{"CS Knowledge Base (1,129건)", "통화분석 6대 카테고리, FAQ/대응 프로세스 DB", "data", "P1", 3, 7},
			{"GOT 5차원 이상감지", "비용급증/매출급감/현금갭/중복거래/환불급증", "infra", "P1", 4, 8},
			{"GOT 자동보고 (일/주/월)", "got_reports 스케줄 자동생성, Founder 대시보드 연동", "infra", "P1", 4, 9},
			{"메시지 자동 응답 (HS)", "게스트 문의 자동 분류→템플릿 응답→HS율 KPI", "infra", "P2", 6, 10},
			{"이상감지 → 자동 이슈 생성", "감지 결과→Issue 자동 생성→배정→에스컬레이션", "infra", "P2", 8, 11},
			{"AI 7레벨 성숙도 L5→L6", "리포트 자동 생성(L7) + 의사결정 제안(L5→L6)", "decision", "P2", 10, 12},
		}
		for _, m := range aiMs {
			config.DB.Create(&models.DevMilestone{
				ProjectID: ai.ID, Name: m.N, Description: m.D, Category: m.Cat,
				Status: models.MilestoneStatusNotStarted, Phase: m.Ph, DueWeek: m.W, SortOrder: m.Ord,
			})
		}
		log.Println("[seed] AI Agent 프로젝트 + 12개 마일스톤")
	}

	// ══════════════════════════════════════════
	// HIERO 운영 OS 플랫폼
	// ══════════════════════════════════════════
	var platCount int64
	config.DB.Model(&models.DevProject{}).Where("code = ?", "hiero-platform").Count(&platCount)
	if platCount == 0 {
		plat := models.DevProject{
			Name: "HIERO 운영 OS — 핵심 플랫폼", Code: "hiero-platform",
			Description: "GOT→ETF→Execution 3계층 + 5엔진 진단 + 멀티플랫폼 + 숙소 라이프사이클",
			Status: models.DevProjectStatusActive, OwnerRole: "cto", Phase: "v2",
			StartDate: "2026-04-01", TargetDate: "2026-08-31", WeekCount: 20,
		}
		config.DB.Create(&plat)
		platMs := []ms{
			{"GOT→ETF→Execution 3계층 지시체계", "Founder관제탑→ETF의사결정→현장실행, directive/report/lateral", "infra", "P1", 3, 1},
			{"5엔진 진단 (25개 지표)", "매출/운영/CS/비용/성장 × 5지표, 자동15+수동10", "infra", "P1", 2, 2},
			{"CEO/CTO/CFO Board", "역할별 대시보드, 도메인 기반 업무 분배", "ui", "P1", 3, 3},
			{"Founder Dashboard", "GOT 관제탑, 재무보고(Data1/2/3), 알림 상태추적", "ui", "P1", 4, 4},
			{"Team 페이지 + KPI 드릴다운", "조직도, 역할별 업무, KPI 7항목 드릴다운", "ui", "P1", 4, 5},
			{"알림 상태추적 (팝업→접힘)", "got_alerts new→acknowledged/forwarded, 처리후 축소", "infra", "P1", 4, 6},
			{"RBAC 권한 시스템", "9명 계정, 8역할, 47권한, RoleGuard", "infra", "P1", 5, 7},
			{"팀 내부 채팅", "ChatChannel + ChatMessage, 이슈 연결 대화방", "ui", "P1", 5, 8},
			{"멀티플랫폼 통합관리", "삼삼엠투/리브/자리톡 수동예약+대화분석+AI답변 3Phase", "infra", "P2", 8, 9},
			{"숙소 공급 라이프사이클", "Lead→Active 9단계, ETA Engine, 병목감지", "infra", "P2", 10, 10},
			{"Hostex 가격 연동 + PriceLabs 캐시", "동적가격 모니터링, 가격가이드라인", "data", "P2", 12, 11},
			{"예약코드 온톨로지", "예약코드=상태전환 트리거, HS자동화 연결", "decision", "P2", 12, 12},
			{"자본구조 6축 시뮬레이터", "자본부족→6대 의사결정 축 시뮬레이션", "ui", "P2", 15, 13},
			{"조직도 시각화", "GOT/ETF/Execution 3계층 인터랙티브 조직도", "ui", "P2", 15, 14},
		}
		for _, m := range platMs {
			config.DB.Create(&models.DevMilestone{
				ProjectID: plat.ID, Name: m.N, Description: m.D, Category: m.Cat,
				Status: models.MilestoneStatusNotStarted, Phase: m.Ph, DueWeek: m.W, SortOrder: m.Ord,
			})
		}
		log.Println("[seed] HIERO 플랫폼 프로젝트 + 14개 마일스톤")
	}
}
