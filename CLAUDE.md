# HIERO-WORKFLOW - 팀 워크플로우 시스템

## Token Rules (최우선 준수)
- CLAUDE.md를 먼저 읽고 프로젝트 구조를 파악한 뒤 작업 시작
- 전체 파일을 무작정 읽지 말고, Grep/Glob으로 필요한 파일만 찾아라
- 수정 전 영향 파일 목록을 먼저 말해라
- 5개 이상 파일 수정 시 계획을 먼저 제시하고 승인 후 진행
- 같은 오류를 2회 반복하면 접근 방식을 바꿔라
- 로그/빌드 결과는 핵심 부분만 사용
- .env, key, token, secret 파일을 출력하지 마라
- rm -rf, DROP, TRUNCATE, force push는 사전 승인 없이 실행하지 마라
- 작업 완료 후 변경 내용 + 요약을 반드시 보여줘라

## Stack
- Backend: Go 1.26 (Gin, GORM, JWT, MySQL on AWS RDS)
- Frontend: React + TypeScript + Vite (port 5180)
- Admin: React + TypeScript + Vite (port 5181)
- 외부 API: Hostex (숙박 플랫폼 연동)
- DB: MySQL (ziero-dev)

## Directory Map
```
backend/
  main.go                — 엔트리포인트 + 시드
  config/database.go     — DB 연결
  router/                — admin.go, api.go, router.go
  handler/               — HTTP 핸들러
    diagnosis.go         — 5엔진 사업 진단 API
    transaction.go       — Hostex 거래 CSV 업로드/집계
    admin_*.go           — 관리자 핸들러
    cleaning.go, issue.go, dashboard.go, webhook.go ...
  service/               — 비즈니스 로직
    diagnosis_service.go      — 5엔진 점수 계산 + 액션맵
    diagnosis_seed_service.go — 자동 진단 생성 (예약/청소/이슈/거래 데이터 집계)
    transaction_service.go    — CSV 파싱 + 월간 집계
    dashboard_service.go, cleaning_service.go, issue_service.go ...
  models/                — DB 모델
    property_business_diagnosis.go — 5엔진 진단 (25개 지표)
    hostex_transaction.go          — Hostex 거래 내역 (CSV)
    property.go, reservation.go, cleaning_task.go, issue.go ...
  hostex/client.go       — Hostex API 클라이언트
  middleware/auth.go     — JWT 인증
frontend/src/            — 운영자 프론트
admin/src/
  pages/
    Dashboard.tsx        — CEO 대시보드 (사업진단 카드 포함)
    Diagnosis.tsx        — 5엔진 진단 리스트 + 상세
    Properties.tsx, Reservations.tsx, Cleaning.tsx, Issues.tsx ...
  components/Layout.tsx  — 사이드바 (사업 진단 메뉴 포함)
```

## Ignore (검색 제외)
- `backend/tmp/`, `frontend/node_modules/`, `admin/node_modules/`

## Key Domains
- 예약(Reservation): Hostex 웹훅 → 예약 동기화, 6,364건+
- 청소(Cleaning): 체크아웃 기반 자동 배정
- 이슈(Issue): 운영 이슈 생성/배정/추적
- 대시보드(Dashboard): CEO 대시보드 (가동률, ADR, 리스크, 매출, 성장)
- 숙소(Property): 101개 (Hostex 100 + 시드 1)
- 사업진단(Diagnosis): 5엔진 × 5지표 = 25개, 15개 자동 + 10개 수동
- 거래(Transaction): Hostex CSV 업로드, 2025~2026 11,641건 임포트 완료

## 5엔진 진단 API
```
GET  /admin/diagnosis              — 전체 리스트 (점수 낮은 순)
GET  /admin/diagnosis/portfolio    — 포트폴리오 요약
GET  /admin/diagnosis/:property_id — 상세
PUT  /admin/diagnosis/:property_id — 수동 점수 수정
POST /admin/diagnosis/generate     — 자동 진단 재생성
POST /admin/transactions/upload    — Hostex CSV 업로드
GET  /admin/transactions/summary   — 월간 거래 집계
```
