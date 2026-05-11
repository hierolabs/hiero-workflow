# 데이터 마이그레이션 계획서

> 2026-05-12 작성 | 데이터 정합성 전수조사 결과 기반

## 원천 데이터 흐름

```
[Hostex API] → properties.name (운영코드)
                    ↓
            properties.display_name (디네임) ← 수동 편집 가능 (/properties)
                    ↓
            모든 API 응답에서 display_name 우선 사용
                    ↓
            [예약/청소/정산/메시지/리뷰/분석] 전부 디네임으로 표시
```

**정규 원천:** `properties` 테이블
**표시명:** `display_name` (디네임)
**편집 위치:** 공간 관리 페이지 (`/properties`)

---

## 문제 1: property_name — 이미 쌓인 데이터가 옛 이름

### 현황
| 테이블 | 건수 | 고유 이름 수 | 상태 |
|--------|------|------------|------|
| cleaning_tasks | 2,598 | 97종류 | 옛 운영코드로 저장됨 |
| message_tags | 55,534 | 75종류 | 옛 운영코드로 저장됨 |
| hostex_transactions | 13,264 | 109종류 | Hostex 원본 이름 |
| reviews | 483 | 68종류 | 옛 이름 |
| monthly_property_reports | 1,401 | 98종류 | 옛 이름 |
| issues | 5 | 5종류 | 소량 |
| communication_logs | 0 | 0 | 없음 |

### 해결 방법
1. `internal_prop_id` 또는 `property_id`가 있는 레코드 → properties JOIN으로 display_name 일괄 UPDATE
2. property_id가 없는 레코드 → name 패턴 매칭으로 매핑 후 UPDATE
3. 매핑 불가 → 그대로 유지 (fallback)

### SQL 템플릿
```sql
-- cleaning_tasks: internal_prop_id 기준
UPDATE cleaning_tasks ct
JOIN properties p ON ct.internal_prop_id = p.id
SET ct.property_name = COALESCE(NULLIF(p.display_name, ''), p.name)
WHERE p.display_name != '' AND ct.property_name != p.display_name;

-- reviews: reservation_code → reservations → properties
UPDATE reviews rv
JOIN reservations r ON rv.reservation_code = r.reservation_code
JOIN properties p ON r.internal_prop_id = p.id
SET rv.property_name = COALESCE(NULLIF(p.display_name, ''), p.name)
WHERE p.display_name != '';

-- hostex_transactions: property_id → properties.hostex_id
UPDATE hostex_transactions ht
JOIN properties p ON ht.property_id = p.hostex_id
SET ht.property_name = COALESCE(NULLIF(p.display_name, ''), p.name)
WHERE p.display_name != '';

-- message_tags: conversation → properties
UPDATE message_tags mt
JOIN conversations c ON mt.conversation_id = c.conversation_id
JOIN properties p ON c.internal_prop_id = p.id
SET mt.property_name = COALESCE(NULLIF(p.display_name, ''), p.name)
WHERE p.display_name != '';

-- monthly_property_reports: hostex_property_name → properties.name 매칭
UPDATE monthly_property_reports mpr
JOIN properties p ON mpr.property_name = p.name OR mpr.property_name LIKE CONCAT('%', p.name, '%')
SET mpr.property_name = COALESCE(NULLIF(p.display_name, ''), p.name)
WHERE p.display_name != '';
```

### 우선순위: **높음** (디네임이 의미 있으려면 과거 데이터도 통일해야 함)
### 예상 시간: 30분
### 위험도: 낮음 (property_name은 표시용, FK가 아님)

---

## 문제 2: guest_name — 운영 메모가 이름에 붙어 있음

### 현황
```
김종삼_299.7(8.8) ㅡ 삼투    → 이름: 김종삼, 금액: 299.7만, 박수: 8.8
곽동연_119(7.0)              → 이름: 곽동연, 금액: 119만, 박수: 7.0
장조이_21일 30만원입금        → 이름: 장조이, 메모: 21일 30만원입금
Oscar Wollheim_103호 거주중   → 이름: Oscar Wollheim, 메모: 103호 거주중
```

### 패턴 분석
1. `이름_금액(박수)` — 가장 흔한 패턴
2. `이름_메모` — 운영 메모 (호실변경, 입금, 연장 등)
3. `(연장)이름_금액(박수)` — 접두사 메모
4. 순수 이름 (메모 없음)

### 해결 방법
1. `reservations` 테이블에 `guest_name_clean` 컬럼 추가
2. `_` 이전 부분을 clean name으로 파싱
3. `_` 이후 부분을 `guest_memo` 컬럼으로 분리
4. 접두사 `(연장)`, `(취소)` 등도 memo로 분리

### 파싱 로직
```
원본: "김종삼_299.7(8.8) ㅡ 삼투"
→ guest_name_clean: "김종삼"
→ guest_memo: "299.7(8.8) ㅡ 삼투"

원본: "(연장)김두훈_36.7(5.1)"
→ guest_name_clean: "김두훈"  
→ guest_memo: "(연장) 36.7(5.1)"

원본: "Oscar Wollheim"
→ guest_name_clean: "Oscar Wollheim"
→ guest_memo: ""
```

### 우선순위: **높음** (고객 분석의 전제조건)
### 예상 시간: 1시간 (파싱 로직 + 검증)
### 위험도: 중 (파싱 오류 가능성, 외국인 이름에 _ 포함될 수 있음)

---

## 문제 3: guest_name 테이블간 불일치

### 현황
같은 reservation_code인데 reservations.guest_name ≠ conversations.guest_name

| reservation_code | reservations | conversations |
|---|---|---|
| 0-HMB5WBD348... | 동빈 임 | 태준 박 |
| 0-HMCESZR5YK... | Edward Kim | Edward |

### 원인
- Hostex에서 예약자 이름과 메시지 발신자 이름이 다를 수 있음
- 방 변경 배정으로 다른 게스트가 매핑될 수 있음
- conversations의 guest_name은 Hostex 대화방 이름 (대리 예약 등)

### 해결 방법
- 원천을 `reservations.guest_name`으로 통일
- conversations.guest_name은 "대화방 이름"으로 별도 취급
- JOIN 시 항상 reservations 기준

### 우선순위: **중** (현재 운영에 큰 영향 없음, 분석 시 중요)
### 예상 시간: 20분

---

## 문제 4: channel_name 표기 불일치

### 현황
- reservations.channel_name: **22종류**
- hostex_transactions.channel: **21종류**
- conversations.channel_type: **4종류**

### 해결 방법
표준 채널 매핑 테이블 또는 코드 매핑:
```
Airbnb, airbnb, Airbnb Official → "airbnb"
Booking.com, booking → "booking"
삼삼엠투, 33m2, samsam → "samsam"
리브애니웨어, liveanywhere → "liveanywhere"
직접, direct, 개인 → "direct"
```

### 우선순위: **중** (채널별 매출 분석 정확도)
### 예상 시간: 30분

---

## 문제 5: 전화번호 포맷 불일치

### 현황
```
+82 010          → 10명이 매핑됨 (포맷 오류)
+1 01028961213   → +82가 아닌 +1로 저장
+82 01050385484  → 정상
```

### 해결 방법
1. 모든 전화번호를 `+82 010XXXXXXXX` 형태로 정규화
2. `+1`로 시작하는 한국 번호 → `+82`로 변환
3. 공백/하이픈 제거 후 재포맷

### 우선순위: **낮음** (고객 중복 제거 시 필요)
### 예상 시간: 20분

---

## 실행 순서

| 순서 | 작업 | 예상시간 | 선행조건 |
|------|------|---------|---------|
| **1** | property_name 일괄 UPDATE (디네임) | 30분 | 없음 |
| **2** | guest_name 파싱 (clean + memo 분리) | 1시간 | 없음 |
| **3** | channel_name 표준화 | 30분 | 없음 |
| **4** | guest_name 테이블간 통일 | 20분 | #2 완료 |
| **5** | 전화번호 정규화 | 20분 | #2 완료 |

**총 예상시간: 약 3시간**

---

## 주의사항
- 모든 UPDATE 전에 `SELECT COUNT(*)` 로 영향 범위 확인
- 대량 UPDATE는 `LIMIT 1000`으로 배치 실행
- 실행 전 백업: `CREATE TABLE {table}_backup_20260512 AS SELECT * FROM {table}`
- 실행 후 검증: 같은 쿼리로 재확인
