#!/usr/bin/env python3
"""
cost_raw + cost_allocations 생성
1. hostex_transactions (type='비용') → cost_raw 마이그레이션
2. cost_raw → cost_allocations 일할 분배

실행: python3 scripts/generate_cost_allocations.py
"""

import os
import sys
from datetime import datetime, timedelta
from calendar import monthrange
import mysql.connector

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "MRM7pmqtQoWnXMt4lW5j"),
    "database": os.getenv("DB_NAME", "heiro-dev"),
}

# 카테고리 → 비용 타입 매핑 (Go 로직과 동일)
CATEGORY_MAP = {
    "청소 비용": "청소비",
    "Rent_out": "월세",
    "Rent_in": "월세",
    "관리비": "관리비",
    "유지보수": "수리비",
    "소모품": "소모품비",
    "운영비": "운영비",
    "인건비": "노동비",
    "인테리어": "인테리어",
    "배당금": "배당",
    "배당": "배당",
    "이자": "임대이자",
}


def map_cost_type(category):
    return CATEGORY_MAP.get(category, "기타")


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # ── Step 1: hostex_transactions 비용 → cost_raw ──────────────
    print("=" * 60)
    print("[Step 1] hostex_transactions (비용) → cost_raw")
    print("=" * 60)

    # 기존 데이터 확인
    cursor.execute("SELECT COUNT(*) as cnt FROM cost_raw")
    existing = cursor.fetchone()["cnt"]
    if existing > 0:
        print(f"  ⚠️ cost_raw에 이미 {existing}행 있음. 초기화하고 재생성합니다.")
        cursor.execute("DELETE FROM cost_allocations")
        cursor.execute("DELETE FROM cost_raw")
        conn.commit()

    # 비용 거래 조회
    cursor.execute("""
        SELECT id, transaction_at, type, category, amount, reservation_ref,
               check_in, check_out, channel, property_name, property_id, note
        FROM hostex_transactions
        WHERE type = '비용'
        ORDER BY transaction_at
    """)
    tx_rows = cursor.fetchall()
    print(f"  → {len(tx_rows)}건 비용 거래 발견")

    cost_raw_count = 0
    for i, row in enumerate(tx_rows):
        cost_type = map_cost_type(row["category"] or "")

        start_date = row["check_in"] or ""
        end_date = row["check_out"] or ""
        tx_date = row["transaction_at"].strftime("%Y-%m-%d") if row["transaction_at"] else ""

        if not start_date:
            start_date = tx_date
        if not end_date:
            end_date = start_date

        cursor.execute("""
            INSERT INTO cost_raw
            (property_id, property_name, cost_type, original_amount,
             cost_start_date, cost_end_date, payment_date,
             reservation_ref, source_file_name, source_row_number,
             channel, memo, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (
            row["property_id"],
            row["property_name"],
            cost_type,
            row["amount"],
            start_date,
            end_date,
            tx_date,
            row["reservation_ref"],
            "hostex_transactions_migration",
            i + 1,
            row["channel"],
            row["note"],
        ))
        cost_raw_count += 1

    conn.commit()
    print(f"  ✅ {cost_raw_count}건 cost_raw INSERT 완료")

    # ── Step 2: cost_raw → cost_allocations (일할 분배) ──────────
    print(f"\n{'=' * 60}")
    print("[Step 2] cost_raw → cost_allocations (일할 분배)")
    print("=" * 60)

    cursor.execute("SELECT * FROM cost_raw ORDER BY id")
    raw_rows = cursor.fetchall()

    alloc_count = 0
    for raw in raw_rows:
        try:
            start = datetime.strptime(raw["cost_start_date"], "%Y-%m-%d") if raw["cost_start_date"] else None
            end = datetime.strptime(raw["cost_end_date"], "%Y-%m-%d") if raw["cost_end_date"] else None
        except ValueError:
            start = None
            end = None

        if not start or not end or start > end:
            # 기간 없으면 결제일 월에 전액
            month = ""
            if raw["payment_date"] and len(raw["payment_date"]) >= 7:
                month = raw["payment_date"][:7]
            elif raw["cost_start_date"] and len(raw["cost_start_date"]) >= 7:
                month = raw["cost_start_date"][:7]
            else:
                month = datetime.now().strftime("%Y-%m")

            cursor.execute("""
                INSERT INTO cost_allocations
                (raw_cost_id, property_id, allocated_month,
                 allocated_start_date, allocated_end_date,
                 allocated_amount, allocation_method, cost_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                raw["id"], raw["property_id"], month,
                month + "-01", month + "-28",
                raw["original_amount"], "full_month", raw["cost_type"],
            ))
            alloc_count += 1
            continue

        # 일할 분배
        total_days = (end - start).days + 1
        if total_days <= 0:
            total_days = 1

        current = start
        while current <= end:
            month_start = max(current, start)
            last_day = monthrange(current.year, current.month)[1]
            month_end_dt = datetime(current.year, current.month, last_day)
            month_end = min(month_end_dt, end)

            days_in_month = (month_end - month_start).days + 1
            allocated = raw["original_amount"] * days_in_month // total_days

            month_str = f"{month_start.year:04d}-{month_start.month:02d}"

            cursor.execute("""
                INSERT INTO cost_allocations
                (raw_cost_id, property_id, allocated_month,
                 allocated_start_date, allocated_end_date,
                 allocated_amount, allocation_method, cost_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                raw["id"], raw["property_id"], month_str,
                month_start.strftime("%Y-%m-%d"),
                month_end.strftime("%Y-%m-%d"),
                allocated, "daily_prorate", raw["cost_type"],
            ))
            alloc_count += 1

            # 다음 달 1일
            if current.month == 12:
                current = datetime(current.year + 1, 1, 1)
            else:
                current = datetime(current.year, current.month + 1, 1)

    conn.commit()
    print(f"  ✅ {alloc_count}건 cost_allocations INSERT 완료")

    # ── 검증 ──────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("[검증] 결과 요약")
    print("=" * 60)

    cursor.execute("SELECT COUNT(*) as cnt, SUM(original_amount) as total FROM cost_raw")
    r = cursor.fetchone()
    print(f"  cost_raw:        {r['cnt']:>6}건,  합계: {r['total']:>15,}원")

    cursor.execute("SELECT COUNT(*) as cnt, SUM(allocated_amount) as total FROM cost_allocations")
    r = cursor.fetchone()
    print(f"  cost_allocations: {r['cnt']:>6}건,  합계: {r['total']:>15,}원")

    cursor.execute("""
        SELECT cost_type, COUNT(*) as cnt, SUM(original_amount) as total
        FROM cost_raw GROUP BY cost_type ORDER BY total DESC
    """)
    print(f"\n  비용 타입별:")
    for r in cursor.fetchall():
        print(f"    {r['cost_type']:<10} {r['cnt']:>5}건  {r['total']:>12,}원")

    cursor.execute("""
        SELECT allocated_month, SUM(allocated_amount) as total
        FROM cost_allocations
        GROUP BY allocated_month ORDER BY allocated_month DESC LIMIT 6
    """)
    print(f"\n  최근 월별 비용:")
    for r in cursor.fetchall():
        print(f"    {r['allocated_month']}  {r['total']:>12,}원")

    cursor.close()
    conn.close()
    print(f"\n✅ 전체 완료")


if __name__ == "__main__":
    main()
