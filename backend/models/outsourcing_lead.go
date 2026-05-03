package models

import (
	"time"
)

type LeadStatus string

const (
	LeadStatusNew             LeadStatus = "new"
	LeadStatusContacted       LeadStatus = "contacted"
	LeadStatusReplied         LeadStatus = "replied"
	LeadStatusDiagnosed       LeadStatus = "diagnosed"
	LeadStatusProposalSent    LeadStatus = "proposal_sent"
	LeadStatusContractPending LeadStatus = "contract_pending"
	LeadStatusContracted      LeadStatus = "contracted"
	LeadStatusRejected        LeadStatus = "rejected"
)

type OutsourcingLead struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Name            string `gorm:"size:100" json:"name"`
	Phone           string `gorm:"size:50" json:"phone"`
	Email           string `gorm:"size:100" json:"email"`
	Area            string `gorm:"size:100" json:"area"`
	PropertyType    string `gorm:"size:100" json:"property_type"`
	CurrentStatus   string `gorm:"type:text" json:"current_status"`
	PainPoint       string `gorm:"type:text" json:"pain_point"`
	ExpectedRevenue int64  `json:"expected_revenue"`
	ContactChannel  string `gorm:"size:50" json:"contact_channel"`

	Status LeadStatus `gorm:"size:50;default:'new'" json:"status"`

	HasVacancy       bool `json:"has_vacancy"`
	HasOperationPain bool `json:"has_operation_pain"`
	HasRevenuePain   bool `json:"has_revenue_pain"`
	HasPhotos        bool `json:"has_photos"`
	ReadyToOperate   bool `json:"ready_to_operate"`

	LeadScore  int    `json:"lead_score"`
	LeadGrade  string `gorm:"size:10" json:"lead_grade"`
	NextAction string `gorm:"type:text" json:"next_action"`
	Memo       string `gorm:"type:text" json:"memo"`

	ContactedAt  *time.Time `json:"contacted_at"`
	RepliedAt    *time.Time `json:"replied_at"`
	DiagnosedAt  *time.Time `json:"diagnosed_at"`
	ContractedAt *time.Time `json:"contracted_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (l *OutsourcingLead) CalculateScore() {
	score := 0

	if l.HasVacancy {
		score += 30
	}
	if l.HasOperationPain {
		score += 25
	}
	if l.HasRevenuePain {
		score += 25
	}

	seoulAreas := []string{"서울", "강동", "종로", "마포", "강남", "홍대", "성동", "용산", "서초", "송파"}
	for _, area := range seoulAreas {
		if containsKorean(l.Area, area) {
			score += 10
			break
		}
	}

	targetTypes := []string{"오피스텔", "다가구", "빌라", "도시형생활주택", "단독주택"}
	for _, t := range targetTypes {
		if l.PropertyType == t {
			score += 10
			break
		}
	}

	if l.HasPhotos {
		score += 5
	}
	if l.ReadyToOperate {
		score += 15
	}

	l.LeadScore = score
	l.LeadGrade = classifyLeadGrade(score)
	l.NextAction = recommendLeadAction(score)
}

func classifyLeadGrade(score int) string {
	if score >= 90 {
		return "A"
	}
	if score >= 70 {
		return "B"
	}
	if score >= 50 {
		return "C"
	}
	return "D"
}

func recommendLeadAction(score int) string {
	if score >= 90 {
		return "즉시 전화 상담 → 사진/주소 수집"
	}
	if score >= 70 {
		return "개인화 메시지 발송 → 답장 시 진단 상담"
	}
	if score >= 50 {
		return "위탁운영 사례 콘텐츠 발송 → 3일 후 후속 연락"
	}
	return "DB 저장 → 추후 육성"
}

func containsKorean(s, substr string) bool {
	if len(s) == 0 || len(substr) == 0 {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

type LeadActivityLog struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	LeadID uint `json:"lead_id"`

	Action  string `gorm:"size:100" json:"action"`
	Content string `gorm:"type:text" json:"content"`
	ActorID uint   `json:"actor_id"`

	CreatedAt time.Time `json:"created_at"`
}

type MessageTemplate struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Name         string `gorm:"size:100" json:"name"`
	TargetType   string `gorm:"size:50" json:"target_type"`
	Stage        string `gorm:"size:50" json:"stage"`
	TemplateBody string `gorm:"type:text" json:"template_body"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Campaign struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Name       string `gorm:"size:200" json:"name"`
	TargetType string `gorm:"size:50" json:"target_type"`
	Status     string `gorm:"size:50;default:'draft'" json:"status"`

	TotalLeads int `json:"total_leads"`
	Contacted  int `json:"contacted"`
	Replied    int `json:"replied"`
	Diagnosed  int `json:"diagnosed"`
	Contracted int `json:"contracted"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
