#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_DIR/.pids"
LOG_DIR="$PROJECT_DIR/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "==============================="
echo " HIERO Workflow - 서버 시작"
echo "==============================="

# Backend (air)
echo "[1/3] Backend 시작 (port 8080)..."
cd "$PROJECT_DIR/backend"
air > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"

# Frontend
echo "[2/3] Frontend 시작 (port 5180)..."
cd "$PROJECT_DIR/frontend"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"

# Admin
echo "[3/3] Admin 시작 (port 5181)..."
cd "$PROJECT_DIR/admin"
npm run dev > "$LOG_DIR/admin.log" 2>&1 &
echo $! > "$PID_DIR/admin.pid"

echo ""
echo "==============================="
echo " 모든 서버가 시작되었습니다"
echo "==============================="
echo ""
echo "  Backend  → http://localhost:8080"
echo "  Frontend → http://localhost:5180"
echo "  Admin    → http://localhost:5181"
echo ""
echo "  로그 확인: tail -f .logs/backend.log"
echo "  종료:      ./stop.sh"
echo "==============================="
