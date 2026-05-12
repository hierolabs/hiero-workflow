import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import OperationManual from "../components/OperationManual";
import { fetchPricingData, fetchCalendarData, fetchPriceComparison, updatePrice, updateRestrictions, updateAvailability } from "../features/calendar/api/calendarApi";
import type { PricingMap, DayPricing, CalendarReservation } from "../features/calendar/types/calendar";
import type { PriceCompareMap, PriceCompareDay } from "../features/calendar/api/calendarApi";
import MarketDataPanel from "../features/calendar/components/MarketDataPanel";
import { fetchVacancyAnalysis } from "../features/calendar/api/marketApi";
import type { VacancyAnalysis, VacancyItem, MarketEffective, LongTermDiscount, ImmediateDiscount } from "../features/calendar/api/marketApi";

const API_URL = import.meta.env.VITE_API_URL;

interface PropertyInfo {
  id: number;
  name: string;
  code: string;
  region: string;
  airbnb_listing_id?: string;
  hostex_id?: number;
}

// 채널 약어 + 색상
const CHANNEL_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  airbnb: { label: "Air", bg: "bg-red-100", text: "text-red-600" },
  booking: { label: "Bkg", bg: "bg-blue-100", text: "text-blue-600" },
  agoda: { label: "Ago", bg: "bg-purple-100", text: "text-purple-600" },
  "삼삼엠투": { label: "삼투", bg: "bg-emerald-100", text: "text-emerald-600" },
  samsam: { label: "삼투", bg: "bg-emerald-100", text: "text-emerald-600" },
  "리브애니웨어": { label: "리브", bg: "bg-cyan-100", text: "text-cyan-600" },
  live: { label: "리브", bg: "bg-cyan-100", text: "text-cyan-600" },
  direct: { label: "직접", bg: "bg-gray-100", text: "text-gray-600" },
};

function getChannelInfo(channelName: string, channelType: string) {
  const key = channelName || channelType || "";
  return CHANNEL_STYLE[key.toLowerCase()] || CHANNEL_STYLE[channelType?.toLowerCase()] || { label: key.slice(0, 3) || "?", bg: "bg-gray-100", text: "text-gray-500" };
}

// 날짜 생성 (60일)
function generateDates(baseDate: Date, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(baseDate);
  start.setDate(start.getDate() - 7); // 1주 전부터
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function shortName(name: string): string {
  const m = name.match(/([A-Za-z0-9]+[_ ]+)?([가-힣][가-힣A-Za-z0-9]*)\s+(\d+)/);
  if (m) {
    const code = m[1] ? m[1].replace("_", " ").trim() : "";
    return code ? `${code} ${m[2]} ${m[3]}` : `${m[2]} ${m[3]}`;
  }
  const i = name.indexOf("_");
  return i > 0 ? name.slice(0, i) : name;
}

function formatPrice(price: number): string {
  if (!price) return "-";
  const man = price / 10000;
  return man >= 10 ? man.toFixed(0) : man.toFixed(1);
}

function isWeekend(date: string): boolean {
  const d = new Date(date);
  return d.getDay() === 5 || d.getDay() === 6; // 금, 토
}

function formatDateHeader(date: string): { day: string; weekday: string } {
  const d = new Date(date);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return { day: String(d.getDate()), weekday: weekdays[d.getDay()] };
}

const CELL_W = 52;
const LEFT_COL = 130;

export default function PriceCalendar() {
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [pricing, setPricing] = useState<PricingMap>({});
  const [compare, setCompare] = useState<PriceCompareMap>({});
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [links, setLinks] = useState<Record<number, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"hostex" | "compare" | "market" | "vacancy">("vacancy");
  const [vacancy, setVacancy] = useState<VacancyAnalysis | null>(null);
  const [vacancyLoading, setVacancyLoading] = useState(false);
  const [baseDate, setBaseDate] = useState(new Date());
  const dates = generateDates(baseDate, 60);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // 선택 상태
  const [selected, setSelected] = useState<Set<string>>(new Set()); // "propId:date"
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ propId: number; dateIdx: number } | null>(null);

  // 편집 모달
  const [showEdit, setShowEdit] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [samsamStatus, setSamsamStatus] = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [propRes, priceRes, calRes, compareRes, linksRes] = await Promise.all([
        fetch(`${API_URL}/properties?page=1&page_size=200&status=active`, { headers }).then(r => r.json()),
        fetchPricingData(startDate, endDate),
        fetchCalendarData(startDate, endDate),
        fetchPriceComparison(startDate, endDate).catch(() => ({ success: false, data: {} })),
        fetch(`${API_URL}/pricing/links`, { headers }).then(r => r.json()).catch(() => ({ success: false, data: {} })),
      ]);
      setProperties((propRes.properties || []).map((p: Record<string, unknown>) => ({
        id: p.id as number,
        name: (p.display_name || p.name) as string,
        code: p.code as string,
        region: (p.region as string) || "",
      })));
      if (priceRes.success && priceRes.data) {
        const normalized: PricingMap = {};
        for (const [k, v] of Object.entries(priceRes.data)) {
          normalized[Number(k)] = v;
        }
        setPricing(normalized);
      }
      if (calRes.success) setReservations(calRes.data.reservations || []);
      if (linksRes.success && linksRes.data) {
        const norm: Record<number, Record<string, string>> = {};
        for (const [k, v] of Object.entries(linksRes.data)) {
          norm[Number(k)] = v as Record<string, string>;
        }
        setLinks(norm);
      }
      if (compareRes.success && compareRes.data) {
        const normalized: PriceCompareMap = {};
        for (const [k, v] of Object.entries(compareRes.data)) {
          normalized[Number(k)] = v;
        }
        setCompare(normalized);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // 공실 분석 로드
  const loadVacancy = useCallback(async () => {
    setVacancyLoading(true);
    try {
      const res = await fetchVacancyAnalysis();
      if (res.success) setVacancy(res.data);
    } catch { /* */ } finally {
      setVacancyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "vacancy") loadVacancy();
  }, [viewMode, loadVacancy]);

  // 드래그 선택
  const handleMouseDown = (propId: number, dateIdx: number) => {
    setIsDragging(true);
    dragStart.current = { propId, dateIdx };
    setSelected(new Set([`${propId}:${dates[dateIdx]}`]));
  };

  const handleMouseEnter = (propId: number, dateIdx: number) => {
    if (!isDragging || !dragStart.current) return;
    const startIdx = Math.min(dragStart.current.dateIdx, dateIdx);
    const endIdx = Math.max(dragStart.current.dateIdx, dateIdx);
    const newSelected = new Set<string>();
    // 같은 숙소의 날짜 범위만 선택
    for (let i = startIdx; i <= endIdx; i++) {
      newSelected.add(`${dragStart.current.propId}:${dates[i]}`);
    }
    setSelected(newSelected);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (selected.size > 0) {
      setShowEdit(true);
    }
  };

  // 선택된 셀 정보
  const getSelectionInfo = () => {
    if (selected.size === 0) return null;
    const entries = Array.from(selected).map(s => {
      const [pid, date] = s.split(":");
      return { propertyId: parseInt(pid), date };
    });
    const propId = entries[0].propertyId;
    const prop = properties.find(p => p.id === propId);
    const sortedDates = entries.map(e => e.date).sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const firstPricing = (pricing[propId] || {})[firstDate];
    return { propId, prop, firstDate, lastDate, firstPricing, count: sortedDates.length };
  };

  // 네비게이션
  const goToday = () => setBaseDate(new Date());
  const goPrev = () => { const d = new Date(baseDate); d.setMonth(d.getMonth() - 1); setBaseDate(d); };
  const goNext = () => { const d = new Date(baseDate); d.setMonth(d.getMonth() + 1); setBaseDate(d); };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const todayIdx = dates.indexOf(todayStr);
    if (todayIdx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayIdx * CELL_W - scrollRef.current.clientWidth / 2 + LEFT_COL);
    }
  }, [dates]);

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">로딩 중...</div>;

  const title = `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">가격 캘린더</h1>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setViewMode("hostex")}
              className={`px-2 py-0.5 text-[10px] rounded ${viewMode === "hostex" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}
            >Hostex 가격</button>
            <button
              onClick={() => setViewMode("compare")}
              className={`px-2 py-0.5 text-[10px] rounded ${viewMode === "compare" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}
            >PriceLabs 비교</button>
            <button
              onClick={() => setViewMode("vacancy")}
              className={`px-2 py-0.5 text-[10px] rounded ${viewMode === "vacancy" ? "bg-red-600 text-white" : "bg-red-50 text-red-500"}`}
            >공실 현황</button>
            <button
              onClick={() => setViewMode("market")}
              className={`px-2 py-0.5 text-[10px] rounded ${viewMode === "market" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-500"}`}
            >시장 데이터</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">&larr;</button>
          <button onClick={goToday} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium hover:bg-gray-50">오늘</button>
          <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center">{title}</span>
          <button onClick={goNext} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">&rarr;</button>
          <button
            onClick={async () => {
              setSamsamStatus("확인 중...");
              try {
                const res = await fetch(`${API_URL}/pricing/samsam/check`, { method: "POST", headers });
                const data = await res.json();
                setSamsamStatus(data.data?.message || "확인 완료");
                setTimeout(() => setSamsamStatus(null), 5000);
              } catch { setSamsamStatus("연결 실패"); setTimeout(() => setSamsamStatus(null), 3000); }
            }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          >삼삼엠투</button>
          {samsamStatus && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{samsamStatus}</span>}
          <button onClick={() => setShowManual(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">히로가이드</button>
          <a
            href="https://app.pricelabs.co/multicalendar"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
          >
            PriceLabs &nearr;
          </a>
          <a
            href="https://hostex.io/app/price"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
          >
            Hostex 가격 &nearr;
          </a>
        </div>
      </div>

      {/* 공실 현황 모드 */}
      {viewMode === "vacancy" ? (
        <VacancyDashboard data={vacancy} loading={vacancyLoading} onRefresh={loadVacancy} />
      ) : viewMode === "market" ? (
        <MarketDataPanel onBack={() => setViewMode("compare")} />
      ) : (
      <>
      {/* 캘린더 그리드 */}
      <div
        ref={scrollRef}
        className="rounded-lg border border-gray-200 bg-white overflow-auto select-none"
        style={{ maxHeight: "calc(100vh - 140px)" }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (isDragging) { setIsDragging(false); if (selected.size > 0) setShowEdit(true); } }}
      >
        <div style={{ width: LEFT_COL + dates.length * CELL_W }}>
          {/* 헤더 */}
          <div className="sticky top-0 z-20 flex border-b border-gray-200">
            <div
              className="sticky left-0 z-30 flex-shrink-0 border-r border-gray-200 bg-gray-50 px-3 flex items-center text-xs font-semibold text-gray-500"
              style={{ width: LEFT_COL, height: 40 }}
            >
              숙소 ({properties.length})
            </div>
            <div className="flex">
              {dates.map(date => {
                const { day, weekday } = formatDateHeader(date);
                const weekend = isWeekend(date);
                const today = date === new Date().toISOString().split("T")[0];
                return (
                  <div
                    key={date}
                    className={`flex-shrink-0 border-r border-gray-100 flex flex-col items-center justify-center ${
                      today ? "bg-blue-50" : weekend ? "bg-orange-50/50" : "bg-gray-50"
                    }`}
                    style={{ width: CELL_W, height: 40 }}
                  >
                    <span className={`text-xs font-bold ${today ? "text-blue-600" : weekend ? "text-orange-500" : "text-gray-700"}`}>{day}</span>
                    <span className={`text-[9px] ${weekend ? "text-orange-400" : "text-gray-400"}`}>{weekday}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 숙소 행 */}
          {properties.map(prop => {
            const propPricing = pricing[prop.id] || {};
            // 이 숙소의 예약 목록
            const propReservations = reservations.filter(
              r => r.internal_prop_id === prop.id && r.status !== "cancelled"
            );

            return (
              <div key={prop.id} className="flex border-b border-gray-50 hover:bg-gray-50/30">
                {/* 숙소명 */}
                <div
                  className="sticky left-0 z-10 flex-shrink-0 border-r border-gray-200 bg-white px-2 flex items-center gap-1"
                  style={{ width: LEFT_COL, height: 44 }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-900" title={prop.display_name || prop.name}>
                      {shortName(prop.display_name || prop.name)}
                    </div>
                    <div className="text-[9px] text-gray-400">{prop.region}</div>
                  </div>
                  <div className="flex flex-shrink-0 gap-0.5">
                    {links[prop.id]?.airbnb && (
                      <a
                        href={`https://www.airbnb.com/rooms/${links[prop.id].airbnb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] text-red-400 hover:text-red-600"
                        title="Airbnb 리스팅"
                        onClick={e => e.stopPropagation()}
                      >A</a>
                    )}
                    {links[prop.id]?.agoda && (
                      <a
                        href={`https://www.agoda.com/hotel/${links[prop.id].agoda}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] text-purple-400 hover:text-purple-600"
                        title="Agoda 리스팅"
                        onClick={e => e.stopPropagation()}
                      >G</a>
                    )}
                  </div>
                </div>

                {/* 가격 셀 + 예약 바 오버레이 */}
                <div className="relative flex" style={{ height: 44 }}>
                  {/* 배경: 가격 셀 */}
                  {dates.map((date, dateIdx) => {
                    const day = propPricing[date];
                    const isSelected = selected.has(`${prop.id}:${date}`);
                    const weekend = isWeekend(date);
                    const today = date === new Date().toISOString().split("T")[0];
                    const hasReservation = propReservations.some(
                      r => r.check_in_date <= date && r.check_out_date > date
                    );

                    // 예약 있는 셀은 빈 배경 (바가 위에 올라감)
                    if (hasReservation) {
                      return (
                        <div
                          key={date}
                          className="flex-shrink-0 border-r border-gray-50"
                          style={{ width: CELL_W, height: 44 }}
                        />
                      );
                    }

                    if (!day) {
                      return (
                        <div
                          key={date}
                          className={`flex-shrink-0 border-r border-gray-50 flex items-center justify-center ${
                            today ? "bg-blue-50/30" : weekend ? "bg-orange-50/20" : ""
                          }`}
                          style={{ width: CELL_W, height: 44 }}
                        >
                          <span className="text-[10px] text-gray-200">-</span>
                        </div>
                      );
                    }

                    const blocked = !day.available;
                    const comp = (compare[prop.id] || {})[date] as PriceCompareDay | undefined;
                    const showCompare = viewMode === "compare" && comp;

                    // 수요 색상을 배경에 적용 (compare 모드)
                    let cellBg = "";
                    if (isSelected) cellBg = "bg-blue-100 ring-1 ring-blue-400 ring-inset";
                    else if (blocked) cellBg = "bg-red-50";
                    else if (showCompare && comp.demand_color) cellBg = "";  // inline style로 처리
                    else if (today) cellBg = "bg-blue-50/30";
                    else if (weekend) cellBg = "bg-orange-50/20";

                    const demandBg = showCompare && comp.demand_color && !isSelected && !blocked
                      ? { backgroundColor: comp.demand_color + "40" } // 25% 투명도
                      : {};

                    // 차이율 표시
                    const diffText = showCompare && comp.diff_percent
                      ? (comp.diff_percent > 0 ? `+${comp.diff_percent.toFixed(0)}%` : `${comp.diff_percent.toFixed(0)}%`)
                      : "";
                    const diffColor = comp && comp.diff_percent > 10 ? "text-red-500" : comp && comp.diff_percent < -10 ? "text-blue-500" : "text-gray-400";

                    return (
                      <div
                        key={date}
                        className={`flex-shrink-0 border-r border-gray-50 flex flex-col items-center justify-center cursor-pointer transition-colors ${cellBg}`}
                        style={{ width: CELL_W, height: 44, ...demandBg }}
                        onMouseDown={() => handleMouseDown(prop.id, dateIdx)}
                        onMouseEnter={() => handleMouseEnter(prop.id, dateIdx)}
                        title={showCompare
                          ? `Hostex: ₩${comp.hostex_price.toLocaleString()} | PriceLabs: ₩${comp.pricelabs_price.toLocaleString()} | AI: ₩${comp.ai_recommended.toLocaleString()} | ${comp.demand_desc} | 최소${comp.min_stay}박`
                          : `₩${day.price.toLocaleString()} | 최소 ${day.min_stay}박${blocked ? " | 차단" : ""}`
                        }
                      >
                        <span className={`text-xs font-semibold leading-none ${
                          blocked ? "text-red-400 line-through" :
                          isSelected ? "text-blue-700" : "text-gray-700"
                        }`}>
                          {formatPrice(showCompare ? comp.hostex_price || day.price : day.price)}
                        </span>
                        {showCompare && diffText ? (
                          <span className={`leading-none mt-0.5 font-medium ${diffColor}`} style={{ fontSize: 8 }}>
                            {diffText}
                          </span>
                        ) : (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {day.min_stay > 1 && !blocked && (
                              <span className="text-[8px] text-blue-400 font-medium">{day.min_stay}박</span>
                            )}
                            {blocked && (
                              <span className="text-[8px] text-red-400 font-medium">차단</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 예약 바 오버레이 (absolute positioned) */}
                  {propReservations.map(res => {
                    const startIdx = dates.indexOf(res.check_in_date);
                    const endIdx = dates.indexOf(res.check_out_date);
                    // 범위 밖이면 클램핑
                    const visStart = Math.max(startIdx >= 0 ? startIdx : 0, 0);
                    const visEnd = endIdx >= 0 ? endIdx : dates.length;
                    if (visStart >= dates.length || visEnd <= 0) return null;
                    const left = visStart * CELL_W;
                    const width = (visEnd - visStart) * CELL_W;
                    if (width <= 0) return null;

                    const ch = getChannelInfo(res.channel_name, res.channel_type);
                    const isStart = startIdx >= 0 && startIdx < dates.length;
                    const isEnd = endIdx >= 0 && endIdx <= dates.length;
                    const perNight = res.total_rate && res.nights ? Math.round(res.total_rate / res.nights / 10000 * 10) / 10 : 0;

                    return (
                      <div
                        key={res.id}
                        className={`absolute top-1 flex items-center gap-1 px-1.5 overflow-hidden ${ch.bg} ${
                          isStart && isEnd ? "rounded-lg" :
                          isStart ? "rounded-l-lg" :
                          isEnd ? "rounded-r-lg" : ""
                        }`}
                        style={{
                          left,
                          width: width - 2,
                          height: 34,
                          zIndex: 5,
                        }}
                        title={`${res.guest_name} · ${res.channel_name || res.channel_type} · ${res.nights}박 · ₩${(res.total_rate || 0).toLocaleString()}`}
                      >
                        <span className={`text-[9px] font-bold ${ch.text} flex-shrink-0`}>{ch.label}</span>
                        {width > 80 && (
                          <span className="text-[9px] text-gray-600 truncate">{res.guest_name}</span>
                        )}
                        {width > 140 && perNight > 0 && (
                          <span className="text-[8px] text-gray-400 flex-shrink-0">{perNight}만/박</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-400">
        <span>숫자 = 만원 단위</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" /> Air = Airbnb</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" /> Bkg = Booking</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> 삼투 = 삼삼엠투</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" /> 수동 차단</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-50 border border-orange-200" /> 주말</span>
        <span className="flex items-center gap-1">- = 미연동</span>
      </div>
      </>
      )}

      {/* 히로가이드 */}
      {showManual && <OperationManual page="price-calendar" onClose={() => setShowManual(false)} />}

      {/* 일괄 수정 모달 */}
      {showEdit && selected.size > 0 && <BulkEditModal
        info={getSelectionInfo()!}
        onClose={() => { setShowEdit(false); setSelected(new Set()); }}
        onSaved={() => { setShowEdit(false); setSelected(new Set()); loadData(); }}
      />}
    </div>
  );
}

// ============================================================
// 일괄 수정 모달
// ============================================================
interface SelectionInfo {
  propId: number;
  prop: PropertyInfo | undefined;
  firstDate: string;
  lastDate: string;
  firstPricing: DayPricing | undefined;
  count: number;
}

function BulkEditModal({ info, onClose, onSaved }: {
  info: SelectionInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"fixed" | "percent">("fixed");
  const [price, setPrice] = useState(info.firstPricing?.price || 0);
  const [percent, setPercent] = useState(0);
  const [minStay, setMinStay] = useState(info.firstPricing?.min_stay || 1);
  const [blocked, setBlocked] = useState(!info.firstPricing?.available);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [changePrice, setChangePrice] = useState(false);
  const [changeMinStay, setChangeMinStay] = useState(false);
  const [changeBlock, setChangeBlock] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (changePrice) {
        const finalPrice = mode === "percent"
          ? Math.round((info.firstPricing?.price || 0) * (1 + percent / 100))
          : price;
        await updatePrice(info.propId, info.firstDate, info.lastDate, finalPrice);
      }
      if (changeMinStay) {
        await updateRestrictions(info.propId, info.firstDate, info.lastDate, minStay);
      }
      if (changeBlock) {
        await updateAvailability(info.propId, info.firstDate, info.lastDate, blocked);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경 실패");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth()+1}/${dt.getDate()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">가격 일괄 변경</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {info.prop ? shortName((info.prop as PropertyInfo & { display_name?: string }).display_name || info.prop.name) : `숙소 #${info.propId}`}
            {" · "}
            {fmt(info.firstDate)}~{fmt(info.lastDate)} ({info.count}일)
          </p>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {/* 가격 변경 */}
        <div className="mb-4 rounded-lg border border-gray-100 p-3">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={changePrice} onChange={e => setChangePrice(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">가격 변경</span>
          </label>
          {changePrice && (
            <div className="ml-6 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("fixed")}
                  className={`px-3 py-1 text-xs rounded-lg border ${mode === "fixed" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500"}`}
                >고정 금액</button>
                <button
                  onClick={() => setMode("percent")}
                  className={`px-3 py-1 text-xs rounded-lg border ${mode === "percent" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500"}`}
                >% 조정</button>
              </div>
              {mode === "fixed" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">₩</span>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(parseInt(e.target.value) || 0)}
                    step={1000}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={percent}
                    onChange={e => setPercent(parseInt(e.target.value) || 0)}
                    className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <span className="text-xs text-gray-400">
                    (현재 ₩{(info.firstPricing?.price || 0).toLocaleString()} → ₩{Math.round((info.firstPricing?.price || 0) * (1 + percent / 100)).toLocaleString()})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 최소 숙박 */}
        <div className="mb-4 rounded-lg border border-gray-100 p-3">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={changeMinStay} onChange={e => setChangeMinStay(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">최소 숙박 변경</span>
          </label>
          {changeMinStay && (
            <div className="ml-6">
              <select
                value={minStay}
                onChange={e => setMinStay(parseInt(e.target.value))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              >
                {[1,2,3,4,5,6,7,14,30].map(n => <option key={n} value={n}>{n}박</option>)}
              </select>
            </div>
          )}
        </div>

        {/* 차단 */}
        <div className="mb-5 rounded-lg border border-gray-100 p-3">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={changeBlock} onChange={e => setChangeBlock(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm font-medium text-gray-700">가용성 변경</span>
          </label>
          {changeBlock && (
            <div className="ml-6 flex gap-2">
              <button
                onClick={() => setBlocked(true)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${blocked ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-500"}`}
              >차단</button>
              <button
                onClick={() => setBlocked(false)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${!blocked ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-500"}`}
              >열기</button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || (!changePrice && !changeMinStay && !changeBlock)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "Hostex에 반영"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 공실 현황 대시보드
// ============================================================
function VacancyDashboard({ data, loading, onRefresh }: {
  data: VacancyAnalysis | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "ok">("all");
  const [sortBy, setSortBy] = useState<"urgency" | "occupancy" | "zone">("urgency");

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">공실 분석 중...</div>;
  if (!data) return <div className="flex h-64 items-center justify-center text-gray-400">데이터 없음</div>;

  const filtered = data.items.filter(item => filter === "all" || item.urgency === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "occupancy") return a.occupancy_rate_30 - b.occupancy_rate_30;
    if (sortBy === "zone") return a.zone_code.localeCompare(b.zone_code);
    const uo: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
    if (uo[a.urgency] !== uo[b.urgency]) return uo[a.urgency] - uo[b.urgency];
    return b.vacant_days - a.vacant_days;
  });

  const urgencyStyle: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "긴급" },
    warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "주의" },
    ok: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "정상" },
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-6 gap-3">
        <SummaryCard label="전체 숙소" value={data.total_properties} unit="개" />
        <SummaryCard label="현재 공실" value={data.vacant_now} unit="개" color="red" />
        <SummaryCard label="7일 내 공실" value={data.vacant_in_7_days} unit="개" color="amber" />
        <SummaryCard label="긴급 (7일+)" value={data.critical_count} unit="개" color="red" />
        <SummaryCard label="주의" value={data.warning_count} unit="개" color="amber" />
        <SummaryCard label="평균 가동률" value={data.avg_occupancy_30} unit="%" color={data.avg_occupancy_30 < 60 ? "red" : data.avg_occupancy_30 < 80 ? "amber" : "green"} />
      </div>

      {/* 권역별 가동률 + 실제 판매가 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="text-xs font-bold text-gray-700 mb-2">권역별 가동률</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.zone_summary?.map(z => (
              <div key={z.zone_code} className="flex items-center gap-2 text-xs">
                <span className="font-bold text-gray-700 w-6">{z.zone_code}</span>
                <span className="text-gray-400 w-16 truncate">{z.building}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 relative">
                  <div
                    className={`h-3 rounded-full ${z.occupancy < 50 ? "bg-red-400" : z.occupancy < 75 ? "bg-amber-400" : "bg-green-400"}`}
                    style={{ width: `${z.occupancy}%` }}
                  />
                </div>
                <span className="w-10 text-right font-medium">{z.occupancy}%</span>
                <span className="w-14 text-right text-gray-400">{z.vacant}/{z.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="text-xs font-bold text-gray-700 mb-2">권역별 실제 판매가 (중기채널, 박당)</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.zone_pricing?.map(z => (
              <div key={z.zone_code} className="flex items-center gap-2 text-xs">
                <span className="font-bold text-gray-700 w-6">{z.zone_code}</span>
                <span className="text-gray-400 w-14 truncate">{z.building}</span>
                <div className="flex-1 flex items-center gap-1 flex-wrap">
                  {z.samsam_avg > 0 && <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px]">삼투 {(z.samsam_avg/10000).toFixed(1)}만</span>}
                  {z.live_avg > 0 && <span className="px-1 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[9px]">리브 {(z.live_avg/10000).toFixed(1)}만</span>}
                  {z.personal_avg > 0 && <span className="px-1 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px]">개인 {(z.personal_avg/10000).toFixed(1)}만</span>}
                  {z.airbnb_avg > 0 && <span className="px-1 py-0.5 rounded bg-red-50 text-red-400 text-[9px]">BnB {(z.airbnb_avg/10000).toFixed(1)}만({z.airbnb_bookings})</span>}
                </div>
                <span className="w-12 text-right font-bold text-gray-800">{z.avg_nightly > 0 ? `${(z.avg_nightly/10000).toFixed(1)}만` : "-"}</span>
                <span className="w-8 text-right text-gray-400 text-[9px]">{z.total_bookings}건</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
            * Airbnb/Agoda 제외, 삼삼엠투·리브·개인 중기임대 채널 기준
          </div>
        </div>
      </div>

      {/* 필터 + 정렬 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["all", "critical", "warning", "ok"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[10px] rounded-lg border ${filter === f
                ? f === "critical" ? "bg-red-600 text-white border-red-600"
                : f === "warning" ? "bg-amber-500 text-white border-amber-500"
                : f === "ok" ? "bg-green-600 text-white border-green-600"
                : "bg-gray-900 text-white border-gray-900"
                : "border-gray-200 text-gray-500"}`}
            >
              {f === "all" ? `전체 (${data.items.length})` :
               f === "critical" ? `긴급 (${data.critical_count})` :
               f === "warning" ? `주의 (${data.warning_count})` :
               `정상 (${data.items.length - data.critical_count - data.warning_count})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as "urgency" | "occupancy" | "zone")}
            className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-600"
          >
            <option value="urgency">긴급도순</option>
            <option value="occupancy">가동률순</option>
            <option value="zone">권역순</option>
          </select>
          <button onClick={onRefresh} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500 hover:bg-gray-50">
            새로고침
          </button>
        </div>
      </div>

      {/* 시장 실질비용 (체류기간별) */}
      {data.market_effective?.length > 0 && (
        <MarketEffectiveTable items={data.market_effective} />
      )}

      {/* 숙소 리스트 */}
      <VacancyListTable items={sorted} urgencyStyle={urgencyStyle} marketItems={data.market_effective} />
    </div>
  );
}

function calcCosts(rent: number, maint: number, cleaning: number, longDisc?: LongTermDiscount[] | null, immDisc?: ImmediateDiscount[] | null) {
  const bestImm = immDisc?.reduce((max, d) => Math.max(max, d.amount), 0) || 0;
  return [1, 2, 3, 4].map(w => {
    let discPct = 0;
    longDisc?.forEach(d => { if (w >= d.min_weeks && d.percent > discPct) discPct = d.percent; });
    const discountedRent = Math.round(rent * (100 - discPct) / 100);
    const total = Math.max(0, (discountedRent + maint) * w + cleaning - bestImm);
    const nights = w * 7;
    return { weeks: w, total_cost: total, nightly: Math.round(total / nights), weekly: Math.round(total / w) };
  });
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShow(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-300 text-gray-600 text-[8px] font-normal cursor-help align-middle ml-0.5"
      >i</span>
      {show && (
        <div
          className="fixed z-[9999] w-64 p-3 rounded-lg bg-gray-900 text-white text-[11px] font-normal leading-relaxed shadow-xl whitespace-pre-line pointer-events-none"
          style={{ left: Math.min(pos.x, window.innerWidth - 280), top: pos.y - 8, transform: "translateY(-100%)" }}
        >{text}</div>
      )}
    </>
  );
}

function VacancyListTable({ items, urgencyStyle, marketItems }: {
  items: VacancyItem[];
  urgencyStyle: Record<string, { bg: string; text: string; label: string }>;
  marketItems: MarketEffective[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [priceAdj, setPriceAdj] = useState<Record<number, number>>({});
  const [vSortKey, setVSortKey] = useState<string>("urgency");
  const [vSortAsc, setVSortAsc] = useState(true);
  const STEP = 10000;

  const toggleVSort = (key: string) => {
    if (vSortKey === key) { setVSortAsc(!vSortAsc); } else { setVSortKey(key); setVSortAsc(true); }
  };
  const vArrow = (key: string) => vSortKey === key ? (vSortAsc ? " ▲" : " ▼") : "";

  // property_id로 시장 매물 매칭
  const marketByPropId: Record<number, MarketEffective> = {};
  marketItems?.forEach(m => { if (m.property_id) marketByPropId[m.property_id] = m; });

  const urgencyOrder: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
  const sortedItems = [...items].sort((a, b) => {
    let va = 0, vb = 0;
    switch (vSortKey) {
      case "urgency": {
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return vSortAsc ? urgencyOrder[a.urgency] - urgencyOrder[b.urgency] : urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        return vSortAsc ? b.vacant_days - a.vacant_days : a.vacant_days - b.vacant_days;
      }
      case "name": { const r = a.display_name.localeCompare(b.display_name); return vSortAsc ? r : -r; }
      case "vacant": va = a.vacant_days >= 999 ? 9999 : a.vacant_days; vb = b.vacant_days >= 999 ? 9999 : b.vacant_days; break;
      case "occupancy": va = a.occupancy_rate_30; vb = b.occupancy_rate_30; break;
      case "our_avg": va = a.our_avg_nightly; vb = b.our_avg_nightly; break;
      case "zone_avg": va = a.zone_avg_nightly; vb = b.zone_avg_nightly; break;
      case "suggested": va = a.suggested_weekly; vb = b.suggested_weekly; break;
      case "drop": va = a.price_drop_pct; vb = b.price_drop_pct; break;
      default: return 0;
    }
    return vSortAsc ? va - vb : vb - va;
  });

  const adjustPrice = (id: number, delta: number) => {
    setPriceAdj(prev => ({ ...prev, [id]: (prev[id] || 0) + delta }));
  };

  const f = (n: number) => n > 0 ? `${(n / 10000).toFixed(1)}` : "-";

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {([
              { key: "urgency", label: "상태", align: "text-left", tip: "긴급: 7일 이상 공실 · 주의: 현재 공실 또는 3일 내 공실 예정 · 정상: 투숙 중이고 다음 예약 있음" },
              { key: "name", label: "숙소", align: "text-left", tip: "" },
              { key: "vacant", label: "공실일", align: "text-center", tip: "무기한: 다음 예약이 전혀 없음 · N일: 오늘부터 다음 체크인까지 남은 공실 일수 · 오늘: 오늘 체크인 예정 · N일후: 현재 투숙 중, 체크아웃 후 공실 예정" },
              { key: "occupancy", label: "가동률", align: "text-center", tip: "최근 30일간 예약이 차 있었던 비율 (투숙일수/30일)" },
              { key: "", label: "현재/다음 예약", align: "text-left", tip: "" },
              { key: "our_avg", label: "우리 평균(박당)", align: "text-right", tip: "2026년 중기채널(삼삼엠투·리브·개인) 예약의 평균 박당 가격. Airbnb/Agoda 제외" },
              { key: "zone_avg", label: "권역 평균", align: "text-right", tip: "같은 권역(알파벳 코드) 전체 숙소의 중기채널 평균 박당 가격" },
              { key: "suggested", label: "추천 주간가", align: "text-center", tip: "우리 평균 또는 권역 평균 기반 추천. 긴급 -15%, 주의 -8%. 권역 삼삼엠투 평균의 70% 이하로는 내리지 않음" },
              { key: "drop", label: "할인", align: "text-right", tip: "현재 평균 대비 추천 할인율. 0%면 가격 유지" },
            ]).map((col, ci) => (
              <th
                key={ci}
                onClick={col.key ? () => toggleVSort(col.key) : undefined}
                className={`px-3 py-2 font-semibold text-gray-600 select-none ${col.align} ${col.key ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                {col.label}{col.key ? vArrow(col.key) : ""}
                {col.tip && <InfoTip text={col.tip} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedItems.map(item => {
            const s = urgencyStyle[item.urgency];
            const market = marketByPropId[item.property_id];
            const isExpanded = expandedId === item.property_id;
            const adj = priceAdj[item.property_id] || 0;
            const baseWeekly = item.suggested_weekly || (item.zone_avg_nightly ? item.zone_avg_nightly * 7 : 0);
            const currentWeekly = baseWeekly + adj;

            return (
              <Fragment key={item.property_id}>
                <tr
                  className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${item.urgency === "critical" ? "bg-red-50/30" : ""} ${isExpanded ? "bg-blue-50/30" : ""}`}
                  onClick={() => setExpandedId(isExpanded ? null : item.property_id)}
                >
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${s.bg} ${s.text}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{item.display_name}</div>
                    <div className="text-[9px] text-gray-400">
                      {item.zone_code}권역 · {item.building} · {item.total_bookings}건
                      {market && <span className="text-emerald-500 ml-1">· 삼투: {market.room_name}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-bold ${item.vacant_days >= 14 ? "text-red-600" : item.vacant_days >= 7 ? "text-amber-600" : item.vacant_days > 0 ? "text-gray-600" : "text-green-600"}`}>
                      {item.vacant_days >= 999 ? "무기한" : item.vacant_days > 0 ? `${item.vacant_days}일` : item.vacant_days === 0 ? "오늘" : `${Math.abs(item.vacant_days)}일후`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-12 bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${item.occupancy_rate_30 < 40 ? "bg-red-400" : item.occupancy_rate_30 < 70 ? "bg-amber-400" : "bg-green-400"}`}
                          style={{ width: `${Math.min(item.occupancy_rate_30, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-600">{item.occupancy_rate_30}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {item.current_booking ? (
                      <div className="text-[10px]">
                        <span className="text-green-600 font-medium">투숙중</span>
                        <span className="text-gray-400 ml-1">~{item.current_booking.check_out}</span>
                        <span className="text-gray-400 ml-1">{item.current_booking.channel}</span>
                      </div>
                    ) : (
                      <span className="text-red-500 font-medium text-[10px]">공실</span>
                    )}
                    {item.next_booking && (
                      <div className="text-[10px] text-gray-400">
                        다음: {item.next_booking.check_in} ({item.next_booking.channel})
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.our_avg_nightly > 0 ? (
                      <div>
                        <span className="font-medium text-gray-800">{f(item.our_avg_nightly)}만</span>
                        <div className="text-[9px] text-gray-400">
                          {item.our_samsam_nightly > 0 && <span className="text-emerald-600">삼{f(item.our_samsam_nightly)} </span>}
                          {item.our_other_nightly > 0 && <span>개{f(item.our_other_nightly)}</span>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-[10px]">판매이력없음</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.zone_avg_nightly > 0 ? (
                      <span className="text-gray-500">{f(item.zone_avg_nightly)}만</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    {item.suggested_headline > 0 || item.current_headline > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => adjustPrice(item.property_id, -STEP)} className="w-5 h-5 rounded bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-sm font-bold leading-none">-</button>
                        <div className="text-center min-w-[70px]">
                          {item.current_headline > 0 && (
                            <div className={`text-[9px] ${item.headline_diff > 0 ? "text-red-400 line-through" : "text-gray-400"}`}>
                              현재 {f(item.current_headline)}만
                            </div>
                          )}
                          <div className={`font-bold ${adj !== 0 ? "text-amber-700" : "text-blue-600"}`}>
                            {f((item.suggested_headline || item.current_headline) + adj)}만
                          </div>
                          {item.headline_diff > 0 && adj === 0 && (
                            <div className="text-[9px] text-red-500 font-medium">↓{f(item.headline_diff)}만</div>
                          )}
                          {adj !== 0 && (
                            <div className="text-[9px]">
                              <span className={adj < 0 ? "text-red-500" : "text-blue-500"}>{adj > 0 ? "+" : ""}{f(adj)}만</span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => adjustPrice(item.property_id, STEP)} className="w-5 h-5 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center text-sm font-bold leading-none">+</button>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.price_drop_pct > 0 ? (
                      <span className="font-bold text-red-500">-{item.price_drop_pct}%</span>
                    ) : (
                      <span className="text-green-500 text-[10px]">유지</span>
                    )}
                  </td>
                </tr>
                {/* 확장: 시장 데이터 비교 */}
                {isExpanded && market && (
                  <tr className="bg-emerald-50/30 border-b border-emerald-100">
                    <td colSpan={9} className="px-4 py-2">
                      <div className="flex items-start gap-6 text-[10px]">
                        <div>
                          <div className="font-bold text-emerald-700 mb-1">삼삼엠투 현재 설정</div>
                          <div className="text-gray-600">매물명: <span className="text-gray-900">{market.room_name}</span></div>
                          <div className="text-gray-600">표시가: <span className="font-bold">{f(market.rent_weekly)}만/주</span> · 관리비: {f(market.maintenance_weekly)}만 · 청소비: {f(market.cleaning_fee)}만</div>
                        </div>
                        <div>
                          <div className="font-bold text-emerald-700 mb-1">실질비용 (할인 적용)</div>
                          {(() => {
                            const mc = calcCosts(market.rent_weekly, market.maintenance_weekly, market.cleaning_fee, market.long_term_discounts, market.immediate_discounts);
                            return (
                              <div className="flex gap-3">
                                <span>1주: <span className="font-bold">{f(mc[0].weekly)}만</span></span>
                                <span>2주: <span className="font-bold">{f(mc[1].weekly)}만</span> ({f(mc[1].total_cost)}만)</span>
                                <span>4주: <span className="font-bold">{f(mc[3].weekly)}만</span> ({f(mc[3].total_cost)}만)</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <div className="font-bold text-emerald-700 mb-1">할인</div>
                          <div className="flex gap-2">
                            {market.long_term_discounts?.map((d, i) => <span key={i} className="text-orange-600">{d.min_weeks}주+ → {d.percent}%↓</span>)}
                            {market.immediate_discounts?.map((d, i) => <span key={i} className="text-pink-600">즉시{d.within_days}일 → {d.amount/10000}만↓</span>)}
                            {!market.long_term_discounts?.length && !market.immediate_discounts?.length && <span className="text-gray-400">없음</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {isExpanded && !market && (
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <td colSpan={9} className="px-4 py-2 text-[10px] text-gray-400">
                      삼삼엠투 매칭 데이터 없음
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type SortKey = "name" | "hiero" | "rent" | "maint" | "clean" | "w1" | "w2" | "w3" | "w4" | "distortion";

function MarketEffectiveTable({ items }: { items: MarketEffective[] }) {
  const [expanded, setExpanded] = useState(false);
  const [regionFilter, setRegionFilter] = useState("all");
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [sortKey, setSortKey] = useState<SortKey>("rent");
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) { setSortAsc(!sortAsc); } else { setSortKey(key); setSortAsc(true); }
  };

  const regions = [...new Set(items.map(i => i.region).filter(Boolean))];
  const filtered = regionFilter === "all" ? items : items.filter(i => i.region === regionFilter);

  const sorted = [...filtered].sort((a, b) => {
    let va = 0, vb = 0;
    switch (sortKey) {
      case "name": { const r = a.room_name.localeCompare(b.room_name); return sortAsc ? r : -r; }
      case "hiero": { const r = (a.display_name || "zzz").localeCompare(b.display_name || "zzz"); return sortAsc ? r : -r; }
      case "rent": va = a.rent_weekly; vb = b.rent_weekly; break;
      case "maint": va = a.maintenance_weekly; vb = b.maintenance_weekly; break;
      case "clean": va = a.cleaning_fee; vb = b.cleaning_fee; break;
      case "w1": va = a.costs[0]?.weekly || 0; vb = b.costs[0]?.weekly || 0; break;
      case "w2": va = a.costs[1]?.weekly || 0; vb = b.costs[1]?.weekly || 0; break;
      case "w3": va = a.costs[2]?.weekly || 0; vb = b.costs[2]?.weekly || 0; break;
      case "w4": va = a.costs[3]?.weekly || 0; vb = b.costs[3]?.weekly || 0; break;
      case "distortion": {
        const da = a.costs[0] && a.costs[3] && a.costs[3].nightly > 0 ? (a.costs[0].nightly - a.costs[3].nightly) / a.costs[3].nightly : 0;
        const db = b.costs[0] && b.costs[3] && b.costs[3].nightly > 0 ? (b.costs[0].nightly - b.costs[3].nightly) / b.costs[3].nightly : 0;
        va = da * 100; vb = db * 100; break;
      }
    }
    return sortAsc ? va - vb : vb - va;
  });

  const shown = expanded ? sorted : sorted.slice(0, 10);
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  const adjust = (idx: number, delta: number) => {
    setAdjustments(prev => ({ ...prev, [idx]: (prev[idx] || 0) + delta }));
  };
  const reset = (idx: number) => {
    setAdjustments(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const f = (n: number) => n > 0 ? `${(n / 10000).toFixed(1)}` : "-";
  const STEP = 10000; // 1만원 단위

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-bold text-gray-700">시장 실질비용 분석 (삼삼엠투 매물)</h3>
          <p className="text-[10px] text-gray-400">표시가 조정 시 실질비용이 실시간 변동 — 1만원 단위 ▲▼</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(adjustments).length > 0 && (
            <button onClick={() => setAdjustments({})} className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50">전체 초기화</button>
          )}
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="rounded border border-gray-200 px-2 py-0.5 text-[10px]"
          >
            <option value="all">전체 지역</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {([
              { key: "hiero" as SortKey, label: "매물", align: "text-left", color: "text-gray-500" },
              { key: "rent" as SortKey, label: "표시가(주)", align: "text-center", color: "text-gray-500" },
              { key: "maint" as SortKey, label: "관리비 · 청소비", align: "text-right", color: "text-gray-500" },
              { key: "w1" as SortKey, label: "1주 실질 · 1박", align: "text-right", color: "text-emerald-600" },
              { key: "w2" as SortKey, label: "2주 실질", align: "text-right", color: "text-blue-600" },
              { key: "w4" as SortKey, label: "4주(1달) 실질", align: "text-right", color: "text-gray-600" },
              { key: "distortion" as SortKey, label: "착시폭", align: "text-right", color: "text-gray-500" },
            ]).map((col, ci) => (
              <th
                key={ci}
                onClick={() => toggleSort(col.key)}
                className={`px-2 py-1.5 font-semibold cursor-pointer hover:bg-gray-100 select-none ${col.align} ${col.color}`}
              >
                {col.label}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((m, idx) => {
            const adj = adjustments[idx] || 0;
            const currentRent = m.rent_weekly + adj;
            const changed = adj !== 0;
            const costs = calcCosts(currentRent, m.maintenance_weekly, m.cleaning_fee, m.long_term_discounts, m.immediate_discounts);
            const origCosts = calcCosts(m.rent_weekly, m.maintenance_weekly, m.cleaning_fee, m.long_term_discounts, m.immediate_discounts);
            const hasLongDisc = m.long_term_discounts && m.long_term_discounts.length > 0;
            const hasImmDisc = m.immediate_discounts && m.immediate_discounts.length > 0;
            const c1 = costs[0];
            const c4 = costs[3];
            const distortion = c1 && c4 && c4.nightly > 0 ? Math.round((c1.nightly - c4.nightly) / c4.nightly * 100) : 0;

            return (
              <tr key={idx} className={`border-b border-gray-50 hover:bg-gray-50/50 ${m.display_name ? "bg-blue-50/20" : ""} ${changed ? "ring-1 ring-inset ring-amber-300 bg-amber-50/30" : ""}`}>
                <td className="px-2 py-1.5">
                  {m.display_name ? (
                    <div>
                      <div className="font-medium text-gray-900">{m.display_name}</div>
                      <div className="text-[9px] text-gray-400 truncate max-w-[180px]" title={m.room_name}>삼투: {m.room_name}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-gray-500">{m.room_name}</div>
                      <div className="text-[9px] text-gray-300">{m.region}</div>
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => adjust(idx, -STEP)}
                      className="w-5 h-5 rounded bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-sm font-bold leading-none"
                    >-</button>
                    <div className="text-center min-w-[50px]">
                      <div className={`font-bold ${changed ? "text-amber-700" : "text-gray-800"}`}>{f(currentRent)}만</div>
                      {changed && (
                        <div className="text-[9px] text-gray-400 line-through">{f(m.rent_weekly)}만</div>
                      )}
                    </div>
                    <button
                      onClick={() => adjust(idx, STEP)}
                      className="w-5 h-5 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center text-sm font-bold leading-none"
                    >+</button>
                    {changed && (
                      <button
                        onClick={() => reset(idx)}
                        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 flex items-center justify-center text-[8px] ml-0.5"
                        title="초기화"
                      >↺</button>
                    )}
                  </div>
                </td>
                {/* 관리비 · 청소비 · 할인 */}
                <td className="px-2 py-1.5 text-right text-gray-500">
                  <div>{f(m.maintenance_weekly)}만 · {f(m.cleaning_fee)}만</div>
                  <div className="text-[9px] flex items-center justify-end gap-1 flex-wrap">
                    {hasLongDisc && m.long_term_discounts!.map((d, di) => (
                      <span key={di} className="text-orange-500">{d.min_weeks}주+{d.percent}%</span>
                    ))}
                    {hasImmDisc && m.immediate_discounts!.map((d, di) => (
                      <span key={di} className="text-pink-500">즉시-{d.amount/10000}만</span>
                    ))}
                    {!hasLongDisc && !hasImmDisc && <span className="text-gray-300">할인없음</span>}
                  </div>
                </td>
                {/* 1주 실질 · 1박 */}
                <td className="px-2 py-1.5 text-right font-medium text-emerald-700">
                  <div>{f(costs[0].weekly)}만</div>
                  <div className="text-[9px] text-gray-400">{f(costs[0].nightly)}만/박</div>
                  {changed && <div className="text-[9px]"><span className={costs[0].weekly - origCosts[0].weekly < 0 ? "text-red-500" : "text-blue-500"}>{costs[0].weekly - origCosts[0].weekly > 0 ? "+" : ""}{f(costs[0].weekly - origCosts[0].weekly)}만</span></div>}
                </td>
                {/* 2주 실질 (2주 총액 / 주당) */}
                <td className="px-2 py-1.5 text-right font-medium text-blue-700">
                  <div>{f(costs[1].total_cost)}만</div>
                  <div className="text-[9px] text-gray-400">{f(costs[1].weekly)}만/주</div>
                </td>
                {/* 4주(1달) 실질 (4주 총액 / 주당) */}
                <td className="px-2 py-1.5 text-right font-medium text-gray-700">
                  <div>{f(costs[3].total_cost)}만</div>
                  <div className="text-[9px] text-gray-400">{f(costs[3].weekly)}만/주</div>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <span className={`font-bold ${distortion > 20 ? "text-red-500" : distortion > 10 ? "text-amber-500" : "text-gray-400"}`}>
                    +{distortion}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-[10px] text-gray-400 hover:text-gray-600 py-1"
        >
          {expanded ? "접기" : `전체 ${filtered.length}개 보기`}
        </button>
      )}
    </div>
  );
}

function SummaryCard({ label, value, unit, color }: {
  label: string;
  value: number;
  unit: string;
  color?: "red" | "amber" | "green";
}) {
  const colorClasses = {
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-[10px] text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color ? colorClasses[color] : "text-gray-900"}`}>
        {typeof value === "number" && value % 1 !== 0 ? value.toFixed(1) : value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
