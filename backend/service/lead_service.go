package service

import (
	"fmt"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type LeadService struct{}

func NewLeadService() *LeadService {
	return &LeadService{}
}

func (s *LeadService) Create(lead *models.OutsourcingLead) error {
	lead.CalculateScore()
	return config.DB.Create(lead).Error
}

func (s *LeadService) GetByID(id uint) (*models.OutsourcingLead, error) {
	var lead models.OutsourcingLead
	if err := config.DB.First(&lead, id).Error; err != nil {
		return nil, err
	}
	return &lead, nil
}

func (s *LeadService) List(status string, grade string) ([]models.OutsourcingLead, error) {
	var leads []models.OutsourcingLead
	query := config.DB.Order("lead_score DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if grade != "" {
		query = query.Where("lead_grade = ?", grade)
	}

	if err := query.Find(&leads).Error; err != nil {
		return nil, err
	}
	return leads, nil
}

func (s *LeadService) Update(lead *models.OutsourcingLead) error {
	lead.CalculateScore()
	return config.DB.Save(lead).Error
}

func (s *LeadService) UpdateStatus(id uint, status models.LeadStatus) error {
	lead, err := s.GetByID(id)
	if err != nil {
		return err
	}

	now := time.Now()
	lead.Status = status

	switch status {
	case models.LeadStatusContacted:
		lead.ContactedAt = &now
	case models.LeadStatusReplied:
		lead.RepliedAt = &now
	case models.LeadStatusDiagnosed:
		lead.DiagnosedAt = &now
	case models.LeadStatusContracted:
		lead.ContractedAt = &now
	}

	return config.DB.Save(lead).Error
}

func (s *LeadService) RecalculateScore(id uint) (*models.OutsourcingLead, error) {
	lead, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	lead.CalculateScore()
	if err := config.DB.Save(lead).Error; err != nil {
		return nil, err
	}
	return lead, nil
}

func (s *LeadService) GenerateMessage(id uint) (string, error) {
	lead, err := s.GetByID(id)
	if err != nil {
		return "", err
	}

	msg := fmt.Sprintf(`안녕하세요, %s님.

%s 지역의 %s 운영 가능성을 보고 연락드렸습니다.

현재 상황이 "%s"라면,
보통 가장 큰 문제는 "%s"에서 생깁니다.

저희는 빈집이나 공실을 단순히 플랫폼에 올리는 것이 아니라,
사진, 가격, 채널 등록, 예약 관리, 청소 배정, CS, 정산 리포트까지 묶어서
실제로 예약이 발생하는 숙소 상품으로 만드는 위탁운영 시스템을 운영하고 있습니다.

먼저 간단히 확인해드릴 수 있는 것:
1. 이 숙소가 단기/미드텀 운영에 적합한지
2. 예상 월매출은 어느 정도인지
3. 손익분기 가동률은 어느 정도인지
4. 사진/구성/가격 중 어디가 문제인지

가능하시면 현재 숙소 사진 몇 장과 대략적인 위치를 보내주세요.
먼저 운영 가능성부터 간단히 진단해드리겠습니다.`,
		lead.Name, lead.Area, lead.PropertyType, lead.CurrentStatus, lead.PainPoint)

	return msg, nil
}

func (s *LeadService) GetCallQuestions() []string {
	return []string{
		"현재 이 공간은 공실인가요, 장기임대 중인가요, 아니면 이미 단기임대를 운영 중인가요?",
		"직접 운영을 하신다면 가장 부담되는 부분은 청소, CS, 예약, 가격, 정산 중 어디인가요?",
		"월 기준으로 어느 정도 수익이 나와야 운영할 가치가 있다고 보시나요?",
		"현재 숙소 사진이나 플랫폼 등록 페이지가 있으신가요?",
		"운영을 맡긴다면 가장 중요하게 보고 싶은 기준은 수익, 투명한 정산, 안정적 관리 중 무엇인가요?",
	}
}

func (s *LeadService) LogActivity(leadID uint, action string, content string, actorID uint) error {
	log := models.LeadActivityLog{
		LeadID:  leadID,
		Action:  action,
		Content: content,
		ActorID: actorID,
	}
	return config.DB.Create(&log).Error
}

func (s *LeadService) GetActivityLogs(leadID uint) ([]models.LeadActivityLog, error) {
	var logs []models.LeadActivityLog
	if err := config.DB.Where("lead_id = ?", leadID).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

func (s *LeadService) GetDashboardStats() map[string]interface{} {
	var totalLeads int64
	var newLeads int64
	var contactedLeads int64
	var repliedLeads int64
	var contractedLeads int64

	config.DB.Model(&models.OutsourcingLead{}).Count(&totalLeads)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "new").Count(&newLeads)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "contacted").Count(&contactedLeads)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "replied").Count(&repliedLeads)
	config.DB.Model(&models.OutsourcingLead{}).Where("status = ?", "contracted").Count(&contractedLeads)

	var todayLeads []models.OutsourcingLead
	today := time.Now().Format("2006-01-02")
	config.DB.Where("status IN (?, ?) AND DATE(created_at) <= ?", "new", "contacted", today).
		Order("lead_score DESC").
		Limit(20).
		Find(&todayLeads)

	return map[string]interface{}{
		"total_leads":        totalLeads,
		"new_leads":          newLeads,
		"contacted_leads":    contactedLeads,
		"replied_leads":      repliedLeads,
		"contracted_leads":   contractedLeads,
		"today_contact_list": todayLeads,
	}
}
