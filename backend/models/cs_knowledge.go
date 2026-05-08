package models

import "time"

// CSKnowledge — 고객 대응 프로세스 지식베이스
// 통화 1,129건 분석에서 추출한 유형별 대응 방침
type CSKnowledge struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Category  string    `gorm:"size:50;index;not null" json:"category"` // boiler, checkin, parking, reservation, cleaning, emergency
	Title     string    `gorm:"size:200;not null" json:"title"`         // 상황 제목
	Situation string    `gorm:"type:text" json:"situation"`             // 상황 설명
	FAQ       string    `gorm:"type:text" json:"faq"`                   // 고객이 자주 하는 말
	FirstResponse string `gorm:"type:text" json:"first_response"`      // 1차 응대 가이드
	Process   string    `gorm:"type:text" json:"process"`               // 단계별 해결 프로세스
	Escalation string   `gorm:"type:text" json:"escalation"`           // 에스컬레이션 조건
	Urgency   string    `gorm:"size:20" json:"urgency"`                 // 긴급도: 매우높음, 높음, 보통, 낮음
	Prevention string   `gorm:"type:text" json:"prevention"`           // 예방 액션
	Keywords  string    `gorm:"type:text" json:"keywords"`              // 매칭 키워드 (쉼표 구분)
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// 카테고리 — IssueDetection의 detected_category와 동일
var CSCategories = map[string]string{
	"boiler":      "보일러/온수/가스",
	"checkin":     "체크인/출입/비밀번호",
	"parking":     "주차",
	"reservation": "예약/결제/환불",
	"cleaning":    "청소/위생/비품",
	"emergency":   "긴급/안전",
}
