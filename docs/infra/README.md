# heiro.labs 데이터 인프라 매뉴얼

> 최종 수정: 2026-05-08
> 이 문서는 heiro.labs의 전체 데이터 저장 구조를 설명합니다.
> 새로운 개발자가 이 문서만 보고 시스템을 이해하고 복구할 수 있어야 합니다.

---

## 1. 전체 구조

```
┌──────────────────────────────────────────────────────────┐
│  데이터 유입                                              │
│                                                          │
│  ① Hostex Webhook (자동)                                 │
│  ② Hostex CSV (수동 업로드)                               │
│  ③ 관리자 입력 (Admin UI)                                │
│  ④ AI 자동 생성 (GPT-4o-mini)                            │
│  ⑤ 근태 자동 추적 (하트비트)                              │
│  ⑥ 문서 업로드 (파일 아카이빙)                            │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  Go Backend (Gin + GORM)                                 │
│  Port: 8080                                              │
│  경로: hiero-workflow/backend/                            │
└──────┬──────────────────────────────────┬────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────┐            ┌─────────────────────────┐
│  AWS RDS MySQL   │            │  로컬 파일 저장소        │
│  heiro-dev       │            │  ./uploads/             │
│  서울 리전        │            │  8개 카테고리 폴더       │
│  42+ 테이블       │            │  documents 테이블 연동   │
└──────────────────┘            └─────────────────────────┘
```

---

## 2. 데이터베이스

### 접속 정보

```
호스트:   dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com
포트:     3306
DB명:     heiro-dev
유저:     admin
비밀번호: .env 파일의 DB_PASSWORD 참조
엔진:     MySQL 8.4 (ARM, aarch64)
리전:     ap-northeast-2 (서울)
서비스:   AWS RDS
```

### .env 설정

```
DB_HOST=dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=heiro-dev
DB_USER=admin
DB_PASSWORD=<비밀번호>
PORT=8080
```

### 커넥션 풀

```
MaxOpenConns:     50
MaxIdleConns:     20
ConnMaxLifetime:  1시간
ConnMaxIdleTime:  5분
```

설정 파일: `backend/config/database.go`

---

## 3. 테이블 분류

### 운영 (Operations)

| 테이블 | 설명 | 데이터 소스 | 예상 규모 |
|--------|------|-------------|-----------|
| properties | 숙소 마스터 | Hostex API + 시드 | ~100채 |
| reservations | 예약 | Hostex Webhook | ~11,000건+ |
| cleaning_tasks | 청소 업무 | 체크아웃 기반 자동 생성 | 매일 증가 |
| cleaning_codes | 청소 권역·단가 | 시드 (엑셀 기반) | ~112건 |
| cleaners | 청소자 마스터 | 시드 + 수동 관리 | ~22명 |
| conversations | 게스트 대화방 | Hostex 동기화 | ~150개 |
| messages | 게스트 메시지 | Hostex 동기화 | ~2,000건+ |
| reviews | 게스트 리뷰 | Hostex 동기화 | ~430건 |
| guest_requests | 게스트 특수 요청 | 수동 입력 | 수시 |

### 재무 (Finance)

| 테이블 | 설명 | 데이터 소스 |
|--------|------|-------------|
| hostex_transactions | Hostex CSV 거래 | CSV 수동 업로드 (~12,700건) |
| cost_raw | 비용 원본 | CSV 임포트 |
| cost_allocations | 비용 월별 분할 | cost_raw 기반 자동 계산 |
| monthly_property_reports | 월간 P&L 스냅샷 | CSV 파싱 |
| property_costs | 숙소별 고정비 | 수동 입력 |

### 워크플로우 (Workflow)

| 테이블 | 설명 |
|--------|------|
| issues | 운영 이슈 (민원·하자·의사결정) |
| issue_detections | AI 메시지 이슈 감지 |
| tasks | 업무 태스크 |
| checklist_items | 일일 운영 체크리스트 |
| communication_logs | 운영 응대 기록 |
| webhook_logs | Hostex 웹훅 수신 로그 |

### 조직·인사 (People)

| 테이블 | 설명 |
|--------|------|
| admin_users | 관리자 계정 (9명) |
| roles | 역할 정의 (8개) |
| permissions | 권한 (47개) |
| role_permissions | 역할-권한 매핑 |
| user_roles | 사용자-역할 매핑 |
| user_sessions | 로그인/로그아웃 세션 (자동 근태) |
| user_activities | 페이지 방문·액션 기록 |
| activity_logs | 이슈 생성/배정/해결 이력 |
| notifications | 사내 알림 |

### 마케팅 (Growth)

| 테이블 | 설명 |
|--------|------|
| outsourcing_leads | 위탁운영 리드 |
| lead_activity_logs | 리드 활동 이력 |
| campaigns | 마케팅 캠페인 |
| message_templates | 메시지 템플릿 |

### AI·지식 (Knowledge)

| 테이블 | 설명 |
|--------|------|
| ai_conversations | AI Agent 대화 기록 |
| ai_memories | AI 장기 기억 |
| wiki_articles | Hestory 섹션 (~155개) |
| wiki_revisions | 위키 수정 이력 |
| manual_entries | 운영 매뉴얼 (구버전) |
| property_business_diagnoses | 5엔진 사업진단 (25지표) |

### 협업 (Collaboration)

| 테이블 | 설명 |
|--------|------|
| chat_channels | 팀 채팅방 |
| chat_messages | 팀 채팅 메시지 |
| chat_channel_members | 채널 멤버십 |

### 문서 (Documents)

| 테이블 | 설명 |
|--------|------|
| documents | 업로드 파일 메타데이터 (파일은 ./uploads/) |

---

## 4. 파일 저장소

### 경로

```
hiero-workflow/backend/uploads/
├── contract/      계약서 (전대차, 위탁운영, 렌탈, 리스)
├── report/        보고서 (CEO/CFO/CTO 월간, 주간)
├── tax/           세무 (신고서, 증빙, 세무사 전달자료)
├── hr/            인사 (근로계약서, 급여대장, 4대보험)
├── operation/     운영 (체크리스트, 매뉴얼, 현장 사진)
├── csv_backup/    CSV 원본 (Hostex 거래 CSV 등)
├── photo/         사진 (숙소, 청소 비포/애프터)
└── other/         기타
```

### 파일명 규칙

```
YYYYMMDD_HHMMSS_원본파일명
예: 20260508_143022_전대차계약서_마포구.pdf
```

### API

```
POST   /admin/documents/upload         파일 업로드 (form-data: file, category, description, year, month)
GET    /admin/documents                목록 조회 (?category=contract&year=2026)
GET    /admin/documents/summary        카테고리별 통계
GET    /admin/documents/:id/download   파일 다운로드
DELETE /admin/documents/:id            파일 삭제
```

### 서버 이전 시

```bash
# 1. uploads 폴더 통째로 복사
scp -r ./uploads/ newserver:/path/to/hiero-workflow/backend/uploads/

# 2. DB dump
mysqldump -h <호스트> -u admin -p --single-transaction --no-tablespaces --set-gtid-purged=OFF heiro-dev > backup.sql

# 3. 새 서버에서 import
mysql -u admin -p heiro-dev < backup.sql
```

---

## 5. 데이터 유입 경로 상세

### ① Hostex Webhook (자동)

```
Hostex 서버 → POST /api/webhooks/hostex
→ 예약 생성/변경/취소
→ reservations, properties, conversations, messages, reviews 업데이트
```

- 실시간 수신, 서버가 꺼지면 누락됨
- 서버 시작 시 전체 동기화 실행 (백그라운드)
- 코드: `backend/handler/webhook.go`, `backend/hostex/client.go`

### ② Hostex CSV (수동)

```
관리자가 Hostex → 거래 내역 CSV 다운로드
→ POST /admin/transactions/upload
→ hostex_transactions 테이블에 파싱 저장
→ ⚠️ 원본 CSV는 저장되지 않음 (documents API로 별도 보관 권장)
```

- 코드: `backend/handler/transaction.go` Upload 메서드
- 16개월 12,700+ 건 축적

### ③ 관리자 입력 (수동)

```
Admin UI → 각종 CRUD API
→ issues, cleaning_tasks, leads, costs, wiki_articles 등
```

### ④ AI 자동 생성

```
GPT-4o-mini → POST /admin/ai/agent
→ ai_conversations (대화), ai_memories (장기기억)
→ issue_detections (메시지 이슈 감지)
→ property_business_diagnoses (5엔진 진단)
```

### ⑤ 근태 자동 추적

```
로그인 → user_sessions 생성
5분마다 → POST /admin/attendance/heartbeat
로그아웃 → user_sessions 종료 + duration 계산
페이지 방문 → user_activities 기록
```

### ⑥ 문서 아카이빙

```
POST /admin/documents/upload (multipart/form-data)
→ 파일 → ./uploads/{category}/{timestamp}_{filename}
→ 메타데이터 → documents 테이블
```

---

## 6. 백업 전략

### 현재 상태

```
DB 백업:    AWS RDS 자동 스냅샷 (기본 7일, 설정 확인 필요)
파일 백업:  없음 (uploads/ 폴더 수동 복사 필요)
코드 백업:  Git (로컬)
```

### 권장 백업 절차

```bash
# 매일 실행 (cron 등록 권장)

# 1. DB 덤프
DATE=$(date +%Y%m%d)
mysqldump -h dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com \
  -u admin -p"$DB_PASSWORD" \
  --single-transaction --no-tablespaces --set-gtid-purged=OFF \
  heiro-dev > ~/backups/db/heiro-dev_${DATE}.sql

# 2. uploads 폴더 압축
tar -czf ~/backups/files/uploads_${DATE}.tar.gz -C ./backend uploads/

# 3. 30일 이전 백업 삭제
find ~/backups/ -name "*.sql" -mtime +30 -delete
find ~/backups/ -name "*.tar.gz" -mtime +30 -delete
```

### 자체 서버 구축 시 체크리스트

```
□ Go 1.26+ 설치
□ MySQL 8.x 설치 또는 RDS 유지
□ .env 파일 설정 (DB_HOST, DB_PASSWORD 등)
□ uploads/ 폴더 복사
□ DB dump import
□ go run main.go 또는 빌드 후 실행
□ cron으로 백업 스크립트 등록
□ Hostex Webhook URL을 새 서버 IP로 변경
□ 프론트엔드 VITE_API_URL 변경
□ 방화벽: 8080(백엔드), 5180(프론트), 5181(어드민) 오픈
```

---

## 7. RDS 내 다른 DB 현황

| DB | 용도 | 상태 |
|----|------|------|
| **heiro-dev** | 메인 운영 DB | 운영 중 |
| ziero-dev | 마이그레이션 전 원본 백업 | 유지 (삭제 금지) |
| HEIRO | 구 hiero 프로젝트 잔존 데이터 | 참조용 |
| hiero_workflow | 빈 껍데기 | 삭제 가능 |
| dingdone-dev | 띵동 초기 프로토타입 | 별도 프로젝트 |
| gongsaeng-dev | 공생 프로젝트 | 별도 프로젝트 |
| moro-dev | MORO 프로젝트 | 별도 프로젝트 |
| openletter-dev | 오픈레터 프로젝트 | 별도 프로젝트 |
| teacher-dev | 교육 프로젝트 | 별도 프로젝트 |

---

## 8. 모니터링

### ETF Board에서 확인 가능한 것

```
GET /admin/infra        — DB 용량, 테이블별 행수/MB, 서버 uptime
GET /admin/multidata    — 13개 데이터 폴더 실시간 집계
GET /admin/attendance/today — 오늘 접속 현황
GET /admin/documents/summary — 문서 카테고리별 통계
```

### 주의 사항

```
⚠️ RDS 최대 연결 60개 — 동시 접속자 많으면 커넥션 에러
⚠️ CSV 업로드 시 원본 파일 별도 보관할 것
⚠️ uploads/ 폴더는 Git에 포함하지 말 것 (.gitignore)
⚠️ 서버 재시작 시 Hostex 전체 동기화 자동 실행됨 (부하 주의)
```
