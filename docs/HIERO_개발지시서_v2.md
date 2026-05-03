# HIERO 개발 지시서 v2

> **작성일**: 2026-05-03
> **대상**: 김진우 (HIERO 운영) + Claude Code
> **기반 환경**: Go 1.26 + Gin + GORM + MySQL(RDS) / React + Vite + TS

---

## 📋 개요

### 현재 상태 (1주차 완료 시점)

```
✅ 완료된 것
   - 3-tier 구조 셋업 (backend / frontend / admin)
   - JWT + bcrypt 인증, super_admin/admin 권한 분리
   - tasks, admin_users 테이블 + CRUD
   - GORM AutoMigrate, DB/시드 자동 생성
   - Admin 로그인 + 대시보드 라우팅
```

### 최종 목표

```
6개월 내:
  - 운영 공간: 100채 → 300채
  - 월 수익: 약 3.5억
  - 팀: 27명 규모
  - 자동화율: 99%
```

### 8단계 로드맵

| Phase | 지시서 | 주제 | 주차 |
|-------|-------|------|------|
| **Phase 1** | #1 | 공간(Property) 도메인 구축 | 2주차 |
| 운영 기반 | #2 | 운영팀(Operator) 권한 시스템 확장 | 3주차 |
| **Phase 2** | #3 | Task 시스템 고도화 (공간 연결, 칸반) | 4주차 |
| 일일 운영 | #4 | 청소/정비 자동 스케줄링 | 5주차 |
| **Phase 3** | #5 | Slack 알림 시스템 | 6주차 |
| 소통/대응 | #6 | 이슈/컴플레인 트래킹 | 7주차 |
| **Phase 4** | #7 | 임대인(Owner) 관리 + 월 정산 | 8주차 |
| 수익/관리 | #8 | 운영 KPI 대시보드 | 9주차 |

### 운영 방식

1. **단계별 진행**: 한 번에 1개 지시서만 작업. 끝나야 다음으로.
2. **Claude Code 활용**: 각 지시서 끝의 "🤖 Claude Code 프롬프트"를 그대로 복사해서 붙여넣기.
3. **완료 기준 (DoD) 통과 필수**: 체크박스 모두 충족해야 다음 단계.
4. **이상 시 즉시 롤백**: GORM AutoMigrate가 강력하지만 운영 데이터 마이그레이션은 신중히.

---

## 🏗 공통 코드 컨벤션

작업 들어가기 전 미리 합의할 규칙입니다.

### 디렉토리 구조 확장 원칙

```
backend/
├── models/
│   ├── property.go        ← #1에서 추가
│   ├── operator.go        ← #2 (또는 admin_user 확장)
│   ├── task.go            ← #3에서 확장
│   ├── schedule.go        ← #4
│   ├── notification.go    ← #5
│   ├── issue.go           ← #6
│   ├── owner.go           ← #7
│   └── settlement.go      ← #7
├── handler/
│   ├── property.go
│   ├── ...
└── service/               ← 신규 디렉토리 (비즈니스 로직)
    ├── scheduler.go       ← #4 (cron job)
    ├── slack.go           ← #5
    └── settlement.go      ← #7
```

### API 응답 포맷

모든 응답은 일관된 구조 사용:

```go
// 성공 - 단건
{ "data": { ... } }

// 성공 - 목록
{ "data": [...], "total": 123, "page": 1, "page_size": 20 }

// 에러
{ "error": { "code": "NOT_FOUND", "message": "Property not found" } }
```

### 모델 공통 필드

모든 테이블은 다음 공통 필드를 가짐:

```go
type BaseModel struct {
    ID        uint           `gorm:"primarykey" json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    UpdatedAt time.Time      `json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"` // soft delete
}
```

→ **권장**: 위 BaseModel을 만들고 모든 모델이 embed. 삭제는 soft delete 기본.

---

# 🎯 Phase 1 — 운영 기반 구축

---

## 지시서 #1 — 공간(Property) 도메인 구축

### 왜 이게 가장 먼저인가?

HIERO의 **모든 데이터는 공간에 귀속**됩니다.
- task → 어느 공간의?
- 담당자 → 어느 공간의?
- 청소 스케줄 → 어느 공간의?
- 매출 → 어느 공간에서?

공간 테이블 없이는 다른 어떤 기능도 의미가 없습니다.

### 의존성

없음. 첫 단계.

### 데이터 모델

```go
// models/property.go
package models

import "time"

type Property struct {
    ID          uint      `gorm:"primarykey" json:"id"`

    // 식별
    Code        string    `gorm:"size:50;uniqueIndex;not null" json:"code"`        // HIERO-001
    Name        string    `gorm:"size:255;not null" json:"name"`                   // 강남 오피스텔 A동 502
    Address     string    `gorm:"size:500;not null" json:"address"`

    // 분류
    Type        string    `gorm:"size:50;not null" json:"type"`                    // apartment, officetel, oneroom, villa
    Status      string    `gorm:"size:30;not null;default:active" json:"status"`   // active, paused, terminated

    // 임대 정보
    OwnerID     *uint     `gorm:"index" json:"owner_id"`                           // #7에서 owners 테이블과 연결
    MonthlyRent uint      `json:"monthly_rent"`                                    // 월세 (원)
    Deposit     uint      `json:"deposit"`                                         // 보증금 (원)

    // 위탁 기간
    StartDate   time.Time  `json:"start_date"`
    EndDate     *time.Time `json:"end_date"`

    // 메타
    Notes       string    `gorm:"type:text" json:"notes"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

> ⚠️ `Type`, `Status` 같은 enum 성격 필드는 일단 string. 나중에 enum 검증은 service layer에서.

### API 스펙

| Method | URL | 권한 | 설명 |
|--------|-----|------|------|
| GET | /admin/properties | admin | 목록 (검색/필터/페이지네이션) |
| GET | /admin/properties/:id | admin | 상세 |
| POST | /admin/properties | admin | 생성 |
| PATCH | /admin/properties/:id | admin | 수정 |
| DELETE | /admin/properties/:id | super_admin | 삭제 (soft) |
| GET | /admin/properties/stats | admin | 통계 (총 개수, 상태별, 타입별) |
| POST | /admin/properties/bulk-import | super_admin | CSV 일괄 등록 |

**쿼리 파라미터** (목록):
- `q`: 이름/주소/코드 검색
- `status`: active/paused/terminated
- `type`: apartment/officetel/...
- `page`, `page_size` (기본 1, 20)
- `sort`: created_at_desc (기본), name_asc, code_asc

### Admin UI 요구사항

- **PropertiesListPage** (`/admin/properties`)
  - 검색바 (이름/주소/코드)
  - 필터 드롭다운 (상태, 타입)
  - 테이블: 코드, 이름, 주소, 타입, 상태, 월세, 시작일
  - 페이지네이션
  - "신규 등록" 버튼
  - "CSV 일괄 등록" 버튼

- **PropertyFormPage** (`/admin/properties/new`, `/admin/properties/:id/edit`)
  - 모든 필드 입력
  - 코드 자동 생성 옵션 (HIERO-001 자동 증분)

- **PropertyDetailPage** (`/admin/properties/:id`)
  - 기본 정보 카드
  - 탭: 기본정보 / 담당자(#2) / 태스크(#3) / 이슈(#6) / 정산(#7)
  - **이번 단계에선 "기본정보" 탭만 구현. 나머지는 placeholder**

### 완료 기준 (DoD)

- [ ] `Property` 모델 추가 + AutoMigrate에 등록
- [ ] CRUD API 7개 엔드포인트 동작 (Postman 검증)
- [ ] 검색/필터/페이지네이션 동작
- [ ] CSV 일괄 등록 → 진우님의 현재 100채 데이터를 한 번에 import
- [ ] Admin UI 3개 페이지 동작 (List / Form / Detail)
- [ ] 통계 API에서 100채 카운트 정확히 반환

### 예상 소요

**5~7일** (백엔드 2일, CSV import 1일, 프론트엔드 3~4일)

### 🤖 Claude Code 프롬프트

```
HIERO 프로젝트에 Property(공간) 도메인을 추가해줘.

## 데이터 모델 (backend/models/property.go)
- ID, Code(unique), Name, Address, Type, Status(default: active), OwnerID(*uint, nullable),
  MonthlyRent, Deposit, StartDate, EndDate(*time.Time), Notes, CreatedAt, UpdatedAt
- Type: apartment/officetel/oneroom/villa (string, validation은 service layer)
- Status: active/paused/terminated

## 백엔드 작업
1. models/property.go 생성
2. main.go의 AutoMigrate 목록에 Property 추가
3. handler/admin_property.go 생성 - 다음 엔드포인트:
   - GET    /admin/properties             (검색 q, 필터 status/type, page/page_size, sort)
   - GET    /admin/properties/:id
   - POST   /admin/properties
   - PATCH  /admin/properties/:id
   - DELETE /admin/properties/:id         (super_admin only, soft delete)
   - GET    /admin/properties/stats       (총 개수, status별, type별 카운트)
   - POST   /admin/properties/bulk-import (multipart/form-data, CSV 파일)
4. router/admin.go에 위 라우트 등록 (기존 /admin 그룹에 추가)

## 응답 포맷
- 단건: { "data": { ... } }
- 목록: { "data": [...], "total": N, "page": P, "page_size": S }
- 에러: { "error": { "code": "...", "message": "..." } }

## 프론트엔드 (admin/)
1. src/api/property.ts - axios 클라이언트로 API 호출 함수
2. src/pages/PropertiesListPage.tsx - 검색/필터/테이블/페이지네이션
3. src/pages/PropertyFormPage.tsx - 신규/수정 폼
4. src/pages/PropertyDetailPage.tsx - 탭 구조 (기본정보만 구현, 나머지는 "준비 중" placeholder)
5. App.tsx 라우팅 추가:
   - /properties (list)
   - /properties/new
   - /properties/:id
   - /properties/:id/edit

## CSV Import 사양
- 헤더: code,name,address,type,monthly_rent,deposit,start_date,notes
- 빈 code면 자동 생성 (HIERO-XXX 다음 번호)
- 중복 code면 에러 응답

## 완료 검증
1. Postman으로 POST /admin/properties로 1개 생성
2. CSV 파일로 100채 일괄 등록
3. /admin/properties/stats가 정확한 카운트 반환
4. Admin UI에서 검색, 필터, 페이지네이션 동작 확인

기존 admin_users, tasks 코드 스타일을 참고해서 일관성 유지해줘.
```

---

## 지시서 #2 — 운영팀(Operator) 권한 시스템 확장

### 왜 필요한가?

현재는 `super_admin` / `admin` 두 단계뿐. 실제 운영에서는:
- **Operations Manager**: 전 공간 관리
- **Cleaner**: 자기 담당 공간만
- **Maintenance**: 정비 task만
- **Sales**: 신규 위탁 영업
- **Customer Service**: 게스트 응대

각 역할이 보는/할 수 있는 게 달라야 합니다. 또한 **공간별로 누가 담당인지** 매핑 필요.

### 의존성

`#1 Property 도메인` 완료. (담당자 매핑이 공간 단위라서)

### 데이터 모델

**기존 `admin_users.role` 확장**:

```go
// 가능한 role 값:
// super_admin, operations_manager, cleaner, maintenance, sales, customer_service
```

**신규 테이블 `property_assignments`**:

```go
// models/property_assignment.go
type PropertyAssignment struct {
    ID         uint      `gorm:"primarykey" json:"id"`
    PropertyID uint      `gorm:"index;not null" json:"property_id"`
    OperatorID uint      `gorm:"index;not null" json:"operator_id"`  // admin_users.id
    Role       string    `gorm:"size:30;not null" json:"role"`        // primary, backup
    AssignedAt time.Time `json:"assigned_at"`
    CreatedAt  time.Time `json:"created_at"`
    UpdatedAt  time.Time `json:"updated_at"`

    Property   *Property `gorm:"foreignKey:PropertyID" json:"property,omitempty"`
    Operator   *AdminUser `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
}

// unique 제약: (property_id, operator_id, role)
```

**미들웨어 확장**:

```go
// middleware/auth.go에 추가
func RequireRoles(roles ...string) gin.HandlerFunc { ... }

// 사용 예
admin.GET("/properties", middleware.RequireRoles("super_admin", "operations_manager", "admin"), ...)
```

### API 스펙

| Method | URL | 권한 | 설명 |
|--------|-----|------|------|
| GET | /admin/operators | admin+ | 운영팀원 목록 (역할 필터 가능) |
| POST | /admin/operators | super_admin | 운영팀원 등록 (admin_users에 추가) |
| PATCH | /admin/operators/:id/role | super_admin | 역할 변경 |
| GET | /admin/properties/:id/operators | admin+ | 공간별 담당자 |
| POST | /admin/properties/:id/operators | super_admin, ops_mgr | 담당자 할당 |
| DELETE | /admin/properties/:id/operators/:assignmentId | super_admin, ops_mgr | 할당 해제 |
| GET | /admin/operators/:id/properties | admin+ | 운영자별 담당 공간 |

### Admin UI 요구사항

- **OperatorsPage** (`/admin/operators`)
  - 역할별 색상 배지
  - 필터 (역할별)
  - 신규 등록 / 역할 변경 / 비활성화

- **PropertyDetailPage** "담당자" 탭 활성화
  - 현재 담당자 목록 (primary / backup 구분)
  - 담당자 추가 / 제거

- **OperatorDetailPage** (`/admin/operators/:id`)
  - 담당 공간 리스트

### 완료 기준 (DoD)

- [ ] `admin_users.role` enum 확장 (검증 추가)
- [ ] `PropertyAssignment` 모델 + 마이그레이션
- [ ] `RequireRoles` 미들웨어 + 기존 라우트에 적용
- [ ] 위 API 7개 동작
- [ ] Admin UI: 운영자 관리 + 공간별 담당자 매핑
- [ ] super_admin이 아닌 계정으로 권한 우회 시도 → 403

### 🤖 Claude Code 프롬프트

```
HIERO에 운영팀 권한 시스템을 확장해줘.

## 1. admin_users.role 확장
- 현재 super_admin/admin → super_admin/operations_manager/cleaner/maintenance/sales/customer_service/admin
- handler/admin_user.go에서 POST/PATCH 시 role 값 검증 추가 (허용 목록만)

## 2. PropertyAssignment 모델 추가 (models/property_assignment.go)
- ID, PropertyID, OperatorID(=admin_users.id), Role(primary/backup), AssignedAt, 타임스탬프
- (property_id, operator_id, role) unique index
- AutoMigrate에 등록

## 3. middleware/auth.go에 RequireRoles 추가
func RequireRoles(roles ...string) gin.HandlerFunc {
    // JWT에서 role 꺼내서 roles에 포함되는지 확인, 아니면 403
}

## 4. 새 핸들러 (handler/operator.go)
다음 라우트 구현:
- GET    /admin/operators                                    (필터: role)
- POST   /admin/operators                                    (super_admin only)
- PATCH  /admin/operators/:id/role                           (super_admin only)
- GET    /admin/properties/:id/operators
- POST   /admin/properties/:id/operators                     (super_admin, operations_manager)
- DELETE /admin/properties/:id/operators/:assignmentId       (super_admin, operations_manager)
- GET    /admin/operators/:id/properties

## 5. Admin UI
- pages/OperatorsPage.tsx: 운영팀원 목록 (역할 배지 색상으로)
- pages/OperatorDetailPage.tsx: 운영자 상세 + 담당 공간 리스트
- PropertyDetailPage의 "담당자" 탭 활성화 (현재 담당자 + 추가/제거)
- 라우팅 추가

## 검증
1. 일반 admin이 POST /admin/operators 시도 → 403
2. super_admin이 새 cleaner 계정 생성
3. 그 cleaner를 특정 공간에 primary 담당자로 할당
4. cleaner 로그인 → 자기 담당 공간만 보이는지 확인 (Phase 2의 Task 필터링과 연계)

#1에서 만든 Property 모델/API와 일관성 유지.
```

---

# 🎯 Phase 2 — 일일 운영 자동화

---

## 지시서 #3 — Task 시스템 고도화

### 왜 필요한가?

현재 `tasks` 테이블 구조가 너무 단순:
```
id, title, description, status, team
```

실제 운영에는 부족함:
- "**어느 공간**의 task인지" 없음 → property_id 필요
- "**누가** 처리할지" 없음 → assignee_id 필요
- "**언제까지**" 없음 → due_date 필요
- "**얼마나 급한지**" 없음 → priority 필요
- "**무슨 종류**의 task인지" 없음 → type 필요
- "매주 반복되는 청소" 같은 반복 task 처리 불가

또한 칸반 UI로 직관적인 운영이 필요합니다.

### 의존성

`#1 Property` + `#2 Operator` 완료.

### 데이터 모델 변경

```go
// models/task.go (확장)
type Task struct {
    ID           uint       `gorm:"primarykey" json:"id"`

    // 기존
    Title        string     `gorm:"size:255;not null" json:"title"`
    Description  string     `gorm:"type:text" json:"description"`
    Status       string     `gorm:"size:30;not null;default:pending" json:"status"`
    // status: pending, in_progress, blocked, done, cancelled
    Team         string     `gorm:"size:50" json:"team"`

    // 신규
    PropertyID   *uint      `gorm:"index" json:"property_id"`
    AssigneeID   *uint      `gorm:"index" json:"assignee_id"`     // admin_users.id
    Priority     string     `gorm:"size:20;not null;default:medium" json:"priority"`
    // priority: low, medium, high, urgent
    Type         string     `gorm:"size:30;not null;default:admin" json:"type"`
    // type: cleaning, maintenance, admin, sales, customer_service, inspection
    DueDate      *time.Time `json:"due_date"`
    CompletedAt  *time.Time `json:"completed_at"`

    // 반복 task 지원
    Recurring    string     `gorm:"size:20;default:none" json:"recurring"`
    // none, daily, weekly, biweekly, monthly
    ParentTaskID *uint      `gorm:"index" json:"parent_task_id"`  // 반복의 원본

    CreatedAt    time.Time  `json:"created_at"`
    UpdatedAt    time.Time  `json:"updated_at"`

    Property     *Property  `gorm:"foreignKey:PropertyID" json:"property,omitempty"`
    Assignee     *AdminUser `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
}
```

> ⚠️ 기존 task 데이터가 있다면 마이그레이션 시 priority/type에 default 값 채워주는 SQL 한 번 실행 필요.

### API 스펙

| Method | URL | 설명 |
|--------|-----|------|
| GET | /admin/tasks | 목록 (강력한 필터링) |
| GET | /admin/tasks/:id | 상세 |
| POST | /admin/tasks | 생성 |
| PATCH | /admin/tasks/:id | 수정 |
| PATCH | /admin/tasks/:id/status | 상태 변경 (칸반 드래그용) |
| PATCH | /admin/tasks/:id/assign | 담당자 할당 |
| DELETE | /admin/tasks/:id | 삭제 |
| GET | /admin/tasks/kanban | 칸반 뷰용 (상태별 그룹핑) |

**쿼리 파라미터** (목록/칸반):
- `property_id`, `assignee_id`, `team`, `type`, `priority`, `status`
- `due_before`, `due_after` (ISO date)
- `q` (제목/설명 검색)

### Admin UI 요구사항

- **TasksKanbanPage** (`/admin/tasks` 기본 화면)
  - 4컬럼: Pending / In Progress / Blocked / Done
  - 드래그앤드롭으로 status 변경 → PATCH /tasks/:id/status
  - 카드: 제목, priority 배지, due_date, 담당자 아바타, 공간 코드
  - 상단 필터바: 공간/담당자/팀/타입/우선순위
  - 라이브러리: `@dnd-kit/core` 추천

- **TasksListPage** (`/admin/tasks/list`)
  - 테이블 뷰 (스프레드시트 느낌)

- **TaskFormModal**
  - 신규 생성 / 수정
  - Property 선택 시 → 그 공간 담당자 자동 할당 옵션

### 완료 기준 (DoD)

- [ ] Task 모델 확장 + 기존 데이터 마이그레이션 SQL
- [ ] 강력한 필터링 동작 (모든 쿼리 파라미터 조합)
- [ ] 칸반 UI 드래그앤드롭 동작
- [ ] property_id 채워진 task → 해당 공간 detail 페이지의 "태스크" 탭에 표시
- [ ] assignee_id 채워진 task → operator detail 페이지에 표시
- [ ] 반복 task 생성은 다음 단계(#4)에서 자동화 처리

### 🤖 Claude Code 프롬프트

```
HIERO Task 시스템을 고도화해줘.

## 1. Task 모델 확장 (models/task.go 수정)
기존 필드 유지하고 다음 추가:
- PropertyID (*uint, FK to properties.id)
- AssigneeID (*uint, FK to admin_users.id)
- Priority (string, default "medium", values: low/medium/high/urgent)
- Type (string, default "admin", values: cleaning/maintenance/admin/sales/customer_service/inspection)
- DueDate (*time.Time)
- CompletedAt (*time.Time)
- Recurring (string, default "none", values: none/daily/weekly/biweekly/monthly)
- ParentTaskID (*uint, FK to tasks.id - self-reference)

GORM 관계 추가: Property, Assignee 미리 로드 가능하게.

기존 데이터 호환을 위한 마이그레이션:
- 모든 기존 task의 priority='medium', type='admin', recurring='none' 자동 설정 (default로 처리됨)

## 2. handler/admin_task.go 확장
- 기존 라우트 유지하면서 다음 추가:
  - PATCH /admin/tasks/:id/assign (body: {assignee_id})
  - GET   /admin/tasks/kanban (status별로 그룹핑된 응답)

- GET /admin/tasks의 필터 확장:
  - property_id, assignee_id, team, type, priority, status
  - due_before, due_after (ISO date)
  - q (title/description ILIKE 검색)

- POST/PATCH 시 모든 신규 필드 처리

## 3. Frontend (admin/)
- pages/TasksKanbanPage.tsx: 4컬럼 칸반 (Pending/InProgress/Blocked/Done)
  - @dnd-kit/core 사용 (npm install @dnd-kit/core @dnd-kit/sortable)
  - 드래그 끝나면 PATCH /tasks/:id/status 호출
  - 카드에 priority 배지 색상 (low=gray, medium=blue, high=orange, urgent=red)
  - 상단 필터바
- pages/TasksListPage.tsx: 테이블 뷰
- components/TaskFormModal.tsx: 생성/수정 모달
- 라우팅: /tasks (kanban 기본), /tasks/list

## 4. PropertyDetailPage의 "태스크" 탭 활성화
- 해당 property_id의 task 목록 표시 (간단한 리스트)

## 검증
1. 새 task 생성 시 모든 필드 제대로 저장
2. 기존 task가 깨지지 않음
3. 칸반에서 카드 드래그 → status 즉시 업데이트
4. 필터 조합 (예: property_id=5 + priority=high + status=pending)
```

---

## 지시서 #4 — 청소/정비 자동 스케줄링

### 왜 필요한가?

100채를 사람이 다 신경 쓸 수 없습니다. 시스템이 **자동으로 task를 생성**해야 합니다.

예: "강남 오피스텔 502호는 매주 화요일 청소" → 매주 월요일 자정에 다음 화요일 청소 task 자동 생성.

### 의존성

`#3 Task 시스템 고도화` 완료. (자동 생성할 대상이 task)

### 데이터 모델

```go
// models/schedule.go
type Schedule struct {
    ID                  uint       `gorm:"primarykey" json:"id"`
    PropertyID          uint       `gorm:"index;not null" json:"property_id"`

    Type                string     `gorm:"size:30;not null" json:"type"`
    // type: cleaning, maintenance, inspection

    Title               string     `gorm:"size:255;not null" json:"title"`
    Description         string     `gorm:"type:text" json:"description"`

    Frequency           string     `gorm:"size:20;not null" json:"frequency"`
    // daily, weekly, biweekly, monthly

    DayOfWeek           *int       `json:"day_of_week"`              // 0(일)~6(토), weekly/biweekly용
    DayOfMonth          *int       `json:"day_of_month"`             // 1~31, monthly용
    TimeOfDay           string     `gorm:"size:10" json:"time_of_day"` // "HH:MM"

    AssignedOperatorID  *uint      `json:"assigned_operator_id"`     // 자동 할당될 담당자
    DefaultPriority     string     `gorm:"size:20;default:medium" json:"default_priority"`

    Active              bool       `gorm:"default:true" json:"active"`
    LastExecutedAt      *time.Time `json:"last_executed_at"`
    NextDueAt           time.Time  `gorm:"index" json:"next_due_at"`

    CreatedAt           time.Time  `json:"created_at"`
    UpdatedAt           time.Time  `json:"updated_at"`
}
```

### Cron Job

```go
// service/scheduler.go
package service

import (
    "github.com/robfig/cron/v3"
    // ...
)

func StartScheduler() {
    c := cron.New()
    // 매일 자정에 실행
    c.AddFunc("0 0 * * *", generateScheduledTasks)
    c.Start()
}

func generateScheduledTasks() {
    // 1. NextDueAt이 오늘 이전인 active schedule 조회
    // 2. 각각에 대해 Task 생성 (PropertyID, AssigneeID, Type, Title 등 복사)
    // 3. Schedule.LastExecutedAt = now, NextDueAt = 다음 주기로 갱신
    // 4. (Phase 3에서 알림 트리거 추가)
}
```

> 의존성: `go get github.com/robfig/cron/v3`

### API 스펙

| Method | URL | 설명 |
|--------|-----|------|
| GET | /admin/schedules | 목록 (property_id, type 필터) |
| GET | /admin/schedules/:id | 상세 |
| POST | /admin/schedules | 생성 |
| PATCH | /admin/schedules/:id | 수정 |
| PATCH | /admin/schedules/:id/toggle | 활성/비활성 토글 |
| DELETE | /admin/schedules/:id | 삭제 |
| POST | /admin/schedules/:id/run-now | 즉시 한 번 실행 (테스트용) |
| GET | /admin/properties/:id/schedules | 공간별 스케줄 |

### UI 요구사항

- **PropertyDetailPage**에 "스케줄" 탭 추가
  - 스케줄 목록 + 추가/수정/토글
  - 다음 실행 시각 표시

- **SchedulesPage** (`/admin/schedules`)
  - 모든 공간의 스케줄 한눈에
  - 캘린더 뷰 (옵션, 추후)

### 완료 기준 (DoD)

- [ ] Schedule 모델 + 마이그레이션
- [ ] cron job 등록 (main.go에서 StartScheduler 호출)
- [ ] 자정 트리거 시 정상적으로 task 생성 (`run-now`로 검증)
- [ ] Frequency 별 NextDueAt 계산 정확 (특히 monthly의 31일 처리)
- [ ] Admin UI에서 스케줄 등록 → 다음 실행에 task 자동 생성 확인

### 🤖 Claude Code 프롬프트

```
HIERO에 청소/정비 자동 스케줄링을 추가해줘.

## 1. 모델 (models/schedule.go)
- ID, PropertyID, Type(cleaning/maintenance/inspection), Title, Description
- Frequency(daily/weekly/biweekly/monthly), DayOfWeek(*int), DayOfMonth(*int), TimeOfDay(string "HH:MM")
- AssignedOperatorID(*uint), DefaultPriority(string)
- Active(bool, default true), LastExecutedAt(*time.Time), NextDueAt(time.Time, index)
- 타임스탬프

AutoMigrate에 추가.

## 2. service/scheduler.go (신규 디렉토리 service/)
- robfig/cron/v3 사용 (go get github.com/robfig/cron/v3)
- StartScheduler() 함수: 매일 자정 0시 0분에 generateScheduledTasks 실행
- generateScheduledTasks():
  - WHERE active = true AND next_due_at <= NOW() 인 schedule 조회
  - 각각 Task 생성:
    - Title, Description, Type, AssigneeID = AssignedOperatorID, Priority = DefaultPriority
    - PropertyID, DueDate = NextDueAt
    - Status = "pending", Recurring = schedule.Frequency, ParentTaskID는 NULL
  - Schedule 업데이트: LastExecutedAt = now, NextDueAt = 다음 주기 시각
  - Frequency 계산:
    - daily: +1일
    - weekly: +7일
    - biweekly: +14일
    - monthly: +1달 (DayOfMonth 유지, 28~31 경계 안전 처리)

## 3. main.go에 service.StartScheduler() 호출 추가 (서버 시작 시)

## 4. handler/schedule.go
- 표준 CRUD 라우트 + 다음:
  - PATCH /admin/schedules/:id/toggle (active 반전)
  - POST  /admin/schedules/:id/run-now (해당 schedule 즉시 1회 실행, 테스트용)
  - GET   /admin/properties/:id/schedules

## 5. Admin UI
- pages/SchedulesPage.tsx: 전체 스케줄 목록
- PropertyDetailPage의 "스케줄" 탭 활성화 (해당 공간 스케줄 + 추가/수정/토글)
- components/ScheduleFormModal.tsx
- 라우팅 추가

## 검증
1. "강남 502호 매주 화요일 10:00 청소" 스케줄 등록
2. NextDueAt이 다음 화요일로 자동 계산
3. /admin/schedules/:id/run-now 호출 → tasks 테이블에 새 task 생성됨
4. 자정 cron이 동작하는지 (테스트 위해 임시로 매분으로 변경 후 복구)

#3에서 만든 Task 모델/API와 데이터 일관성 유지.
```

---

# 🎯 Phase 3 — 소통/대응

---

## 지시서 #5 — Slack 알림 시스템

### 왜 필요한가?

운영팀이 시스템을 항상 보고 있을 수 없습니다. **이벤트 발생 즉시 알려줘야** 합니다.
- 새 task 할당 → 담당자에게 DM
- 긴급 이슈(#6) → 매니저 채널
- 청소 누락(#4) → 담당자 + 매니저
- 매일 오전 9시 → 운영 채널에 일일 요약

### 의존성

`#3 Task` + `#4 Schedule` 완료. (알림 트리거할 이벤트들)

### 데이터 모델

```go
// models/notification.go
type Notification struct {
    ID          uint      `gorm:"primarykey" json:"id"`
    Channel     string    `gorm:"size:20;not null" json:"channel"`
    // channel: slack, email (향후 sms, kakao)

    EventType   string    `gorm:"size:50;not null" json:"event_type"`
    // event_type: task.assigned, task.overdue, issue.created, daily.summary, ...

    RecipientUserID *uint   `gorm:"index" json:"recipient_user_id"` // 특정 운영자
    RecipientChannel string `gorm:"size:100" json:"recipient_channel"` // Slack 채널명 (#operations 등)

    Subject     string    `gorm:"size:255" json:"subject"`
    Body        string    `gorm:"type:text" json:"body"`
    Payload     string    `gorm:"type:json" json:"payload"` // 원본 이벤트 데이터

    Status      string    `gorm:"size:20;not null;default:pending" json:"status"`
    // pending, sent, failed

    SentAt      *time.Time `json:"sent_at"`
    ErrorMsg    string     `gorm:"type:text" json:"error_msg"`

    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

### Slack 통합

```go
// service/slack.go
type SlackClient struct {
    WebhookURL string
}

func (s *SlackClient) Send(message string, channel string) error {
    // POST to webhook with JSON payload
}
```

**환경 변수 추가** (`.env`):
```
SLACK_WEBHOOK_DEFAULT=https://hooks.slack.com/services/xxx
SLACK_WEBHOOK_URGENT=https://hooks.slack.com/services/yyy
```

> 진우님: 두 개 채널 별도 워크스페이스에 만들어주세요. 일반 운영용 + 긴급용.

### 트리거 통합

각 핸들러/서비스에서 이벤트 발생 시 알림 enqueue:

```go
// 예: handler/task.go에서 task 할당 시
notification.Enqueue(notification.TaskAssigned, task)

// 예: service/scheduler.go에서 task 자동 생성 후
if task.Priority == "urgent" {
    notification.Enqueue(notification.TaskUrgent, task)
}
```

### API 스펙

| Method | URL | 설명 |
|--------|-----|------|
| GET | /admin/notifications | 알림 이력 |
| POST | /admin/notifications/test | 테스트 발송 (super_admin) |
| GET | /admin/notifications/settings | 사용자별 알림 설정 |
| PATCH | /admin/notifications/settings | 알림 설정 변경 |

### 일일 요약 Cron

```go
// 매일 오전 9시
c.AddFunc("0 9 * * *", sendDailySummary)

// sendDailySummary:
// - 어제 완료된 task 수
// - 오늘 due인 task 수
// - 진행 중 이슈 수
// - Slack 운영 채널로 전송
```

### 완료 기준 (DoD)

- [ ] Notification 모델 + 마이그레이션
- [ ] Slack webhook 연동 동작 (테스트 발송 성공)
- [ ] 다음 이벤트에서 알림 자동 발송:
  - [ ] task 할당 시 → 담당자
  - [ ] task 자동 생성(스케줄러) 시 → 담당자
  - [ ] task 마감 임박/지연 시 → 담당자
  - [ ] 매일 9시 일일 요약 → 운영 채널
- [ ] Notifications 이력 페이지에서 조회 가능
- [ ] 발송 실패 시 retry 또는 status=failed 기록

### 🤖 Claude Code 프롬프트

```
HIERO에 Slack 알림 시스템을 추가해줘.

## 1. 모델 (models/notification.go)
- ID, Channel(slack/email), EventType, RecipientUserID(*uint), RecipientChannel(string)
- Subject, Body, Payload(JSON string), Status(pending/sent/failed)
- SentAt(*time.Time), ErrorMsg, 타임스탬프

AutoMigrate 등록.

## 2. service/slack.go
- SlackClient struct { WebhookURL string }
- Send(message string, channel string) error
  - POST to webhook with JSON: { "text": message, "channel": channel }
  - 200 OK 아니면 에러 반환

## 3. service/notification.go (이벤트 진입점)
- Enqueue(eventType string, data interface{}) error
  - DB에 Notification 레코드 생성 (status: pending)
  - 즉시 발송 시도 (or 별도 worker, 일단 즉시)
  - Slack 채널 결정 로직:
    - urgent 류 → SLACK_WEBHOOK_URGENT
    - 그 외 → SLACK_WEBHOOK_DEFAULT
    - 특정 사용자 DM은 일단 보류 (운영 채널 멘션으로 대체)
  - 메시지 템플릿 (event_type별):
    - task.assigned: "🆕 새 태스크: {{title}} (담당: {{assignee}}) - {{property_code}}"
    - task.overdue: "⏰ 지연된 태스크: {{title}}"
    - daily.summary: "📊 일일 운영 요약 - 어제 완료 {{n}}건, 오늘 due {{m}}건..."

## 4. 트리거 통합
- handler/admin_task.go의 PATCH /tasks/:id/assign 에서 → notification.Enqueue("task.assigned", task)
- service/scheduler.go의 generateScheduledTasks 마지막에 → 생성된 각 task에 대해 Enqueue

## 5. 일일 요약 cron
- service/scheduler.go에 추가
- 매일 09:00에 sendDailySummary() 실행
- 어제 완료 task 수, 오늘 due task 수, open issue 수 (issues 테이블 #6에서) 조회
- 운영 채널로 전송

## 6. handler/notification.go
- GET /admin/notifications (이력 조회, 페이지네이션, status 필터)
- POST /admin/notifications/test (super_admin only, body: { channel, message } → 실제 Slack 발송)

## 7. 환경 변수 추가 (.env, .env.example)
- SLACK_WEBHOOK_DEFAULT
- SLACK_WEBHOOK_URGENT

## 8. Admin UI
- pages/NotificationsPage.tsx: 알림 이력 (status 색상)
- pages/NotificationTestPage.tsx (super_admin only): 테스트 발송 폼

## 검증
1. .env에 SLACK_WEBHOOK_DEFAULT 채우기 (진우님이 미리 webhook 발급)
2. POST /admin/notifications/test → Slack 채널에 메시지 도착
3. task 담당자 변경 → 자동 알림 발송
4. 스케줄러로 task 자동 생성 → 알림 발송
5. notifications 테이블에 status=sent로 기록

#3, #4 모델/서비스와 통합. 환경변수 누락 시 에러 대신 로깅하고 silently skip (개발 환경 안전).
```

---

## 지시서 #6 — 이슈/컴플레인 트래킹

### 왜 필요한가?

100채 운영하면 **매일 이슈가 발생**합니다. 시설 고장, 청소 불만, 소음, 출입 문제, 인터넷 안 됨, 보일러 고장 등.

이걸 카톡이나 전화로만 받으면 누락되고, 응답 시간이 늦어지고, 게스트 만족도가 떨어집니다.

체계적인 이슈 트래킹 시스템이 필요합니다.

### 의존성

`#1 Property` + `#3 Task` + `#5 Notification` 완료.

### 데이터 모델

```go
// models/issue.go
type Issue struct {
    ID            uint      `gorm:"primarykey" json:"id"`
    PropertyID    uint      `gorm:"index;not null" json:"property_id"`

    // 신고자
    ReporterType  string    `gorm:"size:20;not null" json:"reporter_type"`
    // guest, operator, owner
    ReporterName  string    `gorm:"size:100" json:"reporter_name"`
    ReporterContact string  `gorm:"size:100" json:"reporter_contact"`

    // 분류
    Category      string    `gorm:"size:30;not null" json:"category"`
    // facility(시설), cleanliness(청결), noise(소음), access(출입), wifi, heating, other
    Severity      string    `gorm:"size:20;not null;default:medium" json:"severity"`
    // low, medium, high, critical

    // 내용
    Title         string    `gorm:"size:255;not null" json:"title"`
    Description   string    `gorm:"type:text" json:"description"`
    PhotoURLs     string    `gorm:"type:json" json:"photo_urls"` // JSON 배열

    // 처리
    Status        string    `gorm:"size:30;not null;default:open" json:"status"`
    // open, in_progress, resolved, closed
    AssignedToID  *uint     `gorm:"index" json:"assigned_to_id"`
    LinkedTaskID  *uint     `gorm:"index" json:"linked_task_id"` // 자동 생성된 처리 task

    // 타이밍
    OpenedAt      time.Time  `json:"opened_at"`
    AcknowledgedAt *time.Time `json:"acknowledged_at"`
    ResolvedAt    *time.Time `json:"resolved_at"`

    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}
```

### API 스펙

| Method | URL | 권한 | 설명 |
|--------|-----|------|------|
| **POST** | **/api/issues/report** | **공개** | **게스트가 외부에서 신고** |
| GET | /admin/issues | admin | 목록 (강력한 필터) |
| GET | /admin/issues/:id | admin | 상세 |
| POST | /admin/issues | admin | 운영팀 직접 등록 |
| PATCH | /admin/issues/:id | admin | 수정 |
| PATCH | /admin/issues/:id/acknowledge | admin | 접수 확인 |
| PATCH | /admin/issues/:id/resolve | admin | 해결 처리 |
| POST | /admin/issues/:id/create-task | admin | 처리 task 생성 + 연결 |

### 자동 처리 흐름

```
게스트가 POST /api/issues/report (Property Code + 내용)
   ↓
1. Issue 레코드 생성 (status=open)
2. 자동 task 생성 (해당 공간 담당자에게, priority=severity 매핑)
3. Slack 긴급 채널로 즉시 알림 (severity=high/critical일 때)
4. issue.LinkedTaskID = 생성된 task.ID
   ↓
운영팀 acknowledge → AcknowledgedAt 기록 (응답 시간 측정)
   ↓
운영팀 resolve → ResolvedAt + status=resolved
```

### Public 신고 페이지

`/api/issues/report`는 인증 없이 호출 가능. 게스트가 QR 코드 등으로 접근하는 외부 페이지에서 사용.

> 단, **rate limiting** 필요: IP별 5분에 5건 제한 (스팸 방지)

### Admin UI

- **IssuesPage** (`/admin/issues`)
  - 필터: 상태, 심각도, 카테고리, 공간
  - severity별 색상 구분 (critical=빨강, high=주황 등)
  - 미접수(open) 건 상단 강조

- **PropertyDetailPage** "이슈" 탭 활성화

### 완료 기준 (DoD)

- [ ] Issue 모델 + 마이그레이션
- [ ] 공개 신고 API (rate limit 포함)
- [ ] 신고 → Issue 생성 + task 자동 생성 + Slack 알림 (severity 따라)
- [ ] acknowledge / resolve 흐름 동작
- [ ] Admin UI에서 이슈 처리 전 과정 확인
- [ ] 응답 시간 통계 (open → acknowledged 평균 시간) 노출

### 🤖 Claude Code 프롬프트

```
HIERO에 이슈/컴플레인 트래킹을 추가해줘.

## 1. 모델 (models/issue.go)
- 위 스펙대로 모든 필드. PhotoURLs는 JSON string으로 일단 (S3 업로드는 후순위)
- AutoMigrate 등록

## 2. handler/issue.go
- 공개 라우트 (router/api.go):
  - POST /api/issues/report
  - body: { property_code, reporter_name, reporter_contact, category, severity, title, description }
  - rate limit: IP당 5분에 5건 (gin-contrib/limiter 또는 간단히 in-memory map)
  - 처리:
    1. property_code로 Property 찾기 (없으면 400)
    2. Issue 생성 (status=open)
    3. 해당 Property의 primary 담당자 조회 (PropertyAssignment)
    4. Task 자동 생성 (assignee=담당자, priority=severity 매핑, type=customer_service, title="이슈 처리: " + issue.title)
    5. Issue.LinkedTaskID = task.ID
    6. severity가 high/critical이면 → notification.Enqueue("issue.urgent", issue) (Slack 긴급 채널)
    7. 응답: { "issue_id": N, "message": "신고가 접수되었습니다" }

- Admin 라우트 (router/admin.go):
  - GET    /admin/issues (필터: status, severity, category, property_id, q)
  - GET    /admin/issues/:id
  - POST   /admin/issues (운영팀 직접 등록)
  - PATCH  /admin/issues/:id
  - PATCH  /admin/issues/:id/acknowledge → AcknowledgedAt = now, status = in_progress
  - PATCH  /admin/issues/:id/resolve     → ResolvedAt = now, status = resolved
  - POST   /admin/issues/:id/create-task (이미 있으면 새로 만들지 않음)

## 3. severity → priority 매핑
- low → low, medium → medium, high → high, critical → urgent

## 4. Admin UI
- pages/IssuesPage.tsx: 이슈 목록 (severity 색상, status 배지)
- pages/IssueDetailPage.tsx: 상세 + acknowledge/resolve 버튼 + 연결된 task 링크
- PropertyDetailPage의 "이슈" 탭 활성화
- 라우팅 추가

## 5. 응답 시간 통계
- /admin/issues/stats:
  - 총 open 수, in_progress 수, 평균 응답 시간 (open → acknowledged_at)
  - 평균 해결 시간 (open → resolved_at)
  - severity별 분포

## 검증
1. curl로 /api/issues/report 호출 → 이슈 생성 + task 자동 생성 확인
2. severity=critical로 신고 → Slack 긴급 채널 알림 도착
3. acknowledge → 응답 시간 기록
4. rate limit 동작 (6번째 요청 → 429)

#3 Task, #5 Notification와 통합. PropertyAssignment에 primary 담당자 없으면 운영 매니저(operations_manager 역할 중 첫 번째)에게 fallback.
```

---

# 🎯 Phase 4 — 수익/관리

---

## 지시서 #7 — 임대인(Owner) 관리 + 월 정산

### 왜 필요한가?

진우님이 100채 운영 중 = **임대인이 최대 100명**. 이 사람들에게 매달:
- 매출 보고
- 운영 비용 정산
- HIERO 수수료 정산
- 임대인 입금액 계산
- 정산서 PDF 발송

수동으로 하면 한 달에 며칠 사라집니다. **자동화 필수**.

이게 사실상 운영 OS의 **핵심 가치**입니다.

### 의존성

`#1 Property` 완료. (정산은 공간 단위)

### 데이터 모델

```go
// models/owner.go
type Owner struct {
    ID            uint      `gorm:"primarykey" json:"id"`
    Name          string    `gorm:"size:100;not null" json:"name"`
    Type          string    `gorm:"size:20;not null" json:"type"` // individual, business
    Contact       string    `gorm:"size:100" json:"contact"`
    Email         string    `gorm:"size:255" json:"email"`
    BankName      string    `gorm:"size:50" json:"bank_name"`
    BankAccount   string    `gorm:"size:100" json:"bank_account"`
    BusinessNo    string    `gorm:"size:50" json:"business_no"`
    Notes         string    `gorm:"type:text" json:"notes"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}

// models/settlement.go
type Settlement struct {
    ID                 uint      `gorm:"primarykey" json:"id"`
    PropertyID         uint      `gorm:"index;not null" json:"property_id"`
    OwnerID            uint      `gorm:"index;not null" json:"owner_id"`
    Year               int       `gorm:"not null" json:"year"`
    Month              int       `gorm:"not null" json:"month"`

    // 수입
    Revenue            int       `json:"revenue"`              // 월 매출 (원)

    // 비용
    CleaningCost       int       `json:"cleaning_cost"`
    MaintenanceCost    int       `json:"maintenance_cost"`
    ChannelFee         int       `json:"channel_fee"`          // 에어비앤비 등 채널 수수료
    OtherCost          int       `json:"other_cost"`
    TotalCost          int       `json:"total_cost"`

    // HIERO 수수료
    ManagementFeeRate  float64   `json:"management_fee_rate"`  // 0.20 = 20%
    ManagementFee      int       `json:"management_fee"`

    // 임대인 입금액
    NetPayout          int       `json:"net_payout"`

    Status             string    `gorm:"size:20;not null;default:draft" json:"status"`
    // draft, confirmed, paid

    PaidAt             *time.Time `json:"paid_at"`
    Notes              string    `gorm:"type:text" json:"notes"`

    CreatedAt          time.Time `json:"created_at"`
    UpdatedAt          time.Time `json:"updated_at"`
}

// (year, month, property_id) unique
```

### Property 모델 업데이트

`Property.OwnerID`가 이제 실제로 연결됩니다 (#1에서 placeholder였음).

```go
// models/property.go
Owner *Owner `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
```

또한 **위탁 계약 정보**가 Property에 추가:

```go
ManagementFeeRate float64 `gorm:"default:0.20" json:"management_fee_rate"` // 20% 기본
```

### API 스펙

| Method | URL | 설명 |
|--------|-----|------|
| GET | /admin/owners | 임대인 목록 |
| POST | /admin/owners | 등록 |
| PATCH | /admin/owners/:id | 수정 |
| GET | /admin/owners/:id | 상세 + 보유 공간 + 정산 이력 |
| GET | /admin/settlements | 정산 목록 (year/month/owner_id 필터) |
| POST | /admin/settlements/generate | 특정 년월 일괄 생성 (super_admin) |
| GET | /admin/settlements/:id | 상세 |
| PATCH | /admin/settlements/:id | 수정 (수동 조정) |
| PATCH | /admin/settlements/:id/confirm | draft → confirmed |
| PATCH | /admin/settlements/:id/mark-paid | confirmed → paid |
| GET | /admin/settlements/:id/pdf | 정산서 PDF 다운로드 |

### 정산 자동 생성 로직

```go
// service/settlement.go
func GenerateMonthlySettlements(year int, month int) error {
    // 1. 활성 Property 전부 조회
    // 2. 각 property에 대해:
    //    - 해당 월 revenue (수동 입력 or 채널 연동, 일단은 수동)
    //    - 해당 월 cleaning_cost = 그 달의 cleaning task 비용 합계
    //      (Task에 cost 필드 추가 필요? → 일단 0으로 시작)
    //    - 다른 비용 0으로 시작
    //    - management_fee = revenue * property.management_fee_rate
    //    - net_payout = revenue - total_cost - management_fee
    // 3. Settlement 레코드 생성 (status=draft)
}
```

> ⚠️ Phase 1에선 revenue를 수동 입력 받음. 향후 채널 매니저(에어비앤비 등) 연동 시 자동화.

### Admin UI

- **OwnersPage** (`/admin/owners`)
  - 임대인 목록 + 보유 공간 수

- **OwnerDetailPage** (`/admin/owners/:id`)
  - 기본정보 / 보유 공간 / 정산 이력 (월별)

- **SettlementsPage** (`/admin/settlements`)
  - 년/월 선택 → 해당 월 정산 일괄 보기
  - "일괄 생성" 버튼 (super_admin)
  - 각 행: 공간 / 임대인 / 매출 / 비용 / 수수료 / 입금액 / 상태

- **SettlementDetailPage**
  - 모든 항목 수정 가능 (status=draft인 동안)
  - PDF 다운로드 버튼
  - confirm / mark-paid

- **PropertyDetailPage** "정산" 탭 활성화

### 완료 기준 (DoD)

- [ ] Owner, Settlement 모델 + 마이그레이션
- [ ] Property에 owner_id, management_fee_rate 연결
- [ ] 임대인 CRUD + 공간-임대인 연결
- [ ] 월 정산 일괄 생성 동작
- [ ] 정산 수정 / confirm / mark-paid 흐름
- [ ] PDF 정산서 다운로드 (간단한 HTML→PDF, 고도화는 후순위)
- [ ] 임대인 페이지에서 월별 정산 이력 조회

### 🤖 Claude Code 프롬프트

```
HIERO에 임대인(Owner) 관리와 월 정산 시스템을 추가해줘.

## 1. 모델
- models/owner.go: Owner (위 스펙대로)
- models/settlement.go: Settlement (위 스펙대로, (year, month, property_id) unique index)
- AutoMigrate 등록

## 2. Property 모델 업데이트
- Owner relation 추가 (foreignKey:OwnerID)
- ManagementFeeRate float64 (default 0.20) 필드 추가
- 기존 데이터 마이그레이션: 모든 Property에 management_fee_rate=0.20 (default로 처리됨)

## 3. handler/owner.go
- 표준 CRUD + GET /admin/owners/:id (보유 공간, 정산 이력 포함)

## 4. service/settlement.go
- GenerateMonthlySettlements(year, month int) error
  - 활성 Property 전체 조회
  - 각각에 대해 Settlement 생성 (status=draft)
  - 기본 계산:
    - revenue = 0 (수동 입력 대기)
    - cleaning_cost/maintenance_cost/channel_fee/other_cost = 0
    - management_fee = revenue * property.management_fee_rate
    - net_payout = revenue - total_cost - management_fee
  - 이미 해당 (year, month, property_id) 정산이 있으면 skip (idempotent)

## 5. handler/settlement.go
- GET    /admin/settlements (필터 year, month, owner_id, status)
- POST   /admin/settlements/generate (super_admin, body: { year, month })
- GET    /admin/settlements/:id
- PATCH  /admin/settlements/:id (status=draft인 동안만 수정 가능)
- PATCH  /admin/settlements/:id/confirm (draft → confirmed, 수정 불가)
- PATCH  /admin/settlements/:id/mark-paid (confirmed → paid, paid_at = now)
- GET    /admin/settlements/:id/pdf

수정 시 자동 재계산:
- TotalCost = CleaningCost + MaintenanceCost + ChannelFee + OtherCost
- ManagementFee = Revenue * property.management_fee_rate
- NetPayout = Revenue - TotalCost - ManagementFee

## 6. PDF 생성
- 간단한 라이브러리: github.com/jung-kurt/gofpdf
- 또는 HTML 템플릿 → wkhtmltopdf (배포 환경 고려)
- v1: HTML 페이지 응답 (브라우저에서 인쇄 → PDF) 도 가능. 우선은 이걸로.
- /admin/settlements/:id/pdf는 정산서 렌더된 HTML 응답 (Content-Type: text/html)

## 7. Admin UI
- pages/OwnersPage.tsx, pages/OwnerDetailPage.tsx, pages/OwnerFormPage.tsx
- pages/SettlementsPage.tsx (월 선택 → 해당 월 전체)
- pages/SettlementDetailPage.tsx (수정 가능 + 상태 전이 버튼)
- PropertyFormPage에 owner 선택 + management_fee_rate 입력 추가
- PropertyDetailPage의 "정산" 탭 활성화 (해당 공간 정산 이력)
- 라우팅 추가

## 검증
1. 임대인 1명 등록
2. Property 1개의 owner_id를 그 임대인으로 설정, management_fee_rate=0.20
3. POST /admin/settlements/generate { year: 2026, month: 5 }
4. Settlement 1건 생성 확인 (revenue=0)
5. revenue=2_000_000으로 수정 → management_fee 자동 400_000, net_payout 자동 1_600_000 계산
6. confirm → paid 전이 동작
7. PDF (HTML) 응답에서 정산 내역 잘 보임

추후 채널 매니저(에어비앤비) 연동으로 revenue 자동 입력은 후순위.
```

---

## 지시서 #8 — 운영 KPI 대시보드

### 왜 필요한가?

7단계까지 만들면 **데이터가 쌓이기 시작**합니다. 이 데이터를 **즉시 인사이트로 바꿔주는** 대시보드가 운영 OS의 정점입니다.

진우님이 매일 아침 5분만 보면 "어디가 문제인지" 보이는 화면. 이게 27명 팀을 통제할 수 있게 해주는 핵심 도구입니다.

### 의존성

지시서 #1 ~ #7 모두 완료. (모든 데이터 소스 통합)

### 핵심 KPI

```
┌──────────────────────────┬───────────────────────────────────┐
│         지표             │            정의                   │
├──────────────────────────┼───────────────────────────────────┤
│ 총 운영 공간             │ Property where status=active      │
│ 월 매출                  │ Sum(Settlement.Revenue) for month │
│ 월 순수익 (HIERO 수익)   │ Sum(Settlement.ManagementFee)     │
│ 평균 점유율              │ (구현은 booking 모델 필요, 후순위)│
│ Open 이슈 수             │ Count(Issue) WHERE status=open    │
│ 평균 이슈 응답시간       │ Avg(acknowledged_at - opened_at)  │
│ 오늘 due task 수         │ Count(Task) WHERE due_date=today  │
│ 지연 task 수             │ Count(Task) WHERE due_date<today  │
│                          │ AND status NOT IN (done,cancel)   │
│ 팀별 task 처리율         │ done / total per team             │
│ 청소 정시 완료율         │ cleaning task done by due_date    │
└──────────────────────────┴───────────────────────────────────┘
```

### API 스펙

```
GET /admin/dashboard/overview
  Response: {
    "total_properties": 100,
    "active_properties": 95,
    "this_month_revenue": 350000000,
    "this_month_management_fee": 70000000,
    "open_issues": 7,
    "avg_response_time_minutes": 23,
    "tasks_due_today": 12,
    "tasks_overdue": 3,
    "team_performance": [
      { "team": "cleaning", "total": 200, "done": 180, "rate": 0.9 },
      ...
    ]
  }

GET /admin/dashboard/revenue-trend?months=6
  Response: { "data": [
    { "year": 2025, "month": 12, "revenue": 280000000, "management_fee": 56000000 },
    ...
  ]}

GET /admin/dashboard/property-performance?limit=10
  Response: { "data": [
    { "property_id": 5, "name": "강남 502", "revenue": 5000000, "issues": 0, ...}
  ]}
```

### Admin UI

**DashboardPage (`/admin/dashboard`) - 메인 화면**

레이아웃:
```
┌────────────────────────────────────────────────────────────┐
│ [공간 100]  [매출 3.5억]  [수수료 7천]  [이슈 7건]            │  ← KPI 카드
├────────────────────────────────────────────────────────────┤
│  매출 추이 (라인 차트, 6개월)                                │
├──────────────────────────┬─────────────────────────────────┤
│  Today's Focus           │  팀별 처리율 (도넛)              │
│  - Due 오늘: 12          │                                 │
│  - 지연: 3 (위험)         │                                 │
│  - Critical 이슈: 1      │                                 │
├──────────────────────────┴─────────────────────────────────┤
│  공간별 수익 TOP 10 (바 차트)                                │
└────────────────────────────────────────────────────────────┘
```

라이브러리: **Recharts** (이미 가능)

기간 필터: 이번 달 / 지난 달 / 최근 3개월 / 사용자 정의

권한:
- super_admin / operations_manager → 전체 보기
- 일반 admin → 본인이 담당하는 공간만

### 완료 기준 (DoD)

- [ ] 3개 dashboard API 동작
- [ ] DashboardPage가 모든 데이터 통합 표시
- [ ] Recharts 차트 정상 렌더 (라인 + 바 + 도넛)
- [ ] 권한별 데이터 필터링
- [ ] 모바일 반응형 (운영 매니저가 폰으로 보는 케이스 많음)
- [ ] 로딩 상태 / 빈 상태 처리

### 🤖 Claude Code 프롬프트

```
HIERO 운영 OS 대시보드를 만들어줘.

## 1. handler/dashboard.go
- GET /admin/dashboard/overview
  - 응답 필드: total_properties, active_properties, this_month_revenue, this_month_management_fee,
    open_issues, avg_response_time_minutes, tasks_due_today, tasks_overdue, team_performance[]
  - 권한: 사용자 role에 따라 데이터 필터:
    - super_admin, operations_manager: 전체
    - 그 외: 자기에게 assigned된 PropertyAssignment의 property들만 집계

- GET /admin/dashboard/revenue-trend?months=6
  - 최근 N개월 (기본 6) Settlement 합계 (revenue, management_fee) per month

- GET /admin/dashboard/property-performance?limit=10&period=this_month
  - 공간별 매출 TOP N
  - 응답: [{ property_id, code, name, revenue, issue_count, avg_response_time }]

## 2. Admin UI - pages/DashboardPage.tsx (기존 DashboardPage 교체)
설치: 이미 recharts 있을 것. 없으면 npm install recharts

레이아웃 (Tailwind):
- 상단: KPI 카드 4개 그리드 (공간 / 월 매출 / HIERO 수수료 / Open 이슈)
  - 각 카드: 큰 숫자 + 전월 대비 증감 (옵션)
- 매출 추이: <LineChart> 6개월 (revenue, management_fee 두 라인)
- Today's Focus 카드: due 오늘 / 지연 / critical 이슈 클릭 → 해당 페이지로
- 팀별 처리율: <PieChart> 또는 <BarChart>
- 공간 TOP 10: <BarChart> horizontal

기간 필터 드롭다운 (이번 달 기본).

## 3. 모바일 반응형
- Tailwind responsive 사용 (md:grid-cols-4 → grid-cols-2 → grid-cols-1)
- 차트는 ResponsiveContainer로 감싸기

## 4. 로딩/에러
- API loading 시 skeleton (간단히 회색 박스)
- 에러 시 inline 메시지 + 재시도 버튼
- 데이터 없을 때 빈 상태 메시지

## 검증
1. /admin/dashboard 진입 → 모든 카드/차트 데이터 표시
2. cleaner 계정으로 접속 → 자기 담당 공간만 집계
3. 모바일 사이즈 → 깨지지 않음
4. Settlement, Issue, Task 데이터 변경 후 새로고침 → 즉시 반영

#1~#7 모든 모델/데이터 통합. 성능 위해 무거운 쿼리는 GORM의 .Select(...).Group(...) 활용.
```

---

# 📚 부록

## A. 진행 체크리스트

```
□ Phase 1
  □ 지시서 #1 - 공간(Property) 도메인
    └ DoD 모두 통과
  □ 지시서 #2 - Operator 권한 확장
    └ DoD 모두 통과

□ Phase 2
  □ 지시서 #3 - Task 시스템 고도화
  □ 지시서 #4 - 자동 스케줄링

□ Phase 3
  □ 지시서 #5 - Slack 알림
  □ 지시서 #6 - 이슈 트래킹

□ Phase 4
  □ 지시서 #7 - 임대인/정산
  □ 지시서 #8 - KPI 대시보드
```

## B. 보안 체크리스트 (지시서마다 확인)

- [ ] `.env`가 `.gitignore`에 포함되어 있는가?
- [ ] RDS 접근 IP가 제한되어 있는가? (운영 시점에 보안 그룹 확인)
- [ ] JWT secret이 환경변수로 관리되는가?
- [ ] Public API에 rate limiting이 적용되어 있는가?
- [ ] CORS가 운영 환경에서 정확한 도메인만 허용하는가?
- [ ] 비밀번호는 bcrypt로 저장되는가? ✅ (이미 적용)

## C. 다음 단계 (Phase 5 이후 가능성)

이 8개 완료 후 고려할 것들:

1. **모바일 앱**: 청소부/정비팀이 현장에서 task 처리 (React Native)
2. **채널 매니저 연동**: 에어비앤비 / 야놀자 / 호텔스컴바인
3. **AI 자동화**: 이슈 자동 분류, 우선순위 자동 산정
4. **재고/소모품 관리**: 청소용품, 어메니티 자동 발주
5. **계약 관리**: 임대인 계약서 전자 서명, 만료 알림
6. **공개 마케팅 페이지**: 신규 임대인 영업용

---

**최종 업데이트**: 2026-05-03
**다음 액션**: 지시서 #1을 Claude Code에 붙여넣고 시작 🚀
