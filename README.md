# HIERO Workflow System

숙소 위탁운영 팀 워크플로우 관리 시스템

## 기술 스택

| 구분 | 기술 | 포트 |
|------|------|------|
| Frontend (사용자) | React + Vite + TypeScript | 5180 |
| Admin (관리자) | React + Vite + TypeScript | 5181 |
| Backend (API) | Golang + Gin + GORM + Air | 8080 |
| Database | MySQL | 3306 |

## 프로젝트 구조

```
hiero-workflow/
├── frontend/        # 사용자용 웹 앱 (:5180)
├── admin/           # 관리자용 웹 앱 (:5181)
├── backend/         # Go API 서버 (:8080)
├── start.sh         # 전체 서버 시작
├── stop.sh          # 전체 서버 종료
└── README.md
```

## 사전 준비

- [Go](https://go.dev/dl/) 1.20 이상
- [Air](https://github.com/air-verse/air) (Go 핫 리로드)
- [Node.js](https://nodejs.org/) 18 이상
- [MySQL](https://dev.mysql.com/downloads/) 8.0 이상

```bash
# Air 설치
go install github.com/air-verse/air@latest
```

## 실행 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd hiero-workflow
```

### 2. MySQL 데이터베이스 설정

```bash
# MySQL 서버 시작
brew services start mysql

# DB 생성
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS hiero_workflow;"
```

> 테이블은 GORM AutoMigrate로 서버 시작 시 자동 생성됩니다.

### 3. 환경변수 설정

```bash
# Backend
cd backend && cp .env.example .env
# .env 파일에서 DB_PASSWORD 수정

# Frontend
cd frontend && cp .env.example .env

# Admin
cd admin && cp .env.example .env
```

### 4. 의존성 설치

> ⚠️ **npm 대신 pnpm 사용** — npm은 일부 환경(node v18+)에서 `@vitejs/plugin-react` 설치 오류 발생

```bash
# pnpm 없으면 먼저 설치
brew install pnpm

# Backend
cd backend && go mod tidy

# Frontend
cd frontend && pnpm install

# Admin
cd admin && pnpm install
```

### 5. 전체 서버 시작/종료

```bash
# 시작 (frontend + admin + backend 동시 실행)
./start.sh

# 종료
./stop.sh
```

실행 후 접속:

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5180 |
| Admin | http://localhost:5181 |
| Backend API | http://localhost:8080 |

### 개별 실행 (수동)

```bash
# Backend
cd backend && go run .

# Frontend
cd frontend && pnpm dev

# Admin
cd admin && pnpm dev
```

## API 엔드포인트

### Frontend용 (`/api`)

| Method | URL | 설명 |
|--------|-----|------|
| GET | /api/tasks | 태스크 조회 |
| POST | /api/tasks | 태스크 생성 |
| PATCH | /api/tasks/:id/status | 상태 변경 |

### Admin용 (`/admin`)

| Method | URL | 설명 |
|--------|-----|------|
| GET | /admin/tasks | 전체 태스크 조회 (최신순) |
| POST | /admin/tasks | 태스크 생성 |
| PATCH | /admin/tasks/:id/status | 상태 변경 |
| DELETE | /admin/tasks/:id | 태스크 삭제 |

## 환경변수

### backend/.env

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hiero_workflow
DB_USER=root
DB_PASSWORD=your_password
PORT=8080
```

### frontend/.env

```
VITE_API_URL=http://localhost:8080/api
```

### admin/.env

```
VITE_API_URL=http://localhost:8080/admin
```

> Frontend/Admin에서 API 호출 시 `import.meta.env.VITE_API_URL`로 접근합니다.

## 로그 확인

```bash
# 전체 로그
tail -f .logs/backend.log
tail -f .logs/frontend.log
tail -f .logs/admin.log
```
