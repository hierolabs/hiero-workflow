import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import GuestList from "../components/GuestList";
import PeriodFilter, { type PeriodKey, calcRange } from "../components/PeriodFilter";
import { getMessageInsight } from "../utils/message-api";

const API = import.meta.env.VITE_API_URL;

type Tab = "pivot" | "list" | "samsam" | "airbnb" | "direct";

interface PivotCell {
  row_key: string; col_key: string;
  cnt: number; revenue: number; nights: number; avg_nights: number; guests: number;
}
interface TotalRow {
  key: string; cnt: number; revenue: number; nights: number; avg_nights: number; guests: number;
}
interface AnalyticsData {
  row_dim: string; col_dim: string;
  pivot: PivotCell[]; row_totals: TotalRow[]; col_totals: TotalRow[];
  grand_total: { cnt: number; revenue: number; nights: number; guests: number };
  cross_channel_guests: number; cross_channel_bookings: number;
  available_dimensions: string[];
}

type Metric = "cnt" | "revenue" | "nights" | "guests" | "avg_nights";

const DIM_LABELS: Record<string, string> = {
  channel_group: "채널그룹", channel: "채널(상세)", season: "시즌",
  domestic: "내/외국인", nationality: "국적(상세)", stay_range: "숙박기간", handler: "담당자",
};
const METRIC_LABELS: Record<Metric, string> = {
  cnt: "예약건수", revenue: "매출", nights: "숙박일수", guests: "게스트수", avg_nights: "평균박수",
};

const fmt = (n: number) => n?.toLocaleString("ko-KR") ?? "0";
const fmtM = (n: number) => {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  return fmt(n);
};

const NAT_COLORS: Record<string, string> = {
  "내국인": "bg-blue-100 text-blue-800",
  "외국인": "bg-orange-100 text-orange-800",
  "한국": "bg-blue-100 text-blue-800",
  "한국(추정)": "bg-blue-50 text-blue-600",
  "중국": "bg-red-100 text-red-800",
  "대만": "bg-red-50 text-red-700",
  "일본": "bg-pink-100 text-pink-800",
  "미국/캐나다": "bg-indigo-100 text-indigo-800",
  "외국(추정)": "bg-gray-100 text-gray-600",
};
const CG_COLORS: Record<string, string> = {
  "OTA글로벌": "bg-blue-100 text-blue-800",
  "국내플랫폼": "bg-emerald-100 text-emerald-800",
  "개인입금": "bg-amber-100 text-amber-800",
};

function getBadgeColor(dim: string, key: string) {
  if (dim === "nationality" || dim === "domestic") return NAT_COLORS[key] || "bg-gray-100 text-gray-700";
  if (dim === "channel_group") return CG_COLORS[key] || "bg-gray-100 text-gray-700";
  return "bg-gray-100 text-gray-700";
}

export default function GuestAnalytics() {
  const [tab, setTab] = useState<Tab>("pivot");
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // 초기 날짜 세팅
  useEffect(() => {
    const [s, e] = calcRange("this_month");
    setDateFrom(s);
    setDateTo(e);
  }, []);

  function onPeriodChange(p: PeriodKey, start: string, end: string) {
    setPeriod(p);
    setDateFrom(start);
    setDateTo(end);
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">게스트 분석</h1>
            <p className="mt-1 text-sm text-gray-500">축을 선택하여 다차원 교차 분석</p>
          </div>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([
          { key: "pivot" as Tab, label: "교차 분석" },
          { key: "list" as Tab, label: "게스트 목록" },
          { key: "samsam" as Tab, label: "삼삼엠투" },
          { key: "direct" as Tab, label: "개인입금" },
          { key: "airbnb" as Tab, label: "비앤비 메시지" },
        ]).map(t => (
          <button key={t.key} onClick={() => {
            setTab(t.key);
            if (t.key === "samsam" || t.key === "direct") {
              setPeriod("all");
              const [s, e] = calcRange("all");
              setDateFrom(s); setDateTo(e);
            }
          }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>{t.label}</button>
        ))}
      </div>
      {tab === "pivot" && <PivotDashboard dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "list" && <GuestList />}
      {tab === "samsam" && <SamsamDashboard dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "direct" && <DirectPaymentDashboard dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === "airbnb" && <AirbnbInsight dateFrom={dateFrom} dateTo={dateTo} />}
    </div>
  );
}

type PeriodPreset = string;

function buildQuarterPresets(): { key: string; label: string; from: string; to: string; year?: number }[] {
  const presets: { key: string; label: string; from: string; to: string; year?: number }[] = [
    { key: "all", label: "전체", from: "", to: "" },
  ];
  const now = new Date();
  const curYear = now.getFullYear();
  const curQ = Math.ceil((now.getMonth() + 1) / 3);
  for (let y = 2025; y <= curYear; y++) {
    const maxQ = y === curYear ? curQ : 4;
    for (let q = 1; q <= maxQ; q++) {
      const m1 = (q - 1) * 3 + 1;
      const m3 = q * 3;
      const from = `${y}-${String(m1).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m3, 0).getDate();
      const to = `${y}-${String(m3).padStart(2, "0")}-${lastDay}`;
      presets.push({ key: `${y}Q${q}`, label: `${String(y).slice(2)} Q${q}`, from, to, year: y });
    }
  }
  presets.push({ key: "custom", label: "직접 설정", from: "", to: "" });
  return presets;
}

const PERIOD_PRESETS = buildQuarterPresets();

/* ── 공용: API 호출 훅 ── */
function usePivotData(row: string, col: string, from: string, to: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ row, col });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${API}/guests/analytics?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { /* */ }
    setLoading(false);
  }, [row, col, from, to]);
  useEffect(() => { load(); }, [load]);
  return { data, loading };
}

const getVal = (cell: PivotCell | TotalRow | null, m: Metric): number => {
  if (!cell) return 0;
  if (m === "avg_nights") return (cell as PivotCell).avg_nights || 0;
  return (cell as Record<string, number>)[m] || 0;
};
const formatVal = (v: number, m: Metric) => {
  if (m === "revenue") return fmtM(v);
  if (m === "avg_nights") return `${v.toFixed(1)}박`;
  return fmt(v);
};

/* ── 공용: 분기 선택 바 ── */
function QuarterSelector({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, activeFrom, activeTo }: {
  period: string; setPeriod: (p: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  activeFrom: string; activeTo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button onClick={() => setPeriod("parent")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          period === "parent" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}>상위 연동</button>
      <button onClick={() => setPeriod("all")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          period === "all" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}>전체</button>
      <span className="text-gray-300 mx-0.5">|</span>
      {Array.from(new Set(PERIOD_PRESETS.filter(p => p.year).map(p => p.year!))).map(y => (
        <div key={y} className="flex items-center gap-0.5">
          <span className="text-[10px] text-gray-400 font-medium mr-0.5">{y}</span>
          {PERIOD_PRESETS.filter(p => p.year === y).map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                period === p.key ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>{`Q${p.key.slice(-1)}`}</button>
          ))}
          <span className="text-gray-300 mx-0.5">|</span>
        </div>
      ))}
      <button onClick={() => setPeriod("custom")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          period === "custom" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}>직접</button>
      {period === "custom" && (
        <div className="flex items-center gap-1 ml-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded border px-2 py-1 text-xs" />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded border px-2 py-1 text-xs" />
        </div>
      )}
      {activeFrom && <span className="text-[10px] text-gray-400 ml-2">{activeFrom} ~ {activeTo}</span>}
    </div>
  );
}

/* ── 공용: 미니 테이블 렌더러 ── */
function MiniPivotTable({ data, metric, showPct = false }: { data: AnalyticsData; metric: Metric; showPct?: boolean }) {
  const rowKeys = data.row_totals.map(r => r.key);
  const colKeys = data.col_totals.map(c => c.key);
  const cellMap: Record<string, PivotCell> = {};
  for (const c of data.pivot) cellMap[`${c.row_key}|${c.col_key}`] = c;
  const rowMap: Record<string, TotalRow> = {};
  for (const r of data.row_totals) rowMap[r.key] = r;
  const colMap: Record<string, TotalRow> = {};
  for (const c of data.col_totals) colMap[c.key] = c;
  const grandVal = getVal(data.grand_total as unknown as TotalRow, metric);

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-2 text-left text-xs text-gray-500 sticky left-0 bg-gray-50 z-10">
                {DIM_LABELS[data.row_dim] || data.row_dim} \ {DIM_LABELS[data.col_dim] || data.col_dim}
              </th>
              {colKeys.map(ck => (
                <th key={ck} className="px-3 py-2 text-right text-xs">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeColor(data.col_dim, ck)}`}>{ck}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs text-gray-700 font-bold bg-gray-100">합계</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map(rk => {
              const rowTotal = getVal(rowMap[rk], metric);
              return (
                <tr key={rk} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeColor(data.row_dim, rk)}`}>{rk}</span>
                  </td>
                  {colKeys.map(ck => {
                    const cell = cellMap[`${rk}|${ck}`];
                    const v = getVal(cell || null, metric);
                    const pct = grandVal > 0 ? (v / grandVal * 100) : 0;
                    const maxInRow = Math.max(...colKeys.map(c => getVal(cellMap[`${rk}|${c}`] || null, metric)));
                    const intensity = maxInRow > 0 ? Math.min(v / maxInRow, 1) : 0;
                    const bg = v > 0 ? `rgba(59, 130, 246, ${intensity * 0.15})` : undefined;
                    return (
                      <td key={ck} className="px-3 py-2 text-right" style={{ backgroundColor: bg }}>
                        {v > 0 ? (<div><div className="font-medium">{formatVal(v, metric)}</div>
                          {showPct && <div className="text-[10px] text-gray-400">{pct.toFixed(1)}%</div>}</div>
                        ) : <span className="text-gray-200">-</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold bg-gray-50">
                    {formatVal(rowTotal, metric)}
                    {showPct && grandVal > 0 && <div className="text-[10px] text-gray-400">{(rowTotal / grandVal * 100).toFixed(1)}%</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-gray-50 font-bold">
              <td className="px-3 py-2 text-xs text-gray-700 sticky left-0 bg-gray-50 z-10">합계</td>
              {colKeys.map(ck => {
                const colTotal = getVal(colMap[ck], metric);
                return (
                  <td key={ck} className="px-3 py-2 text-right">
                    {formatVal(colTotal, metric)}
                    {showPct && grandVal > 0 && <div className="text-[10px] text-gray-400">{(colTotal / grandVal * 100).toFixed(1)}%</div>}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right bg-gray-100">{formatVal(grandVal, metric)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ── 공용: 바 차트 ── */
function RowBarChart({ data, metric, dim }: { data: AnalyticsData; metric: Metric; dim: string }) {
  const grandVal = getVal(data.grand_total as unknown as TotalRow, metric);
  const barMax = Math.max(...data.row_totals.map(t => getVal(t, metric)));
  return (
    <div className="bg-white border rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{DIM_LABELS[dim] || dim}별 {METRIC_LABELS[metric]}</h3>
      <div className="space-y-2">
        {data.row_totals.map(r => {
          const v = getVal(r, metric);
          const pct = grandVal > 0 ? (v / grandVal * 100) : 0;
          const barPct = barMax > 0 ? (v / barMax * 100) : 0;
          return (
            <div key={r.key} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeColor(dim, r.key)}`}>{r.key}</span>
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${Math.max(barPct, 2)}%` }}>
                  {barPct > 15 && <span className="text-[10px] text-white font-bold">{formatVal(v, metric)}</span>}
                </div>
              </div>
              <div className="w-20 text-right text-xs text-gray-500">{barPct <= 15 && formatVal(v, metric)} ({pct.toFixed(1)}%)</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   교차분석 — 서브탭 구조
   ================================================================ */
type PivotSubTab = "table" | "channel" | "guest" | "season" | "handler";

function PivotDashboard({ dateFrom: parentFrom, dateTo: parentTo }: { dateFrom: string; dateTo: string }) {
  const [subTab, setSubTab] = useState<PivotSubTab>("table");
  const [period, setPeriod] = useState<PeriodPreset>("parent");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // "parent"이면 상위 날짜 사용, 분기/직접 선택 시 오버라이드
  const activeFrom = period === "parent" ? parentFrom
    : period === "custom" ? dateFrom
    : (PERIOD_PRESETS.find(p => p.key === period)?.from || "");
  const activeTo = period === "parent" ? parentTo
    : period === "custom" ? dateTo
    : (PERIOD_PRESETS.find(p => p.key === period)?.to || "");

  const subTabs: { key: PivotSubTab; label: string }[] = [
    { key: "table", label: "교차 테이블" },
    { key: "channel", label: "채널 심층" },
    { key: "guest", label: "게스트 프로필" },
    { key: "season", label: "시즌 트렌드" },
    { key: "handler", label: "담당자 성과" },
  ];

  return (
    <div className="space-y-4">
      {/* 서브탭 */}
      <div className="flex items-center gap-2">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              subTab === t.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>{t.label}</button>
        ))}
      </div>
      {/* 분기 선택 (공용) */}
      <QuarterSelector period={period} setPeriod={setPeriod}
        dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        activeFrom={activeFrom} activeTo={activeTo} />

      {subTab === "table" && <PivotTableTab from={activeFrom} to={activeTo} />}
      {subTab === "channel" && <ChannelDeepTab from={activeFrom} to={activeTo} />}
      {subTab === "guest" && <GuestProfileTab from={activeFrom} to={activeTo} />}
      {subTab === "season" && <SeasonTrendTab from={activeFrom} to={activeTo} />}
      {subTab === "handler" && <HandlerTab from={activeFrom} to={activeTo} />}
    </div>
  );
}

/* ── 1) 교차 테이블 (기존 피벗) ── */
function PivotTableTab({ from, to }: { from: string; to: string }) {
  const [rowDim, setRowDim] = useState("channel_group");
  const [colDim, setColDim] = useState("domestic");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [showPct, setShowPct] = useState(false);
  const { data, loading } = usePivotData(rowDim, colDim, from, to);

  if (loading) return <div className="text-center text-gray-400 py-12">로딩 중...</div>;
  if (!data) return <div className="text-center text-gray-400 py-12">데이터 없음</div>;

  const dims = data.available_dimensions || [];

  return (
    <div className="space-y-4">
      {/* 축 선택 */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">행</span>
            <div className="flex gap-1">
              {dims.map(d => (
                <button key={d} onClick={() => { if (d !== colDim) setRowDim(d); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    rowDim === d ? "bg-gray-900 text-white" : d === colDim ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{DIM_LABELS[d] || d}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">열</span>
            <div className="flex gap-1">
              {dims.map(d => (
                <button key={d} onClick={() => { if (d !== rowDim) setColDim(d); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    colDim === d ? "bg-gray-900 text-white" : d === rowDim ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{DIM_LABELS[d] || d}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-bold text-gray-500">지표</span>
            <select value={metric} onChange={e => setMetric(e.target.value as Metric)} className="rounded-lg border px-3 py-1.5 text-xs">
              {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} className="rounded" /> 비율
            </label>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="총 예약" value={`${fmt(data.grand_total.cnt)}건`} />
        <SummaryCard label="총 매출" value={`${fmtM(data.grand_total.revenue)}`} />
        <SummaryCard label="총 숙박일" value={`${fmt(data.grand_total.nights)}일`} />
        <SummaryCard label="고유 게스트" value={`${fmt(data.grand_total.guests)}명`} />
        <SummaryCard label="채널전환 게스트" value={`${fmt(data.cross_channel_guests)}명 (${fmt(data.cross_channel_bookings)}건)`} />
      </div>

      <MiniPivotTable data={data} metric={metric} showPct={showPct} />
      <RowBarChart data={data} metric={metric} dim={rowDim} />

      {/* 빠른 프리셋 */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <div className="text-xs font-bold text-gray-500 mb-2">빠른 분석 프리셋</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "채널그룹 × 내/외국인", row: "channel_group", col: "domestic" },
            { label: "채널그룹 × 숙박기간", row: "channel_group", col: "stay_range" },
            { label: "채널그룹 × 시즌", row: "channel_group", col: "season" },
            { label: "내/외국인 × 숙박기간", row: "domestic", col: "stay_range" },
            { label: "국적(상세) × 숙박기간", row: "nationality", col: "stay_range" },
            { label: "숙박기간 × 시즌", row: "stay_range", col: "season" },
          ].map(p => (
            <button key={p.label} onClick={() => { setRowDim(p.row); setColDim(p.col); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                rowDim === p.row && colDim === p.col ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 2) 채널 심층 ── */
function ChannelDeepTab({ from, to }: { from: string; to: string }) {
  const { data: cgDom, loading: l1 } = usePivotData("channel_group", "domestic", from, to);
  const { data: chDom, loading: l2 } = usePivotData("channel", "domestic", from, to);
  const { data: cgStay, loading: l3 } = usePivotData("channel_group", "stay_range", from, to);

  if (l1 || l2 || l3) return <div className="text-center text-gray-400 py-12">로딩 중...</div>;

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      {cgDom && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="총 예약" value={`${fmt(cgDom.grand_total.cnt)}건`} />
          <SummaryCard label="총 매출" value={fmtM(cgDom.grand_total.revenue)} />
          <SummaryCard label="고유 게스트" value={`${fmt(cgDom.grand_total.guests)}명`} />
          <SummaryCard label="채널전환" value={`${fmt(cgDom.cross_channel_guests)}명`} />
          <SummaryCard label="평균 숙박일" value={cgDom.grand_total.cnt > 0 ? `${(cgDom.grand_total.nights / cgDom.grand_total.cnt).toFixed(1)}박` : "-"} />
        </div>
      )}

      {/* 채널그룹 × 내/외국인 */}
      {cgDom && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">채널그룹별 매출 구성</h3>
            <p className="text-xs text-gray-400 mb-3">OTA글로벌 vs 국내플랫폼 vs 개인입금 — 내/외국인 비중</p>
          </div>
          <MiniPivotTable data={cgDom} metric="revenue" showPct />
          <RowBarChart data={cgDom} metric="revenue" dim="channel_group" />
        </>
      )}

      {/* 채널(상세) × 내/외국인 */}
      {chDom && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">채널 상세별 예약건수</h3>
            <p className="text-xs text-gray-400 mb-3">에어비앤비, 부킹, 아고다 등 개별 채널 비교</p>
          </div>
          <MiniPivotTable data={chDom} metric="cnt" showPct />
          <RowBarChart data={chDom} metric="cnt" dim="channel" />
        </>
      )}

      {/* 채널그룹 × 숙박기간 */}
      {cgStay && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">채널별 숙박기간 분포</h3>
            <p className="text-xs text-gray-400 mb-3">어느 채널에서 장기 게스트가 오는가</p>
          </div>
          <MiniPivotTable data={cgStay} metric="cnt" showPct />
        </>
      )}

      {/* 핵심 발견 */}
      {cgDom && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-800 mb-2">채널 핵심 요약</h3>
          <div className="text-sm text-amber-700 space-y-1">
            {cgDom.row_totals.sort((a, b) => b.revenue - a.revenue).map((r, i) => {
              const pct = cgDom.grand_total.revenue > 0 ? (r.revenue / cgDom.grand_total.revenue * 100).toFixed(1) : "0";
              const avgN = r.cnt > 0 ? (r.nights / r.cnt).toFixed(1) : "0";
              return <p key={r.key}>{i + 1}. <strong>{r.key}</strong> — 매출 {fmtM(r.revenue)} ({pct}%), {fmt(r.cnt)}건, 평균 {avgN}박</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3) 게스트 프로필 ── */
function GuestProfileTab({ from, to }: { from: string; to: string }) {
  const { data: domStay, loading: l1 } = usePivotData("domestic", "stay_range", from, to);
  const { data: natStay, loading: l2 } = usePivotData("nationality", "stay_range", from, to);
  const { data: natCg, loading: l3 } = usePivotData("nationality", "channel_group", from, to);

  if (l1 || l2 || l3) return <div className="text-center text-gray-400 py-12">로딩 중...</div>;

  return (
    <div className="space-y-5">
      {/* 요약 */}
      {domStay && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="고유 게스트" value={`${fmt(domStay.grand_total.guests)}명`} />
          <SummaryCard label="내국인 비율" value={(() => {
            const kr = domStay.row_totals.find(r => r.key === "내국인");
            return kr && domStay.grand_total.cnt > 0 ? `${(kr.cnt / domStay.grand_total.cnt * 100).toFixed(0)}%` : "-";
          })()} />
          <SummaryCard label="평균 숙박" value={domStay.grand_total.cnt > 0 ? `${(domStay.grand_total.nights / domStay.grand_total.cnt).toFixed(1)}박` : "-"} />
          <SummaryCard label="총 매출" value={fmtM(domStay.grand_total.revenue)} />
        </div>
      )}

      {/* 내/외국인 × 숙박기간 */}
      {domStay && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">내/외국인별 숙박기간 분포</h3>
            <p className="text-xs text-gray-400 mb-3">내국인과 외국인의 체류 패턴 차이</p>
          </div>
          <MiniPivotTable data={domStay} metric="cnt" showPct />
          <MiniPivotTable data={domStay} metric="revenue" showPct />
        </>
      )}

      {/* 국적(상세) × 숙박기간 */}
      {natStay && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">국적별 숙박기간</h3>
            <p className="text-xs text-gray-400 mb-3">어느 국적이 장기 체류하는가</p>
          </div>
          <MiniPivotTable data={natStay} metric="cnt" showPct />
          <RowBarChart data={natStay} metric="revenue" dim="nationality" />
        </>
      )}

      {/* 국적 × 채널그룹 */}
      {natCg && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">국적별 유입 채널</h3>
            <p className="text-xs text-gray-400 mb-3">국적별로 어느 채널을 통해 들어오는가</p>
          </div>
          <MiniPivotTable data={natCg} metric="cnt" showPct />
        </>
      )}

      {/* 핵심 발견 */}
      {natStay && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-800 mb-2">게스트 프로필 요약</h3>
          <div className="text-sm text-amber-700 space-y-1">
            {natStay.row_totals.sort((a, b) => b.cnt - a.cnt).slice(0, 5).map((r, i) => {
              const avgN = r.cnt > 0 ? (r.nights / r.cnt).toFixed(1) : "0";
              const pct = natStay.grand_total.cnt > 0 ? (r.cnt / natStay.grand_total.cnt * 100).toFixed(1) : "0";
              return <p key={r.key}>{i + 1}. <strong>{r.key}</strong> — {fmt(r.cnt)}건 ({pct}%), 평균 {avgN}박, 매출 {fmtM(r.revenue)}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 4) 시즌 트렌드 ── */
function SeasonTrendTab({ from, to }: { from: string; to: string }) {
  const { data: seasonCg, loading: l1 } = usePivotData("season", "channel_group", from, to);
  const { data: seasonDom, loading: l2 } = usePivotData("season", "domestic", from, to);
  const { data: seasonStay, loading: l3 } = usePivotData("season", "stay_range", from, to);

  if (l1 || l2 || l3) return <div className="text-center text-gray-400 py-12">로딩 중...</div>;

  return (
    <div className="space-y-5">
      {/* 요약 */}
      {seasonCg && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="시즌 수" value={`${seasonCg.row_totals.length}개`} />
          <SummaryCard label="총 예약" value={`${fmt(seasonCg.grand_total.cnt)}건`} />
          <SummaryCard label="총 매출" value={fmtM(seasonCg.grand_total.revenue)} />
          <SummaryCard label="시즌당 평균" value={seasonCg.row_totals.length > 0 ? fmtM(seasonCg.grand_total.revenue / seasonCg.row_totals.length) : "-"} />
        </div>
      )}

      {/* 시즌 × 채널그룹 */}
      {seasonCg && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">시즌별 채널 매출 추이</h3>
            <p className="text-xs text-gray-400 mb-3">각 시즌에 어떤 채널이 성장/하락했는가</p>
          </div>
          <MiniPivotTable data={seasonCg} metric="revenue" showPct />
          <RowBarChart data={seasonCg} metric="revenue" dim="season" />
        </>
      )}

      {/* 시즌 × 내/외국인 */}
      {seasonDom && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">시즌별 내/외국인 비율 변화</h3>
            <p className="text-xs text-gray-400 mb-3">외국인 비중이 계절에 따라 어떻게 변하는가</p>
          </div>
          <MiniPivotTable data={seasonDom} metric="cnt" showPct />
        </>
      )}

      {/* 시즌 × 숙박기간 */}
      {seasonStay && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">시즌별 숙박기간 분포</h3>
            <p className="text-xs text-gray-400 mb-3">장기 체류가 특정 시즌에 집중되는가</p>
          </div>
          <MiniPivotTable data={seasonStay} metric="cnt" showPct />
        </>
      )}

      {/* 핵심 발견 */}
      {seasonCg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-800 mb-2">시즌 트렌드 요약</h3>
          <div className="text-sm text-amber-700 space-y-1">
            {seasonCg.row_totals.map(r => {
              const pct = seasonCg.grand_total.revenue > 0 ? (r.revenue / seasonCg.grand_total.revenue * 100).toFixed(1) : "0";
              const avgN = r.cnt > 0 ? (r.nights / r.cnt).toFixed(1) : "0";
              return <p key={r.key}><strong>{r.key}</strong> — 매출 {fmtM(r.revenue)} ({pct}%), {fmt(r.cnt)}건, 평균 {avgN}박</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5) 담당자 성과 ── */
function HandlerTab({ from, to }: { from: string; to: string }) {
  const { data: hSeason, loading: l1 } = usePivotData("handler", "season", from, to);
  const { data: hDom, loading: l2 } = usePivotData("handler", "domestic", from, to);
  const { data: hStay, loading: l3 } = usePivotData("handler", "stay_range", from, to);

  if (l1 || l2 || l3) return <div className="text-center text-gray-400 py-12">로딩 중...</div>;

  return (
    <div className="space-y-5">
      {/* 요약 */}
      {hSeason && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="담당자 수" value={`${hSeason.row_totals.length}명`} />
          <SummaryCard label="총 예약" value={`${fmt(hSeason.grand_total.cnt)}건`} />
          <SummaryCard label="총 매출" value={fmtM(hSeason.grand_total.revenue)} />
          <SummaryCard label="1인당 평균" value={hSeason.row_totals.length > 0 ? fmtM(hSeason.grand_total.revenue / hSeason.row_totals.length) : "-"} />
        </div>
      )}

      {/* 담당자 × 시즌 (매출) */}
      {hSeason && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">담당자별 시즌 매출</h3>
            <p className="text-xs text-gray-400 mb-3">각 담당자의 시즌별 매출 추이</p>
          </div>
          <MiniPivotTable data={hSeason} metric="revenue" showPct />
          <RowBarChart data={hSeason} metric="revenue" dim="handler" />
        </>
      )}

      {/* 담당자 × 내/외국인 */}
      {hDom && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">담당자별 내/외국인 비율</h3>
            <p className="text-xs text-gray-400 mb-3">담당자마다 게스트 유형이 다른가</p>
          </div>
          <MiniPivotTable data={hDom} metric="cnt" showPct />
        </>
      )}

      {/* 담당자 × 숙박기간 */}
      {hStay && (
        <>
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-1">담당자별 숙박기간 분포</h3>
            <p className="text-xs text-gray-400 mb-3">누가 장기 게스트를 더 많이 다루는가</p>
          </div>
          <MiniPivotTable data={hStay} metric="cnt" showPct />
        </>
      )}

      {/* 성과 테이블 */}
      {hSeason && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">담당자 종합 성과표</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left">담당자</th>
              <th className="px-3 py-2 text-right">예약</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-right">게스트</th>
              <th className="px-3 py-2 text-right">총 숙박일</th>
              <th className="px-3 py-2 text-right">평균박수</th>
              <th className="px-3 py-2 text-right">건당 매출</th>
            </tr></thead>
            <tbody>{hSeason.row_totals.sort((a, b) => b.revenue - a.revenue).map(r => {
              const avgN = r.cnt > 0 ? (r.nights / r.cnt).toFixed(1) : "-";
              const perBooking = r.cnt > 0 ? fmtM(r.revenue / r.cnt) : "-";
              return (
                <tr key={r.key} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.key}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.cnt)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600">{fmtM(r.revenue)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.guests)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.nights)}</td>
                  <td className="px-3 py-2 text-right">{avgN}</td>
                  <td className="px-3 py-2 text-right">{perBooking}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const c = accent || "text-gray-900";
  return (
    <div className="bg-white border rounded-xl p-4 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}

/* ================================================================
   삼삼엠투 채팅 분석 대시보드
   데이터: /public/samsam_analysis.json (static)
   ================================================================ */
type SamsamSubTab = "overview" | "ttfr" | "funnel" | "insight" | "ops" | "cases" | "messages";

interface SamsamInsightItem {
  chat_id: string; room_name: string; participant: string;
  category: string; matched_keyword: string; content: string;
  time_hint: string; outcome: string;
}
interface SamsamReason {
  category: string; count: number; percent: number;
  conversion_rate: number; examples: string[];
}
interface SamsamData {
  total_chats: number; total_messages: number;
  converted: number; cancelled: number; pending: number;
  response_rate: number;
  by_response_type: Record<string, { count: number; converted: number; cancelled: number; rate: number }>;
  by_question_type: Record<string, { count: number; converted: number; cancelled: number; rate: number }>;
  by_depth: Record<string, { count: number; converted: number; cancelled: number; rate: number }>;
  funnel: { chat_started: number; host_responded: number; approved: number; paid: number };
  chats: {
    chat_id: string; room_name: string; participant: string;
    outcome: string; response_type: string;
    guest_count: number; host_count: number; total_msgs: number;
    question_type: string; amount: number;
    contract_status?: string; payment_status?: string;
    month?: string; cancel_reason?: string; redirected?: boolean;
    last_speaker?: string; handler?: string;
  }[];
  message_insights?: {
    total_guest_messages: number; total_insights: number;
    top_reasons: SamsamReason[]; items: SamsamInsightItem[];
  };
  case_studies?: {
    winning_phrases: { chat_id: string; room_name: string; participant: string; host_msg: string; month: string }[];
    ack_follow_up: {
      with_follow_count: number; with_follow_converted: number;
      without_follow_count: number; without_follow_converted: number;
      with_follow_examples: { chat_id: string; room_name: string; participant: string; ack_msg: string; follow_msg: string; outcome: string }[];
      without_follow_examples: { chat_id: string; room_name: string; participant: string; ack_msg: string; outcome: string }[];
    };
    room_comparisons: {
      room_name: string; converted_count: number; cancelled_count: number;
      converted_examples: { chat_id: string; participant: string; guest_first: string; host_summary: string }[];
      cancelled_examples: { chat_id: string; participant: string; guest_first: string; host_summary: string }[];
    }[];
  };
  cancel_reasons?: Record<string, number>;
  repeat_guests?: {
    unique_guests: number; repeat_count: number; repeat_pct: number;
    repeat_ever_converted: number; repeat_never_converted: number;
    single_conversion_rate: number;
  };
  by_handler?: Record<string, {
    period: string; total: number; converted: number; cancelled: number;
    rate: number; response_rate: number; redirect_rate: number;
    redirect_converted: number; redirect_cancelled: number;
    monthly: Record<string, { count: number; converted: number; cancelled: number; rate: number; response_rate: number; redirect_count: number }>;
  }>;
  last_speaker?: { cancelled: { guest: number; host: number }; converted: { guest: number; host: number } };
  time_analysis?: {
    hourly: Record<string, { guest: number; host: number; auto: number }>;
    handler_hourly: Record<string, Record<string, number>>;
    handler_start: Record<string, { total_days: number; avg_start_hour: number; by_hour: Record<string, number> }>;
    peak: { morning: number; afternoon: number; evening: number; night: number };
  };
}

function filterSamsamByDate(raw: SamsamData, dateFrom: string, dateTo: string): SamsamData {
  const fromMonth = dateFrom.slice(0, 7); // YYYY-MM
  const toMonth = dateTo.slice(0, 7);
  const filtered = raw.chats.filter(c => {
    if (!c.month) return true;
    return c.month >= fromMonth && c.month <= toMonth;
  });
  // 통계 재계산
  const converted = filtered.filter(c => c.outcome === "converted").length;
  const cancelled = filtered.filter(c => c.outcome === "cancelled").length;
  const pending = filtered.filter(c => c.outcome === "pending").length;
  const totalMsgs = filtered.reduce((s, c) => s + c.total_msgs, 0);
  const responded = filtered.filter(c => c.response_type !== "no_response").length;
  // by_response_type 재계산
  const byResp: SamsamData["by_response_type"] = {};
  for (const c of filtered) {
    const k = c.response_type;
    if (!byResp[k]) byResp[k] = { count: 0, converted: 0, cancelled: 0, rate: 0 };
    byResp[k].count++;
    if (c.outcome === "converted") byResp[k].converted++;
    if (c.outcome === "cancelled") byResp[k].cancelled++;
  }
  for (const v of Object.values(byResp)) {
    const decided = v.converted + v.cancelled;
    v.rate = decided > 0 ? Number((v.converted / decided * 100).toFixed(1)) : 0;
  }
  // by_question_type 재계산
  const byQ: SamsamData["by_question_type"] = {};
  for (const c of filtered) {
    const k = c.question_type;
    if (!byQ[k]) byQ[k] = { count: 0, converted: 0, cancelled: 0, rate: 0 };
    byQ[k].count++;
    if (c.outcome === "converted") byQ[k].converted++;
    if (c.outcome === "cancelled") byQ[k].cancelled++;
  }
  for (const v of Object.values(byQ)) {
    const decided = v.converted + v.cancelled;
    v.rate = decided > 0 ? Number((v.converted / decided * 100).toFixed(1)) : 0;
  }
  // by_depth 재계산
  const depthRanges = [
    { key: "0~1", min: 0, max: 1 }, { key: "2~3", min: 2, max: 3 },
    { key: "4~6", min: 4, max: 6 }, { key: "7+", min: 7, max: Infinity },
  ];
  const byD: SamsamData["by_depth"] = {};
  for (const r of depthRanges) {
    const chats = filtered.filter(c => c.host_count >= r.min && c.host_count <= r.max);
    const conv = chats.filter(c => c.outcome === "converted").length;
    const canc = chats.filter(c => c.outcome === "cancelled").length;
    const decided = conv + canc;
    byD[r.key] = { count: chats.length, converted: conv, cancelled: canc, rate: decided > 0 ? Number((conv / decided * 100).toFixed(1)) : 0 };
  }
  // funnel 재계산
  const funnel = {
    chat_started: filtered.length,
    host_responded: responded,
    approved: responded, // 삼삼엠투에서 응답≈승인
    paid: converted,
  };
  // message_insights 필터 (items의 chat_id가 필터된 chats에 있는 것만)
  const chatIds = new Set(filtered.map(c => c.chat_id));
  let msgInsights = raw.message_insights;
  if (msgInsights) {
    const filteredItems = msgInsights.items.filter(i => chatIds.has(i.chat_id));
    // top_reasons 재계산
    const catMap: Record<string, { count: number; conv: number; total: number }> = {};
    for (const item of filteredItems) {
      if (!catMap[item.category]) catMap[item.category] = { count: 0, conv: 0, total: 0 };
      catMap[item.category].count++;
      catMap[item.category].total++;
      if (item.outcome === "converted") catMap[item.category].conv++;
    }
    const topReasons: SamsamReason[] = Object.entries(catMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([cat, v]) => ({
        category: cat, count: v.count,
        percent: filteredItems.length > 0 ? Number((v.count / filteredItems.length * 100).toFixed(1)) : 0,
        conversion_rate: v.total > 0 ? Number((v.conv / v.total * 100).toFixed(1)) : 0,
        examples: filteredItems.filter(i => i.category === cat).slice(0, 3).map(i => i.content),
      }));
    msgInsights = { total_guest_messages: filteredItems.length, total_insights: filteredItems.length, top_reasons: topReasons, items: filteredItems };
  }
  return {
    total_chats: filtered.length, total_messages: totalMsgs,
    converted, cancelled, pending,
    response_rate: filtered.length > 0 ? Number((responded / filtered.length * 100).toFixed(1)) : 0,
    by_response_type: byResp, by_question_type: byQ, by_depth: byD, funnel,
    chats: filtered, message_insights: msgInsights,
    case_studies: raw.case_studies,
    cancel_reasons: raw.cancel_reasons,
    repeat_guests: raw.repeat_guests,
    // by_handler 재계산 (필터된 chats 기준)
    by_handler: (() => {
      const HN = (m: string) => m <= '2025-06' ? '김진우' : m <= '2025-12' ? '왕태경' : '오재관';
      const bh: SamsamData["by_handler"] = {};
      for (const h of ['김진우', '왕태경', '오재관']) {
        const g = filtered.filter(c => HN(c.month || '') === h);
        if (!g.length) continue;
        const cv = g.filter(c => c.outcome === 'converted').length;
        const cn = g.filter(c => c.outcome === 'cancelled').length;
        const w = cv + cn;
        const dm = g.filter(c => c.response_type === 'direct_msg');
        const rd = g.filter(c => c.redirected);
        const months = [...new Set(g.map(c => c.month || '').filter(Boolean))].sort();
        const monthly: Record<string, { count: number; converted: number; cancelled: number; rate: number; response_rate: number; redirect_count: number }> = {};
        for (const m of months) {
          const mg = g.filter(c => c.month === m);
          const mcv = mg.filter(c => c.outcome === 'converted').length;
          const mcn = mg.filter(c => c.outcome === 'cancelled').length;
          const mw = mcv + mcn;
          monthly[m] = { count: mg.length, converted: mcv, cancelled: mcn, rate: mw > 0 ? Number((mcv/mw*100).toFixed(1)) : 0, response_rate: Number((mg.filter(c => c.response_type === 'direct_msg').length / mg.length * 100).toFixed(1)), redirect_count: mg.filter(c => c.redirected).length };
        }
        bh[h] = { period: `${months[0]} ~ ${months[months.length-1]}`, total: g.length, converted: cv, cancelled: cn, rate: w > 0 ? Number((cv/w*100).toFixed(1)) : 0, response_rate: Number((dm.length/g.length*100).toFixed(1)), redirect_rate: Number((rd.length/g.length*100).toFixed(1)), redirect_converted: rd.filter(c => c.outcome === 'converted').length, redirect_cancelled: rd.filter(c => c.outcome === 'cancelled').length, monthly };
      }
      return bh;
    })(),
    last_speaker: raw.last_speaker,
    time_analysis: raw.time_analysis,
    growth: raw.growth,
  };
}

function SamsamDashboard({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [subTab, setSubTab] = useState<SamsamSubTab>("overview");
  const [rawData, setRawData] = useState<SamsamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/samsam_analysis.json")
      .then(r => r.json())
      .then(d => { setRawData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const data = rawData ? filterSamsamByDate(rawData, dateFrom, dateTo) : null;

  const subTabs: { key: SamsamSubTab; label: string }[] = [
    { key: "ops", label: "운영 인사이트" },
    { key: "cases", label: "실전 사례" },
    { key: "overview", label: "전체 현황" },
    { key: "ttfr", label: "응답 분석" },
    { key: "funnel", label: "전환 퍼널" },
    { key: "insight", label: "메시지 인사이트" },
    { key: "messages", label: "채팅 목록" },
  ];

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  if (!data) return <div className="py-12 text-center text-gray-400">samsam_analysis.json 파일을 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              subTab === t.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>{t.label}</button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{dateFrom.slice(0,7)} ~ {dateTo.slice(0,7)} · {data.total_chats}건{rawData ? ` / 전체 ${rawData.total_chats}건` : ""}</span>
      </div>
      {subTab === "ops" && <SamsamOpsInsight data={data} />}
      {subTab === "cases" && <SamsamCaseStudies data={data} />}
      {subTab === "overview" && <SamsamOverview data={data} />}
      {subTab === "ttfr" && <SamsamTTFR data={data} />}
      {subTab === "funnel" && <SamsamFunnel data={data} />}
      {subTab === "insight" && <SamsamInsight data={data} />}
      {subTab === "messages" && <SamsamMessageList data={data} />}
    </div>
  );
}

const RESP_LABELS: Record<string, string> = { direct_msg: "직접 메시지", approve_only: "승인만", reject: "거절", no_response: "무응답" };
const Q_LABELS: Record<string, string> = { general: "일반 인사/요청", price: "가격 문의", availability: "입주 가능일", option: "옵션(주차/반려동물)" };
const D_LABELS: Record<string, string> = { "0~1": "0~1건", "2~3": "2~3건", "4~6": "4~6건", "7+": "7건+" };

function HBar({ label, value, max, sub, color = "bg-blue-500" }: { label: string; value: number; max: number; sub?: string; color?: string }) {
  const pct = max > 0 ? Math.max(value / max * 100, 2) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-right text-sm text-gray-700">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all flex items-center justify-end pr-2`} style={{ width: `${pct}%` }}>
          {pct > 20 && <span className="text-[11px] text-white font-bold">{value}</span>}
        </div>
      </div>
      <span className="w-24 text-right text-xs text-gray-500">{pct <= 20 ? String(value) : ""} {sub || ""}</span>
    </div>
  );
}

/* ── 운영 인사이트 — 전면 수정 ── */
function SamsamOpsInsight({ data }: { data: SamsamData }) {
  const dm = data.by_response_type.direct_msg || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const nr = data.by_response_type.no_response || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const avail = data.by_question_type.availability || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const general = data.by_question_type.general || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const depth01 = data.by_depth["0~1"] || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const depth7 = data.by_depth["7+"] || { count: 0, rate: 0, converted: 0, cancelled: 0 };
  const cr = data.cancel_reasons || {};
  const rg = data.repeat_guests;
  const ls = data.last_speaker;
  const handlers = data.by_handler || {};

  const findings = [
    { id: 1, severity: "critical" as const, title: "취소의 87%는 미결제 자동취소", metric: `자동취소 ${cr.auto_expire || 0}건`,
      현상: `취소 ${data.cancelled}건 중 미결제 자동취소 ${cr.auto_expire || 0}건(${data.cancelled > 0 ? Math.round((cr.auto_expire||0)/data.cancelled*100) : 0}%). 게스트가 싫어서 간 게 아니라 결제 타이밍을 놓침.`,
      원인: "승인 후 결제 마감 시한 내 결제 미완료 → 자동 취소. 결제 리마인드가 없음.", 대안: "결제 마감 1시간 전 리마인드 메시지 자동 발송. '결제 링크 다시 보내드릴까요?' 후속 조치.", 담당: "오재관 · 자동화" },
    { id: 2, severity: "critical" as const, title: "무응답 = 전환 사망", metric: `응답O ${dm.rate}% vs 무응답 ${nr.rate}%`,
      현상: `무응답 ${nr.count}건. 응답만 해도 전환율 ${nr.rate > 0 ? (dm.rate/nr.rate).toFixed(1) : "4"}배.`,
      원인: "문의형 플랫폼. 응답 없으면 바로 이탈.", 대안: "미응답 10분 시 알림. 1차 자동응답. 응답률 100% 목표.", 담당: "오재관 · 운영팀" },
    { id: 3, severity: "critical" as const, title: "호스트가 마지막으로 말해야 전환", metric: `취소 시 게스트 마지막 ${ls ? ls.cancelled.guest : 0}건(${ls ? Math.round(ls.cancelled.guest/(ls.cancelled.guest+ls.cancelled.host)*100) : 60}%)`,
      현상: `취소된 대화의 ${ls ? Math.round(ls.cancelled.guest/(ls.cancelled.guest+ls.cancelled.host)*100) : 60}%는 게스트가 마지막. 전환된 대화의 ${ls ? Math.round(ls.converted.host/(ls.converted.guest+ls.converted.host)*100) : 54}%는 호스트가 마지막.`,
      원인: "게스트에게 공을 넘기고 끝내면 취소. '네 알겠습니다'가 이탈 신호인데 후속 조치 안 함.", 대안: "게스트 '네 알겠습니다' 이후 반드시 결제 유도 or 추가 안내. 대화의 마지막은 항상 호스트.", 담당: "운영팀 · 응대 규칙" },
    { id: 4, severity: "high" as const, title: "입주/기간 문의 = 전환 최저", metric: `입주 ${avail.rate}% vs 일반 ${general.rate}%`,
      현상: `${avail.count}건 중 전환 ${avail.rate}%. 김진우 시절 28.6% → 왕태경 11.8% → 오재관 3.9%로 추락.`,
      원인: "92개 리스팅 전부 공개(허위매물 구조) → 공실 즉시 답변 불가. 사람 바뀔 때마다 공실 파악 능력 저하.", 대안: "인벤토리 시스템 = 실시간 공실 조회. 자율배치 시스템의 핵심.", 담당: "김진우 · 인벤토리" },
    { id: 5, severity: "high" as const, title: "대안 제시 방식이 잘못됨", metric: "구체적 대안 0% vs 거절만 40%",
      현상: "'다른 숙소도 있어요' 막연한 대안 → 전환 0%. 거절만 한 경우 게스트가 스스로 찾아서 40% 전환.",
      원인: "호실+가격+입주일 없는 대안은 안 통함.", 대안: "대안 = '호실명+가격+입주가능일' 필수. 인벤토리가 자동 조합.", 담당: "오재관 · 프로세스" },
    { id: 6, severity: "high" as const, title: "재방문자 79%가 전환 실패", metric: `${rg ? rg.repeat_count : 0}명 중 ${rg ? rg.repeat_never_converted : 0}명 전환 0`,
      현상: `${rg ? rg.repeat_count : 0}명(21%)이 2회 이상 문의. 이 중 ${rg ? rg.repeat_never_converted : 0}명(79%)은 한 번도 전환 안 됨. 정해찬 8회 전부 취소.`,
      원인: "여러 방을 돌아다니며 문의하는데 매번 공실 없음/느린 응답. 첫 문의에서 빈 방 매칭 못 함.", 대안: "재문의 게스트 자동 감지 → VIP 대응. 이전 대화 이력 보면서 응대.", 담당: "운영팀 · 시스템" },
    { id: 7, severity: "high" as const, title: "첫 응답에 4정보 담아야 함", metric: `0~1건 ${depth01.rate}% vs 7건+ ${depth7.rate}%`,
      현상: `1번만 물어본 경우 전환 ${depth01.rate}%. 7번 이상 주고받으면 ${depth7.rate}%로 하락.`,
      원인: "여러 번 묻게 만들면 잃음.", 대안: "첫 응답 템플릿: 가격+공실일정+위치+옵션 4정보 필수.", 담당: "운영팀 · 템플릿" },
    { id: 8, severity: "medium" as const, title: "채널전환 → 개인입금 흐름", metric: `유도 ${data.chats.filter(c => c.redirected).length}건`,
      현상: "'연락처 남겨주세요' → 전화 → 개인입금. 삼삼엠투 취소이지만 실제 매출.",
      원인: "수수료 회피 + 유연한 계약.", 대안: "채널전환 시 Hostex 리드 자동 등록. 통화→개인입금 추적.", 담당: "김진우 · 시스템" },
    { id: 9, severity: "medium" as const, title: "물량 140건/월 넘으면 무너짐", metric: "왕태경 10월 6%, 오재관 3~4월 6~10%",
      현상: "월 140건 이상 시 전환율 급락. 왕태경 10월(139건, 6%), 오재관 3월(147건, 6%), 4월(146건, 10%).",
      원인: "사람의 응대 용량 한계. 90개 객실 공실 파악 불가.", 대안: "자동화로 응대 용량 확장. 인벤토리+자동응답 시스템.", 담당: "김진우 · 자동화" },
  ];

  const sStyle = { critical: "border-red-300 bg-red-50", high: "border-amber-300 bg-amber-50", medium: "border-blue-200 bg-blue-50", info: "border-gray-200 bg-gray-50" };
  const sLabel = { critical: { t: "긴급", c: "bg-red-600 text-white" }, high: { t: "높음", c: "bg-amber-500 text-white" }, medium: { t: "보통", c: "bg-blue-500 text-white" }, info: { t: "참고", c: "bg-gray-500 text-white" } };
  const HANDLER_LABELS: Record<string, string> = { "김진우": "김진우 (25.05~06)", "왕태경": "왕태경 (25.07~12)", "오재관": "오재관 (26.01~현재)" };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 text-white rounded-xl p-5">
        <h3 className="text-lg font-bold mb-1">삼삼엠투 운영 인사이트</h3>
        <p className="text-sm text-slate-300">{data.total_chats}건 채팅 · 15개월 · 3시즌 분석</p>
      </div>

      {/* 담당자별 시즌 비교 */}
      {Object.keys(handlers).length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">담당자별 성과 비교</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left">담당자</th>
              <th className="px-3 py-2 text-right">건수</th>
              <th className="px-3 py-2 text-right">전환율</th>
              <th className="px-3 py-2 text-right">응답률</th>
              <th className="px-3 py-2 text-right">유도율</th>
              <th className="px-3 py-2 text-right">유도→전환</th>
            </tr></thead>
            <tbody>
              {["김진우", "왕태경", "오재관"].map(h => {
                const hd = handlers[h];
                if (!hd) return null;
                return (
                  <tr key={h} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{HANDLER_LABELS[h] || h}</td>
                    <td className="px-3 py-2 text-right">{hd.total}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-600">{hd.rate}%</td>
                    <td className="px-3 py-2 text-right">{hd.response_rate}%</td>
                    <td className="px-3 py-2 text-right">{hd.redirect_rate}%</td>
                    <td className="px-3 py-2 text-right text-emerald-600">{hd.redirect_converted}건</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 운영 현황 차트 */}
      <OpsChart data={data} />

      {/* 취소 사유 */}
      {Object.keys(cr).length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">취소 사유 분류 (총 {data.cancelled}건)</h3>
          <div className="flex gap-3">
            {[
              { key: "auto_expire", label: "미결제 자동취소", color: "bg-red-100 text-red-800" },
              { key: "guest_cancel", label: "게스트 직접취소", color: "bg-amber-100 text-amber-800" },
              { key: "host_reject", label: "임대인 거절", color: "bg-gray-100 text-gray-800" },
            ].map(({ key, label, color }) => {
              const cnt = cr[key] || 0;
              const pct = data.cancelled > 0 ? Math.round(cnt / data.cancelled * 100) : 0;
              return (
                <div key={key} className={`flex-1 rounded-lg p-3 ${color}`}>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-xl font-bold mt-1">{cnt}건</div>
                  <div className="text-xs opacity-70">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 재방문자 + 마지막 발화자 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rg && (
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">재방문자</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">고유 게스트</span><span className="font-bold">{rg.unique_guests}명</span></div>
              <div className="flex justify-between"><span className="text-gray-500">2회 이상 문의</span><span className="font-bold text-amber-600">{rg.repeat_count}명 ({rg.repeat_pct}%)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">재방문 중 전환 0</span><span className="font-bold text-red-500">{rg.repeat_never_converted}명 (79%)</span></div>
              <div className="flex justify-between"><span className="text-gray-500">1회 문의 전환율</span><span className="font-bold">{rg.single_conversion_rate}%</span></div>
            </div>
          </div>
        )}
        {ls && (
          <div className="bg-white border rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">마지막 발화자</h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">취소된 대화</div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-red-600">게스트 마지막</div>
                    <div className="text-lg font-bold text-red-700">{Math.round(ls.cancelled.guest/(ls.cancelled.guest+ls.cancelled.host)*100)}%</div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500">호스트 마지막</div>
                    <div className="text-lg font-bold">{Math.round(ls.cancelled.host/(ls.cancelled.guest+ls.cancelled.host)*100)}%</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">전환된 대화</div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500">게스트 마지막</div>
                    <div className="text-lg font-bold">{Math.round(ls.converted.guest/(ls.converted.guest+ls.converted.host)*100)}%</div>
                  </div>
                  <div className="flex-1 bg-emerald-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-emerald-600">호스트 마지막</div>
                    <div className="text-lg font-bold text-emerald-700">{Math.round(ls.converted.host/(ls.converted.guest+ls.converted.host)*100)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 발견 카드 */}
      {findings.map(f => (
        <div key={f.id} className={`border-2 rounded-xl p-5 ${sStyle[f.severity]}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${sLabel[f.severity].c}`}>{sLabel[f.severity].t}</span>
            <h4 className="text-base font-bold text-gray-900">#{f.id} {f.title}</h4>
            <span className="ml-auto text-sm font-mono font-bold text-gray-700">{f.metric}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-gray-500 mb-1">현상</div><p className="text-gray-800">{f.현상}</p></div>
            <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-gray-500 mb-1">원인</div><p className="text-gray-800">{f.원인}</p></div>
            <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-red-600 mb-1">대안</div><p className="text-gray-900 font-medium">{f.대안}</p></div>
          </div>
          <div className="mt-2 text-right"><span className="text-xs text-gray-500">담당: </span><span className="text-xs font-medium text-gray-700">{f.담당}</span></div>
        </div>
      ))}

      {/* 시간 분석 */}
      {data.time_analysis && (() => {
        const ta = data.time_analysis!;
        const maxH = Math.max(...Object.values(ta.hourly).map(v => v.guest + v.host));
        const HC: Record<string, string> = { "김진우": "bg-blue-500", "왕태경": "bg-amber-500", "오재관": "bg-emerald-500" };
        const HT: Record<string, string> = { "김진우": "text-blue-700", "왕태경": "text-amber-700", "오재관": "text-emerald-700" };
        const tp = ta.peak.morning + ta.peak.afternoon + ta.peak.evening + ta.peak.night;
        return (
          <div className="border-2 border-violet-300 bg-violet-50 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-violet-600 text-white">핵심</span>
              <h4 className="text-base font-bold text-gray-900">시간대 분석 — 08시 처리가 전환율의 비밀</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-gray-500 mb-1">현상</div><p className="text-gray-800">김진우 08시 일괄처리(42%) → 입주문의 전환 28.6%. 왕태경/오재관 평균 13시 → 3.9%. <strong>아침에 답이 와있는 상태가 전환율 3배.</strong></p></div>
              <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-gray-500 mb-1">원인</div><p className="text-gray-800">게스트 밤~새벽 문의 → 아침에 폰 확인. 답이 와있으면 바로 결제. 없으면 이탈.</p></div>
              <div className="bg-white/70 rounded-lg p-3"><div className="text-[11px] font-bold text-red-600 mb-1">대안</div><p className="text-gray-900 font-medium">밤~새벽 문의에 AI 자동 1차 응답. 사람이든 AI든 "아침에 답이 와있는 상태"가 핵심.</p></div>
            </div>
            <div className="bg-white/70 rounded-lg p-4">
              <h5 className="text-xs font-bold text-gray-600 mb-2">시간대별 메시지 (자동메시지 제외)</h5>
              <div className="space-y-0.5">
                {Array.from({ length: 24 }, (_, h) => {
                  const d = ta.hourly[String(h)] || { guest: 0, host: 0 };
                  const gP = maxH > 0 ? d.guest / maxH * 100 : 0;
                  const hP = maxH > 0 ? d.host / maxH * 100 : 0;
                  return (
                    <div key={h} className={`flex items-center gap-1 ${h === 8 ? "bg-yellow-50 rounded px-1 -mx-1" : ""}`}>
                      <span className={`w-8 text-[10px] text-right ${h === 8 ? "font-bold text-yellow-700" : "text-gray-400"}`}>{h}시</span>
                      <div className="flex-1 flex h-3 gap-px"><div className="bg-indigo-400 rounded-sm" style={{ width: `${gP}%` }} /><div className="bg-orange-400 rounded-sm" style={{ width: `${hP}%` }} /></div>
                      <span className="w-16 text-[9px] text-gray-400 text-right">{d.guest + d.host > 0 ? `${d.guest}/${d.host}` : ""}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                <span><span className="inline-block w-2 h-2 bg-indigo-400 rounded-sm mr-1" />게스트</span>
                <span><span className="inline-block w-2 h-2 bg-orange-400 rounded-sm mr-1" />호스트</span>
                <span className="ml-auto">08시 호스트 {ta.hourly["8"]?.host || 0}건 — 전날 밀린 문의 일괄 처리</span>
              </div>
            </div>
            <div className="bg-white/70 rounded-lg p-4">
              <h5 className="text-xs font-bold text-gray-600 mb-3">담당자별 업무 시작 시간</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {["김진우", "왕태경", "오재관"].map(nm => {
                  const hs = ta.handler_start[nm];
                  if (!hs) return null;
                  const mx = Math.max(...Object.values(hs.by_hour).map(Number));
                  const b9 = Object.entries(hs.by_hour).filter(([h]) => Number(h) < 9).reduce((s, [, v]) => s + Number(v), 0);
                  return (
                    <div key={nm} className="border rounded-lg p-3">
                      <div className={`text-sm font-bold ${HT[nm]}`}>{nm}</div>
                      <div className="text-xs text-gray-500 mb-2">평균 {hs.avg_start_hour.toFixed(1)}시 · 9시 이전 {hs.total_days > 0 ? Math.round(b9 / hs.total_days * 100) : 0}%</div>
                      <div className="space-y-0.5">{Object.entries(hs.by_hour).filter(([, v]) => Number(v) > 0).map(([h, v]) => (
                        <div key={h} className="flex items-center gap-1"><span className="text-[9px] text-gray-400 w-6 text-right">{h}시</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className={`${HC[nm]} h-full rounded-full`} style={{ width: `${mx > 0 ? Number(v) / mx * 100 : 0}%` }} /></div>
                          <span className="text-[9px] text-gray-400 w-6">{v}</span></div>
                      ))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              {[{ l: "오전 8~12시", v: ta.peak.morning, c: "bg-blue-100 text-blue-800" }, { l: "오후 14~18시", v: ta.peak.afternoon, c: "bg-emerald-100 text-emerald-800" }, { l: "저녁 18~23시", v: ta.peak.evening, c: "bg-amber-100 text-amber-800" }, { l: "심야 23~05시", v: ta.peak.night, c: "bg-gray-100 text-gray-700" }].map(p => (
                <div key={p.l} className={`flex-1 rounded-lg p-2 text-center ${p.c}`}><div className="text-[10px]">{p.l}</div><div className="text-base font-bold">{tp > 0 ? Math.round(p.v / tp * 100) : 0}%</div><div className="text-[10px] opacity-70">{p.v}건</div></div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* AI 자율배치 규칙 */}
      <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-3">AI 자율배치 규칙 (10개 발견 종합)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            "① 결제 마감 1시간 전 리마인드 (#1)",
            "② 문의 수신 → 10분 내 응답 (#2)",
            "③ 게스트 '네 알겠습니다' → 호스트 후속 필수 (#3)",
            "④ 공실 불가 시 호실+가격+입주일 대안 (#4,#5)",
            "⑤ 재문의 게스트 자동 감지 → VIP 대응 (#6)",
            "⑥ 첫 응답에 4정보 — 가격·공실·위치·옵션 (#7)",
            "⑦ 채널전환 시 Hostex 리드 자동 등록 (#8)",
            "⑧ 월 140건 초과 시 자동응답 확대 (#9)",
            "⑨ 밤~새벽 문의 → AI 1차 응답. 08시에 답 있는 상태 유지 (#10)",
          ].map((rule, i) => (
            <div key={i} className={`bg-white rounded-lg px-3 py-2 border text-gray-700 ${i === 8 ? "border-violet-400 bg-violet-50 font-medium" : "border-slate-200"}`}>{rule}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 실전 사례 ── */
function SamsamCaseStudies({ data }: { data: SamsamData }) {
  const cs = data.case_studies;
  const [caseTab, setCaseTab] = useState<"winning" | "ack" | "rooms">("winning");
  if (!cs) return <div className="py-12 text-center text-gray-400">사례 데이터가 없습니다.</div>;
  const ack = cs.ack_follow_up;
  const wfR = ack.with_follow_count > 0 ? Math.round(ack.with_follow_converted / ack.with_follow_count * 100) : 0;
  const nfR = ack.without_follow_count > 0 ? Math.round(ack.without_follow_converted / ack.without_follow_count * 100) : 0;
  const CL = ({ id }: { id: string }) => <a href={`https://web.33m2.co.kr/host/chat/${id}`} target="_blank" rel="noreferrer" className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 shrink-0">원문</a>;
  return (
    <div className="space-y-4">
      <div className="bg-slate-800 text-white rounded-xl p-5">
        <h3 className="text-lg font-bold mb-1">실전 사례 — 대화 원문에서 찾은 패턴</h3>
        <p className="text-sm text-slate-300">사라지는 데이터를 살린다. 클릭하면 33m2 원문으로 이동.</p>
      </div>
      <div className="flex gap-2">
        {([{ key: "winning" as const, label: `전환 직전 멘트 (${cs.winning_phrases.length})` }, { key: "ack" as const, label: `"네 알겠습니다" 후속 효과` }, { key: "rooms" as const, label: `객실별 비교 (${cs.room_comparisons.length})` }]).map(t => (
          <button key={t.key} onClick={() => setCaseTab(t.key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${caseTab === t.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{t.label}</button>
        ))}
      </div>
      {caseTab === "winning" && (<div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-emerald-800">전환 직전 호스트 메시지</h4>
          <p className="text-xs text-emerald-700 mt-1">결제완료/계약확정 바로 전 마지막 문장. 이게 결제를 끌어낸 트리거.</p>
        </div>
        <div className="bg-white border rounded-xl divide-y max-h-[600px] overflow-y-auto">
          {cs.winning_phrases.map((w, i) => (<div key={i} className="px-5 py-3 hover:bg-gray-50">
            <div className="flex items-center gap-2 mb-1"><span className="text-emerald-600 font-bold text-xs">WIN</span><span className="text-xs text-gray-500">{w.room_name}</span><span className="text-xs text-gray-400">· {w.participant}</span><CL id={w.chat_id} /></div>
            <p className="text-sm text-gray-900">"{w.host_msg}"</p>
          </div>))}
        </div>
      </div>)}
      {caseTab === "ack" && (<div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-amber-800">"네 알겠습니다" 이후 — 후속 한마디의 차이</h4>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-white rounded-lg p-3 text-center"><div className="text-xs text-gray-500">후속 있음</div><div className="text-2xl font-bold text-emerald-600">{wfR}%</div><div className="text-xs text-gray-400">{ack.with_follow_converted}/{ack.with_follow_count}건</div></div>
            <div className="bg-white rounded-lg p-3 text-center"><div className="text-xs text-gray-500">후속 없음</div><div className="text-2xl font-bold text-red-500">{nfR}%</div><div className="text-xs text-gray-400">{ack.without_follow_converted}/{ack.without_follow_count}건</div></div>
          </div>
        </div>
        <div className="bg-white border rounded-xl"><div className="px-5 py-3 border-b bg-emerald-50"><h4 className="text-sm font-bold text-emerald-800">후속 → 전환 성공</h4></div>
          <div className="divide-y max-h-[300px] overflow-y-auto">{ack.with_follow_examples.map((ex, i) => (<div key={i} className="px-5 py-3 hover:bg-gray-50">
            <div className="flex items-center gap-2 mb-1"><span className="text-emerald-600 font-bold text-[10px]">O</span><span className="text-xs text-gray-500">{ex.room_name}</span><CL id={ex.chat_id} /></div>
            <p className="text-xs text-gray-500">게스트: "{ex.ack_msg}"</p><p className="text-sm text-emerald-800 font-medium mt-0.5">호스트: "{ex.follow_msg}"</p>
          </div>))}</div>
        </div>
        <div className="bg-white border rounded-xl"><div className="px-5 py-3 border-b bg-red-50"><h4 className="text-sm font-bold text-red-800">후속 없음 → 취소</h4></div>
          <div className="divide-y max-h-[300px] overflow-y-auto">{ack.without_follow_examples.map((ex, i) => (<div key={i} className="px-5 py-3 hover:bg-gray-50">
            <div className="flex items-center gap-2 mb-1"><span className="text-red-500 font-bold text-[10px]">X</span><span className="text-xs text-gray-500">{ex.room_name}</span><CL id={ex.chat_id} /></div>
            <p className="text-xs text-gray-500">게스트: "{ex.ack_msg}"</p><p className="text-sm text-red-600 mt-0.5">(호스트 침묵 → 자동취소)</p>
          </div>))}</div>
        </div>
      </div>)}
      {caseTab === "rooms" && (<div className="space-y-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-indigo-800">같은 객실, 다른 결과</h4>
          <p className="text-xs text-indigo-700 mt-1">전환과 취소가 모두 있는 객실. 호스트 응대 차이가 결과를 갈랐다.</p>
        </div>
        <div className="space-y-4 max-h-[700px] overflow-y-auto">{cs.room_comparisons.map((rm, i) => (
          <div key={i} className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between"><h4 className="text-sm font-bold text-gray-800">{rm.room_name}</h4><span className="text-xs text-gray-500">전환 {rm.converted_count} · 취소 {rm.cancelled_count}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-x">
              <div className="p-4"><div className="text-xs font-bold text-emerald-600 mb-2">전환 성공</div>
                {rm.converted_examples.map((ex, j) => (<div key={j} className="mb-3 text-sm"><div className="flex items-center gap-1"><span className="text-xs text-gray-400">{ex.participant}</span><CL id={ex.chat_id} /></div><p className="text-gray-500 text-xs mt-0.5">게스트: "{ex.guest_first}"</p><p className="text-gray-800 mt-0.5">호스트: "{ex.host_summary}"</p></div>))}
              </div>
              <div className="p-4"><div className="text-xs font-bold text-red-500 mb-2">취소</div>
                {rm.cancelled_examples.map((ex, j) => (<div key={j} className="mb-3 text-sm"><div className="flex items-center gap-1"><span className="text-xs text-gray-400">{ex.participant}</span><CL id={ex.chat_id} /></div><p className="text-gray-500 text-xs mt-0.5">게스트: "{ex.guest_first}"</p><p className="text-gray-800 mt-0.5">호스트: "{ex.host_summary}"</p></div>))}
              </div>
            </div>
          </div>
        ))}</div>
      </div>)}
    </div>
  );
}

/* ── 운영 현황 차트 — 월/주/일 + 좌우 네비 ── */
type ChartMode = "month" | "week" | "day";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function OpsChart({ data }: { data: SamsamData }) {
  const [mode, setMode] = useState<ChartMode>("month");
  const [offset, setOffset] = useState(0);
  const WINDOW = 12;

  const gMap: Record<string, { cumulative: number }> = {};
  if (data.growth) for (const r of data.growth) gMap[r.month] = r;
  const HN = (m: string) => m <= '2025-06' ? '김진우' : m <= '2025-12' ? '왕태경' : '오재관';
  const HBG: Record<string, string> = { "김진우": "bg-blue-100", "왕태경": "bg-amber-50", "오재관": "bg-emerald-50" };

  // 채팅에서 날짜 추출 (month 필드 기반 + messages의 time_hint로 주/일 추출)
  const buckets: Record<string, { count: number; converted: number; cancelled: number; rate: number; rooms?: number }> = {};

  for (const c of data.chats) {
    let key = '';
    const m = c.month || '';
    if (mode === 'month') {
      key = m;
    } else {
      // 주/일은 message_insights의 time_hint에서 날짜 추출이 어려움
      // month만 있으므로 월 기준으로 대체 — 실제 주/일은 시간 데이터에서
      key = m; // fallback
    }
    if (!key) continue;
    if (!buckets[key]) buckets[key] = { count: 0, converted: 0, cancelled: 0, rate: 0 };
    buckets[key].count++;
    if (c.outcome === 'converted') buckets[key].converted++;
    if (c.outcome === 'cancelled') buckets[key].cancelled++;
  }

  // 시간 분석 데이터로 요일별/시간별 집계
  if (mode === 'day' && data.time_analysis) {
    // 시간대별을 요일처럼 보여줌 (0~23시)
    Object.keys(buckets).forEach(k => delete buckets[k]);
    for (let h = 0; h < 24; h++) {
      const hr = data.time_analysis.hourly[String(h)];
      if (hr) {
        buckets[`${h}시`] = { count: hr.guest + hr.host, converted: 0, cancelled: 0, rate: 0 };
      }
    }
  }

  if (mode === 'week') {
    // 요일별 — time_hint에서 추출 불가하므로 시간대 피크를 표시
    Object.keys(buckets).forEach(k => delete buckets[k]);
    const peaks = data.time_analysis?.peak;
    if (peaks) {
      buckets['오전(8~12)'] = { count: peaks.morning, converted: 0, cancelled: 0, rate: 0 };
      buckets['오후(14~18)'] = { count: peaks.afternoon, converted: 0, cancelled: 0, rate: 0 };
      buckets['저녁(18~23)'] = { count: peaks.evening, converted: 0, cancelled: 0, rate: 0 };
      buckets['심야(23~5)'] = { count: peaks.night, converted: 0, cancelled: 0, rate: 0 };
    }
  }

  for (const v of Object.values(buckets)) {
    const w = v.converted + v.cancelled;
    v.rate = w > 0 ? Number((v.converted / w * 100).toFixed(1)) : 0;
  }

  const allKeys = Object.keys(buckets).sort();

  // 월 모드: 12개씩 네비게이션
  let visibleKeys = allKeys;
  if (mode === 'month') {
    const end = allKeys.length + offset;
    const start = Math.max(0, end - WINDOW);
    visibleKeys = allKeys.slice(start, end);
  }

  // 최대값 기준 50%로 스케일 (상단 50 날리기)
  const maxCount = Math.max(...visibleKeys.map(k => buckets[k]?.count || 0));
  const scale = maxCount * 0.5; // 50%를 100%로 취급 → 바가 2배로 커짐
  const chartHeight = 160;

  return (
    <div className="bg-white border rounded-xl p-5">
      {/* 헤더: 제목 + 모드 전환 + 네비 */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-bold text-gray-700">운영 현황</h3>
        <div className="flex gap-1 ml-2">
          {(["month", "week", "day"] as ChartMode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setOffset(0); }}
              className={`px-2 py-0.5 text-[11px] rounded font-medium ${mode === m ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {m === 'month' ? '월' : m === 'week' ? '시간대' : '시간'}
            </button>
          ))}
        </div>
        {mode === 'month' && (
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setOffset(o => o - WINDOW)} disabled={allKeys.length + offset - WINDOW <= 0}
              className="px-2 py-0.5 text-sm rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30">‹</button>
            <span className="text-[10px] text-gray-400">{visibleKeys[0]?.slice(2)} ~ {visibleKeys[visibleKeys.length-1]?.slice(2)}</span>
            <button onClick={() => setOffset(o => Math.min(o + WINDOW, 0))} disabled={offset >= 0}
              className="px-2 py-0.5 text-sm rounded border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30">›</button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mb-3">파랑=문의, 초록=전환, 상단 숫자=전환율. 숙소 수=하단.</p>

      {/* 차트 */}
      <div className="flex items-end gap-[3px] mb-1" style={{ height: `${chartHeight}px` }}>
        {visibleKeys.map(k => {
          const b = buckets[k] || { count: 0, converted: 0, rate: 0 };
          const gr = gMap[k];
          const h = mode === 'month' ? HN(k) : '';
          // 스케일: scale을 100%로 취급
          const countH = scale > 0 ? Math.min(b.count / scale * chartHeight, chartHeight) : 0;
          const convH = scale > 0 ? Math.min(b.converted / scale * chartHeight, chartHeight * 0.95) : 0;
          return (
            <div key={k} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[9px] rounded px-2 py-1 whitespace-nowrap z-10">
                {k} | {b.count}문의 {b.converted}전환 {b.cancelled}취소 | {b.rate}%{gr ? ` | ${gr.cumulative}실` : ''}
              </div>
              <span className={`text-[9px] font-bold mb-0.5 ${b.rate > 15 ? "text-emerald-600" : b.rate < 8 && b.rate > 0 ? "text-red-500" : "text-gray-400"}`}>
                {b.count >= 20 && b.rate > 0 ? `${b.rate}%` : ''}
              </span>
              <div className="w-full relative" style={{ height: `${Math.max(countH, 2)}px` }}>
                <div className="absolute inset-0 bg-blue-200 rounded-t-sm" />
                <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-sm" style={{ height: `${Math.max(convH, b.converted > 0 ? 2 : 0)}px` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* X축 */}
      <div className="flex gap-[3px]">
        {visibleKeys.map(k => {
          const gr = gMap[k];
          const h = mode === 'month' ? HN(k) : '';
          const b = buckets[k] || { count: 0 };
          return (
            <div key={k} className={`flex-1 text-center rounded-sm py-0.5 ${mode === 'month' ? HBG[h] || '' : 'bg-gray-50'}`}>
              <div className="text-[9px] text-gray-600 font-medium">{mode === 'month' ? k.slice(5) : k}</div>
              {mode === 'month' && gr && <div className="text-[8px] font-bold text-slate-500">{gr.cumulative}실</div>}
              {mode !== 'month' && <div className="text-[8px] text-gray-400">{b.count}</div>}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
        <span><span className="inline-block w-3 h-2 bg-blue-200 rounded-sm mr-1" />문의</span>
        <span><span className="inline-block w-3 h-2 bg-emerald-500 rounded-sm mr-1" />전환</span>
        {mode === 'month' && <>
          <span><span className="inline-block w-2 h-2 bg-blue-100 rounded-sm mr-1" />김진우</span>
          <span><span className="inline-block w-2 h-2 bg-amber-50 border rounded-sm mr-1" />왕태경</span>
          <span><span className="inline-block w-2 h-2 bg-emerald-50 border rounded-sm mr-1" />오재관</span>
        </>}
      </div>
    </div>
  );
}

function SamsamOverview({ data }: { data: SamsamData }) {
  const wr = data.converted + data.cancelled;
  const rate = wr > 0 ? (data.converted / wr * 100).toFixed(1) : "0";
  const avgMsg = data.total_chats > 0 ? (data.total_messages / data.total_chats).toFixed(1) : "0";

  // 객실별 집계
  const roomMap: Record<string, { total: number; converted: number; cancelled: number; revenue: number; pending: number }> = {};
  for (const c of data.chats) {
    if (!roomMap[c.room_name]) roomMap[c.room_name] = { total: 0, converted: 0, cancelled: 0, revenue: 0, pending: 0 };
    roomMap[c.room_name].total++;
    if (c.outcome === "converted") { roomMap[c.room_name].converted++; roomMap[c.room_name].revenue += c.amount; }
    if (c.outcome === "cancelled") roomMap[c.room_name].cancelled++;
    if (c.outcome === "pending") roomMap[c.room_name].pending++;
  }
  const rooms = Object.entries(roomMap).sort((a, b) => b[1].total - a[1].total);

  // 금액대별 전환율
  const priceRanges = [
    { label: "~50만", min: 0, max: 500000 },
    { label: "50~80만", min: 500000, max: 800000 },
    { label: "80~100만", min: 800000, max: 1000000 },
    { label: "100만~", min: 1000000, max: Infinity },
  ];
  const priceStats = priceRanges.map(r => {
    const chats = data.chats.filter(c => c.amount >= r.min && c.amount < r.max);
    const conv = chats.filter(c => c.outcome === "converted").length;
    const canc = chats.filter(c => c.outcome === "cancelled").length;
    const decided = conv + canc;
    return { ...r, count: chats.length, conv, rate: decided > 0 ? (conv / decided * 100).toFixed(0) : "-" };
  });

  // 다회 시도 게스트
  const partCount: Record<string, number> = {};
  for (const c of data.chats) partCount[c.participant] = (partCount[c.participant] || 0) + 1;
  const multiGuests = Object.entries(partCount).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);

  // 계약 상태 분포
  const statusCount: Record<string, number> = {};
  for (const c of data.chats) {
    const s = c.contract_status || "미분류";
    statusCount[s] = (statusCount[s] || 0) + 1;
  }
  const statusEntries = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);

  const STATUS_COLORS: Record<string, string> = {
    "거주중": "bg-green-100 text-green-800", "입주대기": "bg-blue-100 text-blue-800",
    "계약대기": "bg-amber-100 text-amber-800", "계약종료": "bg-gray-100 text-gray-600",
    "취소": "bg-red-100 text-red-800", "결제취소": "bg-red-50 text-red-600",
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="총 채팅" value={`${data.total_chats}건`} accent="text-slate-800" />
        <SummaryCard label="총 메시지" value={`${data.total_messages}건`} accent="text-indigo-600" />
        <SummaryCard label="전환(결제)" value={`${data.converted}건`} accent="text-blue-600" />
        <SummaryCard label="취소" value={`${data.cancelled}건`} accent="text-red-500" />
        <SummaryCard label="전환율" value={`${rate}%`} accent="text-emerald-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="보류(진행중)" value={`${data.pending}건`} />
        <SummaryCard label="채팅당 평균 메시지" value={`${avgMsg}건`} />
        <SummaryCard label="다회 시도 게스트" value={`${multiGuests.length}명`} />
        <SummaryCard label="유니크 객실" value={`${Object.keys(roomMap).length}개`} />
      </div>

      {/* 계약 상태 분포 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">계약 상태 분포</h3>
        <div className="flex flex-wrap gap-2">
          {statusEntries.map(([s, cnt]) => (
            <div key={s} className={`rounded-lg px-3 py-2 text-center ${STATUS_COLORS[s] || "bg-gray-100 text-gray-700"}`}>
              <div className="text-lg font-bold">{cnt}</div>
              <div className="text-[10px]">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 금액대별 전환율 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">금액대별 전환율</h3>
        <div className="space-y-2">
          {priceStats.map(p => {
            const mx = Math.max(...priceStats.map(x => x.count));
            const barPct = mx > 0 ? (p.count / mx * 100) : 0;
            return (
              <div key={p.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-right text-sm text-gray-700">{p.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className={`h-full rounded-full transition-all flex items-center justify-end pr-2 ${Number(p.rate) > 30 ? "bg-blue-500" : "bg-gray-400"}`}
                    style={{ width: `${Math.max(barPct, 3)}%` }}>
                    {barPct > 20 && <span className="text-[11px] text-white font-bold">{p.count}건</span>}
                  </div>
                </div>
                <span className="w-28 text-right text-xs text-gray-500">{barPct <= 20 ? `${p.count}건` : ""} 전환 {p.rate}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 객실별 채팅 현황 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">객실별 채팅 현황</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">객실</th><th className="px-3 py-2 text-right">채팅</th>
            <th className="px-3 py-2 text-right">전환</th><th className="px-3 py-2 text-right">취소</th>
            <th className="px-3 py-2 text-right">보류</th><th className="px-3 py-2 text-right">매출</th>
            <th className="px-3 py-2 text-right">전환율</th>
          </tr></thead>
          <tbody>{rooms.map(([n, s]) => {
            const w = s.converted + s.cancelled; const r = w > 0 ? (s.converted / w * 100).toFixed(0) : "-";
            return (<tr key={n} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{n}</td><td className="px-3 py-2 text-right">{s.total}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">{s.converted}</td>
              <td className="px-3 py-2 text-right text-red-500">{s.cancelled}</td>
              <td className="px-3 py-2 text-right text-amber-500">{s.pending}</td>
              <td className="px-3 py-2 text-right font-medium">{s.revenue > 0 ? fmtM(s.revenue) : "-"}</td>
              <td className="px-3 py-2 text-right font-medium">{r}%</td>
            </tr>);
          })}</tbody>
        </table>
      </div>

      {/* 다회 시도 게스트 */}
      {multiGuests.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">다회 시도 게스트 ({multiGuests.length}명)</h3>
          <div className="space-y-2">
            {multiGuests.map(([name, cnt]) => {
              const chats = data.chats.filter(c => c.participant === name);
              const conv = chats.filter(c => c.outcome === "converted").length;
              const roomList = [...new Set(chats.map(c => c.room_name))];
              return (
                <div key={name} className="flex items-center gap-3 py-1">
                  <span className="text-sm font-medium text-gray-800 w-20">{name}</span>
                  <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{cnt}회</span>
                  <span className={`text-xs font-medium ${conv > 0 ? "text-blue-600" : "text-gray-400"}`}>전환 {conv}건</span>
                  <span className="text-xs text-gray-400 truncate">{roomList.join(", ")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SamsamTTFR({ data }: { data: SamsamData }) {
  const dm = data.by_response_type.direct_msg || { count: 0, converted: 0, cancelled: 0, rate: 0 };
  const ao = data.by_response_type.approve_only || { count: 0, converted: 0, cancelled: 0, rate: 0 };
  const rj = data.by_response_type.reject || { count: 0, converted: 0, cancelled: 0, rate: 0 };
  const nr = data.by_response_type.no_response || { count: 0, converted: 0, cancelled: 0, rate: 0 };
  const lift = nr.rate > 0 ? ((dm.rate - nr.rate) / nr.rate * 100).toFixed(0) : "∞";
  const mx = Math.max(...Object.values(data.by_response_type).map(v => v.count));

  // 응답 유형별 상세 테이블 데이터
  const respRows = Object.entries(data.by_response_type).map(([k, v]) => ({
    key: k, label: RESP_LABELS[k] || k, ...v,
    avgMsgs: (() => {
      const chats = data.chats.filter(c => c.response_type === k);
      return chats.length > 0 ? (chats.reduce((a, c) => a + c.total_msgs, 0) / chats.length).toFixed(1) : "-";
    })(),
    avgAmount: (() => {
      const chats = data.chats.filter(c => c.response_type === k && c.amount > 0);
      return chats.length > 0 ? fmtM(chats.reduce((a, c) => a + c.amount, 0) / chats.length) : "-";
    })(),
  }));

  // 응답 유형 × 질문 유형 교차
  const respXQuestion: Record<string, Record<string, { total: number; conv: number }>> = {};
  for (const c of data.chats) {
    if (!respXQuestion[c.response_type]) respXQuestion[c.response_type] = {};
    if (!respXQuestion[c.response_type][c.question_type]) respXQuestion[c.response_type][c.question_type] = { total: 0, conv: 0 };
    respXQuestion[c.response_type][c.question_type].total++;
    if (c.outcome === "converted") respXQuestion[c.response_type][c.question_type].conv++;
  }
  const qTypes = [...new Set(data.chats.map(c => c.question_type))];

  return (
    <div className="space-y-4">
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="호스트 응답률" value={`${data.response_rate}%`} accent="text-blue-600" />
        <SummaryCard label="직접 메시지 전환율" value={`${dm.rate}%`} accent="text-emerald-600" />
        <SummaryCard label="승인만 전환율" value={`${ao.rate}%`} accent="text-amber-600" />
        <SummaryCard label="무응답 전환율" value={`${nr.rate}%`} accent="text-red-500" />
        <SummaryCard label="Lift (직접 vs 무응답)" value={dm.rate > nr.rate ? `+${lift}%` : `${lift}%`} accent="text-violet-600" />
      </div>

      {/* 바 차트 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">호스트 응답 유형별 건수 + 전환율</h3>
        <div className="space-y-3">
          {Object.entries(data.by_response_type).map(([k, v]) => (
            <HBar key={k} label={RESP_LABELS[k] || k} value={v.count} max={mx} sub={`전환 ${v.rate}%`} color={v.rate > 10 ? "bg-blue-500" : v.rate > 0 ? "bg-blue-300" : "bg-gray-300"} />
          ))}
        </div>
      </div>

      {/* 응답 유형별 상세 테이블 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">응답 유형별 상세</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">유형</th><th className="px-3 py-2 text-right">건수</th>
            <th className="px-3 py-2 text-right">전환</th><th className="px-3 py-2 text-right">취소</th>
            <th className="px-3 py-2 text-right">전환율</th><th className="px-3 py-2 text-right">평균 메시지</th>
            <th className="px-3 py-2 text-right">평균 금액</th>
          </tr></thead>
          <tbody>{respRows.map(r => (
            <tr key={r.key} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="px-3 py-2 text-right">{r.count}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">{r.converted}</td>
              <td className="px-3 py-2 text-right text-red-500">{r.cancelled}</td>
              <td className="px-3 py-2 text-right font-bold">{r.rate}%</td>
              <td className="px-3 py-2 text-right">{r.avgMsgs}</td>
              <td className="px-3 py-2 text-right">{r.avgAmount}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* 응답 유형 × 질문 유형 교차 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">응답 유형 × 질문 유형 교차</h3>
          <p className="text-xs text-gray-400 mt-0.5">어떤 조합에서 전환이 일어나는가</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">응답 유형</th>
            {qTypes.map(q => <th key={q} className="px-3 py-2 text-right">{Q_LABELS[q] || q}</th>)}
          </tr></thead>
          <tbody>{Object.entries(respXQuestion).map(([rk, qs]) => (
            <tr key={rk} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{RESP_LABELS[rk] || rk}</td>
              {qTypes.map(q => {
                const cell = qs[q] || { total: 0, conv: 0 };
                const r = cell.total > 0 ? `${(cell.conv / cell.total * 100).toFixed(0)}%` : "-";
                return <td key={q} className="px-3 py-2 text-right">
                  {cell.total > 0 ? <div><span className="font-medium">{cell.total}</span><span className="text-[10px] text-gray-400 ml-1">({r})</span></div> : <span className="text-gray-200">-</span>}
                </td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* 핵심 발견 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-amber-800 mb-2">핵심 발견</h3>
        <div className="text-sm text-amber-700 space-y-1">
          <p>호스트 직접 메시지 O → 전환율 <strong>{dm.rate}%</strong> ({dm.converted}/{dm.converted + dm.cancelled}건)</p>
          <p>무응답 → 전환율 <strong>{nr.rate}%</strong>{nr.rate === 0 && " (전환 0건)"} ({nr.converted}/{nr.converted + nr.cancelled}건)</p>
          <p>거절 {rj.count}건 → 전환 <strong>{rj.converted}건</strong> (거절하면 100% 이탈)</p>
          {dm.rate > 0 && <p className="font-bold mt-2">결론: 호스트가 직접 메시지를 보내는 것이 전환의 핵심 조건</p>}
        </div>
      </div>
    </div>
  );
}

function SamsamFunnel({ data }: { data: SamsamData }) {
  const f = data.funnel;
  const steps = [
    { label: "채팅 시작", count: f.chat_started },
    { label: "호스트 응답", count: f.host_responded },
    { label: "승인", count: f.approved },
    { label: "결제 완료", count: f.paid },
  ];
  const mxQ = Math.max(...Object.values(data.by_question_type).map(v => v.count));
  const mxD = Math.max(...Object.values(data.by_depth).map(v => v.count));

  // 단계별 이탈률
  const dropoffs = steps.slice(1).map((s, i) => {
    const prev = steps[i].count;
    const drop = prev - s.count;
    const dropPct = prev > 0 ? (drop / prev * 100).toFixed(0) : "0";
    return { from: steps[i].label, to: s.label, drop, dropPct };
  });

  // 질문 유형별 상세 테이블
  const qRows = Object.entries(data.by_question_type).map(([k, v]) => {
    const chats = data.chats.filter(c => c.question_type === k);
    const avgAmount = chats.length > 0 ? fmtM(chats.reduce((a, c) => a + c.amount, 0) / chats.length) : "-";
    const avgMsgs = chats.length > 0 ? (chats.reduce((a, c) => a + c.total_msgs, 0) / chats.length).toFixed(1) : "-";
    return { key: k, label: Q_LABELS[k] || k, ...v, avgAmount, avgMsgs };
  });

  // 대화 깊이별 상세 테이블
  const depthRanges = { "0~1": [0, 1], "2~3": [2, 3], "4~6": [4, 6], "7+": [7, 999] } as Record<string, number[]>;
  const dRows = Object.entries(data.by_depth).map(([k, v]) => {
    const [min, max] = depthRanges[k] || [0, 999];
    const chats = data.chats.filter(c => c.total_msgs >= min && c.total_msgs <= max);
    const avgAmount = chats.length > 0 ? fmtM(chats.reduce((a, c) => a + c.amount, 0) / chats.length) : "-";
    const respRate = chats.length > 0 ? `${(chats.filter(c => c.response_type === "direct_msg").length / chats.length * 100).toFixed(0)}%` : "-";
    return { key: k, label: D_LABELS[k] || k, ...v, avgAmount, respRate };
  });

  // 질문 유형 × 대화 깊이 교차
  const depthKeys = Object.keys(data.by_depth);

  return (
    <div className="space-y-4">
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="채팅→응답" value={f.chat_started > 0 ? `${(f.host_responded / f.chat_started * 100).toFixed(0)}%` : "-"} />
        <SummaryCard label="응답→승인" value={f.host_responded > 0 ? `${(f.approved / f.host_responded * 100).toFixed(0)}%` : "-"} />
        <SummaryCard label="승인→결제" value={f.approved > 0 ? `${(f.paid / f.approved * 100).toFixed(0)}%` : "-"} />
        <SummaryCard label="전체 전환율" value={f.chat_started > 0 ? `${(f.paid / f.chat_started * 100).toFixed(0)}%` : "-"} />
      </div>

      {/* 퍼널 바 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">채팅 → 응답 → 승인 → 결제</h3>
        <div className="space-y-3">{steps.map((s, i) => {
          const pct = f.chat_started > 0 ? s.count / f.chat_started * 100 : 0;
          return (<div key={i} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium text-gray-700">{s.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-3" style={{ width: `${Math.max(pct, 3)}%` }}>
                {pct > 15 && <span className="text-xs text-white font-bold">{s.count}건</span>}
              </div>
            </div>
            <span className="w-24 text-right text-sm text-gray-500">{pct <= 15 && `${s.count}건`} ({pct.toFixed(0)}%)</span>
          </div>);
        })}</div>
      </div>

      {/* 단계별 이탈 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">단계별 이탈</h3>
        <div className="grid grid-cols-3 gap-3">
          {dropoffs.map(d => (
            <div key={d.from} className="border rounded-lg p-3 text-center">
              <div className="text-xs text-gray-400">{d.from} → {d.to}</div>
              <div className="text-xl font-bold text-red-500 mt-1">-{d.drop}건</div>
              <div className="text-xs text-gray-500">이탈 {d.dropPct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* 질문 유형별 상세 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">게스트 첫 질문 유형별 전환율</h3>
        <div className="space-y-3">{Object.entries(data.by_question_type).map(([k, v]) => (
          <HBar key={k} label={Q_LABELS[k] || k} value={v.count} max={mxQ} sub={`전환 ${v.rate}%`} color={v.rate > 8 ? "bg-emerald-500" : v.rate > 0 ? "bg-emerald-300" : "bg-gray-300"} />
        ))}</div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">질문 유형별 상세</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">질문 유형</th><th className="px-3 py-2 text-right">건수</th>
            <th className="px-3 py-2 text-right">전환</th><th className="px-3 py-2 text-right">취소</th>
            <th className="px-3 py-2 text-right">전환율</th><th className="px-3 py-2 text-right">평균 메시지</th>
            <th className="px-3 py-2 text-right">평균 금액</th>
          </tr></thead>
          <tbody>{qRows.map(r => (
            <tr key={r.key} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="px-3 py-2 text-right">{r.count}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">{r.converted}</td>
              <td className="px-3 py-2 text-right text-red-500">{r.cancelled}</td>
              <td className="px-3 py-2 text-right font-bold">{r.rate}%</td>
              <td className="px-3 py-2 text-right">{r.avgMsgs}</td>
              <td className="px-3 py-2 text-right">{r.avgAmount}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* 대화 깊이별 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">대화 깊이별 전환율</h3>
        <div className="space-y-3">{Object.entries(data.by_depth).map(([k, v]) => (
          <HBar key={k} label={D_LABELS[k] || k} value={v.count} max={mxD} sub={`전환 ${v.rate}%`} color={v.rate > 10 ? "bg-violet-500" : v.rate > 0 ? "bg-violet-300" : "bg-gray-300"} />
        ))}</div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-bold text-gray-700">대화 깊이별 상세</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">깊이</th><th className="px-3 py-2 text-right">건수</th>
            <th className="px-3 py-2 text-right">전환</th><th className="px-3 py-2 text-right">취소</th>
            <th className="px-3 py-2 text-right">전환율</th><th className="px-3 py-2 text-right">평균 금액</th>
            <th className="px-3 py-2 text-right">직접메시지 비율</th>
          </tr></thead>
          <tbody>{dRows.map(r => (
            <tr key={r.key} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{r.label}</td>
              <td className="px-3 py-2 text-right">{r.count}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">{r.converted}</td>
              <td className="px-3 py-2 text-right text-red-500">{r.cancelled}</td>
              <td className="px-3 py-2 text-right font-bold">{r.rate}%</td>
              <td className="px-3 py-2 text-right">{r.avgAmount}</td>
              <td className="px-3 py-2 text-right">{r.respRate}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* 핵심 발견 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-amber-800 mb-2">퍼널 핵심 발견</h3>
        <div className="text-sm text-amber-700 space-y-1">
          <p>최대 이탈 구간: <strong>{dropoffs.sort((a, b) => b.drop - a.drop)[0]?.from} → {dropoffs.sort((a, b) => b.drop - a.drop)[0]?.to}</strong> (-{dropoffs.sort((a, b) => b.drop - a.drop)[0]?.drop}건, {dropoffs.sort((a, b) => b.drop - a.drop)[0]?.dropPct}%)</p>
          {qRows.filter(q => q.count > 0).sort((a, b) => b.rate - a.rate)[0] && (
            <p>최고 전환 질문 유형: <strong>{qRows.filter(q => q.count > 0).sort((a, b) => b.rate - a.rate)[0].label}</strong> ({qRows.filter(q => q.count > 0).sort((a, b) => b.rate - a.rate)[0].rate}%)</p>
          )}
          {dRows.filter(d => d.count > 0).sort((a, b) => b.rate - a.rate)[0] && (
            <p>최고 전환 깊이: <strong>{dRows.filter(d => d.count > 0).sort((a, b) => b.rate - a.rate)[0].label}</strong> ({dRows.filter(d => d.count > 0).sort((a, b) => b.rate - a.rate)[0].rate}%)</p>
          )}
        </div>
      </div>
    </div>
  );
}

const SAMSAM_INSIGHT_COLORS: Record<string, string> = {
  "가격/비용": "bg-green-100 text-green-800",
  "입주/기간": "bg-blue-100 text-blue-800",
  "주차": "bg-amber-100 text-amber-800",
  "반려동물": "bg-orange-100 text-orange-800",
  "위치/교통": "bg-indigo-100 text-indigo-800",
  "시설/옵션": "bg-violet-100 text-violet-800",
  "전입신고": "bg-rose-100 text-rose-800",
  "체크인/입실": "bg-cyan-100 text-cyan-800",
  "인사/요청": "bg-gray-100 text-gray-700",
  "결제/계약": "bg-emerald-100 text-emerald-800",
  "칭찬/만족": "bg-lime-100 text-lime-800",
  "불안/망설임": "bg-red-100 text-red-800",
};

function SamsamInsight({ data }: { data: SamsamData }) {
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const ins = data.message_insights;
  if (!ins) return <div className="py-12 text-center text-gray-400">인사이트 데이터가 없습니다.</div>;

  const filtered = filterCat ? ins.items.filter(i => i.category === filterCat) : ins.items;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-xs text-amber-700">
          삼삼엠투 게스트 메시지에서 <b>문의 유형, 불안 신호, 전환 단서</b>를 키워드 분류.
          각 카테고리별 <b>전환율</b>이 표시되어 어떤 문의가 결제로 이어지는지 확인할 수 있습니다.
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="게스트 메시지" value={`${ins.total_guest_messages}건`} accent="text-indigo-600" />
        <SummaryCard label="인사이트 감지" value={`${ins.total_insights}건`} accent="text-blue-600" />
        <SummaryCard label="감지율" value={ins.total_guest_messages > 0 ? `${Math.round(ins.total_insights / ins.total_guest_messages * 100)}%` : "0%"} accent="text-emerald-600" />
        <SummaryCard label="카테고리 수" value={`${ins.top_reasons.length}개`} accent="text-violet-600" />
      </div>

      {/* 키워드 TOP — 전환율 포함 */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">문의 유형별 감지 + 전환율</h3>
        <div className="space-y-2">
          {ins.top_reasons.map((r, idx) => (
            <div key={r.category} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-5">{idx + 1}</span>
              <button onClick={() => setFilterCat(filterCat === r.category ? null : r.category)}
                className={`text-xs px-2 py-1 rounded-full shrink-0 ${filterCat === r.category ? "ring-2 ring-blue-400" : ""} ${SAMSAM_INSIGHT_COLORS[r.category] || "bg-gray-100"}`}>
                {r.category}
              </button>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(r.percent * 3, 100)}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-900 w-10 text-right">{r.count}</span>
              <span className="text-xs text-gray-400 w-12 text-right">{r.percent}%</span>
              <span className={`text-xs font-medium w-16 text-right ${r.conversion_rate > 15 ? "text-blue-600" : r.conversion_rate < 5 ? "text-red-500" : "text-gray-600"}`}>
                전환 {r.conversion_rate}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterCat(null)}
          className={`px-3 py-1 text-xs rounded-full border ${!filterCat ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
          전체 ({ins.total_insights})
        </button>
        {ins.top_reasons.map(r => (
          <button key={r.category} onClick={() => setFilterCat(filterCat === r.category ? null : r.category)}
            className={`px-3 py-1 text-xs rounded-full border ${
              filterCat === r.category ? SAMSAM_INSIGHT_COLORS[r.category] || "bg-gray-200" : "bg-white text-gray-600 border-gray-200"
            }`}>{r.category} ({r.count})</button>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm text-gray-900">
            메시지 ({filtered.length}건)
            {filterCat && <span className="ml-2 text-gray-400 font-normal">- {filterCat}</span>}
          </h3>
        </div>
        <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
          {filtered.map((item, idx) => {
            const outcomeIcon = item.outcome === "converted" ? "O" : item.outcome === "cancelled" ? "X" : "~";
            const outcomeColor = item.outcome === "converted" ? "text-blue-600" : item.outcome === "cancelled" ? "text-red-500" : "text-gray-400";
            return (
              <div key={idx} className="px-4 py-2.5 hover:bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${SAMSAM_INSIGHT_COLORS[item.category] || "bg-gray-100"}`}>{item.category}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">"{item.matched_keyword}"</span>
                  <span className={`text-xs font-bold ${outcomeColor}`}>{outcomeIcon}</span>
                  {item.time_hint && <span className="text-xs text-gray-400">{item.time_hint}</span>}
                  <a href={`https://web.33m2.co.kr/host/chat/${item.chat_id}`} target="_blank" rel="noreferrer"
                    className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">채팅</a>
                </div>
                <p className="text-sm text-gray-900 line-clamp-2">{item.content}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-600">{item.participant}</span>
                  <span className="text-xs text-gray-400">· {item.room_name}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">감지된 메시지가 없습니다</div>}
        </div>
      </div>
    </div>
  );
}

function SamsamMessageList({ data }: { data: SamsamData }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterOutcome, setFilterOutcome] = useState<string | null>(null);
  const [filterResp, setFilterResp] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "amount_desc" | "msgs_desc">("default");

  let filtered = data.chats;
  if (filterOutcome) filtered = filtered.filter(c => c.outcome === filterOutcome);
  if (filterResp) filtered = filtered.filter(c => c.response_type === filterResp);
  if (sortBy === "amount_desc") filtered = [...filtered].sort((a, b) => b.amount - a.amount);
  if (sortBy === "msgs_desc") filtered = [...filtered].sort((a, b) => b.total_msgs - a.total_msgs);

  const OUTCOME_LABELS: Record<string, string> = { converted: "전환", cancelled: "취소", pending: "보류" };
  const CONTRACT_COLORS: Record<string, string> = {
    "거주중": "bg-green-100 text-green-700", "입주대기": "bg-blue-100 text-blue-700",
    "계약대기": "bg-amber-100 text-amber-700", "취소": "bg-red-100 text-red-700",
    "결제취소": "bg-red-50 text-red-500", "계약종료": "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-4">
      {/* 필터 + 정렬 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500">결과:</span>
        {[null, "converted", "cancelled", "pending"].map(o => (
          <button key={o || "all"} onClick={() => setFilterOutcome(o)}
            className={`px-3 py-1 text-xs rounded-full border ${filterOutcome === o ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
            {o ? `${OUTCOME_LABELS[o]} (${data.chats.filter(c => c.outcome === o).length})` : `전체 (${data.chats.length})`}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        <span className="text-xs font-bold text-gray-500">응답:</span>
        {[null, "direct_msg", "no_response", "reject", "approve_only"].map(r => {
          const cnt = r ? data.chats.filter(c => c.response_type === r).length : null;
          if (r && cnt === 0) return null;
          return (
            <button key={r || "all"} onClick={() => setFilterResp(r)}
              className={`px-3 py-1 text-xs rounded-full border ${filterResp === r ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
              {r ? `${RESP_LABELS[r]} (${cnt})` : "전체"}
            </button>
          );
        })}
        <span className="text-gray-300 mx-1">|</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-xs border rounded-lg px-2 py-1">
          <option value="default">기본 정렬</option>
          <option value="amount_desc">금액 높은순</option>
          <option value="msgs_desc">메시지 많은순</option>
        </select>
      </div>

      {/* 목록 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">채팅 목록 ({filtered.length}건)</h3>
        </div>
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {filtered.map(c => {
            const icon = c.outcome === "converted" ? "O" : c.outcome === "cancelled" ? "X" : "~";
            const ic = c.outcome === "converted" ? "text-blue-600 bg-blue-50" : c.outcome === "cancelled" ? "text-red-500 bg-red-50" : "text-amber-500 bg-amber-50";
            return (
              <div key={c.chat_id}>
                <button onClick={() => setExpanded(expanded === c.chat_id ? null : c.chat_id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${ic}`}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{c.room_name}</div>
                    <div className="text-xs text-gray-400">
                      {c.participant} · 게스트 {c.guest_count} · 호스트 {c.host_count} · 총 {c.total_msgs}건
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="flex items-center gap-1 justify-end">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.response_type === "direct_msg" ? "bg-green-50 text-green-700" : c.response_type === "no_response" ? "bg-red-50 text-red-600" : c.response_type === "reject" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                      }`}>{RESP_LABELS[c.response_type] || c.response_type}</span>
                    </div>
                    {c.amount > 0 && <div className="text-xs font-medium text-gray-700">{c.amount.toLocaleString()}원</div>}
                  </div>
                </button>
                {expanded === c.chat_id && (
                  <div className="px-5 pb-3 pt-2 bg-gray-50 border-t space-y-1">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span>결과: <strong>{OUTCOME_LABELS[c.outcome] || c.outcome}</strong></span>
                      <span>· 응답: {RESP_LABELS[c.response_type]}</span>
                      <span>· 첫 질문: {Q_LABELS[c.question_type] || c.question_type}</span>
                      <span>· 금액: {c.amount.toLocaleString()}원</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {c.contract_status && (
                        <span className={`px-2 py-0.5 rounded-full ${CONTRACT_COLORS[c.contract_status] || "bg-gray-100 text-gray-600"}`}>
                          계약: {c.contract_status}
                        </span>
                      )}
                      {c.payment_status && (
                        <span className={`px-2 py-0.5 rounded-full ${c.payment_status === "결제완료" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          결제: {c.payment_status}
                        </span>
                      )}
                      <a href={`https://web.33m2.co.kr/host/chat/${c.chat_id}`} target="_blank" rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">33m2에서 열기</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   비앤비 메시지 — 5개 서브탭
   데이터: /messages/analysis, /messages/insight, /messages/stats
   ================================================================ */
interface InsightItem {
  conversation_id: string; guest_name: string; guest_name_clean?: string; property_name: string;
  category: string; content: string; sender_type: string;
  sent_at: string; channel_type: string; matched_keyword: string;
}
interface ReasonSummary { category: string; count: number; percent: number; examples: string[]; }
interface InsightData {
  period: string; start_date: string; end_date: string;
  total_messages: number; total_guest: number;
  items: InsightItem[]; category_counts: Record<string, number>;
  channel_counts: Record<string, number>; top_reasons: ReasonSummary[];
}
// AnalysisData 타입 제거 — insight API만 사용

const INSIGHT_COLORS: Record<string, string> = {
  "가격/가성비": "bg-green-100 text-green-800", "위치/교통": "bg-blue-100 text-blue-800",
  "깨끗/청결": "bg-cyan-100 text-cyan-800", "넓이/공간": "bg-indigo-100 text-indigo-800",
  "시설/옵션": "bg-violet-100 text-violet-800", "장기/출장": "bg-amber-100 text-amber-800",
  "이사/독립": "bg-orange-100 text-orange-800", "여행/관광": "bg-pink-100 text-pink-800",
  "재방문/단골": "bg-emerald-100 text-emerald-800", "추천받음": "bg-lime-100 text-lime-800",
  "사진/기대": "bg-yellow-100 text-yellow-800", "체류목적-의료": "bg-red-100 text-red-800",
  "체류목적-학업": "bg-sky-100 text-sky-800", "즉시입주": "bg-rose-100 text-rose-800",
};
const ISSUE_COLORS: Record<string, string> = {
  "시설 고장": "bg-red-100 text-red-800", "청결 불만": "bg-orange-100 text-orange-800",
  "소음": "bg-amber-100 text-amber-800", "체크인 문제": "bg-blue-100 text-blue-800",
  "소모품/비품": "bg-cyan-100 text-cyan-800", "교통/주차": "bg-indigo-100 text-indigo-800",
  "변경/연장": "bg-violet-100 text-violet-800", "환불/취소": "bg-rose-100 text-rose-800",
  "칭찬": "bg-green-100 text-green-800",
};

/* ════════════════════════════════════════════════
   비앤비 메시지 — 5단계 종합 분석 퍼널
   전원도시 → 기능주의 → 뉴어바니즘 → OS → HIERO
   ════════════════════════════════════════════════ */

interface FunnelData {
  period: { from: string; to: string; prev_from: string; prev_to: string };
  stage1: {
    trends: { month: string; channel_type: string; cnt: number }[];
    prev_trends: { month: string; channel_type: string; cnt: number }[];
    prop_changes: { property_name: string; current: number; previous: number; change: number }[];
  };
  stage2: {
    by_category: { category: string; tag_type: string; cnt: number }[];
    by_property: { property_name: string; category: string; cnt: number }[];
  };
  stage3: {
    cases: { conversation_id: string; guest_name: string; property_name: string; channel_type: string; check_in: string; check_out: string; nights: number; total_rate: number; first_message: string; message_count: number; is_repeat: boolean }[];
    case_count: number;
  };
  stage4: {
    patterns: { name: string; count: number; description: string }[];
  };
}

function AirbnbInsight({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStage, setOpenStage] = useState<number>(1);
  const token = localStorage.getItem("token");

  useEffect(() => { loadFunnel(); }, [dateFrom, dateTo]);

  async function loadFunnel() {
    setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API}/analysis/funnel?from=${dateFrom}&to=${dateTo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFunnel(await res.json());
    } catch { /* */ }
    setLoading(false);
  }

  if (loading && !funnel) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  if (!funnel) return <div className="py-12 text-center text-gray-400">데이터 없음</div>;

  const stages = [
    { num: 1, title: "문제 정의", sub: "전원도시", desc: "지금 뭐가 안 되고 있는가" },
    { num: 2, title: "기능 분류", sub: "기능주의", desc: "메시지를 구조화하고 분류한다" },
    { num: 3, title: "맥락 연결", sub: "뉴어바니즘", desc: "대화 단위로 여정을 걷는다" },
    { num: 4, title: "패턴 감지", sub: "OS", desc: "반복되면 패턴이다" },
    { num: 5, title: "발견", sub: "HIERO", desc: "4개 렌즈를 겹쳐서 본다" },
  ];

  // Stage 1 계산
  const s1 = funnel.stage1;
  const channelTotals: Record<string, number> = {};
  const prevChannelTotals: Record<string, number> = {};
  for (const t of s1.trends) channelTotals[t.channel_type] = (channelTotals[t.channel_type] || 0) + t.cnt;
  for (const t of s1.prev_trends) prevChannelTotals[t.channel_type] = (prevChannelTotals[t.channel_type] || 0) + t.cnt;
  const totalCurrent = Object.values(channelTotals).reduce((a, b) => a + b, 0);
  const totalPrev = Object.values(prevChannelTotals).reduce((a, b) => a + b, 0);

  // Stage 2 계산
  const insightCats = funnel.stage2.by_category.filter(c => c.tag_type === "insight").sort((a, b) => b.cnt - a.cnt);
  const issueCats = funnel.stage2.by_category.filter(c => c.tag_type === "issue").sort((a, b) => b.cnt - a.cnt);

  // Stage 1 하락 숙소
  const declining = [...s1.prop_changes].filter(p => p.change < 0).sort((a, b) => a.change - b.change).slice(0, 10);
  const growing = [...s1.prop_changes].filter(p => p.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);

  return (
    <div className="space-y-3">
      {/* 기간 표시 */}
      <div className="text-xs text-gray-400">{funnel.period.from} ~ {funnel.period.to} (비교: {funnel.period.prev_from} ~ {funnel.period.prev_to})</div>

      {/* 5단계 탭 */}
      <div className="flex gap-1">
        {stages.map(s => (
          <button key={s.num} onClick={() => setOpenStage(s.num)}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-medium transition ${
              openStage === s.num ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            <div>{s.num}. {s.title}</div>
            <div className="text-[10px] opacity-60">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* ═══ Stage 1: 문제 정의 ═══ */}
      {openStage === 1 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-1">예약 추이</h3>
            <p className="text-xs text-gray-400 mb-3">현재 기간 vs 이전 기간 채널별 비교</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <SummaryCard label="현재 총 예약" value={`${totalCurrent}건`} />
              <SummaryCard label="이전 기간" value={`${totalPrev}건`} />
              <SummaryCard label="증감" value={`${totalCurrent - totalPrev > 0 ? "+" : ""}${totalCurrent - totalPrev}건`} />
              <SummaryCard label="변화율" value={totalPrev > 0 ? `${((totalCurrent - totalPrev) / totalPrev * 100).toFixed(0)}%` : "-"} />
            </div>
            <div className="space-y-2">
              {Object.entries(channelTotals).sort((a, b) => b[1] - a[1]).map(([ch, cnt]) => {
                const prev = prevChannelTotals[ch] || 0;
                const change = cnt - prev;
                return (
                  <div key={ch} className="flex items-center gap-3">
                    <span className="w-28 text-right text-sm text-gray-700">{ch}</span>
                    <span className="w-16 text-right font-bold">{cnt}</span>
                    <span className={`w-20 text-right text-xs ${change > 0 ? "text-green-600" : change < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {change > 0 ? "+" : ""}{change} ({prev > 0 ? `${(change / prev * 100).toFixed(0)}%` : "new"})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {declining.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-red-800 mb-2">하락 숙소 TOP {declining.length}</h3>
              <div className="space-y-1">
                {declining.map(p => (
                  <div key={p.property_name} className="flex items-center gap-2 text-sm">
                    <Link to={`/reservations?keyword=${encodeURIComponent(p.property_name)}`} className="text-red-700 hover:underline font-medium">{p.property_name}</Link>
                    <span className="text-red-500 text-xs">{p.current}건 (이전 {p.previous}건, {p.change})</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-red-600 mt-2 font-medium">→ 2단계에서 이 숙소들의 메시지를 분류합니다</p>
            </div>
          )}

          {growing.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-green-800 mb-2">성장 숙소 TOP {growing.length}</h3>
              <div className="space-y-1">
                {growing.map(p => (
                  <div key={p.property_name} className="flex items-center gap-2 text-sm">
                    <span className="text-green-700 font-medium">{p.property_name}</span>
                    <span className="text-green-600 text-xs">+{p.change} ({p.current}건)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setOpenStage(2)} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm">
            → 2단계: 이 숙소들의 메시지 분류로
          </button>
        </div>
      )}

      {/* ═══ Stage 2: 기능 분류 ═══ */}
      {openStage === 2 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-1">인사이트 카테고리</h3>
            <p className="text-xs text-gray-400 mb-3">"왜 왔는가" 키워드 매칭 — 기능주의적 분류. 참고만.</p>
            <div className="space-y-1.5">
              {insightCats.slice(0, 10).map(c => {
                const mx = insightCats[0]?.cnt || 1;
                return (
                  <div key={c.category} className="flex items-center gap-2">
                    <span className={`w-28 text-right text-xs px-2 py-0.5 rounded-full ${INSIGHT_COLORS[c.category] || "bg-gray-100"}`}>{c.category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: `${c.cnt / mx * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs text-gray-500">{c.cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-1">이슈 카테고리</h3>
            <div className="space-y-1.5">
              {issueCats.slice(0, 8).map(c => {
                const mx = issueCats[0]?.cnt || 1;
                return (
                  <div key={c.category} className="flex items-center gap-2">
                    <span className={`w-28 text-right text-xs px-2 py-0.5 rounded-full ${ISSUE_COLORS[c.category] || "bg-gray-100"}`}>{c.category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full rounded-full ${c.category === "칭찬" ? "bg-green-400" : "bg-red-300"}`} style={{ width: `${c.cnt / mx * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs text-gray-500">{c.cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">이 숫자는 단어 빈도입니다. 맥락 없는 집계. 3단계에서 실제 대화를 봐야 의미가 생깁니다.</p>
          </div>

          <button onClick={() => setOpenStage(3)} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm">
            → 3단계: 실제 대화 맥락으로
          </button>
        </div>
      )}

      {/* ═══ Stage 3: 맥락 연결 ═══ */}
      {openStage === 3 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-1">대화 케이스 ({funnel.stage3.case_count}건)</h3>
            <p className="text-xs text-gray-400 mb-3">게스트 + 숙소 + 예약 + 첫 메시지 = 하나의 케이스. 거리를 걸으세요.</p>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {funnel.stage3.cases.map((c, idx) => (
              <div key={idx} className="bg-white border rounded-xl p-4 hover:border-blue-300 transition">
                <div className="flex items-center gap-2 mb-2">
                  {c.property_name && (
                    <Link to={`/reservations?keyword=${encodeURIComponent(c.property_name)}`}
                      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600">{c.property_name}</Link>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{c.channel_type}</span>
                  {c.nights > 0 && <span className="text-xs text-gray-500">{c.nights}박</span>}
                  {c.is_repeat && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">재방문</span>}
                  {c.total_rate > 0 && <span className="text-xs text-gray-400">{(c.total_rate / 10000).toFixed(0)}만원</span>}
                  <Link to={`/messages?conv=${c.conversation_id}`}
                    className="ml-auto text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">대화 원문</Link>
                </div>
                {c.first_message ? (
                  <p className="text-sm text-gray-900 line-clamp-2">{c.first_message}</p>
                ) : (
                  <p className="text-sm text-gray-300 italic">첫 메시지 없음</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Link to={`/messages?conv=${c.conversation_id}`} className="text-xs text-gray-600 hover:text-blue-600">{c.guest_name}</Link>
                  {c.check_in && <span className="text-[10px] text-gray-400">{c.check_in} ~ {c.check_out}</span>}
                  <span className="text-[10px] text-gray-400">메시지 {c.message_count}건</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setOpenStage(4)} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm">
            → 4단계: 이 케이스들에서 패턴 찾기
          </button>
        </div>
      )}

      {/* ═══ Stage 4: 패턴 감지 ═══ */}
      {openStage === 4 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">감지된 패턴</h3>
            <div className="space-y-3">
              {funnel.stage4.patterns.map((p, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{p.name.replace(/_/g, " ")}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{p.count}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">패턴은 시스템이 감지합니다. 하지만 "왜"는 사람이 판단합니다. 3단계 케이스를 다시 보면서 패턴의 원인을 찾으세요.</p>
          </div>

          <button onClick={() => setOpenStage(5)} className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm">
            → 5단계: 종합 발견으로
          </button>
        </div>
      )}

      {/* ═══ Stage 5: 발견 (HIERO) ═══ */}
      {openStage === 5 && (
        <div className="space-y-4">
          <div className="bg-gray-900 text-white rounded-xl p-5">
            <h3 className="text-sm font-bold mb-2">HIERO — 종합 발견</h3>
            <p className="text-xs opacity-70 mb-4">1~4단계를 관통해서 보이는 것. 시스템이 제시하는 것이 아니라, 당신이 걸으면서 발견하는 것.</p>

            <div className="space-y-3">
              {/* 1단계 요약 */}
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] text-white/50 mb-1">1. 문제</div>
                <p className="text-sm">예약 {totalCurrent}건 (이전 {totalPrev}건, {totalCurrent - totalPrev > 0 ? "+" : ""}{totalCurrent - totalPrev})</p>
                {declining.length > 0 && <p className="text-xs opacity-70 mt-1">하락 숙소 {declining.length}개: {declining.slice(0, 3).map(p => p.property_name).join(", ")}</p>}
              </div>

              {/* 2단계 요약 */}
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] text-white/50 mb-1">2. 분류</div>
                <p className="text-sm">인사이트 TOP: {insightCats.slice(0, 3).map(c => `${c.category}(${c.cnt})`).join(" · ")}</p>
                <p className="text-xs opacity-70 mt-1">이슈 TOP: {issueCats.filter(c => c.category !== "칭찬").slice(0, 3).map(c => `${c.category}(${c.cnt})`).join(" · ")}</p>
              </div>

              {/* 3단계 요약 */}
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] text-white/50 mb-1">3. 맥락</div>
                <p className="text-sm">{funnel.stage3.case_count}개 대화 케이스</p>
                {(() => {
                  const repeats = funnel.stage3.cases.filter(c => c.is_repeat).length;
                  const avgNights = funnel.stage3.cases.filter(c => c.nights > 0);
                  const avg = avgNights.length > 0 ? (avgNights.reduce((a, c) => a + c.nights, 0) / avgNights.length).toFixed(1) : "-";
                  return <p className="text-xs opacity-70 mt-1">재방문 {repeats}명 · 평균 {avg}박</p>;
                })()}
              </div>

              {/* 4단계 요약 */}
              <div className="bg-white/10 rounded-lg p-3">
                <div className="text-[10px] text-white/50 mb-1">4. 패턴</div>
                {funnel.stage4.patterns.map((p, i) => (
                  <p key={i} className="text-xs">{p.name.replace(/_/g, " ")}: {p.description}</p>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/20">
              <p className="text-xs opacity-50">5단계는 위 4개를 겹쳐서 읽는 당신의 판단입니다.</p>
              <p className="text-xs opacity-50">새 질문이 생기면 → 기간을 바꾸고 1단계부터 다시 시작하세요.</p>
            </div>
          </div>

          <button onClick={() => setOpenStage(1)} className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
            ↺ 1단계로 돌아가기 (새 질문으로)
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   개인입금 분석 대시보드
   데이터: /public/direct_payment_analysis.json
   ================================================================ */
type DirectSubTab = "overview" | "source" | "hiero_guests" | "monthly" | "list";

interface ExtensionChain {
  guest_name: string; guest_name_clean?: string; extensions: number; total_nights: number; total_revenue: number;
  first_check_in: string; last_check_out: string; origin: string;
  properties: string[]; same_property: boolean;
  samsam_room: string | null; samsam_outcome: string | null; call_count: number;
  bookings: { check_in: string; check_out: string; nights: number; total_rate: number; property_name: string }[];
}

interface TrackingDetail {
  guest_name: string; guest_name_clean?: string; phone_last4: string; property: string; revenue: number;
  first_visit: string; visits: number;
  call?: { call_count: number; total_min: number; first_date: string; last_date: string };
  samsam?: { room_name: string; outcome: string; chat_id: string; month: string; amount: number; chat_count: number };
  same_property?: boolean;
}

interface DirectData {
  summary: {
    total: number; accepted: number; cancelled: number;
    total_revenue: number; total_nights: number;
    avg_rate: number; avg_nights: number; phone_rate: number;
    share_of_total: number; revenue_share: number;
  };
  comparison: {
    direct: { count: number; revenue: number; nights: number; avg_rate: number };
    ota: { count: number; revenue: number; nights: number; avg_rate: number };
  };
  monthly: Record<string, { count: number; revenue: number; nights: number; accepted: number; cancelled: number }>;
  by_property: Record<string, { count: number; revenue: number; nights: number; unique_guests: number }>;
  stay_ranges: Record<string, number>;
  stay_revenue: Record<string, number>;
  source_tracking: {
    full_funnel: number; full_funnel_revenue: number; full_funnel_same_property: number;
    call_matched: number; call_matched_revenue: number;
    samsam_matched: number; samsam_matched_revenue: number;
    platform_inferred: number; platform_inferred_revenue: number; platform_inferred_label: string;
    tracked_total: number; tracked_revenue: number; tracked_pct: number;
    untracked: number; untracked_revenue: number;
    full_funnel_details: TrackingDetail[];
    call_details: TrackingDetail[];
    samsam_details: TrackingDetail[];
  };
  reservations: {
    guest_name: string; guest_name_clean?: string; check_in: string; check_out: string; nights: number;
    total_rate: number; status: string; property_name: string;
    has_phone: boolean; has_call: boolean; has_samsam: boolean;
    tracking_source?: string;
    call_info?: { call_count: number; total_min: number; first_date: string; last_date: string } | null;
    samsam_info?: { room_name: string; outcome: string; chat_id: string; month: string; amount: number; chat_count: number } | null;
    same_property?: boolean;
    airbnb_suspect?: boolean;
  }[];
  extension_chains?: {
    total_chains: number; unique_guests: number; total_nights: number; total_revenue: number;
    avg_stay_days: number;
    from_samsam: number; from_samsam_nights: number; from_samsam_revenue: number;
    chains: ExtensionChain[];
  };
  airbnb_suspect?: { count: number; revenue: number; label: string };
}

function filterDirectByDate(raw: DirectData, dateFrom: string, dateTo: string): DirectData {
  const res = raw.reservations.filter(r => r.check_in >= dateFrom && r.check_in <= dateTo);
  const accepted = res.filter(r => r.status === "accepted");
  const cancelled = res.filter(r => r.status !== "accepted");
  const totalRevenue = accepted.reduce((s, r) => s + r.total_rate, 0);
  const totalNights = accepted.reduce((s, r) => s + r.nights, 0);
  const withPhone = res.filter(r => r.has_phone).length;
  // monthly 재계산
  const monthly: DirectData["monthly"] = {};
  for (const r of res) {
    const m = r.check_in.slice(0, 7);
    if (!monthly[m]) monthly[m] = { count: 0, revenue: 0, nights: 0, accepted: 0, cancelled: 0 };
    monthly[m].count++;
    monthly[m].revenue += r.total_rate;
    monthly[m].nights += r.nights;
    if (r.status === "accepted") monthly[m].accepted++; else monthly[m].cancelled++;
  }
  // by_property 재계산
  const byProp: DirectData["by_property"] = {};
  for (const r of accepted) {
    if (!byProp[r.property_name]) byProp[r.property_name] = { count: 0, revenue: 0, nights: 0, unique_guests: 0 };
    byProp[r.property_name].count++;
    byProp[r.property_name].revenue += r.total_rate;
    byProp[r.property_name].nights += r.nights;
  }
  // stay_ranges 재계산
  const stayRangeKeys = [
    { key: "1~2박", min: 1, max: 2 }, { key: "3~6박", min: 3, max: 6 },
    { key: "1~2주", min: 7, max: 14 }, { key: "3~4주", min: 15, max: 28 },
    { key: "1개월+", min: 29, max: Infinity },
  ];
  const stayRanges: Record<string, number> = {};
  const stayRevenue: Record<string, number> = {};
  for (const sr of stayRangeKeys) {
    const matching = accepted.filter(r => r.nights >= sr.min && r.nights <= sr.max);
    stayRanges[sr.key] = matching.length;
    stayRevenue[sr.key] = matching.reduce((s, r) => s + r.total_rate, 0);
  }
  // source_tracking 재계산 — first_visit 기준 필터
  const filterDetails = (arr: TrackingDetail[]) => arr.filter(d => d.first_visit >= dateFrom && d.first_visit <= dateTo);
  const fFull = filterDetails(raw.source_tracking.full_funnel_details);
  const fCall = filterDetails(raw.source_tracking.call_details);
  const fSamsam = filterDetails(raw.source_tracking.samsam_details);
  const fullRev = fFull.reduce((s, d) => s + d.revenue, 0);
  const callRev = fCall.reduce((s, d) => s + d.revenue, 0);
  const samsamRev = fSamsam.reduce((s, d) => s + d.revenue, 0);
  // platform_inferred: 기간추정 (2025.12 이전 미추적 → 삼투/리브)
  const inferredCount = res.filter(r => r.tracking_source === 'platform_inferred').length;
  const inferredRev = res.filter(r => r.tracking_source === 'platform_inferred').reduce((s, r) => s + r.total_rate, 0);
  const trackedRev = fullRev + callRev + samsamRev + inferredRev;

  return {
    summary: {
      total: res.length, accepted: accepted.length, cancelled: cancelled.length,
      total_revenue: totalRevenue, total_nights: totalNights,
      avg_rate: accepted.length > 0 ? Math.round(totalRevenue / accepted.length) : 0,
      avg_nights: accepted.length > 0 ? Number((totalNights / accepted.length).toFixed(1)) : 0,
      phone_rate: res.length > 0 ? Number((withPhone / res.length * 100).toFixed(1)) : 0,
      share_of_total: raw.summary.share_of_total,
      revenue_share: raw.summary.revenue_share,
    },
    comparison: raw.comparison,
    monthly, by_property: byProp, stay_ranges: stayRanges, stay_revenue: stayRevenue,
    source_tracking: {
      full_funnel: fFull.length, full_funnel_revenue: fullRev,
      full_funnel_same_property: fFull.filter(d => d.same_property).length,
      call_matched: fCall.length, call_matched_revenue: callRev,
      samsam_matched: fSamsam.length, samsam_matched_revenue: samsamRev,
      platform_inferred: inferredCount, platform_inferred_revenue: inferredRev,
      platform_inferred_label: raw.source_tracking.platform_inferred_label || '삼투/리브 (기간추정)',
      tracked_total: fFull.length + fCall.length + fSamsam.length + inferredCount,
      tracked_revenue: trackedRev,
      tracked_pct: totalRevenue > 0 ? Number((trackedRev / totalRevenue * 100).toFixed(1)) : 0,
      untracked: res.length - fFull.length - fCall.length - fSamsam.length - inferredCount,
      untracked_revenue: totalRevenue - trackedRev,
      full_funnel_details: fFull, call_details: fCall, samsam_details: fSamsam,
    },
    reservations: res,
    extension_chains: raw.extension_chains,
    airbnb_suspect: raw.airbnb_suspect,
  };
}

function DirectPaymentDashboard({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [subTab, setSubTab] = useState<DirectSubTab>("overview");
  const [rawData, setRawData] = useState<DirectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/direct_payment_analysis.json")
      .then(r => r.json())
      .then(d => { setRawData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const data = rawData ? filterDirectByDate(rawData, dateFrom, dateTo) : null;

  const subTabs: { key: DirectSubTab; label: string }[] = [
    { key: "overview", label: "전체 현황" },
    { key: "source", label: "원천 추적" },
    { key: "hiero_guests", label: "히로 고객" },
    { key: "monthly", label: "월별·숙소별" },
    { key: "list", label: "예약 목록" },
  ];

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  if (!data) return <div className="py-12 text-center text-gray-400">direct_payment_analysis.json을 찾을 수 없습니다.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              subTab === t.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>{t.label}</button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{dateFrom} ~ {dateTo} · {data.summary.total}건{rawData ? ` / 전체 ${rawData.summary.total}건` : ""}</span>
      </div>
      {subTab === "overview" && <DirectOverview data={data} />}
      {subTab === "source" && <DirectSource data={data} />}
      {subTab === "hiero_guests" && <HieroGuests data={data} />}
      {subTab === "monthly" && <DirectMonthly data={data} />}
      {subTab === "list" && <DirectList data={data} />}
    </div>
  );
}

function DirectOverview({ data }: { data: DirectData }) {
  const s = data.summary;
  const c = data.comparison;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="개인입금 건수" value={`${s.total}건`} accent="text-emerald-600" />
        <SummaryCard label="총 매출" value={fmtM(s.total_revenue)} accent="text-blue-600" />
        <SummaryCard label="건당 평균" value={fmtM(s.avg_rate)} accent="text-indigo-600" />
        <SummaryCard label="평균 숙박" value={`${s.avg_nights}박`} accent="text-violet-600" />
        <SummaryCard label="전화번호 보유" value={`${s.phone_rate}%`} accent="text-amber-600" />
      </div>

      {/* OTA vs 개인입금 비교 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">OTA vs 개인입금 비교</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">OTA (에어비앤비·아고다 등)</div>
            <div className="text-2xl font-bold text-gray-700">{c.ota.count.toLocaleString()}건</div>
            <div className="text-sm text-gray-500 mt-1">매출 {fmtM(c.ota.revenue)} · 건당 {fmtM(c.ota.avg_rate)}</div>
          </div>
          <div className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50">
            <div className="text-xs text-emerald-600 mb-1">개인입금 (직접 계약)</div>
            <div className="text-2xl font-bold text-emerald-700">{c.direct.count.toLocaleString()}건</div>
            <div className="text-sm text-emerald-600 mt-1">매출 {fmtM(c.direct.revenue)} · 건당 {fmtM(c.direct.avg_rate)}</div>
          </div>
        </div>
        <div className="mt-3 flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">건수 비중</div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-gray-400 h-full" style={{ width: `${100 - s.share_of_total}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${s.share_of_total}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>OTA {(100 - s.share_of_total).toFixed(0)}%</span>
              <span>개인입금 {s.share_of_total}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">매출 비중</div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-gray-400 h-full" style={{ width: `${100 - s.revenue_share}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${s.revenue_share}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>OTA {(100 - s.revenue_share).toFixed(0)}%</span>
              <span>개인입금 {s.revenue_share}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 숙박기간 분포 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">숙박기간 분포</h3>
        <div className="space-y-2">
          {Object.entries(data.stay_ranges).map(([k, cnt]) => {
            const rev = data.stay_revenue[k] || 0;
            const maxCnt = Math.max(...Object.values(data.stay_ranges));
            const pct = maxCnt > 0 ? cnt / maxCnt * 100 : 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-700 text-right">{k}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div className="bg-violet-500 h-full rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 3)}%` }}>
                    {pct > 20 && <span className="text-[10px] text-white font-bold">{cnt}</span>}
                  </div>
                </div>
                <span className="w-28 text-right text-xs text-gray-500">{pct <= 20 ? `${cnt}건` : ""} · {fmtM(rev)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DirectSource({ data }: { data: DirectData }) {
  const st = data.source_tracking;
  const OUTCOME_COLORS: Record<string, string> = {
    converted: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-amber-800 mb-2">원천 추적</h3>
        <p className="text-xs text-amber-700">삼삼엠투 채팅 → 전화 통화 → 개인입금 예약. 전화번호+이름 교차매칭으로 전체 여정 추적. 추적률 {st.tracked_pct}%</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="풀퍼널 (삼삼→통화→입금)" value={`${st.full_funnel}건`} accent="text-violet-600" />
        <SummaryCard label="통화→입금" value={`${st.call_matched}건`} accent="text-blue-600" />
        <SummaryCard label="삼삼→입금" value={`${st.samsam_matched}건`} accent="text-emerald-600" />
        <SummaryCard label="삼투/리브 (기간추정)" value={`${st.platform_inferred}건`} accent="text-orange-600" />
        <SummaryCard label="미확인" value={`${st.untracked}건`} accent="text-gray-400" />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-800">추적률 {st.tracked_pct}%</span>
          <span className="text-xs text-blue-600">{st.tracked_total}건 · {fmtM(st.tracked_revenue)} / 전체 {fmtM(data.summary.total_revenue)}</span>
        </div>
        <div className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden flex">
          <div className="bg-violet-500 h-full" style={{ width: `${data.summary.total_revenue > 0 ? st.full_funnel_revenue / data.summary.total_revenue * 100 : 0}%` }} />
          <div className="bg-blue-500 h-full" style={{ width: `${data.summary.total_revenue > 0 ? st.call_matched_revenue / data.summary.total_revenue * 100 : 0}%` }} />
          <div className="bg-emerald-500 h-full" style={{ width: `${data.summary.total_revenue > 0 ? st.samsam_matched_revenue / data.summary.total_revenue * 100 : 0}%` }} />
          <div className="bg-orange-400 h-full" style={{ width: `${data.summary.total_revenue > 0 ? st.platform_inferred_revenue / data.summary.total_revenue * 100 : 0}%` }} />
        </div>
        <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />풀퍼널</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />통화</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />삼삼</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />삼투/리브</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />미확인</span>
        </div>
      </div>

      {/* 원천별 매출 비중 */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">원천별 매출 비중</h3>
        <div className="space-y-3">
          {[
            { label: "삼삼 → 통화 → 개인입금", count: st.full_funnel, revenue: st.full_funnel_revenue, color: "bg-violet-500", sub: `같은숙소 ${st.full_funnel_same_property}건` },
            { label: "통화 → 개인입금", count: st.call_matched, revenue: st.call_matched_revenue, color: "bg-blue-500", sub: "" },
            { label: "삼삼 → 개인입금", count: st.samsam_matched, revenue: st.samsam_matched_revenue, color: "bg-emerald-500", sub: "" },
            { label: "삼투/리브 (기간추정)", count: st.platform_inferred, revenue: st.platform_inferred_revenue, color: "bg-orange-400", sub: "~2025.12" },
            { label: "원천 미확인", count: st.untracked, revenue: st.untracked_revenue, color: "bg-gray-300", sub: "" },
          ].map(s => {
            const pct = data.summary.total_revenue > 0 ? s.revenue / data.summary.total_revenue * 100 : 0;
            return (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-40 text-sm text-gray-700 text-right">{s.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className={`${s.color} h-full rounded-full flex items-center justify-end pr-2`} style={{ width: `${Math.max(pct, 2)}%` }}>
                    {pct > 8 && <span className="text-[10px] text-white font-bold">{fmtM(s.revenue)}</span>}
                  </div>
                </div>
                <span className="w-32 text-right text-xs text-gray-500">{s.count}건 · {pct.toFixed(1)}% {s.sub}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 풀퍼널 상세 */}
      {st.full_funnel_details.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-violet-50">
            <h3 className="text-sm font-bold text-violet-700">삼삼 → 통화 → 개인입금 ({st.full_funnel_details.length}건 · {fmtM(st.full_funnel_revenue)})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left">고객</th>
                <th className="px-3 py-2 text-left">삼삼 숙소</th>
                <th className="px-3 py-2 text-center">삼삼결과</th>
                <th className="px-3 py-2 text-right">통화</th>
                <th className="px-3 py-2 text-left">개인입금 숙소</th>
                <th className="px-3 py-2 text-center">일치</th>
                <th className="px-3 py-2 text-right">매출</th>
              </tr></thead>
              <tbody>
                {st.full_funnel_details.slice(0, 30).map((d, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{d.guest_name_clean || d.guest_name}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{d.samsam?.room_name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${OUTCOME_COLORS[d.samsam?.outcome || ""] || "bg-gray-100 text-gray-600"}`}>{d.samsam?.outcome}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600 whitespace-nowrap">{d.call?.call_count}회 {d.call?.total_min}분</td>
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">{d.property}</td>
                    <td className="px-3 py-2 text-center">{d.same_property ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">일치</span> : <span className="text-[10px] text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600 whitespace-nowrap">{fmtM(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 통화만 → 개인입금 */}
      {st.call_details.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-blue-50">
            <h3 className="text-sm font-bold text-blue-700">통화 → 개인입금 ({st.call_details.length}건 · {fmtM(st.call_matched_revenue)})</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left">고객</th>
              <th className="px-3 py-2 text-right">통화</th>
              <th className="px-3 py-2 text-left">숙소</th>
              <th className="px-3 py-2 text-right">매출</th>
            </tr></thead>
            <tbody>
              {st.call_details.slice(0, 20).map((d, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800">{d.guest_name_clean || d.guest_name}</td>
                  <td className="px-3 py-2 text-right text-blue-600 whitespace-nowrap">{d.call?.call_count}회 {d.call?.total_min}분</td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[250px] truncate">{d.property}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmtM(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 삼삼 → 개인입금 (통화 없음) */}
      {st.samsam_details.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-emerald-50">
            <h3 className="text-sm font-bold text-emerald-700">삼삼 → 개인입금 ({st.samsam_details.length}건 · {fmtM(st.samsam_matched_revenue)})</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left">고객</th>
              <th className="px-3 py-2 text-left">삼삼 숙소</th>
              <th className="px-3 py-2 text-center">삼삼결과</th>
              <th className="px-3 py-2 text-left">개인입금 숙소</th>
              <th className="px-3 py-2 text-right">매출</th>
            </tr></thead>
            <tbody>
              {st.samsam_details.slice(0, 20).map((d, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800">{d.guest_name_clean || d.guest_name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.samsam?.room_name}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${OUTCOME_COLORS[d.samsam?.outcome || ""] || "bg-gray-100 text-gray-600"}`}>{d.samsam?.outcome}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs max-w-[200px] truncate">{d.property}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmtM(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HieroGuests({ data }: { data: DirectData }) {
  const ec = data.extension_chains;
  const ab = data.airbnb_suspect;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!ec) return <div className="py-12 text-center text-gray-400">연장 체인 데이터 없음</div>;

  const ORIGIN_LABELS: Record<string, { label: string; color: string }> = {
    full_funnel: { label: "삼삼→통화→입금", color: "bg-violet-100 text-violet-700" },
    samsam: { label: "삼삼→입금", color: "bg-emerald-100 text-emerald-700" },
    call: { label: "통화→입금", color: "bg-blue-100 text-blue-700" },
    platform_inferred: { label: "삼투/리브", color: "bg-orange-100 text-orange-700" },
    untracked: { label: "미확인", color: "bg-gray-100 text-gray-600" },
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-indigo-900 mb-1">히로 고객 = 연장의 연장</h3>
        <p className="text-xs text-indigo-700">삼삼엠투/리브에서 처음 왔지만, 연장을 거듭하며 히로의 진짜 고객이 된 사람들. 플랫폼이 아닌 운영으로 잡은 고객.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="연장 고객" value={`${ec.unique_guests}명`} accent="text-indigo-600" />
        <SummaryCard label="총 체류" value={`${ec.total_nights}박`} accent="text-violet-600" />
        <SummaryCard label="평균 체류" value={`${ec.avg_stay_days}일`} accent="text-blue-600" />
        <SummaryCard label="총 매출" value={fmtM(ec.total_revenue)} accent="text-emerald-600" />
        <SummaryCard label="삼삼 출신" value={`${ec.from_samsam}명`} accent="text-orange-600" />
      </div>

      {/* 삼삼 출신 강조 */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-700">삼삼 출신 → 히로 고객 전환</h3>
          <span className="text-xs text-gray-400">{ec.from_samsam}명 · {ec.from_samsam_nights}박 · {fmtM(ec.from_samsam_revenue)}</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">체류일 비중</div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-violet-500 h-full" style={{ width: `${ec.total_nights > 0 ? ec.from_samsam_nights / ec.total_nights * 100 : 0}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">삼삼 출신 {ec.total_nights > 0 ? (ec.from_samsam_nights / ec.total_nights * 100).toFixed(0) : 0}%</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">매출 비중</div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${ec.total_revenue > 0 ? ec.from_samsam_revenue / ec.total_revenue * 100 : 0}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">삼삼 출신 {ec.total_revenue > 0 ? (ec.from_samsam_revenue / ec.total_revenue * 100).toFixed(0) : 0}%</div>
          </div>
        </div>
      </div>

      {/* 에어비앤비 연동 의심 */}
      {ab && ab.count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-700">에어비앤비 연동 의심</span>
            <span className="text-[10px] text-red-500 ml-2">{ab.label}</span>
          </div>
          <span className="text-sm font-bold text-red-600">{ab.count}건 · {fmtM(ab.revenue)}</span>
        </div>
      )}

      {/* 연장 체인 목록 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">연장 체인 전체 ({ec.chains.length}개)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left">게스트</th>
              <th className="px-3 py-2 text-center">원천</th>
              <th className="px-3 py-2 text-left">삼삼 숙소</th>
              <th className="px-3 py-2 text-center">기간</th>
              <th className="px-3 py-2 text-right">총박</th>
              <th className="px-3 py-2 text-right">연장</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-center">숙소</th>
            </tr></thead>
            <tbody>
              {ec.chains.map((c, i) => {
                const o = ORIGIN_LABELS[c.origin] || ORIGIN_LABELS.untracked;
                return (
                  <tr key={i} className={`border-b hover:bg-gray-50 cursor-pointer ${expanded === c.guest_name + c.first_check_in ? "bg-indigo-50" : ""}`}
                    onClick={() => setExpanded(expanded === c.guest_name + c.first_check_in ? null : c.guest_name + c.first_check_in)}>
                    <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">{c.guest_name_clean || c.guest_name}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded ${o.color}`}>{o.label}</span></td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{c.samsam_room || "-"}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500 whitespace-nowrap">{c.first_check_in?.slice(5)}~{c.last_check_out?.slice(5)}</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-600">{c.total_nights}박</td>
                    <td className="px-3 py-2 text-right text-gray-600">{c.extensions}회</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600 whitespace-nowrap">{fmtM(c.total_revenue)}</td>
                    <td className="px-3 py-2 text-center">{c.same_property ? <span className="text-[10px] text-gray-400">동일</span> : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{c.properties.length}곳</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 확장 상세 — 클릭 시 예약 체인 표시 */}
      {expanded && (() => {
        const chain = ec.chains.find(c => c.guest_name + c.first_check_in === expanded);
        if (!chain) return null;
        return (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-indigo-800 mb-3">{chain.guest_name_clean || chain.guest_name} 예약 체인</h4>
            <div className="space-y-1">
              {chain.bookings.map((b, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  <span className="text-gray-600">{b.check_in} ~ {b.check_out}</span>
                  <span className="font-medium text-indigo-700">{b.nights}박</span>
                  <span className="text-gray-500 text-xs truncate max-w-[200px]">{b.property_name}</span>
                  <span className="ml-auto text-emerald-600 font-medium">{fmtM(b.total_rate)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DirectMonthly({ data }: { data: DirectData }) {
  const months = Object.entries(data.monthly);
  const maxRev = Math.max(...months.map(([, v]) => v.revenue));
  const props = Object.entries(data.by_property);
  const maxPropRev = props.length > 0 ? props[0][1].revenue : 1;

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">월별 개인입금 추이</h3>
        <div className="space-y-2">
          {months.map(([m, v]) => {
            const pct = maxRev > 0 ? v.revenue / maxRev * 100 : 0;
            return (
              <div key={m} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-700 text-right">{m}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 3)}%` }}>
                    {pct > 15 && <span className="text-[10px] text-white font-bold">{fmtM(v.revenue)}</span>}
                  </div>
                </div>
                <span className="w-32 text-right text-xs text-gray-500">{v.accepted}건 · {fmtM(v.revenue)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-700">숙소별 개인입금 (매출 상위)</h3>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-4 py-2 text-left">숙소</th>
            <th className="px-3 py-2 text-right">건수</th>
            <th className="px-3 py-2 text-right">매출</th>
            <th className="px-3 py-2 text-right">고유 게스트</th>
            <th className="px-3 py-2">비중</th>
          </tr></thead>
          <tbody>
            {props.slice(0, 20).map(([name, v]) => {
              const pct = maxPropRev > 0 ? v.revenue / maxPropRev * 100 : 0;
              return (
                <tr key={name} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800 truncate max-w-[200px]">{name}</td>
                  <td className="px-3 py-2 text-right">{v.count}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmtM(v.revenue)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{v.unique_guests}명</td>
                  <td className="px-3 py-2 w-32">
                    <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DirectList({ data }: { data: DirectData }) {
  const [filter, setFilter] = useState<"all" | "call" | "samsam" | "unknown">("all");
  let list = data.reservations;
  if (filter === "call") list = list.filter(r => r.has_call);
  else if (filter === "samsam") list = list.filter(r => r.has_samsam);
  else if (filter === "unknown") list = list.filter(r => !r.has_call && !r.has_samsam && !r.has_phone);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([
          { key: "all" as const, label: `전체 (${data.reservations.length})` },
          { key: "call" as const, label: `통화매칭 (${data.reservations.filter(r => r.has_call).length})` },
          { key: "samsam" as const, label: `삼삼매칭 (${data.reservations.filter(r => r.has_samsam).length})` },
          { key: "unknown" as const, label: `미확인 (${data.reservations.filter(r => !r.has_call && !r.has_samsam && !r.has_phone).length})` },
        ]).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>{f.label}</button>
        ))}
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0"><tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left">고객</th>
              <th className="px-3 py-2 text-left">숙소</th>
              <th className="px-3 py-2 text-right">체크인</th>
              <th className="px-3 py-2 text-right">박수</th>
              <th className="px-3 py-2 text-right">매출</th>
              <th className="px-3 py-2 text-center">원천</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 100).map((r, i) => {
                const source = r.has_samsam ? "삼삼" : r.has_call ? "통화" : r.has_phone ? "번호" : "";
                const srcColor = r.has_samsam ? "bg-emerald-50 text-emerald-700" : r.has_call ? "bg-blue-50 text-blue-700" : r.has_phone ? "bg-gray-100 text-gray-500" : "";
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">{r.guest_name_clean || r.guest_name}</td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{r.property_name}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{r.check_in}</td>
                    <td className="px-3 py-2 text-right">{r.nights}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600">{fmtM(r.total_rate)}</td>
                    <td className="px-3 py-2 text-center">
                      {source && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${srcColor}`}>{source}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
