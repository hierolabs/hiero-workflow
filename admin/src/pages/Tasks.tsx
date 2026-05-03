import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api";

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  team: string;
  created_at: string;
  updated_at: string;
}

const TEAMS = [
  { value: "", label: "전체" },
  { value: "sales", label: "영업팀" },
  { value: "cleaning", label: "청소팀" },
  { value: "data", label: "데이터팀" },
  { value: "support", label: "고객응대팀" },
  { value: "tech", label: "기술팀" },
];

const STATUSES = [
  { value: "PENDING", label: "대기", color: "bg-gray-100 text-gray-800" },
  { value: "IN_PROGRESS", label: "진행 중", color: "bg-blue-100 text-blue-800" },
  { value: "COMPLETED", label: "완료", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "취소", color: "bg-red-100 text-red-800" },
];

function getStatusStyle(status: string) {
  return STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-800";
}

function getStatusLabel(status: string) {
  return STATUSES.find((s) => s.value === status)?.label || status;
}

function getTeamLabel(team: string) {
  return TEAMS.find((t) => t.value === team)?.label || team;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await apiRequest("/tasks");
      const data = await res.json();
      if (res.ok) {
        setTasks(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleDelete = async (task: Task) => {
    if (!confirm(`"${task.title}" 태스크를 삭제하시겠습니까?`)) return;

    const res = await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchTasks();
    } else {
      const data = await res.json();
      alert(data.error || "삭제에 실패했습니다");
    }
  };

  const filteredTasks = filterTeam
    ? tasks.filter((t) => t.team === filterTeam)
    : tasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">태스크 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            전체 {filteredTasks.length}개의 태스크가 있습니다.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
        >
          + 태스크 생성
        </button>
      </div>

      {/* Team Filter */}
      <div className="mb-4 flex gap-2">
        {TEAMS.map((team) => (
          <button
            key={team.value}
            onClick={() => setFilterTeam(team.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterTeam === team.value
                ? "bg-slate-900 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {team.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                제목
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                팀
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                생성일
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                  태스크가 없습니다. 새 태스크를 생성해 보세요.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {task.id}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">
                        {task.description}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {getTeamLabel(task.team)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyle(task.status)}`}
                    >
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(task.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowStatusModal(true);
                        }}
                        className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        상태 변경
                      </button>
                      <button
                        onClick={() => handleDelete(task)}
                        className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTasks();
          }}
        />
      )}
      {showStatusModal && selectedTask && (
        <StatusModal
          task={selectedTask}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedTask(null);
          }}
          onSuccess={() => {
            setShowStatusModal(false);
            setSelectedTask(null);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}

/* ---- Create Task Modal ---- */

function CreateTaskModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("sales");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({ title, description, team }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onSuccess();
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="태스크 생성">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <FormField label="제목">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="태스크 제목을 입력하세요"
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="설명">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="태스크 설명 (선택)"
            rows={3}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="팀">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          >
            {TEAMS.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "생성 중..." : "생성"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/* ---- Status Change Modal ---- */

function StatusModal({
  task,
  onClose,
  onSuccess,
}: {
  task: Task;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(task.status);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onSuccess();
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="상태 변경">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <p className="text-sm text-gray-600">
          <span className="font-medium">{task.title}</span>의 상태를 변경합니다.
        </p>
        <FormField label="상태">
          <div className="space-y-2">
            {STATUSES.map((s) => (
              <label
                key={s.value}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                  status === s.value
                    ? "border-slate-900 bg-slate-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s.value}
                  checked={status === s.value}
                  onChange={(e) => setStatus(e.target.value)}
                  className="accent-slate-900"
                />
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}
                >
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading || status === task.status}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "변경 중..." : "변경"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/* ---- Shared components ---- */

function ModalWrapper({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
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

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
