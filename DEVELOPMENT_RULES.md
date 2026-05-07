# HIERO 개발 규칙 — 온톨로지 기반 State Transition 원칙

> 모든 개발자(사람/AI)가 신규 페이지·기능 구현 시 반드시 따라야 하는 규칙

---

## 원칙 1: 기능이 아니라 State Transition을 만든다

```txt
❌ "메시지 보내기 기능"
✅ "CleaningTask를 assigned → dispatched 상태로 전환하는 엔진"

❌ "CSV 다운로드 기능"  
✅ "Settlement 데이터의 financial_state를 추적 가능하게 만드는 export"
```

새 기능 구현 전 반드시 답해야 하는 질문:

```txt
1. 이 기능은 어떤 엔티티의 상태를 바꾸는가?
2. 이전 상태는 무엇이고, 이후 상태는 무엇인가?
3. 누가 이 전환을 트리거하는가?
4. 이 전환이 실패하면 어떤 상태에 머무는가?
```

---

## 원칙 2: 모든 상태 변화는 ActivityLog를 남긴다

어떤 엔티티의 상태가 바뀌면 반드시 로그를 남긴다.

```go
// 모든 서비스 함수에서 상태 변경 시:
LogActivity(userID, userName, action, targetType, targetID, detail)
```

action 명명 규칙:

```txt
{entity}_{verb}

issue_created, issue_assigned, issue_escalated, issue_resolved
cleaning_assigned, cleaning_dispatched, cleaning_completed
lifecycle_changed, onboarding_checked
platform_registered, platform_activated
settlement_confirmed, cost_approved
lead_contacted, lead_contracted
```

---

## 원칙 3: 모든 상태 변화는 관련자에게 Notification을 보낸다

```go
// 상태 변경 → 관련 담당자에게 알림
notifSvc.NotifyByName(assigneeName, notifType, title, content, entityID, fromName)
```

알림이 필요한 상태 변화:

```txt
배정 변경 → 새 담당자
에스컬레이트 → 상위 역할
해결/완료 → 생성자 또는 요청자
비용 승인 필요 → CFO 또는 Founder (금액 기준)
온보딩 Phase 완료 → 다음 Phase 담당자
```

---

## 원칙 4: 모든 엔티티는 관계를 통해 연결된다

단독으로 존재하는 데이터는 없다. 반드시 다른 엔티티와 연결되어야 한다.

```txt
Property → Reservation → CleaningTask → Cleaner
Property → OnboardingCheck → Phase → Assignee
Property → PropertyPlatform → URL + Status
Property → Investor → Contract
Property → PropertyParking
Issue → Property + Assignee + Escalation + ActivityLog
Lead → Property (계약 후) → Lifecycle → Active
```

새 테이블 생성 시 반드시 포함해야 하는 필드:

```txt
property_id (숙소 연결, 해당 시)
issue_id (이슈 연결, 해당 시)
created_by_id + created_by_name (누가 만들었는가)
created_at + updated_at (언제)
```

---

## 원칙 5: 모든 UI 박스는 클릭 가능해야 한다

화면에 표시되는 모든 숫자·카드·상태 배지는 원본 데이터로 드릴다운 가능해야 한다.

```txt
❌ 숫자만 표시: "미처리 이슈 5건"
✅ 클릭 → 이슈 목록 페이지로 이동 (필터 적용됨)

❌ 상태만 표시: "발송됨"
✅ 클릭 → 해당 메시지 내용 확인 + 발송 이력

❌ 이름만 표시: "김진태"
✅ 클릭 → 팀원 프로필 모달 (인사정보 + 근태 + KPI + 활동 로그)
```

구현 규칙:

```tsx
// 모든 StatCard, KPI 숫자에 onClick 필수
<StatCard label="미처리" value={5} onClick={() => navigate('/issues?status=open')} />

// 모든 상태 배지에 드릴다운
<StatusBadge status="dispatched" onClick={() => openDetail(taskId)} />

// 모든 이름에 프로필 연결
<span onClick={() => openProfile(userName)}>{name}</span>
```

---

## 원칙 6: 에스컬레이션은 자동으로 흐른다

이슈·비용·상태 변화는 피라미드 에스컬레이션 규칙을 따른다.

```txt
금액 기반:
  < 10만원 → 즉결 (auto_approved)
  10~30만원 → ETF(CFO) 승인
  ≥ 30만원 → Founder 승인

역할 기반:
  Execution → ETF (이슈 유형별 CEO/CTO/CFO 자동 매핑)
  ETF → Founder (결정 불가 시)

시간 기반:
  24시간 미해결 → 자동 에스컬레이트
  세팅 7일 초과 → P1 이슈 자동 생성
  촬영 48시간 대기 → 병목 알림
```

---

## 원칙 7: 데이터 출처를 반드시 추적한다

모든 데이터는 어디서 왔는지 추적 가능해야 한다.

```txt
예약 → source: "hostex" | "manual" | "삼삼엠투" | "리브"
비용 → source_file_name + source_row_number (CSV 원본)
이슈 → created_from: "cleaning_task" | "guest_message" | "manual" | "auto_detection"
체크리스트 → checked_by_name + checked_at
정산 → cost_raw.id → cost_allocations (1/n 분할 추적)
```

---

## 원칙 8: 새 페이지 생성 시 체크리스트

```txt
□ 1. State Transition 정의 (어떤 상태를 어떤 상태로?)
□ 2. ActivityLog 연결 (상태 변경 시 로그)
□ 3. Notification 연결 (관련자에게 알림)
□ 4. 에스컬레이션 규칙 확인 (금액/역할/시간)
□ 5. 엔티티 관계 연결 (property_id, issue_id 등)
□ 6. UI 클릭 → 드릴다운 연결 (숫자, 이름, 상태)
□ 7. 데이터 출처 추적 (source, created_by)
□ 8. AiAgentPanel에 getPageData 연결
□ 9. 사이드바 메뉴 등록 (해당 시)
□ 10. API 경로 /admin/ 접두어 없이 (VITE_API_URL이 이미 포함)
```

---

## 원칙 9: HIERO 엔티티 온톨로지

```txt
Person HAS_ROLE Role
Role BELONGS_TO RoleLayer (founder / etf / execution)
Role OWNS OSDomain (MoneyOS / OperationsOS / PropertyOS / ...)

Property HAS Reservation
Property HAS OnboardingCheck (Phase 1~5)
Property HAS PropertyPlatform (8개 플랫폼)
Property HAS PropertyParking
Property BELONGS_TO Investor
Property HAS LifecycleStatus (lead → active)

Reservation CREATES CleaningTask
CleaningTask ASSIGNED_TO Cleaner
CleaningTask HAS DispatchMessage
CleaningTask MAY_CREATE Issue

Issue ASSIGNED_TO Person (via role_title)
Issue HAS EscalationLevel (execution → etf → founder)
Issue HAS EstimatedCost → ApprovalLevel (auto / etf / founder)
Issue MAY_ESCALATE_TO higher Role
Issue CREATES Notification
Issue CREATES ActivityLog

Notification BELONGS_TO Person (receiver)
ActivityLog TRACKS all state changes

Lead MAY_BECOME Property (계약 후)
```

---

## 원칙 10: 금지 사항

```txt
❌ 프론트에서 /admin/ 접두어 붙이기 (VITE_API_URL에 이미 포함)
❌ 하드코딩된 사람 이름으로 쿼리 (role_title로 조회)
❌ ActivityLog 없이 상태 변경
❌ Notification 없이 담당자 변경
❌ 클릭 불가능한 숫자/카드 표시
❌ 관계 없는 단독 테이블 생성
❌ source/created_by 없는 데이터 생성
❌ 문서(README, md) 생성 요청 없이 자동 생성
```
