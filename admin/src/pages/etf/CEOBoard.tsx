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
  report_type: string;
  deadline: string | null;
  status: string;
  result_memo: string;
  server_analysis: string;
  has_conflict: boolean;
  revision_count: number;
  verified_by: string;
  verified_at: string | null;
  approval_chain: string;
  current_step: number;
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
  verified: { bg: 'bg-emerald-100 text-emerald-700', label: '확인 완료' },
  reopened: { bg: 'bg-orange-100 text-orange-700', label: '재작업' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
  agreed: { bg: 'bg-teal-100 text-teal-700', label: '합의' },
  countered: { bg: 'bg-amber-100 text-amber-700', label: '대안' },
  escalated: { bg: 'bg-gray-800 text-white', label: '중재 요청' },
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
    deadline: '',
    report_type: '',
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
        deadline: newDir.deadline || undefined,
        report_type: newDir.report_type || undefined,
      });
      setNewDir({ type: 'directive', to_role: 'operations', title: '', content: '', priority: 'normal', deadline: '', report_type: '' });
      setShowNewDirective(false);
      fetchData();
    } catch { alert('생성 실패'); }
  };

  type DirectiveAction = 'acknowledge' | 'start' | 'complete' | 'reject' | 'verify' | 'reopen' | 'approve' | 'request-revision' | 'agree' | 'counter' | 'escalate';

  const handleDirectiveAction = async (id: number, action: DirectiveAction, memo?: string) => {
    try {
      const userName = currentUser ? '김진우' : ''; // CEO 이름
      switch (action) {
        case 'complete':
          await api.patch(`/directives/${id}/complete`, { result_memo: memo || '' });
          break;
        case 'reject':
          await api.patch(`/directives/${id}/reject`, { reason: memo || '' });
          break;
        case 'verify':
          await api.patch(`/directives/${id}/verify`, { user_name: userName });
          break;
        case 'reopen':
          await api.patch(`/directives/${id}/reopen`, { user_name: userName, memo: memo || '' });
          break;
        case 'approve':
          await api.patch(`/directives/${id}/approve`, { user_name: userName, comment: memo || '' });
          break;
        case 'request-revision':
          await api.patch(`/directives/${id}/request-revision`, { user_name: userName, memo: memo || '' });
          break;
        case 'agree':
          await api.patch(`/directives/${id}/agree`, { user_name: userName });
          break;
        case 'counter':
          await api.patch(`/directives/${id}/counter`, { user_name: userName, proposal: memo || '' });
          break;
        case 'escalate':
          await api.patch(`/directives/${id}/escalate`, { user_name: userName, reason: memo || '' });
          break;
        default:
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/etf-board/attendance')}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
            >
              근태 현황
            </button>
            <button
              onClick={() => setShowNewDirective(!showNewDirective)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              + 업무지시
            </button>
          </div>
        </div>
      </div>

      {/* 새 업무지시 폼 */}
      {showNewDirective && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-900">새 업무지시 / 협의</h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">유형</label>
              <select
                value={newDir.type}
                onChange={e => setNewDir(prev => ({ ...prev, type: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="directive">↓ 업무지시 (하위)</option>
                <option value="report">↑ 보고 (상위)</option>
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
                ) : newDir.type === 'report' ? (
                  <option value="founder">Founder</option>
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
            <div>
              <label className="text-xs text-gray-600 mb-1 block">기한</label>
              <input
                type="date"
                value={newDir.deadline}
                onChange={e => setNewDir(prev => ({ ...prev, deadline: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
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

      {data && (() => {
        // === 처리 필요 건 계산 ===
        // 보낸 지시 중 내가 확인해야 하는 건: completed(확인 대기), countered(대안 검토)
        const sentNeedAction = sentDirectives.filter(d =>
          d.status === 'completed' || d.status === 'countered'
        );
        // 받은 것 중 내가 처리해야 하는 건: pending, reopened (아직 액션 안 한 것)
        const recvNeedAction = receivedDirectives.filter(d =>
          ['pending', 'reopened'].includes(d.status)
        );
        const totalNeedAction = sentNeedAction.length + recvNeedAction.length;

        // 보낸 지시 중 기한 초과
        const sentOverdue = sentDirectives.filter(d =>
          d.deadline && new Date(d.deadline) < new Date() &&
          !['completed', 'verified', 'agreed', 'rejected'].includes(d.status)
        );

        return (
        <>
          {/* === 처리 필요 알림 배너 === */}
          {totalNeedAction > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
                  {totalNeedAction}
                </div>
                <div>
                  <div className="text-sm font-semibold text-orange-900">처리 필요한 건이 있습니다</div>
                  <div className="text-xs text-orange-700 flex gap-3 mt-0.5">
                    {sentNeedAction.length > 0 && (
                      <span>보낸 지시 확인 대기 <strong>{sentNeedAction.length}</strong>건</span>
                    )}
                    {recvNeedAction.length > 0 && (
                      <span>받은 보고 처리 대기 <strong>{recvNeedAction.length}</strong>건</span>
                    )}
                    {sentOverdue.length > 0 && (
                      <span className="text-red-600">기한 초과 <strong>{sentOverdue.length}</strong>건</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {sentNeedAction.length > 0 && (
                  <button onClick={() => setActiveTab('directive')}
                    className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition">
                    보낸 지시 확인 →
                  </button>
                )}
                {recvNeedAction.length > 0 && (
                  <button onClick={() => setActiveTab('inbox')}
                    className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition">
                    받은 보고 처리 →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div className={`border rounded-xl p-4 text-center cursor-pointer transition hover:shadow-md ${totalNeedAction > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}
              onClick={() => setActiveTab(sentNeedAction.length > 0 ? 'directive' : 'inbox')}>
              <div className={`text-2xl font-bold ${totalNeedAction > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{totalNeedAction}</div>
              <div className="text-xs text-orange-600 font-medium">처리 필요</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveTab('issues')}>
              <div className="text-2xl font-bold text-red-700">{data.total_open}</div>
              <div className="text-xs text-red-600">병목 업무</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveTab('issues')}>
              <div className="text-2xl font-bold text-amber-700">{data.total_delayed}</div>
              <div className="text-xs text-amber-600">지연 업무</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveTab('issues')}>
              <div className="text-2xl font-bold text-blue-700">{data.total_approval}</div>
              <div className="text-xs text-blue-600">승인 대기</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveTab('directive')}>
              <div className="text-2xl font-bold text-indigo-700">{sentDirectives.length}</div>
              <div className="text-xs text-indigo-600">보낸 지시</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition"
              onClick={() => setActiveTab('inbox')}>
              <div className="text-2xl font-bold text-purple-700">{receivedDirectives.length}</div>
              <div className="text-xs text-purple-600">받은 보고</div>
            </div>
          </div>

          {/* Tab */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { key: 'issues' as const, label: `이슈 관리 (${data.total_open + data.total_delayed + data.total_approval})` },
              { key: 'directive' as const, label: `보낸 지시 ${sentNeedAction.length > 0 ? `(${sentNeedAction.length} 확인 필요)` : `(${sentDirectives.length})`}` },
              { key: 'inbox' as const, label: `받은 보고 ${recvNeedAction.length > 0 ? `(${recvNeedAction.length} 처리 필요)` : `(${receivedDirectives.length})`}` },
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
            <div className="space-y-4">
              {/* 확인 필요 그룹 */}
              {sentNeedAction.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">{sentNeedAction.length}</span>
                    내 확인이 필요한 건
                  </h2>
                  <div className="space-y-2">
                    {sentNeedAction.map(d => (
                      <DirectiveCard key={d.id} directive={d} mode="sent" onAction={handleDirectiveAction} />
                    ))}
                  </div>
                </section>
              )}

              {/* 기한 초과 그룹 */}
              {sentOverdue.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{sentOverdue.length}</span>
                    기한 초과
                  </h2>
                  <div className="space-y-2">
                    {sentOverdue.filter(d => !sentNeedAction.find(a => a.id === d.id)).map(d => (
                      <DirectiveCard key={d.id} directive={d} mode="sent" onAction={handleDirectiveAction} />
                    ))}
                  </div>
                </section>
              )}

              {/* 나머지 지시 */}
              {(() => {
                const actionIds = new Set([...sentNeedAction.map(d => d.id), ...sentOverdue.map(d => d.id)]);
                const rest = sentDirectives.filter(d => !actionIds.has(d.id));
                return rest.length > 0 ? (
                  <section>
                    <h2 className="text-sm font-semibold text-gray-500 mb-2">진행 중 / 완료</h2>
                    <div className="space-y-2">
                      {rest.map(d => (
                        <DirectiveCard key={d.id} directive={d} mode="sent" onAction={handleDirectiveAction} />
                      ))}
                    </div>
                  </section>
                ) : null;
              })()}

              {sentDirectives.length === 0 && (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">
                  보낸 업무지시가 없습니다
                </div>
              )}
            </div>
          )}

          {/* === 받은 보고 탭 === */}
          {activeTab === 'inbox' && (
            <div className="space-y-4">
              {/* 처리 필요 그룹 */}
              {recvNeedAction.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">{recvNeedAction.length}</span>
                    내 처리가 필요한 건
                  </h2>
                  <div className="space-y-2">
                    {recvNeedAction.map(d => (
                      <DirectiveCard key={d.id} directive={d} mode="received" onAction={handleDirectiveAction} />
                    ))}
                  </div>
                </section>
              )}

              {/* 진행 중 */}
              {(() => {
                const inProgress = receivedDirectives.filter(d =>
                  ['acknowledged', 'in_progress'].includes(d.status)
                );
                return inProgress.length > 0 ? (
                  <section>
                    <h2 className="text-sm font-semibold text-purple-600 mb-2">진행 중</h2>
                    <div className="space-y-2">
                      {inProgress.map(d => (
                        <DirectiveCard key={d.id} directive={d} mode="received" onAction={handleDirectiveAction} />
                      ))}
                    </div>
                  </section>
                ) : null;
              })()}

              {/* 완료/기타 */}
              {(() => {
                const done = receivedDirectives.filter(d =>
                  !['pending', 'reopened', 'acknowledged', 'in_progress'].includes(d.status)
                );
                return done.length > 0 ? (
                  <section>
                    <h2 className="text-sm font-semibold text-gray-500 mb-2">완료</h2>
                    <div className="space-y-2">
                      {done.map(d => (
                        <DirectiveCard key={d.id} directive={d} mode="received" onAction={handleDirectiveAction} />
                      ))}
                    </div>
                  </section>
                ) : null;
              })()}

              {receivedDirectives.length === 0 && (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">
                  받은 보고/요청이 없습니다
                </div>
              )}
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}

// --- Directive Card ---
function DirectiveCard({ directive: d, mode, onAction }: {
  directive: Directive;
  mode: 'sent' | 'received';
  onAction?: (id: number, action: string, memo?: string) => void;
}) {
  const [showMemo, setShowMemo] = useState(false);
  const [memoAction, setMemoAction] = useState<string>('complete');
  const [memo, setMemo] = useState('');

  const TYPE_ICONS: Record<string, string> = { directive: '↓', report: '↑', lateral: '↔' };
  const TYPE_LABELS: Record<string, string> = { directive: '지시', report: '보고', lateral: '협의' };
  const PRIORITY_DOTS: Record<string, string> = {
    urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-blue-400', low: 'bg-gray-400',
  };
  const REPORT_TYPE_LABELS: Record<string, string> = {
    daily_ops: '일일 운영', cleaning_summary: '청소 현황', field_incident: '현장 사고',
    cost_report: '비용 보고', escalation: '상향 결재',
  };

  const isOverdue = d.deadline && new Date(d.deadline) < new Date() &&
    !['completed', 'verified', 'agreed', 'rejected'].includes(d.status);

  const openMemoFor = (action: string, placeholder: string) => {
    setMemoAction(action);
    setMemo('');
    setShowMemo(true);
  };

  const submitMemo = () => {
    if (onAction) onAction(d.id, memoAction, memo);
    setShowMemo(false);
    setMemo('');
  };

  const MEMO_PLACEHOLDERS: Record<string, string> = {
    complete: '완료 메모 (예: 가격 인하 10% 적용 완료)',
    reopen: '재작업 사유 (예: 데이터 누락, 재확인 필요)',
    approve: '승인 메모 (선택)',
    'request-revision': '수정 요청 사항',
    counter: '대안 내용',
    escalate: 'Founder 중재 요청 사유',
    reject: '반려 사유',
  };

  return (
    <div className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : isOverdue ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[d.priority] ?? 'bg-gray-400'}`} />
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {TYPE_ICONS[d.type]} {TYPE_LABELS[d.type]}
          </span>
          {d.report_type && (
            <span className="text-xs font-medium bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">
              {REPORT_TYPE_LABELS[d.report_type] || d.report_type}
            </span>
          )}
          <span className="text-sm font-medium text-gray-900">{d.title}</span>
          {d.revision_count > 0 && (
            <span className="text-xs text-orange-500">수정 {d.revision_count}회</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOverdue && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-600 text-white">기한 초과</span>
          )}
          {d.deadline && !isOverdue && (
            <span className="text-xs text-gray-400">~{d.deadline.slice(5, 10)}</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
            {STATUS_BADGES[d.status]?.label ?? d.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <span>{d.from_user_name} ({ROLE_LABELS[d.from_role] || d.from_role})</span>
        <span className="text-gray-300">→</span>
        <span>{d.to_user_name} ({ROLE_LABELS[d.to_role] || d.to_role})</span>
        {d.verified_by && <span className="text-emerald-600 ml-2">확인: {d.verified_by}</span>}
        <span className="text-gray-300 ml-auto">{d.created_at?.slice(5, 16)}</span>
      </div>

      {d.content && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">{d.content}</div>}
      {d.result_memo && (
        <div className={`text-xs rounded p-2 mb-2 ${
          d.status === 'rejected' ? 'bg-red-50 text-red-600' :
          d.status === 'reopened' ? 'bg-orange-50 text-orange-700' :
          'bg-green-50 text-green-700'
        }`}>
          {d.status === 'reopened' ? '수정 요청: ' : '결과: '}{d.result_memo}
        </div>
      )}

      {d.server_analysis && (
        <div className={`text-xs rounded p-2 mb-2 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          {d.server_analysis}
        </div>
      )}

      {/* === 보낸 지시 — 발신자 액션 === */}
      {mode === 'sent' && onAction && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {/* 지시 완료 → 확인/재작업 */}
          {d.type === 'directive' && d.status === 'completed' && (
            <>
              <button onClick={() => onAction(d.id, 'verify')}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition">
                완료 확인
              </button>
              <button onClick={() => openMemoFor('reopen', '')}
                className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition">
                재작업 요청
              </button>
            </>
          )}
          {/* lateral 대안 → 수정하여 재전송 or 중재 */}
          {d.type === 'lateral' && d.status === 'countered' && (
            <>
              <button onClick={() => onAction(d.id, 'agree')}
                className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition">
                대안 수용
              </button>
              <button onClick={() => openMemoFor('escalate', '')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition">
                Founder 중재
              </button>
            </>
          )}
        </div>
      )}

      {/* === 받은 보고/지시 — 수신자 액션 === */}
      {mode === 'received' && onAction && !['verified', 'agreed', 'rejected'].includes(d.status) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {/* 공통: directive 수신자 액션 */}
          {d.type === 'directive' && (
            <>
              {d.status === 'pending' && (
                <button onClick={() => onAction(d.id, 'acknowledge')}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition">
                  확인
                </button>
              )}
              {['pending', 'acknowledged', 'reopened'].includes(d.status) && (
                <button onClick={() => onAction(d.id, 'start')}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition">
                  진행 시작
                </button>
              )}
              {['in_progress', 'acknowledged', 'reopened'].includes(d.status) && (
                <button onClick={() => openMemoFor('complete', '')}
                  className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition">
                  완료 보고
                </button>
              )}
              <button onClick={() => openMemoFor('reject', '')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition ml-auto">
                반려
              </button>
            </>
          )}

          {/* 보고(report) 수신자(상위자) 액션 */}
          {d.type === 'report' && ['pending', 'completed'].includes(d.status) && (
            <>
              <button onClick={() => openMemoFor('approve', '')}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition">
                승인
              </button>
              <button onClick={() => openMemoFor('request-revision', '')}
                className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition">
                수정 요청
              </button>
              <button onClick={() => openMemoFor('reject', '')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition ml-auto">
                반려
              </button>
            </>
          )}

          {/* lateral 수신자 액션 */}
          {d.type === 'lateral' && ['pending', 'acknowledged'].includes(d.status) && (
            <>
              <button onClick={() => onAction(d.id, 'agree')}
                className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition">
                합의
              </button>
              <button onClick={() => openMemoFor('counter', '')}
                className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition">
                대안 제시
              </button>
              <button onClick={() => openMemoFor('escalate', '')}
                className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition ml-auto">
                Founder 중재
              </button>
            </>
          )}
        </div>
      )}

      {/* 메모 입력 영역 */}
      {showMemo && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text" value={memo} onChange={e => setMemo(e.target.value)}
            placeholder={MEMO_PLACEHOLDERS[memoAction] || '메모'}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            onKeyDown={e => { if (e.key === 'Enter') submitMemo(); }}
            autoFocus
          />
          <button onClick={submitMemo}
            className="px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
            전송
          </button>
          <button onClick={() => setShowMemo(false)}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700">
            취소
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
