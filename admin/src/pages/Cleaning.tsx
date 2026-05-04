import { useEffect, useState, useCallback } from "react";
import OperationManual from "../components/OperationManual";
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

type Tab = "dashboard" | "cleaners" | "codes";

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
        <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>배정 대시보드</TabBtn>
        <TabBtn active={tab === "cleaners"} onClick={() => setTab("cleaners")}>청소자 관리</TabBtn>
        <TabBtn active={tab === "codes"} onClick={() => setTab("codes")}>청소코드</TabBtn>
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "cleaners" && <CleanersTab />}
      {tab === "codes" && <CodesTab />}
      {showManual && <OperationManual page="cleaning" onClose={() => setShowManual(false)} />}
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
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [summary, setSummary] = useState<CleaningSummary | null>(null);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [workload, setWorkload] = useState<CleanerWorkload[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState(0);
  const [issueTaskId, setIssueTaskId] = useState<number | null>(null);
  const [issueMemo, setIssueMemo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "region">("region");

  const API_URL = import.meta.env.VITE_API_URL;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { cleaning_date: date, page_size: "200" };
      if (statusFilter) params.status = statusFilter;
      const token = localStorage.getItem("token");
      const [taskData, summaryData, cleanerData, workloadData, extRes] = await Promise.all([
        fetchCleaningTasks(params),
        fetchCleaningSummary(date),
        fetchCleaners(),
        fetchCleanerWorkload(date),
        fetch(`${API_URL}/cleaning/extensions?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
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
  }, [date, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCleaningTasks(date);
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

  const handleComplete = async (taskId: number) => {
    try { await completeCleaning(taskId); load(); } catch { alert("완료 처리 실패"); }
  };

  const handleReportIssue = async () => {
    if (!issueTaskId || !issueMemo.trim()) return;
    try {
      await reportCleaningIssue(issueTaskId, issueMemo);
      setIssueTaskId(null);
      setIssueMemo("");
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
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button onClick={handleGenerate} disabled={generating}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {generating ? "생성 중..." : "청소 업무 생성"}
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
                      onAssignConfirm={handleAssign}
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
                  onAssignConfirm={handleAssign}
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
        <Modal onClose={() => setIssueTaskId(null)} title="문제 등록">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">문제 내용</label>
              <textarea value={issueMemo} onChange={(e) => setIssueMemo(e.target.value)}
                rows={4} placeholder="TV 고장, 침구 부족, 파손, 심한 오염 등..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIssueTaskId(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
              <button onClick={handleReportIssue} disabled={!issueMemo.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">문제 등록</button>
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
  onStart, onComplete, onIssue }: {
  task: CleaningTask; cleaners: Cleaner[];
  assigningId: number | null; selectedCleanerId: number;
  onAssignStart: (id: number) => void; onAssignCancel: () => void;
  onAssignConfirm: (id: number) => void; onCleanerSelect: (id: number) => void;
  onStart: (id: number) => void; onComplete: (id: number) => void;
  onIssue: (id: number) => void;
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
