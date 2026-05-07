package models

import "time"

type OnboardingCheck struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	PropertyID    uint       `gorm:"index;not null" json:"property_id"`
	Phase         int        `gorm:"not null" json:"phase"`            // 1~5
	Item          string     `gorm:"size:200;not null" json:"item"`    // 체크 항목명
	IsChecked     bool       `gorm:"default:false" json:"is_checked"`
	CheckedByID   *uint      `json:"checked_by_id"`
	CheckedByName string     `gorm:"size:100" json:"checked_by_name"`
	CheckedAt     *time.Time `json:"checked_at"`
	Memo          string     `gorm:"type:text" json:"memo"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// 온보딩 Phase 정의
var OnboardingPhases = []struct {
	Phase    int
	Label    string
	Assignee string
	Items    []string
}{
	{1, "공간 세팅", "field", []string{
		"공간 컨셉 확정", "물품 구매 완료", "설치 완료",
		"도어락 설정", "와이파이 설정", "어메니티/비품 배치", "침대/침구 세팅",
	}},
	{2, "촬영 + 디지털", "field", []string{
		"사진 촬영 완료", "색보정 완료", "AI 수정 완료", "사진 업로드 완료",
	}},
	{3, "콘텐츠", "marketing", []string{
		"소개글 작성", "소개글 가이드", "위치 정보 확정",
		"교통 안내 작성", "주변 편의시설 안내",
	}},
	{4, "플랫폼 등록", "marketing", []string{
		"Hostex 등록", "Airbnb 등록", "Booking.com 등록", "Agoda 등록",
		"삼삼엠투 등록", "리브애니웨어 등록", "자리톡 등록",
		"가격 설정", "최소 숙박일 설정",
	}},
	{5, "운영 준비", "operations", []string{
		"체크인 안내 메시지", "하우스룰 설정", "청소 스케줄 등록",
		"Hostex 연동 확인", "첫 예약 수신 확인",
	}},
}
