package service

import "os"

type SamsamCheckResult struct {
	Ready      bool     `json:"ready"`
	Configured bool     `json:"configured"`
	Mode       string   `json:"mode"`
	Message    string   `json:"message"`
	NextSteps  []string `json:"next_steps"`
}

type SamsamService struct{}

func NewSamsamService() *SamsamService {
	return &SamsamService{}
}

// CheckReadiness — 삼삼엠투 계정 설정 상태 확인
func (s *SamsamService) CheckReadiness() SamsamCheckResult {
	email := os.Getenv("SAMSAM_EMAIL")
	password := os.Getenv("SAMSAM_PASSWORD")
	configured := email != "" && password != ""

	if !configured {
		return SamsamCheckResult{
			Ready:      false,
			Configured: false,
			Mode:       "not_configured",
			Message:    "삼삼엠투 계정이 설정되지 않았습니다.",
			NextSteps: []string{
				".env에 SAMSAM_EMAIL, SAMSAM_PASSWORD 설정",
				"숙소 목록 읽기 전용 수집",
				"계약/예약 데이터 동기화",
			},
		}
	}

	return SamsamCheckResult{
		Ready:      true,
		Configured: true,
		Mode:       "manual_check",
		Message:    "삼삼엠투 연동 준비 완료. 읽기 전용 수집 가능.",
		NextSteps: []string{
			"숙소 50개 목록 수집",
			"계약/예약 데이터 동기화",
			"채팅 이력 수집 (chat_id 기반)",
		},
	}
}
