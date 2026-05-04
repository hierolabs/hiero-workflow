package dto

import (
	"fmt"
	"strings"

	"hiero-workflow/backend/models"
)

// --- Request DTOs ---

type CreatePropertyRequest struct {
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	Region        string  `json:"region"`
	Address       string  `json:"address"`
	DetailAddress string  `json:"detail_address"`
	PropertyType  string  `json:"property_type"`
	RoomType      string  `json:"room_type"`
	MaxGuests     int     `json:"max_guests"`
	Bedrooms      int     `json:"bedrooms"`
	Beds          int     `json:"beds"`
	Bathrooms     float64 `json:"bathrooms"`
	MonthlyRent   int64   `json:"monthly_rent"`
	ManagementFee int64   `json:"management_fee"`
	Deposit       int64   `json:"deposit"`
	CheckInTime   string  `json:"check_in_time"`
	CheckOutTime  string  `json:"check_out_time"`
	Memo          string  `json:"memo"`
}

func (r *CreatePropertyRequest) Validate() error {
	r.Code = strings.TrimSpace(r.Code)
	r.Name = strings.TrimSpace(r.Name)

	if r.Code == "" {
		return fmt.Errorf("코드는 필수입니다")
	}
	if r.Name == "" {
		return fmt.Errorf("이름은 필수입니다")
	}
	if r.MaxGuests < 1 {
		r.MaxGuests = 1
	}
	if r.MonthlyRent < 0 {
		return fmt.Errorf("월세는 0 이상이어야 합니다")
	}
	if r.ManagementFee < 0 {
		return fmt.Errorf("관리비는 0 이상이어야 합니다")
	}
	if r.Deposit < 0 {
		return fmt.Errorf("보증금은 0 이상이어야 합니다")
	}
	return nil
}

type UpdatePropertyRequest struct {
	Name          string  `json:"name"`
	Region        string  `json:"region"`
	Address       string  `json:"address"`
	DetailAddress string  `json:"detail_address"`
	PropertyType  string  `json:"property_type"`
	RoomType      string  `json:"room_type"`
	MaxGuests     int     `json:"max_guests"`
	Bedrooms      int     `json:"bedrooms"`
	Beds          int     `json:"beds"`
	Bathrooms     float64 `json:"bathrooms"`
	MonthlyRent   int64   `json:"monthly_rent"`
	ManagementFee int64   `json:"management_fee"`
	Deposit       int64   `json:"deposit"`
	CheckInTime   string  `json:"check_in_time"`
	CheckOutTime  string  `json:"check_out_time"`
	OperationType string  `json:"operation_type"`
	TaxCategory   string  `json:"tax_category"`
	LicenseStatus string  `json:"license_status"`
	ContractType  string  `json:"contract_type"`
	OwnerName     string  `json:"owner_name"`
	Memo          string  `json:"memo"`
}

func (r *UpdatePropertyRequest) Validate() error {
	r.Name = strings.TrimSpace(r.Name)

	if r.Name == "" {
		return fmt.Errorf("이름은 필수입니다")
	}
	if r.MaxGuests < 1 {
		r.MaxGuests = 1
	}
	if r.MonthlyRent < 0 {
		return fmt.Errorf("월세는 0 이상이어야 합니다")
	}
	if r.ManagementFee < 0 {
		return fmt.Errorf("관리비는 0 이상이어야 합니다")
	}
	if r.Deposit < 0 {
		return fmt.Errorf("보증금은 0 이상이어야 합니다")
	}
	return nil
}

type UpdatePropertyStatusRequest struct {
	Status string `json:"status"`
}

func (r *UpdatePropertyStatusRequest) Validate() error {
	if !models.ValidPropertyStatuses[r.Status] {
		return fmt.Errorf("유효하지 않은 상태입니다: %s (preparing, active, paused, closed)", r.Status)
	}
	return nil
}

type UpdatePropertyOperationStatusRequest struct {
	OperationStatus string `json:"operation_status"`
}

func (r *UpdatePropertyOperationStatusRequest) Validate() error {
	if !models.ValidOperationStatuses[r.OperationStatus] {
		return fmt.Errorf("유효하지 않은 운영 상태입니다: %s (inactive, available, occupied, maintenance, blocked)", r.OperationStatus)
	}
	return nil
}

// --- Query DTO ---

type PropertyListQuery struct {
	Page            int    `form:"page"`
	PageSize        int    `form:"page_size"`
	Region          string `form:"region"`
	Status          string `form:"status"`
	OperationStatus string `form:"operation_status"`
	PropertyType    string `form:"property_type"`
	RoomType        string `form:"room_type"`
	Keyword         string `form:"keyword"`
}

func (q *PropertyListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 20
	} else if q.PageSize > 500 {
		q.PageSize = 500
	}
}

// --- Response DTOs ---

type PropertyResponse struct {
	ID              uint    `json:"id"`
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	HostexID        int64   `json:"hostex_id"`
	Region          string  `json:"region"`
	Address         string  `json:"address"`
	DetailAddress   string  `json:"detail_address"`
	PropertyType    string  `json:"property_type"`
	RoomType        string  `json:"room_type"`
	MaxGuests       int     `json:"max_guests"`
	Bedrooms        int     `json:"bedrooms"`
	Beds            int     `json:"beds"`
	Bathrooms       float64 `json:"bathrooms"`
	MonthlyRent     int64   `json:"monthly_rent"`
	ManagementFee   int64   `json:"management_fee"`
	Deposit         int64   `json:"deposit"`
	DisplayOrder    int     `json:"display_order"`
	Status          string  `json:"status"`
	OperationStatus string  `json:"operation_status"`
	CheckInTime     string  `json:"check_in_time"`
	CheckOutTime    string  `json:"check_out_time"`
	OperationType   string  `json:"operation_type"`
	TaxCategory     string  `json:"tax_category"`
	LicenseStatus   string  `json:"license_status"`
	ContractType    string  `json:"contract_type"`
	OwnerName       string  `json:"owner_name"`
	Memo            string  `json:"memo"`
	CreatedByID     *uint   `json:"created_by_id"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

func NewPropertyResponse(p models.Property) PropertyResponse {
	return PropertyResponse{
		ID:              p.ID,
		Code:            p.Code,
		Name:            p.Name,
		HostexID:        p.HostexID,
		Region:          p.Region,
		Address:         p.Address,
		DetailAddress:   p.DetailAddress,
		PropertyType:    p.PropertyType,
		RoomType:        p.RoomType,
		MaxGuests:       p.MaxGuests,
		Bedrooms:        p.Bedrooms,
		Beds:            p.Beds,
		Bathrooms:       p.Bathrooms,
		MonthlyRent:     p.MonthlyRent,
		ManagementFee:   p.ManagementFee,
		Deposit:         p.Deposit,
		DisplayOrder:    p.DisplayOrder,
		Status:          p.Status,
		OperationStatus: p.OperationStatus,
		CheckInTime:     p.CheckInTime,
		CheckOutTime:    p.CheckOutTime,
		OperationType:   p.OperationType,
		TaxCategory:     p.TaxCategory,
		LicenseStatus:   p.LicenseStatus,
		ContractType:    p.ContractType,
		OwnerName:       p.OwnerName,
		Memo:            p.Memo,
		CreatedByID:     p.CreatedByID,
		CreatedAt:       p.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:       p.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

type PropertyListResponse struct {
	Properties []PropertyResponse `json:"properties"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
	TotalPages int                `json:"total_pages"`
}
