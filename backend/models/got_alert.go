package models

import "time"

const (
	AlertStatusNew          = "new"          // 신규 (팝업)
	AlertStatusAcknowledged = "acknowledged" // 확인 (접힘)
	AlertStatusForwarded    = "forwarded"    // 전송 (ETF에 전달)
	AlertStatusApproved     = "approved"     // 승인
	AlertStatusRejected     = "rejected"     // 반려
)

// 7단계 의사결정 프로세스
const (
	AlertStep1Detected  = 1 // 감지: 시스템이 이상 감지
	AlertStep2Reviewed  = 2 // 검토: Founder가 데이터 확인
	AlertStep3Decided   = 3 // 판단: 승인/보류/반려 결정
	AlertStep4Forwarded = 4 // 전달: 담당 ETF에게 지시 생성
	AlertStep5Executing = 5 // 실행: ETF가 실행 중
	AlertStep6Verified  = 6 // 확인: Founder가 결과 확인
	AlertStep7Archived  = 7 // 기록: 아카이빙 + 다음 보고서 반영
)

// 알림 유형별 기본 담당 ETF
var AlertAssignMap = map[string]string{
	"cost_spike":    "cfo",
	"revenue_drop":  "ceo",
	"cash_gap":      "cfo",
	"duplicate":     "cfo",
	"refund_spike":  "ceo",
	"occupancy_drop": "ceo",
}

// GOTAlert 이상 감지 알림 (상태 추적용)
type GOTAlert struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	AlertKey string `gorm:"size:100;uniqueIndex;not null" json:"alert_key"`

	// 감지 내용
	Type     string `gorm:"size:30;index" json:"type"`
	Severity string `gorm:"size:20" json:"severity"`
	Title    string `gorm:"size:255" json:"title"`
	Evidence string `gorm:"type:text" json:"evidence"`
	Impact   string `gorm:"type:text" json:"impact"`
	Action   string `gorm:"type:text" json:"action"`
	Value    int64  `json:"value"`
	Category string `gorm:"size:50" json:"category"`

	// 상태
	Status     string     `gorm:"size:20;index;default:'new'" json:"status"`
	ActionBy   string     `gorm:"size:100" json:"action_by"`
	ActionMemo string     `gorm:"type:text" json:"action_memo"`
	ActionAt   *time.Time `json:"action_at"`

	// 7단계 의사결정 프로세스
	Step        int    `gorm:"default:1" json:"step"`          // 현재 단계 (1~7)
	AssignTo    string `gorm:"size:30" json:"assign_to"`       // 담당 ETF (ceo/cto/cfo)
	DirectiveID *uint  `gorm:"index" json:"directive_id"`      // 4단계에서 생성된 지시 ID
	Decision    string `gorm:"size:20" json:"decision"`        // approved/hold/rejected

	// 전송 대상 (forwarded일 때)
	ForwardedTo string `gorm:"size:30" json:"forwarded_to"`

	Period    string    `gorm:"size:20;index" json:"period"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
