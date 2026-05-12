import { useState, useMemo, useRef, useEffect } from "react";

// ============================================================
// 타입 정의
// ============================================================
type RoomType = "1룸" | "2룸" | "3룸";
type SalesActivity = "활발" | "보통" | "부진";

// 우리 숙소 HIERO 내부 상태
type HieroStatus = "계약중" | "공실" | "정비중";
// 삼삼엠투에서 보이는 상태
type SamsamStatus = "즉시입주" | "계약중" | "미등록";

interface MarketListing {
  id: string;
  name: string;
  dong: string;
  roomType: RoomType;
  salesActivity: SalesActivity; // 비교군: 크롤링 판매활성도
  price: number;
  maintenance: number;
  cleaningFee: number;
  deposit: number;
  distance: string;
  availableDate: string; // 비교군: 크롤링 입주/공실 정보
  isOurs: boolean;
  // ── 우리 숙소 전용 ──
  hieroStatus?: HieroStatus;       // HIERO DB 상태
  hieroDetail?: string;            // "6/20까지 계약" / "D+7 공실"
  samsamStatus?: SamsamStatus;     // 삼투에서 보이는 상태
  samsamDetail?: string;           // "즉시입주로 게시중" / "미등록"
  mismatch?: boolean;              // HIERO↔삼투 상태 불일치
  recommendedPrice?: number;
  changePercent?: number;
  reason?: string;
  vacantDays?: number;
  breakeven?: number;
}

interface DongData {
  name: string;
  lat: number;
  lng: number;
  listings: MarketListing[];
}

interface DistrictData {
  name: string;
  lat: number;
  lng: number;
  dongs: DongData[];
}

// ============================================================
// 더미 데이터 — 우리 숙소 = 실제 HIERO 권역/건물명
// ============================================================
const DUMMY: DistrictData[] = [
  {
    name: "강동구",
    lat: 37.5301, lng: 127.1238,
    dongs: [
      {
        name: "천호동",
        lat: 37.5387, lng: 127.1235,
        listings: [
          // ── 우리 숙소 (HIERO — 권역 A: 예건, 1룸 8개 + 2룸 1개) ──
          { id: "h-A22", name: "예건 202", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 300000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "천호역 3분", availableDate: "5/20 입주예정", isOurs: true, hieroStatus: "계약중", hieroDetail: "5/20 입주예정", samsamStatus: "계약중", samsamDetail: "계약 완료 표시", recommendedPrice: 310000, changePercent: 3.3, reason: "역세권 프리미엄 미반영, 인상 여지", vacantDays: 0, breakeven: 200000 },
          { id: "h-A44", name: "예건 404", dong: "천호동", roomType: "1룸", salesActivity: "보통", price: 310000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "천호역 3분", availableDate: "6/10까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/10까지 계약", samsamStatus: "계약중", samsamDetail: "6/10까지 계약", recommendedPrice: 310000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 200000 },
          { id: "h-A62", name: "예건 602", dong: "천호동", roomType: "1룸", salesActivity: "부진", price: 330000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "천호역 3분", availableDate: "5일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+5 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 300000, changePercent: -9.1, reason: "천호동 1룸 '활발' 중위 30만 대비 높음", vacantDays: 5, breakeven: 200000 },
          { id: "h-A82", name: "예건 802", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "천호역 3분", availableDate: "즉시입주", isOurs: true, hieroStatus: "계약중", hieroDetail: "에어비앤비 체크인 5/18", samsamStatus: "즉시입주", samsamDetail: "삼투에 아직 올라가 있음", mismatch: true, recommendedPrice: 300000, changePercent: 3.4, reason: "저평가, 인상 여지", vacantDays: 0, breakeven: 200000 },
          { id: "h-A33", name: "예건 303", dong: "천호동", roomType: "2룸", salesActivity: "보통", price: 420000, maintenance: 35000, cleaningFee: 55000, deposit: 300000, distance: "천호역 3분", availableDate: "6/15까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/15까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 420000, changePercent: 0, reason: "유일한 2룸, 적정가", vacantDays: 0, breakeven: 280000 },
          // ── 비교군 (삼삼엠투 크롤링 천호동 20개, 2026-05-12) ──
          { id: "s-천001", name: "굽은다리역2분 홈플2 강동구 천호동의 오피스텔 굽은다리역2분 홈플2", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 440000, maintenance: 90000, cleaningFee: 0, deposit: 0, distance: "굽은다리역 2분", availableDate: "즉시입주 (15만원 할인)", isOurs: false },
          { id: "s-천002", name: "한강의 노을과 야경을 강동구 천호동의 아파트 한강의 노을과 야경을", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 300000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-천003", name: "토브스테이_천호역 1분 강동구 천호동의 단독주택 토브스테이_천호역 1분", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 390000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "토브스테이_천호역 1분", availableDate: "게시중", isOurs: false },
          { id: "s-천004", name: "천호역강동역잠실역 강동구 천호동의 오피스텔 천호역강동역잠실역", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 395000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천005", name: "초역세권 복층오피스텔 강동구 천호동의 오피스텔 초역세권 복층오피스텔", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 470000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천006", name: "천호역강동역잠실역 강동구 천호동의 오피스텔 천호역강동역잠실역", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 415000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천007", name: "천호역 오피스텔 강동구 천호동의 오피스텔 천호역 오피스텔", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천008", name: "주차 힐링스테이 강동구 천호동의 오피스텔 주차 힐링스테이", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 320000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-천009", name: "천호역 고층 야경뷰 강동구 천호동의 오피스텔 천호역 고층 야경뷰", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 450000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-천010", name: "천호 오피스텔 감성원룸 강동구 천호동의 오피스텔 천호 오피스텔 감성원룸", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 400000, maintenance: 60000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천011", name: "천호암사 4층투룸 공실 강동구 천호동의 연립빌라 천호암사 4층투룸 공실", dong: "천호동", roomType: "2룸", salesActivity: "활발", price: 360000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-천012", name: "천호암사 3층투룸 공실 강동구 천호동의 연립빌라 천호암사 3층투룸 공실", dong: "천호동", roomType: "2룸", salesActivity: "활발", price: 370000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-천013", name: "잠실역천호역강동역 강동구 천호동의 오피스텔 잠실역천호역강동역", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 240000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천014", name: "천호,강동역 스카이뷰 강동구 천호동의 오피스텔 천호,강동역 스카이뷰", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 490000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-천015", name: "천호역2분 아산병원 강동구 천호동의 오피스텔 천호역2분 아산병원", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 367000, maintenance: 60000, cleaningFee: 0, deposit: 0, distance: "천호역 2분", availableDate: "게시중", isOurs: false },
          { id: "s-천016", name: "천호역3분 마음편한집 강동구 천호동의 오피스텔 천호역3분 마음편한집", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 360000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "천호역 3분", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-천017", name: "넓은오피스텔강동역2분 강동구 천호동의 오피스텔 넓은오피스텔강동역2분", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 350000, maintenance: 110000, cleaningFee: 0, deposit: 0, distance: "강동역 2분", availableDate: "게시중", isOurs: false },
          { id: "s-천018", name: "명일역 신축 오피스텔h 강동구 천호동의 오피스텔 명일역 신축 오피스텔h", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 340000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-천019", name: "한강뷰역세권아산병원 강동구 천호동의 오피스텔 한강뷰역세권아산병원", dong: "천호동", roomType: "1룸", salesActivity: "활발", price: 450000, maintenance: 65000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-천020", name: "천호공원근처 깔끔한 집 강동구 천호동의 상가주택 천호공원근처 깔끔한 집", dong: "천호동", roomType: "2룸", salesActivity: "활발", price: 350000, maintenance: 0, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
        ],
      },
      {
        name: "길동",
        lat: 37.5336, lng: 127.1423,
        listings: [
          // ── 우리 숙소 (A2: 더하임 1룸14+1.5룸5, B: 은성1룸, C: 청광1차 1룸) ──
          { id: "h-A2-1001", name: "더하임 1001", dong: "길동", roomType: "1룸", salesActivity: "보통", price: 310000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "길동역 8분", availableDate: "6/5까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/5까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 310000, changePercent: 0, reason: "안정 회전, 적정가", vacantDays: 0, breakeven: 210000 },
          { id: "h-A2-1005", name: "더하임 1005", dong: "길동", roomType: "1룸", salesActivity: "부진", price: 340000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "길동역 8분", availableDate: "3일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+3 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 310000, changePercent: -8.8, reason: "길동 1룸 '활발' 중위 30만 대비 높음", vacantDays: 3, breakeven: 210000 },
          { id: "h-A2-306", name: "더하임 306", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 320000, maintenance: 30000, cleaningFee: 48000, deposit: 200000, distance: "길동역 8분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+1 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 320000, changePercent: 0, reason: "1.5룸(복층), 적정가", vacantDays: 0, breakeven: 220000 },
          { id: "h-B101", name: "은성 603", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 25000, cleaningFee: 40000, deposit: 150000, distance: "길동역 6분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+0 오늘 퇴실", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 300000, changePercent: 3.4, reason: "저평가, 인상 여지", vacantDays: 0, breakeven: 200000 },
          { id: "h-C6", name: "청광1차 1303", dong: "길동", roomType: "1룸", salesActivity: "보통", price: 300000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "길동역 5분", availableDate: "6/20까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/20까지 계약", samsamStatus: "미등록", samsamDetail: "삼투에 미등록", mismatch: true, recommendedPrice: 300000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 210000 },
          // ── 비교군 (삼삼엠투 크롤링 길동 20개, 2026-05-12) ──
          { id: "s-길001", name: "❷ 보라매역 도보 3분 영등포구 신길동의 원룸건물 ❷ 보라매역 도보 3분", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 190000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길002", name: "④보라매역 도보 3분 영등포구 신길동의 원룸건물 ④보라매역 도보 3분", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 200000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길003", name: "❶보라매역 도보 3분 영등포구 신길동의 원룸건물 ❶보라매역 도보 3분", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 150000, maintenance: 20000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길004", name: "⑤보라매역 도보 3분 영등포구 신길동의 원룸건물 ⑤보라매역 도보 3분", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 180000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길005", name: "보라매역 도보3분 원룸 영등포구 신길동의 원룸건물 보라매역 도보3분 원룸", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 200000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길006", name: "굽은다리역2분 홈플2 강동구 천호동의 오피스텔 굽은다리역2분 홈플2", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 440000, maintenance: 90000, cleaningFee: 0, deposit: 0, distance: "굽은다리역 2분", availableDate: "즉시입주 (15만원 할인)", isOurs: false },
          { id: "s-길007", name: "강동역 강동성심병원16 강동구 길동의 오피스텔 강동역 강동성심병원16", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 300000, maintenance: 40000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-길008", name: "검단사거리역왕길동원룸 서구 왕길동의 오피스텔 검단사거리역왕길동원룸", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 200000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길009", name: "부천아파트정원뷰(방3) 부천시 소사구 옥길동의 아파트 부천아파트정원뷰(방", dong: "길동", roomType: "3룸", salesActivity: "활발", price: 445000, maintenance: 85000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길010", name: "호텔같은 집  강동구 길동의 오피스텔  호텔같은 집", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 450000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-길011", name: "천호역 오피스텔 강동구 천호동의 오피스텔 천호역 오피스텔", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길012", name: "운산재 202호 강동구 길동의 원룸건물 운산재 202호", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 240000, maintenance: 40000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길013", name: "초역세권 감성 풀옵션 영등포구 신길동의 단독주택 초역세권 감성 풀옵션", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길014", name: "천호역둔촌역사이원룸 강동구 길동의 오피스텔 천호역둔촌역사이원룸", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 240000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-길015", name: "반려동물 주차되는 큰방 영등포구 신길동의 단독주택 반려동물 주차되는 큰방", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 230000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길016", name: "별똥별하우스 왕길동 서구 왕길동의 오피스텔 별똥별하우스 왕길동", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 200000, maintenance: 40000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길017", name: "신길여의도 감성하우스 영등포구 신길동의 원룸건물 신길여의도 감성하우스", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 180000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-길018", name: "신풍,보라매역세권풀옵 영등포구 신길동의 연립빌라 신풍,보라매역세권풀옵", dong: "길동", roomType: "2룸", salesActivity: "활발", price: 500000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-길019", name: "주차 힐링스테이 강동구 천호동의 오피스텔 주차 힐링스테이", dong: "길동", roomType: "1룸", salesActivity: "활발", price: 320000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-길020", name: "영등포역세권풀옵션단독 영등포구 신길동의 단독주택 영등포역세권풀옵션단독", dong: "길동", roomType: "2룸", salesActivity: "활발", price: 430000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
        ],
      },
      {
        name: "둔촌동",
        lat: 37.5248, lng: 127.1375,
        listings: [
          // ── 우리 숙소 (F: 한양립스 1룸, 오앤 1룸, 태상 2룸) ──
          { id: "h-F1", name: "한양립스 503", dong: "둔촌동", roomType: "1룸", salesActivity: "보통", price: 310000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "둔촌역 5분", availableDate: "6/15까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/15까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 310000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 210000 },
          { id: "h-F2", name: "오앤 401", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 300000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "둔촌역 3분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+1", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 300000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 200000 },
          { id: "h-F3", name: "태상 501", dong: "둔촌동", roomType: "2룸", salesActivity: "보통", price: 400000, maintenance: 35000, cleaningFee: 55000, deposit: 300000, distance: "둔촌역 4분", availableDate: "6/25까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/25까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 400000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 270000 },
          // ── 비교군 (삼삼엠투 크롤링 둔촌동 20개, 2026-05-12) ──
          { id: "s-둔001", name: "올림픽공원 넓은2룸주차 강동구 성내동의 연립빌라", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 629000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔002", name: "송파잠실천호둔촌역 강동구 성내동의 연립빌라", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 260000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔003", name: "잠실,강동,아산병원3룸 강동구 성내동의 아파트", dong: "둔촌동", roomType: "3룸", salesActivity: "활발", price: 830000, maintenance: 130000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔004", name: "신축풀옵투룸주차 강동구 성내동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 650000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-둔005", name: "올림픽공원 아파트 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 1100000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔006", name: "옥탑방(옥상캠핑가능) 강동구 성내동의 단독주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 150000, maintenance: 20000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔007", name: "아산병원 2룸 아파트 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 1200000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔008", name: "둔촌동 올림픽파크포레온 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 1050000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔009", name: "아늑한 방 102호 강동구 둔촌동의 단독주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 350000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔010", name: "깨끗 조용한 101호 강동구 둔촌동의 단독주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 350000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔011", name: "올림픽파크포레온 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 1050000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔012", name: "서울 강동 드림홈 강동구 성내동의 연립빌라", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 430000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔013", name: "올림픽공원 예쁜 투룸 강동구 성내동의 원룸건물", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 690000, maintenance: 60000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔014", name: "아파트 28평 3룸 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "3룸", salesActivity: "활발", price: 800000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔015", name: "강동성내 2룸 강동구 성내동의 연립빌라", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 480000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔016", name: "루프탑 하우스 4층 강동구 둔촌동의 단독주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 650000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔017", name: "9호선 준신축 1.5룸 강동구 둔촌동의 단독주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 500000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔018", name: "아산병원근처강동역7분 강동구 성내동의 상가주택", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 420000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "강동역 7분", availableDate: "게시중", isOurs: false },
          { id: "s-둔019", name: "정남향,풀옵션,탑층 뷰 강동구 둔촌동의 오피스텔", dong: "둔촌동", roomType: "1룸", salesActivity: "활발", price: 320000, maintenance: 20000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-둔020", name: "둔촌동 올림픽파크포레온 강동구 둔촌동의 아파트", dong: "둔촌동", roomType: "2룸", salesActivity: "활발", price: 1050000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
        ],
      },
    ],
  },
  {
    name: "송파구",
    lat: 37.5048, lng: 127.1144,
    dongs: [
      {
        name: "오금동",
        lat: 37.5024, lng: 127.1285,
        listings: [
          // ── 우리 숙소 (H: 오금스타, 전부 1룸 9개) ──
          { id: "h-H12", name: "오금스타 102", dong: "오금동", roomType: "1룸", salesActivity: "보통", price: 310000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "오금역 4분", availableDate: "6/20까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/20까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 310000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 220000 },
          { id: "h-H21", name: "오금스타 201", dong: "오금동", roomType: "1룸", salesActivity: "부진", price: 340000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "오금역 4분", availableDate: "7일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+7 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 300000, changePercent: -11.8, reason: "오금동 1룸 '활발' 중위 30만 대비 높음", vacantDays: 7, breakeven: 220000 },
          { id: "h-H33", name: "오금스타 303", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 300000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "오금역 4분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+1", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 310000, changePercent: 3.3, reason: "인상 여지", vacantDays: 0, breakeven: 220000 },
          { id: "h-H52", name: "오금스타 502", dong: "오금동", roomType: "1룸", salesActivity: "보통", price: 310000, maintenance: 28000, cleaningFee: 45000, deposit: 200000, distance: "오금역 4분", availableDate: "6/15까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/15까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 310000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 220000 },
          // ── 비교군 (삼삼엠투 크롤링 오금동 20개, 2026-05-12) ──
          { id: "s-오001", name: "잠실송파 리모델링투룸 송파구 오금동의 단독주택 잠실송파 리모델링투룸", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 230000, maintenance: 20000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-오002", name: "즉시입주~1만 원할인", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 640000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "오금역 3분", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-오003", name: "신축풀옵션아파트고층뷰 송파구 오금동의 아파트 신축풀옵션아파트고층뷰", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 350000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오004", name: "잠실송파오금수서 2룸 송파구 오금동의 단독주택 잠실송파오금수서 2룸", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 220000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오005", name: "느낌좋은 하우스신축 송파구 오금동의 연립빌라 느낌좋은 하우스신축", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 530000, maintenance: 60000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (10만원 할인)", isOurs: false },
          { id: "s-오006", name: "장기계약~5%할인 ㅣ 즉시입주~3만 원할인", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 410000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-오007", name: "올림픽공원 가락동 2룸 송파구 오금동의 상가주택 올림픽공원 가락동 2룸", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 795000, maintenance: 45000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오008", name: "마나하임 오피스텔 송파구 오금동의 오피스텔 마나하임 오피스텔", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 310000, maintenance: 30000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오009", name: "오금역 테라스 원룸 송파구 오금동의 단독주택 오금역 테라스 원룸", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 339000, maintenance: 90000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-오010", name: "장기계약~5%할인 ㅣ 즉시입주~3만 원할인", dong: "오금동", roomType: "3룸", salesActivity: "활발", price: 450000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-오011", name: "삼송테라스복층4룸아팟 고양시 덕양구 오금동의 아파트 삼송테라스복층4룸아팟", dong: "오금동", roomType: "3룸", salesActivity: "활발", price: 1150000, maintenance: 150000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-오012", name: "송파 오금 H13 송파구 오금동의 원룸건물 송파 오금 H13", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 280000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오013", name: "송파 오금 H12 송파구 오금동의 원룸건물 송파 오금 H12", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 320000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오014", name: "올림픽공원 2룸 송파구 오금동의 상가주택 올림픽공원 2룸", dong: "오금동", roomType: "2룸", salesActivity: "활발", price: 795000, maintenance: 45000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-오015", name: "초특가 오금 H21 송파구 오금동의 원룸건물 초특가 오금 H21", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 310000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-오016", name: "송파 오금 H23 송파구 오금동의 원룸건물 송파 오금 H23", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 280000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-오017", name: "송파 오금 H25 송파구 오금동의 원룸건물 송파 오금 H25", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 360000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-오018", name: "초특가 송파오금 H33 송파구 오금동의 원룸건물 초특가 송파오금 H33", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 280000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-오019", name: "송파 오금 H42 송파구 오금동의 오피스텔 송파 오금 H42", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 340000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (4만원 할인)", isOurs: false },
          { id: "s-오020", name: "송파 오금 H52 송파구 오금동의 오피스텔 송파 오금 H52", dong: "오금동", roomType: "1룸", salesActivity: "활발", price: 230000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
        ],
      },
    ],
  },
  {
    name: "강남구",
    lat: 37.4960, lng: 127.0630,
    dongs: [
      {
        name: "대치동",
        lat: 37.4947, lng: 127.0587,
        listings: [
          // ── 우리 숙소 (V: 대치 101호=2룸, 102호=1룸, 103호=1.5룸) ──
          { id: "h-V11", name: "대치동 101호", dong: "대치동", roomType: "2룸", salesActivity: "부진", price: 700000, maintenance: 60000, cleaningFee: 80000, deposit: 700000, distance: "대치역 3분", availableDate: "4일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+4 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 640000, changePercent: -8.6, reason: "대치동 2룸 '활발' 중위 62만 대비 높음", vacantDays: 4, breakeven: 420000 },
          { id: "h-V12", name: "대치동 102호", dong: "대치동", roomType: "1룸", salesActivity: "보통", price: 500000, maintenance: 45000, cleaningFee: 60000, deposit: 400000, distance: "대치역 3분", availableDate: "6/30까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "6/30까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 500000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 350000 },
          // ── 비교군 (삼삼엠투 크롤링 대치동 20개, 2026-05-12) ──
          { id: "s-대001", name: "강남 코엑스 도보2분 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 710000, maintenance: 160000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대002", name: "선릉역 5분 넓은원룸 강남구 대치동의 아파트", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 450000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "선릉역 5분", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-대003", name: "대치동학원가패밀리룸 강남구 대치동의 단독주택", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 1050000, maintenance: 170000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대004", name: "삼성 대치 분리형 원룸 강남구 대치동의 아파트", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 480000, maintenance: 130000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대005", name: "대치 학원가도보권무료 강남구 대치동의 단독주택", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 1040000, maintenance: 170000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대006", name: "코엑스삼성역 오픈특가 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 360000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-대007", name: "강남대치선릉 역세권 강남구 대치동의 상가주택", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 509000, maintenance: 99000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-대008", name: "강남대치 선릉역6분 강남구 대치동의 연립빌라", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 420000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "선릉역 6분", availableDate: "게시중", isOurs: false },
          { id: "s-대009", name: "양재강남수서대치동 강남구 개포동의 연립빌라", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 390000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-대010", name: "파격가강남선릉 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 750000, maintenance: 150000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대011", name: "강남 대치동 풀옵션 강남구 대치동의 연립빌라", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 290000, maintenance: 40000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대012", name: "강남특가 삼성역 풀옵션 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 340000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-대013", name: "2층대치선릉 투룸 주차 강남구 대치동의 연립빌라", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 950000, maintenance: 150000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-대014", name: "삼성역코엑스강남대치최저 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 310000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-대015", name: "무료주차역삼선릉대치한티 강남구 대치동의 연립빌라", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 690000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대016", name: "한티역대치동학원가 1분 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 850000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-대017", name: "삼성역코엑스강남대치특가 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 310000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-대018", name: "선릉투베드뷰맛집 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 500000, maintenance: 120000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-대019", name: "삼성역 남향 오피스텔 강남구 대치동의 오피스텔", dong: "대치동", roomType: "1룸", salesActivity: "활발", price: 480000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (10만원 할인)", isOurs: false },
          { id: "s-대020", name: "대치 선릉역삼성역 4인 강남구 대치동의 연립빌라", dong: "대치동", roomType: "2룸", salesActivity: "활발", price: 520000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
        ],
      },
      {
        name: "역삼동",
        lat: 37.5000, lng: 127.0367,
        listings: [
          // ── 우리 숙소 (U: 성우, 2룸 5개 + 3룸 3개) ──
          { id: "h-U24", name: "성우 204", dong: "역삼동", roomType: "2룸", salesActivity: "부진", price: 580000, maintenance: 48000, cleaningFee: 65000, deposit: 400000, distance: "역삼역 5분", availableDate: "6일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+6 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 530000, changePercent: -8.6, reason: "역삼동 2룸 '활발' 중위 53만 대비 높음", vacantDays: 6, breakeven: 380000 },
          { id: "h-U21", name: "성우 201", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 530000, maintenance: 45000, cleaningFee: 60000, deposit: 350000, distance: "역삼역 5분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+1", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 540000, changePercent: 1.9, reason: "인상 여지 소폭", vacantDays: 0, breakeven: 370000 },
          { id: "h-U42", name: "성우 402", dong: "역삼동", roomType: "3룸", salesActivity: "보통", price: 700000, maintenance: 60000, cleaningFee: 80000, deposit: 600000, distance: "역삼역 5분", availableDate: "7/10까지 계약", isOurs: true, hieroStatus: "계약중", hieroDetail: "7/10까지 계약", samsamStatus: "계약중", samsamDetail: "계약 완료", recommendedPrice: 700000, changePercent: 0, reason: "적정가", vacantDays: 0, breakeven: 480000 },
          { id: "h-U83", name: "성우 803", dong: "역삼동", roomType: "3룸", salesActivity: "부진", price: 750000, maintenance: 65000, cleaningFee: 85000, deposit: 700000, distance: "역삼역 5분", availableDate: "10일째 공실", isOurs: true, hieroStatus: "공실", hieroDetail: "D+10 공실", samsamStatus: "즉시입주", samsamDetail: "즉시입주로 게시중", recommendedPrice: 680000, changePercent: -9.3, reason: "3룸 '활발' 중위 대비 높음", vacantDays: 10, breakeven: 500000 },
          { id: "h-U93", name: "성우 903", dong: "역삼동", roomType: "3룸", salesActivity: "활발", price: 680000, maintenance: 60000, cleaningFee: 80000, deposit: 600000, distance: "역삼역 5분", availableDate: "즉시입주", isOurs: true, hieroStatus: "공실", hieroDetail: "D+2", samsamStatus: "즉시입주", samsamDetail: "즉시입주", recommendedPrice: 700000, changePercent: 2.9, reason: "인상 여지, 빠른 회전", vacantDays: 0, breakeven: 480000 },
          // ── 비교군 (삼삼엠투 크롤링 역삼동 20개, 2026-05-12) ──
          { id: "s-역001", name: "초특가신논현언주역투룸D 강남구 역삼동의 연립빌라 초특가신논현언주역투룸D", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 390000, maintenance: 70000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역002", name: "초특가신논현언주쓰리룸 강남구 역삼동의 연립빌라 초특가신논현언주쓰리룸", dong: "역삼동", roomType: "3룸", salesActivity: "활발", price: 470000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역003", name: "초특가신논현언주역투룸A 강남구 역삼동의 연립빌라 초특가신논현언주역투룸A", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 500000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역004", name: "초특가신논현언주역투룸B 강남구 역삼동의 연립빌라 초특가신논현언주역투룸B", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 470000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역005", name: "강남역 초역세권 역삼동 강남구 역삼동의 원룸건물 강남역 초역세권 역삼동", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 390000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (7만원 할인)", isOurs: false },
          { id: "s-역006", name: "강남역 도보5분 풀옵 강남구 역삼동의 오피스텔 강남역 도보5분 풀옵", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 415000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (2만원 할인)", isOurs: false },
          { id: "s-역007", name: "강남선릉대치삼성4인 강남구 역삼동의 오피스텔 강남선릉대치삼성4인", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 830000, maintenance: 150000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역008", name: "역삼,저렴,장기거주 강남구 역삼동의 연립빌라 역삼,저렴,장기거주", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 245000, maintenance: 25000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역009", name: "강남역삼역 도보1분 강남구 역삼동의 오피스텔 강남역삼역 도보1분", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 330000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (1만원 할인)", isOurs: false },
          { id: "s-역010", name: "양드레하우스 역삼 3호 강남구 역삼동의 원룸건물 양드레하우스 역삼 3호", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 370000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역011", name: "강남신논현선릉 투룸 강남구 역삼동의 연립빌라 강남신논현선릉 투룸", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 598000, maintenance: 99000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-역012", name: "한티삼성선릉대치주차세브 강남구 역삼동의 연립빌라 한티삼성선릉대치주차세브", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 530000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-역013", name: "깨끗하고 아담한 3룸 강남구 역삼동의 연립빌라 깨끗하고 아담한 3룸", dong: "역삼동", roomType: "3룸", salesActivity: "활발", price: 890000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
          { id: "s-역014", name: "강남역5분 감성공간 강남구 역삼동의 오피스텔 강남역5분 감성공간", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 400000, maintenance: 80000, cleaningFee: 0, deposit: 0, distance: "강남역 5분", availableDate: "게시중", isOurs: false },
          { id: "s-역015", name: "강남역 도보5분 407 강남구 역삼동의 원룸건물 강남역 도보5분 407", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 330000, maintenance: 50000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (3만원 할인)", isOurs: false },
          { id: "s-역016", name: "강남역 풀옵 시티뷰 강남구 역삼동의 오피스텔 강남역 풀옵 시티뷰", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 580000, maintenance: 130000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-역017", name: "강남역2분깔끔안전 강남구 역삼동의 오피스텔 강남역2분깔끔안전", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 460000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "강남역 2분", availableDate: "게시중", isOurs: false },
          { id: "s-역018", name: "강남선릉삼성 투룸 강남구 역삼동의 아파트 강남선릉삼성 투룸", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 740000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-역019", name: "주차강남역삼세브란스 강남구 역삼동의 연립빌라 주차강남역삼세브란스", dong: "역삼동", roomType: "1룸", salesActivity: "활발", price: 439000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "즉시입주 (5만원 할인)", isOurs: false },
          { id: "s-역020", name: "역삼역 센터필드사거리 강남구 역삼동의 오피스텔 역삼역 센터필드사거리", dong: "역삼동", roomType: "2룸", salesActivity: "활발", price: 1000000, maintenance: 100000, cleaningFee: 0, deposit: 0, distance: "", availableDate: "게시중", isOurs: false },
        ],
      },
    ],
  },
];

const ROOM_TYPES: RoomType[] = ["1룸", "2룸", "3룸"];
const SALES_ACTIVITIES: SalesActivity[] = ["활발", "보통", "부진"];

const ACTIVITY_STYLE: Record<SalesActivity, { bg: string; text: string; dot: string; desc: string }> = {
  "활발": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", desc: "즉시입주 1~2주 내" },
  "보통": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", desc: "~한달 예약" },
  "부진": { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", desc: "1달+ 공실" },
};

function formatWon(n: number): string {
  if (!n) return "-";
  const man = n / 10000;
  return man >= 10 ? `${man.toFixed(0)}만` : `${man.toFixed(1)}만`;
}

// ============================================================
// 우리 숙소 멀티셀렉트 드롭다운
// ============================================================
function OurPropertySelector({ allOurs, selected, onToggle, onSelectAll, onClearAll }: {
  allOurs: MarketListing[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
      >
        <span>우리 숙소</span>
        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">{selected.size}/{allOurs.length}</span>
        <svg className={`w-3 h-3 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 mb-1">
            <span className="text-[10px] text-gray-400">비교할 숙소 선택</span>
            <div className="flex gap-2">
              <button onClick={onSelectAll} className="text-[10px] text-emerald-600 hover:underline">전체 선택</button>
              <button onClick={onClearAll} className="text-[10px] text-gray-400 hover:underline">해제</button>
            </div>
          </div>
          {allOurs.map(p => (
            <label key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
                className="rounded border-gray-300 text-emerald-600 w-3.5 h-3.5"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-800 truncate">{p.name}</div>
                <div className="text-[10px] text-gray-400">{p.dong} · {p.roomType} · {formatWon(p.price)}/주</div>
              </div>
              <span className={`w-2 h-2 rounded-full shrink-0 ${ACTIVITY_STYLE[p.salesActivity].dot}`} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Popup
// ============================================================
interface MarketAnalysisPopupProps {
  district?: string;
  onClose: () => void;
}

export default function MarketAnalysisPopup({ district, onClose }: MarketAnalysisPopupProps) {
  const [selectedGu, setSelectedGu] = useState<string>(district || DUMMY[0].name);
  const [selectedDong, setSelectedDong] = useState<string | "all">("all");
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | "all">("all");
  const [selectedActivity, setSelectedActivity] = useState<SalesActivity | "all">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "properties" | "competitors" | "samsam">("overview");

  const guData = DUMMY.find(d => d.name === selectedGu) || DUMMY[0];
  const dongNames = guData.dongs.map(d => d.name);

  // 전체 매물 (동 필터만)
  const allListings = useMemo(() => {
    let listings: MarketListing[] = [];
    if (selectedDong === "all") {
      guData.dongs.forEach(d => listings.push(...d.listings));
    } else {
      const dong = guData.dongs.find(d => d.name === selectedDong);
      if (dong) listings = [...dong.listings];
    }
    return listings;
  }, [guData, selectedDong]);

  // 필터 적용 (룸타입 + 활성도)
  const filtered = useMemo(() => {
    let listings = allListings;
    if (selectedRoomType !== "all") listings = listings.filter(l => l.roomType === selectedRoomType);
    if (selectedActivity !== "all") listings = listings.filter(l => l.salesActivity === selectedActivity);
    return listings;
  }, [allListings, selectedRoomType, selectedActivity]);

  // 우리 숙소 (필터 적용 후)
  const allOurs = useMemo(() => filtered.filter(l => l.isOurs), [filtered]);

  const [selectedOurIds, setSelectedOurIds] = useState<Set<string>>(new Set());

  // 필터 변경 → 우리 숙소 자동 전체 선택
  useEffect(() => {
    setSelectedOurIds(new Set(allOurs.map(o => o.id)));
  }, [selectedGu, selectedDong, selectedRoomType, selectedActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOur = (id: string) => {
    setSelectedOurIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ours = allOurs.filter(l => selectedOurIds.has(l.id));
  const competitors = filtered.filter(l => !l.isOurs);
  const allPrices = [...ours, ...competitors].map(l => l.price);
  const ourPrices = ours.map(l => l.price);
  const compPrices = competitors.map(l => l.price);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const marketMedian = median(compPrices);
  const ourAvg = avg(ourPrices);
  const filterLabel = [
    selectedDong === "all" ? selectedGu : selectedDong,
    selectedRoomType !== "all" ? selectedRoomType : null,
    selectedActivity !== "all" ? selectedActivity : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[95vw] max-w-[1000px] max-h-[92vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── 헤더 (1줄 압축) ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 mr-1">시장 분석</span>

            {/* 구 */}
            {DUMMY.map(d => (
              <button
                key={d.name}
                onClick={() => { setSelectedGu(d.name); setSelectedDong("all"); setActiveTab("overview"); }}
                className={`px-2 py-1 text-[11px] font-medium rounded transition ${
                  selectedGu === d.name ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200"
                }`}
              >{d.name}</button>
            ))}

            <div className="w-px h-5 bg-gray-200" />

            {/* 동 */}
            <button onClick={() => setSelectedDong("all")} className={`px-2 py-1 text-[11px] rounded transition ${selectedDong === "all" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>전체</button>
            {dongNames.map(d => (
              <button key={d} onClick={() => setSelectedDong(d)} className={`px-2 py-1 text-[11px] rounded transition ${selectedDong === d ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>{d}</button>
            ))}

            <div className="w-px h-5 bg-gray-200" />

            {/* 룸타입 */}
            {ROOM_TYPES.map(rt => (
              <button key={rt} onClick={() => setSelectedRoomType(selectedRoomType === rt ? "all" : rt)} className={`px-2 py-1 text-[11px] rounded transition ${selectedRoomType === rt ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>{rt}</button>
            ))}

            <div className="w-px h-5 bg-gray-200" />

            {/* 활성도 */}
            {SALES_ACTIVITIES.map(sa => (
              <button key={sa} onClick={() => setSelectedActivity(selectedActivity === sa ? "all" : sa)} className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1 ${selectedActivity === sa ? `${ACTIVITY_STYLE[sa].bg} ${ACTIVITY_STYLE[sa].text}` : "bg-gray-100 text-gray-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_STYLE[sa].dot}`} />{sa}
              </button>
            ))}

            <div className="w-px h-5 bg-gray-200" />

            {/* 우리 숙소 셀렉터 */}
            <OurPropertySelector
              allOurs={allOurs}
              selected={selectedOurIds}
              onToggle={toggleOur}
              onSelectAll={() => setSelectedOurIds(new Set(allOurs.map(o => o.id)))}
              onClearAll={() => setSelectedOurIds(new Set())}
            />

            <div className="ml-auto" />
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 transition">
              <span className="text-base">&times;</span>
            </button>
          </div>
        </div>

        {/* ── 요약 (1줄) ── */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-3 text-xs">
          <span className="font-medium text-gray-700">{filterLabel}</span>
          <span className="text-gray-400">|</span>
          <span className="text-emerald-600 font-medium">우리 {ours.length}개</span>
          <span className="text-gray-400">vs</span>
          <span className="text-gray-600 font-medium">비교군 {competitors.length}개</span>
          <span className="text-gray-400">|</span>
          <span>우리 평균 <b className={ourAvg > marketMedian ? "text-amber-600" : "text-gray-800"}>{formatWon(ourAvg)}</b></span>
          <span className="text-gray-400">/</span>
          <span>비교군 중위 <b>{formatWon(marketMedian)}</b></span>
          {marketMedian > 0 && (
            <span className={`font-bold ${ourAvg > marketMedian ? "text-amber-600" : "text-green-600"}`}>
              ({ourAvg > marketMedian ? "+" : ""}{((ourAvg - marketMedian) / marketMedian * 100).toFixed(1)}%)
            </span>
          )}
        </div>

        {/* ── 탭 ── */}
        <div className="px-4 pt-1 flex gap-1 border-b border-gray-100">
          {([
            { key: "samsam" as const, label: "삼투 실시간", accent: true },
            { key: "overview" as const, label: "가격 분포" },
            { key: "properties" as const, label: `숙소별 추천 (${ours.length})` },
            { key: "competitors" as const, label: `비교군 (${competitors.length})` },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
                activeTab === tab.key
                  ? tab.accent ? "border-emerald-600 text-emerald-700" : "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >{tab.label}</button>
          ))}
        </div>

        {/* ── 탭 내용 ── */}
        {activeTab === "samsam" ? (
          <SamsamLiveTab dong={selectedDong === "all" ? guData.dongs[0]?.name || "" : selectedDong} gu={selectedGu} roomType={selectedRoomType} />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {(ours.length + competitors.length) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="text-sm">해당 조건의 매물이 없습니다</div>
                <div className="text-xs mt-1">필터를 변경하거나 우리 숙소를 선택해보세요</div>
              </div>
            ) : (
              <>
                {activeTab === "overview" && <OverviewTab ours={ours} competitors={competitors} allPrices={allPrices} ourAvg={ourAvg} marketMedian={marketMedian} filterLabel={filterLabel} />}
                {activeTab === "properties" && <PropertiesTab ours={ours} marketMedian={marketMedian} />}
                {activeTab === "competitors" && <CompetitorsTab competitors={competitors} ourAvg={ourAvg} />}
              </>
            )}
          </div>
        )}

        {/* ── 푸터 ── */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-gray-300">
            <span>더미 데이터 — 크롤링 후 실데이터 교체 예정</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />활발</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />보통</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />부진</span>
          </div>
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">닫기</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 삼투 실시간 탭 — iframe으로 삼삼엠투 검색 결과 표시
// ============================================================
function SamsamLiveTab({ dong, gu, roomType }: { dong: string; gu: string; roomType: RoomType | "all" }) {
  const searchArea = dong || gu;
  // 삼투 URL: address 파라미터 + roomCounts 파라미터
  const roomCountParam = roomType === "1룸" ? "&roomCounts=ONE" : roomType === "2룸" ? "&roomCounts=TWO" : roomType === "3룸" ? "&roomCounts=THREE_PLUS" : "";
  const samsamUrl = `https://web.33m2.co.kr/guest/room?address=${encodeURIComponent(searchArea)}${roomCountParam}`;
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단 바 */}
      <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-emerald-800">삼삼엠투 실시간</span>
          <span className="text-emerald-600">검색: {searchArea}{roomType !== "all" ? ` · ${roomType}` : ""}</span>
        </div>
        <a
          href={samsamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          새 탭에서 열기 &rarr;
        </a>
      </div>

      {/* iframe 또는 폴백 */}
      {iframeError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-sm text-gray-500">삼투 사이트가 임베딩을 차단했습니다</div>
          <a
            href={samsamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            삼투에서 직접 보기: {searchArea}
          </a>
          <p className="text-[11px] text-gray-400 max-w-md text-center">
            선택한 조건({searchArea}{roomType !== "all" ? ` · ${roomType}` : ""})이 이미 적용된 상태로 열립니다.
            비교군 탭에서 크롤링 데이터를 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <iframe
          src={samsamUrl}
          className="flex-1 w-full border-0"
          style={{ minHeight: "400px" }}
          loading="lazy"
          title={`삼삼엠투 ${searchArea}`}
          onError={() => setIframeError(true)}
          onLoad={(e) => {
            // iframe이 로드되었지만 빈 페이지이거나 차단된 경우 감지
            try {
              const iframe = e.target as HTMLIFrameElement;
              // cross-origin이면 접근 불가 → 정상 로드로 간주
              if (iframe.contentDocument === null) return;
            } catch {
              // cross-origin 접근 차단 = 정상 로드
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 가격 분포 탭
// ============================================================
function OverviewTab({ ours, competitors, allPrices, ourAvg, marketMedian, filterLabel }: {
  ours: MarketListing[];
  competitors: MarketListing[];
  allPrices: number[];
  ourAvg: number;
  marketMedian: number;
  filterLabel: string;
}) {
  const buckets = useMemo(() => {
    if (allPrices.length === 0) return [];
    const min = Math.floor(Math.min(...allPrices) / 50000) * 50000;
    const max = Math.ceil(Math.max(...allPrices) / 50000) * 50000;
    const step = 50000;
    const result: { range: string; ourCount: number; compCount: number }[] = [];
    for (let low = min; low < max; low += step) {
      const high = low + step;
      result.push({
        range: `${formatWon(low)}~${formatWon(high)}`,
        ourCount: ours.filter(l => l.price >= low && l.price < high).length,
        compCount: competitors.filter(l => l.price >= low && l.price < high).length,
      });
    }
    return result;
  }, [allPrices, ours, competitors]);

  const maxCount = Math.max(...buckets.map(b => b.ourCount + b.compCount), 1);
  const isExpensive = ourAvg > marketMedian && marketMedian > 0;
  const diffPercent = marketMedian > 0 ? ((ourAvg - marketMedian) / marketMedian * 100).toFixed(1) : "0";

  const crossAnalysis = useMemo(() => {
    const result: { roomType: RoomType; activity: SalesActivity; ourCount: number; compCount: number; ourAvg: number; compMedian: number }[] = [];
    for (const rt of ROOM_TYPES) {
      for (const sa of SALES_ACTIVITIES) {
        const o = ours.filter(l => l.roomType === rt && l.salesActivity === sa);
        const c = competitors.filter(l => l.roomType === rt && l.salesActivity === sa);
        if (o.length + c.length === 0) continue;
        const oPrices = o.map(l => l.price);
        const cPrices = c.map(l => l.price);
        const cSorted = [...cPrices].sort((a, b) => a - b);
        const cMid = Math.floor(cSorted.length / 2);
        result.push({
          roomType: rt, activity: sa, ourCount: o.length, compCount: c.length,
          ourAvg: oPrices.length ? oPrices.reduce((a, b) => a + b, 0) / oPrices.length : 0,
          compMedian: cSorted.length % 2 ? (cSorted[cMid] || 0) : ((cSorted[cMid - 1] || 0) + (cSorted[cMid] || 0)) / 2,
        });
      }
    }
    return result;
  }, [ours, competitors]);

  return (
    <div className="space-y-5">
      {ourAvg > 0 && marketMedian > 0 && (
        <div className={`rounded-xl p-4 ${isExpensive ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
          <div className={`text-sm font-bold ${isExpensive ? "text-amber-800" : "text-green-800"}`}>
            {filterLabel}: 우리 가격이 비교군 중위 대비 {isExpensive ? `${diffPercent}% 높습니다` : "적정 범위입니다"}
          </div>
          <div className={`text-xs mt-1 ${isExpensive ? "text-amber-600" : "text-green-600"}`}>
            HIERO {ours.length}개 vs 삼삼엠투 {competitors.length}개
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-3">가격 분포</h3>
        <div className="space-y-1.5">
          {buckets.map(b => {
            const ourW = Math.max((b.ourCount / maxCount) * 100, b.ourCount > 0 ? 4 : 0);
            const compW = Math.max((b.compCount / maxCount) * 100, b.compCount > 0 ? 4 : 0);
            return (
              <div key={b.range} className="flex items-center gap-2">
                <div className="w-24 text-right text-[11px] text-gray-500 shrink-0">{b.range}</div>
                <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden flex">
                  {b.ourCount > 0 && <div className="h-full bg-emerald-400 rounded-l" style={{ width: `${ourW}%` }} />}
                  {b.compCount > 0 && <div className="h-full bg-gray-300" style={{ width: `${compW}%` }} />}
                </div>
                <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">
                  {b.ourCount > 0 && <span className="text-emerald-600">{b.ourCount}</span>}
                  {b.ourCount > 0 && b.compCount > 0 && " / "}
                  {b.compCount > 0 && <span className="text-gray-400">{b.compCount}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-400 inline-block" /> HIERO 숙소</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gray-300 inline-block" /> 삼삼엠투 비교군</span>
        </div>
      </div>

      {crossAnalysis.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-700 mb-1">룸타입 x 판매활성도 비교</h3>
          <p className="text-[10px] text-gray-400 mb-3">&apos;활발&apos; 매물 가격 = 시장 적정가. &apos;부진&apos; = 시장이 거부하는 가격.</p>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">룸타입</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">활성도</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">HIERO</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">삼투</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">우리 평균</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">삼투 중위</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">차이</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">해석</th>
                </tr>
              </thead>
              <tbody>
                {crossAnalysis.map(row => {
                  const diff = row.compMedian > 0 ? ((row.ourAvg - row.compMedian) / row.compMedian * 100) : 0;
                  let insight = "";
                  if (row.activity === "활발" && row.ourAvg > 0 && diff > 5) insight = "적정가 초과";
                  else if (row.activity === "활발" && row.ourAvg > 0 && diff < -5) insight = "인상 여지";
                  else if (row.activity === "부진" && row.ourCount > 0) insight = "재검토 필요";
                  else if (row.activity === "보통") insight = "안정";
                  return (
                    <tr key={`${row.roomType}-${row.activity}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium text-gray-800">{row.roomType}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTIVITY_STYLE[row.activity].bg} ${ACTIVITY_STYLE[row.activity].text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_STYLE[row.activity].dot}`} />{row.activity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">{row.ourCount || "-"}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{row.compCount || "-"}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.ourAvg > 0 ? formatWon(row.ourAvg) : "-"}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{row.compMedian > 0 ? formatWon(row.compMedian) : "-"}</td>
                      <td className={`px-3 py-2 text-right font-medium ${diff > 5 ? "text-red-500" : diff < -5 ? "text-green-600" : "text-gray-400"}`}>
                        {row.ourAvg > 0 && row.compMedian > 0 ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">{insight}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 숙소별 추천 탭
// ============================================================
function PropertiesTab({ ours, marketMedian }: { ours: MarketListing[]; marketMedian: number }) {
  const needsAdjust = ours.filter(p => p.changePercent && p.changePercent !== 0);
  const optimal = ours.filter(p => !p.changePercent || p.changePercent === 0);

  if (ours.length === 0) {
    return <div className="text-sm text-gray-400 py-12 text-center">우리 숙소를 선택해주세요 (상단 드롭다운)</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">조정 권장 {needsAdjust.length}개</span>
        <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">적정 {optimal.length}개</span>
        <span className="text-gray-400">기준: 삼투 비교군 중위 {formatWon(marketMedian)}/주</span>
      </div>

      {/* 불일치 경고 */}
      {ours.some(p => p.mismatch) && (
        <div className="rounded-xl p-3 bg-orange-50 border border-orange-200">
          <div className="text-xs font-bold text-orange-800">상태 불일치 {ours.filter(p => p.mismatch).length}건</div>
          <div className="text-[11px] text-orange-600 mt-0.5">HIERO 상태와 삼투 게시 상태가 다릅니다. 확인 필요.</div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">숙소</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500">타입</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500">HIERO</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500">삼투</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">현재가</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">추천가</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">변동</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">손익분기</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">사유</th>
            </tr>
          </thead>
          <tbody>
            {ours.map(p => (
              <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${p.mismatch ? "bg-orange-50/50" : ""}`}>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-800 flex items-center gap-1">
                    {p.name}
                    {p.mismatch && <span className="text-orange-500 text-[10px]" title="HIERO↔삼투 상태 불일치">⚠</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">{p.dong} · {p.roomType}</div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">{p.roomType}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className={`text-[10px] font-medium ${
                    p.hieroStatus === "공실" ? "text-red-600" : p.hieroStatus === "계약중" ? "text-green-600" : "text-gray-500"
                  }`}>{p.hieroStatus || "-"}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{p.hieroDetail}</div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className={`text-[10px] font-medium ${
                    p.samsamStatus === "즉시입주" ? "text-amber-600" : p.samsamStatus === "계약중" ? "text-green-600" : "text-gray-400"
                  }`}>{p.samsamStatus || "-"}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{p.samsamDetail}</div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600">{formatWon(p.price)}</td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-900">{formatWon(p.recommendedPrice || p.price)}</td>
                <td className={`px-3 py-2.5 text-right font-medium ${(p.changePercent || 0) < 0 ? "text-red-500" : (p.changePercent || 0) > 0 ? "text-green-600" : "text-gray-400"}`}>
                  {!p.changePercent || p.changePercent === 0 ? "유지" : `${p.changePercent > 0 ? "+" : ""}${p.changePercent.toFixed(1)}%`}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-400">{formatWon(p.breakeven || 0)}</td>
                <td className="px-3 py-2.5 text-gray-500 max-w-[180px] truncate" title={p.reason}>{p.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">추천 로직</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-500">
          <div className="flex items-start gap-2">
            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ACTIVITY_STYLE["활발"].dot}`} />
            <span>같은 동·룸타입의 삼투 <b>&apos;활발&apos;</b> 매물 가격 = 기준선</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ACTIVITY_STYLE["부진"].dot}`} />
            <span>우리가 <b>&apos;부진&apos;</b>이면 → 기준선까지 하향 추천</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 비교군 탭
// ============================================================
function CompetitorsTab({ competitors, ourAvg }: { competitors: MarketListing[]; ourAvg: number }) {
  const byActivity = {
    active: competitors.filter(c => c.salesActivity === "활발"),
    normal: competitors.filter(c => c.salesActivity === "보통"),
    slow: competitors.filter(c => c.salesActivity === "부진"),
  };

  if (competitors.length === 0) {
    return <div className="text-sm text-gray-400 py-12 text-center">해당 조건의 비교군이 없습니다</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> 활발 {byActivity.active.length}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> 보통 {byActivity.normal.length}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> 부진 {byActivity.slow.length}
        </span>
        <span className="text-gray-400 ml-2">부진률 {((byActivity.slow.length / competitors.length) * 100).toFixed(0)}%</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-auto" style={{ maxHeight: "50vh" }}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">매물명</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">동</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500">타입</th>
              <th className="text-center px-3 py-2.5 font-medium text-gray-500">활성도</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">주간가</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">관리비</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">실질주간</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">위치</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-500">입주/공실</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500">vs 우리</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(c => {
              const realWeekly = c.price + c.maintenance;
              const vsOurs = ourAvg > 0 ? ((c.price - ourAvg) / ourAvg * 100) : 0;
              return (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-800">{c.name}</td>
                  <td className="px-3 py-2 text-gray-500">{c.dong}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">{c.roomType}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTIVITY_STYLE[c.salesActivity].bg} ${ACTIVITY_STYLE[c.salesActivity].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_STYLE[c.salesActivity].dot}`} />{c.salesActivity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatWon(c.price)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{formatWon(c.maintenance)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatWon(realWeekly)}</td>
                  <td className="px-3 py-2 text-gray-400 text-[11px]">{c.distance}</td>
                  <td className="px-3 py-2 text-[11px] text-gray-500">{c.availableDate}</td>
                  <td className={`px-3 py-2 text-right text-[11px] font-medium ${vsOurs < -5 ? "text-green-600" : vsOurs > 5 ? "text-red-500" : "text-gray-400"}`}>
                    {ourAvg > 0 ? `${vsOurs > 0 ? "+" : ""}${vsOurs.toFixed(0)}%` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">시장 인사이트</div>
        <div className="space-y-1.5 text-[11px] text-gray-500">
          {byActivity.active.length > 0 && (
            <p><span className="font-medium text-green-700">&apos;활발&apos; 평균 {formatWon(byActivity.active.reduce((s, c) => s + c.price, 0) / byActivity.active.length)}</span> — 시장이 바로 소화하는 가격. 우리 기준선.</p>
          )}
          {byActivity.slow.length > 0 && (
            <p><span className="font-medium text-red-600">&apos;부진&apos; 평균 {formatWon(byActivity.slow.reduce((s, c) => s + c.price, 0) / byActivity.slow.length)}</span> — 이 가격에서도 안 나감. 위치/컨디션 문제 가능.</p>
          )}
          <p>부진률 {((byActivity.slow.length / competitors.length) * 100).toFixed(0)}% — {byActivity.slow.length > byActivity.active.length ? "공급 과잉, 경쟁 심화" : "수요 양호"}.</p>
        </div>
      </div>
    </div>
  );
}
