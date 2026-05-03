import { useEffect, useState } from "react";

export type ManualPage =
  | "dashboard"
  | "properties"
  | "reservations"
  | "cleaning"
  | "issues"
  | "revenue"
  | "settlement"
  | "hostex-sync"
  | "messages"
  | "diagnosis"
  | "tasks";

interface SectionDef {
  key: string;
  label: string;
  defaultContent: string;
}

interface ManualConfig {
  title: string;
  sections: SectionDef[];
}

interface ManualEntry {
  id: number;
  page: string;
  section: string;
  title: string;
  content: string;
  updated_name: string;
  updated_at: string;
}

const PAGE_CONFIG: Record<ManualPage, ManualConfig> = {
  dashboard: {
    title: "대시보드 운영 매뉴얼",
    sections: [
      { key: "morning", label: "매일 아침 확인 루틴", defaultContent: `## 매일 아침 확인 루틴

1. **전일 예약 현황** — 신규 예약, 취소, 변경 건 확인
2. **오늘 체크인/체크아웃** — 예정된 입퇴실 확인
3. **청소 현황** — 미배정 청소 태스크 확인
4. **미처리 이슈** — 전일 발생 미해결 이슈 확인
5. **게스트 메시지** — 미답변 메시지 확인

### 확인 순서
Dashboard → 캘린더 → 청소 → 이슈 → 메시지

### 이상 시
- 예약 동기화 실패: Hostex 수동 동기화 실행
- 청소 미배정: 청소원 가용 현황 확인 후 수동 배정
- 이슈 폭증: 공통 원인 파악 (시설물 문제, 날씨 등)` },
      { key: "metrics", label: "핵심 지표 해석", defaultContent: `## 핵심 지표 해석

| 지표 | 정상 범위 | 주의 | 위험 |
|------|----------|------|------|
| 가동률 | 70% 이상 | 50~70% | 50% 미만 |
| ADR(평균 일일 단가) | 목표 ±10% | 목표 대비 -20% | 목표 대비 -30% |
| 응답률 | 95% 이상 | 90~95% | 90% 미만 |
| 청소 완료율 | 100% | 95~99% | 95% 미만 |
| 이슈 해결 시간 | 4시간 이내 | 4~12시간 | 12시간 초과 |

### 주간 비교
- 전주 대비 가동률 변화 추이
- 채널별 매출 비중 변화
- 리뷰 점수 추이` },
      { key: "alert", label: "이상 징후 대응", defaultContent: `## 이상 징후 대응 프로세스

### 예약 급감 시
1. 채널별 리스팅 상태 확인 (비활성화, 차단 여부)
2. 가격 경쟁력 확인 (주변 숙소 대비)
3. 리뷰/평점 하락 여부 확인
4. 계절 요인 분석

### 이슈 급증 시
1. 공통 원인 파악 (동일 숙소, 동일 유형)
2. 근본 원인 해결 (시설 수리, 프로세스 변경)
3. 임시 차단 검토 (심각한 경우)

### 매출 하락 시
1. 가동률 vs ADR 중 원인 특정
2. 채널별 분석
3. 가격 전략 재조정` },
    ],
  },
  properties: {
    title: "공간 관리 매뉴얼",
    sections: [
      { key: "register", label: "신규 숙소 등록", defaultContent: `## 신규 숙소 등록 절차

### 1단계: 기본 정보 입력
- 숙소명, 코드, 지역, 주소
- 부동산 유형 (apartment, officetel, villa, studio)
- 방 유형 (entire, private, shared)
- 최대 인원, 침실, 침대, 욕실 수
- 월세, 관리비, 보증금

### 2단계: 사진 촬영
- 대표 사진 최소 15장
- 필수 촬영: 거실, 침실, 화장실, 주방, 현관, 전망
- 밝은 낮 시간 촬영 (자연광)
- 정리정돈 후 촬영

### 3단계: 채널 등록
- Airbnb → Booking.com → Agoda → 삼삼엠투 순서
- 채널별 문구 차별화
- Hostex 매핑 완료

### 4단계: 가격 설정
- 주변 숙소 가격 조사
- 초기 가격: 시장 평균 -10% (리뷰 확보용)
- 주중/주말 차등
- 시즌별 가격 설정

### 5단계: 테스트 예약
- 내부 테스트 예약 1건 진행
- 체크인 안내 메시지 확인
- 청소 태스크 자동 생성 확인` },
      { key: "status", label: "숙소 상태 관리", defaultContent: `## 숙소 상태 관리

| 상태 | 의미 | 전환 조건 |
|------|------|----------|
| preparing | 세팅 중 | 사진/등록/가격 미완료 |
| active | 운영 중 | 채널 노출, 예약 가능 |
| paused | 일시 중지 | 리모델링, 시설 수리 등 |
| closed | 운영 종료 | 계약 해지, 매각 등 |

### 상태 전환 규칙
- preparing → active: 모든 채널 등록 + 가격 설정 + 사진 업로드 완료
- active → paused: 시설 문제 또는 소유자 요청
- paused → active: 문제 해결 확인 후
- active → closed: 위탁운영 계약 종료` },
      { key: "operation", label: "운영 상태 관리", defaultContent: `## 운영 상태 관리

| 상태 | 의미 |
|------|------|
| inactive | 비활성 (세팅 중) |
| available | 예약 가능 |
| occupied | 게스트 입실 중 |
| maintenance | 유지보수 중 |
| blocked | 차단 (소유자 사용 등) |

### 자동 전환
- 체크인 → occupied
- 체크아웃 → available (청소 완료 후)
- 수리 요청 → maintenance

### 수동 전환
- 소유자 사용: blocked 처리 + 기간 설정
- 긴급 수리: maintenance + 이슈 생성` },
      { key: "edit", label: "정보 수정 체크리스트", defaultContent: `## 숙소 정보 수정 체크리스트

정보 수정 후 반드시 확인:
- [ ] Hostex 동기화 상태 확인
- [ ] 각 OTA 채널 반영 여부
- [ ] 가격 변경 시 모든 채널 동일 적용
- [ ] 인원 변경 시 침대 구성 일치 확인
- [ ] 사진 변경 시 대표사진 순서 확인` },
      { key: "excel", label: "엑셀 일괄 업로드", defaultContent: `## 엑셀 일괄 업로드 방법

### 다운로드
1. 공간 관리 > 내보내기 클릭
2. 현재 데이터가 포함된 엑셀 다운로드

### 수정
- 코드(code)는 고유값, 중복 불가
- 필수 필드: code, name, region, property_type, room_type
- 상태값은 지정된 값만 사용

### 업로드
1. 공간 관리 > 가져오기 클릭
2. 수정된 엑셀 파일 선택
3. 미리보기에서 변경 내용 확인
4. 확인 후 적용` },
    ],
  },
  reservations: {
    title: "예약 관리 매뉴얼",
    sections: [
      { key: "check", label: "예약 상태 확인", defaultContent: `## 예약 상태 확인

### 예약 상태 종류
- **confirmed** — 확정된 예약
- **pending** — 대기 중 (호스트 승인 필요)
- **cancelled** — 취소됨
- **completed** — 퇴실 완료

### 일일 확인 사항
1. 오늘 체크인 예정 건 — 게스트 연락 여부
2. 오늘 체크아웃 예정 건 — 청소 배정 확인
3. 내일 체크인 예정 건 — 사전 안내 메시지 발송
4. 미매칭 예약 — 숙소 매칭 확인` },
      { key: "noshow", label: "노쇼/취소 대응", defaultContent: `## 노쇼/취소 대응 프로세스

### 노쇼 (No-show)
1. 체크인 시간 + 2시간 경과 시 게스트 연락
2. 연락 불가 시 플랫폼 메시지 발송
3. 당일 23:59까지 미연락 → 노쇼 처리
4. 해당 날짜 재판매 가능 여부 확인

### 취소 대응
- **게스트 취소**: 플랫폼 정책에 따른 환불 처리
- **호스트 취소**: 최대한 피하기 (패널티 발생)
- 취소 후: 해당 기간 가격 조정하여 재판매

### 환불 기준
- 플랫폼별 환불 정책 준수
- 특이 사항은 이슈로 등록` },
      { key: "mismatch", label: "매칭 오류 대응", defaultContent: `## 예약 매칭 오류 대응

### 매칭 오류 원인
1. Hostex 숙소 ID 매핑 누락
2. 동기화 지연
3. 수동 예약 입력 오류

### 대응 절차
1. 예약 관리 > 재매칭 실행
2. 자동 매칭 실패 시 수동으로 숙소 지정
3. Hostex 연동 페이지에서 매핑 상태 확인
4. 반복 발생 시 매핑 테이블 재설정` },
      { key: "checkinout", label: "체크인/체크아웃 운영", defaultContent: `## 체크인/체크아웃 운영

### 체크인 프로세스
1. **D-1**: 체크인 안내 메시지 발송 (주소, 비밀번호, 와이파이 등)
2. **당일**: 입실 확인 메시지 발송
3. **입실 후 1시간**: "편히 쉬고 계신가요?" 확인

### 체크아웃 프로세스
1. **D-1**: 체크아웃 안내 (시간, 주의사항)
2. **당일 아침**: 체크아웃 리마인드
3. **퇴실 후**: 청소 태스크 시작 트리거
4. **청소 완료 후**: 상태 점검, 파손 여부 확인

### 셀프 체크인 도어락 관리
- 예약별 임시 비밀번호 생성
- 체크아웃 후 비밀번호 변경
- 마스터 비밀번호는 팀 내부만 공유` },
    ],
  },
  cleaning: {
    title: "청소 관리 매뉴얼",
    sections: [
      { key: "auto", label: "자동 생성 원리", defaultContent: `## 청소 태스크 자동 생성 원리

### 트리거 조건
- 예약 체크아웃 날짜 기준으로 청소 태스크 자동 생성
- 생성 시점: 예약 동기화 시 (체크아웃 당일 포함 이전)

### 태스크 정보
- 숙소명, 체크아웃 시간
- 다음 체크인 시간 (있을 경우)
- 청소 유형: 일반 / 딥클리닝

### 딥클리닝 조건
- 장기 투숙 (7일 이상) 후
- 월 1회 정기 딥클리닝
- 이슈 발생 후 (오염, 파손 등)` },
      { key: "assign", label: "청소원 배정 규칙", defaultContent: `## 청소원 배정 규칙

### 배정 기준
1. **지역 우선** — 해당 숙소와 가장 가까운 청소원
2. **당일 여유** — 이미 배정된 건수 확인
3. **숙련도** — 해당 숙소 경험 있는 청소원 우선
4. **순번** — 동일 조건 시 로테이션

### 배정 시간
- 체크아웃 30분 후 시작 기준
- 다음 체크인 2시간 전까지 완료 목표

### 긴급 배정
- 당일 갑작스러운 체크아웃: 가용 청소원 즉시 배정
- 모든 청소원 불가: 팀장(오재관)에게 에스컬레이션` },
      { key: "confirm", label: "완료 확인 절차", defaultContent: `## 청소 완료 확인 절차

1. 청소원이 앱에서 "완료" 버튼 클릭
2. 완료 사진 3장 이상 업로드 (침실, 화장실, 주방)
3. 비품 체크리스트 확인 체크
4. 관리자 확인 → 태스크 최종 완료 처리
5. 다음 게스트 체크인 준비 완료 상태로 전환` },
      { key: "issue", label: "이슈 보고 방법", defaultContent: `## 청소 중 이슈 보고

### 보고 대상
- 시설 파손 (가구, 가전, 벽/바닥)
- 심한 오염 (추가 클리닝 필요)
- 비품 부족/파손
- 이전 게스트 분실물 발견

### 보고 방법
1. 청소 태스크에서 "이슈 보고" 클릭
2. 사진 촬영 + 설명 작성
3. 이슈가 자동으로 이슈 트래커에 등록됨
4. 긴급 시 팀장에게 직접 연락` },
      { key: "checklist", label: "비품 체크리스트", defaultContent: `## 비품 체크리스트

### 침실
- [ ] 이불/베개 커버 교체
- [ ] 여분 이불 세트
- [ ] 옷걸이 5개 이상
- [ ] 슬리퍼

### 화장실
- [ ] 수건 (인원 수 × 2)
- [ ] 샴푸, 컨디셔너, 바디워시
- [ ] 드라이기
- [ ] 화장지 2롤 이상
- [ ] 칫솔, 치약 (인원 수)

### 주방
- [ ] 정수기 물 보충
- [ ] 커피/티백
- [ ] 기본 식기 세트
- [ ] 쓰레기봉투
- [ ] 행주, 수세미

### 공용
- [ ] 와이파이 비밀번호 카드
- [ ] 리모컨 정위치
- [ ] 에어컨/히터 정상 작동 확인` },
    ],
  },
  issues: {
    title: "이슈 & 멀티박스 매뉴얼",
    sections: [
      { key: "types", label: "이슈 유형 분류", defaultContent: `## 이슈 유형 분류

| 유형 | 예시 |
|------|------|
| 시설 | 가전 고장, 누수, 도어락 오류, 에어컨 불량 |
| 청소 | 청소 불량, 추가 청소 요청, 오염 |
| 게스트 | 클레임, 소음, 규칙 위반, 추가 인원 |
| 정산 | 금액 오류, 환불 요청, 추가 비용 |
| 운영 | 채널 오류, 동기화 문제, 가격 조정 |` },
      { key: "create", label: "이슈 생성 규칙", defaultContent: `## 이슈 생성 규칙

### 자동 생성
- 청소 중 이슈 보고 → 자동 생성
- 게스트 메시지 분석 → 키워드 감지 시 자동 생성

### 수동 생성
- 제목: [유형] 숙소명 - 내용 요약
- 설명: 현재 상황, 원인, 긴급도
- 첨부: 사진/스크린샷

### 필수 입력
- 유형 선택
- 관련 숙소
- 우선순위 (low/medium/high/urgent)
- 담당자 배정` },
      { key: "assign", label: "배정 기준", defaultContent: `## 이슈 배정 기준

| 담당자 | 역할 | 배정 이슈 |
|--------|------|----------|
| 김진우 | 대표/총괄 | 전략적 결정, 계약 관련, 에스컬레이션 |
| 오재관 | 현장 운영 | 시설, 청소 품질, 현장 긴급 대응 |
| 우연 | CS/게스트 | 게스트 클레임, 응대, 리뷰 관리 |
| 김진태 | 청소 | 청소 배정, 품질, 비품 관리 |
| 박수빈 | 정산 | 정산 이의, 금액 오류, 환불 |

### 배정 규칙
1. 유형에 따라 1차 담당자 자동 배정
2. 24시간 미처리 → 팀장 에스컬레이션
3. 복합 이슈 → 대표 배정` },
      { key: "priority", label: "우선순위 결정", defaultContent: `## 우선순위 결정 기준

### Urgent (즉시 대응)
- 게스트 입실 불가 (도어락, 열쇠)
- 누수/화재/안전 문제
- 게스트 건강/안전 관련

### High (4시간 이내)
- 에어컨/히터 고장 (계절 의존)
- 온수 안 나옴
- 와이파이 불능
- 게스트 강한 클레임

### Medium (24시간 이내)
- 가전 일부 고장
- 청소 불량 재청소
- 비품 부족

### Low (48시간 이내)
- 미관 문제
- 비긴급 수리
- 정산 문의` },
      { key: "escalation", label: "에스컬레이션 기준", defaultContent: `## 에스컬레이션 기준

### 자동 에스컬레이션
- Urgent: 30분 미응답 → 대표 알림
- High: 4시간 미처리 → 팀장 알림
- Medium: 24시간 미처리 → 팀장 알림

### 수동 에스컬레이션
- 담당자가 해결 불가 판단 시
- 비용 발생 (50만원 초과) 시 대표 승인 필요
- 게스트 법적 조치 언급 시 즉시 대표 보고
- 플랫폼 패널티 위험 시 즉시 보고` },
    ],
  },
  revenue: {
    title: "매출 현황 매뉴얼",
    sections: [
      { key: "interpret", label: "매출 데이터 해석", defaultContent: `## 매출 데이터 해석 방법

### 핵심 용어
- **매출 (Revenue)**: 예약 총 금액
- **ADR (Average Daily Rate)**: 평균 일일 단가 = 총매출 / 판매 객실일수
- **RevPAR**: 객실당 매출 = ADR × 가동률
- **가동률 (Occupancy)**: 판매일수 / 가용일수 × 100

### 매출 구성
총매출 = 숙박비 + 청소비(게스트 부담분) + 추가서비스
순매출 = 총매출 - 플랫폼 수수료 - OTA 수수료` },
      { key: "channel", label: "채널별 매출 분석", defaultContent: `## 채널별 매출 분석

### 채널 특성
| 채널 | 특성 | 수수료 |
|------|------|--------|
| Airbnb | 해외 게스트 중심, 장기 숙박 | 호스트 3% |
| Booking.com | 비즈니스 출장 + 관광 | 15% |
| Agoda | 아시아권 게스트 | 15% |
| 삼삼엠투 | 국내, 미드텀 | 10% |

### 분석 포인트
- 채널별 예약 비중 변화 추이
- 채널별 ADR 차이
- 채널별 취소율
- 가장 수익성 좋은 채널 식별` },
      { key: "occupancy", label: "가동률과 ADR", defaultContent: `## 가동률과 ADR 관계

### 기본 원칙
- 가동률 ↑ + ADR ↓ = 박리다매 (비추천)
- 가동률 ↓ + ADR ↑ = 가격 장벽 (조정 필요)
- 가동률 70% + 적정 ADR = 최적 구간

### 가동률 개선 방법
1. 직전 할인 (체크인 3일 이내 빈 날짜)
2. 장기 숙박 할인 (7일 이상 10~20% 할인)
3. 비수기 가격 인하
4. 채널 노출 순위 최적화

### ADR 개선 방법
1. 사진 퀄리티 업그레이드
2. 리뷰 점수 관리
3. 성수기 가격 적극 인상
4. 주말/공휴일 프리미엄` },
      { key: "target", label: "목표 대비 분석", defaultContent: `## 매출 목표 대비 분석

### 월간 목표 설정 기준
- 손익분기 매출 = 월세 + 관리비 + 청소비 + 플랫폼수수료 + 운영수수료
- 목표 매출 = 손익분기 × 1.3 (30% 마진)

### 분석 방법
1. 월중 진행률 확인 (15일 기준 50% 달성 여부)
2. 잔여 기간 예상 매출 계산
3. 미달 시 가격 조정 또는 프로모션 검토

### 보고 주기
- 주간: 간단 현황 (가동률, 매출, 이슈)
- 월간: 정산 리포트 (숙소별 상세)` },
      { key: "season", label: "시즌별 가격 조정", defaultContent: `## 시즌별 가격 조정 기준

### 성수기 (가격 +20~50%)
- 벚꽃 시즌 (3월 말~4월)
- 여름 성수기 (7~8월)
- 추석/설 연휴
- 연말 (12월 크리스마스~신년)

### 비수기 (가격 -10~20%)
- 1~2월 (겨울 비수기)
- 11월 (가을 비수기)

### 조정 방법
- 최소 2주 전에 가격 변경
- 모든 채널 동시 변경 (Hostex 통해)
- 이미 들어온 예약은 변경 불가` },
    ],
  },
  settlement: {
    title: "정산 관리 매뉴얼",
    sections: [
      { key: "cycle", label: "정산 주기와 방법", defaultContent: `## 정산 주기와 방법

### 정산 주기
- 월 1회 (매월 5일 전월 정산)
- 정산 기준: 체크아웃 완료된 예약

### 정산 방법
1. 자동 집계 (채널별 매출 합산)
2. 비용 차감 (수수료, 청소비, 운영비)
3. 정산서 생성
4. 소유자 확인 요청
5. 이의 없을 시 송금

### 정산서 포함 내용
- 예약 목록 (날짜, 게스트, 금액)
- 채널별 매출 합계
- 비용 항목별 합계
- 최종 정산 금액` },
      { key: "fee", label: "수수료 구조", defaultContent: `## 수수료 구조

### HIERO 위탁운영 수수료
- 매출의 15~20% (계약 조건에 따라 상이)
- 최저 보장 없음 (매출 발생 시에만 과금)

### 플랫폼 수수료
- Airbnb: 호스트 3%
- Booking: 15%
- Agoda: 15%
- 삼삼엠투: 10%

### 기타 비용
- 청소비: 건당 (숙소 규모별 상이)
- 비품비: 실비
- 긴급 수리비: 실비 (사전 승인)` },
      { key: "cost", label: "비용 항목", defaultContent: `## 정산 비용 항목

| 항목 | 설명 | 비고 |
|------|------|------|
| 월세 | 소유자 부담 고정비 | 정산 전 차감 |
| 관리비 | 건물 관리비 | 소유자 부담 |
| 청소비 | 건당 청소 비용 | 매출에서 차감 |
| 플랫폼 수수료 | OTA 채널 수수료 | 자동 차감 |
| 운영 수수료 | HIERO 위탁 수수료 | 매출 기반 % |
| 비품비 | 소모품 교체 | 실비 정산 |
| 수리비 | 시설 수리/교체 | 사전 승인 후 |` },
      { key: "send", label: "정산서 발송", defaultContent: `## 정산서 발송 프로세스

### 일정
- 매월 1~3일: 전월 데이터 마감 및 검증
- 매월 4일: 정산서 초안 생성
- 매월 5일: 소유자에게 정산서 발송
- 매월 5~7일: 이의 접수 기간
- 매월 10일: 최종 확정 후 송금

### 발송 방법
- 카카오톡 또는 이메일
- PDF 첨부
- 주요 수치 요약 메시지 함께 발송

### 확인 포인트
- 예약 누락 없는지 확인
- 취소건 차감 확인
- 비용 항목 정확성 확인` },
      { key: "dispute", label: "정산 이의 대응", defaultContent: `## 정산 이의 대응

### 이의 유형
1. 매출 누락 주장
2. 비용 항목 이의
3. 수수료율 이의
4. 예약 취소 건 처리 문의

### 대응 프로세스
1. 이의 내용 접수 및 기록
2. 관련 데이터 확인 (예약 기록, 채널 내역)
3. 48시간 이내 답변
4. 수정 필요 시 정산서 재발행
5. 합의 불가 시 대표 중재

### 예방 조치
- 정산서에 모든 항목 투명하게 기재
- 비용 발생 시 사전 고지
- 월 1회 소유자 소통 (정산 외)` },
    ],
  },
  "hostex-sync": {
    title: "Hostex 연동 매뉴얼",
    sections: [
      { key: "structure", label: "연동 구조 설명", defaultContent: `## Hostex 연동 구조

### 개요
HIERO ↔ Hostex ↔ OTA 채널 (Airbnb, Booking, Agoda, 삼삼엠투)

### 데이터 흐름
- **예약 동기화**: Hostex → HIERO (웹훅 + 폴링)
- **숙소 동기화**: Hostex → HIERO (API 호출)
- **가격 변경**: HIERO → Hostex → OTA
- **가용일 변경**: HIERO → Hostex → OTA

### 동기화 주기
- 웹훅: 실시간 (예약 생성/변경/취소)
- 숙소 데이터: 서버 시작 시 전체 동기화
- 예약 폴링: 3개월 범위 동기화` },
      { key: "mapping", label: "숙소 매핑 방법", defaultContent: `## 숙소 매핑 방법

### 매핑이란?
Hostex의 숙소 ID와 HIERO의 Property를 연결하는 것

### 매핑 절차
1. Hostex 연동 페이지 진입
2. "매핑 관리" 탭에서 미매핑 숙소 확인
3. HIERO Property 선택 후 "연결" 클릭
4. 동기화 실행하여 확인

### 주의사항
- 1:1 매핑만 가능 (중복 매핑 불가)
- 매핑 해제 시 해당 숙소 예약은 동기화 중단
- 새 숙소 등록 시 반드시 매핑까지 완료` },
      { key: "sync", label: "동기화 주기", defaultContent: `## 동기화 주기와 수동 동기화

### 자동 동기화
- 서버 시작 시: 전체 숙소 + 최근 3개월 예약
- 웹훅 수신 시: 해당 예약 즉시 반영

### 수동 동기화
- "동기화" 버튼: 선택 숙소의 최근 예약 동기화
- "전체 동기화" 버튼: 모든 숙소 + 예약 재동기화

### 수동 동기화 필요한 경우
- 예약 현황이 실제와 불일치할 때
- Hostex에서 직접 수정한 내용 반영
- 오류 복구 후 데이터 정합성 확인` },
      { key: "error", label: "동기화 오류 대응", defaultContent: `## 동기화 오류 대응

### 흔한 오류
1. **API 토큰 만료**: Hostex 설정에서 토큰 재발급
2. **매핑 누락**: 숙소 매핑 확인 후 재매핑
3. **네트워크 타임아웃**: 재시도 (보통 자동 복구)
4. **데이터 충돌**: 수동 동기화 실행

### 확인 방법
- 백엔드 로그 확인 (.logs/backend.log)
- Hostex 대시보드에서 API 호출 이력 확인
- 웹훅 수신 로그 확인

### 에스컬레이션
- 30분 이상 동기화 실패 시 개발팀 연락
- 예약 누락 발생 시 즉시 수동 확인 + 이슈 등록` },
      { key: "channel", label: "채널 매니저 운영", defaultContent: `## 채널 매니저 운영

### Hostex를 통한 채널 관리
- 모든 OTA 채널을 Hostex에서 통합 관리
- 가격, 가용일, 최소숙박일 등을 한 번에 변경
- 채널별 개별 설정도 가능

### 채널별 주의사항
- **Airbnb**: Superhost 유지 위해 응답률/취소율 관리
- **Booking**: Genius 프로그램 참여 여부 결정
- **Agoda**: 프로모션 참여 시 마진 확인
- **삼삼엠투**: 장기 숙박 위주, 별도 가격 정책

### 채널 추가/제거
- 새 채널 추가: Hostex에서 연동 후 HIERO 매핑
- 채널 제거: 기존 예약 완료 후 연동 해제` },
    ],
  },
  messages: {
    title: "게스트 메시지 매뉴얼",
    sections: [
      { key: "principle", label: "응대 원칙", defaultContent: `## 게스트 응대 원칙

### 기본 원칙
1. **30분 이내 초회 응답** (응답률 = 슈퍼호스트 유지 핵심)
2. **친절하되 간결하게** (긴 설명 X, 핵심만 전달)
3. **문제는 즉시 해결 의지 표현** ("확인하고 바로 안내드리겠습니다")
4. **감정적 대응 금지** (클레임에도 차분하게)

### 톤 & 매너
- 존댓말 사용
- 이모지 적절히 사용 (과하지 않게)
- 영어 메시지: 간결 + 정확
- 한국어 메시지: 친근 + 정중

### 금지 행위
- 플랫폼 외 결제 유도
- 개인 연락처 공유
- 다른 게스트 정보 공유
- 부정확한 정보 전달` },
      { key: "checkin", label: "체크인 안내 템플릿", defaultContent: `## 체크인 안내 메시지 템플릿

### D-1 메시지 (한국어)
\`\`\`
안녕하세요! 내일 체크인 안내드립니다 🏠

📍 주소: [주소]
🔑 도어락 비밀번호: [비밀번호]
⏰ 체크인: [시간] 이후
📶 와이파이: [이름] / [비밀번호]

주차: [가능/불가]
엘리베이터: [있음/없음], [동/호수]

도착하시면 편하게 연락 주세요!
\`\`\`

### D-1 메시지 (English)
\`\`\`
Hi! Here's your check-in info for tomorrow 🏠

📍 Address: [address]
🔑 Door code: [code]
⏰ Check-in: after [time]
📶 WiFi: [name] / [password]

Let me know when you arrive!
\`\`\`` },
      { key: "faq", label: "자주 묻는 질문", defaultContent: `## 자주 묻는 질문 답변

### "얼리 체크인 가능한가요?"
→ "이전 게스트 체크아웃과 청소 상황에 따라 달라요. 당일 오전에 확인 후 안내드리겠습니다!"

### "레이트 체크아웃 가능한가요?"
→ "다음 예약 상황에 따라 가능할 수 있어요. 전날 저녁에 확인 후 안내드릴게요!"

### "주변에 맛집 추천해주세요"
→ 숙소별 주변 맛집 리스트 준비해서 전달

### "짐을 맡길 수 있나요?"
→ "체크인 전/체크아웃 후 짐 보관은 현관 앞에 두시면 됩니다. 귀중품은 직접 보관해주세요."

### "인원 추가 가능한가요?"
→ "최대 인원은 [N]명입니다. 추가 인원은 안전/소음 문제로 어려운 점 양해 부탁드려요."` },
      { key: "claim", label: "클레임 대응", defaultContent: `## 클레임 대응 프로세스

### 1단계: 즉시 공감
"불편을 드려서 정말 죄송합니다. 바로 확인하겠습니다."

### 2단계: 사실 확인
- 무슨 문제인지 정확히 파악
- 사진 요청 (시설 문제인 경우)
- 시간대, 상황 확인

### 3단계: 해결책 제시
- 즉시 해결 가능: "지금 바로 [조치]하겠습니다"
- 시간 필요: "오늘 [시간]까지 해결해드리겠습니다"
- 보상 필요: 부분 환불 또는 편의 제공

### 4단계: 이슈 등록
- 이슈 트래커에 기록
- 동일 문제 재발 방지 조치

### 보상 기준 (대표 승인 불필요)
- 소음: 사과 메시지
- 시설 경미 고장: 편의 제공 (커피, 간식)
- 심각한 문제: 1박 부분 환불 (대표 승인 필요)` },
      { key: "review", label: "리뷰 요청 타이밍", defaultContent: `## 리뷰 요청 타이밍

### 최적 타이밍
- 체크아웃 당일 오후 (만족스러운 경험 직후)
- "편히 쉬다 가셨기를 바랍니다! 혹시 저희 숙소 경험이 좋으셨다면 리뷰 한 줄 남겨주시면 큰 힘이 됩니다 🙏"

### 리뷰 요청하면 안 되는 경우
- 클레임이 있었던 경우
- 문제 발생 후 불완전하게 해결된 경우
- 게스트가 불만을 표현한 경우

### 부정 리뷰 대응
- 24시간 이내 답변 작성
- 사실 확인 + 개선 의지 표현
- 감정적 반박 금지
- 개인정보 노출 금지` },
    ],
  },
  diagnosis: {
    title: "사업 진단 매뉴얼",
    sections: [
      { key: "engines", label: "5엔진 진단 항목", defaultContent: `## 5엔진 진단 항목

### 1. 가치창출 엔진
- 입지 점수 (위치, 교통, 주변 환경)
- 방 유형 적합도 (타겟 대비)
- 가성비 점수 (가격 대비 제공 가치)
- 인테리어 점수
- 타겟 적합도

### 2. 마케팅 엔진
- 사진 퀄리티
- 채널 노출 점수
- 리스팅 완성도
- 리뷰 점수/수
- 채널별 성과

### 3. 판매 엔진
- 가동률
- 문의 전환율
- 예약 전환율
- 가격 유연성
- 장기 숙박 전환율

### 4. 운영전달 엔진
- 청소 점수
- 체크인 점수
- CS 점수
- 어메니티 점수
- 클레임률 (낮을수록 좋음)

### 5. 재무 엔진
- 월 매출
- 월세
- 관리비
- 청소비
- 플랫폼 수수료
- ADR` },
      { key: "score", label: "점수 해석 방법", defaultContent: `## 점수 해석 방법

### 점수 기준 (100점 만점)
| 구간 | 해석 | 액션 |
|------|------|------|
| 80~100 | 우수 | 유지 + 미세 조정 |
| 60~79 | 보통 | 개선 기회 있음 |
| 40~59 | 미흡 | 적극 개선 필요 |
| 0~39 | 위험 | 긴급 조치 필요 |

### 엔진별 가중치
- 가치창출: 25% (기반)
- 마케팅: 25% (노출)
- 판매: 20% (전환)
- 운영전달: 15% (유지)
- 재무: 15% (수익)

### 종합 점수
- 각 엔진의 평균 × 가중치 합산
- 손익분기 가동률과 비교하여 수익성 판단` },
      { key: "priority", label: "개선 우선순위", defaultContent: `## 개선 우선순위 결정

### 원칙
1. **돈이 새는 곳** 먼저 막는다 (재무 위험)
2. **노출이 안 되는 곳** 고친다 (마케팅)
3. **전환이 안 되는 곳** 개선한다 (판매)
4. **불만이 나오는 곳** 해결한다 (운영)

### 우선순위 매트릭스
- 영향력 높음 + 실행 쉬움 → 즉시 실행
- 영향력 높음 + 실행 어려움 → 계획 수립
- 영향력 낮음 + 실행 쉬움 → 빈 시간에 처리
- 영향력 낮음 + 실행 어려움 → 보류

### 가장 흔한 개선 포인트
1. 사진 (비용 대비 효과 최고)
2. 가격 (바로 조정 가능)
3. 리스팅 문구 (노출 직접 영향)` },
      { key: "action", label: "액션 플랜 수립", defaultContent: `## 진단 기반 액션 플랜

### 액션 플랜 작성 순서
1. 진단 결과에서 가장 낮은 점수 3개 선별
2. 각 항목별 원인 1줄 정리
3. 실행 가능한 개선안 작성
4. 담당자 + 기한 배정
5. 2주 후 재진단으로 효과 측정

### 예시
| 항목 | 현재 | 목표 | 액션 | 담당 | 기한 |
|------|------|------|------|------|------|
| 사진 점수 40 | 40 | 70 | 전문 촬영 예약 | 오재관 | 1주 |
| 가동률 26% | 26% | 50% | 가격 15% 인하 + 프로모션 | 김진우 | 즉시 |
| 리스팅 점수 45 | 45 | 70 | 채널별 문구 재작성 | 우연 | 1주 |` },
    ],
  },
  tasks: {
    title: "태스크 관리 매뉴얼",
    sections: [
      { key: "create", label: "태스크 생성 기준", defaultContent: `## 태스크 생성 기준

### 태스크로 만들어야 하는 것
- 30분 이상 소요되는 작업
- 다른 사람에게 배정해야 하는 작업
- 추적이 필요한 작업 (기한, 진행상황)
- 반복되는 정기 작업

### 태스크로 만들지 않는 것
- 5분 이내 즉시 처리 가능한 것
- 단순 확인 (조회만 하면 되는 것)
- 대화로 바로 해결되는 것

### 태스크 작성법
- 제목: [카테고리] 구체적인 행동 (예: [청소] B105 딥클리닝 실시)
- 설명: 배경, 기대 결과, 참고 사항
- 우선순위: 긴급/높음/보통/낮음
- 기한: 구체적 날짜` },
      { key: "priority", label: "우선순위 설정", defaultContent: `## 우선순위 설정

### 기준
| 우선순위 | 기준 | 기한 |
|----------|------|------|
| 긴급 | 게스트 영향, 매출 손실 | 당일 |
| 높음 | 운영 품질 영향 | 2일 이내 |
| 보통 | 개선 사항 | 1주 이내 |
| 낮음 | 정리, 최적화 | 2주 이내 |

### 우선순위 변경
- 상황 변화 시 즉시 조정
- 기한 초과 시 자동으로 우선순위 상향
- 매일 아침 우선순위 재검토` },
      { key: "status", label: "상태 관리", defaultContent: `## 태스크 상태 관리

### 상태 종류
- **todo** — 할 일 (아직 시작 안 함)
- **in_progress** — 진행 중
- **done** — 완료

### 상태 전환 규칙
- 시작할 때: todo → in_progress
- 완료할 때: in_progress → done
- 되돌릴 때: done → in_progress (재작업 필요 시)

### 일일 관리
- 매일 아침: 내 태스크 중 today 확인
- 작업 시작 시: 즉시 상태 변경
- 완료 시: 즉시 done 처리 (미루지 않기)` },
      { key: "assign", label: "팀원별 역할 배정", defaultContent: `## 팀원별 역할 배정

| 팀원 | 역할 | 주요 태스크 |
|------|------|------------|
| 김진우 | 대표/총괄 | 전략 결정, 계약, 정산 승인, 매출 분석 |
| 오재관 | 현장 운영 | 시설 점검, 현장 대응, 숙소 세팅, 사진 촬영 |
| 우연 | CS/마케팅 | 게스트 응대, 리뷰 관리, 리스팅 최적화, 콘텐츠 |
| 김진태 | 청소 | 청소 배정, 품질 관리, 비품, 청소원 관리 |
| 박수빈 | 정산 | 정산서 작성, 비용 정리, 소유자 소통 |

### 배정 원칙
1. 역할에 맞는 사람에게 배정
2. 한 사람에게 과도한 집중 지양
3. 긴급 태스크는 바로 연락 (대기 금지)
4. 불분명한 건 대표에게 문의` },
    ],
  },
};

export default function OperationManual({
  page,
  onClose,
}: {
  page: ManualPage;
  onClose: () => void;
}) {
  const config = PAGE_CONFIG[page];
  const [section, setSection] = useState(config.sections[0].key);
  const [entries, setEntries] = useState<Record<string, ManualEntry>>({});
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetchEntries();
  }, [page]);

  const fetchEntries = async () => {
    try {
      const res = await fetch(`/admin/manual?page=${page}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, ManualEntry> = {};
        (data.entries || []).forEach((e: ManualEntry) => {
          map[e.section] = e;
        });
        setEntries(map);
      }
    } catch {
      // API not available, use defaults
    }
  };

  const currentSection = config.sections.find((s) => s.key === section)!;
  const savedEntry = entries[section];
  const displayContent = savedEntry?.content || currentSection.defaultContent;
  const displayTitle = savedEntry?.title || currentSection.label;

  const startEdit = () => {
    setEditTitle(displayTitle);
    setEditContent(displayContent);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/admin/manual", {
        method: "POST",
        headers,
        body: JSON.stringify({
          page,
          section,
          title: editTitle,
          content: editContent,
        }),
      });
      if (res.ok) {
        await fetchEntries();
        setEditing(false);
      }
    } catch {
      // handle error silently
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative m-auto flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-800 leading-tight">{config.title}</h2>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-0.5">
            {config.sections.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSection(s.key); setEditing(false); }}
                className={`w-full rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                  section === s.key ? "bg-slate-900 text-white" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
                {entries[s.key] && <span className="ml-1 text-[9px] opacity-60">(수정됨)</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!editing ? (
            <div>
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{displayTitle}</h3>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  편집
                </button>
              </div>

              {/* Meta */}
              {savedEntry && (
                <p className="mb-4 text-[10px] text-gray-400">
                  마지막 수정: {savedEntry.updated_name} · {new Date(savedEntry.updated_at).toLocaleString("ko-KR")}
                </p>
              )}

              {/* Rendered Content */}
              <div className="prose prose-sm max-w-none">
                <MarkdownRenderer content={displayContent} />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Edit Header */}
              <div className="mb-3 flex items-center justify-between">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-bold text-gray-900 border-b border-gray-300 px-1 py-0.5 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="rounded-md border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                    취소
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>

              {/* Editor */}
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full rounded-md border border-gray-300 p-4 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="마크다운 형식으로 작성하세요..."
              />
              <p className="mt-2 text-[10px] text-gray-400">마크다운 형식 지원: ## 제목, **굵게**, - 목록, | 테이블 |</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Simple Markdown Renderer */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.includes("---")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={i} lines={tableLines} />);
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="mt-4 mb-2 text-sm font-semibold text-gray-800">{formatInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="mt-5 mb-2 text-base font-bold text-gray-900">{formatInline(line.slice(3))}</h3>);
    }
    // Code block
    else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="my-3 rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
    }
    // Checkbox
    else if (line.match(/^- \[[ x]\]/)) {
      const checked = line.includes("[x]");
      const text = line.replace(/^- \[[ x]\] /, "");
      elements.push(
        <div key={i} className="flex items-center gap-2 py-0.5">
          <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5" />
          <span className="text-sm text-gray-700">{formatInline(text)}</span>
        </div>
      );
    }
    // Ordered list
    else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s/, "");
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 py-0.5 pl-1">
          <span className="text-xs text-gray-400 w-4 shrink-0">{num}.</span>
          <span className="text-sm text-gray-700">{formatInline(text)}</span>
        </div>
      );
    }
    // Unordered list
    else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5 pl-1">
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-700">{formatInline(line.slice(2))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    }
    // Paragraph
    else {
      elements.push(<p key={i} className="text-sm text-gray-700 py-0.5">{formatInline(line)}</p>);
    }

    i++;
  }

  return <>{elements}</>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split("|").filter((c) => c.trim() !== "").map((c) => c.trim());

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h, i) => (
              <th key={i} className="border-b border-gray-200 px-3 py-1.5 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-xs text-gray-700">{formatInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "⟨b⟩$1⟨/b⟩")
    .replace(/`(.*?)`/g, "⟨code⟩$1⟨/code⟩");
}
