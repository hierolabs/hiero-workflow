import { useEffect, useState, useCallback } from "react";
import {
  fetchIssues,
  fetchIssueSummary,
  createIssue,
  updateIssueStatus,
  updateIssueAssignee,
  fetchRecentComms,
  createComm,
  ISSUE_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_STYLES,
  ISSUE_PRIORITY_STYLES,
  COMM_TYPE_LABELS,
  type Issue,
  type IssueSummary,
  type CommunicationLog,
} from "../utils/cleaning-api";

type Tab = "issues" | "comms";

export default function Issues() {
  const [tab, setTab] = useState<Tab>("issues");
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">이슈 & 멀티박스</h1>
        <p className="mt-1 text-sm text-gray-500">운영 이슈 추적 및 예약/숙소 기준 응대 기록</p>
      </div>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === "issues"} onClick={() => setTab("issues")}>이슈 트래킹</TabBtn>
        <TabBtn active={tab === "comms"} onClick={() => setTab("comms")}>멀티박스</TabBtn>
      </div>
      {tab === "issues" && <IssuesTab />}
      {tab === "comms" && <CommsTab />}
    </div>
  );
}

// --- Issues Tab ---
function IssuesTab() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusChangeId, setStatusChangeId] = useState<number | null>(null);
  const [assigneeChangeId, setAssigneeChangeId] = useState<number | null>(null);
  const [newAssignee, setNewAssignee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page_size: "50" };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.issue_type = typeFilter;
      const [issueData, summaryData] = await Promise.all([
        fetchIssues(params),
        fetchIssueSummary(),
      ]);
      setIssues(issueData.issues || []);
      setSummary(summaryData);
    } catch { /* */ } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: number, status: string) => {
    try { await updateIssueStatus(id, status); setStatusChangeId(null); load(); }
    catch { alert("상태 변경 실패"); }
  };

  const handleAssigneeChange = async (id: number) => {
    try { await updateIssueAssignee(id, newAssignee); setAssigneeChangeId(null); setNewAssignee(""); load(); }
    catch { alert("담당자 변경 실패"); }
  };

  return (
    <div>
      {/* Summary */}
      {summary && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          <SCard label="전체" value={summary.total} />
          <SCard label="열림" value={summary.open} color="text-red-600" />
          <SCard label="처리 중" value={summary.in_progress} color="text-yellow-600" />
          <SCard label="해결" value={summary.resolved} color="text-green-600" />
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">상태 전체</option>
          {Object.entries(ISSUE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">유형 전체</option>
          {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)}
          className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">+ 이슈 등록</button>
      </div>

      {/* Issue list */}
      {loading ? <div className="py-20 text-center text-gray-500">로딩 중...</div> : (
        <div className="space-y-3">
          {issues.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">이슈가 없습니다.</p>
          ) : issues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ISSUE_PRIORITY_STYLES[issue.priority] || ""}`}>
                      {issue.priority}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ISSUE_STATUS_STYLES[issue.status] || ""}`}>
                      {ISSUE_STATUS_LABELS[issue.status] || issue.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{issue.title}</h3>
                  {issue.description && <p className="mt-1 text-xs text-gray-500">{issue.description}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    {issue.property_code && <span>{issue.property_code} {issue.property_name}</span>}
                    <span>{new Date(issue.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  {/* Assignee */}
                  {assigneeChangeId === issue.id ? (
                    <div className="flex items-center gap-1">
                      <input type="text" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}
                        placeholder="담당자" className="rounded border border-gray-300 px-2 py-1 text-xs w-20" />
                      <button onClick={() => handleAssigneeChange(issue.id)}
                        className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">확인</button>
                      <button onClick={() => setAssigneeChangeId(null)} className="text-xs text-gray-500">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAssigneeChangeId(issue.id); setNewAssignee(issue.assignee_name || ""); }}
                      className="text-xs text-blue-600 hover:underline">
                      {issue.assignee_name || "미배정"}
                    </button>
                  )}
                  {/* Status change */}
                  {statusChangeId === issue.id ? (
                    <div className="flex gap-1">
                      {Object.entries(ISSUE_STATUS_LABELS).map(([k, v]) => (
                        <button key={k} onClick={() => handleStatusChange(issue.id, k)}
                          className={`rounded px-2 py-0.5 text-xs ${k === issue.status ? "bg-slate-900 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                          {v}
                        </button>
                      ))}
                      <button onClick={() => setStatusChangeId(null)} className="text-xs text-gray-500 ml-1">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setStatusChangeId(issue.id)}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
                      상태 변경
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateIssueModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

// --- Create Issue Modal ---
function CreateIssueModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", issue_type: "cleaning", priority: "P2", property_name: "", property_code: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try { await createIssue(form); onSuccess(); }
    catch { alert("이슈 생성 실패"); }
    finally { setLoading(false); }
  };

  return (
    <Modal onClose={onClose} title="이슈 등록">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="제목" required>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="문제 요약" required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="유형">
            <select value={form.issue_type} onChange={(e) => setForm({ ...form, issue_type: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none">
              {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="우선순위">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none">
              <option value="P0">P0 - 즉시</option>
              <option value="P1">P1 - 오늘</option>
              <option value="P2">P2 - 이번 주</option>
              <option value="P3">P3 - 여유</option>
            </select>
          </Field>
        </div>
        <Field label="설명">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="상세 내용"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
          <button type="submit" disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Comms Tab (Multibox) ---
function CommsTab() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try { setLogs(await fetchRecentComms() || []); }
    catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const commStyles: Record<string, string> = {
    note: "border-l-blue-400",
    phone: "border-l-green-400",
    message: "border-l-purple-400",
    visit: "border-l-orange-400",
    issue: "border-l-red-400",
    system: "border-l-gray-300",
  };

  if (loading) return <div className="py-20 text-center text-gray-500">로딩 중...</div>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowAdd(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">+ 기록 추가</button>
      </div>

      {logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">응대 기록이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 ${commStyles[log.comm_type] || "border-l-gray-300"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {COMM_TYPE_LABELS[log.comm_type] || log.comm_type}
                    </span>
                    {log.channel && log.channel !== "system" && (
                      <span className="text-xs text-gray-400">{log.channel}</span>
                    )}
                    {log.property_name && (
                      <span className="text-xs text-gray-500">{log.property_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{log.content}</p>
                </div>
                <div className="text-right text-xs text-gray-400 ml-4 shrink-0">
                  <p>{log.author_name || "시스템"}</p>
                  <p>{new Date(log.created_at).toLocaleString("ko-KR")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddCommModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

// --- Add Communication Modal ---
function AddCommModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ comm_type: "note", content: "", channel: "internal", author_name: "", property_name: "", guest_name: "" });
  const [loading, setLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!form.author_name && user.name) {
    form.author_name = user.name;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setLoading(true);
    try { await createComm(form); onSuccess(); }
    catch { alert("기록 추가 실패"); }
    finally { setLoading(false); }
  };

  return (
    <Modal onClose={onClose} title="응대 기록 추가">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="유형">
            <select value={form.comm_type} onChange={(e) => setForm({ ...form, comm_type: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none">
              <option value="note">메모</option>
              <option value="phone">전화</option>
              <option value="message">메시지</option>
              <option value="visit">현장방문</option>
            </select>
          </Field>
          <Field label="채널">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none">
              <option value="internal">내부</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking</option>
              <option value="phone">전화</option>
              <option value="kakao">카카오톡</option>
            </select>
          </Field>
        </div>
        <Field label="내용" required>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={4} placeholder="응대 내용 기록..." required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="숙소명">
            <input type="text" value={form.property_name} onChange={(e) => setForm({ ...form, property_name: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none" />
          </Field>
          <Field label="게스트명">
            <input type="text" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
          <button type="submit" disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {loading ? "추가 중..." : "추가"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Shared ---
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-slate-900 text-slate-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{children}</button>;
}
function SCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-3 text-center"><p className="text-xs text-gray-500">{label}</p><p className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</p></div>;
}
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"><h2 className="mb-4 text-lg font-bold text-gray-900">{title}</h2>{children}</div>
    </div>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium text-gray-700">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>{children}</div>;
}
