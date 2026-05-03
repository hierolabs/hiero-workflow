# 새 세션 시작 방법

## 1. 터미널에서 실행
```bash
cd ~/hiero-workflow && claude
```

## 2. 첫 프롬프트 (복사-붙여넣기)

```
토큰 절약 모드로 운영한다. CLAUDE.md를 먼저 읽어라.

원칙:
1. CLAUDE.md를 먼저 읽고 프로젝트 구조를 파악해라.
2. 전체 파일을 읽지 말고 Grep/Glob으로 필요한 파일만 찾아라.
3. 수정 전 영향 파일 목록을 먼저 말해라.
4. 5개 이상 파일 수정 시 계획을 먼저 제시해라.
5. 작업 완료 시 변경 내용 + 요약을 보여줘라.
6. .env, secret, 위험 명령어는 승인 없이 실행하지 마라.
```

## 3. 이전 세션 이어서 할 때 추가

```
이전 세션 작업 내역:

[완료]
- 5엔진 사업 진단 시스템 구축 (backend + admin frontend)
  - 모델: models/property_business_diagnosis.go (5엔진 × 5지표 = 25개)
  - 서비스: service/diagnosis_service.go (점수 계산 + 액션맵 + 헤드라인)
  - 자동 평가: service/diagnosis_seed_service.go (예약/청소/이슈/거래 데이터 → 15개 지표 자동)
  - 핸들러: handler/diagnosis.go (ListAll/GetOne/Update/Portfolio/Generate)
  - 프론트: admin/src/pages/Diagnosis.tsx (리스트 + 상세 뷰)
  - 대시보드: Dashboard.tsx에 사업진단 카드 추가

- Hostex 거래 CSV 업로드 시스템
  - 모델: models/hostex_transaction.go
  - 서비스: service/transaction_service.go (CSV 파싱 + 월간 집계)
  - 핸들러: handler/transaction.go (Upload/Summary/Months)
  - 데이터: 2025~2026 CSV 11,641건 임포트 완료, 98개 숙소 매칭

[현재 상태]
- 진단 101건 생성됨 (B등급 79, C등급 22)
- 판매/운영/재무 엔진: 데이터 기반 자동 계산 동작 중
- 가치창출/마케팅 엔진: 수동 평가 미입력 (기본값 50) — 10개 항목
- 재무: Hostex 거래 CSV 기반 월 평균 매출/비용 연결 완료

[남은 과제]
- 가치창출/마케팅 10개 항목 수동 평가 UI 또는 일괄 입력
- 진단 결과 기반 액션 실행 연동
- 거래 데이터 정기 업로드 자동화
```
