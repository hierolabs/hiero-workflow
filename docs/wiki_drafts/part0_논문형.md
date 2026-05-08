# 중단기 임대 운영을 위한 도메인 온톨로지 설계
### — 100채 규모 위탁운영 사업의 데이터 구조화 사례

> Part 0 — 논문형
> 김진우 | 서울시립대학교 도시공학과 박사 | 2026.05.08

---

## 1. 배경

중단기 임대(Short-to-Mid-term Rental) 시장은 2020년 이후 급성장했으나, 운영 관리 체계는 여전히 파편화되어 있다. Airbnb, Booking.com 등 글로벌 OTA 플랫폼이 예약 접수를 자동화했지만, 예약 이후의 운영 — 청소 배정, 게스트 응대, 이슈 처리, 정산, 세무 — 은 대부분 수동으로 이루어진다.

기존 숙박 관리 SaaS(Hostaway, Guesty, Lodgify 등)는 기능 단위(feature-based)로 설계되어 있어, 예약-청소-정산 간의 연쇄 반응을 하나의 흐름으로 추적하기 어렵다.

본 논문에서는 100채 규모 위탁운영 사업(HIERO)에서 설계·적용한 도메인 온톨로지를 소개하고, 그 효과를 정량적으로 분석한다.

## 2. 문제 정의

### 2.1 운영 복잡도

HIERO의 운영 현황 (2026년 5월 기준):

| 지표 | 수치 |
|------|------|
| 운영 숙소 | 92채 (active) |
| 누적 예약 | 6,364건+ |
| 채널 | 3종 (Airbnb/삼삼엠투/개인입금) |
| 청소 권역 | 14개 |
| 이슈 유형 | 33개 → 8명 담당자 |
| 월 매출 | 약 3.5억원 |

### 2.2 기존 운영 방식의 한계

| 업무 | 도구 | 문제 |
|------|------|------|
| 예약 관리 | Hostex + 엑셀 | 채널별 분리, 통합 뷰 없음 |
| 청소 배정 | 카카오톡 | 배정 1~2시간 소요 |
| 이슈 처리 | 카카오톡 + 전화 | 추적 불가, 에스컬레이션 누락 |
| 정산 | CSV + 엑셀 | 수작업 대조, 오류 빈발 |
| 가격 결정 | 감 + PriceLabs | 채널별 30%만 자동화 |

핵심 문제: **예약 변경 → 청소 재배정 → 비용 변동 → 정산 수정**이라는 연쇄 반응을 기능 분리된 도구들로는 추적할 수 없다.

## 3. 접근 방법: 도메인 온톨로지

### 3.1 설계 원칙

도시계획학의 토지이용 분류 체계(Land Use Classification)에서 착안하여, 숙박 운영의 모든 개념을 엔티티-관계 모델로 정의했다.

**핵심 설계 철학:**
- 기능(Feature)이 아닌 **상태 전환(State Transition)**으로 사고
- 모든 엔티티는 **reservation_code**를 조인키로 연결
- 데이터는 발생 시점에 자동 생성, 수동 입력 최소화

### 3.2 엔티티 구성

15개 핵심 엔티티를 4개 계층으로 분류:

| 계층 | 엔티티 | 역할 |
|------|--------|------|
| 공간 | Property, RoomGrade, Neighborhood | 어디에서 일어나는가 |
| 거래 | Reservation, Guest, Channel | 누가 무엇을 거래하는가 |
| 운영 | CleaningTask, Issue, Message | 어떤 작업이 발생하는가 |
| 재무 | Settlement, Cost, Tax, Account | 돈이 어떻게 흐르는가 |
| 관계 | Owner, Team | 누가 책임지는가 |

### 3.3 연결 구조

```
Property → Reservation → CleaningTask → Issue → Settlement → Tax
    ↕           ↕            ↕           ↕         ↕
  Owner      Guest       Cleaner     Assignee   Account
```

reservation_code가 전체 파이프라인의 단일 조인키로 기능하여, 예약 1건에서 발생하는 모든 후속 작업과 비용을 추적할 수 있다.

## 4. 구현

### 4.1 기술 스택

- 백엔드: Go (Gin + GORM)
- 프론트엔드: React + TypeScript
- 데이터베이스: MySQL (AWS RDS)
- 외부 연동: Hostex API, PriceLabs API
- 크롤링: 삼삼엠투 호스트 페이지 (읽기 전용)

### 4.2 상태 전환 정의

각 엔티티의 상태 변화를 명시적으로 정의:

| 엔티티 | 상태 전환 | 트리거 |
|--------|----------|--------|
| Reservation | pending → accepted → checked_in → checked_out | 웹훅/시간 |
| CleaningTask | pending → assigned → in_progress → completed | 체크아웃 이벤트 |
| Issue | detected → responded → resolved | 메시지 분석 |
| Settlement | pending → calculated → confirmed → paid | 월말 집계 |

## 5. 결과

### 5.1 정량적 효과

| 지표 | Before | After | 변화 |
|------|--------|-------|------|
| 청소 배정 소요 | 1~2시간 | 20분 | -83% |
| 메시지 분석 | 수동 확인 | 자동 감지 97% (HS) | +97% |
| 가격 데이터 | Airbnb만 | 3채널 통합 (584건 분석) | +200% |
| 정산 대조 | 3일 | 자동 매칭 | -95% |

### 5.2 가격 분석 사례

삼삼엠투 584건 거래 데이터를 온톨로지 기반으로 분석한 결과:

- 게시가(주간 임대료)와 실질가(관리비+청소비 포함)의 괴리: +25~40%
- 기간별 체결가 패턴: 1주(+11% 프리미엄) → 8주+(-18% 할인)
- 취소율 57% — 기간 무관, 가격 외 요인 추정

이 분석은 기존의 기능별 분리 구조에서는 불가능했다. reservation_code → property → samsam_contract → channel → cost를 하나의 쿼리로 연결할 수 있었기에 가능한 결과다.

## 6. 시사점

### 6.1 학술적 기여

- 중단기 임대 운영에 도메인 온톨로지를 적용한 국내 최초 사례
- 도시계획학의 분류 체계를 PropTech 운영에 적용한 학제간 접근
- 92채 규모 실운영 데이터 기반의 실증 연구

### 6.2 실무적 기여

- 채널별 분리 운영 → 온톨로지 기반 통합 운영으로의 전환 방법론 제시
- 국내 채널(삼삼엠투/리브) 가격 분석 프레임워크
- PriceLabs 등 해외 가격 엔진의 한계와 보완 구조

### 6.3 한계

- 단일 사업체(HIERO) 데이터에 기반, 일반화에 한계
- 삼삼엠투/리브 데이터는 크롤링 기반으로 실시간성 부족
- 가격 추천 엔진은 아직 Phase 1(분석) 단계, 자동화 효과 미검증

## 7. 참고 자료

- Gruber, T. R. (1993). A Translation Approach to Portable Ontology Specifications. *Knowledge Acquisition*, 5(2), 199-220.
- Walk Score (walkscore.com) — 도시 보행성 점수 체계
- AreaVibes (areavibes.com) — 도시 거주성 학점 체계
- PriceLabs (pricelabs.co) — 동적 가격 엔진
- 한국관광공사 (2025). 숙박공유 시장 동향 보고서
