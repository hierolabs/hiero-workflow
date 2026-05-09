#!/usr/bin/env python3
"""
monthly_property_reports 자동 집계

원본:
  - reservations (예약 → AOR, ADR)
  - hostex_transactions (거래 → 매출/비용 항목별)
  - cost_allocations (비용 분배 → 월세/관리비 등)

실행: python3 scripts/generate_monthly_reports.py [YYYY-MM]
  인자 없으면: 전체 기간 집계
  인자 있으면: 해당 월만 집계

예: python3 scripts/generate_monthly_reports.py 2026-04
"""

import os
import sys
from datetime import datetime
from calendar import monthrange
import mysql.connector

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "dev-db.c98404c20038.ap-northeast-2.rds.amazonaws.com"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "admin"),
    "password": os.getenv("DB_PASSWORD", "MRM7pmqtQoWnXMt4lW5j"),
    "database": os.getenv("DB_NAME", "heiro-dev"),
}

# hostex_transactions 카테고리 → report 필드 매핑
INCOME_MAP = {
    "객실 요금": "room",
    "청소비 수입": "cleaning_fee",
    "반려동물 수수료": "pet_fee",
    "추가 수입": "extra_fee",
}

EXPENSE_MAP = {
    "청소 비용": "cleaning_cost",
    "Rent_out": "rent_out",
    "Rent_in": "rent_in",
    "관리비": "mgmt",
    "운영비": "operation",
    "환불": "refund",
    "인건비": "labor",
    "소모품": "supplies",
    "인테리어": "interior",
}

COMMISSION_CATS = {"수수료", "플랫폼 수수료", "호스트 수수료"}
TAX_CATS = {"세금", "부가세"}


def main():
    target_month = sys.argv[1] if len(sys.argv) > 1 else None

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # 1. 전체 properties 조회
    cursor.execute("SELECT id, name FROM properties ORDER BY id")
    properties = {r["id"]: r["name"] for r in cursor.fetchall()}

    # 2. 기간 결정
    if target_month:
        months = [target_month]
    else:
        cursor.execute("""
            SELECT DISTINCT `year_month` FROM hostex_transactions
            WHERE `year_month` IS NOT NULL AND `year_month` != ''
            ORDER BY `year_month`
        """)
        months = [r["year_month"] for r in cursor.fetchall()]

    print(f"{'=' * 60}")
    print(f"monthly_property_reports 집계")
    print(f"대상: {len(months)}개 월 × {len(properties)}개 숙소")
    print(f"{'=' * 60}")

    total_inserted = 0

    for month in months:
        year, mon = int(month[:4]), int(month[5:7])
        days_in_month = monthrange(year, mon)[1]
        month_start = f"{month}-01"
        month_end = f"{month}-{days_in_month}"

        # 3. 해당 월 기존 데이터 삭제 (재생성)
        cursor.execute("DELETE FROM monthly_property_reports WHERE month = %s", (month,))

        # 4. 숙소별 집계
        for prop_id, prop_name in properties.items():
            # ── 매출/비용: hostex_transactions ──
            cursor.execute("""
                SELECT type, category, SUM(amount) as total
                FROM hostex_transactions
                WHERE property_id = %s AND `year_month` = %s
                GROUP BY type, category
            """, (prop_id, month))
            tx_rows = cursor.fetchall()

            room = 0
            cleaning_fee = 0
            pet_fee = 0
            extra_fee = 0
            tax = 0
            commission = 0
            cleaning_cost = 0
            rent_in = 0
            rent_out = 0
            mgmt = 0
            operation = 0
            refund = 0
            labor = 0
            supplies = 0
            interior = 0
            other_cost = 0

            for row in tx_rows:
                cat = row["category"] or ""
                total = row["total"] or 0
                tx_type = row["type"] or ""

                if tx_type == "수입":
                    if cat in INCOME_MAP:
                        field = INCOME_MAP[cat]
                        if field == "room": room += total
                        elif field == "cleaning_fee": cleaning_fee += total
                        elif field == "pet_fee": pet_fee += total
                        elif field == "extra_fee": extra_fee += total
                    elif cat in COMMISSION_CATS:
                        commission += total
                    elif cat in TAX_CATS:
                        tax += total
                    else:
                        room += total  # 기타 수입은 객실로

                elif tx_type == "비용":
                    if cat in EXPENSE_MAP:
                        field = EXPENSE_MAP[cat]
                        if field == "cleaning_cost": cleaning_cost += total
                        elif field == "rent_out": rent_out += total
                        elif field == "rent_in": rent_in += total
                        elif field == "mgmt": mgmt += total
                        elif field == "operation": operation += total
                        elif field == "refund": refund += total
                        elif field == "labor": labor += total
                        elif field == "supplies": supplies += total
                        elif field == "interior": interior += total
                    else:
                        other_cost += total

            # ── 비용 보완: cost_allocations (property_costs 기반) ──
            cursor.execute("""
                SELECT cost_type, SUM(allocated_amount) as total
                FROM cost_allocations
                WHERE property_id = %s AND allocated_month = %s
                GROUP BY cost_type
            """, (prop_id, month))
            for row in cursor.fetchall():
                ct = row["cost_type"] or ""
                total = row["total"] or 0
                # cost_allocations는 이미 hostex_transactions에서 마이그레이션했으므로
                # 중복 방지: hostex_transactions에서 이미 계산한 경우 스킵
                # → cost_allocations의 source가 'hostex_transactions_migration'이면 이미 포함됨
                # 별도 소스(엑셀 임포트 등)에서 온 것만 추가
                pass  # 현재는 모두 hostex_transactions에서 왔으므로 중복 방지

            # ── 점유율 (AOR): reservations ──
            # 해당 월과 겹치는 예약의 nights를 합산
            cursor.execute("""
                SELECT SUM(
                    DATEDIFF(
                        LEAST(check_out_date, DATE_ADD(%s, INTERVAL 1 DAY)),
                        GREATEST(check_in_date, %s)
                    )
                ) as occupied_nights
                FROM reservations
                WHERE internal_prop_id = %s
                  AND status NOT IN ('cancelled', 'no_show')
                  AND check_in_date < DATE_ADD(%s, INTERVAL 1 DAY)
                  AND check_out_date > %s
            """, (month_end, month_start, prop_id, month_end, month_start))
            occ_result = cursor.fetchone()
            occupied = occ_result["occupied_nights"] if occ_result and occ_result["occupied_nights"] else 0
            occupied = min(occupied, days_in_month)  # 최대 월일수
            aor = round(occupied / days_in_month, 4) if days_in_month > 0 else 0

            # ── 총합 계산 ──
            gross = room + cleaning_fee + pet_fee + extra_fee + tax + commission
            total_cost_val = abs(cleaning_cost) + abs(rent_out) + abs(mgmt) + abs(operation) + \
                             abs(refund) + abs(labor) + abs(supplies) + abs(interior) + abs(other_cost)
            # rent_in은 수입이므로 비용에서 차감
            total_cost_val -= abs(rent_in)

            net = gross - total_cost_val
            margin = round(net / gross, 4) if gross != 0 else 0
            adr = int(room / occupied) if occupied > 0 else 0

            # 데이터 없는 숙소 스킵
            if gross == 0 and total_cost_val == 0 and occupied == 0:
                continue

            # ── INSERT ──
            cursor.execute("""
                INSERT INTO monthly_property_reports
                (property_id, property_name, month,
                 aor, adr,
                 room, cleaning_fee, pet_fee, extra_fee, tax, commission, gross,
                 cleaning_cost, rent_in, rent_out, mgmt, operation,
                 refund, labor, supplies, interior, `other`, total_cost,
                 net, margin,
                 source_filename, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                prop_id, prop_name, month,
                aor, adr,
                room, cleaning_fee, pet_fee, extra_fee, tax, commission, gross,
                cleaning_cost, rent_in, rent_out, mgmt, operation,
                refund, labor, supplies, interior, other_cost, total_cost_val,
                net, margin,
                "auto_generated",
            ))
            total_inserted += 1

        conn.commit()

    # ── 검증 ──────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"[완료] {total_inserted}개 행 INSERT")
    print(f"{'=' * 60}")

    cursor.execute("""
        SELECT month, COUNT(*) as properties,
               SUM(gross) as total_gross,
               SUM(total_cost) as total_cost,
               SUM(net) as total_net,
               ROUND(AVG(aor) * 100, 1) as avg_aor
        FROM monthly_property_reports
        GROUP BY month ORDER BY month DESC LIMIT 8
    """)
    print(f"\n  월별 요약:")
    print(f"  {'월':>8}  {'숙소':>4}  {'총매출':>14}  {'총비용':>14}  {'순이익':>14}  {'점유율':>6}")
    for r in cursor.fetchall():
        print(f"  {r['month']:>8}  {r['properties']:>4}  "
              f"{r['total_gross']:>14,}  {r['total_cost']:>14,}  "
              f"{r['total_net']:>14,}  {r['avg_aor']:>5}%")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
