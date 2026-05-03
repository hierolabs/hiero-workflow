# 🚀 HIERO 팀 워크플로우 시스템 - 4주 개발 가이드
## React + Express + MySQL로 만드는 자동 일 관리 시스템

**최종 버전:** MySQL 기준  
**작성일:** 2026-05-03

---

## 🎯 최종 목표

```
영업팀: "계약 체결" ✅
  ↓ (자동 1초)
청소팀: "초기세팅" 태스크 자동 생성
데이터팀: "정보입력" 태스크 자동 생성
CEO: 대시보드 실시간 업데이트
```

---

## 📊 4주 로드맵

| 주 | 목표 | 기술 | 상태 |
|----|------|------|------|
| 1주 | 백엔드 구축 | Express + MySQL | **진행 중** |
| 2주 | 프론트엔드 UI | React + Tailwind | 준비 |
| 3주 | 자동화 + 연동 | Slack + 이메일 | 준비 |
| 4주 | 배포 + 최적화 | Replit + Vercel | 준비 |

---

# 📅 1주차: 백엔드 구축 (Express + MySQL)

## 현재 진행 상황

```
✅ npm 라이브러리 설정
✅ MySQL 데이터베이스 생성
✅ 테이블 스키마 작성
✅ src/index.js 작성 (MySQL 버전)
```

---

## 환경 설정 최종 정리

### 1️⃣ 폴더 구조

```
hiero-workflow/
├── backend/
│   ├── src/
│   │   └── index.js              (✅ 완성)
│   ├── .env                       (✅ 완성)
│   ├── package.json               (✅ 완성)
│   └── .gitignore
│
└── frontend/
    └── (2주차에 생성)
```

### 2️⃣ Package.json 최종 버전

```json
{
  "name": "hiero-workflow-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mysql2": "^3.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

### 3️⃣ .env 최종 버전

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hiero_workflow
DB_USER=root
DB_PASSWORD=your_password

PORT=3001
NODE_ENV=development
```

### 4️⃣ MySQL 테이블 최종 버전

```sql
CREATE DATABASE hiero_workflow;
USE hiero_workflow;

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    team VARCHAR(50),
    customer_name VARCHAR(100),
    property_location VARCHAR(255),
    contract_stage VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_team (team)
);

CREATE TABLE team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    team VARCHAR(50),
    slack_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT,
    author_id INT,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE task_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 테스트 데이터
INSERT INTO tasks (title, team, description) VALUES 
('강남역 건물주 연락', 'sales', '초기 접촉'),
('홍대 숙소 현장 확인', 'sales', '방문 예약');

INSERT INTO team_members (name, email, team) VALUES 
('김영업', 'sales@example.com', 'sales'),
('박청소', 'cleaning@example.com', 'cleaning');
```

### 5️⃣ src/index.js 최종 버전

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 연결 풀
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'hiero_workflow',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// DB 연결 테스트
(async () => {
    try {
        const connection = await pool.getConnection();
        const result = await connection.query('SELECT NOW() as time');
        console.log('✅ MySQL 연결 성공:', result[0][0].time);
        connection.release();
    } catch (err) {
        console.error('❌ MySQL 연결 실패:', err.message);
    }
})();

// ============ API 엔드포인트 ============

// 1️⃣ 모든 태스크 조회
app.get('/api/tasks', async (req, res) => {
    try {
        const { team, status } = req.query;
        const connection = await pool.getConnection();
        
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];
        
        if (team) {
            query += ' AND team = ?';
            params.push(team);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY id DESC';
        const [rows] = await connection.query(query, params);
        connection.release();
        
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2️⃣ 단일 태스크 조회
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // 태스크 조회
        const [taskRows] = await connection.query(
            'SELECT * FROM tasks WHERE id = ?',
            [req.params.id]
        );
        
        if (taskRows.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const task = taskRows[0];
        
        // 댓글 조회
        const [comments] = await connection.query(
            'SELECT tc.*, tm.name FROM task_comments tc LEFT JOIN team_members tm ON tc.author_id = tm.id WHERE task_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );
        
        connection.release();
        res.json({ ...task, comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3️⃣ 새 태스크 생성
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, team, description, customer_name, property_location } = req.body;
        const connection = await pool.getConnection();
        
        const [result] = await connection.query(
            'INSERT INTO tasks (title, team, description, customer_name, property_location, status) VALUES (?, ?, ?, ?, ?, ?)',
            [title, team, description, customer_name, property_location, 'PENDING']
        );
        
        connection.release();
        res.status(201).json({
            id: result.insertId,
            title,
            team,
            description,
            customer_name,
            property_location,
            status: 'PENDING'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4️⃣ 태스크 상태 변경 (핵심!)
app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const taskId = req.params.id;
        const connection = await pool.getConnection();
        
        // 기존 상태 조회
        const [oldTaskRows] = await connection.query(
            'SELECT * FROM tasks WHERE id = ?',
            [taskId]
        );
        const oldStatus = oldTaskRows[0].status;
        
        // 상태 업데이트
        await connection.query(
            'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, taskId]
        );
        
        // 히스토리 기록
        await connection.query(
            'INSERT INTO task_history (task_id, old_status, new_status) VALUES (?, ?, ?)',
            [taskId, oldStatus, status]
        );
        
        // 변경된 데이터 반환
        const [rows] = await connection.query(
            'SELECT * FROM tasks WHERE id = ?',
            [taskId]
        );
        
        connection.release();
        
        // 🔥 자동화 트리거 (나중에 구현)
        console.log(`✨ Task ${taskId} status changed: ${oldStatus} → ${status}`);
        
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5️⃣ 태스크 삭제
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // 댓글 먼저 삭제
        await connection.query('DELETE FROM task_comments WHERE task_id = ?', [req.params.id]);
        
        // 태스크 삭제
        const [result] = await connection.query(
            'DELETE FROM tasks WHERE id = ?',
            [req.params.id]
        );
        
        connection.release();
        res.json({ deleted: result.affectedRows > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6️⃣ 댓글 추가
app.post('/api/tasks/:id/comments', async (req, res) => {
    try {
        const { author_id, content } = req.body;
        const connection = await pool.getConnection();
        
        const [result] = await connection.query(
            'INSERT INTO task_comments (task_id, author_id, content) VALUES (?, ?, ?)',
            [req.params.id, author_id, content]
        );
        
        connection.release();
        res.status(201).json({
            id: result.insertId,
            task_id: req.params.id,
            author_id,
            content,
            created_at: new Date()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ 기타 API ============

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// 대시보드 통계
app.get('/api/dashboard', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [total] = await connection.query('SELECT COUNT(*) as count FROM tasks');
        const [completed] = await connection.query('SELECT COUNT(*) as count FROM tasks WHERE status = "COMPLETED"');
        const [byTeam] = await connection.query('SELECT team, COUNT(*) as count FROM tasks GROUP BY team');
        
        connection.release();
        
        res.json({
            total: total[0].count,
            completed: completed[0].count,
            completionRate: ((completed[0].count / total[0].count) * 100).toFixed(1),
            byTeam
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

// 서버 시작
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```

---

## ✅ 1주차 실행 체크리스트

```
환경 설정:
□ Node.js 설치 (14.0 이상)
□ MySQL 설치 및 실행
□ backend 폴더 생성

npm 설정:
□ npm init
□ npm install express mysql2 cors dotenv
□ npm install --save-dev nodemon

MySQL 설정:
□ MySQL 접속 (mysql -u root -p)
□ 데이터베이스 생성
□ 테이블 생성 (위 SQL 실행)
□ 테스트 데이터 삽입

코드 작성:
□ .env 파일 생성 (DB 정보)
□ src/index.js 작성

테스트:
□ npm run dev 실행
□ MySQL 연결 메시지 확인
□ curl http://localhost:3001/health
□ Postman으로 API 테스트
```

---

## 🧪 Postman 테스트 (최종)

### 테스트 1: 헬스 체크
```
GET http://localhost:3001/health

응답:
{
  "status": "ok",
  "time": "2026-05-03T14:30:50.123Z"
}
```

### 테스트 2: 모든 태스크 조회
```
GET http://localhost:3001/api/tasks

응답:
[
  {
    "id": 1,
    "title": "강남역 건물주 연락",
    "team": "sales",
    "status": "PENDING",
    "created_at": "2026-05-03T14:20:00.000Z"
  }
]
```

### 테스트 3: 새 태스크 생성
```
POST http://localhost:3001/api/tasks
Content-Type: application/json

Body:
{
  "title": "신촌 초기 세팅",
  "team": "cleaning",
  "description": "청소 및 세팅",
  "customer_name": "건물주 B",
  "property_location": "신촌역 5분"
}

응답:
{
  "id": 3,
  "title": "신촌 초기 세팅",
  "status": "PENDING"
}
```

### 테스트 4: 상태 변경 (드래그 시뮬레이션)
```
PATCH http://localhost:3001/api/tasks/1/status
Content-Type: application/json

Body:
{
  "status": "IN_PROGRESS"
}

응답:
{
  "id": 1,
  "status": "IN_PROGRESS",
  "updated_at": "2026-05-03T14:35:00.000Z"
}
```

### 테스트 5: 댓글 추가
```
POST http://localhost:3001/api/tasks/1/comments
Content-Type: application/json

Body:
{
  "author_id": 1,
  "content": "현장 방문 완료했습니다!"
}

응답:
{
  "id": 1,
  "task_id": 1,
  "author_id": 1,
  "content": "현장 방문 완료했습니다!",
  "created_at": "2026-05-03T14:36:00.000Z"
}
```

### 테스트 6: 대시보드 통계
```
GET http://localhost:3001/api/dashboard

응답:
{
  "total": 3,
  "completed": 0,
  "completionRate": "0.0",
  "byTeam": [
    {"team": "sales", "count": 2},
    {"team": "cleaning", "count": 1}
  ]
}
```

---

# 📅 2주차: 프론트엔드 (React)

## 준비 작업

```
□ Node.js/npm 설치 확인
□ React 프로젝트 생성
□ Tailwind CSS 설치
□ Zustand 설치 (상태관리)
```

## 프로젝트 생성

```bash
# React 앱 생성
cd frontend
npx create-react-app .

# 필요한 라이브러리
npm install axios zustand react-beautiful-dnd recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## 핵심 컴포넌트 구조

```
src/
├── components/
│   ├── TaskBoard.jsx      (드래그 보드)
│   ├── TaskCard.jsx       (카드)
│   ├── Dashboard.jsx      (CEO 대시보드)
│   └── Notifications.jsx  (실시간 알림)
├── store/
│   └── taskStore.js       (Zustand 상태)
├── pages/
│   ├── SalesTeam.jsx
│   ├── CleaningTeam.jsx
│   └── DataTeam.jsx
└── App.jsx
```

---

# 📅 3주차: 자동화 + Slack 연동

## Slack 연동 (백엔드)

```javascript
// src/slack.js 추가
const axios = require('axios');

async function sendSlackMessage(channel, message) {
    try {
        await axios.post(
            'https://slack.com/api/chat.postMessage',
            {
                channel,
                text: message
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`
                }
            }
        );
        console.log(`✅ Slack 메시지 발송: ${channel}`);
    } catch (err) {
        console.error('❌ Slack 에러:', err.message);
    }
}

module.exports = { sendSlackMessage };
```

## 자동화 규칙 (워크플로우)

```sql
CREATE TABLE workflows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    trigger_team VARCHAR(50),
    trigger_status VARCHAR(50),
    action_type VARCHAR(50),
    action_team VARCHAR(50),
    action_config JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 예: 영업팀 계약 → 청소팀 자동 할당
INSERT INTO workflows (name, trigger_team, trigger_status, action_type, action_team, action_config)
VALUES (
    'Create cleaning setup when contract signed',
    'sales',
    'CONTRACT_SIGNED',
    'CREATE_TASK',
    'cleaning',
    '{"title": "초기 세팅", "description": "새 숙소 초기 청소"}'
);
```

---

# 📅 4주차: 배포 (Replit + Vercel)

## 백엔드 배포 (Replit)

```bash
# Replit에 업로드
git push origin main

# Replit에서 설정
# Secrets: DB_HOST, DB_USER, DB_PASSWORD 등
# Run: npm install && npm run dev
```

## 프론트엔드 배포 (Vercel)

```bash
npm install -g vercel
vercel

# .env.production
REACT_APP_API_URL=https://your-replit-url.repl.co/api
```

---

## 📋 최종 체크리스트

```
1주차 (완료):
□ npm 설정
□ MySQL 테이블 생성
□ API 6개 엔드포인트 작동
□ Postman 테스트 성공

2주차 (준비):
□ React 프로젝트 생성
□ 드래그 UI 구현
□ 상태 관리 설정
□ API 연결

3주차 (준비):
□ Slack 연동
□ 이메일 연동
□ 자동화 규칙 실행
□ 팀 테스트

4주차 (준비):
□ Replit 배포
□ Vercel 배포
□ 성능 최적화
□ 라이브 오픈
```

---

**다음: 2주차 React 프론트엔드 개발 가이드** 🚀
