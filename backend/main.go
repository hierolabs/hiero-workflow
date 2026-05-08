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
	// v2 시드 마커 확인 — 이미 v2로 전환됐으면 스킵
	var v2Count int64
	config.DB.Model(&models.WikiArticle{}).Where("part_title = ?", "PROLOGUE — 프롤로그").Count(&v2Count)
	if v2Count > 0 {
		return // 이미 v2 시드 완료
	}

	// 기존 데이터 전체 삭제 후 새 구조로 재생성
	config.DB.Exec("DELETE FROM wiki_revisions")
	config.DB.Exec("DELETE FROM wiki_articles")
	log.Println("[seed] Hestory v2: 기존 위키 초기화 완료")

	type s struct {
		P  int; PT string; C int; CT string; S string; T string; A string
	}
	data := []s{
		// ═══ Part 0. PROLOGUE — 프롤로그 ═══
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.0","도시계획의 구조와 가치 — 기본계획, 관리계획, 부문별 체계","cto"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.1","도시계획가가 OS를 만드는 이유","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.2","끊어진 연결 — 비전은 있으나 실행이 없다","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.3","숙소 100채라는 작은 도시","ceo"},
		{0,"PROLOGUE — 프롤로그",0,"Urban Planning × OS","0.4","온톨로지가 답이다","cto"},

		// ═══ Part 1. SPACE — 공간 ═══
		{1,"SPACE — 공간",1,"토지이용과 공간 관리","1.0","토지이용계획의 가치 — 용도지역, 공간 위계, 상태 관리","cto"},
		{1,"SPACE — 공간",1,"토지이용과 공간 관리","1.1","101개 숙소라는 토지","operations"},
		{1,"SPACE — 공간",1,"토지이용과 공간 관리","1.2","Property 모델 — hostex_id, 등급, 권역, 운영유형","cto"},
		{1,"SPACE — 공간",1,"토지이용과 공간 관리","1.3","공간의 상태 — active, maintenance, onboarding","cto"},
		{1,"SPACE — 공간",2,"공급 라이프사이클","2.1","Lead → Active 9단계","ceo"},
		{1,"SPACE — 공간",2,"공급 라이프사이클","2.2","셋업 → 촬영 → OTA 등록 → 운영","field"},
		{1,"SPACE — 공간",2,"공급 라이프사이클","2.3","플랫폼 매트릭스 — Airbnb Master, Fast Copy, Complex","cto"},
		{1,"SPACE — 공간",2,"공급 라이프사이클","2.4","투자자·주차·온보딩 체크리스트","ceo"},
		{1,"SPACE — 공간",3,"가격과 공실","3.1","PriceLabs — 동적 가격 연동","cto"},
		{1,"SPACE — 공간",3,"가격과 공실","3.2","Demand-Aware Markdown Engine","cto"},
		{1,"SPACE — 공간",3,"가격과 공실","3.3","채널별 가격 구조의 현실","operations"},
		{1,"SPACE — 공간",3,"가격과 공실","3.4","5엔진 진단 — 25개 지표","cto"},

		// ═══ Part 2. PEOPLE — 사람 ═══
		{2,"PEOPLE — 사람",4,"인구와 주거이동","2.0","인구계획의 가치 — 주거이동, 체류패턴, 가구구조","cto"},
		{2,"PEOPLE — 사람",4,"인구와 주거이동","4.1","6,364건의 예약 — 인구 유입","operations"},
		{2,"PEOPLE — 사람",4,"인구와 주거이동","4.2","Reservation 모델 — reservation_code가 주민등록번호","cto"},
		{2,"PEOPLE — 사람",4,"인구와 주거이동","4.3","guest_type 6종 — 이 도시의 주민 분류","cto"},
		{2,"PEOPLE — 사람",4,"인구와 주거이동","4.4","체크인/체크아웃 — 체류와 이동","operations"},
		{2,"PEOPLE — 사람",5,"주민의 목소리","5.1","42,568건의 메시지 분석","cto"},
		{2,"PEOPLE — 사람",5,"주민의 목소리","5.2","1,129건의 통화 분석","cto"},
		{2,"PEOPLE — 사람",5,"주민의 목소리","5.3","게스트 리뷰와 평점","operations"},
		{2,"PEOPLE — 사람",5,"주민의 목소리","5.4","Guest Request — 얼리체크인, 수건, 특수요청","operations"},
		{2,"PEOPLE — 사람",6,"팀과 역할","6.1","운영팀 5명 구조","ceo"},
		{2,"PEOPLE — 사람",6,"팀과 역할","6.2","RBAC — 8역할 47권한","cto"},
		{2,"PEOPLE — 사람",6,"팀과 역할","6.3","3모드 — 의사결정/관리/실행","ceo"},

		// ═══ Part 3. FLOW — 흐름 ═══
		{3,"FLOW — 흐름",7,"교통과 통행","3.0","교통계획의 가치 — O-D, 통행배분, 수단선택","cto"},
		{3,"FLOW — 흐름",7,"교통과 통행","7.1","3개 채널, 3개의 관문","operations"},
		{3,"FLOW — 흐름",7,"교통과 통행","7.2","Airbnb — API 자동, 전체 30%","operations"},
		{3,"FLOW — 흐름",7,"교통과 통행","7.3","삼삼엠투 — 승인제, 주단위, 관리비 별도","operations"},
		{3,"FLOW — 흐름",7,"교통과 통행","7.4","개인입금 — CRM, 수동 관리","operations"},
		{3,"FLOW — 흐름",8,"중앙 관제","8.1","Hostex — API 숙소·예약 동기화","cto"},
		{3,"FLOW — 흐름",8,"중앙 관제","8.2","Webhook 수신 — 실시간 이벤트 처리","cto"},
		{3,"FLOW — 흐름",8,"중앙 관제","8.3","동기화 정합성 — 누락, 중복, 시간대","cto"},
		{3,"FLOW — 흐름",8,"중앙 관제","8.4","멀티인박스 — 모든 경로의 통합","cto"},

		// ═══ Part 4. TURNOVER — 현장 ═══
		{4,"TURNOVER — 현장",9,"환경과 유지관리","4.0","환경계획의 가치 — 환경용량, 폐기물, 유지관리","cto"},
		{4,"TURNOVER — 현장",9,"환경과 유지관리","9.1","청소 = 도시의 환경 관리","cleaning_dispatch"},
		{4,"TURNOVER — 현장",9,"환경과 유지관리","9.2","체크아웃 → CleaningTask 자동 생성","cto"},
		{4,"TURNOVER — 현장",9,"환경과 유지관리","9.3","14권역 체계와 22명 청소자","cleaning_dispatch"},
		{4,"TURNOVER — 현장",9,"환경과 유지관리","9.4","단가 체계 — 평수별, 추가비, 할증","cfo"},
		{4,"TURNOVER — 현장",10,"카카오톡에서 OS로","10.1","엑셀→DB 12단계 전환","cto"},
		{4,"TURNOVER — 현장",10,"카카오톡에서 OS로","10.2","배정 자동화 — 2시간을 20분으로","cleaning_dispatch"},
		{4,"TURNOVER — 현장",10,"카카오톡에서 OS로","10.3","카카오톡 메시지 파싱 → 자동 배정","cto"},
		{4,"TURNOVER — 현장",10,"카카오톡에서 OS로","10.4","연장예약 감지와 청소 스킵","cto"},
		{4,"TURNOVER — 현장",11,"띵동 — 현장 SaaS","11.1","HIERO vs ThingDone의 관계","cto"},
		{4,"TURNOVER — 현장",11,"띵동 — 현장 SaaS","11.2","청소자 모바일 앱 — JWT, API, UX","cto"},
		{4,"TURNOVER — 현장",11,"띵동 — 현장 SaaS","11.3","사진·이슈·추가비 — 현장 데이터 수집","cleaning_dispatch"},
		{4,"TURNOVER — 현장",11,"띵동 — 현장 SaaS","11.4","주간 정산과 KPI","cfo"},
		{4,"TURNOVER — 현장",11,"띵동 — 현장 SaaS","11.5","Odyssey-X 데모데이 — 2026-06-27","ceo"},

		// ═══ Part 5. ECONOMY — 돈 ═══
		{5,"ECONOMY — 돈",12,"재정과 수입구조","5.0","도시재정의 가치 — 세입·세출, 수익자부담, 결산","cto"},
		{5,"ECONOMY — 돈",12,"재정과 수입구조","12.1","매출의 구조 — 수입 3종","cfo"},
		{5,"ECONOMY — 돈",12,"재정과 수입구조","12.2","CSV가 유일한 신뢰 소스 — API 78% 누락","cfo"},
		{5,"ECONOMY — 돈",12,"재정과 수입구조","12.3","hostex_transactions — 16개월 12,990건","cfo"},
		{5,"ECONOMY — 돈",12,"재정과 수입구조","12.4","Data1 + Data2 = Data3 JOIN","cto"},
		{5,"ECONOMY — 돈",13,"비용과 분할","13.1","cost_raw → cost_allocations — 1/n 분할","cfo"},
		{5,"ECONOMY — 돈",13,"비용과 분할","13.2","property_costs — 숙소별 고정비","cfo"},
		{5,"ECONOMY — 돈",13,"비용과 분할","13.3","카테고리 매핑 — 수입 3종, 비용 13종","cfo"},
		{5,"ECONOMY — 돈",14,"정산과 세무","14.1","Settlement — 숙소별 P&L","cfo"},
		{5,"ECONOMY — 돈",14,"정산과 세무","14.2","monthly_property_reports — 월간 스냅샷","cfo"},
		{5,"ECONOMY — 돈",14,"정산과 세무","14.3","세무 3분류 — 전대업/숙박업/서비스","cfo"},
		{5,"ECONOMY — 돈",14,"정산과 세무","14.4","계정과목 체계 4101~6117","cfo"},
		{5,"ECONOMY — 돈",14,"정산과 세무","14.5","세무사 전달자료 생성","cfo"},

		// ═══ Part 6. RISK — 위기 ═══
		{6,"RISK — 위기",15,"방재와 위기대응","6.0","방재계획의 가치 — 재난분류, 4단계 대응, 에스컬레이션","cto"},
		{6,"RISK — 위기",15,"방재와 위기대응","15.1","33개 이슈 유형 — 재난 분류 체계","operations"},
		{6,"RISK — 위기",15,"방재와 위기대응","15.2","담당자 자동 배정 — 33유형→8담당자","cto"},
		{6,"RISK — 위기",15,"방재와 위기대응","15.3","에스컬레이션 피라미드","ceo"},
		{6,"RISK — 위기",16,"감지→대응→해결","16.1","메시지 기반 이슈 자동 감지","cto"},
		{6,"RISK — 위기",16,"감지→대응→해결","16.2","CS 지식베이스 — 6대 카테고리, FAQ","cto"},
		{6,"RISK — 위기",16,"감지→대응→해결","16.3","통화 분석 — 1,129건, 대응 프로세스","operations"},
		{6,"RISK — 위기",17,"HS 시스템","17.1","HS = 자동, human = 사람, escalated = 민원","cto"},
		{6,"RISK — 위기",17,"HS 시스템","17.2","97% 자동 처리의 구조","cto"},
		{6,"RISK — 위기",17,"HS 시스템","17.3","대장 — 일별 HS/사람/민원/HS률","operations"},
		{6,"RISK — 위기",17,"HS 시스템","17.4","오탐 관리와 규칙 보정","cto"},

		// ═══ Part 7. INTELLIGENCE — 지능 ═══
		{7,"INTELLIGENCE — 지능",18,"스마트시티와 자동화","7.0","정보통신계획의 가치 — 디지털트윈, 도시데이터, 스마트시티","cto"},
		{7,"INTELLIGENCE — 지능",18,"스마트시티와 자동화","18.1","온톨로지 설계 — 15엔티티, 4대 레이어","cto"},
		{7,"INTELLIGENCE — 지능",18,"스마트시티와 자동화","18.2","State Transition — 기능이 아니라 상태 전환","cto"},
		{7,"INTELLIGENCE — 지능",18,"스마트시티와 자동화","18.3","reservation_code — 전체 파이프라인의 조인키","cto"},
		{7,"INTELLIGENCE — 지능",18,"스마트시티와 자동화","18.4","개발 10계명","cto"},
		{7,"INTELLIGENCE — 지능",19,"AI 7레벨","19.1","Level 1~3 — 수동→수집→분류 (완료)","cto"},
		{7,"INTELLIGENCE — 지능",19,"AI 7레벨","19.2","Level 4 — 자동 판단 (부분 구현)","cto"},
		{7,"INTELLIGENCE — 지능",19,"AI 7레벨","19.3","Level 5~6 — 자동 실행→학습 (다음)","cto"},
		{7,"INTELLIGENCE — 지능",19,"AI 7레벨","19.4","Level 7 — 자동 생성 (보고서부터)","cto"},
		{7,"INTELLIGENCE — 지능",20,"6개 Agent","20.1","페이지별 AI Agent — GPT-4o-mini","cto"},
		{7,"INTELLIGENCE — 지능",20,"6개 Agent","20.2","대화 저장 + 크로스페이지 + 장기기억","cto"},
		{7,"INTELLIGENCE — 지능",20,"6개 Agent","20.3","CS Agent — 메시지 분석, 응답 제안","cto"},
		{7,"INTELLIGENCE — 지능",20,"6개 Agent","20.4","Founder OS — Daily Brief, Top Decisions","cto"},
		{7,"INTELLIGENCE — 지능",20,"6개 Agent","20.5","ETF Board — CEO/CFO/CTO 대시보드","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.1","Go + Gin + GORM + MySQL","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.2","React + Vite + TypeScript","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.3","6 Layer — Data→Integration→Domain→App→AI→Presentation","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.4","RBAC — 8역할 47권한 구현","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.5","Hostex API 클라이언트 — client.go","cto"},
		{7,"INTELLIGENCE — 지능",21,"시스템 아키텍처","21.6","PriceLabs 연동 — 캐시, 비교, KPI","cto"},

		// ═══ Part 8. BUSINESS — 사업 ═══
		{8,"BUSINESS — 사업",22,"산업과 플랫폼","8.0","산업계획의 가치 — 클러스터, 혁신생태계, 플랫폼경제","cto"},
		{8,"BUSINESS — 사업",22,"산업과 플랫폼","22.1","내부 효율화 — 100채→300채","ceo"},
		{8,"BUSINESS — 사업",22,"산업과 플랫폼","22.2","띵동 SaaS — 29k/59k/99k, 외부 판매","ceo"},
		{8,"BUSINESS — 사업",22,"산업과 플랫폼","22.3","데이터 플랫폼 — 운영 데이터가 자산","ceo"},
		{8,"BUSINESS — 사업",23,"마케팅과 리드","23.1","위탁운영 마케팅 — 랜딩페이지, CRM","marketing"},
		{8,"BUSINESS — 사업",23,"마케팅과 리드","23.2","Lead 파이프라인 — 리드 스코어링, 제안서 자동화","marketing"},
		{8,"BUSINESS — 사업",23,"마케팅과 리드","23.3","타겟별 광고 랜딩 — /lp/* 확장","marketing"},
		{8,"BUSINESS — 사업",24,"투자와 확장","24.1","투자 제안서 — 심사위원 3대 질문","ceo"},
		{8,"BUSINESS — 사업",24,"투자와 확장","24.2","시장 규모와 타겟 — TAM/SAM/SOM","ceo"},
		{8,"BUSINESS — 사업",24,"투자와 확장","24.3","Palantir 비유 — 국가 OS vs 도시 OS","ceo"},

		// ═══ Part 9. HORIZON — 확장 ═══
		{9,"HORIZON — 확장",25,"미래상","9.0","도시기본계획의 가치 — 20년 비전, 공간구조, 생활권","cto"},
		{9,"HORIZON — 확장",25,"미래상","25.1","MORO — 주거이동 OS, 7 Score, 동네 안착","cto"},
		{9,"HORIZON — 확장",25,"미래상","25.2","서울 AI 도시계획 연구소 — Odyssey-X, 33/84/256","ceo"},
		{9,"HORIZON — 확장",25,"미래상","25.3","숙소에서 도시로 — 3단계 확장","ceo"},
		{9,"HORIZON — 확장",26,"콘텐츠 파이프라인","26.1","만드는 과정이 교육이 된다","cto"},
		{9,"HORIZON — 확장",26,"콘텐츠 파이프라인","26.2","글쓰기 3종 — 에세이/논문형/블로그","cto"},
		{9,"HORIZON — 확장",26,"콘텐츠 파이프라인","26.3","CTO 역할 = 아카이빙","cto"},

		// ═══ Part 10. URBAN THEORY INDEX — 강의 원천 ═══
		{10,"URBAN THEORY INDEX — 강의 원천",27,"도시계획 체계 총론","10.0","국토계획법 — 기본계획↔관리계획↔지구단위","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",27,"도시계획 체계 총론","10.01","온톨로지 부재가 왜 구조적 한계인가","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",28,"토지이용 (SPACE)","10.1","Lynch, 공간 위계, 용도지역·지구·구역","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",29,"인구·주거 (PEOPLE)","10.2","Rossi, 주거이동, 가구구조 변화","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",30,"교통 (FLOW)","10.3","4단계 추정, O-D, 통행배분","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",31,"환경 (TURNOVER)","10.4","환경용량, 폐기물, 유지관리","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",32,"재정 (ECONOMY)","10.5","세입·세출, 수익자부담, 도시경제학","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",33,"방재 (RISK)","10.6","위기관리 4단계, 재난분류","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",34,"스마트시티 (INTELLIGENCE)","10.7","디지털트윈, 도시데이터플랫폼, 스마트시티법","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",35,"산업 (BUSINESS)","10.8","클러스터, 플랫폼경제, 혁신생태계","cto"},
		{10,"URBAN THEORY INDEX — 강의 원천",36,"미래상 (HORIZON)","10.9","생활권, 중간영역이론, Jan Gehl","cto"},

		// ═══ 부록 ═══
		{99,"부록",90,"부록","A","핵심 파일 맵","cto"},
		{99,"부록",90,"부록","B","API 엔드포인트 전체 목록 (50+ handler)","cto"},
		{99,"부록",90,"부록","C","DB 스키마 (45+ 테이블)","cto"},
		{99,"부록",90,"부록","D","개발 세션 로그","cto"},
		{99,"부록",90,"부록","E","글쓰기 가이드 v1","cto"},
		{99,"부록",90,"부록","F","계정과목 매핑표","cfo"},
		{99,"부록",90,"부록","G","청소자 계정 및 권역 배정표","cleaning_dispatch"},
		{99,"부록",90,"부록","H","Claude Code 개발 지시문","cto"},
	}
	for i, d := range data {
		config.DB.Create(&models.WikiArticle{
			PartNumber: d.P, PartTitle: d.PT, Chapter: d.C, ChapterTitle: d.CT,
			Section: d.S, Title: d.T, Status: "empty", AssignedTo: d.A, SortOrder: i,
		})
	}
	log.Printf("[seed] Hestory v2: %d건 새 목차 생성 완료", len(data))
}
