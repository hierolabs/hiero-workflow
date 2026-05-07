package models

import "time"

// 기존 Role (하위호환)
const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
)

// RoleLayer — 조직 계층
type RoleLayer string

const (
	RoleLayerFounder   RoleLayer = "founder"
	RoleLayerETF       RoleLayer = "etf"
	RoleLayerExecution RoleLayer = "execution"
	RoleLayerExternal  RoleLayer = "external"
)

// RoleTitle — 직책
type RoleTitle string

const (
	RoleTitleFounder          RoleTitle = "founder"
	RoleTitleCEO              RoleTitle = "ceo"
	RoleTitleCTO              RoleTitle = "cto"
	RoleTitleCFO              RoleTitle = "cfo"
	RoleTitleMarketing        RoleTitle = "marketing"
	RoleTitleOperations       RoleTitle = "operations"
	RoleTitleCleaningDispatch RoleTitle = "cleaning_dispatch"
	RoleTitleField            RoleTitle = "field"
)

// DefaultDashboard — role_title별 기본 대시보드
var DefaultDashboards = map[RoleTitle]string{
	RoleTitleFounder:          "/founder",
	RoleTitleCEO:              "/etf-board/ceo",
	RoleTitleCTO:              "/etf-board/cto",
	RoleTitleCFO:              "/etf-board/cfo",
	RoleTitleMarketing:        "/execution/marketing",
	RoleTitleOperations:       "/execution/operations",
	RoleTitleCleaningDispatch: "/execution/cleaning",
	RoleTitleField:            "/execution/field",
}

type AdminUser struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	LoginID   string    `json:"login_id" gorm:"size:50;uniqueIndex;not null"`
	Password  string    `json:"-" gorm:"size:255;not null"`
	Name      string    `json:"name" gorm:"size:100"`
	Role      string    `json:"role" gorm:"size:20;default:admin"`
	RoleLayer string    `json:"role_layer" gorm:"size:50;default:execution"`
	RoleTitle string    `json:"role_title" gorm:"size:50"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *AdminUser) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}

func (u *AdminUser) GetDefaultDashboard() string {
	if d, ok := DefaultDashboards[RoleTitle(u.RoleTitle)]; ok {
		return d
	}
	return "/"
}
