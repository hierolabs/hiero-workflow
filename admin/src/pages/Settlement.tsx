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

const API_URL = import.meta.env.VITE_API_URL;
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

type PresetKey = "this_month" | "last_month" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "이번 달" },
  { key: "last_month", label: "지난 달" },
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
    default:
      return { start: fmtD(now), end: fmtD(now) };
  }
}

interface MonthlySummary {
  property_id: number;
  property_name: string;
  year_month: string;
  revenue: number;
  refund: number;
  net_revenue: number;
  cleaning_fee: number;
  mgmt_fee: number;
  rent_out: number;
  operation_fee: number;
  labor_fee: number;
  supplies_fee: number;
  maintenance: number;
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

  const getDateRange = () => {
    if (preset === "custom" && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getPresetDates(preset);
  };

  const loadSettlement = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { start, end } = getDateRange();
      const res = await fetch(`${API_URL}/settlement/summary?start_date=${start}&end_date=${end}`, {
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

  const loadMonths = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/transactions/months`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAvailableMonths(await res.json());
    } catch { /* ignore */ }
  };

  const loadIssues = async () => {
    try {
      const res = await fetchIssues({ issue_type: "settlement", page_size: "50" });
      setIssues((res.issues || []).filter((i: Issue) => i.issue_type === "settlement"));
    } catch { /* ignore */ }
  };

  useEffect(() => { Promise.all([loadMonths(), loadIssues()]); }, []);
  useEffect(() => {
    if (preset === "custom" && (!customStart || !customEnd)) return;
    loadSettlement();
  }, [preset, customStart, customEnd]);

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
                    {(p.labor_fee + p.supplies_fee + p.maintenance + p.other_cost) ? fmt(p.labor_fee + p.supplies_fee + p.maintenance + p.other_cost) : "—"}
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
              {/* 합계 행 */}
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
                  {fmt(result.total.labor_fee + result.total.supplies_fee + result.total.maintenance + result.total.other_cost)}
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
