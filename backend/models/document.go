package models

import "time"

// Document tracks uploaded files (contracts, reports, scans, CSVs, etc.)
type Document struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FileName     string    `gorm:"size:300;not null" json:"file_name"`     // 원본 파일명
	StoragePath  string    `gorm:"size:500;not null" json:"storage_path"`  // 로컬 저장 경로
	FileSize     int64     `gorm:"not null" json:"file_size"`             // bytes
	MimeType     string    `gorm:"size:100" json:"mime_type"`
	Category     string    `gorm:"size:50;not null;index" json:"category"` // contract, report, tax, hr, operation, csv_backup, photo, other
	SubCategory  string    `gorm:"size:100" json:"sub_category"`           // 전대차계약, 근로계약, 월간보고서 등
	Description  string    `gorm:"size:500" json:"description"`
	PropertyID   *uint     `gorm:"index" json:"property_id"`              // 숙소 연결 (optional)
	WikiArticleID *uint    `gorm:"index" json:"wiki_article_id"`          // Hestory 섹션 연결 (optional)
	UploadedBy   uint      `gorm:"not null" json:"uploaded_by"`
	UploaderName string    `gorm:"size:100" json:"uploader_name"`
	Year         int       `gorm:"index" json:"year"`                     // 귀속 연도
	Month        int       `json:"month"`                                 // 귀속 월 (0=연간)
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
