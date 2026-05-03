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
	)
	seedAdminUser()
	seedProperties()
	seedDiagnosisSample()

	// Hostex 전체 동기화 (백그라운드)
	go func() {
		log.Println("[Boot] Hostex 전체 동기화 시작...")
		syncSvc := service.NewHostexSyncService()
		syncSvc.SyncAll()

		log.Println("[Boot] 대화 동기화 시작...")
		msgSvc := service.NewMessageService()
		msgSvc.SyncConversations()

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
			msgSvc.SyncConversations()
			msgSvc.SyncAllMessages()

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
	var count int64
	config.DB.Model(&models.AdminUser{}).Count(&count)
	if count > 0 {
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("비밀번호 해싱 실패:", err)
	}

	admin := models.AdminUser{
		LoginID:  "admin",
		Password: string(hashed),
		Name:     "관리자",
		Role:     models.RoleSuperAdmin,
	}
	config.DB.Create(&admin)
	log.Println("기본 관리자 계정 생성 완료 (admin/admin)")
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
