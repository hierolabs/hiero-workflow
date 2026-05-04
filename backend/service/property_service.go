package service

import (
	"errors"
	"strings"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/dto"
	"hiero-workflow/backend/models"

	"gorm.io/gorm"
)

type PropertyService struct{}

func NewPropertyService() *PropertyService {
	return &PropertyService{}
}

func (s *PropertyService) List(query dto.PropertyListQuery) (dto.PropertyListResponse, error) {
	query.Normalize()

	db := config.DB.Model(&models.Property{})

	if query.Region != "" {
		db = db.Where("region = ?", query.Region)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.OperationStatus != "" {
		db = db.Where("operation_status = ?", query.OperationStatus)
	}
	if query.PropertyType != "" {
		db = db.Where("property_type = ?", query.PropertyType)
	}
	if query.RoomType != "" {
		db = db.Where("room_type = ?", query.RoomType)
	}
	if query.Keyword != "" {
		keyword := "%" + strings.TrimSpace(query.Keyword) + "%"
		db = db.Where("code LIKE ? OR name LIKE ? OR address LIKE ?", keyword, keyword, keyword)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return dto.PropertyListResponse{}, err
	}

	var properties []models.Property
	offset := (query.Page - 1) * query.PageSize
	if err := db.Order("display_order ASC, name ASC").Offset(offset).Limit(query.PageSize).Find(&properties).Error; err != nil {
		return dto.PropertyListResponse{}, err
	}

	items := make([]dto.PropertyResponse, len(properties))
	for i, p := range properties {
		items[i] = dto.NewPropertyResponse(p)
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return dto.PropertyListResponse{
		Properties: items,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *PropertyService) GetByID(id uint) (models.Property, error) {
	var property models.Property
	if err := config.DB.First(&property, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return property, ErrNotFound
		}
		return property, err
	}
	return property, nil
}

func (s *PropertyService) Create(req dto.CreatePropertyRequest, adminUserID uint) (models.Property, error) {
	// 중복 코드 체크
	var existing models.Property
	if err := config.DB.Where("code = ?", req.Code).First(&existing).Error; err == nil {
		return models.Property{}, ErrDuplicateCode
	}

	property := models.Property{
		Code:          req.Code,
		Name:          req.Name,
		Region:        req.Region,
		Address:       req.Address,
		DetailAddress: req.DetailAddress,
		PropertyType:  req.PropertyType,
		RoomType:      req.RoomType,
		MaxGuests:     req.MaxGuests,
		Bedrooms:      req.Bedrooms,
		Beds:          req.Beds,
		Bathrooms:     req.Bathrooms,
		MonthlyRent:   req.MonthlyRent,
		ManagementFee: req.ManagementFee,
		Deposit:       req.Deposit,
		CheckInTime:   req.CheckInTime,
		CheckOutTime:  req.CheckOutTime,
		Memo:          req.Memo,
		CreatedByID:   &adminUserID,
	}

	if err := config.DB.Create(&property).Error; err != nil {
		return models.Property{}, err
	}

	return property, nil
}

func (s *PropertyService) Update(id uint, req dto.UpdatePropertyRequest) (models.Property, error) {
	property, err := s.GetByID(id)
	if err != nil {
		return models.Property{}, err
	}

	property.Name = req.Name
	property.Region = req.Region
	property.Address = req.Address
	property.DetailAddress = req.DetailAddress
	property.PropertyType = req.PropertyType
	property.RoomType = req.RoomType
	property.MaxGuests = req.MaxGuests
	property.Bedrooms = req.Bedrooms
	property.Beds = req.Beds
	property.Bathrooms = req.Bathrooms
	property.MonthlyRent = req.MonthlyRent
	property.ManagementFee = req.ManagementFee
	property.Deposit = req.Deposit
	property.CheckInTime = req.CheckInTime
	property.CheckOutTime = req.CheckOutTime
	property.Memo = req.Memo

	if err := config.DB.Save(&property).Error; err != nil {
		return models.Property{}, err
	}

	return property, nil
}

func (s *PropertyService) Delete(id uint) error {
	property, err := s.GetByID(id)
	if err != nil {
		return err
	}
	return config.DB.Delete(&property).Error
}

func (s *PropertyService) UpdateStatus(id uint, status string) (models.Property, error) {
	property, err := s.GetByID(id)
	if err != nil {
		return models.Property{}, err
	}

	property.Status = status
	if err := config.DB.Save(&property).Error; err != nil {
		return models.Property{}, err
	}

	return property, nil
}

func (s *PropertyService) UpdateOperationStatus(id uint, operationStatus string) (models.Property, error) {
	property, err := s.GetByID(id)
	if err != nil {
		return models.Property{}, err
	}

	property.OperationStatus = operationStatus
	if err := config.DB.Save(&property).Error; err != nil {
		return models.Property{}, err
	}

	return property, nil
}

// Sentinel errors
// Reorder — 순서 일괄 변경
func (s *PropertyService) Reorder(orders []struct {
	ID           uint `json:"id"`
	DisplayOrder int  `json:"display_order"`
}) error {
	tx := config.DB.Begin()
	for _, o := range orders {
		if err := tx.Model(&models.Property{}).Where("id = ?", o.ID).Update("display_order", o.DisplayOrder).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}

var (
	ErrNotFound      = errors.New("not_found")
	ErrDuplicateCode = errors.New("duplicate_code")
)
