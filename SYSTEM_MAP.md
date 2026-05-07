# HIERO System Map — 전체 흐름 + 연결 구조

> 이 문서 하나로 HIERO 전체 시스템을 파악한다.
> 개발 규칙은 DEVELOPMENT_RULES.md 참조.

---

## 1. HIERO = 무엇인가

```txt
숙박 운영의 모든 상태 변화를 추적하고 연결하는 AI 운영 OS

매출은 reservation_date,
돈은 deposit_date,
비용은 Data 2 (cost_raw → cost_allocations 1/n 분할),
원본은 반드시 추적.
```

---

## 2. 데이터 아키텍처

```txt
Data 1 = Hostex API 예약 (reservation_date 기준 매출)
Data 2 = CSV 정산/비용 (cost_raw + cost_allocations)
Data 3 = Data 1 + Data 2 JOIN (deposit_date 기준 입금 예정)
```

---

## 3. 조직 피라미드

```txt
Founder (김진우) → 오늘 결정 3개만
    ↑ escalation_level = founder
ETF (CEO 김지훈 / CTO 변유진 / CFO 박수빈)
    ↑ escalation_level = etf
Execution (운영 재관 / 청소배정 우현 / 마케팅 예린 / 현장 진태)
```

에스컬레이션: Execution → ETF → Founder
즉결 규칙: <10만 자동 / 10~30만 ETF / 30만+ Founder

---

## 4. 숙소 라이프사이클

```txt
Lead → Meeting → Negotiating → Contract
→ Setting (light 3일 / standard 5일 / renovation 14일)
→ Filming → OTA Registration
→ partially_active (Airbnb만 active면 판매 시작)
→ fully_distributed → Active
```

Platform Tier:
- Master: Airbnb (Source of Truth)
- Fast Copy: 삼삼엠투, 리브, 자리톡
- Complex: Booking, Agoda

---

## 5. 업무 퍼널

```txt
01 발견 (CTO)  → Property OS
02 분석 (CTO)  → Property OS + MORO
03 생성 (CTO)  → Growth OS
04 영업 (CEO)  → Growth OS + People OS
05 운영 (CEO+CFO) → Operations OS + Money OS + Risk OS
```

---

## 6. 핵심 State Transitions

### 예약
```txt
pending → accepted → checked_in → checked_out → completed
```

### 청소
```txt
pending → assigned → dispatched → in_progress → completed
                                                    ↘ issue
```

### 이슈
```txt
open → in_progress → resolved → closed
  ↓ escalate
  etf → founder
```

### 숙소 온보딩
```txt
Phase 1 (세팅/진태) → Phase 2 (촬영/진태) → Phase 3 (콘텐츠/예린)
→ Phase 4 (플랫폼 등록/예린) → Phase 5 (운영 준비/재관)
```

---

## 7. 페이지 → 데이터 연결

| 사이드바 | 페이지 | 핵심 엔티티 | State Transition |
|---------|--------|-----------|-----------------|
| 오늘의 업무 | /today | issues + cleaning_tasks | 오늘 처리 대상 |
| 운영 캘린더 | /calendar | reservations | 체크인/아웃 일정 |
| 예약 관리 | /reservations | reservations | 예약 상태 |
| 게스트 메시지 | /messages | conversations + messages | 대화 → 이슈 추출 |
| 청소 관리 | /cleaning | cleaning_tasks + cleaners | 배정→발송→완료 |
| 민원/하자 | /issues | issues | 생성→해결→에스컬레이트 |
| 위탁영업 | /leads | outsourcing_leads | lead→계약 |
| 공간 관리 | /properties | properties + platforms + onboarding | 라이프사이클 |
| 정산 관리 | /settlement | hostex_transactions + cost_allocations | 매출/비용/입금 |
| 매출 현황 | /revenue | reservations + transactions | 매출 분석 |
| 수익성 분석 | /profit | settlement 집계 | P&L |
| 경영 대시보드 | / | 전체 집계 | Founder Brief + 파이프라인 |
| ETF Board | /etf-board | issues + team_stats | CEO/CTO/CFO 관리 |
| 팀 관리 | /team | admin_users + attendance + stats | 피라미드 + KPI |
| 마이페이지 | /mypage | 로그인 사용자 기준 | 내 KPI + 근태 + 로그 |

---

## 8. 자동 연결 흐름

### 이슈 생성 시
```txt
Issue 생성
  → AssignIssueByType (33개 타입 → 8명 자동 배정)
  → ActivityLog 생성
  → Notification (담당자에게)
  → 금액 > 10만 → CFO 알림
  → 금액 > 30만 → Founder Brief 표시
```

### 청소 완료 시
```txt
CleaningTask completed
  → ActivityLog 생성
  → 청소자 주간 정산에 반영 (3.3% 원천징수)
  → 비용 매칭 (Data 2 CSV vs CleaningTask DB)
```

### 에스컬레이트 시
```txt
Issue escalate
  → escalation_level 변경 (execution → etf → founder)
  → 새 담당자 배정 (role_title 기반)
  → Notification (상위 담당자)
  → ActivityLog (from → to 기록)
```

### 온보딩 체크 시
```txt
OnboardingCheck 체크
  → ActivityLog (누가, 언제, 어떤 항목)
  → Phase 완료 시 → 다음 Phase 담당자 알림
  → 전체 완료 시 → lifecycle_status 변경
```

---

## 9. API 경로 규칙

```txt
VITE_API_URL = http://localhost:8080/admin
프론트에서: api.get('/issues') → http://localhost:8080/admin/issues
절대 /admin/admin/ 중복 금지
```

---

## 10. 계정

| 아이디 | 역할 | 레이어 | 비밀번호 |
|--------|------|--------|---------|
| admin | Founder | founder | hiero2026 |
| jinwoo | Founder | founder | hiero2026 |
| jihoon | CEO | etf | hiero2026 |
| yujin | CTO | etf | hiero2026 |
| subin | CFO | etf | hiero2026 |
| yerin | 마케팅 | execution | hiero2026 |
| jaekwan | 운영 | execution | hiero2026 |
| woohyun | 청소배정 | execution | hiero2026 |
| jintae | 현장 | execution | hiero2026 |

---

## 11. 미구현 → 개발 지시서 위치

| 항목 | 문서 |
|------|------|
| ETF 월간 보고서 자동화 | docs/08_development/ETF_월간보고서_자동화_개발지시서_20260508.md |
| 멀티플랫폼 통합 관리 | docs/08_development/멀티플랫폼_통합관리_개발지시서_20260508.md |
| 숙소 공급 라이프사이클 상세 | docs/08_development/숙소_공급_라이프사이클_개발지시서_20260508.md |
| 개인 업무 목표 달성 | docs/08_development/개인업무_목표달성_시스템_개발지시서_20260508.md |
| ETF KPI + 에스컬레이션 기준 | docs/07_team/ETF_KPI_보고서_에스컬레이션_기준서_20260508.md |

---

## 12. AI 7레벨

```txt
L1 수동 입력
L2 자동 수집 ✅ (Hostex 동기화, CSV 임포트)
L3 자동 분류 ✅ (33개 이슈 타입 자동 배정)
L4 자동 판단 ⚡ (Founder Brief, 5엔진 진단)
L5 자동 실행 — 다음
L6 자동 학습 — 향후
L7 자동 생성 — 보고서/콘텐츠 (데이터 있으므로 먼저 가능)
```

---

## 13. 스택

```txt
Backend: Go 1.26 (Gin + GORM + JWT + MySQL on AWS RDS)
Frontend: React + TypeScript + Vite (port 5180)
Admin: React + TypeScript + Vite (port 5181)
Local DB: SQLite (근태/활동 로그)
외부 API: Hostex
서버 시작: ./start.sh / 종료: ./stop.sh
```
