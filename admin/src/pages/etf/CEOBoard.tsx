import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

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

interface Directive {
  id: number;
  type: string;
  from_role: string;
  from_user_name: string;
  to_role: string;
  to_user_name: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  result_memo: string;
  server_analysis: string;
  has_conflict: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-gray-100 text-gray-600',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장',
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

const EXEC_ROLES = [
  { title: '마케팅', roleTitle: 'marketing' },
  { title: '운영', roleTitle: 'operations' },
  { title: '청소배정', roleTitle: 'cleaning_dispatch' },
  { title: '현장', roleTitle: 'field' },
];

const ETF_ROLES = [
  { title: 'CTO', roleTitle: 'cto' },
  { title: 'CFO', roleTitle: 'cfo' },
];

const DIRECTIVE_PRIORITY = [
  { label: '즉시', value: 'urgent', color: 'text-red-600' },
  { label: '오늘', value: 'high', color: 'text-orange-600' },
  { label: '이번 주', value: 'normal', color: 'text-blue-600' },
  { label: '여유', value: 'low', color: 'text-gray-500' },
];

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
  completed: { bg: 'bg-green-100 text-green-700', label: '완료' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
};

export default function CEOBoard() {
  const [data, setData] = useState<CEOData | null>(null);
  const [sentDirectives, setSentDirectives] = useState<Directive[]>([]);
  const [receivedDirectives, setReceivedDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'issues' | 'directive' | 'inbox'>('issues');
  const [showNewDirective, setShowNewDirective] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: number; role_title: string } | null>(null);
  const navigate = useNavigate();

  // 새 지시 폼
  const [newDir, setNewDir] = useState({
    type: 'directive' as string,
    to_role: 'operations',
    title: '',
    content: '',
    priority: 'normal',
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/etf-board/ceo'),
      api.get('/me'),
    ]).then(([ceoRes, meRes]) => {
      setData(ceoRes.data);
      const user = meRes.data;
      setCurrentUser({ id: user.id, role_title: user.role_title });
      // 지시 데이터 로드
      return Promise.all([
        api.get(`/directives/sent?user_id=${user.id}`),
        api.get(`/directives/received?role=${user.role_title}`),
      ]);
    }).then(([sentRes, recvRes]) => {
      setSentDirectives(sentRes.data.directives ?? []);
      setReceivedDirectives(recvRes.data.directives ?? []);
    }).finally(() => setLoading(false));
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
      await api.patch(`/issues/${issueId}/status`, { status: 'resolved', resolution });
      fetchData();
    } catch { alert('해결 처리 실패'); }
  };

  const handleDelegate = async (issueId: number, roleTitle: string, memo: string) => {
    if (!currentUser) return;
    try {
      // 새 directive로 업무지시 생성
      await api.post('/directives', {
        type: 'directive',
        from_user_id: currentUser.id,
        to_role: roleTitle,
        title: memo || '업무 처리 요청',
        content: `원본 이슈 #${issueId}에서 전달됨`,
        priority: 'high',
        issue_id: issueId,
      });
      fetchData();
    } catch { alert('업무지시 실패'); }
  };

  const handleCreateDirective = async () => {
    if (!currentUser || !newDir.title.trim()) return;
    try {
      await api.post('/directives', {
        type: newDir.type,
        from_user_id: currentUser.id,
        to_role: newDir.to_role,
        title: newDir.title,
        content: newDir.content,
        priority: newDir.priority,
      });
      setNewDir({ type: 'directive', to_role: 'operations', title: '', content: '', priority: 'normal' });
      setShowNewDirective(false);
      fetchData();
    } catch { alert('생성 실패'); }
  };

  const handleDirectiveAction = async (id: number, action: 'acknowledge' | 'start' | 'complete' | 'reject', memo?: string) => {
    try {
      if (action === 'complete') {
        await api.patch(`/directives/${id}/complete`, { result_memo: memo || '' });
      } else if (action === 'reject') {
        await api.patch(`/directives/${id}/reject`, { reason: memo || '' });
      } else {
        await api.patch(`/directives/${id}/${action}`);
      }
      fetchData();
    } catch { alert('처리 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">경영 대시보드</button>
          <span>/</span>
          <button onClick={() => navigate('/etf-board')} className="hover:text-gray-600">ETF Board</button>
          <span>/</span>
          <span className="text-gray-600">CEO</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">CEO</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CEO Board</h1>
              <p className="text-sm text-gray-500">경영 전반 · 전체 리드 · 조직 운영 총괄</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewDirective(!showNewDirective)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            + 업무지시
          </button>
        </div>
      </div>

      {/* 새 업무지시 폼 */}
      {showNewDirective && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-900">새 업무지시 / 협의</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">유형</label>
              <select
                value={newDir.type}
                onChange={e => setNewDir(prev => ({ ...prev, type: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="directive">↓ 업무지시 (하위)</option>
                <option value="lateral">↔ 협의 (같은 레벨)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">수신자</label>
              <select
                value={newDir.to_role}
                onChange={e => setNewDir(prev => ({ ...prev, to_role: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                {newDir.type === 'lateral' ? (
                  ETF_ROLES.map(r => <option key={r.roleTitle} value={r.roleTitle}>{r.title}</option>)
                ) : (
                  EXEC_ROLES.map(r => <option key={r.roleTitle} value={r.roleTitle}>{r.title}</option>)
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">우선순위</label>
              <select
                value={newDir.priority}
                onChange={e => setNewDir(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                {DIRECTIVE_PRIORITY.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <input
            type="text"
            value={newDir.title}
            onChange={e => setNewDir(prev => ({ ...prev, title: e.target.value }))}
            placeholder="업무 제목 (예: 이번 주 OTA 가격 10% 인하 검토)"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <textarea
            value={newDir.content}
            onChange={e => setNewDir(prev => ({ ...prev, content: e.target.value }))}
            placeholder="상세 내용 (선택)"
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewDirective(false)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              onClick={handleCreateDirective}
              disabled={!newDir.title.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              전송
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{data.total_open}</div>
              <div className="text-xs text-red-600">병목 업무</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{data.total_delayed}</div>
              <div className="text-xs text-amber-600">지연 업무</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.total_approval}</div>
              <div className="text-xs text-blue-600">승인 대기</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-700">{sentDirectives.filter(d => d.status !== 'completed').length}</div>
              <div className="text-xs text-indigo-600">보낸 지시</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">{receivedDirectives.length}</div>
              <div className="text-xs text-purple-600">받은 보고</div>
            </div>
          </div>

          {/* Tab */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { key: 'issues' as const, label: `이슈 관리 (${data.total_open + data.total_delayed + data.total_approval})` },
              { key: 'directive' as const, label: `보낸 지시 (${sentDirectives.length})` },
              { key: 'inbox' as const, label: `받은 보고 (${receivedDirectives.length})` },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                  activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* === 이슈 관리 탭 === */}
          {activeTab === 'issues' && (
            <>
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
                            <div className="bg-emerald-500 rounded-full h-2 transition-all" style={{ width: `${Math.min(t.completion_rate, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-8">{t.completion_rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <IssueList title="병목 업무 (P0/P1)" issues={data.bottlenecks} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
              <IssueList title="지연 업무 (24시간+)" issues={data.delayed_tasks} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
              <IssueList title="승인 대기" issues={data.approval_pending} onEscalate={handleEscalate} onResolve={handleResolve} onDelegate={handleDelegate} />
            </>
          )}

          {/* === 보낸 지시 탭 === */}
          {activeTab === 'directive' && (
            <div className="space-y-3">
              {sentDirectives.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">
                  보낸 업무지시가 없습니다
                </div>
              ) : (
                sentDirectives.map(d => (
                  <DirectiveCard key={d.id} directive={d} mode="sent" />
                ))
              )}
            </div>
          )}

          {/* === 받은 보고 탭 === */}
          {activeTab === 'inbox' && (
            <div className="space-y-3">
              {receivedDirectives.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">
                  받은 보고/요청이 없습니다
                </div>
              ) : (
                receivedDirectives.map(d => (
                  <DirectiveCard key={d.id} directive={d} mode="received" onAction={handleDirectiveAction} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Directive Card ---
function DirectiveCard({ directive: d, mode, onAction }: {
  directive: Directive;
  mode: 'sent' | 'received';
  onAction?: (id: number, action: 'acknowledge' | 'start' | 'complete' | 'reject', memo?: string) => void;
}) {
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState('');

  const TYPE_ICONS: Record<string, string> = { directive: '↓', report: '↑', lateral: '↔' };
  const TYPE_LABELS: Record<string, string> = { directive: '지시', report: '보고', lateral: '협의' };
  const PRIORITY_DOTS: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-blue-400', low: 'bg-gray-400',
  };

  return (
    <div className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[d.priority] ?? 'bg-gray-400'}`} />
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {TYPE_ICONS[d.type]} {TYPE_LABELS[d.type]}
          </span>
          <span className="text-sm font-medium text-gray-900">{d.title}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
          {STATUS_BADGES[d.status]?.label ?? d.status}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <span>{d.from_user_name} ({ROLE_LABELS[d.from_role]})</span>
        <span className="text-gray-300">→</span>
        <span>{d.to_user_name} ({ROLE_LABELS[d.to_role]})</span>
        <span className="text-gray-300 ml-auto">{d.created_at?.slice(5, 16)}</span>
      </div>

      {d.content && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">{d.content}</div>}
      {d.result_memo && <div className="text-xs text-green-700 bg-green-50 rounded p-2 mb-2">결과: {d.result_memo}</div>}

      {d.server_analysis && (
        <div className={`text-xs rounded p-2 mb-2 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          {d.server_analysis}
        </div>
      )}

      {/* 받은 보고/지시에 대한 액션 */}
      {mode === 'received' && onAction && d.status !== 'completed' && d.status !== 'rejected' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {d.status === 'pending' && (
            <button
              onClick={() => onAction(d.id, 'acknowledge')}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
            >
              확인
            </button>
          )}
          {(d.status === 'acknowledged' || d.status === 'pending') && (
            <button
              onClick={() => onAction(d.id, 'start')}
              className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
            >
              진행 시작
            </button>
          )}
          <button
            onClick={() => setShowMemo(!showMemo)}
            className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
          >
            완료 보고
          </button>
          <button
            onClick={() => {
              const reason = prompt('반려 사유를 입력하세요');
              if (reason) onAction(d.id, 'reject', reason);
            }}
            className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition ml-auto"
          >
            반려
          </button>
        </div>
      )}

      {showMemo && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="완료 메모 (예: 가격 인하 10% 적용 완료)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            onKeyDown={e => {
              if (e.key === 'Enter' && onAction) {
                onAction(d.id, 'complete', memo);
                setShowMemo(false);
                setMemo('');
              }
            }}
            autoFocus
          />
          <button
            onClick={() => {
              if (onAction) onAction(d.id, 'complete', memo);
              setShowMemo(false);
              setMemo('');
            }}
            className="px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
          >
            보고
          </button>
        </div>
      )}
    </div>
  );
}

// --- Issue List (기존 유지) ---
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
                  해결
                </button>
                <button
                  onClick={() => handleAction(iss.id, 'delegate')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    expandedId === iss.id && expandMode === 'delegate'
                      ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  지시
                </button>
                <button
                  onClick={() => onEscalate?.(iss.id)}
                  className="px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                >
                  Founder
                </button>
                <span className="text-xs text-gray-400 ml-1">{iss.created_at?.slice(5, 10)}</span>
              </div>
            </div>

            {expandedId === iss.id && expandMode === 'resolve' && (
              <div className="px-4 pb-4 flex items-center gap-2">
                <input
                  type="text" value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="해결 메모 (예: 가격 인하 완료)"
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  onKeyDown={e => { if (e.key === 'Enter') { onResolve?.(iss.id, memo); setExpandedId(null); setMemo(''); } }}
                  autoFocus
                />
                <button onClick={() => { onResolve?.(iss.id, memo); setExpandedId(null); setMemo(''); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                  확인
                </button>
              </div>
            )}

            {expandedId === iss.id && expandMode === 'delegate' && (
              <div className="px-4 pb-4 flex items-center gap-2">
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2">
                  {EXEC_ROLES.map(r => <option key={r.roleTitle} value={r.roleTitle}>{r.title}</option>)}
                </select>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="지시 내용" autoFocus
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  onKeyDown={e => { if (e.key === 'Enter') { onDelegate?.(iss.id, selectedRole, memo); setExpandedId(null); setMemo(''); } }}
                />
                <button onClick={() => { onDelegate?.(iss.id, selectedRole, memo); setExpandedId(null); setMemo(''); }}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
                  전달
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
