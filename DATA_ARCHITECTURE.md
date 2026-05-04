# HIERO 데이터 아키텍처 매뉴얼

> 최종 확정: 2026-05-04
> 이 문서는 매출·정산·분석의 데이터 흐름을 정의한다. 코드 변경 시 반드시 이 문서를 기준으로 판단할 것.

---

## 1. 데이터 구분

| 구분 | 소스 | 테이블 | 역할 |
|------|------|--------|------|
| **Data 1** | Hostex API | `reservations` | 예약 원본. 매출의 기준 |
| **Data 2** | Hostex CSV 업로드 | `hostex_transactions` → `cost_raw` → `cost_allocations` | 정산/비용 원본 |
| **Data 3** | Data 1 + Data 2 JOIN | (쿼리 시 생성) | 모든 분석의 기준 |

---

## 2. Data 1 — Hostex API 예약 데이터

### 소스
- Hostex API v3 (`https://api.hostex.io/v3/reservations`)
- 웹훅: `POST /api/webhooks/hostex` (실시간)
- 크론: 매 1시간 (과거 30일 ~ 미래 90일)
- 풀싱크: 서버 부팅 시 (과거 2년 ~ 미래 90일)

### 핵심 필드
- `reservation_code` — 고유 키 (Data 2와 JOIN 키)
- `booked_at` — **매출 기준일** (Hostex API가 주는 값 그대로 사용)
- `check_in_date` — 체크인일
- `check_out_date` — 체크아웃일
- `total_rate` — 총 매출 (원)
- `total_commission` — 수수료 (원)
- `channel_name` — 채널명 (Airbnb, 삼삼엠투, 리브, Agoda 등)

### 주의사항
- **`booked_at`은 Hostex API가 주는 값을 그대로 저장**. 우리가 가공하지 않음.
- Hostex는 취소된 예약의 `booked_at`을 싱크 시점 날짜로 반환하는 버그가 있음. 이건 Hostex 측 문제이며, 우리는 그대로 저장.
- `reservation_date` 필드는 모델에 존재하지만 **사용하지 않음**. `booked_at`이 유일한 기준.
- `/reservations` 페이지는 Data 1만 직관적으로 표시.

### 관련 코드
```
backend/hostex/client.go          — Hostex API 클라이언트, Reservation struct
backend/service/reservation_service.go — UpsertFromHostex(), List()
backend/service/hostex_sync_service.go — SyncReservations(), SyncAll()
backend/handler/webhook.go        — 웹훅 수신
```

---

## 3. Data 2 — CSV 정산/비용 데이터

### 소스
- Hostex에서 다운로드한 거래 내역 CSV
- 업로드: `POST /admin/transactions/upload`

### CSV 컬럼
날짜, 유형, 항목, 금액, 결제방법, **관련 예약**(=reservation_code), 체크인, 체크아웃, 게스트, 채널, 관련 숙박시설, 운영자, 비고

### 테이블 구조

#### `hostex_transactions` (CSV 원본 그대로)
- `reservation_ref` — JOIN 키 (= reservations.reservation_code)
- `transaction_at` — 거래일 (실제 입금/지출일)
- `type` — "수입" 또는 "비용"
- `category` — 객실 요금, 청소 비용, 관리비, Rent_out 등
- `amount` — 금액 (원)

#### `cost_raw` (원본 비용, 추적 가능)
- `property_id`, `cost_type`, `original_amount`
- `cost_start_date`, `cost_end_date` — 비용 적용 기간
- `payment_date` — 결제일
- `source_file_name`, `source_row_number` — 원본 CSV 추적

#### `cost_allocations` (분석용 월별 배분)
- `raw_cost_id` — cost_raw.id 참조 (원본 추적)
- `allocated_month` — YYYY-MM
- `allocated_amount` — 배분 금액
- `allocation_method` — daily_prorate(일할) / full_month(월전체) / manual(수동)

### 비용 1/n 배분 규칙
- 비용의 `cost_start_date ~ cost_end_date` 기간을 월별로 나눠 일할 배분
- 예: 100만원 (3/15~4/15) → 3월 516,129원 + 4월 483,871원
- 기간 정보 없으면 `payment_date` 월에 전액 배분

### 관련 코드
```
backend/models/cost_raw.go              — 원본 비용 모델
backend/models/cost_allocation.go       — 분할 비용 모델
backend/service/cost_allocation_service.go — 배분 로직, 마이그레이션
backend/service/transaction_service.go  — CSV 파싱
backend/handler/cost.go                 — 비용 API
backend/handler/transaction.go          — CSV 업로드/정산 API
```

---

## 4. Data 3 — JOIN 분석 데이터

### JOIN 조건
```sql
reservations.reservation_code = hostex_transactions.reservation_ref
```

### deposit_date 계산 (입금 예정일)
```
채널              계산식
──────────────────────────────────────
Liv / 리브애니웨어   check_in_date + 0일
삼삼엠투            check_in_date + 0일
Airbnb            check_in_date + 1일
Booking.com       check_in_date + 0일
Agoda             check_out_date (= check_in + nights)
자리톡             check_in_date + 5일
기타              check_in_date + 0일
```

### 3대 금액 (Dashboard / Revenue에서 표시)

| 항목 | 의미 | 데이터 소스 | 날짜 기준 |
|------|------|------------|-----------|
| 발생 매출 | 언제 예약이 생겼나 | Data 1 `total_rate` | `booked_at` |
| 입금 예정 | 언제 돈이 들어오나 | Data 3 `total_rate` | `deposit_date` |
| 실제 입금 | 실제 얼마 들어왔나 | Data 2 `amount` (type=수입) | `transaction_at` |

### 순이익 계산
```
순이익 = 발생 매출 - cost_allocations(해당 월 배분 비용)
```

### 관련 코드
```
backend/service/data3_service.go  — JOIN 쿼리, deposit_date 계산, GetData3Summary()
backend/handler/data3.go          — API 엔드포인트
```

### API
```
GET /admin/data3/summary?start_date=&end_date=     — 3대 금액 집계
GET /admin/data3/records?start_date=&end_date=&date_field=&property_id=&channel= — 개별 레코드
```

---

## 5. 페이지별 데이터 매핑

| 페이지 | 데이터 | 표시 내용 |
|--------|--------|-----------|
| `/reservations` | Data 1 | 예약 목록 (booked_at 기준 정렬/필터) |
| `/settlement` | Data 2 | CSV 기반 정산 원본 (transaction_at 기준) |
| `/revenue` | Data 3 | 3대 금액 + 기간별/채널별 분석 |
| `/dashboard` | Data 3 | 3대 금액 요약 + 액션 엔진 |
| `/diagnosis` | Data 3 | 5엔진 사업 진단 (매출/비용/수익 지표) |

---

## 6. 코드 수정 시 체크리스트

1. **예약 데이터 가져오는 로직 수정 시**
   - `hostex/client.go` Reservation struct 확인
   - `reservation_service.go` UpsertFromHostex() 확인
   - `booked_at`은 Hostex가 주는 값 그대로 저장. 가공 금지.

2. **비용 데이터 수정 시**
   - `cost_raw`에 원본 보존 (삭제 금지)
   - `cost_allocations`는 재생성 가능 (raw_cost_id로 추적)
   - 새 비용 타입 추가 시 `models/cost_raw.go` 상수 추가

3. **분석/대시보드 수정 시**
   - 반드시 Data 3 기준 (reservation_code JOIN)
   - 매출 = Data 1의 `total_rate` (booked_at 기준)
   - 비용 = `cost_allocations` (월별 배분)
   - 입금 = deposit_date 또는 transaction_at 기준

4. **CSV 업로드 로직 수정 시**
   - "관련 예약" 컬럼 = `reservation_ref` (JOIN 키)
   - 새 카테고리 추가 시 `hostex_transaction.go` 상수 + `cost_allocation_service.go` mapCategoryToCostType() 수정

---

## 7. 작성 근거

이 문서는 다음 사실을 확인하여 작성됨:

1. **Hostex API 응답 직접 확인** (2026-05-04)
   - `booked_at`: 취소 예약에 대해 싱크 시점 날짜를 반환하는 버그 확인
   - `created_at`: 실제 예약 최초 생성 시점 (신뢰 가능하나 사용하지 않기로 결정)
   - 결론: `booked_at` 그대로 사용. API 데이터는 가공하지 않음.

2. **DB 실데이터 확인** (2026-05-04)
   - reservations: 14,054건
   - hostex_transactions: 11,641건
   - reservation_code ↔ reservation_ref JOIN 가능 확인 (별도 스키마 변경 불필요)

3. **CSV 컬럼 매핑 확인**
   - transaction_service.go 파싱 로직에서 "관련 예약" → reservation_ref 매핑 확인

4. **채널별 입금일 규칙**
   - 운영팀(김진우) 확인 기준으로 채널별 offset 정의
