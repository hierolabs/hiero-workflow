#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$PROJECT_DIR/.pids"

echo "==============================="
echo " HIERO Workflow - 서버 종료"
echo "==============================="

stop_service() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"

  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      echo "  [$name] 종료됨 (PID: $pid)"
    else
      echo "  [$name] 이미 종료된 상태"
    fi
    rm -f "$pid_file"
  else
    echo "  [$name] PID 파일 없음"
  fi
}

stop_service "backend"
stop_service "frontend"
stop_service "admin"

echo ""
echo " 모든 서버가 종료되었습니다"
echo "==============================="
