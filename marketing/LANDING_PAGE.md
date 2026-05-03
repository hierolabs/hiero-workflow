# HIERO 마케팅 랜딩페이지

## 현재 구조

```
http://localhost:5180 (frontend/)

/              → 메인 랜딩 (Hero + 5개 서비스 카드 + CTA 폼)
/service       → 1. 위탁운영 서비스 (운영 프로세스 상세)
/matching      → 2. 숙소노출 매칭플랫폼 (OTA 5개 채널)
/review        → 3. 거리기반 평가시스템 (5엔진 진단)
/hosting       → 4. 고객확보 (숙소운영자 문제 해결)
/thingdone     → 5. 띵똥 청소배정 관리 플랫폼
```

## 기술 스택

- React + TypeScript + Vite (port 5180)
- Tailwind CSS v4 (@tailwindcss/vite)
- React Router v7
- API Proxy → localhost:8080

## 디자인 시스템

- **톤**: 깔끔 비즈니스 B2B SaaS
- **배경**: slate-950 (Hero/Feature 섹션) + white (콘텐츠)
- **강조색**: blue-600
- **텍스트**: gray-900 (제목) / gray-500 (본문)
- **카드**: 흰색 border rounded-xl shadow-sm hover:shadow-md
- **CTA 버튼**: bg-blue-600 text-white rounded-lg px-8 py-4

## 페이지별 구성

### 메인 랜딩 (/)

```
[Nav] HIERO | 서비스 | 매칭플랫폼 | 평가시스템 | 고객확보 | 띵똥 | [진단받기]

[Hero - 다크]
  빈집을 수익형 숙소로 바꾸는 위탁운영 시스템
  사진, 가격, 예약, 청소, CS, 정산까지
  직접 하지 않아도 운영되는 숙소를 만듭니다.
  [내 숙소 진단받기 →]

[Pain - 화이트]
  이런 고민이 있으신가요?
  - 집은 있는데 공실이 걱정되시나요?
  - 에어비앤비를 해보고 싶지만 운영이 부담되시나요?
  - 예약, 청소, 게스트 응대, 정산이 복잡하신가요?

[Solution - 슬레이트]
  숙소를 단순 등록하는 것이 아닙니다
  수익 가능성을 진단하고, 채널별 판매 전략과 운영 시스템을 설계합니다.

[5개 서비스 카드 - 화이트]
  클릭 → 상세 페이지로 이동

[제공 서비스 8가지 - 다크]
  숙소 수익성 진단 / 사진 개선 / OTA 채널 운영 /
  가격 전략 / 예약 관리 / 청소 배정 / 게스트 CS / 월간 정산 리포트

[CTA 폼]
  이름, 전화번호, 지역, 숙소유형, 고민
  → POST /api/marketing/leads

[Footer - 다크]
```

### 1. 위탁운영 서비스 (/service)

- 우리가 하는 일 8가지 (카드 그리드)
- 운영 프로세스 4단계: 무료 진단 → 운영안 제안 → 숙소 세팅 → 운영 시작
- CTA

### 2. 숙소노출 매칭플랫폼 (/matching)

- 운영 채널 5개: Airbnb, Booking.com, Agoda, 삼삼엠투, 리브애니웨어
- 매칭 프로세스: 채널별 문구 최적화, 통합 캘린더, 성과 분석
- CTA

### 3. 거리기반 평가시스템 (/review)

- 5엔진 진단: 매출, 운영, 고객, 채널, 재무
- 진단 결과로 받을 수 있는 것 5가지
- CTA

### 4. 고객확보 (/hosting)

- 고통 → 해결 매핑 6가지 (Pain → Real Pain → Solution)
- 타겟 고객 6유형
- CTA

### 5. 띵똥 청소배정 (/thingdone)

- 핵심 기능 6가지: 자동 배정, 실시간 확인, 비품 관리, 체크리스트, 성과 관리, 대시보드
- 청소 배정 흐름 5단계
- CTA

## CTA 폼 → 리드 자동 생성

```
폼 제출
  → POST /api/marketing/leads (인증 불필요, 공개 API)
  → DB에 OutsourcingLead 생성 (status: "new", contact_channel: "랜딩페이지")
  → Admin > 위탁영업에서 즉시 확인 가능
```

## 핵심 카피

### 제목
빈집을 수익형 숙소로 바꾸는 위탁운영 시스템

### 부제
사진, 가격, 예약, 청소, CS, 정산까지
직접 하지 않아도 운영되는 숙소를 만듭니다.

### CTA
내 숙소 운영 가능성 진단받기

### 영업 원칙 (메시지 톤)
- 팔지 말고 진단한다 — "해드릴게요"가 아니라 "확인해드릴게요"
- 손실을 숫자로 보여준다 — "공실 20일 × 일 8만원 = 월 160만원 기회비용"
- 다음 단계를 작게 만든다 — "계약하세요"가 아니라 "사진만 보내주세요"
- 고객이 말하게 한다 — 설명보다 질문, 제안보다 확인

## 향후 확장 계획 (광고용 타겟별 랜딩)

```
/lp/vacancy       → 공실 임대인 전용 (관리비 손실 강조)
/lp/host-tired    → 직접 운영 지친 호스트 (시간 절약 강조)
/lp/low-revenue   → 저매출 호스트 (매출 개선 강조)
/lp/new-host      → 에어비앤비 시작 못 하는 집주인 (진입 장벽 해소)
/lp/multi-owner   → 다주택 임대인 (통합 관리 강조)
/lp/thingdone     → 띵똥 단독 (청소 SaaS 관점)
```

각 광고 랜딩은:
- 타겟 고객의 고통을 Hero에 직접 배치
- CTA를 해당 고통의 해결로 연결
- UTM 파라미터로 유입 채널 추적
- 폼 제출 시 contact_channel에 광고 소스 자동 기록

## 실행 방법

```bash
# 개발 서버
cd ~/hiero-workflow/frontend && npm run dev
# → http://localhost:5180

# 빌드
cd ~/hiero-workflow/frontend && npm run build
# → frontend/dist/

# 백엔드 (리드 API)
cd ~/hiero-workflow/backend && air
# → http://localhost:8080
```

## 파일 구조

```
frontend/
├── vite.config.ts              — Tailwind + proxy 설정
├── src/
│   ├── main.tsx                — BrowserRouter
│   ├── index.css               — Tailwind 임포트
│   ├── App.tsx                 — 라우트 6개
│   ├── components/
│   │   └── LandingLayout.tsx   — Nav + Footer (모바일 대응)
│   └── pages/
│       ├── Home.tsx            — 메인 랜딩
│       ├── Service.tsx         — 위탁운영 서비스
│       ├── Matching.tsx        — 숙소노출 매칭
│       ├── Review.tsx          — 거리기반 평가
│       ├── Hosting.tsx         — 고객확보
│       └── ThingDone.tsx       — 띵똥 청소배정
```
