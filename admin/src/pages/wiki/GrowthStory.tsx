import { useState } from "react";

/* ── 섹션 타입 ─────────────────────────────────────────────── */

interface Section {
  label: string;
  content: string; // HTML string
}

interface Phase {
  id: string;
  period: string;
  title: string;
  summary: string;
  badge: string;
  sections: Section[];
}

/* ── 데이터 ─────────────────────────────────────────────────── */

const phases: Phase[] = [
  {
    id: "phase1",
    period: "2023.11 ~ 2024.5",
    title: "1단계: 자체 운영",
    summary: "1채 → 18채 | 3명 | 자본 없이, 몸으로, 시장이 비어있을 때 점유",
    badge: "₩500만→₩3,233만",
    sections: [
      {
        label: "사람",
        content: `<ul>
<li><b>김진우</b>: 예약, 전략, 판단 — 24시간 수동 운영</li>
<li><b>김진태</b> (동생): 셋팅, 청소, 플랫폼 등록 (판단 없이 실행)</li>
<li><b>박수빈</b> (와이프): 초기 청소, 이후 정산/데이터</li>
<li>3명이 매일 청소 3~5건 직접 수행. 최대 하루 5건이 한계.</li>
</ul>`,
      },
      {
        label: "타임라인",
        content: `<table>
<tr><td><b>23.11.24</b></td><td>첫 예약 — 삼삼엠투, 1주일, ₩24만. "돈이 된다"</td></tr>
<tr><td><b>23.12</b></td><td>5개 한번에 공급. 와이프와 이사. 학원 개강. 김지훈 합류</td></tr>
<tr><td><b>23년 매출</b></td><td>₩500만</td></tr>
<tr><td><b>24.1~4</b></td><td>월 2채씩 증가. 삼투만으로 성장. 5→15채</td></tr>
<tr><td><b>24.4</b></td><td>와이프와 깊은 대화 → "매월 모든 요소 10%씩 증가" 전략 확정<br/>1.1 × 1.1 × 1.1 = 월 33% 성장 이론</td></tr>
<tr><td><b>24.5</b></td><td>비엔비 시작. 무허가 퇴출 선언. ~18채</td></tr>
</table>`,
      },
      {
        label: "핵심 발견 1: 인벤토리 풀",
        content: `<p>예건네스빌 702호, 802호를 동시에 여러 플랫폼에 등록했다. 같은 숙소를 2명이 다른 플랫폼에서 예약했다. 다른 호실로 배정했다.</p>
<p><b>설계한 게 아니다. 운영하다가 발견한 것이다.</b></p>
<p>이것이 호텔식 룸 어사인먼트의 원점이 됐다. 개별 호스트는 방이 1~2개면 풀 자체가 불가능하다.</p>`,
      },
      {
        label: "핵심 발견 2: 빈틈 채우기",
        content: `<p>삼삼엠투/리브는 7박 예약 구조다.</p>
<ul>
<li>일요일 입실 → 토요일 퇴실 → <b>토요일 밤 1박이 빈다</b></li>
<li>수요일 입실하면 앞뒤 3일씩 날아감 → 월 가동률 75%</li>
</ul>
<p><b>해결:</b> 빈틈을 에어비앤비 단기로 채웠다.</p>`,
      },
      {
        label: "핵심 발견 3: 평일삼투 + 주말비엔비 공식",
        content: `<p>에어비앤비 요일별 가격: 토=100, 금·일=80, 월=70, 화~목=50.</p>
<p>중단기 게스트 중 평일만 이용하는 사람을 발견했다 (직접 물어봄). 1박분 환불하고 주말 2박을 에어비앤비로 판매했다.</p>
<table>
<tr><td>환불</td><td>-₩4만</td></tr>
<tr><td>비엔비 토+일</td><td>+₩18만</td></tr>
<tr><td><b>순이익</b></td><td><b>+₩14만</b></td></tr>
</table>`,
      },
      {
        label: "수익 공식",
        content: `<p><code>매출 = 숙소 × 객단가 × 가동률</code></p>
<ul>
<li><b>숙소:</b> 월 2채씩 → 5채씩 증가</li>
<li><b>객단가:</b> 시장 평균보다 낮게 (비엔비 7만→3만, 삼투 30만→25만)</li>
<li><b>가동률:</b> 평일삼투+주말비엔비로 극대화</li>
<li>"고객은 조금만 저렴해도 들어온다" → 가격으로 가동률 방어</li>
</ul>
<p><b>방 1개 기준 비교:</b></p>
<table>
<tr><td>삼투만</td><td>월 75~100만 (가동률 75%)</td></tr>
<tr><td>비엔비만</td><td>월 136만 (평일 불확실, 가동률 70%)</td></tr>
<tr><td><b>HIERO식</b></td><td><b>월 160만 (평일=삼투 확실 + 주말=비엔비 확실)</b></td></tr>
</table>`,
      },
      {
        label: "공급 확보 방법",
        content: `<ol>
<li><b>렌트-인</b>: 보증금 大 + 월세. 약 30채 보유. 자본 한계</li>
<li><b>전대(서브리스)</b>: 보증금 500만 + 월세 60만. 자본 中</li>
<li><b>무보증/선세</b>: 보증금 0 또는 3개월 선세 + 월세 70만. <b>대부분 이 방식</b></li>
<li><b>경매 낙찰</b>: 소유. 별도 맥락 (경매회사 운영 경험)</li>
</ol>
<p>셋팅비: 채당 50~100만원 (침대, 가전)</p>`,
      },
      {
        label: "1단계 한계 (병목)",
        content: `<p>24년 5월: 주말 청소 10건+ 발생. 3명(나+동생+와이프)으로 최대 5건 → <b>물리적 한계</b>.</p>
<p>숙소는 늘어나는데 청소가 안 돌아간다 = 몸으로 하는 운영의 한계.</p>
<p class="text-gray-500 italic">자본 없이, 몸으로, 시장이 비어있을 때 점유. 이건 다시 못한다. 시장은 채워졌고, 몸으로는 10~20채가 한계.</p>`,
      },
      {
        label: "데이터 (DB 기준)",
        content: `<table>
<tr><th>월</th><th>예약건수</th><th>숙소수</th><th>매출</th><th>비고</th></tr>
<tr><td>24-01</td><td>3건</td><td>1</td><td>₩456만</td><td>삼투만</td></tr>
<tr><td>24-02</td><td>7건</td><td>1</td><td>₩816만</td><td></td></tr>
<tr><td>24-03</td><td>12건</td><td>1</td><td>₩1,086만</td><td></td></tr>
<tr><td>24-04</td><td>14건</td><td>1</td><td>₩1,437만</td><td></td></tr>
<tr><td>24-05</td><td>73건</td><td>12</td><td>₩3,233만</td><td>비엔비 시작</td></tr>
</table>`,
      },
    ],
  },
  {
    id: "phase2",
    period: "2024.5 ~ 2024.12",
    title: "2단계: 조직화 + 공격적 확장",
    summary: "18채 → 50채 | 5명 체제 | 월매출 1억 → 비수기 절벽 → 성장공식 붕괴",
    badge: "₩3,233만→₩1.03억",
    sections: [
      {
        label: "외부 환경 변화 (24.5월)",
        content: `<ol>
<li><b>에어비앤비</b>: 무허가 숙소 퇴출 선언 → 강동구 경쟁자 다수 사라짐</li>
<li><b>삼삼엠투</b>: 전세사기 여파로 급성장 (연간 거래액 ₩1,880억)</li>
<li><b>HIERO</b>: 삼투 우수공급자 선정, 미팅, 상위호스트 혜택 획득</li>
</ol>`,
      },
      {
        label: "사람 (5명 체제)",
        content: `<ul>
<li><b>김진우</b>: 전략, 예약(24시간 수동), 기획, 대외 확장</li>
<li><b>김진태</b>: 셋팅 전담 (주 1채), 관리비 5종 납부</li>
<li><b>김대현</b> (6월~): 청소 시스템 구축 — 외주 아줌마팀 + 자체빨래방 + 용역계약</li>
<li><b>왕태경</b> (6월~): 비용 처리, 월세 납부, 부동산 계약 관리</li>
<li><b>박수빈</b>: 데이터 누적, 정산, 월간 3지표 브리핑 (숙소/객단가/가동률)</li>
</ul>`,
      },
      {
        label: "운영 시스템",
        content: `<ul>
<li><b>리셉션</b>: 엑셀 간트차트. 김진우가 수동 입력, 김대현이 보고 청소 배정</li>
<li><b>월간 브리핑</b>: 숙소/객단가/가동률 3지표 추적</li>
<li><b>청소</b>: 건당 ₩33,000 → 10월 용역계약 ₩500만/월 (300건 손익분기)</li>
<li><b>프로그램</b>: 비엔비 앱 + 삼투 앱 + 리셉션 엑셀 + 정산 엑셀 (Hostex 미도입)</li>
</ul>`,
      },
      {
        label: "데이터 (DB 기준)",
        content: `<table>
<tr><th>월</th><th>건수</th><th>숙소</th><th>매출</th><th>장기비율</th><th>비고</th></tr>
<tr><td>24-06</td><td>118</td><td>14</td><td>₩4,782만</td><td>51%</td><td></td></tr>
<tr><td>24-07</td><td>141</td><td>18</td><td>₩5,693만</td><td>49%</td><td></td></tr>
<tr><td>24-08</td><td>136</td><td>19</td><td>₩6,929만</td><td>62%</td><td>삼투 누적 1억 돌파</td></tr>
<tr><td>24-09</td><td>172</td><td>25</td><td>₩7,357만</td><td>58%</td><td></td></tr>
<tr><td><b>24-10</b></td><td><b>178</b></td><td><b>29</b></td><td><b>₩1.03억</b></td><td>55%</td><td><b>피크. 월매출 8천만</b></td></tr>
<tr><td>24-11</td><td>204</td><td>24</td><td>₩9,477만</td><td>50%</td><td>비수기 절벽 (-35%)</td></tr>
<tr><td>24-12</td><td>359</td><td>31</td><td>₩1.16억</td><td>44%</td><td>계엄 + 크리스마스</td></tr>
</table>`,
      },
      {
        label: "24년 10월: 마지막 불꽃",
        content: `<p>삼투 누적 1억 확인. 월매출 ₩8천만. "역시나 나는 잘해!"</p>
<ul>
<li>숙소 확 늘림 (29채)</li>
<li>외부 투자 유치</li>
<li>청소 용역계약 ₩500만/월 체결 (300건 손익분기)</li>
<li>책 기획 시작: 생산/소비/투자/분배 프레임. "김삼투" = 본인</li>
<li><b>공격 모드 진입</b></li>
</ul>`,
      },
      {
        label: "24년 11월: 성장 공식의 붕괴",
        content: `<p>10월까지 "숙소만 늘리면 된다"가 작동했다. 11월에 깨졌다.</p>
<ul>
<li>수능 → 크리스마스 전 = 소비 위축</li>
<li>비엔비 예약 급감</li>
<li>이사철 끝 → 장기 수요 소멸</li>
</ul>
<p><b>깨달음:</b></p>
<table>
<tr><td>숙소(공급)</td><td>내가 통제 가능 ✓</td></tr>
<tr><td>객단가</td><td>시장이 결정 ✗</td></tr>
<tr><td>가동률</td><td>시즌에 의존 ✗</td></tr>
</table>
<p>→ 3개 다 통제 가능하다는 전제가 틀렸다. 비용은 올라갔는데 매출이 꺾였다. 투자금과 매출을 분리하지 않아 실태를 인지 못했다. 통장에 8천만이 들어왔지만, 그 중 일부는 투자금이었다.</p>`,
      },
      {
        label: "24년 12월 3일: 계엄",
        content: `<p>외국인 수요 50% 감소. 12월 1~3주 바닥. 마지막 1주(크리스마스~신정)에 12월 매출의 35%를 집중.</p>
<p>하루 40건 청소. 화이트크리스마스를 무서워했다. 이 주에 103건 예약이 집중.</p>`,
      },
      {
        label: "24년 채널별 연간 데이터",
        content: `<table>
<tr><th>채널</th><th>건수</th><th>비율</th><th>매출</th><th>매출비율</th></tr>
<tr><td>비엔비</td><td>968건</td><td>79%</td><td>₩1.94억</td><td>46%</td></tr>
<tr><td>삼투</td><td>222건</td><td>18%</td><td>₩1.95억</td><td>46%</td></tr>
<tr><td>리브</td><td>28건</td><td>2%</td><td>₩0.26억</td><td>6%</td></tr>
<tr><td>개인</td><td>5건</td><td>0.4%</td><td>₩0.06억</td><td>-</td></tr>
</table>
<p><b>핵심:</b> 비엔비와 삼투가 매출 46%씩 정확히 반반. 건수는 비엔비 79%인데 매출은 반반 = 삼투 건당 가치가 4배 높다. 24년 개인입금 대부분 누락.</p>`,
      },
      {
        label: "시즌 패턴 (첫 해 학습)",
        content: `<table>
<tr><td><b>성수기</b></td><td>봄(3~5월) + 가을(9~10월) = 이사철+여행철</td></tr>
<tr><td><b>비수기</b></td><td>11월(수능~크리스마스 전), 2월</td></tr>
<tr><td><b>반등</b></td><td>12월 말(연말연시), 1월(신정+이사철 시작)</td></tr>
</table>
<p>→ 이 패턴은 25년에도 반복됨</p>`,
      },
    ],
  },
  {
    id: "phase3",
    period: "2025.1 ~ 2025.3",
    title: "3단계: 재정비",
    summary: "~50채 | 오재관+이학주 합류 | 바닥 → 장박 전환 → 반등",
    badge: "₩5천만→₩1.75억",
    sections: [
      {
        label: "사람",
        content: `<ul>
<li><b>오재관</b> 합류 (1월): 외부에서 운영 시스템 관찰</li>
<li><b>이학주</b> 합류 (1~3월): 진태와 숙소 셋팅 보조, 아직 적극 아님</li>
<li>운영 시스템은 여전히 수동: 김진우가 24시간 앱에서 예약 확인 → 리셉션 엑셀 입력 → 김대현이 청소 배정</li>
</ul>`,
      },
      {
        label: "데이터",
        content: `<table>
<tr><th>월</th><th>건수</th><th>숙소(DB)</th><th>매출</th><th>채널비율</th></tr>
<tr><td>25-01</td><td>484</td><td>61 (부풀림)</td><td>₩1.30억</td><td>비엔비40% + 삼투37% + 개인20%</td></tr>
<tr><td><b>25-02</b></td><td><b>300</b></td><td>58</td><td><b>₩1.24억</b></td><td><b>삼투 55%!</b> 비엔비 34%</td></tr>
<tr><td>25-03</td><td>473</td><td>68</td><td>₩1.75억</td><td>개인입금 88건 폭발</td></tr>
</table>
<p class="text-gray-500">(실제 운영 숙소는 ~50채. DB는 Hostex 소급입력+임포트로 부풀려짐)</p>`,
      },
      {
        label: "2월: 바닥",
        content: `<p>기억 기준 매출 ₩5천만. 비엔비가 완전히 빠짐.</p>
<p><b>대응: "비엔비 다 빼고, 가격 낮춰서 장박으로 다 팔아라"</b></p>
<p>DB에서 삼투가 55%로 1위 = 이 전략의 결과.</p>
<p class="text-gray-500 italic">비수기 대응: 단기 포기 → 전부 장기 전환 = 유효한 전략이었다.</p>`,
      },
      {
        label: "3월: 반등",
        content: `<p>이사철 시작 + 개인입금 급증 (17건→88건).</p>
<p>비엔비 복귀 + 삼투 유지 + 개인 폭발 = 월매출 ₩1.75억(DB).</p>
<p><b>개인입금 채널이 의외로 크다</b> → 자체 채널 가능성의 첫 신호.</p>`,
      },
    ],
  },
  {
    id: "reset",
    period: "2025.4 ~ 2025.6",
    title: "리셋: 사건 → 체제 전환",
    summary: "~50채 | 김진우 OUT → Hostex 도입 → 이학주+왕태경 체제",
    badge: "₩1억(동시리셋)",
    sections: [
      {
        label: "4월 1일: 사건",
        content: `<p>국회의원 장재원이 HIERO 숙소 1801호에서 자살.</p>
<p><b>월매출 1억 달성한 바로 그 시점.</b></p>
<p>김진우 실무에서 빠짐. 한 달간 스트레스.</p>`,
      },
      {
        label: "5월: Hostex 도입 — 생존 선택",
        content: `<p>김진우가 빠지면 예약확인→리셉션→청소배정 전체가 멈춤.</p>
<p><b>기술 선택이 아니라 생존 선택.</b></p>
<ul>
<li>25년 1~4월 과거 데이터 소급 입력 (전체 채널)</li>
<li>이 시점부터 hiero-workflow 시스템 개발 시작</li>
</ul>`,
      },
      {
        label: "6월: 체제 전환",
        content: `<ul>
<li><b>IN:</b> 이학주 본격 투입 (현장 운영 총괄), 왕태경 본격 투입 (재무)</li>
<li><b>OUT:</b> 김대현 빠짐 → 청소 시스템 완전 재구축 필요</li>
<li><b>김진우:</b> 실무 빠짐 → 전략/기획만</li>
</ul>
<p class="text-gray-500 italic">김진우가 빠지면 전체가 멈추는 구조 = 지속 불가능하다는 것을 증명한 사건이었다.</p>`,
      },
    ],
  },
  {
    id: "phase4",
    period: "2025.6 ~ 2026.1",
    title: "4단계: 재시작 → 90채",
    summary: "50채 → 90채 | 이학주 체제 | 100채 벽. 자체 고객 0명.",
    badge: "100채 벽",
    sections: [
      {
        label: "체제",
        content: `<ul>
<li><b>이학주</b>: 현장 운영 총괄 (김진우의 역할 대체)</li>
<li><b>왕태경</b>: 재무/비용/부동산 계약 관리</li>
<li><b>박수빈</b>: 정산/데이터</li>
<li><b>김진우</b>: 전략/기획 (일선에서 빠짐)</li>
</ul>`,
      },
      {
        label: "성장과 한계",
        content: `<ul>
<li>50채 → 90채까지 확장 (7개월간 40채 증가)</li>
<li>하지만 <b>100채 벽을 넘지 못함</b></li>
<li>공실 증가: 50개 중 20개만 예약 (비엔비 기준, 주말만 참)</li>
<li>숙소 품질: 경쟁 대비 부족 — 최소한의 셋팅, 사진만 맞으면 된다는 수준</li>
<li><b>자체 고객 획득: 0명</b> — 9,329건 전부 남의 플랫폼</li>
</ul>`,
      },
      {
        label: "시스템 전환",
        content: `<ul>
<li>수동 리셉션 → Hostex 캘린더</li>
<li>수동 청소배정 → 반자동화</li>
<li>수동 정산 → 채널별 데이터 수집 가능</li>
<li>hiero-workflow 시스템 본격 개발 (Go + React + MySQL)</li>
</ul>`,
      },
      {
        label: "왜 100채를 못 넘기는가",
        content: `<p>숙소를 늘려도 <b>"왜 여기에 오는가"</b>가 없으면 한계.</p>
<ul>
<li>고객을 직접 만난 적이 없다 (9,329건 전부 남의 플랫폼)</li>
<li>고객에게 특별한 가치를 줄 필요가 없었다 (가격+물량으로 성장)</li>
<li>성장 공식이 공급자 중심이었다 (숙소만 늘리면 됨)</li>
<li>남의 플랫폼 위에서만 운영하는 구조의 천장</li>
</ul>`,
      },
    ],
  },
  {
    id: "phase5",
    period: "2026.2 ~ 현재",
    title: "5단계: 어반브릿지 — 새 팀, 새 방향",
    summary: "~90채 | 변유진+이예린+김지훈 합류 | 예창패+Odyssey-X 제출",
    badge: "₩1.28억/마진33.5%",
    sections: [
      {
        label: "배경",
        content: `<ul>
<li><b>김진우</b> = 서울시립대 도시공학과 교수 (박사수료)</li>
<li><b>변유진</b>, <b>이예린</b> = 학생 (작년부터 알았지만 올해 관계 깊어짐)</li>
<li>조직명: <b>어반브릿지</b> (Urban Bridge)</li>
<li>주차별 자료: Google Drive/어반브릿지/00 히로 주차별 자료/</li>
</ul>`,
      },
      {
        label: "0219 — 진짜 첫 회의 (2026.02.19)",
        content: `<p><b>참석:</b> 김진우, 변유진, 이예린, 박수빈</p>
<p><b>사전 준비자료: 0건.</b> 변유진만 블루그라운드/홈즈컴퍼니 개인 조사해옴.</p>
<p><b>김진우 핵심 발언 (육성):</b></p>
<ul>
<li>"3~4년 비빌 언덕 만들어놨으니 뭘 좀 해보자"</li>
<li>"6개월 안에 200채. 막연하지."</li>
<li>"200채까지는 영업하면 되는데 그 다음은?"</li>
<li>"가만히 있어도 돌아가게 만들려면?"</li>
<li>"타겟도 모르겠고 아무것도 모르겠어"</li>
<li>"돈으로 만들어내는 고객이냐 정성으로 만들어낸 고객이냐 모르겠다"</li>
<li><b>"내가 일 안 하는 게 목표"</b></li>
</ul>
<p><b>팀원 반응:</b></p>
<ul>
<li><b>변유진:</b> "블루그라운드 BM + 홈즈컴퍼니 브랜딩, 두 개를 보고 왔다. 홈즈 지수처럼 동네 교통/생활편의를 수치화하면 우리가 잘할 수 있다. 제안서처럼 보여줄 수 있는 브리핑 자료를 만들어 볼까"</li>
<li><b>이예린:</b> "풍납동처럼 캐시플로우를 만들어주는 게 진짜 공공성" (이후 김진우에게 질타당하고 침묵)</li>
<li><b>박수빈:</b> "사기꾼처럼 얘기좀 하지 마라"</li>
</ul>
<p><b>한계:</b> 질문만 있고 답/결정이 한 번도 없었음. 방향 7개가 동시에 나옴 (영업/NPL/도시재생/GIS/예술가/홈페이지/컨설팅).</p>`,
      },
      {
        label: "0225 — 두 번째 회의 (4시간)",
        content: `<p><b>핵심 논의:</b></p>
<ul>
<li>"6세대 부동산: 복덕방→지면→온라인→모바일→비대면→<b>???</b>"</li>
<li>"이 싸움은 IT개발자 싸움이 아니라 전국 부동산 집주인과의 싸움"</li>
<li>"시리즈A 100억은 못 그리겠고, 30억까지는 벼볼 수 있다"</li>
<li>인벤토리 풀 실시간 사례: 38만원짜리를 4만원에 팔았다가 15만원×6박으로 90만원</li>
<li>"아무리 이빨을 턴다 하더라도 실행 안 되면 의미 없다"</li>
<li>이번 달 30개 늘려야 하는데 5개밖에 못 늘림</li>
<li>300채까지는 운영팀 2명으로 가능하다</li>
</ul>
<p><b>정의된 5축:</b></p>
<ol>
<li>코어 비즈니스: 운영/공실 관리 플랫폼</li>
<li>시장/정책 구조: NPL/PF 부실채권, 월세화, 전세사기</li>
<li>공공성/도시재생: "결과이지 출발점이 아님"</li>
<li>데이터/지수: 홈즈 지수, GIS, 동네 스코어</li>
<li>파트너십/조직: 6개월 200실 마일스톤, 중개사=핵심 파트너</li>
</ol>`,
      },
      {
        label: "3월: 답은 이미 나와 있었다",
        content: `<p>1차 회의 이후, 팀원 각자가 산출물을 만들었다. <b>하지만 방향을 정하지 않았기 때문에 4명이 4개 방향으로 갔다.</b></p>
<table>
<tr><th>작성자</th><th>자료명</th><th>방향</th></tr>
<tr><td><b>변유진</b></td><td>문제점 분석 / SOM-SAM-TAM / 건물주 제안서</td><td>시장 분석 + 영업 (가장 실행에 가까움)</td></tr>
<tr><td><b>박수빈</b></td><td>부동산 6세대 주거 구독형</td><td><b>6세대 = 구독형 미드텀.</b> OAI(동적가격+비대면+자동수리). TAM 20조. 민법 653조. IR덱 수준</td></tr>
<tr><td><b>김진우</b></td><td>주거이동의 자유</td><td>6세대 = "이사 없이 동네를 바꿀 수 있는가?" 단기수요 58.4% vs 단기매물 1.2%</td></tr>
<tr><td><b>이예린</b></td><td>아트스테이 / 갤러리K</td><td>숙박×원화 렌탈 구독. <b>HIERO와 별개 사업</b></td></tr>
<tr><td><b>공동</b></td><td>비아파트 주거의 OS</td><td><b>서울 동네 연합 OS.</b> HIERO 브랜드(Nexus연남/Mecca성수/Sanctuary강동). Series A 50억. 가장 완성된 IR덱</td></tr>
</table>
<p class="mt-2"><b>핵심 발견:</b></p>
<ul>
<li>"6세대 부동산이 뭔데?" → 박수빈이 "구독형 미드텀"으로 정의 (3월)</li>
<li>김진우도 "이동의 자유"로 같은 결론에 도달</li>
<li>"비아파트 주거의 OS"가 통합 버전이었어야 함</li>
<li><b>답이 없었던 게 아니라, 답을 내놓고 결정을 안 한 것</b></li>
</ul>`,
      },
      {
        label: "4월: 드디어 실행",
        content: `<table>
<tr><th>실행</th><th>내용</th><th>상태</th></tr>
<tr><td><b>예비창업패키지</b></td><td>HIERO 사업계획서. 실제 운영 데이터(매출 1.28억, 지출 8,549만, 순이익 4,299만, 마진 33.5%) 포함. 팀: 김진우(공동대표)+박수빈(운영)+변유진(기획)+이예린(마케팅)+김지훈(사업화)</td><td>제출</td></tr>
<tr><td><b>Odyssey-X (변유진)</b></td><td>MORO — "빌라 골목을 살고 싶은 동네로". 3-Layer 스코어(포기불가/골목바이브/외부연결). Bubble MVP. 강동구 3개 동네 바이브길 지도 목업</td><td>지원</td></tr>
<tr><td><b>Odyssey-X (이예린)</b></td><td>OLH (Open Letter House) — 원남동 옛 우체국 체류형 아트스테이. <b>공간 계약 완료(연 1,588만원).</b> Webflow MVP. HIERO와 별개 독립 사업</td><td>지원</td></tr>
<tr><td><b>서울시립대 특강</b></td><td>"도시계획 = 공간 + 운영 OS 설계". 31슬라이드 90분. 4막(OS관찰→도시구조→HIERO디테일→나의OS설계)</td><td>실행</td></tr>
<tr><td><b>공공자산 신청</b></td><td>강동구 유휴사무공간. 사업 운영 거점 확보</td><td>신청</td></tr>
</table>`,
      },
      {
        label: "3개월째 같은 질문 — 하지만 이제 답이 있다",
        content: `<table>
<tr><th>0219 (1차 회의)</th><th>0511 (현재)</th><th>변화</th></tr>
<tr><td>"타겟 모르겠다"</td><td>"왜 여기에 예약하느냐"</td><td>질문은 같음</td></tr>
<tr><td>"200채까지는 되는데 그 다음은?"</td><td>100채 벽</td><td>질문은 같음</td></tr>
<tr><td>"6세대가 뭔데?"</td><td><b>박수빈이 "구독형 미드텀"으로 답함 (3월)</b></td><td>답이 나옴</td></tr>
<tr><td>"동네 지수/GIS 하겠다"</td><td><b>변유진이 MORO MVP로 구현 중 (4월)</b></td><td>실행 중</td></tr>
<tr><td>"내가 일 안 하면 멈추는 구조"</td><td><b>hiero-workflow OS 개발 중</b></td><td>시스템화 중</td></tr>
</table>
<p class="mt-2"><b>차이:</b> 0219에는 질문만 있었다. 0511에는 답이 있다. <b>결정만 하면 된다.</b></p>`,
      },
    ],
  },
];

/* ── 고객 데이터 섹션 ─────────────────────────────────────── */

const customerData: Section[] = [
  {
    label: "시장 구조 (전체 9,329건)",
    content: `<table>
<tr><th>구분</th><th>건수</th><th>비율</th><th>매출</th><th>매출비율</th><th>숙박일</th><th>일비율</th></tr>
<tr><td>단기 (OTA+개인단기)</td><td>8,037건</td><td>86%</td><td>₩12.3억</td><td>52%</td><td>13,988일</td><td>38%</td></tr>
<tr><td><b>중단기 (플랫폼+개인중단기)</b></td><td><b>1,292건</b></td><td><b>14%</b></td><td><b>₩11.3억</b></td><td><b>48%</b></td><td><b>22,568일</b></td><td><b>62%</b></td></tr>
</table>
<p><b>중단기 1건 = 단기 6건 가치. 14%의 건수로 매출 48%, 숙박일 62%.</b></p>`,
  },
  {
    label: "고객 DB",
    content: `<table>
<tr><td>고유 고객</td><td><b>7,071명</b></td></tr>
<tr><td>전화번호 보유</td><td>4,798명</td></tr>
<tr><td><b>S등급</b> (연락처+재방문/중단기)</td><td><b>1,010명</b> → 런칭 즉시 전환 타겟</td></tr>
<tr><td>A등급 (연락처+내국인 1회)</td><td>3,350명 → 마케팅 발송 가능</td></tr>
</table>`,
  },
  {
    label: "에어비앤비 내국인 vs 외국인",
    content: `<table>
<tr><th></th><th>건수</th><th>비율</th><th>평균 숙박</th><th>특이사항</th></tr>
<tr><td>내국인</td><td>5,949건</td><td>83%</td><td>1.5박</td><td>80%가 1박</td></tr>
<tr><td>외국인</td><td>1,182건</td><td>17%</td><td>3.1박</td><td>7박+ 114건</td></tr>
</table>`,
  },
];

/* ── 인벤토리 풀 섹션 ─────────────────────────────────────── */

const inventoryPool: Section[] = [
  {
    label: "호텔식 룸 어사인먼트 — 작동 방식",
    content: `<ol>
<li>A방에 에어비앤비 1박 예약이 들어옴</li>
<li>A방에 삼삼엠투 30박 장기가 들어옴</li>
<li>에어비앤비 게스트를 B방으로 변경</li>
<li>게스트는 모름 (동급 이상 보장)</li>
<li><b>A방 30박 매출 + B방 1박 매출 = 전체 최적화</b></li>
</ol>
<p>개별 호스트는 이게 불가능하다. 방이 1~2개면 풀 자체가 안 된다. 청소/체크인 재배치도 운영 OS 없이 불가능하다.</p>`,
  },
  {
    label: "경쟁사 차이",
    content: `<table>
<tr><td><b>삼삼엠투</b></td><td>"A방을 30일" 매칭 — 여기서 끝</td></tr>
<tr><td><b>HIERO</b></td><td>"30일 수요가 오면 방을 재배치해서 <b>전체 매출을 최적화</b>"</td></tr>
</table>`,
  },
];

/* ── 메인 컴포넌트 ─────────────────────────────────────────── */

function SectionBlock({ section }: { section: Section }) {
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-gray-800 mb-2 border-l-2 border-blue-400 pl-2">
        {section.label}
      </div>
      <div
        className="text-sm text-gray-700 prose prose-sm max-w-none
          [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
          [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:border [&_th]:border-gray-200
          [&_td]:px-3 [&_td]:py-1.5 [&_td]:border [&_td]:border-gray-200
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
          [&_p]:mb-2 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    </div>
  );
}

function CollapsibleBlock({
  title,
  sections,
  defaultOpen = false,
}: {
  title: string;
  sections: Section[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-2"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs text-gray-400">{open ? "▼" : "▶"}</span>
        <span className="text-base font-bold text-gray-900">{title}</span>
      </button>
      {open && (
        <div className="border-t px-4 pb-4">
          {sections.map((s, i) => (
            <SectionBlock key={i} section={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GrowthStory() {
  const [openPhase, setOpenPhase] = useState<string | null>("phase5");

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HIERO 성장 스토리</h1>
        <p className="mt-1 text-sm text-gray-500">
          2023.11 첫 예약 ₩24만 → 2026.5 90채 운영, 월매출 1.28억
        </p>
        <p className="mt-1 text-xs text-gray-400">
          CEO 증언 + DB 데이터 + Google Drive 회의자료 통합 정리 | 마지막
          업데이트: 2026-05-11
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "운영 숙소", value: "90채", sub: "100채 벽" },
          { label: "총 예약", value: "9,329건", sub: "23.11~현재" },
          { label: "고유 고객", value: "7,071명", sub: "S등급 1,010명" },
          { label: "월매출(최근)", value: "₩1.28억", sub: "마진 33.5%" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-sm font-medium text-gray-600">{c.label}</div>
            <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* 핵심 질문 배너 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="text-sm font-semibold text-amber-800">지금 풀어야 할 질문</div>
        <div className="text-lg font-bold text-amber-900 mt-1">
          "고객이 왜 우리를 선택하는가?"
        </div>
        <div className="text-sm text-amber-700 mt-2">
          2년간 "어떻게 돌리는가"는 완벽히 알게 됐다. "왜 여기에 오는가"는 한 번도
          답하지 않았다. 100채 벽을 넘기 위해서는 이 질문에 답해야 한다.
        </div>
        <div className="mt-3 text-sm text-amber-800">
          <b>이미 나온 답 후보:</b>
          <ol className="list-decimal pl-5 mt-1 space-y-1">
            <li><b>6세대 = 구독형 미드텀</b> (박수빈) — "이사 없이 동네를 바꿀 수 있는가"</li>
            <li><b>서울 동네 연합 OS</b> (IR덱) — "빌라 SaaS가 아니라 동네를 엮는 OS"</li>
            <li><b>MORO Score Stack</b> (변유진) — "집이 아니라 집 밖 10분의 생활권"</li>
          </ol>
        </div>
      </div>

      {/* 매년 5월 변곡점 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="text-sm font-semibold text-blue-800 mb-2">매년 5월의 변곡점</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="font-bold text-blue-900">24년 5월</div>
            <div className="text-blue-700">시장 진입</div>
            <div className="text-xs text-blue-500">비엔비 시작, 공격적 확장</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-blue-900">25년 5월</div>
            <div className="text-blue-700">리셋</div>
            <div className="text-xs text-blue-500">사건 후 재구축, Hostex 도입</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-blue-900">26년 5월</div>
            <div className="text-blue-700">정체성 찾기</div>
            <div className="text-xs text-blue-500">"왜 여기에 예약하느냐"</div>
          </div>
        </div>
      </div>

      {/* 성장 타임라인 */}
      <h2 className="text-lg font-bold text-gray-900 mb-3">성장 타임라인</h2>
      <div className="space-y-3 mb-8">
        {phases.map((phase) => {
          const isOpen = openPhase === phase.id;
          return (
            <div key={phase.id} className="bg-white rounded-lg border overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                onClick={() => setOpenPhase(isOpen ? null : phase.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{phase.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{phase.badge}</span>
                      <span className="text-xs text-gray-400">{isOpen ? "▼" : "▶"}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{phase.period}</div>
                    <div className="text-sm text-gray-600 mt-1">{phase.summary}</div>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t px-4 pb-4">
                  {phase.sections.map((s, i) => (
                    <SectionBlock key={i} section={s} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 인벤토리 풀 */}
      <CollapsibleBlock
        title="인벤토리 풀: HIERO의 핵심 경쟁력"
        sections={inventoryPool}
      />

      {/* 고객 데이터 */}
      <div className="mt-3">
        <CollapsibleBlock
          title="고객 데이터 분석 (전체 9,329건)"
          sections={customerData}
        />
      </div>

      {/* 자료 위치 */}
      <div className="mt-8 bg-gray-50 rounded-lg border p-4 mb-8">
        <div className="text-sm font-semibold text-gray-700 mb-3">자료 위치</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
          <div><span className="font-medium">회의 녹음/텍스트:</span> Google Drive &gt; 어반브릿지/00 히로/00 회의록/</div>
          <div><span className="font-medium">주차별 산출물:</span> Google Drive &gt; 00 히로 주차별 자료/</div>
          <div><span className="font-medium">제안서/IR덱:</span> Google Drive &gt; 01 회의자료/03 March/</div>
          <div><span className="font-medium">사업계획서:</span> Google Drive &gt; 02 사업계획서/</div>
          <div><span className="font-medium">운영 데이터:</span> hiero-workflow DB (MySQL)</div>
          <div><span className="font-medium">성장기록 원본:</span> docs/HIERO_성장기록_2023-2025.md</div>
        </div>
      </div>
    </div>
  );
}
