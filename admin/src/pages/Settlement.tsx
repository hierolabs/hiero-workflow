import { useEffect, useState } from "react";
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
  const fmtD = (d: Date) => d.toISOString().slice(0, 10);
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
  other_revenue: number;
  refund: number;
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

  // 필터 (다중 선택)
  const [filterPropIds, setFilterPropIds] = useState<string[]>([]);
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [propertyList, setPropertyList] = useState<{ id: number; name: string }[]>([]);
  const [channelList, setChannelList] = useState<string[]>([]);

  // 연도별 월간 데이터
  const [yearMonths, setYearMonths] = useState<YearMonthData[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [selectedYearMonth, setSelectedYearMonth] = useState<string | null>(null);

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
    setCustomEnd(last.toISOString().slice(0, 10));
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

        {/* 데이터 있는 월 퀵 선택 */}
        {availableMonths.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">월별:</span>
            {availableMonths.slice(0, 12).map((m) => (
              <button key={m} onClick={() => handleMonthClick(m)}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">
                {m}
              </button>
            ))}
          </div>
        )}
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
                <SummaryCard label="총 매출" value={`${fmt(result.total.revenue)}`} />
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
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <SummaryCard label="총 매출" value={`${fmt(result.total.revenue)}`} />
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
    </div>
  );
}

function PropertyTable({ result }: { result: SettlementResult }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="sticky left-0 bg-gray-50 px-3 py-2.5 text-left text-xs font-medium text-gray-500">숙소</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">매출</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">환불</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">순매출</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">청소비</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">관리비</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">월세</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">운영비</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">기타</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">총비용</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">순이익</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">이익률</th>
          </tr>
        </thead>
        <tbody>
          {result.properties
            .sort((a, b) => b.profit - a.profit)
            .map((p) => (
            <tr key={`${p.property_id}-${p.property_name}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="sticky left-0 bg-white px-3 py-2 font-medium text-gray-900 whitespace-nowrap max-w-[200px] truncate">
                {p.property_name || `#${p.property_id}`}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">{fmt(p.revenue)}</td>
              <td className="px-3 py-2 text-right text-red-500">{p.refund ? `-${fmt(p.refund)}` : "—"}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(p.net_revenue)}</td>
              <td className="px-3 py-2 text-right text-gray-600">{p.cleaning_fee ? fmt(p.cleaning_fee) : "—"}</td>
              <td className="px-3 py-2 text-right text-gray-600">{p.mgmt_fee ? fmt(p.mgmt_fee) : "—"}</td>
              <td className="px-3 py-2 text-right text-gray-600">{p.rent_out ? fmt(p.rent_out) : "—"}</td>
              <td className="px-3 py-2 text-right text-gray-600">{p.operation_fee ? fmt(p.operation_fee) : "—"}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {((p.labor_fee || 0) + (p.supplies_fee || 0) + (p.maintenance || 0) + (p.interior_fee || 0) + (p.interest_fee || 0) + (p.dividend_fee || 0) + (p.property_fee || 0) + (p.other_cost || 0)) ? fmt((p.labor_fee || 0) + (p.supplies_fee || 0) + (p.maintenance || 0) + (p.interior_fee || 0) + (p.interest_fee || 0) + (p.dividend_fee || 0) + (p.property_fee || 0) + (p.other_cost || 0)) : "—"}
              </td>
              <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(p.total_cost)}</td>
              <td className={`px-3 py-2 text-right font-bold ${p.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(p.profit)}
              </td>
              <td className={`px-3 py-2 text-right font-medium ${p.profit_rate >= 0 ? "text-green-600" : "text-red-600"}`}>
                {p.profit_rate.toFixed(1)}%
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
            <td className="sticky left-0 bg-gray-50 px-3 py-2.5 text-gray-900">합계 ({result.properties.length}개)</td>
            <td className="px-3 py-2.5 text-right text-gray-900">{fmt(result.total.revenue)}</td>
            <td className="px-3 py-2.5 text-right text-red-600">{result.total.refund ? `-${fmt(result.total.refund)}` : "—"}</td>
            <td className="px-3 py-2.5 text-right text-gray-900">{fmt(result.total.net_revenue)}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(result.total.cleaning_fee)}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(result.total.mgmt_fee)}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(result.total.rent_out)}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(result.total.operation_fee)}</td>
            <td className="px-3 py-2.5 text-right text-gray-700">
              {fmt((result.total.labor_fee || 0) + (result.total.supplies_fee || 0) + (result.total.maintenance || 0) + (result.total.interior_fee || 0) + (result.total.interest_fee || 0) + (result.total.dividend_fee || 0) + (result.total.property_fee || 0) + (result.total.other_cost || 0))}
            </td>
            <td className="px-3 py-2.5 text-right text-red-700">{fmt(result.total.total_cost)}</td>
            <td className={`px-3 py-2.5 text-right ${result.total.profit >= 0 ? "text-green-700" : "text-red-700"}`}>
              {fmt(result.total.profit)}
            </td>
            <td className={`px-3 py-2.5 text-right ${result.total.profit_rate >= 0 ? "text-green-600" : "text-red-600"}`}>
              {result.total.profit_rate.toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorCls = {
    red: "text-red-700 bg-red-50 border-red-200",
    green: "text-green-700 bg-green-50 border-green-200",
  }[color || ""] || "text-gray-700 bg-white border-gray-200";

  return (
    <div className={`rounded-lg border p-4 ${colorCls}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
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
              <button onClick={() => { setStartDate("2026-01-01"); setEndDate(new Date().toISOString().slice(0, 10)); }}
                className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">2026년 ~현재</button>
              <button onClick={() => { setStartDate("2025-01-01"); setEndDate(new Date().toISOString().slice(0, 10)); }}
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
