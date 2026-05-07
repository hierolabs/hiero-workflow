import { useEffect, useState } from "react";
import AiAgentPanel from "../components/AiAgentPanel";
import {
  fetchIssues,
  createIssue,
  updateIssueStatus,
  updateIssueAssignee,
  type Issue,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_STYLES,
  ISSUE_PRIORITY_STYLES,
} from "../utils/cleaning-api";
import OperationManual from "../components/OperationManual";
import MultiSelect from "../components/MultiSelect";

const API_URL = import.meta.env.VITE_API_URL;
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const fmtMan = (n: number) => {
  const v = Math.round(n / 10000);
  return new Intl.NumberFormat("ko-KR").format(v);
};

type PresetKey = "this_month" | "last_month" | "year_2025" | "year_2026" | "custom";

const NOW = new Date();
const THIS_YEAR = NOW.getFullYear();

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "이번 달" },
  { key: "last_month", label: "지난 달" },
  { key: "year_2025", label: "2025년" },
  { key: "year_2026", label: "2026년" },
  { key: "custom", label: "직접 선택" },
];

function getPresetDates(key: PresetKey): { start: string; end: string } {
  const now = new Date();
  const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  switch (key) {
    case "this_month":
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: fmtD(now) };
    case "last_month": {
      const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = now.getMonth() === 0 ? 12 : now.getMonth();
      const last = new Date(y, m, 0);
      return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: fmtD(last) };
    }
    case "year_2025":
      return { start: "2025-01-01", end: "2025-12-31" };
    case "year_2026":
      return { start: "2026-01-01", end: fmtD(now.getFullYear() >= 2026 ? now : new Date(2026, 11, 31)) };
    default:
      return { start: fmtD(now), end: fmtD(now) };
  }
}

interface YearMonthData {
  month: string; // "01" ~ "12"
  label: string; // "1월"
  data: SettlementResult | null;
  loading: boolean;
}

interface MonthlySummary {
  property_id: number;
  property_name: string;
  year_month: string;
  revenue: number;
  short_term_revenue: number;
  mid_term_taxable: number;
  mid_term_exempt: number;
  service_revenue: number;
  other_revenue: number;
  refund: number;
  commission: number;
  airbnb_vat: number;
  net_revenue: number;
  cleaning_fee: number;
  mgmt_fee: number;
  rent_out: number;
  rent_in: number;
  operation_fee: number;
  labor_fee: number;
  supplies_fee: number;
  maintenance: number;
  interior_fee: number;
  interest_fee: number;
  dividend_fee: number;
  property_fee: number;
  other_cost: number;
  total_cost: number;
  profit: number;
  profit_rate: number;
}

interface SettlementResult {
  start_date: string;
  end_date: string;
  properties: MonthlySummary[];
  total: MonthlySummary;
}

export default function Settlement() {
  // 정산 데이터
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // 이슈 (하단)
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ message: string; imported: number; skipped: number } | null>(null);

  // 필터 (다중 선택)
  const [filterPropIds, setFilterPropIds] = useState<string[]>([]);
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [propertyList, setPropertyList] = useState<{ id: number; name: string }[]>([]);
  const [channelList, setChannelList] = useState<string[]>([]);

  // 연도별 월간 데이터
  const [yearMonths, setYearMonths] = useState<YearMonthData[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [selectedYearMonth, setSelectedYearMonth] = useState<string | null>(null);

  // 입금 예정
  type ForecastPeriod = 'today' | 'tomorrow' | 'd3' | 'w1' | 'd10' | 'month';
  const [forecastPeriod, setForecastPeriod] = useState<ForecastPeriod>('w1');
  const [forecastData, setForecastData] = useState<{ deposit: number; cost: number; net: number; startLabel: string; endLabel: string } | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const isYearPreset = preset === "year_2025" || preset === "year_2026";
  const selectedYear = preset === "year_2025" ? 2025 : preset === "year_2026" ? 2026 : null;

  const getDateRange = () => {
    if (preset === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPresetDates(preset);
  };

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (filterPropIds.length === 1) params.set("property_id", filterPropIds[0]);
    else if (filterPropIds.length > 1) params.set("property_ids", filterPropIds.join(","));
    if (filterChannels.length === 1) params.set("channel", filterChannels[0]);
    else if (filterChannels.length > 1) params.set("channels", filterChannels.join(","));
    return params.toString();
  };

  const loadSettlement = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { start, end } = getDateRange();
      const fp = buildFilterParams();
      const res = await fetch(`${API_URL}/settlement/summary?start_date=${start}&end_date=${end}${fp ? "&" + fp : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadYearData = async (year: number) => {
    setYearLoading(true);
    setSelectedYearMonth(null);
    const token = localStorage.getItem("token");
    const fp = buildFilterParams();
    const maxMonth = year === THIS_YEAR ? NOW.getMonth() + 1 : 12;
    const months: YearMonthData[] = Array.from({ length: maxMonth }, (_, i) => ({
      month: String(i + 1).padStart(2, "0"),
      label: `${i + 1}월`,
      data: null,
      loading: true,
    }));
    setYearMonths(months);

    const results = await Promise.all(
      months.map(async (m) => {
        const mi = parseInt(m.month);
        const start = `${year}-${m.month}-01`;
        const lastDay = new Date(year, mi, 0).getDate();
        const end = `${year}-${m.month}-${String(lastDay).padStart(2, "0")}`;
        try {
          const res = await fetch(`${API_URL}/settlement/summary?start_date=${start}&end_date=${end}${fp ? "&" + fp : ""}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            return { ...m, data, loading: false };
          }
        } catch { /* ignore */ }
        return { ...m, loading: false };
      })
    );
    setYearMonths(results);
    setYearLoading(false);
  };

  const loadMonths = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/months`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(data || []);
      }
    } catch { /* ignore */ }
  };

  const loadFilters = async () => {
    const token = localStorage.getItem("token");
    try {
      const [propRes, chRes] = await Promise.all([
        fetch(`${API_URL}/properties?page_size=200`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/transactions/channels`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (propRes.ok) {
        const d = await propRes.json();
        const list = (d.properties || d || []).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }));
        setPropertyList(list.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)));
      }
      if (chRes.ok) {
        const chs = await chRes.json();
        setChannelList(chs || []);
      }
    } catch { /* ignore */ }
  };

  const loadIssues = async () => {
    try {
      const res = await fetchIssues({ issue_type: "settlement", page_size: "50" });
      setIssues((res.issues || []).filter((i: Issue) => i.issue_type === "settlement"));
    } catch { /* ignore */ }
  };

  const getForecastRange = (period: ForecastPeriod) => {
    const today = new Date();
    const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const shortLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const todayStr = fmtD(today);
    const end = new Date(today);

    switch (period) {
      case 'today': break;
      case 'tomorrow': end.setDate(end.getDate() + 1); break;
      case 'd3': end.setDate(end.getDate() + 3); break;
      case 'w1': end.setDate(end.getDate() + 7); break;
      case 'd10': end.setDate(end.getDate() + 10); break;
      case 'month': end.setMonth(end.getMonth() + 1); end.setDate(0); break;
    }
    return { start: todayStr, end: fmtD(end), startLabel: shortLabel(today), endLabel: shortLabel(end) };
  };

  const loadForecast = async (period: ForecastPeriod) => {
    setForecastLoading(true);
    try {
      const token = localStorage.getItem("token");
      const range = getForecastRange(period);
      const res = await fetch(`${API_URL}/data3/summary?start_date=${range.start}&end_date=${range.end}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const deposit = data.expected_deposit || 0;
      const cost = data.allocated_cost || 0;
      setForecastData({
        deposit,
        cost,
        net: deposit - cost,
        startLabel: range.startLabel,
        endLabel: range.endLabel,
      });
    } catch { /* ignore */ }
    finally { setForecastLoading(false); }
  };

  useEffect(() => { loadForecast(forecastPeriod); }, [forecastPeriod]);
  useEffect(() => { Promise.all([loadMonths(), loadIssues(), loadFilters()]); }, []);
  useEffect(() => {
    if (isYearPreset && selectedYear) {
      setResult(null);
      loadYearData(selectedYear);
      return;
    }
    setYearMonths([]);
    setSelectedYearMonth(null);
    if (preset === "custom" && (!customStart || !customEnd)) return;
    loadSettlement();
  }, [preset, customStart, customEnd, filterPropIds, filterChannels]);

  const handleMonthClick = (month: string) => {
    const [y, m] = month.split("-");
    const last = new Date(parseInt(y), parseInt(m), 0);
    setPreset("custom");
    setCustomStart(`${month}-01`);
    setCustomEnd(`${y}-${m.padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/transactions/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadResult(data);
        loadSettlement();
        loadMonths();
      } else {
        setUploadResult({ message: data.error || "업로드 실패", imported: 0, skipped: 0 });
      }
    } catch {
      setUploadResult({ message: "업로드 중 오류 발생", imported: 0, skipped: 0 });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreate = async (data: { title: string; description: string; priority: string }) => {
    await createIssue({ ...data, issue_type: "settlement" });
    setShowCreate(false);
    loadIssues();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await updateIssueStatus(id, status);
    loadIssues();
  };

  const handleAssigneeChange = async (id: number, name: string) => {
    await updateIssueAssignee(id, name);
    loadIssues();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {result ? `${result.start_date} ~ ${result.end_date}` : "기간별 숙소 수입/비용/이익"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className={`cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? "업로드 중..." : "CSV 업로드"}
              <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <button onClick={() => setShowExport(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              내보내기
            </button>
            <button onClick={() => setShowManual(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              운영 매뉴얼
            </button>
            <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              + 정산 이슈
            </button>
          </div>
        </div>

        {uploadResult && (
          <div className={`mt-2 rounded-md px-3 py-2 text-xs flex items-center justify-between ${uploadResult.imported > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <span>{uploadResult.message} — {uploadResult.imported}건 저장, {uploadResult.skipped}건 스킵</span>
            <button onClick={() => setUploadResult(null)} className="ml-2 font-bold hover:opacity-70">✕</button>
          </div>
        )}

        {/* 입금 예정 */}
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">입금 예정 (deposit_date 기준)</h2>
            <div className="flex items-center gap-1">
              {([
                { key: 'today', label: '오늘' },
                { key: 'tomorrow', label: '내일' },
                { key: 'd3', label: '3일' },
                { key: 'w1', label: '1주일' },
                { key: 'd10', label: '10일' },
                { key: 'month', label: '이번달' },
              ] as { key: ForecastPeriod; label: string }[]).map(p => (
                <button
                  key={p.key}
                  onClick={() => setForecastPeriod(p.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    forecastPeriod === p.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {forecastLoading ? (
            <div className="text-center text-gray-400 text-sm py-4">로딩 중...</div>
          ) : forecastData ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600 mb-1">입금 예정</div>
                <div className="text-lg font-bold text-blue-800">{fmtMan(forecastData.deposit)}만원</div>
                <div className="text-xs text-blue-500">{forecastData.startLabel} ~ {forecastData.endLabel}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="text-xs text-red-600 mb-1">예상 비용</div>
                <div className="text-lg font-bold text-red-800">{fmtMan(forecastData.cost)}만원</div>
                <div className="text-xs text-red-500">cost_allocations 기준</div>
              </div>
              <div className={`border rounded-lg p-3 text-center ${forecastData.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`text-xs mb-1 ${forecastData.net >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>예상 순이익</div>
                <div className={`text-lg font-bold ${forecastData.net >= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>{fmtMan(forecastData.net)}만원</div>
                <div className={`text-xs ${forecastData.net >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>입금 - 비용</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 기간 프리셋 + 월 퀵 선택 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPreset(p.key); if (p.key !== "custom") { setCustomStart(""); setCustomEnd(""); } }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === p.key && !(preset === "custom" && !customStart)
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1.5 ml-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
              <span className="text-xs text-gray-400">~</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
            </div>
          )}
        </div>

        {/* 숙소 / 채널 필터 */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MultiSelect
            options={propertyList.map((p) => ({ value: String(p.id), label: p.name }))}
            selected={filterPropIds}
            onChange={setFilterPropIds}
            placeholder="전체 숙소"
          />
          <MultiSelect
            options={channelList.map((ch) => ({ value: ch, label: ch }))}
            selected={filterChannels}
            onChange={setFilterChannels}
            placeholder="전체 채널"
          />
          {(filterPropIds.length > 0 || filterChannels.length > 0) && (
            <button
              onClick={() => { setFilterPropIds([]); setFilterChannels([]); }}
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* 데이터 있는 월 퀵 선택 (연도별 그룹) */}
        {availableMonths.length > 0 && (() => {
          const byYear: Record<string, string[]> = {};
          availableMonths.forEach((m) => {
            const y = m.slice(0, 4);
            if (!byYear[y]) byYear[y] = [];
            byYear[y].push(m);
          });
          const currentRange = getDateRange();
          const activeMonth = currentRange.start.slice(0, 7);
          const isMonthExact = currentRange.start.endsWith("-01") && preset === "custom";
          return (
            <div className="mt-2 space-y-1">
              {Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => (
                <div key={year} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-500 w-10">{year}</span>
                  {months.map((m) => {
                    const isActive = isMonthExact && activeMonth === m;
                    return (
                      <button key={m} onClick={() => handleMonthClick(m)}
                        className={`rounded px-2 py-0.5 text-xs transition-colors ${
                          isActive
                            ? "bg-gray-900 text-white"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}>
                        {parseInt(m.slice(5))}월
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 연도별 월간 그리드 */}
      {isYearPreset && (
        <>
          {yearLoading ? (
            <p className="py-10 text-center text-gray-500">{selectedYear}년 데이터 불러오는 중...</p>
          ) : (
            <>
              {/* 연간 합계 */}
              {yearMonths.length > 0 && (() => {
                const totals = yearMonths.reduce((acc, m) => {
                  if (!m.data?.total) return acc;
                  const t = m.data.total;
                  return { revenue: acc.revenue + t.revenue, cost: acc.cost + t.total_cost, profit: acc.profit + t.profit };
                }, { revenue: 0, cost: 0, profit: 0 });
                const rate = totals.revenue ? (totals.profit / totals.revenue * 100) : 0;
                return (
                  <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryCard label={`${selectedYear}년 총매출`} value={`${fmtMan(totals.revenue)}만`} />
                    <SummaryCard label="총비용" value={`${fmtMan(totals.cost)}만`} color="red" />
                    <SummaryCard label="순이익" value={`${fmtMan(totals.profit)}만`} color={totals.profit >= 0 ? "green" : "red"} />
                    <SummaryCard label="이익률" value={`${rate.toFixed(1)}%`} color={rate >= 0 ? "green" : "red"} />
                  </div>
                );
              })()}

              {/* 월별 카드 그리드 */}
              <div className="mb-5 grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                {yearMonths.map((m) => {
                  const t = m.data?.total;
                  const hasData = t && (t.revenue > 0 || t.total_cost > 0);
                  const isSelected = selectedYearMonth === m.month;
                  return (
                    <button
                      key={m.month}
                      onClick={() => {
                        if (hasData) {
                          setSelectedYearMonth(isSelected ? null : m.month);
                          if (!isSelected && m.data) setResult(m.data);
                        }
                      }}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : hasData
                          ? "border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm"
                          : "border-gray-100 bg-gray-50 cursor-default opacity-50"
                      }`}
                    >
                      <p className={`text-sm font-bold ${isSelected ? "text-blue-700" : "text-gray-900"}`}>{m.label}</p>
                      {m.loading ? (
                        <p className="mt-1 text-xs text-gray-400">...</p>
                      ) : hasData && t ? (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-xs text-gray-500">매출 <span className="font-medium text-gray-800">{fmtMan(t.revenue)}만</span></p>
                          <p className="text-xs text-gray-500">비용 <span className="font-medium text-red-600">{fmtMan(t.total_cost)}만</span></p>
                          <p className={`text-xs font-bold ${t.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                            이익 {fmtMan(t.profit)}만 ({t.profit_rate.toFixed(0)}%)
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-300">데이터 없음</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 선택한 월의 연간 월별 추이 테이블 */}
              {!selectedYearMonth && yearMonths.some(m => m.data?.total && (m.data.total.revenue > 0 || m.data.total.total_cost > 0)) && (
                <div className="mb-5 rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">월</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">매출</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">비용</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">순이익</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">이익률</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">숙소수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearMonths.map((m) => {
                        const t = m.data?.total;
                        if (!t || (t.revenue === 0 && t.total_cost === 0)) return null;
                        return (
                          <tr
                            key={m.month}
                            onClick={() => { setSelectedYearMonth(m.month); if (m.data) setResult(m.data); }}
                            className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                          >
                            <td className="px-3 py-2 font-medium text-gray-900">{m.label}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtMan(t.revenue)}만</td>
                            <td className="px-3 py-2 text-right text-red-600">{fmtMan(t.total_cost)}만</td>
                            <td className={`px-3 py-2 text-right font-bold ${t.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                              {fmtMan(t.profit)}만
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${t.profit_rate >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {t.profit_rate.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.data?.properties.length || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 선택한 월 상세 */}
          {selectedYearMonth && result && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <button onClick={() => { setSelectedYearMonth(null); setResult(null); }}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
                  ← {selectedYear}년 전체
                </button>
                <span className="text-sm font-bold text-gray-900">{selectedYear}년 {parseInt(selectedYearMonth)}월 상세</span>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <SummaryCard label="총매출" value={`${fmt(result.total.revenue)}`} />
                <SummaryCard label="순매출" value={`${fmt(result.total.net_revenue)}`} />
                <SummaryCard label="총비용" value={`${fmt(result.total.total_cost)}`} color="red" />
                <SummaryCard label="순이익" value={`${fmt(result.total.profit)}`} color={result.total.profit >= 0 ? "green" : "red"} />
                <SummaryCard label="이익률" value={`${result.total.profit_rate.toFixed(1)}%`} color={result.total.profit_rate >= 0 ? "green" : "red"} />
              </div>
              <PropertyTable result={result} />
            </div>
          )}
        </>
      )}

      {/* 기존: 이번달/지난달/직접선택 */}
      {!isYearPreset && (
        <>
          {/* 정산 합계 카드 */}
          {result && (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
              <SummaryCard label="과세 숙박" value={`${fmt(result.total.taxable_revenue)}`} />
              <SummaryCard label="면세 전대" value={`${fmt(result.total.exempt_revenue)}`} />
              <SummaryCard label="총매출" value={`${fmt(result.total.revenue)}`} />
              <SummaryCard label="순매출" value={`${fmt(result.total.net_revenue)}`} />
              <SummaryCard label="총비용" value={`${fmt(result.total.total_cost)}`} color="red" />
              <SummaryCard label="순이익" value={`${fmt(result.total.profit)}`}
                color={result.total.profit >= 0 ? "green" : "red"} />
              <SummaryCard label="이익률" value={`${result.total.profit_rate.toFixed(1)}%`}
                color={result.total.profit_rate >= 0 ? "green" : "red"} />
            </div>
          )}

          {/* 정산 테이블 */}
          {loading ? (
            <p className="py-10 text-center text-gray-500">정산 데이터 불러오는 중...</p>
          ) : !result || result.properties.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
              <p className="text-gray-400">선택한 기간에 거래 데이터가 없습니다</p>
              <p className="mt-1 text-xs text-gray-300">Hostex 거래 CSV를 업로드하면 정산 데이터가 표시됩니다</p>
            </div>
          ) : (
            <PropertyTable result={result} />
          )}
        </>
      )}

      {/* 정산 이슈 (접히는 섹션) */}
      <div className="mt-6">
        <button
          onClick={() => setShowIssues(!showIssues)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <span className={`transition-transform ${showIssues ? "rotate-90" : ""}`}>&#9654;</span>
          정산 이슈 ({issues.length}건)
        </button>

        {showIssues && (
          <div className="mt-3">
            {issues.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">정산 관련 이슈가 없습니다</p>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">우선순위</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">제목</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">담당자</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">상태</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">등록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue) => (
                      <tr key={issue.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${ISSUE_PRIORITY_STYLES[issue.priority] || "bg-gray-100 text-gray-700"}`}>
                            {issue.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{issue.title}</p>
                          {issue.description && <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">{issue.description}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="text" defaultValue={issue.assignee_name} placeholder="담당자"
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
                            onBlur={(e) => { if (e.target.value !== issue.assignee_name) handleAssigneeChange(issue.id, e.target.value); }}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select value={issue.status} onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                            className={`rounded px-2 py-1 text-xs font-medium ${ISSUE_STATUS_STYLES[issue.status] || ""}`}>
                            {Object.entries(ISSUE_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {new Date(issue.created_at).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && <CreateSettlementModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showManual && <OperationManual page="settlement" onClose={() => setShowManual(false)} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} getDateRange={getDateRange} availableMonths={availableMonths} />}

      <AiAgentPanel page="settlement" pageLabel="정산 관리" getPageData={() => {
        const lines: string[] = [];
        if (forecastData) lines.push(`입금예정(${forecastPeriod}): ${forecastData.deposit}원, 비용: ${forecastData.cost}원, 순이익: ${forecastData.net}원`);
        if (result?.total) {
          const t = result.total;
          lines.push(`기간: ${result.start_date}~${result.end_date}`);
          lines.push(`총매출: ${t.revenue}, 수수료: ${t.commission}, 순매출: ${t.net_revenue}, 청소비: ${t.cleaning_fee}, 관리비: ${t.mgmt_fee}, 월세: ${t.rent_out}, 총비용: ${t.total_cost}, 순이익: ${t.profit}, 마진: ${t.profit_rate}%`);
        }
        if (result?.properties) lines.push(`숙소 ${result.properties.length}개: ` + result.properties.slice(0, 10).map(p => `${p.property_name}(매출${p.revenue},이익${p.profit})`).join(', '));
        return lines.join('\n');
      }} />
    </div>
  );
}

type SortKey = "property_name" | "revenue" | "short_term_revenue" | "mid_term_taxable" | "mid_term_exempt" | "service_revenue" | "other_revenue" | "refund" | "commission" | "airbnb_vat" | "net_revenue" | "cleaning_fee" | "mgmt_fee" | "rent_out" | "rent_in" | "operation_fee" | "labor_fee" | "supplies_fee" | "maintenance" | "interior_fee" | "interest_fee" | "dividend_fee" | "property_fee" | "other_cost" | "total_cost" | "profit" | "profit_rate";
type SortDir = "asc" | "desc";

// 컬럼 인포 팝업 내용
const COLUMN_INFO: Record<string, { title: string; desc: string; details: string[] }> = {
  short_term_revenue: {
    title: "단기임대 (과세 10%)",
    desc: "숙박 플랫폼을 통한 단기 숙박 매출. 부가세 10% 과세 대상.",
    details: ["Airbnb / 에어비앤비", "Booking.com", "Agoda", "기타 숙박 OTA"],
  },
  mid_term_revenue: {
    title: "중기임대",
    desc: "중기 거주 플랫폼 매출. 거주 기간에 따라 과세/면세 자동 분류.",
    details: [
      "29일 미만 → 과세 (VAT 10%)",
      "29일 이상 → 면세 (주거용 전대)",
      "삼삼엠투 / 리브애니웨어 / 자리톡",
      "개인입금 / 직접 계약",
    ],
  },
  service_revenue: {
    title: "서비스매출 (과세 10%)",
    desc: "숙박·임대 외 과세 서비스 매출. 향후 적용 예정.",
    details: ["청소비 별도 청구", "운영관리 수수료", "컨설팅 / 교육", "소프트웨어 이용료"],
  },
  revenue: {
    title: "총매출",
    desc: "단기임대 + 중기임대 + 서비스매출의 합계.",
    details: ["과세/면세 구분 전 총 객실 요금"],
  },
  commission: {
    title: "플랫폼 수수료",
    desc: "예약 플랫폼에서 차감하는 호스트 수수료.",
    details: ["Airbnb 호스트 수수료 (3~5%)", "Booking.com (12~18%)", "Agoda (15~20%)"],
  },
  airbnb_vat: {
    title: "에어비앤비 VAT",
    desc: "에어비앤비 매출에 대한 부가가치세 10%.",
    details: ["에어비앤비 매출 × 10%", "부가세 신고 시 매출세액으로 반영"],
  },
  net_revenue: {
    title: "순매출",
    desc: "총매출에서 환불·수수료·VAT를 차감한 실제 수익.",
    details: ["총매출 + 기타수입 - 환불 - 수수료 - VAT"],
  },
};

const COLUMNS: { key: SortKey; label: string; align: "left" | "right"; expand?: boolean }[] = [
  { key: "property_name", label: "숙소", align: "left" },
  { key: "short_term_revenue", label: "단기", align: "right", expand: true },
  { key: "mid_term_taxable", label: "<1M", align: "right", expand: true },
  { key: "mid_term_exempt", label: "≥1M", align: "right", expand: true },
  { key: "service_revenue", label: "서비스", align: "right", expand: true },
  { key: "revenue", label: "총매출", align: "right" },
  { key: "other_revenue", label: "기타수입", align: "right" },
  { key: "refund", label: "환불", align: "right" },
  { key: "commission", label: "플랫폼수수료", align: "right" },
  { key: "airbnb_vat", label: "에어비앤비VAT", align: "right" },
  { key: "net_revenue", label: "순매출", align: "right" },
  { key: "cleaning_fee", label: "청소비", align: "right" },
  { key: "mgmt_fee", label: "관리비", align: "right" },
  { key: "rent_out", label: "월세", align: "right" },
  { key: "rent_in", label: "임대수입", align: "right" },
  { key: "operation_fee", label: "운영비", align: "right" },
  { key: "labor_fee", label: "인건비", align: "right" },
  { key: "supplies_fee", label: "소모품", align: "right" },
  { key: "maintenance", label: "유지보수", align: "right" },
  { key: "interior_fee", label: "인테리어", align: "right" },
  { key: "interest_fee", label: "이자", align: "right" },
  { key: "dividend_fee", label: "배당", align: "right" },
  { key: "property_fee", label: "숙소경비", align: "right" },
  { key: "other_cost", label: "기타비용", align: "right" },
  { key: "total_cost", label: "총비용", align: "right" },
  { key: "profit", label: "순이익", align: "right" },
  { key: "profit_rate", label: "이익률", align: "right" },
];

function getSortValue(p: MonthlySummary, key: SortKey): number | string {
  if (key === "property_name") return p.property_name || "";
  return p[key] || 0;
}

// SortKey → API query params (category, type)
const FIELD_TO_QUERY: Record<string, { category?: string; type?: string } | null> = {
  revenue: { category: "객실 요금", type: "수입" },
  short_term_revenue: { category: "객실 요금", type: "수입" },
  mid_term_taxable: { category: "객실 요금", type: "수입" },
  mid_term_exempt: { category: "객실 요금", type: "수입" },
  other_revenue: { type: "수입" }, // category != 객실요금, != 환불 → 서버에서 필터
  refund: { category: "객실 요금 환불", type: "수입" },
  cleaning_fee: { category: "청소 비용", type: "비용" },
  mgmt_fee: { category: "관리비", type: "비용" },
  rent_out: { category: "Rent_out", type: "비용" },
  rent_in: { category: "Rent_in", type: "비용" },
  operation_fee: { category: "운영 비용", type: "비용" },
  labor_fee: { category: "노동 비용", type: "비용" },
  supplies_fee: { category: "소모품 비용", type: "비용" },
  maintenance: { category: "유지 보수", type: "비용" },
  interior_fee: { category: "인테리어", type: "비용" },
  interest_fee: { category: "임대이자", type: "비용" },
  dividend_fee: { category: "배당및월세", type: "비용" },
  property_fee: { category: "재산 요금", type: "비용" },
  other_cost: { type: "비용" }, // 기타 비용도 서버에서 필터
};

// 드릴다운 가능한 필드인지 (합산/계산 필드는 제외)
const isDrillable = (key: string) => key in FIELD_TO_QUERY;

interface DrilldownInfo {
  propertyId: number;
  propertyName: string;
  field: SortKey;
  fieldLabel: string;
}

// 인포 키 매핑 (mid_term_taxable, mid_term_exempt → mid_term_revenue)
function getInfoKey(colKey: string): string | null {
  if (colKey === "short_term_revenue") return "short_term_revenue";
  if (colKey === "mid_term_taxable" || colKey === "mid_term_exempt") return "mid_term_revenue";
  if (colKey in COLUMN_INFO) return colKey;
  return null;
}

function PropertyTable({ result }: { result: SettlementResult }) {
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drilldown, setDrilldown] = useState<DrilldownInfo | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "property_name" ? "asc" : "desc"); }
  };

  const sorted = [...result.properties].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    const cmp = typeof va === "string" ? (va as string).localeCompare(vb as string, "ko") : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        {infoKey && COLUMN_INFO[infoKey] && (
          <InfoPopup info={COLUMN_INFO[infoKey]} onClose={() => setInfoKey(null)} />
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {COLUMNS.filter((col) => !col.expand || expanded).map((col) => {
                const ik = getInfoKey(col.key);
                const isExpandCol = col.expand;
                return (
                  <th
                    key={col.key}
                    className={`${col.key === "property_name" ? "sticky left-0 bg-gray-50 " : ""}${isExpandCol ? "bg-blue-50/50 " : ""}px-3 py-2.5 text-${col.align} text-xs font-medium ${isExpandCol ? "text-blue-600" : "text-gray-500"} select-none whitespace-nowrap`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.key === "revenue" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                          className={`inline-flex h-4 px-1 items-center justify-center rounded text-[9px] font-medium transition-colors flex-shrink-0 ${expanded ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600 hover:bg-blue-200"}`}
                          title={expanded ? "매출 상세 접기" : "매출 상세 펼치기"}
                        >
                          {expanded ? "◀" : "▶"}
                        </button>
                      )}
                      <span className="cursor-pointer hover:text-gray-900" onClick={() => handleSort(col.key)}>
                        {col.label}{arrow(col.key)}
                      </span>
                      {ik && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setInfoKey(ik); }}
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors flex-shrink-0"
                          title="항목 설명"
                        >
                          i
                        </button>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-2 border-gray-300 bg-gray-50 font-bold">
              <td className="sticky left-0 bg-gray-50 px-3 py-2.5 text-gray-900 whitespace-nowrap">합계 ({result.properties.length}개)</td>
              {COLUMNS.slice(1).filter((col) => !col.expand || expanded).map((col) => {
                const v = result.total[col.key as keyof MonthlySummary] as number || 0;
                const isProfit = col.key === "profit" || col.key === "profit_rate";
                const isCost = col.key === "total_cost";
                const isRefund = col.key === "refund";
                const isExpandCol = col.expand;
                const color = isProfit ? (v >= 0 ? "text-green-700" : "text-red-700") : isCost ? "text-red-700" : isRefund && v ? "text-red-600" : "text-gray-900";
                return (
                  <td key={col.key} className={`px-3 py-2.5 text-right ${color} ${isExpandCol ? "bg-blue-50/30" : ""}`}>
                    {col.key === "profit_rate" ? `${v.toFixed(1)}%` : isRefund && v ? `-${fmt(v)}` : v ? fmt(v) : "—"}
                  </td>
                );
              })}
            </tr>
            {sorted.map((p) => (
              <tr key={`${p.property_id}-${p.property_name}`} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap max-w-[200px] truncate">
                  {p.property_name || `#${p.property_id}`}
                </td>
                {COLUMNS.slice(1).filter((col) => !col.expand || expanded).map((col) => {
                  const v = p[col.key as keyof MonthlySummary] as number || 0;
                  const isProfit = col.key === "profit";
                  const isProfitRate = col.key === "profit_rate";
                  const isCost = col.key === "total_cost";
                  const isRefund = col.key === "refund";
                  const isNet = col.key === "net_revenue";
                  const isExpandCol = col.expand;
                  const color = isProfit ? `font-bold ${v >= 0 ? "text-green-700" : "text-red-700"}`
                    : isProfitRate ? `font-medium ${v >= 0 ? "text-green-600" : "text-red-600"}`
                    : isCost ? "font-medium text-red-600"
                    : isRefund && v ? "text-red-500"
                    : isNet ? "font-medium text-gray-900"
                    : isExpandCol ? "text-blue-700"
                    : "text-gray-600";
                  const drillable = isDrillable(col.key) && v !== 0;
                  return (
                    <td
                      key={col.key}
                      onClick={drillable ? () => setDrilldown({ propertyId: p.property_id, propertyName: p.property_name || `#${p.property_id}`, field: col.key, fieldLabel: col.label }) : undefined}
                      className={`px-3 py-2 text-right ${color} ${isExpandCol ? "bg-blue-50/20" : ""} ${drillable ? "cursor-pointer hover:underline hover:bg-blue-50" : ""}`}
                    >
                      {isProfitRate ? `${v.toFixed(1)}%` : isRefund && v ? `-${fmt(v)}` : v ? fmt(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {drilldown && (
          <TransactionDetailModal
            propertyId={drilldown.propertyId}
            propertyName={drilldown.propertyName}
            field={drilldown.field}
            fieldLabel={drilldown.fieldLabel}
            startDate={result.start_date}
            endDate={result.end_date}
            onClose={() => setDrilldown(null)}
          />
        )}
      </div>

    </>
  );
}



// 카테고리 목록 (변경 드롭다운용)
const ALL_CATEGORIES = [
  "객실 요금", "객실 요금 환불",
  "청소 비용", "관리비", "Rent_out", "Rent_in",
  "운영 비용", "노동 비용", "소모품 비용", "유지 보수",
  "인테리어", "재산 요금", "배당및월세", "배당", "임대이자",
];

interface Transaction {
  id: number;
  transaction_at: string;
  type: string;
  category: string;
  amount: number;
  payment_method: string;
  reservation_ref: string;
  check_in: string;
  check_out: string;
  guest_name: string;
  channel: string;
  property_name: string;
  note: string;
}

function TransactionDetailModal({ propertyId, propertyName, field, fieldLabel, startDate, endDate, onClose }: {
  propertyId: number;
  propertyName: string;
  field: SortKey;
  fieldLabel: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTxs = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const q = FIELD_TO_QUERY[field];
    if (!q) return;
    const params = new URLSearchParams({
      property_id: String(propertyId),
      start_date: startDate,
      end_date: endDate,
    });
    if (q.category) params.set("category", q.category);
    if (q.type) params.set("type", q.type);

    try {
      const res = await fetch(`${API_URL}/transactions/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTxs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTxs(); }, []);

  const handleCategoryChange = async (txId: number, newCategory: string) => {
    setSaving(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/transactions/${txId}/category`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      if (res.ok) {
        setTxs((prev) => prev.map((t) => t.id === txId ? { ...t, category: newCategory } : t));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const total = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[80vh] rounded-lg bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{propertyName}</h3>
            <p className="text-sm text-gray-500">{fieldLabel} · {startDate} ~ {endDate} · {txs.length}건 · 합계 {fmt(total)}원</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="overflow-auto flex-1 px-5 py-3">
          {loading ? (
            <p className="py-10 text-center text-gray-400">불러오는 중...</p>
          ) : txs.length === 0 ? (
            <p className="py-10 text-center text-gray-400">해당 거래가 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-2 py-2 text-left">날짜</th>
                  <th className="px-2 py-2 text-left">유형</th>
                  <th className="px-2 py-2 text-left">항목</th>
                  <th className="px-2 py-2 text-right">금액</th>
                  <th className="px-2 py-2 text-left">결제방법</th>
                  <th className="px-2 py-2 text-left">예약코드</th>
                  <th className="px-2 py-2 text-left">게스트</th>
                  <th className="px-2 py-2 text-left">채널</th>
                  <th className="px-2 py-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{t.transaction_at?.slice(0, 10)}</td>
                    <td className="px-2 py-1.5 text-gray-600">{t.type}</td>
                    <td className="px-2 py-1.5">
                      {editingId === t.id ? (
                        <select
                          defaultValue={t.category}
                          onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                          disabled={saving}
                          className="rounded border border-blue-300 px-1.5 py-0.5 text-xs bg-blue-50"
                          autoFocus
                          onBlur={() => setEditingId(null)}
                        >
                          {ALL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => setEditingId(t.id)}
                          className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700"
                          title="클릭하여 항목 변경"
                        >
                          {t.category}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-900">{fmt(t.amount)}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-xs">{t.payment_method}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-xs truncate max-w-[120px]">{t.reservation_ref || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-xs truncate max-w-[100px]">{t.guest_name || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500 text-xs">{t.channel}</td>
                    <td className="px-2 py-1.5 text-gray-400 text-xs truncate max-w-[120px]">{t.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t px-5 py-3 text-right">
          <p className="text-xs text-gray-400">항목을 클릭하면 카테고리를 변경할 수 있습니다. 변경 후 정산 페이지를 새로고침하면 반영됩니다.</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  const colorCls = {
    red: "text-red-700 bg-red-50 border-red-200",
    green: "text-green-700 bg-green-50 border-green-200",
  }[color || ""] || "text-gray-700 bg-white border-gray-200";

  return (
    <div className={`rounded-lg border p-4 ${colorCls}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] opacity-60">{sub}</p>}
    </div>
  );
}

function InfoPopup({ info, onClose }: { info: { title: string; desc: string; details: string[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900">{info.title}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        <p className="text-xs text-gray-600 mb-3">{info.desc}</p>
        <ul className="space-y-1">
          {info.details.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
              <span className="mt-0.5 h-1 w-1 rounded-full bg-gray-400 flex-shrink-0" />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CreateSettlementModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { title: string; description: string; priority: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("P1");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-gray-900">정산 이슈 등록</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="미수금 확인, 정산 누락 등" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">설명</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" rows={3} placeholder="상세 내용" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">우선순위</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="P0">P0 (긴급)</option>
              <option value="P1">P1 (오늘)</option>
              <option value="P2">P2 (이번주)</option>
              <option value="P3">P3 (여유)</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={() => title && onCreate({ title, description, priority })} disabled={!title}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">등록</button>
        </div>
      </div>
    </div>
  );
}

function ExportModal({ onClose, getDateRange, availableMonths }: {
  onClose: () => void;
  getDateRange: () => { start: string; end: string };
  availableMonths: string[];
}) {
  const [exportType, setExportType] = useState<"settlement" | "reservations" | "transactions">("settlement");
  const [startDate, setStartDate] = useState(() => getDateRange().start);
  const [endDate, setEndDate] = useState(() => getDateRange().end);
  const [yearMonth, setYearMonth] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    const token = localStorage.getItem("token");
    let url = "";

    switch (exportType) {
      case "settlement":
        url = `${API_URL}/settlement/export?start_date=${startDate}&end_date=${endDate}`;
        break;
      case "reservations":
        url = `${API_URL}/reservations/export?start_date=${startDate}&end_date=${endDate}`;
        break;
      case "transactions":
        url = `${API_URL}/transactions/export${yearMonth ? `?year_month=${yearMonth}` : ""}`;
        break;
    }

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("다운로드 실패");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const cd = res.headers.get("content-disposition");
      const fn = cd?.match(/filename=(.+)/)?.[1] || `export_${exportType}.csv`;
      a.download = fn;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert("다운로드에 실패했습니다");
    } finally {
      setDownloading(false);
    }
  };

  const TYPES = [
    { key: "settlement" as const, label: "정산 (숙소별 P&L)", desc: "숙소별 매출/비용/이익 CSV" },
    { key: "reservations" as const, label: "예약 내역", desc: "기간 내 확정 예약 전체" },
    { key: "transactions" as const, label: "거래 내역 (CSV 원본)", desc: "Hostex 거래 CSV 데이터" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-gray-900">데이터 내보내기</h3>

        {/* 유형 선택 */}
        <div className="space-y-2 mb-4">
          {TYPES.map((t) => (
            <label key={t.key}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                exportType === t.key ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input type="radio" name="exportType" checked={exportType === t.key}
                onChange={() => setExportType(t.key)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* 기간 설정 */}
        {exportType !== "transactions" ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">기간</label>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <span className="text-sm text-gray-400">~</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => { setStartDate("2025-01-01"); setEndDate("2025-12-31"); }}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">2025년 전체</button>
              <button onClick={() => { const n = new Date(); setStartDate("2026-01-01"); setEndDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`); }}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">2026년 ~현재</button>
              <button onClick={() => { const n = new Date(); setStartDate("2025-01-01"); setEndDate(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`); }}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">전체 기간</button>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">월 선택 (비우면 전체)</label>
            <select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">전체 기간</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            닫기
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {downloading ? "다운로드 중..." : "CSV 다운로드"}
          </button>
        </div>
      </div>
    </div>
  );
}
