#!/usr/bin/env python3
"""
삼삼엠투 크롤링 JSON → market_prices + market_contracts + crawl_jobs DB 적재

원본: docs/samsam/33m2_room_details_all_*.json + 33m2_export_all_*.json
실행: python3 scripts/import_market_data.py
"""

import os
import re
import json
import mysql.connector
from datetime import datetime

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "MRM7pmqtQoWnXMt4lW5j"),
    "database": os.getenv("DB_NAME", "heiro-dev"),
}

SAMSAM_DIR = os.path.expanduser("~/hiero-workflow/docs/samsam")
ROOM_FILE = os.path.join(SAMSAM_DIR, "33m2_room_details_all_2026-05-08.json")
EXPORT_FILE = os.path.join(SAMSAM_DIR, "33m2_export_all_2026-05-08.json")

REGION_RE = re.compile(r'(서울특별시\s+)?(\S+구)')
PERIOD_RE = re.compile(r'(\d{4}\.\d{2}\.\d{2})')


def extract_region(address):
    m = REGION_RE.search(address or "")
    return m.group(2) if m else ""


def parse_period(raw):
    matches = PERIOD_RE.findall(raw or "")
    if len(matches) < 2:
        return None, None
    try:
        start = datetime.strptime(matches[0], "%Y.%m.%d")
        end = datetime.strptime(matches[1], "%Y.%m.%d")
        return start, end
    except:
        return None, None


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    now = datetime.now()

    # ── Step 1: Room Details → market_prices ──────────────
    print("=" * 60)
    print("[Step 1] 삼삼엠투 숙소 상세 → market_prices")
    print("=" * 60)

    with open(ROOM_FILE, encoding="utf-8") as f:
        room_data = json.load(f)

    rooms = room_data.get("rooms", [])
    collected_at = room_data.get("collected_at", "")
    snapshot_date = now
    if collected_at:
        try:
            snapshot_date = datetime.fromisoformat(collected_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except:
            pass

    # crawl_job 생성
    cursor.execute("""
        INSERT INTO crawl_jobs (platform, job_type, status, source, file_name,
                                total_records, started_at, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
    """, ("33m2", "rooms", "processing", "file_upload",
          os.path.basename(ROOM_FILE), len(rooms), now))
    conn.commit()
    room_job_id = cursor.lastrowid

    # property_platforms에서 33m2 매칭 맵
    cursor.execute("""
        SELECT listing_id, property_id FROM property_platforms
        WHERE platform = '33m2' AND listing_id != ''
    """)
    platform_map = {r["listing_id"]: r["property_id"] for r in cursor.fetchall()}

    room_count = 0
    for room in rooms:
        maint_json = json.dumps(room.get("maintenance_included", {}), ensure_ascii=False)
        raw_json = json.dumps(room, ensure_ascii=False)
        region = extract_region(room.get("address", ""))
        room_id = str(room.get("room_id", ""))
        prop_id = platform_map.get(room_id)

        cursor.execute("""
            INSERT INTO market_prices
            (crawl_job_id, property_id, platform, external_room_id, room_name, address,
             region, visibility, rent_weekly, deposit, maintenance_weekly, cleaning_fee,
             refund_policy, long_term_discount_raw, immediate_discount_raw,
             maintenance_included, snapshot_date, raw_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            room_job_id, prop_id, "33m2", room_id,
            room.get("name", ""), room.get("address", ""),
            region, room.get("visibility", ""),
            room.get("rent_weekly_number", 0), room.get("deposit_number", 0),
            room.get("maintenance_weekly_number", 0), room.get("cleaning_fee_number", 0),
            room.get("refund_policy", ""),
            room.get("long_term_discount_raw", ""),
            room.get("immediate_move_in_discount_raw", ""),
            maint_json, snapshot_date, raw_json,
        ))
        room_count += 1

    # job 완료
    cursor.execute("""
        UPDATE crawl_jobs SET status='completed', processed_records=%s, completed_at=NOW()
        WHERE id=%s
    """, (room_count, room_job_id))
    conn.commit()
    print(f"  ✅ {room_count}개 숙소 → market_prices INSERT")

    # ── Step 2: Contracts → market_contracts ──────────────
    print(f"\n{'=' * 60}")
    print("[Step 2] 삼삼엠투 계약 → market_contracts")
    print("=" * 60)

    with open(EXPORT_FILE, encoding="utf-8") as f:
        export_data = json.load(f)

    contracts = export_data.get("contracts", [])

    # crawl_job
    cursor.execute("""
        INSERT INTO crawl_jobs (platform, job_type, status, source, file_name,
                                total_records, started_at, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
    """, ("33m2", "contracts", "processing", "file_upload",
          os.path.basename(EXPORT_FILE), len(contracts), now))
    conn.commit()
    contract_job_id = cursor.lastrowid

    contract_count = 0
    for c in contracts:
        period_start, period_end = parse_period(c.get("period", ""))
        amount = c.get("amount_number", 0) or 0

        # external_room_id 추출 (room_name에서)
        ext_room_id = ""
        # contract_id에서 가져오기
        contract_id = c.get("contract_id", "")
        chat_id = c.get("chat_id", "")

        cursor.execute("""
            INSERT INTO market_contracts
            (crawl_job_id, platform, external_contract_id, external_room_id, chat_id,
             room_name, tenant_name, status, payment_status,
             period_start, period_end, period_raw, amount,
             snapshot_date, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            contract_job_id, "33m2", contract_id, ext_room_id, chat_id,
            c.get("room_name", ""), c.get("tenant", ""),
            c.get("status", ""), c.get("payment_status", ""),
            period_start, period_end, c.get("period", ""),
            amount, snapshot_date,
        ))
        contract_count += 1

    cursor.execute("""
        UPDATE crawl_jobs SET status='completed', processed_records=%s, completed_at=NOW()
        WHERE id=%s
    """, (contract_count, contract_job_id))
    conn.commit()
    print(f"  ✅ {contract_count}개 계약 → market_contracts INSERT")

    # ── 검증 ──────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("[검증]")
    print("=" * 60)

    cursor.execute("SELECT COUNT(*) as cnt FROM market_prices")
    print(f"  market_prices:    {cursor.fetchone()['cnt']}건")

    cursor.execute("SELECT COUNT(*) as cnt FROM market_contracts")
    print(f"  market_contracts: {cursor.fetchone()['cnt']}건")

    cursor.execute("SELECT COUNT(*) as cnt FROM crawl_jobs")
    print(f"  crawl_jobs:       {cursor.fetchone()['cnt']}건")

    cursor.execute("""
        SELECT region, COUNT(*) as cnt, AVG(rent_weekly) as avg_rent
        FROM market_prices WHERE rent_weekly > 0
        GROUP BY region ORDER BY cnt DESC LIMIT 5
    """)
    print(f"\n  지역별 시장 데이터:")
    for r in cursor.fetchall():
        print(f"    {r['region']:<8} {r['cnt']:>3}개  평균주세: {int(r['avg_rent']):>8,}원")

    cursor.close()
    conn.close()
    print(f"\n✅ 완료")


if __name__ == "__main__":
    main()
