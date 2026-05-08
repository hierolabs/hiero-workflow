import { useEffect, useState, useCallback, useMemo } from "react";
import OperationManual from "../components/OperationManual";
import AiAgentPanel from "../components/AiAgentPanel";
import PeriodFilter, { calcRange, type PeriodKey } from "../components/PeriodFilter";
import {
  fetchCleaningTasks,
  fetchCleaningSummary,
  generateCleaningTasks,
  assignCleaner,
  startCleaning,
  completeCleaning,
  reportCleaningIssue,
  fetchCleaners,
  createCleaner,
  deleteCleaner,
  fetchCleanerWorkload,
  fetchCleaningCodes,
  CLEANING_STATUS_LABELS,
  CLEANING_STATUS_STYLES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  type CleaningTask,
  type CleaningSummary,
  type Cleaner,
  type CleanerWorkload,
  type CleaningCode,
} from "../utils/cleaning-api";

type Tab = "dashboard" | "dispatch" | "ledger" | "cleaners" | "settlement" | "records" | "costmatch" | "codes" | "route";

const TRANSPORT_LABELS: Record<string, string> = {
  walk: "도보",
  bike: "자전거",
  car: "자차",
  public: "대중교통",
};

const DAY_LABELS: Record<string, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일",
};

export default function Cleaning() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showManual, setShowManual] = useState(false);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">청소 관리</h1>
          <p className="mt-1 text-sm text-gray-500">띵동 — 청소 배정 · 현황 · 관리</p>
        </div>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">히로가이드</button>
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>배정 대시보드</TabBtn>
        <TabBtn active={tab === "dispatch"} onClick={() => setTab("dispatch")}>AI 배정</TabBtn>
        <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")}>청소비 대장</TabBtn>
        <TabBtn active={tab === "cleaners"} onClick={() => setTab("cleaners")}>청소자 관리</TabBtn>
        <TabBtn active={tab === "settlement"} onClick={() => setTab("settlement")}>주간 정산</TabBtn>
        <TabBtn active={tab === "records"} onClick={() => setTab("records")}>전체 기록</TabBtn>
        <TabBtn active={tab === "costmatch"} onClick={() => setTab("costmatch")}>비용 매칭</TabBtn>
        <TabBtn active={tab === "codes"} onClick={() => setTab("codes")}>청소코드</TabBtn>
        <TabBtn active={tab === "route"} onClick={() => setTab("route")}>동선 분석</TabBtn>
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "dispatch" && <DispatchTab />}
      {tab === "ledger" && <LedgerTab />}
      {tab === "cleaners" && <CleanersTab />}
      {tab === "settlement" && <SettlementTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "costmatch" && <CostMatchTab />}
      {tab === "codes" && <CodesTab />}
      {tab === "route" && <RouteAnalysisTab />}
      {showManual && <OperationManual page="cleaning" onClose={() => setShowManual(false)} />}

      <AiAgentPanel page="cleaning" pageLabel="청소 관리" getPageData={() => `현재 탭: ${tab}. 청소 대시보드/청소자 관리/청소코드 3개 탭 구조. 데이터는 탭 내부에서 관리됨.`} />
    </div>
  );
}

// ===================== Dashboard Tab =====================
interface Extension {
  property_id: number | null;
  guest_name: string;
  checkout_res: string;
  checkin_res: string;
  checkout_date: string;
  new_checkout: string;
  nights_extended: number;
}

function DashboardTab() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [rangeStart, setRangeStart] = useState(() => calcRange("today")[0]);
  const [rangeEnd, setRangeEnd] = useState(() => calcRange("today")[1]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [summary, setSummary] = useState<CleaningSummary | null>(null);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [workload, setWorkload] = useState<CleanerWorkload[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const handlePeriodChange = useCallback((p: PeriodKey, start: string, end: string) => {
    setPeriod(p);
    setRangeStart(start);
    setRangeEnd(end);
  }, []);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState(0);
  const [issueTaskId, setIssueTaskId] = useState<number | null>(null);
  const [issueMemo, setIssueMemo] = useState("");
  const [issueCost, setIssueCost] = useState(0);
  const [issueType, setIssueType] = useState("facility");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "region">("region");

  const API_URL = import.meta.env.VITE_API_URL;

  const isSingleDay = rangeStart === rangeEnd;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = isSingleDay
        ? { cleaning_date: rangeStart, page_size: "200" }
        : { start_date: rangeStart, end_date: rangeEnd, page_size: "200" };
      if (statusFilter) params.status = statusFilter;
      const token = localStorage.getItem("token");
      const [taskData, summaryData, cleanerData, workloadData, extRes] = await Promise.all([
        fetchCleaningTasks(params),
        isSingleDay ? fetchCleaningSummary(rangeStart) : fetchCleaningSummary(rangeStart, rangeEnd),
        fetchCleaners(),
        fetchCleanerWorkload(rangeStart),
        fetch(`${API_URL}/cleaning/extensions?date=${rangeStart}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setTasks(taskData.tasks || []);
      setSummary(summaryData);
      setCleaners(cleanerData || []);
      setWorkload(workloadData || []);
      if (extRes.ok) {
        const extData = await extRes.json();
        setExtensions(extData.extensions || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, isSingleDay, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCleaningTasks(rangeStart);
      alert(`${result.created}건 청소 업무 생성`);
      load();
    } catch { alert("생성 실패"); } finally { setGenerating(false); }
  };

  const handleAssign = async (taskId: number) => {
    if (selectedCleanerId === 0) return;
    try {
      await assignCleaner(taskId, selectedCleanerId);
      setAssigningId(null);
      setSelectedCleanerId(0);
      load();
    } catch { alert("배정 실패"); }
  };

  const handleStart = async (taskId: number) => {
    try { await startCleaning(taskId); load(); } catch { alert("시작 실패"); }
  };

  const handleDispatch = async (taskId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/cleaning/tasks/${taskId}/message`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.message) {
        await navigator.clipboard.writeText(data.message);
        // 상태를 dispatched로 전환
        await fetch(`${API_URL}/cleaning/tasks/${taskId}/dispatch`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
        });
        alert('메시지가 클립보드에 복사되었습니다. 카카오톡에 붙여넣기 하세요.');
        load();
      }
    } catch { alert('메시지 복사 실패'); }
  };

  const handleBulkDispatch = async () => {
    if (!confirm(`${rangeStart} 배정된 모든 업무를 발송 처리하시겠습니까?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/cleaning/bulk-dispatch?date=${rangeStart}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(`${data.dispatched}건 발송 완료`);
      load();
    } catch { alert('일괄 발송 실패'); }
  };

  const handleComplete = async (taskId: number) => {
    try { await completeCleaning(taskId); load(); } catch { alert("완료 처리 실패"); }
  };

  const handleReportIssue = async () => {
    if (!issueTaskId || !issueMemo.trim()) return;
    try {
      // 기존 청소 태스크 이슈 등록
      await reportCleaningIssue(issueTaskId, issueMemo);

      // 비용이 있으면 별도 이슈 생성 (즉결 규칙 적용)
      const task = tasks.find(t => t.id === issueTaskId);
      if (issueCost > 0 || issueType !== "cleaning") {
        const token = localStorage.getItem("token");
        await fetch(`${API_URL}/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: `[현장] ${task?.property_name || ''} - ${issueMemo.slice(0, 50)}`,
            description: issueMemo,
            issue_type: issueType,
            priority: issueCost >= 300000 ? "P0" : issueCost >= 100000 ? "P1" : "P2",
            property_id: task?.property_id,
            property_name: task?.property_name,
            cleaning_task_id: issueTaskId,
            estimated_cost: issueCost,
          }),
        });
      }

      setIssueTaskId(null);
      setIssueMemo("");
      setIssueCost(0);
      setIssueType("facility");
      load();
    } catch { alert("이슈 등록 실패"); }
  };

  // 권역별 그룹핑
  const tasksByRegion = tasks.reduce<Record<string, CleaningTask[]>>((acc, t) => {
    const key = t.property_code ? t.property_code.replace(/\d+/g, "").replace(/^([A-Z]+).*/, "$1") : "기타";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const unassignedCount = tasks.filter(t => !t.cleaner_id && t.status === "pending").length;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 space-y-3">
        <PeriodFilter value={period} onChange={handlePeriodChange} />
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleGenerate} disabled={generating || !isSingleDay}
            title={isSingleDay ? "" : "단일 날짜에서만 생성 가능"}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {generating ? "생성 중..." : "청소 업무 생성"}
          </button>
          <button onClick={handleBulkDispatch} disabled={!isSingleDay}
            title={isSingleDay ? "" : "단일 날짜에서만 발송 가능"}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            일괄 발송
          </button>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">전체 상태</option>
            {Object.entries(CLEANING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="ml-auto flex gap-1">
            <button onClick={() => setViewMode("region")}
              className={`rounded px-3 py-1.5 text-xs font-medium ${viewMode === "region" ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600"}`}>권역별</button>
            <button onClick={() => setViewMode("list")}
              className={`rounded px-3 py-1.5 text-xs font-medium ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600"}`}>전체 목록</button>
          </div>
        </div>
      </div>

      {/* Summary + Alert */}
      {summary && (
        <div className="mb-4">
          <div className="grid grid-cols-6 gap-3">
            <SummaryCard label="전체" value={summary.total} />
            <SummaryCard label="대기" value={summary.pending} color="text-gray-600" />
            <SummaryCard label="배정됨" value={summary.assigned} color="text-blue-600" />
            <SummaryCard label="진행 중" value={summary.in_progress} color="text-yellow-600" />
            <SummaryCard label="완료" value={summary.completed} color="text-green-600" />
            <SummaryCard label="문제" value={summary.issue} color="text-red-600" />
          </div>
          {unassignedCount > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">미배정 {unassignedCount}건</span> — 청소자 배정이 필요합니다.
            </div>
          )}
          {extensions.length > 0 && (
            <div className="mt-3 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-800">
              <span className="font-semibold">연장 감지 {extensions.length}건</span> — 청소 불필요 (자동 제외됨)
              <div className="mt-2 space-y-1">
                {extensions.map((ext, i) => (
                  <div key={i} className="text-xs text-purple-700">
                    • {ext.guest_name} — ~{ext.new_checkout} ({ext.nights_extended}박 연장)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cleaner Workload Bar */}
      {workload.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">청소자별 배정 현황</h3>
          <div className="flex flex-wrap gap-2">
            {workload.filter(w => w.assigned > 0 || w.max_daily > 0).map(w => {
              const pct = w.max_daily > 0 ? Math.min(100, (w.assigned / w.max_daily) * 100) : 0;
              const isFull = w.assigned >= w.max_daily;
              return (
                <div key={w.cleaner_id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
                  <span className="font-medium text-gray-800">{w.cleaner_name}</span>
                  <div className="h-2 w-16 rounded-full bg-gray-200">
                    <div className={`h-2 rounded-full ${isFull ? "bg-red-500" : w.assigned > 0 ? "bg-blue-500" : "bg-gray-300"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className={isFull ? "font-semibold text-red-600" : "text-gray-500"}>
                    {w.assigned}/{w.max_daily}
                  </span>
                  {w.completed > 0 && <span className="text-green-600">({w.completed}완료)</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="py-20 text-center text-gray-500">로딩 중...</div>
      ) : viewMode === "region" ? (
        // --- 권역별 뷰 ---
        <div className="space-y-4">
          {Object.keys(tasksByRegion).sort().map(region => (
            <div key={region} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">
                  {region} 권역 <span className="font-normal text-gray-400">({tasksByRegion[region].length}건)</span>
                </h3>
                {tasksByRegion[region].some(t => !t.cleaner_id && t.status === "pending") && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    미배정 {tasksByRegion[region].filter(t => !t.cleaner_id && t.status === "pending").length}건
                  </span>
                )}
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <Th>코드</Th><Th>숙소</Th><Th>게스트</Th><Th>우선순위</Th><Th>다음 체크인</Th><Th>청소자</Th><Th>상태</Th><ThR>관리</ThR>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasksByRegion[region].map(t => (
                    <TaskRow key={t.id} task={t} cleaners={cleaners}
                      assigningId={assigningId} selectedCleanerId={selectedCleanerId}
                      onAssignStart={(id) => { setAssigningId(id); setSelectedCleanerId(0); }}
                      onAssignCancel={() => setAssigningId(null)}
                      onAssignConfirm={handleAssign} onDispatch={handleDispatch}
                      onCleanerSelect={setSelectedCleanerId}
                      onStart={handleStart} onComplete={handleComplete}
                      onIssue={(id) => { setIssueTaskId(id); setIssueMemo(""); }} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
              해당 날짜에 청소 업무가 없습니다. "청소 업무 생성" 버튼을 눌러주세요.
            </div>
          )}
        </div>
      ) : (
        // --- 전체 목록 뷰 ---
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>코드</Th><Th>숙소</Th><Th>게스트</Th><Th>우선순위</Th><Th>다음 체크인</Th><Th>청소자</Th><Th>상태</Th><ThR>관리</ThR>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400">청소 업무가 없습니다.</td></tr>
              ) : tasks.map(t => (
                <TaskRow key={t.id} task={t} cleaners={cleaners}
                  assigningId={assigningId} selectedCleanerId={selectedCleanerId}
                  onAssignStart={(id) => { setAssigningId(id); setSelectedCleanerId(0); }}
                  onAssignCancel={() => setAssigningId(null)}
                  onAssignConfirm={handleAssign} onDispatch={handleDispatch}
                  onCleanerSelect={setSelectedCleanerId}
                  onStart={handleStart} onComplete={handleComplete}
                  onIssue={(id) => { setIssueTaskId(id); setIssueMemo(""); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Modal */}
      {issueTaskId !== null && (
        <Modal onClose={() => { setIssueTaskId(null); setIssueCost(0); setIssueType("facility"); }} title="현장 이슈 등록">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이슈 유형</label>
              <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="facility">시설 고장</option>
                <option value="cleaning">청결 문제</option>
                <option value="guest">게스트 이슈</option>
                <option value="settlement">비용/정산</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">문제 내용</label>
              <textarea value={issueMemo} onChange={(e) => setIssueMemo(e.target.value)}
                rows={3} placeholder="TV 고장, 침구 부족, 파손, 심한 오염 등..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">예상 비용 (원)</label>
              <input type="number" value={issueCost || ''} onChange={(e) => setIssueCost(Number(e.target.value))}
                placeholder="0 (비용 없으면 비워두세요)"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              {issueCost > 0 && (
                <div className={`mt-1 text-xs font-medium ${
                  issueCost < 100000 ? 'text-emerald-600' : issueCost < 300000 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {issueCost < 100000 ? '✓ 즉결 처리 (10만원 미만)' :
                   issueCost < 300000 ? '→ ETF(CFO) 승인 필요' :
                   '→ Founder 승인 필요'}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setIssueTaskId(null); setIssueCost(0); }} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
              <button onClick={handleReportIssue} disabled={!issueMemo.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {issueCost >= 100000 ? '승인 요청' : '등록'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== Task Row =====================
function TaskRow({ task: t, cleaners, assigningId, selectedCleanerId,
  onAssignStart, onAssignCancel, onAssignConfirm, onCleanerSelect,
  onStart, onComplete, onIssue, onDispatch }: {
  task: CleaningTask; cleaners: Cleaner[];
  assigningId: number | null; selectedCleanerId: number;
  onAssignStart: (id: number) => void; onAssignCancel: () => void;
  onAssignConfirm: (id: number) => void; onCleanerSelect: (id: number) => void;
  onStart: (id: number) => void; onComplete: (id: number) => void;
  onIssue: (id: number) => void; onDispatch: (id: number) => void;
}) {
  const isUnassigned = !t.cleaner_id && t.status === "pending";
  return (
    <tr className={`hover:bg-gray-50 ${isUnassigned ? "bg-amber-50/40" : ""}`}>
      <Td><span className="font-mono text-xs font-semibold text-slate-600">{t.property_code}</span></Td>
      <Td><span className="text-sm text-gray-900">{t.property_name}</span></Td>
      <Td>{t.guest_name || "-"}</Td>
      <Td>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority] || ""}`}>
          {PRIORITY_LABELS[t.priority] || t.priority}
        </span>
      </Td>
      <Td>
        {t.next_check_in ? (
          <span className={t.next_check_in === t.cleaning_date ? "text-red-600 font-semibold text-xs" : "text-gray-600 text-xs"}>
            {t.next_check_in}{t.next_check_in === t.cleaning_date && " (당일!)"}
          </span>
        ) : <span className="text-gray-400 text-xs">없음</span>}
      </Td>
      <Td>
        {assigningId === t.id ? (
          <div className="flex items-center gap-1">
            <select value={selectedCleanerId} onChange={(e) => onCleanerSelect(Number(e.target.value))}
              className="rounded border border-gray-300 px-1 py-0.5 text-xs">
              <option value={0}>선택</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.name} ({c.region})</option>)}
            </select>
            <button onClick={() => onAssignConfirm(t.id)} disabled={selectedCleanerId === 0}
              className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white disabled:opacity-40">확인</button>
            <button onClick={onAssignCancel} className="text-xs text-gray-500">취소</button>
          </div>
        ) : (
          t.cleaner_name ? (
            <span className="text-sm font-medium">{t.cleaner_name}</span>
          ) : (
            <button onClick={() => onAssignStart(t.id)}
              className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100">배정 필요</button>
          )
        )}
      </Td>
      <Td>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CLEANING_STATUS_STYLES[t.status] || ""}`}>
          {CLEANING_STATUS_LABELS[t.status] || t.status}
        </span>
      </Td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          {t.status === "pending" && !t.cleaner_id && (
            <ActionBtn onClick={() => onAssignStart(t.id)} color="blue">배정</ActionBtn>
          )}
          {t.status === "assigned" && (
            <>
              <ActionBtn onClick={() => onDispatch(t.id)} color="purple">메시지</ActionBtn>
              <ActionBtn onClick={() => onStart(t.id)} color="blue">시작</ActionBtn>
            </>
          )}
          {t.status === "dispatched" && (
            <ActionBtn onClick={() => onStart(t.id)} color="blue">시작</ActionBtn>
          )}
          {t.status === "in_progress" && (
            <>
              <ActionBtn onClick={() => onComplete(t.id)} color="green">완료</ActionBtn>
              <ActionBtn onClick={() => onIssue(t.id)} color="red">문제</ActionBtn>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ===================== Cleaners Tab =====================
function CleanersTab() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", region: "", memo: "" });

  const load = useCallback(async () => {
    try { setCleaners(await fetchCleaners() || []); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createCleaner(form);
      setShowForm(false);
      setForm({ name: "", phone: "", region: "", memo: "" });
      load();
    } catch { alert("생성 실패"); }
  };

  const handleDelete = async (c: Cleaner) => {
    if (!confirm(`"${c.name}" 청소자를 삭제하시겠습니까?`)) return;
    try { await deleteCleaner(c.id); load(); } catch { alert("삭제 실패"); }
  };

  if (loading) return <div className="py-20 text-center text-gray-500">로딩 중...</div>;

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-gray-500">활성 청소자 {cleaners.length}명</p>
        <button onClick={() => setShowForm(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">+ 청소자 등록</button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>이름</Th><Th>전화번호</Th><Th>담당 권역</Th><Th>가용 요일</Th><Th>이동수단</Th><Th>역량</Th><Th>최대</Th><Th>메모</Th><ThR>관리</ThR>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cleaners.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td><span className="font-medium">{c.name}</span></Td>
                <Td><span className="text-xs">{c.phone || "-"}</span></Td>
                <Td>
                  <span className="text-xs">{c.regions || c.region || "-"}</span>
                </Td>
                <Td>
                  <div className="flex gap-0.5">
                    {["mon","tue","wed","thu","fri","sat","sun"].map(d => {
                      const active = !c.available_days || c.available_days.includes(d);
                      return (
                        <span key={d} className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${active ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-300"}`}>
                          {DAY_LABELS[d]}
                        </span>
                      );
                    })}
                  </div>
                </Td>
                <Td><span className="text-xs">{TRANSPORT_LABELS[c.transport] || c.transport || "-"}</span></Td>
                <Td>
                  <div className="flex gap-1">
                    {c.can_laundry && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">빨래</span>}
                    {c.can_dry && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">건조</span>}
                  </div>
                </Td>
                <Td><span className="text-xs font-medium">{c.max_daily || 5}건/일</span></Td>
                <Td><span className="text-xs text-gray-500">{c.memo || "-"}</span></Td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(c)}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="청소자 등록">
          <div className="space-y-3">
            <Field label="이름" required>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
            </Field>
            <Field label="전화번호">
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
            </Field>
            <Field label="담당 지역">
              <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="예: A,A2 또는 강동 전역"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} disabled={!form.name.trim()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">등록</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== Settlement Tab =====================
interface CleanerSettlementData {
  cleaner_id: number; cleaner_name: string; region: string;
  task_count: number; base_total: number; extra_total: number; total_cost: number;
  tax_33: number; net_payment: number;
  bank_name: string; bank_account: string; account_holder: string; phone: string;
}
interface WeeklySettlementData {
  week_start: string; week_end: string;
  cleaners: CleanerSettlementData[];
  grand_total: number; total_tax: number; total_net_payment: number;
  total_tasks: number; total_cleaners: number;
}

function SettlementTab() {
  const [data, setData] = useState<WeeklySettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [rangeStart, setRangeStart] = useState(() => calcRange('today')[0]);
  const [rangeEnd, setRangeEnd] = useState(() => calcRange('today')[1]);
  const API_URL = import.meta.env.VITE_API_URL;
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const handlePeriodChange = useCallback((p: PeriodKey, start: string, end: string) => {
    setPeriod(p);
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/cleaning/weekly-settlement?week_start=${rangeStart}&week_end=${rangeEnd}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [rangeStart, rangeEnd]);

  if (loading) return <div className="text-center text-gray-400 py-8">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <PeriodFilter value={period} onChange={handlePeriodChange} />

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">청소자</div>
            <div className="text-xl font-bold text-gray-800">{data.total_cleaners}명</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">총 건수</div>
            <div className="text-xl font-bold text-blue-700">{data.total_tasks}건</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">총 비용</div>
            <div className="text-xl font-bold text-gray-800">{fmt(data.grand_total)}원</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">원천세 (3.3%)</div>
            <div className="text-xl font-bold text-red-600">{fmt(data.total_tax)}원</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">실지급 합계</div>
            <div className="text-xl font-bold text-emerald-700">{fmt(data.total_net_payment)}원</div>
          </div>
        </div>
      )}

      {/* 청소자별 정산표 */}
      {data && data.cleaners && data.cleaners.length > 0 ? (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">청소자</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">권역</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">건수</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">기본</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">추가</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">합계</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-red-500">3.3%</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-emerald-600">실지급</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">계좌</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.cleaners.map(c => (
                <tr key={c.cleaner_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.cleaner_name}</div>
                    <div className="text-xs text-gray-400">{c.phone || '-'}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">{c.region}</td>
                  <td className="px-3 py-3 text-right font-medium">{c.task_count}</td>
                  <td className="px-3 py-3 text-right text-gray-600">{fmt(c.base_total)}</td>
                  <td className="px-3 py-3 text-right text-gray-600">{fmt(c.extra_total)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{fmt(c.total_cost)}</td>
                  <td className="px-3 py-3 text-right text-red-600">-{fmt(c.tax_33)}</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-700">{fmt(c.net_payment)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {c.bank_name ? `${c.bank_name} ${c.bank_account} (${c.account_holder || c.cleaner_name})` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 font-semibold">
                <td className="px-4 py-3">합계</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right">{data.total_tasks}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-right">{fmt(data.grand_total)}</td>
                <td className="px-3 py-3 text-right text-red-600">-{fmt(data.total_tax)}</td>
                <td className="px-3 py-3 text-right text-emerald-700">{fmt(data.total_net_payment)}</td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          해당 주간 정산 데이터가 없습니다
        </div>
      )}
    </div>
  );
}

// ===================== Records Tab — 전체 기록 + CSV 엑스포트 =====================
function RecordsTab() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [rangeStart, setRangeStart] = useState(() => calcRange('today')[0]);
  const [rangeEnd, setRangeEnd] = useState(() => calcRange('today')[1]);
  const [filterCleaner, setFilterCleaner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sumTotal, setSumTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  const handlePeriodChange = useCallback((p: PeriodKey, start: string, end: string) => {
    setPeriod(p);
    setRangeStart(start);
    setRangeEnd(end);
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ page: String(page), page_size: '50' });
    if (rangeStart) params.set('start_date', rangeStart);
    if (rangeEnd) params.set('end_date', rangeEnd);
    if (filterCleaner) params.set('cleaner_id', filterCleaner);
    if (filterStatus) params.set('status', filterStatus);
    const res = await fetch(`${API_URL}/cleaning/records?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setTasks(data.tasks || []);
    setTotal(data.total || 0);
    setSumTotal(data.sum_total || 0);
    setLoading(false);
  }, [page, rangeStart, rangeEnd, filterCleaner, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (rangeStart) params.set('start_date', rangeStart);
    if (rangeEnd) params.set('end_date', rangeEnd);
    if (filterCleaner) params.set('cleaner_id', filterCleaner);
    window.open(`${API_URL}/cleaning/export?${params}&token=${token}`, '_blank');
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* 기간 필터 */}
      <PeriodFilter value={period} onChange={handlePeriodChange} />
      {/* 추가 필터 + 엑스포트 */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="rounded border px-3 py-1.5 text-sm">
          <option value="">전체 상태</option>
          {Object.entries(CLEANING_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={handleExport}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
          CSV 다운로드
        </button>
        <span className="text-sm text-gray-500">총 {fmt(total)}건 · {fmt(sumTotal)}원</span>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">로딩 중...</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2 text-xs text-gray-500">날짜</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">코드</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">숙소</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">게스트</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">청소자</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">상태</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">기본</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">추가</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">합계</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">시작</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">완료</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs">{t.cleaning_date}</td>
                  <td className="px-3 py-2 text-xs font-mono">{t.property_code}</td>
                  <td className="px-3 py-2 text-xs">{t.property_name}</td>
                  <td className="px-3 py-2 text-xs">{t.guest_name || '-'}</td>
                  <td className="px-3 py-2 text-xs font-medium">{t.cleaner_name || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CLEANING_STATUS_STYLES[t.status] || ''}`}>
                      {CLEANING_STATUS_LABELS[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(t.base_price)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(t.extra_cost)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold">{fmt(t.total_cost)}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{t.started_at ? new Date(t.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{t.completed_at ? new Date(t.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">기록이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="rounded border px-3 py-1 text-sm disabled:opacity-30">이전</button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="rounded border px-3 py-1 text-sm disabled:opacity-30">다음</button>
        </div>
      )}
    </div>
  );
}

// ===================== Cost Match Tab — Data2 vs CleaningTask 매칭 =====================
interface CostMatchRow {
  property_id: number; property_name: string;
  csv_total: number; csv_count: number;
  task_total: number; task_count: number;
  diff: number; status: string;
}

function CostMatchTab() {
  const [data, setData] = useState<{
    matches: CostMatchRow[]; total_csv: number; total_task: number; total_diff: number;
    match_count: number; mismatch_count: number; property_count: number;
  } | null>(null);
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL;
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/cleaning/cost-match?year_month=${yearMonth}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [yearMonth]);

  const STATUS_STYLE: Record<string, string> = {
    match: 'bg-emerald-100 text-emerald-700',
    over: 'bg-blue-100 text-blue-700',
    under: 'bg-red-100 text-red-700',
    csv_only: 'bg-amber-100 text-amber-700',
    task_only: 'bg-purple-100 text-purple-700',
  };
  const STATUS_LABEL: Record<string, string> = {
    match: '일치', over: 'DB 초과', under: 'DB 부족', csv_only: 'CSV만', task_only: 'DB만',
  };

  if (loading) return <div className="text-center text-gray-400 py-8">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex items-center gap-3">
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm" />
        <span className="text-sm text-gray-500">Data 2 (CSV 정산) vs 청소 DB 비교</span>
      </div>

      {/* 요약 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">숙소 수</div>
            <div className="text-xl font-bold">{data.property_count}</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">CSV 청소비</div>
            <div className="text-xl font-bold text-gray-800">{fmt(data.total_csv)}원</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500">DB 청소비</div>
            <div className="text-xl font-bold text-blue-700">{fmt(data.total_task)}원</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-emerald-600">일치</div>
            <div className="text-xl font-bold text-emerald-700">{data.match_count}건</div>
          </div>
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-xs text-red-600">불일치</div>
            <div className="text-xl font-bold text-red-700">{data.mismatch_count}건</div>
          </div>
        </div>
      )}

      {/* 매칭 테이블 */}
      {data && data.matches && data.matches.length > 0 ? (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2 text-xs text-gray-500">숙소</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">CSV 건수</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">CSV 금액</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">DB 건수</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">DB 금액</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">차이</th>
                <th className="text-center px-3 py-2 text-xs text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.matches.map(m => (
                <tr key={m.property_id} className={`hover:bg-gray-50 ${m.status !== 'match' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{m.property_name}</td>
                  <td className="px-3 py-2 text-right text-xs">{m.csv_count}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(m.csv_total)}</td>
                  <td className="px-3 py-2 text-right text-xs">{m.task_count}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmt(m.task_total)}</td>
                  <td className={`px-3 py-2 text-right text-xs font-semibold ${m.diff > 0 ? 'text-blue-600' : m.diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {m.diff > 0 ? '+' : ''}{fmt(m.diff)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[m.status] || ''}`}>
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 font-semibold text-sm">
                <td className="px-4 py-2">합계</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right">{fmt(data.total_csv)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right">{fmt(data.total_task)}</td>
                <td className={`px-3 py-2 text-right ${data.total_diff > 0 ? 'text-blue-600' : data.total_diff < 0 ? 'text-red-600' : ''}`}>
                  {data.total_diff > 0 ? '+' : ''}{fmt(data.total_diff)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          해당 월 매칭 데이터가 없습니다
        </div>
      )}
    </div>
  );
}

// ===================== Codes Tab =====================
function CodesTab() {
  const [codes, setCodes] = useState<CleaningCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("");

  useEffect(() => {
    fetchCleaningCodes()
      .then(data => setCodes(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const regions = [...new Set(codes.map(c => c.region_code))].sort();
  const filtered = regionFilter ? codes.filter(c => c.region_code === regionFilter) : codes;

  if (loading) return <div className="py-20 text-center text-gray-500">로딩 중...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <p className="text-sm text-gray-500">전체 {codes.length}건</p>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">전체 권역</option>
          {regions.map(r => {
            const sample = codes.find(c => c.region_code === r);
            return <option key={r} value={r}>{r} {sample?.region_name}</option>;
          })}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>코드</Th><Th>권역</Th><Th>건물</Th><Th>숙소명</Th><Th>방 수</Th><Th>기본 단가</Th><Th>메모</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td><span className="font-mono text-xs font-semibold text-slate-600">{c.code}</span></Td>
                <Td>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{c.region_code}</span>
                  <span className="ml-1 text-xs text-gray-500">{c.region_name}</span>
                </Td>
                <Td><span className="text-sm">{c.building_name}</span></Td>
                <Td><span className="text-sm font-medium">{c.room_name}</span></Td>
                <Td>
                  <span className="text-sm">{c.room_count === 0 ? "관리" : c.room_count === 1.5 ? "복층/1.5" : `${c.room_count}룸`}</span>
                </Td>
                <Td><span className="text-sm font-medium">{c.base_price.toLocaleString()}원</span></Td>
                <Td><span className="text-xs text-gray-500">{c.memo || ""}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== Shared Components =====================
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-slate-900 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{children}</button>;
}
function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-3 text-center"><p className="text-xs text-gray-500">{label}</p><p className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</p></div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{children}</th>;
}
function ThR({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{children}</td>;
}
function ActionBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    blue: "border-blue-300 text-blue-600 hover:bg-blue-50",
    green: "border-green-300 text-green-600 hover:bg-green-50",
    red: "border-red-300 text-red-600 hover:bg-red-50",
    purple: "border-purple-300 text-purple-600 hover:bg-purple-50",
  };
  return <button onClick={onClick} className={`rounded border px-2.5 py-1 text-xs font-medium ${styles[color]}`}>{children}</button>;
}
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium text-gray-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>{children}</div>;
}

// ===================== AI 배정 탭 =====================
interface ParsedAssignment {
  cleaner: string; cleaner_id: number; cleaner_match: boolean;
  property_code: string; property_name: string; property_id: number; property_match: boolean;
  clean_type: string; note: string; task_id: number; task_match: boolean;
}
interface AutoAssignment {
  task_id: number; property_code: string; property_name: string;
  cleaner_id: number; cleaner_name: string; reason: string; score: number;
}

function DispatchTab() {
  const [mode, setMode] = useState<'paste' | 'auto'>('paste');
  const [text, setText] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [parseResult, setParseResult] = useState<{ date: string; assignments: ParsedAssignment[]; total_count: number; matched_count: number } | null>(null);
  const [autoResult, setAutoResult] = useState<{ date: string; assignments: AutoAssignment[]; unassigned: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // 붙여넣기 파싱
  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/cleaning/parse-assignment`, {
        method: 'POST', headers, body: JSON.stringify({ text, date: dateOverride || undefined }),
      });
      const data = await res.json();
      setParseResult(data);
    } catch { alert('파싱 실패'); } finally { setLoading(false); }
  };

  // 붙여넣기 결과 확정
  const handleConfirmPaste = async () => {
    if (!parseResult) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/cleaning/confirm-assignment`, {
        method: 'POST', headers,
        body: JSON.stringify({ assignments: parseResult.assignments, date: parseResult.date }),
      });
      const data = await res.json();
      alert(`배정 ${data.assigned}건, 생성 ${data.created}건 완료`);
      setParseResult(null); setText('');
    } catch { alert('확정 실패'); } finally { setConfirming(false); }
  };

  // AI 자동 배정
  const handleAutoAssign = async () => {
    setLoading(true);
    try {
      const date = dateOverride || today;
      const res = await fetch(`${API_URL}/cleaning/auto-assign?date=${date}`, { headers });
      const data = await res.json();
      setAutoResult(data);
    } catch { alert('자동 배정 실패'); } finally { setLoading(false); }
  };

  // AI 배정 확정
  const handleConfirmAuto = async () => {
    if (!autoResult) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/cleaning/confirm-auto-assign`, {
        method: 'POST', headers,
        body: JSON.stringify({ assignments: autoResult.assignments }),
      });
      const data = await res.json();
      alert(`${data.assigned}건 배정 완료`);
      setAutoResult(null);
    } catch { alert('확정 실패'); } finally { setConfirming(false); }
  };

  return (
    <div className="space-y-4">
      {/* 모드 전환 */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setMode('paste')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'paste' ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            문자 붙여넣기
          </button>
          <button onClick={() => setMode('auto')}
            className={`px-4 py-2 text-sm font-medium ${mode === 'auto' ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            AI 자동 배정
          </button>
        </div>
        <input type="date" value={dateOverride || today} onChange={e => setDateOverride(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {/* === 문자 붙여넣기 === */}
      {mode === 'paste' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 입력 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">카카오톡 배정표 붙여넣기</div>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder={"<05월 08일 업무>\n@박연실\nB104_더하임 1004_Q1\nB91_더하임 901_Q1\n\n@김정은\nD1_청광3차 1416_Q1\nA22_예건 202_수동_Q1"}
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button onClick={handleParse} disabled={loading || !text.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? '파싱 중...' : '배정표 분석'}
            </button>
          </div>

          {/* 결과 */}
          <div>
            {parseResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">
                    파싱 결과: {parseResult.total_count}건
                    <span className="ml-2 text-green-600">(매칭 {parseResult.matched_count}건)</span>
                  </div>
                  <span className="text-xs text-gray-500">{parseResult.date}</span>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white divide-y max-h-96 overflow-y-auto">
                  {parseResult.assignments.map((a, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.cleaner_match ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {a.cleaner_match ? '✓' : '✗'} {a.cleaner}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${a.property_match ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {a.property_match ? '✓' : '?'} {a.property_code}
                          </span>
                          <span className="text-sm text-gray-700">{a.property_name}</span>
                        </div>
                        {a.clean_type && <span className="text-xs text-blue-600 ml-1">[{a.clean_type}]</span>}
                        {a.note && <div className="text-xs text-gray-500 mt-1">{a.note}</div>}
                      </div>
                      {a.task_match && <span className="text-xs text-green-600">태스크 매칭</span>}
                    </div>
                  ))}
                </div>

                <button onClick={handleConfirmPaste} disabled={confirming}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                  {confirming ? '처리 중...' : `전체 배정 확정 (${parseResult.total_count}건)`}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
                <p>카카오톡 배정표를 왼쪽에 붙여넣고</p>
                <p className="mt-1">"배정표 분석"을 클릭하세요</p>
                <p className="mt-3 text-xs text-gray-300">@이름, 숙소코드_숙소명_Q코드 포맷을 자동 인식합니다</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === AI 자동 배정 === */}
      {mode === 'auto' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-700">AI 자동 배정</div>
              <div className="text-xs text-gray-500 mt-0.5">권역 · 가용요일 · 이동수단 · 워크로드 기반으로 최적 청소자를 추천합니다</div>
            </div>
            <button onClick={handleAutoAssign} disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? '분석 중...' : '자동 배정 제안'}
            </button>
          </div>

          {autoResult ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                {autoResult.date} — {autoResult.assignments.length}건 배정 제안
                {autoResult.unassigned?.length > 0 && (
                  <span className="ml-2 text-red-600">({autoResult.unassigned.length}건 배정 불가)</span>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white divide-y max-h-96 overflow-y-auto">
                {autoResult.assignments.map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{a.property_code}</span>
                        <span className="text-sm text-gray-600">{a.property_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-indigo-700">{a.cleaner_name}</span>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{a.reason}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="h-1.5 w-12 rounded-full bg-gray-200">
                            <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(a.score * 2, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{a.score}점</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {autoResult.unassigned?.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">배정 불가 ({autoResult.unassigned.length}건)</div>
                  {autoResult.unassigned.map((u, i) => (
                    <div key={i} className="text-xs text-red-600">{u}</div>
                  ))}
                </div>
              )}

              <button onClick={handleConfirmAuto} disabled={confirming}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {confirming ? '처리 중...' : `전체 배정 확정 (${autoResult.assignments.length}건)`}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              <p>미배정 청소 업무를 분석하여</p>
              <p className="mt-1">최적의 청소자를 자동 추천합니다</p>
              <p className="mt-3 text-xs text-gray-300">권역 매칭 +30 · 여유 건수 ×5 · 자차 +10</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== 청소비 대장 탭 =====================
interface LedgerRecord {
  id: number; cleaning_date: string; day_of_week: string;
  property_code: string; property_name: string; room_count: string;
  cleaner_name: string; check_note: string; total_cost: number;
  base_cost: number; extra_cost: number; bedding_cost: number; laundry_cost: number;
  guest_name: string; reservation_id: number; reservation_code: string; conversation_id: string; check_in: string; property_id: number;
  settlement_amount: number; settlement_id: number;
}
interface CleanerStat2 {
  cleaner_name: string; count: number; total_cost: number; base_cost: number; extra_cost: number;
}
interface PropStat2 { property_code: string; property_name: string; count: number; total_cost: number; }

function LedgerTab() {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [rangeStart, setRangeStart] = useState(() => calcRange('today')[0]);
  const [rangeEnd, setRangeEnd] = useState(() => calcRange('today')[1]);
  const [summary, setSummary] = useState<{
    grand: { count: number; total_cost: number; base_cost: number; extra_cost: number };
    by_cleaner: CleanerStat2[]; by_property: PropStat2[];
  } | null>(null);
  const [detail, setDetail] = useState<{ cleaner_name: string; records: LedgerRecord[];
    by_week: { week_start: string; count: number; total_cost: number }[]; total_cost: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  const handlePeriodChange = useCallback((p: PeriodKey, start: string, end: string) => {
    setPeriod(p);
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true); setDetail(null);
    const res = await fetch(`${API_URL}/cleaning-records/summary?start=${rangeStart}&end=${rangeEnd}`, { headers: { Authorization: `Bearer ${token}` } });
    setSummary(await res.json());
    setLoading(false);
  }, [rangeStart, rangeEnd, API_URL, token]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const loadCleanerDetail = async (name: string) => {
    const res = await fetch(`${API_URL}/cleaning-records/cleaner/${encodeURIComponent(name)}?start=${rangeStart}&end=${rangeEnd}`, { headers: { Authorization: `Bearer ${token}` } });
    setDetail(await res.json());
  };

  if (loading) return <div className="py-20 text-center text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <PeriodFilter value={period} onChange={handlePeriodChange} />
        {detail && (
          <button onClick={() => setDetail(null)} className="text-sm text-blue-600 hover:text-blue-800 ml-2">← 전체 요약</button>
        )}
      </div>

      {!detail ? (
        <>
          {summary && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{summary.grand.count}</div>
                  <div className="text-xs text-gray-500">총 건수</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{(summary.grand.total_cost / 10000).toFixed(1)}만</div>
                  <div className="text-xs text-gray-500">총 청소비</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{(summary.grand.base_cost / 10000).toFixed(1)}만</div>
                  <div className="text-xs text-gray-500">기본비</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700">{(summary.grand.extra_cost / 10000).toFixed(1)}만</div>
                  <div className="text-xs text-gray-500">추가비</div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">청소자별 내역</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">청소자</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">건수</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">기본비</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">추가비</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">합계</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.by_cleaner.map(c => (
                      <tr key={c.cleaner_name} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadCleanerDetail(c.cleaner_name)}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{c.cleaner_name}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-600">{c.count}건</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-600">{c.base_cost.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-amber-600">{c.extra_cost > 0 ? `+${c.extra_cost.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-semibold text-gray-900">{c.total_cost.toLocaleString()}원</td>
                        <td className="px-4 py-2.5 text-right"><span className="text-xs text-blue-600">상세 →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">숙소별 청소비 TOP</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {summary.by_property.slice(0, 15).map(p => (
                    <div key={p.property_code} className="px-4 py-2 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{p.property_code}</span>
                        <span className="text-sm text-gray-500 ml-2">{p.property_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">{p.total_cost.toLocaleString()}원</span>
                        <span className="text-xs text-gray-400 ml-2">{p.count}건</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* 뒤로가기 + 청소자 요약 */}
          <div className="flex items-center gap-3">
            <button onClick={() => setDetail(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">← 뒤로</button>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{detail.cleaner_name}</h3>
              <p className="text-sm text-gray-500">{detail.records.length}건, {detail.total_cost.toLocaleString()}원</p>
            </div>
          </div>
          {/* 주간 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(detail.by_week || []).map((w, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                <div className="text-xs text-gray-500">{(w.week_start || '').slice(0, 10)} 주</div>
                <div className="text-lg font-bold text-gray-900">{w.total_cost.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{w.count}건</div>
              </div>
            ))}
          </div>
          {/* 상세 테이블 */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">날짜</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">숙소</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">예약 정보</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">정산 금액</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{(r.cleaning_date || '').slice(5, 10)} {r.day_of_week}</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-900">{r.property_code} {r.property_name}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.reservation_code ? (
                        <ReservationPopup
                          guestName={r.guest_name || ''}
                          reservationCode={r.reservation_code || ''}
                          checkIn={r.check_in || ''}
                          cleaningDate={(r.cleaning_date || '').slice(0, 10)}
                          conversationId={r.conversation_id || ''}
                        />
                      ) : (
                        <span className="text-xs text-gray-300">예약 없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.settlement_amount > 0 ? (
                        <a href="/settlement" className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline">
                          {r.settlement_amount.toLocaleString()}원
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{r.total_cost.toLocaleString()}</span>
                      )}
                      {r.settlement_amount > 0 && r.settlement_amount !== r.total_cost && (
                        <div className="text-xs text-amber-600">엑셀:{r.total_cost.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{r.check_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 청소비 대장 → 예약/대화 링크 컴포넌트
function LedgerLink({ recordId }: { recordId: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    property_name: string;
    reservations: { id: number; guest_name: string; conversation_id: string; check_in: string; check_out: string }[];
  } | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  const load = async () => {
    if (data) { setOpen(!open); return; }
    const res = await fetch(`${API_URL}/cleaning-records/linked/${recordId}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    setData(d);
    setOpen(true);
  };

  return (
    <div className="relative">
      <button onClick={load} className="text-xs text-blue-600 hover:text-blue-800">조회</button>
      {open && data && (
        <div className="absolute right-0 top-6 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">{data.property_name?.slice(0, 25)}</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          {data.reservations?.length > 0 ? data.reservations.map(r => (
            <div key={r.id} className="border border-gray-100 rounded p-2 text-xs space-y-1">
              <div className="font-medium text-gray-900">{r.guest_name}</div>
              <div className="text-gray-500">IN {r.check_in} → OUT {r.check_out}</div>
              <div className="flex gap-1">
                <a href={`/reservations?id=${r.id}`} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">예약</a>
                {r.conversation_id && (
                  <a href={`/messages?conv=${r.conversation_id}`} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100">대화</a>
                )}
              </div>
            </div>
          )) : (
            <div className="text-xs text-gray-400">연결된 예약 없음</div>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== 예약 정보 팝업 (공통) =====================
function ReservationPopup({ guestName, reservationCode, checkIn, cleaningDate, conversationId }: {
  guestName: string; reservationCode: string; checkIn: string; cleaningDate: string; conversationId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="text-left group">
        <div className="text-xs font-mono text-blue-700 group-hover:text-blue-900 group-hover:underline">
          {reservationCode}
        </div>
        <div className="text-xs text-gray-500">{guestName ? guestName.slice(0, 15) : ''}{checkIn ? ` · IN ${checkIn.slice(5)}` : ''}</div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">예약 정보</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">게스트</span>
                <span className="font-medium text-gray-900">{guestName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">예약 코드</span>
                <span className="font-mono text-xs text-gray-700">{reservationCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">체크인</span>
                <span className="text-gray-900">{checkIn || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">체크아웃 (청소일)</span>
                <span className="text-gray-900">{cleaningDate}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <a href={`/reservations`}
                className="flex-1 text-center py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                예약 상세
              </a>
              {conversationId ? (
                <a href={`/messages?conv=${conversationId}`}
                  className="flex-1 text-center py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  게스트 대화
                </a>
              ) : (
                <span className="flex-1 text-center py-1.5 text-xs text-gray-400 bg-gray-100 rounded-lg">대화 없음</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== Route Analysis Tab =====================

interface TimeTask {
  order: number;
  task_id: number;
  property_code: string;
  property_name: string;
  address: string;
  region: string;
  cleaning_date: string;
  started_at: string;
  completed_at: string;
  cleaning_minutes: number;
  travel_minutes_to_next: number;
  next_region: string;
  is_cross_region: boolean;
  status: string;
}

interface TimeSummary {
  total_tasks: number;
  completed_tasks: number;
  total_work_minutes: number;
  total_cleaning_minutes: number;
  total_travel_minutes: number;
  efficiency_pct: number;
  avg_cleaning_minutes: number;
  avg_travel_minutes: number;
  cross_region_moves: number;
}

interface CleanerDayAnalysis {
  date: string;
  tasks: TimeTask[];
  summary: TimeSummary;
}

interface CleanerTimeAnalysis {
  cleaner_id: number;
  cleaner_name: string;
  dates: CleanerDayAnalysis[];
}

interface TimeAnalysisResult {
  start_date: string;
  end_date: string;
  cleaners: CleanerTimeAnalysis[];
}

const REGION_COLORS: Record<string, string> = {
  A: "bg-blue-500", A2: "bg-blue-400", B: "bg-emerald-500", GN: "bg-purple-500",
  SD: "bg-orange-500", SD2: "bg-orange-400", V: "bg-pink-500",
};

function RouteAnalysisTab() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [rangeStart, setRangeStart] = useState(() => calcRange("today")[0]);
  const [rangeEnd, setRangeEnd] = useState(() => calcRange("today")[1]);
  const [data, setData] = useState<TimeAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCleaner, setSelectedCleaner] = useState<number>(0);

  const API_URL = import.meta.env.VITE_API_URL;

  const handlePeriodChange = useCallback((p: PeriodKey, start: string, end: string) => {
    setPeriod(p);
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const qs = new URLSearchParams({ start_date: rangeStart, end_date: rangeEnd });
    if (selectedCleaner > 0) qs.set("cleaner_id", String(selectedCleaner));
    fetch(`${API_URL}/cleaning/time-analysis?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [rangeStart, rangeEnd, selectedCleaner]);

  // 전체 요약 집계
  const totalSummary = useMemo(() => {
    if (!data?.cleaners?.length) return null;
    const s = { tasks: 0, completed: 0, cleaning: 0, travel: 0, work: 0, cross: 0, hasTime: 0 };
    for (const c of data.cleaners) {
      for (const d of c.dates) {
        s.tasks += d.summary.total_tasks;
        s.completed += d.summary.completed_tasks;
        s.cleaning += d.summary.total_cleaning_minutes;
        s.travel += d.summary.total_travel_minutes;
        s.work += d.summary.total_work_minutes;
        s.cross += d.summary.cross_region_moves;
        for (const t of d.tasks) {
          if (t.started_at && t.completed_at) s.hasTime++;
        }
      }
    }
    return {
      ...s,
      efficiency: s.work > 0 ? (s.cleaning / s.work) * 100 : 0,
      timeInputRate: s.tasks > 0 ? (s.hasTime / s.tasks) * 100 : 0,
    };
  }, [data]);

  return (
    <div>
      <PeriodFilter value={period} onChange={handlePeriodChange} />

      <div className="mt-3 flex items-center gap-3">
        <select
          value={selectedCleaner}
          onChange={(e) => setSelectedCleaner(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value={0}>전체 청소자</option>
          {data?.cleaners?.map((c) => (
            <option key={c.cleaner_id} value={c.cleaner_id}>{c.cleaner_name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="mt-6 text-center text-gray-400 text-sm">불러오는 중...</div>}

      {!loading && !data?.cleaners?.length && (
        <div className="mt-6 text-center text-gray-400 text-sm">
          해당 기간에 시작/완료 데이터가 있는 청소 기록이 없습니다.
        </div>
      )}

      {/* 전체 요약 카드 */}
      {totalSummary && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MiniCard label="총 업무" value={`${totalSummary.tasks}건`} />
          <MiniCard label="완료" value={`${totalSummary.completed}건`} />
          <MiniCard label="총 청소" value={`${Math.round(totalSummary.cleaning)}분`} />
          <MiniCard label="총 이동" value={`${Math.round(totalSummary.travel)}분`} />
          <MiniCard label="총 업무시간" value={`${Math.round(totalSummary.work)}분`} />
          <MiniCard label="효율" value={`${totalSummary.efficiency.toFixed(1)}%`}
            color={totalSummary.efficiency >= 70 ? "text-green-600" : totalSummary.efficiency >= 50 ? "text-yellow-600" : "text-red-600"} />
          <MiniCard label="권역 이동" value={`${totalSummary.cross}회`} />
        </div>
      )}

      {totalSummary && totalSummary.timeInputRate < 50 && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>시간 데이터 입력률 {totalSummary.timeInputRate.toFixed(0)}%</strong> — 시작/완료 시간이 입력된 건만 분석에 반영됩니다.
          청소자가 앱에서 [시작]/[완료] 버튼을 누르면 정확한 동선 분석이 가능합니다.
        </div>
      )}

      {/* 청소자별 상세 */}
      {data?.cleaners?.map((cleaner) => (
        <div key={cleaner.cleaner_id} className="mt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">{cleaner.cleaner_name}</h3>

          {cleaner.dates.map((day) => (
            <div key={day.date} className="mb-5">
              {data.start_date !== data.end_date && (
                <div className="text-xs font-medium text-gray-500 mb-2">{day.date}</div>
              )}

              {/* 타임라인 바 */}
              <div className="relative mb-3">
                {day.tasks.length > 0 && day.summary.total_work_minutes > 0 && (
                  <div className="flex items-center gap-0.5 h-10 rounded-lg overflow-hidden bg-gray-100">
                    {day.tasks.map((t, i) => {
                      const cleanPct = day.summary.total_work_minutes > 0
                        ? (t.cleaning_minutes / day.summary.total_work_minutes) * 100 : 0;
                      const travelPct = day.summary.total_work_minutes > 0
                        ? (t.travel_minutes_to_next / day.summary.total_work_minutes) * 100 : 0;
                      const regionColor = REGION_COLORS[t.region] || "bg-gray-500";
                      return (
                        <div key={t.task_id} className="flex" style={{ display: "contents" }}>
                          {cleanPct > 0 && (
                            <div
                              className={`${regionColor} relative group cursor-pointer flex items-center justify-center`}
                              style={{ width: `${Math.max(cleanPct, 2)}%` }}
                              title={`${t.property_code} ${t.property_name} — ${Math.round(t.cleaning_minutes)}분`}
                            >
                              <span className="text-[10px] text-white font-medium truncate px-1">
                                {t.property_code}
                              </span>
                            </div>
                          )}
                          {travelPct > 0 && i < day.tasks.length - 1 && (
                            <div
                              className={`${t.is_cross_region ? "bg-red-200" : "bg-gray-200"} flex items-center justify-center`}
                              style={{ width: `${Math.max(travelPct, 1)}%` }}
                              title={`이동 ${Math.round(t.travel_minutes_to_next)}분${t.is_cross_region ? " (권역 이동)" : ""}`}
                            >
                              <span className="text-[9px] text-gray-500">{Math.round(t.travel_minutes_to_next)}m</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 상세 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-1.5 text-left font-medium w-8">#</th>
                      <th className="py-1.5 text-left font-medium">숙소</th>
                      <th className="py-1.5 text-left font-medium">권역</th>
                      <th className="py-1.5 text-center font-medium">시작</th>
                      <th className="py-1.5 text-center font-medium">완료</th>
                      <th className="py-1.5 text-right font-medium">청소</th>
                      <th className="py-1.5 text-right font-medium">이동</th>
                      <th className="py-1.5 text-center font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.tasks.map((t) => (
                      <tr key={t.task_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 text-gray-400">{t.order}</td>
                        <td className="py-1.5">
                          <span className="font-medium text-gray-900">{t.property_code}</span>
                          <span className="ml-1 text-gray-500">{t.property_name}</span>
                        </td>
                        <td className="py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${REGION_COLORS[t.region] || "bg-gray-400"}`}>
                            {t.region}
                          </span>
                          {t.is_cross_region && t.next_region && (
                            <span className="ml-1 text-red-500 text-[10px] font-medium">
                              → {t.next_region}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-center text-gray-700">{t.started_at || "-"}</td>
                        <td className="py-1.5 text-center text-gray-700">{t.completed_at || "-"}</td>
                        <td className="py-1.5 text-right font-medium">
                          {t.cleaning_minutes > 0 ? (
                            <span className={t.cleaning_minutes > 50 ? "text-red-600" : "text-gray-900"}>
                              {Math.round(t.cleaning_minutes)}분
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-1.5 text-right">
                          {t.travel_minutes_to_next > 0 ? (
                            <span className={t.is_cross_region ? "text-red-600 font-medium" : "text-gray-600"}>
                              {Math.round(t.travel_minutes_to_next)}분
                            </span>
                          ) : ""}
                        </td>
                        <td className="py-1.5 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            t.status === "completed" ? "bg-green-100 text-green-700" :
                            t.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                            t.status === "issue" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {CLEANING_STATUS_LABELS[t.status as keyof typeof CLEANING_STATUS_LABELS] || t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 일일 요약 */}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <span>업무 <strong className="text-gray-900">{day.summary.total_tasks}건</strong> (완료 {day.summary.completed_tasks})</span>
                <span>청소 <strong className="text-gray-900">{Math.round(day.summary.total_cleaning_minutes)}분</strong> (평균 {Math.round(day.summary.avg_cleaning_minutes)}분/건)</span>
                <span>이동 <strong className="text-gray-900">{Math.round(day.summary.total_travel_minutes)}분</strong> (평균 {Math.round(day.summary.avg_travel_minutes)}분)</span>
                <span>총 <strong className="text-gray-900">{Math.round(day.summary.total_work_minutes)}분</strong></span>
                <span>효율 <strong className={day.summary.efficiency_pct >= 70 ? "text-green-600" : day.summary.efficiency_pct >= 50 ? "text-yellow-600" : "text-red-600"}>
                  {day.summary.efficiency_pct.toFixed(1)}%
                </strong></span>
                {day.summary.cross_region_moves > 0 && (
                  <span className="text-red-600">권역이동 {day.summary.cross_region_moves}회</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`text-lg font-bold ${color || "text-gray-900"}`}>{value}</div>
    </div>
  );
}
