import { useState, useEffect, useCallback, useRef } from "react";
import OperationManual from "../components/OperationManual";
import { fetchPricingData, fetchCalendarData, fetchPriceComparison, updatePrice, updateRestrictions, updateAvailability } from "../features/calendar/api/calendarApi";
import type { PricingMap, DayPricing, CalendarReservation } from "../features/calendar/types/calendar";
import type { PriceCompareMap, PriceCompareDay } from "../features/calendar/api/calendarApi";
import MarketDataPanel from "../features/calendar/components/MarketDataPanel";

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
  const [viewMode, setViewMode] = useState<"hostex" | "compare" | "market">("compare");
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

      {/* 시장 데이터 모드 */}
      {viewMode === "market" ? (
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
            {info.prop ? shortName(info.prop.display_name || info.prop.name) : `숙소 #${info.propId}`}
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
