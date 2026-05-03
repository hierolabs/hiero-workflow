import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api";

interface AdminUser {
  id: number;
  login_id: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface CurrentUser {
  id: number;
  login_id: string;
  name: string;
  role: string;
}

function getCurrentUser(): CurrentUser | null {
  const stored = localStorage.getItem("user");
  return stored ? JSON.parse(stored) : null;
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const currentUser = getCurrentUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const fetchUsers = async () => {
    try {
      const res = await apiRequest("/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`"${user.name}" 계정을 삭제하시겠습니까?`)) return;

    const res = await apiRequest(`/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || "삭제에 실패했습니다");
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">관리자 계정</h1>
          <p className="mt-1 text-sm text-gray-500">
            전체 {users.length}명의 관리자가 등록되어 있습니다.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            + 계정 생성
          </button>
        )}
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
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                로그인 ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                역할
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                생성일
              </th>
              {isSuperAdmin && (
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {user.id}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {user.name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {user.login_id}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString("ko-KR")}
                </td>
                {isSuperAdmin && (
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                        className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetModal(true);
                        }}
                        className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        PW 재설정
                      </button>
                      {user.login_id !== "admin" && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
          }}
        />
      )}
      {showEditModal && selectedUser && (
        <EditModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            fetchUsers();
          }}
        />
      )}
      {showResetModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowResetModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isSuperAdmin = role === "super_admin";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isSuperAdmin
          ? "bg-purple-100 text-purple-800"
          : "bg-green-100 text-green-800"
      }`}
    >
      {isSuperAdmin ? "Super Admin" : "Admin"}
    </span>
  );
}

/* ---- Create Modal ---- */

function CreateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({ login_id: loginId, password, name, role }),
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
    <ModalWrapper onClose={onClose} title="관리자 계정 생성">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <FormField label="로그인 ID">
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="비밀번호">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="이름">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="역할">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
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

/* ---- Edit Modal ---- */

function EditModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, role }),
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
    <ModalWrapper onClose={onClose} title="관리자 정보 수정">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <FormField label="로그인 ID">
          <input
            type="text"
            value={user.login_id}
            disabled
            className="block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
          />
        </FormField>
        <FormField label="이름">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
        </FormField>
        <FormField label="역할">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
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
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

/* ---- Reset Password Modal ---- */

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest(`/users/${user.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      alert("비밀번호가 재설정되었습니다");
      onSuccess();
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="비밀번호 재설정">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}
        <p className="text-sm text-gray-600">
          <span className="font-medium">{user.name}</span> ({user.login_id})의
          비밀번호를 재설정합니다.
        </p>
        <FormField label="새 비밀번호">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "재설정 중..." : "재설정"}
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
