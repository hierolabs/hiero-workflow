#!/usr/bin/env python3
"""
카카오톡 단톡방 txt → MySQL chat_histories 테이블 임포트
사용: python3 scripts/import_chat_history.py
"""
import re
import os
import sys
from datetime import datetime

try:
    import pymysql
except ImportError:
    os.system("pip3 install pymysql")
    import pymysql

# DB 연결 (.env에서 읽기)
def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        for line in open(env_path):
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    return env

env = load_env()
DB_HOST = env.get('DB_HOST', 'localhost')
DB_PORT = int(env.get('DB_PORT', '3306'))
DB_USER = env.get('DB_USER', 'root')
DB_PASS = env.get('DB_PASSWORD', '')
DB_NAME = env.get('DB_NAME', 'heiro-dev')

# 시즌 판단
def get_season(date_str):
    if date_str < '2025-06':
        return 1
    elif date_str < '2026-01':
        return 2
    else:
        return 3

# 카카오톡 메시지 파싱
# 포맷: "2025년 8월 21일 오전 8:35, 왕태경 : 메시지 내용"
MSG_PATTERN = re.compile(
    r'(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.+)'
)
DATE_PATTERN = re.compile(r'(\d{4})년 (\d{1,2})월 (\d{1,2})일')
SYS_PATTERN = re.compile(
    r'(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+님이 .+)'
)

def parse_time(year, month, day, ampm, hour, minute):
    h = int(hour)
    if ampm == '오후' and h != 12:
        h += 12
    elif ampm == '오전' and h == 12:
        h = 0
    return datetime(int(year), int(month), int(day), h, int(minute))

def parse_file(filepath, room):
    messages = []
    current_date = None

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for line in f:
            line = line.rstrip('\n')

            # 메시지 라인
            m = MSG_PATTERN.match(line)
            if m:
                year, month, day, ampm, hour, minute, sender, content = m.groups()
                ts = parse_time(year, month, day, ampm, hour, minute)
                date_str = ts.strftime('%Y-%m-%d')
                time_str = ts.strftime('%H:%M')

                # 메시지 타입 판단
                msg_type = 'text'
                if content.strip() == '사진':
                    msg_type = 'photo'
                elif content.strip() == '동영상':
                    msg_type = 'video'
                elif content.strip().startswith('<') and '청소>' in content:
                    msg_type = 'assignment'
                elif content.strip().startswith('<') and '업무>' in content:
                    msg_type = 'assignment'

                messages.append({
                    'room': room,
                    'sender': sender.strip(),
                    'content': content.strip(),
                    'msg_date': date_str,
                    'msg_time': time_str,
                    'msg_type': msg_type,
                    'timestamp': ts,
                    'season': get_season(date_str),
                })
                continue

            # 시스템 메시지 (입장, 퇴장 등)
            sm = SYS_PATTERN.match(line)
            if sm:
                year, month, day, ampm, hour, minute, content = sm.groups()
                ts = parse_time(year, month, day, ampm, hour, minute)
                messages.append({
                    'room': room,
                    'sender': 'system',
                    'content': content.strip(),
                    'msg_date': ts.strftime('%Y-%m-%d'),
                    'msg_time': ts.strftime('%H:%M'),
                    'msg_type': 'system',
                    'timestamp': ts,
                    'season': get_season(ts.strftime('%Y-%m')),
                })
                continue

            # 이전 메시지의 연속 (줄바꿈 포함 메시지)
            if messages and line.strip() and not DATE_PATTERN.match(line):
                messages[-1]['content'] += '\n' + line.strip()

    return messages

def main():
    print(f"DB: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS,
        database=DB_NAME, charset='utf8mb4'
    )
    cur = conn.cursor()

    # 테이블 확인
    cur.execute("SELECT COUNT(*) FROM chat_histories")
    existing = cur.fetchone()[0]
    print(f"현재 {existing}건 존재")

    base = os.path.join(os.path.dirname(__file__), '..', 'docs', 'chat_analysis')

    # 일하는 단톡방
    work_file = os.path.join(base, '일하는_단톡방.txt')
    cur.execute("SELECT COUNT(*) FROM chat_histories WHERE room='work'")
    work_existing = cur.fetchone()[0]
    if os.path.exists(work_file) and work_existing < 31000:
        print("일하는 단톡방 파싱 중...")
        msgs = parse_file(work_file, 'work')
        msgs = msgs[work_existing:]  # 이미 저장된 건 스킵
        print(f"  추가 저장: {len(msgs)}건 (기존 {work_existing}건)")

        for i, m in enumerate(msgs):
            cur.execute(
                "INSERT INTO chat_histories (room, sender, content, msg_date, msg_time, msg_type, timestamp, season) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (m['room'], m['sender'], m['content'][:5000], m['msg_date'], m['msg_time'],
                 m['msg_type'], m['timestamp'], m['season'])
            )
            if (i + 1) % 5000 == 0:
                conn.commit()
                print(f"  {i+1}건 저장...")
        conn.commit()
        print(f"  일하는 단톡방: {len(msgs)}건 저장 완료")

    # 청소 단톡방
    clean_file = os.path.join(base, '청소_단톡방.txt')
    if os.path.exists(clean_file):
        print("청소 단톡방 파싱 중...")
        msgs = parse_file(clean_file, 'cleaning')
        print(f"  파싱: {len(msgs)}건")

        for i, m in enumerate(msgs):
            cur.execute(
                "INSERT INTO chat_histories (room, sender, content, msg_date, msg_time, msg_type, timestamp, season) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (m['room'], m['sender'], m['content'][:5000], m['msg_date'], m['msg_time'],
                 m['msg_type'], m['timestamp'], m['season'])
            )
            if (i + 1) % 5000 == 0:
                conn.commit()
                print(f"  {i+1}건 저장...")
        conn.commit()
        print(f"  청소 단톡방: {len(msgs)}건 저장 완료")

    # 최종 확인
    cur.execute("SELECT room, COUNT(*), MIN(msg_date), MAX(msg_date) FROM chat_histories GROUP BY room")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}건 ({row[2]} ~ {row[3]})")

    conn.close()
    print("완료!")

if __name__ == '__main__':
    main()
