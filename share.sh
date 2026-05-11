#!/bin/bash
# HIERO Workflow - 팀 공유용 한 번에 실행
# 백엔드 + admin + 터널을 모두 켜고, URL을 출력합니다.

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "════════════════════════════════════════════════"
echo "  🚀 HIERO 팀 공유 시작"
echo "════════════════════════════════════════════════"
echo ""

# 기존 서버 모두 시작 (백엔드 + frontend + admin)
echo "📦 backend / frontend / admin 시작 중..."
./start.sh > /dev/null 2>&1

# 서버들이 준비될 때까지 대기
echo "⏳ 서버 부팅 대기 중 (15초)..."
sleep 15

# 포트 확인
if ! lsof -i:5181 > /dev/null 2>&1; then
  echo "❌ admin (port 5181)이 안 떠있어요. .logs/admin.log 확인하세요."
  echo "   tail -f .logs/admin.log"
  exit 1
fi

if ! lsof -i:8080 > /dev/null 2>&1; then
  echo "⚠️  backend (port 8080)이 안 떠있어요. .logs/backend.log 확인하세요."
  echo "   tail -f .logs/backend.log"
fi

clear
echo "════════════════════════════════════════════════"
echo "  ✅ 준비 완료! Cloudflare 터널 시작 중..."
echo "════════════════════════════════════════════════"
echo ""
echo "  📍 로컬 주소:"
echo "     http://localhost:8080  (백엔드)"
echo "     http://localhost:5180  (frontend - 랜딩)"
echo "     http://localhost:5181  (admin - 관리자)"
echo ""
echo "  🌐 팀 공유 URL은 아래에 나옵니다 ↓"
echo ""
echo "  🛑 종료: 이 터미널에서 Ctrl+C → 터널만 멈춤"
echo "          (서버는 계속 돌아요. 다 끄려면: ./stop.sh)"
echo ""
echo "════════════════════════════════════════════════"
echo ""

# Cloudflare 터널 (포어그라운드 — Ctrl+C로 종료)
cloudflared tunnel --url http://localhost:5181
