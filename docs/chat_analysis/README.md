# 단톡방 분석 원본 데이터

## 파일

| 파일 | 메시지 수 | 기간 | 성격 |
|------|----------|------|------|
| 일하는_단톡방.txt | 31,867건 (70,069줄) | 2024.08~2026.05 | 전략/지시방 — 김진우 업무지시 중심 |
| 청소_단톡방.txt | 20,233건 (43,908줄) | 2025.08~2026.05 | 실행방 — 청소 배정/완료보고/현장보고 |

## 분석 결과 요약

### 일하는 단톡방 (김진우 업무지시)
- 김진우 발화 11,543건 중 업무지시 3,569건
- 시즌1(현장통제) → 시즌2(운영확장) → 시즌3(예외판단)
- **결론: 김진우 반복 지시 6개 = 띵동이 자동화할 대상**

### 청소 단톡방 (실행)
- 시즌2: 왕태경 배정 → 청소자 완료보고
- 시즌3: 오재관 배정 → 코드화된 배정표 → 시스템화 직전
- **결론: 시즌3 포맷을 그대로 띵동 데이터 구조로 옮길 것**

## 시즌3 청소 배정 포맷 (시스템화 대상)

```
<01월 01일 업무>
@오재관
V13_대치 103_-_Q1

@김정은
T46_센텀2차 406_0일_Q1

@류지영
U24_성우 204_수동_ss3
A22_예건 202_수동_Q1
```

### 데이터 필드 매핑

| 단톡 포맷 | 띵동 DB 필드 | 모델 |
|-----------|-------------|------|
| 날짜 | cleaning_date | CleaningTask |
| @담당자 | cleaner_id/cleaner_name | CleaningTask |
| V13 | property_code | CleaningTask → Property |
| 대치 103 | property_name | Property |
| Q1/Q2 | cleaning_code | CleaningCode |
| 수동 | priority=manual | CleaningTask |
| 0일 | urgency | CleaningTask |
| 퇴실/입실 시간 | checkout_time/next_checkin | Reservation |
| 완료 | status=completed | CleaningTask |
| 침구/수건 | completion_notes | CleaningTask |
| 오염/하자 | issue → Issue | Issue |
| 추가비 | extra_cost | CleaningTask |
