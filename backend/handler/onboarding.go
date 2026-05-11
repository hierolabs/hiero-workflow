package handler

import (
	"net/http"
	"strconv"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"

	"github.com/gin-gonic/gin"
)

type OnboardingHandler struct{}

func NewOnboardingHandler() *OnboardingHandler { return &OnboardingHandler{} }

// GetFull — 온보딩에 필요한 모든 데이터를 한 번에 반환
func (h *OnboardingHandler) GetFull(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db := config.DB

	var prop models.Property
	if err := db.First(&prop, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "숙소를 찾을 수 없습니다"})
		return
	}

	var cost models.PropertyCost
	db.Where("property_id = ?", id).First(&cost)

	var platforms []models.PropertyPlatform
	db.Where("property_id = ?", id).Find(&platforms)

	var parking models.PropertyParking
	db.Where("property_id = ?", id).First(&parking)

	var cleaningCodes []models.CleaningCode
	db.Where("property_id = ?", id).Find(&cleaningCodes)

	var investor *models.Investor
	var propInvestor models.PropertyInvestor
	if db.Where("property_id = ?", id).First(&propInvestor).Error == nil {
		var inv models.Investor
		if db.First(&inv, propInvestor.InvestorID).Error == nil {
			investor = &inv
		}
	}

	var onboardingChecks []models.OnboardingCheck
	db.Where("property_id = ?", id).Order("phase, id").Find(&onboardingChecks)

	c.JSON(http.StatusOK, gin.H{
		"property":          prop,
		"cost":              cost,
		"platforms":         platforms,
		"parking":           parking,
		"cleaning_codes":    cleaningCodes,
		"investor":          investor,
		"property_investor": propInvestor,
		"onboarding_checks": onboardingChecks,
	})
}

// SaveStep — 스텝별 데이터 저장 (step 파라미터로 구분)
func (h *OnboardingHandler) SaveStep(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	step := c.Param("step")
	db := config.DB

	// 숙소 존재 확인
	var prop models.Property
	if err := db.First(&prop, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "숙소를 찾을 수 없습니다"})
		return
	}

	switch step {
	case "basic":
		h.saveBasic(c, &prop)
	case "room":
		h.saveRoom(c, &prop)
	case "cost":
		h.saveCost(c, uint(id))
	case "platform":
		h.savePlatforms(c, uint(id))
	case "cleaning":
		h.saveCleaning(c, uint(id))
	case "settlement":
		h.saveSettlement(c, uint(id))
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "알 수 없는 스텝: " + step})
	}
}

func (h *OnboardingHandler) saveBasic(c *gin.Context, prop *models.Property) {
	var req struct {
		Name          string `json:"name"`
		Region        string `json:"region"`
		Address       string `json:"address"`
		DetailAddress string `json:"detail_address"`
		BuildingName  string `json:"building_name"`
		PropertyType  string `json:"property_type"`
		RoomType      string `json:"room_type"`
		MaxGuests     int    `json:"max_guests"`
		Bedrooms      int    `json:"bedrooms"`
		Beds          int    `json:"beds"`
		Bathrooms     float64 `json:"bathrooms"`
		CheckInTime   string `json:"check_in_time"`
		CheckOutTime  string `json:"check_out_time"`
		Grade         string `json:"grade"`
		OperationType string `json:"operation_type"`
		TaxCategory   string `json:"tax_category"`
		LicenseStatus string `json:"license_status"`
		ContractType  string `json:"contract_type"`
		OwnerName     string `json:"owner_name"`
		Memo          string `json:"memo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"name": req.Name, "region": req.Region, "address": req.Address,
		"detail_address": req.DetailAddress, "building_name": req.BuildingName,
		"property_type": req.PropertyType, "room_type": req.RoomType,
		"max_guests": req.MaxGuests, "bedrooms": req.Bedrooms, "beds": req.Beds,
		"bathrooms": req.Bathrooms, "check_in_time": req.CheckInTime,
		"check_out_time": req.CheckOutTime, "grade": req.Grade,
		"operation_type": req.OperationType, "tax_category": req.TaxCategory,
		"license_status": req.LicenseStatus, "contract_type": req.ContractType,
		"owner_name": req.OwnerName, "memo": req.Memo,
	}

	config.DB.Model(prop).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "기본 정보 저장 완료"})
}

func (h *OnboardingHandler) saveRoom(c *gin.Context, prop *models.Property) {
	var req struct {
		BedType           string `json:"bed_type"`
		TvType            string `json:"tv_type"`
		EntrancePassword  string `json:"entrance_password"`
		RoomPassword      string `json:"room_password"`
		ManagementOffice  string `json:"management_office"`
		Parking           *struct {
			BuildingName     string `json:"building_name"`
			SelfParking      bool   `json:"self_parking"`
			StreetParking    bool   `json:"street_parking"`
			MechanicalSpec   string `json:"mechanical_spec"`
			PublicParking    string `json:"public_parking"`
			PublicParkingRate string `json:"public_parking_rate"`
			DailyCharge      int64  `json:"daily_charge"`
			MonthlyCharge    int64  `json:"monthly_charge"`
			RemoteFee        int64  `json:"remote_fee"`
			ManagementCompany string `json:"management_company"`
			Memo             string `json:"memo"`
		} `json:"parking"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB
	db.Model(prop).Updates(map[string]interface{}{
		"bed_type": req.BedType, "tv_type": req.TvType,
		"entrance_password": req.EntrancePassword, "room_password": req.RoomPassword,
		"management_office": req.ManagementOffice,
	})

	if req.Parking != nil {
		var parking models.PropertyParking
		db.Where("property_id = ?", prop.ID).FirstOrCreate(&parking, models.PropertyParking{PropertyID: prop.ID})
		db.Model(&parking).Updates(map[string]interface{}{
			"building_name": req.Parking.BuildingName, "self_parking": req.Parking.SelfParking,
			"street_parking": req.Parking.StreetParking, "mechanical_spec": req.Parking.MechanicalSpec,
			"public_parking": req.Parking.PublicParking, "public_parking_rate": req.Parking.PublicParkingRate,
			"daily_charge": req.Parking.DailyCharge, "monthly_charge": req.Parking.MonthlyCharge,
			"remote_fee": req.Parking.RemoteFee, "management_company": req.Parking.ManagementCompany,
			"memo": req.Parking.Memo,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "공간 상세 저장 완료"})
}

func (h *OnboardingHandler) saveCost(c *gin.Context, propertyID uint) {
	var req models.PropertyCost
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB
	var existing models.PropertyCost
	if db.Where("property_id = ?", propertyID).First(&existing).Error == nil {
		req.ID = existing.ID
		req.PropertyID = propertyID
		db.Save(&req)
	} else {
		req.PropertyID = propertyID
		db.Create(&req)
	}

	c.JSON(http.StatusOK, gin.H{"message": "비용 구조 저장 완료"})
}

func (h *OnboardingHandler) savePlatforms(c *gin.Context, propertyID uint) {
	var req struct {
		Platforms []models.PropertyPlatform `json:"platforms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB
	for _, p := range req.Platforms {
		p.PropertyID = propertyID
		if p.Tier == "" {
			p.Tier = models.PlatformTiers[p.Platform]
		}
		if p.Platform == models.PlatformAirbnb {
			p.IsMaster = true
		}

		var existing models.PropertyPlatform
		if db.Where("property_id = ? AND platform = ?", propertyID, p.Platform).First(&existing).Error == nil {
			p.ID = existing.ID
			db.Save(&p)
		} else {
			db.Create(&p)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "채널 등록 저장 완료"})
}

func (h *OnboardingHandler) saveCleaning(c *gin.Context, propertyID uint) {
	var req struct {
		CleaningCodes []struct {
			Code         string  `json:"code"`
			RegionCode   string  `json:"region_code"`
			RegionName   string  `json:"region_name"`
			BuildingName string  `json:"building_name"`
			RoomName     string  `json:"room_name"`
			RoomCount    float64 `json:"room_count"`
			BasePrice    int     `json:"base_price"`
			Memo         string  `json:"memo"`
		} `json:"cleaning_codes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB
	for _, cc := range req.CleaningCodes {
		propID := propertyID
		code := models.CleaningCode{
			Code: cc.Code, RegionCode: cc.RegionCode, RegionName: cc.RegionName,
			BuildingName: cc.BuildingName, RoomName: cc.RoomName,
			RoomCount: cc.RoomCount, BasePrice: cc.BasePrice,
			PropertyID: &propID, Memo: cc.Memo,
		}

		var existing models.CleaningCode
		if db.Where("property_id = ? AND code = ?", propertyID, cc.Code).First(&existing).Error == nil {
			code.ID = existing.ID
			db.Save(&code)
		} else {
			db.Create(&code)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "청소/운영 저장 완료"})
}

func (h *OnboardingHandler) saveSettlement(c *gin.Context, propertyID uint) {
	var req struct {
		Investor *struct {
			Name          string `json:"name"`
			Phone         string `json:"phone"`
			AccountHolder string `json:"account_holder"`
			BankName      string `json:"bank_name"`
			AccountNumber string `json:"account_number"`
			Memo          string `json:"memo"`
		} `json:"investor"`
		OwnershipType  string  `json:"ownership_type"`
		ContractStart  string  `json:"contract_start"`
		ContractEnd    string  `json:"contract_end"`
		RentAmount     int64   `json:"rent_amount"`
		CommissionRate float64 `json:"commission_rate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := config.DB

	if req.Investor != nil {
		// 투자자 upsert
		var inv models.Investor
		if db.Where("name = ? AND phone = ?", req.Investor.Name, req.Investor.Phone).First(&inv).Error != nil {
			inv = models.Investor{
				Name: req.Investor.Name, Phone: req.Investor.Phone,
				AccountHolder: req.Investor.AccountHolder, BankName: req.Investor.BankName,
				AccountNumber: req.Investor.AccountNumber, Memo: req.Investor.Memo,
			}
			db.Create(&inv)
		} else {
			db.Model(&inv).Updates(map[string]interface{}{
				"account_holder": req.Investor.AccountHolder, "bank_name": req.Investor.BankName,
				"account_number": req.Investor.AccountNumber, "memo": req.Investor.Memo,
			})
		}

		// property_investor upsert
		var pi models.PropertyInvestor
		if db.Where("property_id = ?", propertyID).First(&pi).Error != nil {
			pi = models.PropertyInvestor{
				PropertyID: propertyID, InvestorID: inv.ID,
				OwnershipType: req.OwnershipType, RentAmount: req.RentAmount,
				CommissionRate: req.CommissionRate,
			}
			db.Create(&pi)
		} else {
			db.Model(&pi).Updates(map[string]interface{}{
				"investor_id": inv.ID, "ownership_type": req.OwnershipType,
				"rent_amount": req.RentAmount, "commission_rate": req.CommissionRate,
			})
		}

		// Property에 investor_id 연결
		db.Model(&models.Property{}).Where("id = ?", propertyID).Update("investor_id", inv.ID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "정산 정보 저장 완료"})
}
