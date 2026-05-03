import { useEffect, useState } from "react";
import {
  fetchIssues,
  fetchIssueSummary,
  createIssue,
  updateIssueStatus,
  updateIssueAssignee,
  type Issue,
  type IssueSummary,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_STYLES,
  ISSUE_PRIORITY_STYLES,
} from "../utils/cleaning-api";

export default function Settlement() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [issueRes, summaryRes] = await Promise.all([
        fetchIssues({ issue_type: "settlement", page_size: "50" }),
        fetchIssueSummary(),
      ]);
      setIssues(issueRes.issues || []);
      setSummary(summaryRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: { title: string; description: string; priority: string }) => {
    await createIssue({
      ...data,
      issue_type: "settlement",
    });
    setShowCreate(false);
    load();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await updateIssueStatus(id, status);
    load();
  };

  const handleAssigneeChange = async (id: number, name: string) => {
    await updateIssueAssignee(id, name);
    load();
  };

  // 정산 타입 이슈만 필터
  const settlementIssues = issues.filter(i => i.issue_type === "settlement");

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            미수금, 정산 관련 이슈를 추적합니다
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 정산 이슈 등록
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-5 grid grid-cols-4 gap-3">
          <SummaryCard label="전체" value={settlementIssues.length} />
          <SummaryCard label="열림" value={settlementIssues.filter(i => i.status === "open").length} color="red" />
          <SummaryCard label="처리 중" value={settlementIssues.filter(i => i.status === "in_progress").length} color="yellow" />
          <SummaryCard label="해결" value={settlementIssues.filter(i => i.status === "resolved" || i.status === "closed").length} color="green" />
        </div>
      )}

      {/* Issues List */}
      {loading ? (
        <p className="py-10 text-center text-gray-500">불러오는 중...</p>
      ) : settlementIssues.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-gray-400">정산 관련 이슈가 없습니다</p>
          <p className="mt-1 text-xs text-gray-300">CEO 대시보드에서 미수금 액션을 실행하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">우선순위</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">숙소</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">담당자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록일</th>
              </tr>
            </thead>
            <tbody>
              {settlementIssues.map((issue) => (
                <tr key={issue.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${ISSUE_PRIORITY_STYLES[issue.priority] || "bg-gray-100 text-gray-700"}`}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{issue.title}</p>
                    {issue.description && (
                      <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">{issue.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{issue.property_name || "—"}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={issue.assignee_name}
                      placeholder="담당자"
                      className="w-20 rounded border border-gray-200 px-2 py-1 text-xs"
                      onBlur={(e) => {
                        if (e.target.value !== issue.assignee_name) {
                          handleAssigneeChange(issue.id, e.target.value);
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={issue.status}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                      className={`rounded px-2 py-1 text-xs font-medium ${ISSUE_STATUS_STYLES[issue.status] || ""}`}
                    >
                      {Object.entries(ISSUE_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(issue.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateSettlementModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorCls = {
    red: "text-red-700 bg-red-50",
    yellow: "text-yellow-700 bg-yellow-50",
    green: "text-green-700 bg-green-50",
  }[color || ""] || "text-gray-700 bg-white";

  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${colorCls}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
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
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="미수금 확인, 정산 누락 등"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="상세 내용"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">우선순위</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="P0">P0 (긴급)</option>
              <option value="P1">P1 (오늘)</option>
              <option value="P2">P2 (이번주)</option>
              <option value="P3">P3 (여유)</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">취소</button>
          <button
            onClick={() => title && onCreate({ title, description, priority })}
            disabled={!title}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
