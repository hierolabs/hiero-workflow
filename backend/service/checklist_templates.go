package service

// ChecklistTemplate 체크리스트 템플릿 정의
type ChecklistTemplate struct {
	ID        string
	Page      string
	Mode      string // manage, execute
	Frequency string // daily, weekly
	WeekDay   int    // 0=매일, 1=월...7=일 (weekly용)
	Title     string
	SortOrder int
}

// DailyTemplates 매뉴얼 관리/실행 모드에서 추출한 루틴
var ChecklistTemplates = []ChecklistTemplate{
	// === 대시보드 — 관리 모드 (매일 아침) ===
	{ID: "dash-m-1", Page: "dashboard", Mode: "manage", Frequency: "daily", Title: "전일 예약 현황 확인 (신규/취소/변경)", SortOrder: 1},
	{ID: "dash-m-2", Page: "dashboard", Mode: "manage", Frequency: "daily", Title: "오늘 체크인/체크아웃 확인", SortOrder: 2},
	{ID: "dash-m-3", Page: "dashboard", Mode: "manage", Frequency: "daily", Title: "미배정 청소 태스크 확인", SortOrder: 3},
	{ID: "dash-m-4", Page: "dashboard", Mode: "manage", Frequency: "daily", Title: "미처리 이슈 확인", SortOrder: 4},
	{ID: "dash-m-5", Page: "dashboard", Mode: "manage", Frequency: "daily", Title: "미답변 게스트 메시지 확인", SortOrder: 5},

	// === 예약 관리 — 관리 모드 (매일) ===
	{ID: "res-m-1", Page: "reservations", Mode: "manage", Frequency: "daily", Title: "체크인 탭 > 오늘 — 안내 메시지·청소·도어락 확인", SortOrder: 10},
	{ID: "res-m-2", Page: "reservations", Mode: "manage", Frequency: "daily", Title: "체크아웃 탭 > 오늘 — 청소 배정·다음 체크인 여유 확인", SortOrder: 11},
	{ID: "res-m-3", Page: "reservations", Mode: "manage", Frequency: "daily", Title: "연장 탭 — 청소 스킵 대상 처리", SortOrder: 12},

	// === 예약 관리 — 실행 모드 (매일) ===
	{ID: "res-e-1", Page: "reservations", Mode: "execute", Frequency: "daily", Title: "체크인 손님 확인 + 안내 메시지 발송", SortOrder: 20},
	{ID: "res-e-2", Page: "reservations", Mode: "execute", Frequency: "daily", Title: "체크아웃 손님 확인 + 청소 배정 확인", SortOrder: 21},
	{ID: "res-e-3", Page: "reservations", Mode: "execute", Frequency: "daily", Title: "연장 예약 → 청소 스킵 대상 식별", SortOrder: 22},

	// === 청소 관리 — 관리 모드 (매일) ===
	{ID: "clean-m-1", Page: "cleaning", Mode: "manage", Frequency: "daily", Title: "오늘 청소 배정 현황 확인", SortOrder: 30},
	{ID: "clean-m-2", Page: "cleaning", Mode: "manage", Frequency: "daily", Title: "미배정 청소 태스크 처리", SortOrder: 31},

	// === 예약 관리 — 관리 모드 (주간) ===
	{ID: "res-m-w1", Page: "reservations", Mode: "manage", Frequency: "weekly", WeekDay: 1, Title: "[월] 이번 주 체크인/아웃 전체 조회, 인력 배분", SortOrder: 40},
	{ID: "res-m-w3", Page: "reservations", Mode: "manage", Frequency: "weekly", WeekDay: 3, Title: "[수] 공실 확인, 직전 할인 대상 선정", SortOrder: 41},
	{ID: "res-m-w5", Page: "reservations", Mode: "manage", Frequency: "weekly", WeekDay: 5, Title: "[금] 주말 체크인 집중 점검", SortOrder: 42},
}
