import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface Issue {
  id: number;
  title: string;
  priority: string;
  status: string;
  issue_type: string;
  assignee_name: string;
  property_name: string;
  created_at: string;
}

interface TeamStat {
  name: string;
  role_title: string;
  open_issues: number;
  resolved_today: number;
  completion_rate: number;
}

interface CEOData {
  bottlenecks: Issue[];
  delayed_tasks: Issue[];
  approval_pending: Issue[];
  team_completion: TeamStat[];
  total_open: number;
  total_delayed: number;
  total_approval: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-gray-100 text-gray-600',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO',
  cto: 'CTO',
  cfo: 'CFO',
  marketing: '마케팅',
  operations: '운영',
  cleaning_dispatch: '청소배정',
  field: '현장',
};

const LAYER_COLORS: Record<string, string> = {
  ceo: 'bg-indigo-100 text-indigo-700',
  cto: 'bg-violet-100 text-violet-700',
  cfo: 'bg-emerald-100 text-emerald-700',
  marketing: 'bg-pink-100 text-pink-700',
  operations: 'bg-amber-100 text-amber-700',
  cleaning_dispatch: 'bg-cyan-100 text-cyan-700',
  field: 'bg-orange-100 text-orange-700',
};

export default function CEOBoard() {
  const [data, setData] = useState<CEOData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/etf-board/ceo').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEscalate = async (issueId: number) => {
    if (!confirm('이 이슈를 Founder에게 에스컬레이트하시겠습니까?')) return;
    try {
      await api.post(`/issues/${issueId}/escalate`);
      fetchData();
    } catch { alert('에스컬레이트 실패'); }
  };

  const handleResolve = async (issueId: number, resolution: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved', resolution }),
      });
      fetchData();
    } catch { alert('해결 처리 실패'); }
  };

  const handleDelegate = async (issueId: number, roleTitle: string, memo: string) => {
    try {
      const token = localStorage.getItem('token');
      // role_title로 사용자 이름 조회 후 assignee 변경
      const usersRes = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const users = await usersRes.json();
      const target = (users.users || users || []).find((u: { role_title: string }) => u.role_title === roleTitle);
      if (!target) { alert('담당자를 찾을 수 없습니다'); return; }

      await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/assignee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignee_name: target.name }),
      });

      // 지시 메모가 있으면 이슈 설명 업데이트 (간단히 새 이슈 코멘트로)
      if (memo) {
        await fetch(`${import.meta.env.VITE_API_URL}/issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: `[업무지시] ${memo}`,
            description: `원본 이슈 #${issueId}에서 전달됨`,
            issue_type: 'other',
            priority: 'P2',
            assignee_name: target.name,
          }),
        });
      }
      fetchData();
    } catch { alert('업무지시 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">경영 대시보드</button>
          <span>/</span>
          <button onClick={() => navigate('/etf-board')} className="hover:text-gray-600">ETF Board</button>
          <span>/</span>
          <span className="text-gray-600">CEO</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CEO</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CEO Board</h1>
            <p className="text-sm text-gray-500">경영 전반 · 전체 리드 · 조직 운영 총괄</p>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{data.total_open}</div>
              <div className="text-sm text-red-600">병목 업무</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{data.total_delayed}</div>
              <div className="text-sm text-amber-600">지연 업무</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.total_approval}</div>
              <div className="text-sm text-blue-600">승인 대기</div>
            </div>
          </div>

          {/* Team Completion */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">팀원별 업무 현황</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y">
              {data.team_completion.map(t => (
                <div key={t.name} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-700">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.name}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${LAYER_COLORS[t.role_title] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[t.role_title] || t.role_title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">미완료 <strong>{t.open_issues}</strong></span>
                    <span className="text-emerald-600">오늘 완료 <strong>{t.resolved_today}</strong></span>
                    <div className="w-20">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-emerald-500 rounded-full h-2 transition-all"
                          style={{ width: `${Math.min(t.completion_rate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-8">{t.completion_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Issue Lists with Escalate */}
          <IssueList title="병목 업무 (P0/P1)" issues={data.bottlenecks} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
          <IssueList title="지연 업무 (24시간+)" issues={data.delayed_tasks} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
          <IssueList title="승인 대기" issues={data.approval_pending} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
        </>
      )}
    </div>
  );
}

const EXEC_ROLES = [
  { title: '마케팅', roleTitle: 'marketing' },
  { title: '운영', roleTitle: 'operations' },
  { title: '청소배정', roleTitle: 'cleaning_dispatch' },
  { title: '현장', roleTitle: 'field' },
];

function IssueList({ title, issues, onEscalate, onResolve, onDelegate }: {
  title: string;
  issues: Issue[];
  onEscalate?: (id: number) => void;
  onResolve?: (id: number, resolution: string) => void;
  onDelegate?: (id: number, roleTitle: string, memo: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandMode, setExpandMode] = useState<'resolve' | 'delegate' | null>(null);
  const [memo, setMemo] = useState('');
  const [selectedRole, setSelectedRole] = useState(EXEC_ROLES[0].roleTitle);

  if (!issues || issues.length === 0) return null;

  const handleAction = (id: number, mode: 'resolve' | 'delegate') => {
    if (expandedId === id && expandMode === mode) {
      setExpandedId(null);
      setExpandMode(null);
      setMemo('');
    } else {
      setExpandedId(id);
      setExpandMode(mode);
      setMemo('');
    }
  };

  const submitResolve = (id: number) => {
    onResolve?.(id, memo);
    setExpandedId(null);
    setMemo('');
  };

  const submitDelegate = (id: number) => {
    onDelegate?.(id, selectedRole, memo);
    setExpandedId(null);
    setMemo('');
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="bg-white border border-gray-200 rounded-xl divide-y">
        {issues.map(iss => (
          <div key={iss.id}>
            <div className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[iss.priority] || 'bg-gray-100'}`}>
                    {iss.priority}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{iss.title}</span>
                </div>
                {iss.property_name && (
                  <div className="text-xs text-gray-500 mt-1">{iss.property_name}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleAction(iss.id, 'resolve')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    expandedId === iss.id && expandMode === 'resolve'
                      ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  ✓ 해결
                </button>
                <button
                  onClick={() => handleAction(iss.id, 'delegate')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    expandedId === iss.id && expandMode === 'delegate'
                      ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  ↓ 지시
                </button>
                <button
                  onClick={() => onEscalate?.(iss.id)}
                  className="px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                >
                  ↑ Founder
                </button>
                <span className="text-xs text-gray-400 ml-1">{iss.created_at?.slice(5, 10)}</span>
              </div>
            </div>

            {/* 해결 인라인 */}
            {expandedId === iss.id && expandMode === 'resolve' && (
              <div className="px-4 pb-4 flex items-center gap-2">
                <input
                  type="text"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="해결 메모 (예: 가격 인하 완료)"
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  onKeyDown={e => e.key === 'Enter' && submitResolve(iss.id)}
                  autoFocus
                />
                <button
                  onClick={() => submitResolve(iss.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  확인
                </button>
              </div>
            )}

            {/* 업무지시 인라인 */}
            {expandedId === iss.id && expandMode === 'delegate' && (
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    {EXEC_ROLES.map(r => (
                      <option key={r.roleTitle} value={r.roleTitle}>{r.title}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="지시 내용 (예: OTA 가격 10% 인하 처리)"
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    onKeyDown={e => e.key === 'Enter' && submitDelegate(iss.id)}
                    autoFocus
                  />
                  <button
                    onClick={() => submitDelegate(iss.id)}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    전달
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
