# HIERO-WORKFLOW - 팀 워크플로우 시스템

## Stack
- Backend: Go 1.26 (Gin, GORM, JWT, MySQL)
- Frontend: React + TypeScript + Vite
- Admin: React + TypeScript + Vite (별도 앱)
- 외부 API: Hostex (숙박 플랫폼 연동)

## Directory Map
```
backend/
  main.go              — 엔트리포인트
  config/database.go   — DB 연결 설정
  router/              — 라우터 (admin, api, router)
  handler/             — HTTP 핸들러
    admin_*.go         — 관리자 전용 핸들러
    webhook.go         — Hostex 웹훅 수신
    cleaning.go        — 청소 관리
    issue.go           — 이슈 관리
    communication.go   — 커뮤니케이션 로그
    dashboard.go       — 대시보드
  service/             — 비즈니스 로직
    hostex_sync_service.go  — Hostex 동기화
    cleaning_service.go     — 청소 배정/관리
    issue_service.go        — 이슈 처리
    communication_service.go — 알림/메시지
    dashboard_service.go    — 대시보드 집계
  models/              — DB 모델
    reservation.go     — 예약
    cleaning_task.go   — 청소 태스크
    issue.go           — 이슈
    task.go            — 일반 태스크
    communication_log.go — 커뮤니케이션 기록
    webhook_log.go     — 웹훅 수신 로그
  hostex/client.go     — Hostex API 클라이언트
  middleware/auth.go   — JWT 인증 미들웨어
  dto/property.go      — 데이터 전송 객체
frontend/
  src/App.tsx          — 메인 앱
admin/
  src/
    components/        — 공통 컴포넌트
    features/          — 기능별 모듈
    pages/             — 페이지
    utils/             — 유틸리티
docs/                  — 프로젝트 문서 (개발지시서, 체계도 등)
```

## Ignore (검색 제외)
- `backend/tmp/` — air 핫리로드 임시 파일
- `frontend/node_modules/`
- `admin/node_modules/`

## Key Domains
- 예약(Reservation): Hostex 웹훅 수신 → 예약 동기화
- 청소(Cleaning): 체크아웃 기반 자동 배정, 청소원 관리
- 이슈(Issue): 운영 이슈 생성/배정/추적
- 대시보드(Dashboard): 운영 현황 집계
- 커뮤니케이션(Communication): 팀 알림/메시지 로그
- 숙소(Property): 숙소 마스터 + 엑셀 업로드
