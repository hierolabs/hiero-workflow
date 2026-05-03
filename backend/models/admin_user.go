package models

import "time"

const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
)

type AdminUser struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	LoginID   string    `json:"login_id" gorm:"size:50;uniqueIndex;not null"`
	Password  string    `json:"-" gorm:"size:255;not null"`
	Name      string    `json:"name" gorm:"size:100"`
	Role      string    `json:"role" gorm:"size:20;default:admin"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *AdminUser) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}
