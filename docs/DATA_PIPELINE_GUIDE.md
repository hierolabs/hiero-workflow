# HIERO 데이터 파이프라인 가이드

> 작성일: 2026-05-09
> 목적: 전체 DB 현황 파악 + 빈 테이블 채우기 + Derived Data 자동화 로드맵

---

## 1. 전체 데이터 구조 (3-Tier)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Tier 1: RAW (원본 데이터)                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  외부 소스에서 그대로 들어온 데이터                       │   │
│   │  · Hostex Webhook/API → reservations, messages      │   │
│   │  · Hostex CSV 업로드 → hostex_transactions           │   │
│   │  · PriceLabs API → pricelabs_prices                  │   │
│   │  · 삼삼엠투 크롤링 → samsam_rooms, samsam_contracts   │   │
│   │  · 카톡 파싱 → chat_histories                        │   │
│   │  ⚠️ 원칙: 원본은 절대 수정하지 않음                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│   Tier 2: OPERATIONAL (운용 데이터)                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  비즈니스 로직으로 가공/관리되는 핵심 데이터              │   │
│   │  · properties (마스터)                                │   │
│   │  · cleaning_tasks (청소 배정/완료)                     │   │
│   │  · issues (이슈 추적)                                 │   │
│   │  · property_costs (숙소별 고정비)                      │   │
│   │  · cost_raw → cost_allocations (비용 분배)            │   │
│   │  ⚠️ 원칙: State Transition으로 상태 관리               │   │
│   └─────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│   Tier 3: DERIVED (분석/집계 데이터)                          │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Tier 1+2를 집계/분석한 결과. 재생성 가능               │   │
│   │  · monthly_property_reports (월간 P&L)               │   │
│   │  · property_business_diagnoses (5엔진 진단)           │   │
│   │  · market_prices (시장 경쟁가 분석)                    │   │
│   │  · [미래] channel_performance (채널별 수익률)           │   │
│   │  · [미래] cleaning_analytics (청소 동선/효율)           │   │
│   │  ⚠️ 원칙: 언제든 재계산 가능, 캐시 성격                 │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 전체 테이블 현황 (59개)

### 2-1. Tier 1: RAW 데이터 (외부 유입)

| 테이블 | 행 수 | 원본 소스 | 유입 방식 | 주기 | 상태 |
|--------|-------|----------|----------|------|------|
| `reservations` | 11,558 | Hostex API/Webhook | 자동 Pull + Webhook | 5분 | ✅ |
| `hostex_transactions` | 12,948 | Hostex CSV 다운로드 | 수동 업로드 | 월 1회 | ✅ |
| `messages` | 42,587 | Hostex API | 자동 Pull | 5분 | ✅ |
| `conversations` | 3,499 | Hostex API | 자동 Pull | 5분 | ✅ |
| `reviews` | 436 | Hostex API | 자동 Pull | 5분 | ✅ |
| `pricelabs_listings` | 55 | PriceLabs API | 자동 Pull | 5분 | ✅ |
| `pricelabs_prices` | 27,405 | PriceLabs API | 자동 Pull | 5분 | ✅ |
| `listing_calendars` | 6,366 | Hostex API | 자동 Pull | 부팅 시 | ✅ |
| `samsam_rooms` | 92 | 삼삼엠투 크롤링 | 수동 (브라우저 스크립트) | 수시 | ✅ |
| `samsam_contracts` | 1,825 | 삼삼엠투 크롤링 | 수동 (브라우저 스크립트) | 수시 | ✅ |
| `chat_histories` | 52,550 | 카카오톡 .txt 파일 | 수동 업로드 | 수시 | ✅ |
| `webhook_logs` | 35 | Hostex Webhook | 자동 | 실시간 | ✅ |

### 2-2. Tier 2: OPERATIONAL 데이터 (비즈니스 로직)

**마스터 데이터 (기준 정보)**

| 테이블 | 행 수 | 설명 | 유입 | 상태 |
|--------|-------|------|------|------|
| `properties` | 101 | **전체 시스템 중심축** | API + 수동 | ✅ |
| `admin_users` | 9 | 관리자 계정 | 수동 | ✅ |
| `roles` | 8 | 역할 정의 | 시드 | ✅ |
| `permissions` | 47 | 권한 정의 | 시드 | ✅ |
| `role_permissions` | 49 | 역할-권한 매핑 | 시드 | ✅ |
| `user_roles` | 9 | 사용자-역할 매핑 | 수동 | ✅ |
| `cleaners` | 21 | 청소 인력 | 수동 | ✅ |
| `cleaning_codes` | 112 | 숙소별 청소 단가 | 수동 | ✅ |
| `investors` | 2 | 투자자/오너 | 수동 | ✅ |
| `property_platforms` | 82 | 숙소-OTA 매핑 | 수동 | ✅ |

**운영 데이터 (상태 변화)**

| 테이블 | 행 수 | 설명 | State Transition | 상태 |
|--------|-------|------|-----------------|------|
| `cleaning_tasks` | 94 | 청소 배정/완료 | pending→assigned→dispatched→completed | ✅ |
| `cleaning_records` | 1,276 | 청소 이력 (manual_entries) | - | ✅ |
| `issues` | 15 | 운영 이슈 | open→in_progress→resolved→closed | ✅ |
| `issue_detections` | 4,402 | AI 이슈 감지 | pending→responding→resolved/dismissed | ✅ |
| `communication_logs` | 11 | 커뮤니케이션 기록 | - | ✅ |
| `outsourcing_leads` | 2 | 위탁영업 리드 | new→contacted→...→contracted | ✅ |
| `lead_activity_logs` | 19 | 리드 활동 기록 | - | ✅ |
| `tasks` | 0 | 내부 업무 | PENDING→DONE | ⚠️ 비어있음 |
| `notifications` | 5 | 알림 | - | ✅ |
| `checklist_items` | 14 | 일일 체크리스트 | - | ✅ |
| `wiki_articles` | 69 | 운영 위키 | empty→draft→review→published | ✅ |
| `wiki_revisions` | 0 | 위키 수정 이력 | - | ⚠️ 비어있음 |
| `manual_entries` | 14 | 운영 매뉴얼 | - | ✅ |
| `documents` | 0 | 파일 메타데이터 | - | ❌ 미사용 |
| `user_sessions` | 32 | 출근/세션 | - | ✅ |
| `user_activities` | 21 | 행동 추적 | - | ✅ |

**비용/정산 데이터 (재무)**

| 테이블 | 행 수 | 설명 | 원본 | 상태 |
|--------|-------|------|------|------|
| `property_costs` | **0** | 숙소별 고정비 (월세/관리비) | 엑셀 미입력 | ❌ 비어있음 |
| `cost_raw` | **0** | 비용 원본 | CSV/수동 미입력 | ❌ 비어있음 |
| `cost_allocations` | **0** | 비용 월별 분배 | cost_raw 미생성 | ❌ 비어있음 |
| `property_investors` | **0** | 숙소-투자자 매핑 | 수동 미입력 | ❌ 비어있음 |

### 2-3. Tier 3: DERIVED 데이터 (분석/집계)

| 테이블 | 행 수 | 설명 | 원본 | 집계 주기 | 상태 |
|--------|-------|------|------|----------|------|
| `property_business_diagnoses` | 101 | 5엔진 진단 (25지표) | 전체 종합 | 수동/배치 | ✅ |
| `monthly_property_reports` | **0** | 숙소별 월간 P&L | transactions+costs | 월 1회 | ❌ 비어있음 |
| `market_prices` | **0** | 시장 경쟁가격 | 삼삼엠투 크롤링 | 주 1회 | ❌ 비어있음 |
| `market_contracts` | **0** | 시장 계약 현황 | 삼삼엠투 크롤링 | 주 1회 | ❌ 비어있음 |
| `crawl_jobs` | **0** | 크롤링 작업 이력 | 시스템 | 수시 | ❌ 비어있음 |
| `cs_knowledges` | 10 | CS 지식베이스 | 통화 분석 | 수동 | ✅ |
| `ai_conversations` | 6 | AI 대화 이력 | 사용자 입력 | 수시 | ✅ |
| `ai_memories` | **0** | AI 장기 기억 | AI 추출 | 자동 | ⚠️ |

**기타 (미사용)**

| 테이블 | 행 수 | 비고 |
|--------|-------|------|
| `activity_logs` | 0 | 이벤트 발행 미연결 |
| `guest_requests` | 0 | UI 미사용 |
| `onboarding_checks` | 0 | 숙소 셋업 체크 미사용 |
| `monthly_property_reports` | 0 | 집계 미실행 |
| `message_templates` | 0 | 리드 메시지 템플릿 미사용 |
| `campaigns` | 0 | 마케팅 캠페인 미사용 |
| `property_parkings` | 0 | 주차 정보 미입력 |
| `chat_channels` | 4 | 팀채팅 채널 |
| `chat_messages` | 0 | 팀채팅 메시지 미사용 |
| `chat_channel_members` | 0 | 팀채팅 멤버 미사용 |

---

## 3. 데이터 관계도 (ERD 핵심)

```
                        ┌──────────────┐
                        │  properties  │ ← 전체 시스템 중심축 (101개)
                        │  (마스터)     │
                        └──────┬───────┘
           ┌──────────────┬────┼────┬──────────────┬────────────┐
           ↓              ↓    ↓    ↓              ↓            ↓
    ┌────────────┐ ┌──────────┐│┌──────────┐┌───────────┐┌──────────┐
    │reservations│ │cleaning_ │││  issues  ││hostex_    ││property_ │
    │(11,558)    │ │tasks(94) │││  (15)    ││transactions││costs (0) │
    └─────┬──────┘ └──────────┘│└──────────┘│(12,948)   │└──────────┘
          │                    │            └─────┬─────┘
          │    ┌───────────────┘                   │
          ↓    ↓                                   ↓
    ┌────────────┐                          ┌───────────┐
    │conversations│                         │cost_raw   │
    │(3,499)     │                          │(0)        │
    └─────┬──────┘                          └─────┬─────┘
          ↓                                       ↓
    ┌────────────┐                          ┌───────────────┐
    │ messages   │                          │cost_allocations│
    │ (42,587)   │                          │(0)            │
    └─────┬──────┘                          └───────┬───────┘
          ↓                                         ↓
    ┌────────────────┐                    ┌─────────────────────┐
    │issue_detections│                    │monthly_property_    │
    │(4,402)         │                    │reports (0)          │
    └────────────────┘                    └─────────────────────┘

    JOIN 키: reservations.reservation_code = hostex_transactions.reservation_ref
```

---

## 4. 데이터 유입 파이프라인 상세

### 4-1. 자동화 파이프라인 (현재 작동 중)

```
[Hostex Webhook] ──실시간──→ reservations (upsert)
                              messages (insert)
                              reviews (upsert)

[Hostex API]     ──5분 주기──→ reservations (sync)
                              conversations (sync)
                              messages (sync)
                              reviews (sync)

[PriceLabs API]  ──5분 주기──→ pricelabs_listings (upsert)
                              pricelabs_prices (upsert)

[AI 감지 엔진]   ──메시지 수신 시──→ issue_detections (insert)
                                  6카테고리 키워드 매칭
                                  severity 자동 분류
```

### 4-2. 수동 파이프라인 (현재 작동 중)

```
[Hostex CSV 다운로드] ──관리자 업로드──→ hostex_transactions
  POST /admin/transactions/upload       (월 1회, 유일한 매출 신뢰 소스)

[삼삼엠투 크롤링]    ──브라우저 스크립트──→ JSON 파일
  scripts/samsam_collect.js              ──→ docs/samsam/*.json
                                         ──→ samsam_rooms, samsam_contracts

[카카오톡 로그]      ──관리자 업로드──→ chat_histories
  POST /admin/chat-history/upload        (텍스트 파싱)
```

### 4-3. 끊어진 파이프라인 (구현 필요)

```
❌ [엑셀: 월세/관리비/청소비] ──→ property_costs (수동 입력 or CSV 임포트)
❌ [hostex_transactions]      ──→ cost_raw (비용 항목 추출)
❌ [cost_raw]                 ──→ cost_allocations (1/n 일할 분배)
❌ [reservations + costs]     ──→ monthly_property_reports (월간 집계)
❌ [삼삼엠투 JSON]            ──→ market_prices (DB 적재)
❌ [전체 데이터]              ──→ property_business_diagnoses (자동 갱신)
```

---

## 5. 빈 테이블 채우기 로드맵

### Phase 1: 비용 기초 데이터 (가장 시급)

**왜 먼저?** 비용 없이는 순수익 계산이 불가능. Profit.tsx가 목 데이터를 쓰고 있음.

```
Step 1-1: property_costs 채우기
  · 101개 숙소의 고정비 입력 (월세, 관리비, 보증금)
  · 방법 A: 관리자 UI에서 CRUD (이미 API 있음, UI 미연결)
  · 방법 B: 엑셀/CSV 일괄 임포트 스크립트
  · 원본: Downloads/월세납부리스트.xlsx, 관리비납부.xlsx

Step 1-2: cost_raw 채우기
  · hostex_transactions에서 비용 항목(type='비용') 추출
  · POST /admin/costs/import-from-transactions (이미 구현됨, 미실행)
  · 엑셀 비용(청소비 납부대장 등)도 CSV 변환 후 임포트

Step 1-3: cost_allocations 생성
  · cost_raw → 월별 1/n 일할 분배
  · POST /admin/costs/reallocate (이미 구현됨, 미실행)
  · 배분 로직: daily_prorate / full_month / manual
```

**완료 시 효과:**
- 숙소별 순수익 = hostex_transactions(매출) - cost_allocations(비용)
- Profit.tsx 목 데이터 → 실데이터 전환
- Settlement 페이지 정산 완성

---

### Phase 2: 월간 리포트 자동 집계

**왜?** 매번 "4월 매출 분석해줘" 하면 raw 데이터에서 재계산하는 낭비 제거.

```
Step 2-1: monthly_property_reports 집계 배치 생성
  · 입력: reservations + hostex_transactions + cost_allocations
  · 출력: 숙소별 월간 행 1개
    {
      property_id, month,
      aor(점유율), adr(평균단가),
      room(객실매출), cleaning_fee, commission, tax,
      gross(총매출),
      cleaning_cost, rent, mgmt, operation,
      total_cost(총비용),
      net(순이익), margin(마진율)
    }
  · API: POST /admin/reports/generate?month=2026-04
  · 스케줄: 매월 1일 자동 실행 (전월 데이터)

Step 2-2: 대시보드 연결
  · Dashboard.tsx → monthly_property_reports SELECT
  · Profit.tsx → monthly_property_reports SELECT  
  · Before: GROUP BY + JOIN 3테이블 (매번 3~5초)
  · After: SELECT * WHERE month='2026-04' (즉시)
```

**완료 시 효과:**
- "4월 실적?" → 즉시 응답
- CEO 대시보드 로딩 속도 개선
- 5엔진 진단의 재무 엔진 자동 갱신

---

### Phase 3: 시장 데이터 파이프라인

**왜?** 크롤링은 하고 있지만 DB에 안 들어감. 가격 경쟁력 분석 불가.

```
Step 3-1: 삼삼엠투 크롤링 → DB 자동 적재
  · docs/samsam/*.json → market_prices, market_contracts
  · POST /admin/market/import/auto (이미 구현됨)
  · 실행만 하면 됨

Step 3-2: 시장가격 비교 뷰
  · 우리 숙소 가격 vs 삼삼엠투 경쟁 숙소 가격
  · GET /admin/market/compare → PriceCalendar.tsx 연결

Step 3-3: [향후] 리브/자리톡 크롤러 추가
  · 삼삼엠투와 동일 패턴으로 확장
```

---

### Phase 4: Derived 데이터 자동 갱신 체계

**왜?** Derived 테이블이 한 번만 생성되고 갱신이 안 되면 의미 없음.

```
Step 4-1: 집계 스케줄러 구현
  · Go cron (robfig/cron 또는 time.Ticker 확장)
  
  매일 08:00:
    - cleaning_tasks 자동 생성 (체크아웃 기반)
    - issue_detections 일일 요약
    - property_business_diagnoses 갱신 (DiagnosisSeedService)

  매주 월요일:
    - 청소 주간 정산 (cleaning weekly settlement)
    - market_prices 크롤링 트리거

  매월 1일:
    - monthly_property_reports 생성 (전월)
    - cost_allocations 재계산
    - 5엔진 진단 전체 재생성

Step 4-2: 재생성 API 통일
  · POST /admin/pipeline/run?target=monthly_reports&month=2026-04
  · POST /admin/pipeline/run?target=diagnoses
  · POST /admin/pipeline/run?target=cost_allocations
  · POST /admin/pipeline/status → 각 파이프라인 최종 실행 시각
```

---

## 6. 로컬 원본 파일 정리

### 현재 상태
Downloads/ 및 Documents/에 100+개 파일이 흩어져 있음.

### 정리 구조

```
~/hiero-data/
├── raw/                          ← 원본 보관 (수정 금지)
│   ├── hostex_csv/               ← Hostex 거래 CSV (기간별)
│   │   ├── 2025-01_12.csv
│   │   ├── 2026-01_03.csv
│   │   ├── 2026-04.csv
│   │   └── 2026-05.csv
│   ├── hostex_reports/           ← 숙소별 예약 보고서 (70+개)
│   ├── airbnb_tax/               ← 세무 해명용 (2023, 2024)
│   ├── accounting/               ← 계정별원장, 정산데이터
│   ├── contracts/                ← 부동산계약, 월세, 관리비
│   ├── cleaning/                 ← 청소비 납부대장
│   ├── cs_calls/                 ← 통화분석 CSV
│   └── chat_logs/                ← 카톡 로그 원본
│
├── imported/                     ← DB 임포트 완료 이력
│   ├── hostex_transactions/      ← 임포트된 CSV + 날짜 기록
│   ├── samsam_2026-05-08/        ← 크롤링 JSON
│   └── import_log.md             ← 언제 뭘 임포트했는지
│
└── _duplicates/                  ← 중복 파일 (확인 후 삭제)
    ├── 24년계정별원장 (1).xlsx
    ├── 24년계정별원장 (2).xlsx
    └── ...
```

### 정리 원칙
1. Downloads/의 `(1)`, `(2)` 중복 파일 → `_duplicates/`
2. DB에 이미 임포트된 CSV → `imported/`로 이동 + 날짜 기록
3. 아직 임포트 안 된 원본 → `raw/` 해당 카테고리로 분류
4. 프로젝트 내부(docs/samsam, docs/chat_analysis)는 그대로 유지

---

## 7. 데이터 흐름 요약 (Before vs After)

### Before (현재)

```
"4월 숙소별 순수익 알려줘"
  → hostex_transactions에서 4월 매출 GROUP BY property
  → 비용 데이터? → property_costs 비어있음 ❌
  → 엑셀에서 월세 찾아야 함 → 30분 소요
  → 결국 매출만 보여줌, 순수익 불가
```

### After (파이프라인 완성 후)

```
"4월 숙소별 순수익 알려줘"
  → SELECT * FROM monthly_property_reports WHERE month='2026-04'
  → 즉시 응답: 숙소별 매출, 비용, 순이익, 마진율
```

---

## 8. 구현 우선순위 & 예상 작업량

| 순위 | 작업 | 의존성 | 난이도 | 임팩트 |
|------|------|--------|--------|--------|
| **P0** | property_costs 데이터 입력 | 없음 | 낮음 (CSV 임포트 or UI) | 🔴 정산 기반 |
| **P0** | cost_raw 생성 (기존 API 실행) | property_costs | 낮음 (API 호출만) | 🔴 비용 추적 |
| **P0** | cost_allocations 생성 (기존 API 실행) | cost_raw | 낮음 (API 호출만) | 🔴 월별 분배 |
| **P1** | monthly_property_reports 집계 배치 | cost_allocations | 중간 (새 서비스) | 🟠 리포트 자동화 |
| **P1** | Profit.tsx 실데이터 연결 | monthly_reports | 낮음 (API 교체) | 🟠 대시보드 완성 |
| **P2** | market_prices DB 적재 | 삼삼엠투 JSON | 낮음 (기존 API 실행) | 🟡 가격 분석 |
| **P2** | 집계 스케줄러 (cron) | Phase 1~2 완료 | 중간 (인프라) | 🟡 자동화 |
| **P3** | activity_logs 이벤트 발행 | 없음 | 중간 (전체 핸들러) | 🟢 감사 추적 |
| **P3** | documents 파일 관리 | 없음 | 낮음 (UI 연결) | 🟢 파일 정리 |

---

## 9. 핵심 원칙

1. **Single Source of Truth**: 각 데이터는 하나의 원본만 가진다
   - 매출 → `hostex_transactions` (CSV)
   - 예약 → `reservations` (Hostex API)
   - 비용 → `cost_raw` (원본 보존) → `cost_allocations` (분배)

2. **원본 불변**: Tier 1 데이터는 절대 수정하지 않음

3. **재생성 가능**: Tier 3 데이터는 언제든 Tier 1+2에서 재계산 가능

4. **추적 가능**: 모든 비용은 `cost_raw.source_file_name` + `source_row_number`로 원본 추적

5. **날짜 기준 명확**:
   - 매출 발생 = `reservations.booked_at`
   - 돈 입금 = `hostex_transactions.transaction_at`
   - 비용 귀속 = `cost_allocations.allocated_month`

---

## 10. 체크리스트: 다음 세션에서 할 일

### 즉시 실행 가능 (코드 변경 없이)
- [ ] `POST /admin/costs/import-from-transactions` 호출 → cost_raw 생성
- [ ] `POST /admin/costs/reallocate` 호출 → cost_allocations 생성
- [ ] `POST /admin/market/import/auto` 호출 → market_prices 적재
- [ ] `POST /admin/diagnosis/generate` 호출 → diagnoses 갱신

### 데이터 입력 필요
- [ ] property_costs: 101개 숙소 월세/관리비 입력 (엑셀 → CSV → 임포트)
- [ ] property_investors: 투자자-숙소 매핑 입력
- [ ] property_parkings: 주차 정보 입력

### 코드 구현 필요
- [ ] monthly_property_reports 집계 서비스 + API
- [ ] Profit.tsx 목 데이터 → 실데이터 전환
- [ ] 집계 스케줄러 (일/주/월 cron)
- [ ] 파이프라인 상태 모니터링 API
