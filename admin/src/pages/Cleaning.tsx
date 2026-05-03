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
  CLEANING_STATUS_LABELS,
  CLEANING_STATUS_STYLES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  type CleaningTask,
  type CleaningSummary,
  type Cleaner,
} from "../utils/cleaning-api";

type Tab = "tasks" | "cleaners";

export default function Cleaning() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [showManual, setShowManual] = useState(false);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">청소 관리</h1>
          <p className="mt-1 text-sm text-gray-500">체크아웃 기반 청소 업무 배정 및 관리</p>
        </div>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === "tasks"} onClick={() => setTab("tasks")}>오늘 청소</TabBtn>
        <TabBtn active={tab === "cleaners"} onClick={() => setTab("cleaners")}>청소자 관리</TabBtn>
      </div>
      {tab === "tasks" && <TasksTab />}
      {tab === "cleaners" && <CleanersTab />}
      {showManual && <OperationManual page="cleaning" onClose={() => setShowManual(false)} />}
    </div>
  );
}

// --- Tasks Tab ---
function TasksTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [summary, setSummary] = useState<CleaningSummary | null>(null);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState(0);
  const [issueTaskId, setIssueTaskId] = useState<number | null>(null);
  const [issueMemo, setIssueMemo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { cleaning_date: date, page_size: "100" };
      if (statusFilter) params.status = statusFilter;
      const [taskData, summaryData, cleanerData] = await Promise.all([
        fetchCleaningTasks(params),
        fetchCleaningSummary(date),
        fetchCleaners(),
      ]);
      setTasks(taskData.tasks || []);
      setSummary(summaryData);
      setCleaners(cleanerData || []);
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

  return (
    <div>
      {/* Summary + Controls */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
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
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-4 grid grid-cols-6 gap-3">
          <SummaryCard label="전체" value={summary.total} />
          <SummaryCard label="대기" value={summary.pending} color="text-gray-600" />
          <SummaryCard label="배정됨" value={summary.assigned} color="text-blue-600" />
          <SummaryCard label="진행 중" value={summary.in_progress} color="text-yellow-600" />
          <SummaryCard label="완료" value={summary.completed} color="text-green-600" />
          <SummaryCard label="문제" value={summary.issue} color="text-red-600" />
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="py-20 text-center text-gray-500">로딩 중...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>공간</Th>
                <Th>게스트</Th>
                <Th>우선순위</Th>
                <Th>다음 체크인</Th>
                <Th>청소자</Th>
                <Th>상태</Th>
                <ThR>관리</ThR>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">청소 업무가 없습니다.</td></tr>
              ) : tasks.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td>
                    <div>
                      <span className="font-mono text-xs font-semibold text-slate-700">{t.property_code}</span>
                      <p className="text-sm text-gray-900">{t.property_name}</p>
                    </div>
                  </Td>
                  <Td>{t.guest_name || "-"}</Td>
                  <Td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[t.priority] || ""}`}>
                      {PRIORITY_LABELS[t.priority] || t.priority}
                    </span>
                  </Td>
                  <Td>
                    {t.next_check_in ? (
                      <span className={t.next_check_in === t.cleaning_date ? "text-red-600 font-semibold" : "text-gray-600"}>
                        {t.next_check_in}
                        {t.next_check_in === t.cleaning_date && " (당일!)"}
                      </span>
                    ) : <span className="text-gray-400">없음</span>}
                  </Td>
                  <Td>
                    {assigningId === t.id ? (
                      <div className="flex items-center gap-1">
                        <select value={selectedCleanerId} onChange={(e) => setSelectedCleanerId(Number(e.target.value))}
                          className="rounded border border-gray-300 px-1 py-0.5 text-xs">
                          <option value={0}>선택</option>
                          {cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => handleAssign(t.id)} disabled={selectedCleanerId === 0}
                          className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white disabled:opacity-40">확인</button>
                        <button onClick={() => setAssigningId(null)}
                          className="text-xs text-gray-500">취소</button>
                      </div>
                    ) : (
                      t.cleaner_name ? (
                        <span className="text-sm">{t.cleaner_name}</span>
                      ) : (
                        <button onClick={() => { setAssigningId(t.id); setSelectedCleanerId(0); }}
                          className="text-xs text-blue-600 hover:underline">배정</button>
                      )
                    )}
                  </Td>
                  <Td>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CLEANING_STATUS_STYLES[t.status] || ""}`}>
                      {CLEANING_STATUS_LABELS[t.status] || t.status}
                    </span>
                  </Td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {t.status === "assigned" && (
                        <ActionBtn onClick={() => handleStart(t.id)} color="blue">시작</ActionBtn>
                      )}
                      {t.status === "in_progress" && (
                        <>
                          <ActionBtn onClick={() => handleComplete(t.id)} color="green">완료</ActionBtn>
                          <ActionBtn onClick={() => { setIssueTaskId(t.id); setIssueMemo(""); }} color="red">문제</ActionBtn>
                        </>
                      )}
                      {t.status === "pending" && !t.cleaner_id && (
                        <ActionBtn onClick={() => { setAssigningId(t.id); setSelectedCleanerId(0); }} color="blue">배정</ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue report modal */}
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

// --- Cleaners Tab ---
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
        <p className="text-sm text-gray-500">{cleaners.length}명의 청소자</p>
        <button onClick={() => setShowForm(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">+ 청소자 등록</button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr><Th>이름</Th><Th>전화번호</Th><Th>담당 지역</Th><Th>메모</Th><ThR>관리</ThR></tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cleaners.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td><span className="font-medium">{c.name}</span></Td>
                <Td>{c.phone || "-"}</Td>
                <Td>{c.region || "-"}</Td>
                <Td>{c.memo || "-"}</Td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(c)}
                    className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">삭제</button>
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

// --- Shared ---
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-slate-900 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{children}</button>;
}
function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-3 text-center"><p className="text-xs text-gray-500">{label}</p><p className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</p></div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{children}</th>;
}
function ThR({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{children}</td>;
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
