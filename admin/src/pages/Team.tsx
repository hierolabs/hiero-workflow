import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AiAgentPanel from '../components/AiAgentPanel';

const API_URL = import.meta.env.VITE_API_URL;

interface TeamMemberStat {
  user_id: number;
  name: string;
  login_id: string;
  role_title: string;
  role_layer: string;
  stats: {
    open_issues: number;
    resolved_today: number;
    resolved_week: number;
    resolved_month: number;
    escalated_up: number;
    delegated_down: number;
    avg_resolve_hours: number;
    activity_week: number;
    unread_notifications: number;
  };
}

interface ActivityLog {
  id: number;
  user_name: string;
  action: string;
  target_type: string;
  detail: string;
  created_at: string;
}

interface Directive {
  id: number;
  type: string;
  from_role: string;
  from_user_name: string;
  from_user_id: number;
  to_role: string;
  to_user_name: string;
  to_user_id: number;
  title: string;
  content: string;
  priority: string;
  status: string;
  deadline: string | null;
  result_memo: string;
  has_conflict: boolean;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-700' },
  acknowledged: { label: '확인', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '진행', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  verified: { label: '확인완료', color: 'bg-emerald-100 text-emerald-700' },
  reopened: { label: '재작업', color: 'bg-orange-100 text-orange-700' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-700' },
  agreed: { label: '합의', color: 'bg-teal-100 text-teal-700' },
  countered: { label: '대안', color: 'bg-amber-100 text-amber-700' },
  escalated: { label: '중재', color: 'bg-gray-800 text-white' },
};

const TYPE_ARROWS: Record<string, string> = { directive: '↓', report: '↑', lateral: '↔' };

// 온톨로지 기준 역할 정의
const ROLE_ONTOLOGY: Record<string, {
  label: string;
  layer: string;
  layerLabel: string;
  color: string;
  bgCard: string;
  responsibilities: string[];
  permissions: string[];
  escalationTo: string;
  domains: string[];
  kpiTargets: { label: string; target: string }[];
  escalationFrom: string[];
  report: string;
}> = {
  founder: {
    label: 'Founder', layer: 'founder', layerLabel: 'Founder / GOT',
    color: 'bg-gray-900 text-white', bgCard: 'border-gray-900 bg-gray-50',
    responsibilities: ['GOT 관리', 'ETF 관리', '상위 전략', '핵심 방향성', '최종 의사결정'],
    permissions: ['dashboard.all', 'final_decision.manage', 'etf.manage', 'strategy.manage'],
    escalationTo: '-', domains: ['전체 OS'],
    kpiTargets: [{ label: '의사결정', target: '일 3건 이내' }],
    escalationFrom: ['CEO', 'CTO', 'CFO'],
    report: '-',
  },
  ceo: {
    label: 'CEO', layer: 'etf', layerLabel: 'ETF',
    color: 'bg-indigo-100 text-indigo-800', bgCard: 'border-indigo-300 bg-indigo-50/50',
    responsibilities: ['경영 전반', '전체 리드', '조직 운영 총괄', '팀 병목 관리', '우선순위 조정'],
    permissions: ['people.manage', 'operations.manage', 'task.assign', 'growth.manage'],
    escalationTo: 'Founder', domains: ['People OS', 'Operations OS', 'Growth OS'],
    kpiTargets: [
      { label: '가동률', target: '≥ 75%' },
      { label: 'ADR', target: '≥ 65,000원' },
      { label: '이슈 해결률', target: '≥ 85%' },
      { label: '평균 해결시간', target: '≤ 12h' },
      { label: '청소 완료율', target: '≥ 95%' },
      { label: '리드 전환율', target: '≥ 20%' },
    ],
    escalationFrom: ['운영', '청소배정', '현장', '마케팅'],
    report: '월간 경영 보고서',
  },
  cto: {
    label: 'CTO', layer: 'etf', layerLabel: 'ETF',
    color: 'bg-violet-100 text-violet-800', bgCard: 'border-violet-300 bg-violet-50/50',
    responsibilities: ['기술 총괄', '도시계획의 가치', '기록', '연구', '실천 방법'],
    permissions: ['knowledge.manage', 'research.manage', 'documentation.manage', 'message.review'],
    escalationTo: 'Founder', domains: ['Knowledge OS', 'Research', 'MORO'],
    kpiTargets: [
      { label: '블로그', target: '≥ 12건/월' },
      { label: '에세이', target: '≥ 4건/월' },
      { label: '문서화율', target: '≥ 90%' },
      { label: '기술부채 해결', target: '≥ 3건/월' },
      { label: 'AI Level', target: '월 +0.5' },
    ],
    escalationFrom: ['마케팅 (메시지)', '현장 (사진)'],
    report: '월간 연구 보고서',
  },
  cfo: {
    label: 'CFO', layer: 'etf', layerLabel: 'ETF',
    color: 'bg-emerald-100 text-emerald-800', bgCard: 'border-emerald-300 bg-emerald-50/50',
    responsibilities: ['정산', '재무', '회계', '세무', '파트너십', '내부 인력 응원'],
    permissions: ['finance.view', 'settlement.edit', 'tax.review', 'partner.manage'],
    escalationTo: 'Founder', domains: ['Money OS', 'Settlement', 'Tax'],
    kpiTargets: [
      { label: '순이익률', target: '≥ 25%' },
      { label: '미정산', target: '≤ 5건' },
      { label: '정산 완료율', target: '≥ 95%' },
      { label: '입금 정확도', target: '≥ 90%' },
      { label: '세무 제출', target: '매월 10일 전' },
      { label: '미수금 회수', target: '≥ 90%' },
    ],
    escalationFrom: ['청소배정 (추가비)', '현장 (수리비)', '운영 (환불)'],
    report: '월간 재무 보고서 + 세무 신고 자료',
  },
  marketing: {
    label: '마케팅', layer: 'execution', layerLabel: 'Execution',
    color: 'bg-pink-100 text-pink-800', bgCard: 'border-pink-200 bg-pink-50/30',
    responsibilities: ['마케팅', '디자인', '외부영업', '리드', '제안서'],
    permissions: ['lead.manage', 'content.edit', 'proposal.create'],
    escalationTo: 'CEO / CTO', domains: ['Growth OS'],
    kpiTargets: [{ label: '리드 생성', target: '≥ 10건/월' }, { label: '제안서 발송', target: '≥ 5건/월' }],
    escalationFrom: [],
    report: '-',
  },
  operations: {
    label: '운영', layer: 'execution', layerLabel: 'Execution',
    color: 'bg-amber-100 text-amber-800', bgCard: 'border-amber-200 bg-amber-50/30',
    responsibilities: ['예약', '운영', '고객 CS', '체크인/아웃'],
    permissions: ['reservation.manage', 'cs.manage', 'checkin.manage'],
    escalationTo: 'CEO', domains: ['Operations OS'],
    kpiTargets: [{ label: 'CS 응답', target: '≤ 1시간' }, { label: '체크인 문제', target: '0건/주' }],
    escalationFrom: [],
    report: '-',
  },
  cleaning_dispatch: {
    label: '청소배정', layer: 'execution', layerLabel: 'Execution',
    color: 'bg-cyan-100 text-cyan-800', bgCard: 'border-cyan-200 bg-cyan-50/30',
    responsibilities: ['청소 배정', '완료 확인', '사진 확인', '추가비'],
    permissions: ['cleaning.assign', 'cleaning.view', 'photo.review'],
    escalationTo: 'CEO / CFO', domains: ['Operations OS (청소)'],
    kpiTargets: [{ label: '배정 완료', target: '≤ 30분' }, { label: '사진 누락', target: '≤ 2%' }],
    escalationFrom: [],
    report: '-',
  },
  field: {
    label: '현장', layer: 'execution', layerLabel: 'Execution',
    color: 'bg-orange-100 text-orange-800', bgCard: 'border-orange-200 bg-orange-50/30',
    responsibilities: ['현장 민원', '숙소 세팅', '데이터 정비', '시설 이슈'],
    permissions: ['property.edit', 'facility.manage', 'setup.manage'],
    escalationTo: 'CEO / CFO', domains: ['Property OS'],
    kpiTargets: [{ label: '세팅 완료', target: '≤ 3일' }, { label: '민원 해결', target: '≤ 24h' }],
    escalationFrom: [],
    report: '-',
  },
};

const LAYER_ORDER = ['founder', 'etf', 'execution'];
const ACTION_LABELS: Record<string, string> = {
  issue_created: '이슈 생성', issue_assigned: '배정', issue_escalated: '에스컬레이트',
  issue_resolved: '해결', issue_delegated: '업무지시', status_changed: '상태 변경',
};

function KpiBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface AttendanceUser {
  user_id: number;
  user_name: string;
  role_title: string;
  login_at: string;
  last_seen?: string;
  duration?: number;
  is_online: boolean;
}

export default function Team() {
  const [members, setMembers] = useState<TeamMemberStat[]>([]);
  const [attendance, setAttendance] = useState<AttendanceUser[]>([]);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ name: string } | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [sendTo, setSendTo] = useState<{ role: string; name: string } | null>(null);
  const [newDir, setNewDir] = useState({ type: 'directive', title: '', content: '', priority: 'normal' });
  const [detailModal, setDetailModal] = useState<Directive | null>(null);
  const [actionMemo, setActionMemo] = useState('');
  const navigate = useNavigate();

  const fetchAll = () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const safeFetch = (url: string) => fetch(url, { headers }).then(r => r.json()).catch(() => null);
    Promise.all([
      safeFetch(`${API_URL}/users/team-stats`),
      safeFetch(`${API_URL}/attendance/today`),
      safeFetch(`${API_URL}/directives`),
    ]).then(([statsData, attendData, dirData]) => {
      setMembers(Array.isArray(statsData) ? statsData : []);
      setAttendance(attendData?.users || []);
      setDirectives(dirData?.directives || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // 현재 로그인 사용자
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  const handleSendDirective = async () => {
    if (!sendTo || !newDir.title.trim()) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/directives`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newDir.type,
          from_user_id: currentUser.id,
          to_role: sendTo.role,
          title: newDir.title,
          content: newDir.content,
          priority: newDir.priority,
        }),
      });
      setSendTo(null);
      setNewDir({ type: 'directive', title: '', content: '', priority: 'normal' });
      fetchAll();
    } catch { alert('전송 실패'); }
  };

  const handleDirectiveAction = async (id: number, action: string, memo?: string) => {
    const token = localStorage.getItem('token');
    const body: Record<string, string> = {};
    if (action === 'complete') body.result_memo = memo || '';
    else if (action === 'reject') body.reason = memo || '';
    else if (action === 'verify' || action === 'agree') body.user_name = currentUser.name || '';
    else if (action === 'reopen') { body.user_name = currentUser.name || ''; body.memo = memo || ''; }
    else if (action === 'approve') { body.user_name = currentUser.name || ''; body.comment = memo || ''; }

    await fetch(`${API_URL}/directives/${id}/${action}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchAll();
  };

  // 지시 전달 (기존 지시를 다른 역할에게 새 지시로 생성)
  const handleSendDirective_forward = async (original: Directive, toRole: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/directives`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'directive',
          from_user_id: currentUser.id,
          to_role: toRole,
          title: `[전달] ${original.title}`,
          content: `원본: ${original.from_user_name}(${original.from_role}) → ${original.to_user_name}(${original.to_role})\n\n${original.content || original.title}`,
          priority: original.priority,
          parent_id: original.id,
        }),
      });
      setDetailModal(null);
      fetchAll();
    } catch { alert('전달 실패'); }
  };

  const [memberAttendance, setMemberAttendance] = useState<{ login_at: string; logout_at: string | null; duration: number }[]>([]);

  const openLogModal = async (name: string) => {
    setLogModal({ name });
    const token = localStorage.getItem('token');
    // 업무 로그 + 근태 이력 동시 조회
    const [logRes, attRes] = await Promise.all([
      fetch(`${API_URL}/activity-logs?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/attendance/report?start=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&end=${new Date().toISOString().slice(0, 10)}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const logData = await logRes.json();
    const attData = await attRes.json();
    setLogs((logData.logs || []).filter((l: ActivityLog) => l.user_name === name));
    // 근태 데이터에서 해당 팀원 필터
    const member = members.find(m => m.name === name);
    if (member && attData.attendance) {
      setMemberAttendance(
        (attData.attendance as { user_id: number; login_at: string; logout_at: string | null; duration: number }[])
          .filter(a => a.user_id === member.user_id)
          .slice(0, 14)
      );
    } else {
      setMemberAttendance([]);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const grouped = LAYER_ORDER.map(layer => ({
    layer,
    label: layer === 'founder' ? 'Founder / GOT' : layer === 'etf' ? 'ETF / Executive' : 'Execution',
    members: members.filter(m => m.role_layer === layer),
  })).filter(g => g.members.length > 0);

  const selectedOntology = selectedRole ? ROLE_ONTOLOGY[selectedRole] : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀 관리</h1>
        <p className="text-sm text-gray-500 mt-1">조직 온톨로지 · 역할 · 권한 · KPI · 업무 통계</p>
      </div>

      {/* 오늘 근태 현황 */}
      {attendance.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">오늘 접속 현황</h2>
          <div className="flex flex-wrap gap-2">
            {members.map(m => {
              const att = attendance.find(a => a.user_id === m.user_id);
              const onto = ROLE_ONTOLOGY[m.role_title];
              return (
                <div key={m.user_id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${att ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50 opacity-50'}`}>
                  <span className={`w-2 h-2 rounded-full ${att ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-900">{onto?.label || m.role_title}</span>
                  {att && <span className="text-xs text-gray-500">{new Date(att.login_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}~</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 역할 상세 (선택 시) */}
      {selectedOntology && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${selectedOntology.color}`}>{selectedOntology.label}</span>
              <span className="text-xs text-gray-400">{selectedOntology.layerLabel} · ↑ {selectedOntology.escalationTo}</span>
            </div>
            <button onClick={() => setSelectedRole(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">책임</h3>
              {selectedOntology.responsibilities.map(r => (
                <div key={r} className="flex items-center gap-1.5 text-gray-700 mb-1">
                  <span className="w-1 h-1 rounded-full bg-gray-400" />{r}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">KPI 목표</h3>
              <div className="space-y-1">
                {selectedOntology.kpiTargets.map(k => (
                  <div key={k.label} className="flex justify-between text-xs">
                    <span className="text-gray-600">{k.label}</span>
                    <span className="font-mono font-medium text-gray-800">{k.target}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">권한</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedOntology.permissions.map(p => (
                  <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">{p}</span>
                ))}
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">소유 도메인</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedOntology.domains.map(d => {
                  const domainRoutes: Record<string, string> = {
                    '전체 OS': '/', 'People OS': '/team', 'Operations OS': '/issues',
                    'Growth OS': '/leads', 'Knowledge OS': '/wiki', 'Research': '/wiki',
                    'MORO': '/wiki', 'Money OS': '/settlement', 'Settlement': '/settlement',
                    'Tax': '/settlement', 'Operations OS (청소)': '/cleaning', 'Property OS': '/properties',
                  };
                  const route = domainRoutes[d];
                  return route ? (
                    <span key={d} className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100 transition"
                      onClick={() => navigate(route)}>{d} →</span>
                  ) : (
                    <span key={d} className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{d}</span>
                  );
                })}
              </div>
              {selectedOntology.escalationFrom.length > 0 && (
                <>
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">에스컬레이션 수신</h3>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {selectedOntology.escalationFrom.map(e => (
                      <span key={e} className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700">← {e}</span>
                    ))}
                  </div>
                </>
              )}
              {selectedOntology.report !== '-' && (
                <>
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">월간 보고서</h3>
                  <span className="px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-700">{selectedOntology.report}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 레이어별 카드 그리드 */}
      {grouped.map(g => (
        <div key={g.layer} className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{g.label}</h2>
          <div className={`grid gap-4 ${g.members.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
            {g.members.map(m => {
              const onto = ROLE_ONTOLOGY[m.role_title];
              const maxResolved = Math.max(...members.map(x => x.stats.resolved_week), 1);
              return (
                <div key={m.user_id} className={`border rounded-xl p-4 transition hover:shadow-md ${onto?.bgCard || 'border-gray-200 bg-white'}`}>
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <button onClick={() => setSelectedRole(selectedRole === m.role_title ? null : m.role_title)}
                        className={`px-2 py-0.5 rounded text-xs font-bold ${onto?.color || 'bg-gray-100'}`}>
                        {onto?.label || m.role_title}
                      </button>
                      <div className="text-sm font-semibold text-gray-900 mt-1 cursor-pointer hover:text-blue-600" onClick={(e) => { e.stopPropagation(); openLogModal(m.name); }}>{m.name}</div>
                    </div>
                    {m.stats.unread_notifications > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {m.stats.unread_notifications}
                      </span>
                    )}
                  </div>

                  {/* KPI — 클릭 드릴다운 */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => navigate(`/issues?assignee=${encodeURIComponent(m.name)}&status=open`)}>
                      <span className="text-gray-500">미처리</span>
                      <span className={`font-bold ${m.stats.open_issues > 3 ? 'text-red-600' : m.stats.open_issues > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {m.stats.open_issues}건 →
                      </span>
                    </div>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => navigate(`/issues?assignee=${encodeURIComponent(m.name)}&status=resolved&period=today`)}>
                      <span className="text-gray-500">오늘 해결</span>
                      <span className="font-medium text-emerald-600">{m.stats.resolved_today}건 →</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => navigate(`/issues?assignee=${encodeURIComponent(m.name)}&status=resolved&period=week`)}>
                      <span className="text-gray-500">주간 해결</span>
                      <div className="flex items-center gap-2">
                        <KpiBar value={m.stats.resolved_week} max={maxResolved} color="bg-blue-500" />
                        <span className="font-medium text-gray-700 w-8 text-right">{m.stats.resolved_week}건</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">평균 해결</span>
                      <span className={`font-medium ${m.stats.avg_resolve_hours > 24 ? 'text-red-600' : 'text-gray-700'}`}>
                        {m.stats.avg_resolve_hours > 0 ? `${m.stats.avg_resolve_hours}h` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => navigate(`/issues?assignee=${encodeURIComponent(m.name)}&action=escalated`)}>
                      <span className="text-gray-500">↑ 에스컬레이트</span>
                      <span className="font-medium text-gray-600">{m.stats.escalated_up}건 →</span>
                    </div>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => navigate(`/issues?assignee=${encodeURIComponent(m.name)}&action=delegated`)}>
                      <span className="text-gray-500">↓ 업무지시</span>
                      <span className="font-medium text-gray-600">{m.stats.delegated_down}건 →</span>
                    </div>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100/60 rounded px-1 -mx-1 py-0.5"
                      onClick={() => openLogModal(m.name)}>
                      <span className="text-gray-500">주간 활동</span>
                      <span className="font-medium text-gray-700">{m.stats.activity_week}건 →</span>
                    </div>
                  </div>

                  {/* 이 사람 관련 활성 지시/보고 — 클릭하면 상세 모달 */}
                  {(() => {
                    const active = directives.filter(d =>
                      (d.to_role === m.role_title || d.from_role === m.role_title) &&
                      !['verified', 'agreed', 'rejected'].includes(d.status)
                    );
                    return active.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-gray-200/60 space-y-1">
                        {active.slice(0, 3).map(d => (
                          <div key={d.id}
                            onClick={() => setDetailModal(d)}
                            className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-100/80 rounded px-1 py-1 -mx-1 transition">
                            <span className="text-gray-400">{TYPE_ARROWS[d.type]}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_LABELS[d.status]?.color || 'bg-gray-100'}`}>
                              {STATUS_LABELS[d.status]?.label || d.status}
                            </span>
                            <span className="text-gray-700 truncate flex-1 font-medium">{d.title}</span>
                            <span className="text-gray-400">→</span>
                          </div>
                        ))}
                        {active.length > 3 && (
                          <div className="text-xs text-indigo-600 text-center cursor-pointer hover:underline"
                            onClick={() => setDetailModal(active[0])}>
                            +{active.length - 3}건 더보기
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200/60">
                    {m.user_id !== currentUser.id && (
                      <button
                        onClick={() => setSendTo({ role: m.role_title, name: m.name })}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        지시/보고
                      </button>
                    )}
                    <button
                      onClick={() => openLogModal(m.name)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      로그
                    </button>
                    <button
                      onClick={() => setSelectedRole(m.role_title)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      권한
                    </button>
                  </div>

                  {/* 인라인 지시/보고 폼 */}
                  {sendTo?.role === m.role_title && (
                    <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                      <div className="flex gap-2">
                        <select value={newDir.type} onChange={e => setNewDir(prev => ({ ...prev, type: e.target.value }))}
                          className="text-[11px] border border-gray-300 rounded px-2 py-1">
                          <option value="directive">↓ 지시</option>
                          <option value="report">↑ 보고</option>
                          <option value="lateral">↔ 협의</option>
                        </select>
                        <select value={newDir.priority} onChange={e => setNewDir(prev => ({ ...prev, priority: e.target.value }))}
                          className="text-[11px] border border-gray-300 rounded px-2 py-1">
                          <option value="urgent">즉시</option>
                          <option value="high">오늘</option>
                          <option value="normal">이번주</option>
                          <option value="low">여유</option>
                        </select>
                      </div>
                      <input type="text" value={newDir.title} onChange={e => setNewDir(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="제목" className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                        onKeyDown={e => { if (e.key === 'Enter') handleSendDirective(); }} autoFocus />
                      <div className="flex gap-1.5">
                        <button onClick={handleSendDirective} disabled={!newDir.title.trim()}
                          className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                          전송
                        </button>
                        <button onClick={() => setSendTo(null)}
                          className="px-3 py-1 text-[10px] text-gray-500 hover:text-gray-700">
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* === 활성 지시/보고 흐름 === */}
      {(() => {
        const active = directives.filter(d => !['verified', 'agreed', 'rejected'].includes(d.status));
        if (active.length === 0) return null;
        const needMyAction = active.filter(d =>
          ((d.to_user_id === currentUser.id || d.to_role === currentUser.role_title) && ['pending', 'reopened'].includes(d.status)) ||
          ((d.from_user_id === currentUser.id || d.from_role === currentUser.role_title) && ['completed', 'countered'].includes(d.status))
        );
        return (
          <div className="mb-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              활성 지시/보고 흐름 ({active.length}건)
              {needMyAction.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white rounded-full text-[10px] normal-case">
                  내 처리 {needMyAction.length}건
                </span>
              )}
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y">
              {/* 처리 필요 건 먼저 */}
              {needMyAction.map(d => (
                <div key={d.id} onClick={() => setDetailModal(d)}
                  className="flex items-center gap-3 p-3 bg-orange-50 cursor-pointer hover:bg-orange-100 transition">
                  <span className="text-xs text-gray-400">{TYPE_ARROWS[d.type]}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_LABELS[d.status]?.color || 'bg-gray-100'}`}>
                    {STATUS_LABELS[d.status]?.label}
                  </span>
                  <span className="text-xs font-medium text-gray-800">{d.from_user_name}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-xs font-medium text-gray-800">{d.to_user_name}</span>
                  <span className="text-xs text-gray-700 flex-1 truncate font-medium">{d.title}</span>
                  {d.deadline && <span className="text-[10px] text-gray-400">~{d.deadline.slice(5, 10)}</span>}
                  <span className="text-xs text-orange-600 font-medium">처리 →</span>
                </div>
              ))}
              {/* 나머지 활성 건 */}
              {active.filter(d => !needMyAction.find(n => n.id === d.id)).slice(0, 10).map(d => (
                <div key={d.id} onClick={() => setDetailModal(d)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition">
                  <span className="text-xs text-gray-400">{TYPE_ARROWS[d.type]}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_LABELS[d.status]?.color || 'bg-gray-100'}`}>
                    {STATUS_LABELS[d.status]?.label}
                  </span>
                  <span className="text-xs text-gray-600">{d.from_user_name}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-xs text-gray-600">{d.to_user_name}</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{d.title}</span>
                  <span className="text-[10px] text-gray-400">{d.created_at?.slice(5, 16)}</span>
                  <span className="text-xs text-gray-400">상세 →</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* === 지시/보고 상세 모달 === */}
      {detailModal && (() => {
        const d = detailModal;
        const TYPE_LABELS_M: Record<string, string> = { directive: '업무지시', report: '보고', lateral: '협의 요청' };
        const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
          urgent: { label: '즉시', color: 'bg-red-100 text-red-700' },
          high: { label: '오늘', color: 'bg-orange-100 text-orange-700' },
          normal: { label: '이번주', color: 'bg-blue-100 text-blue-700' },
          low: { label: '여유', color: 'bg-gray-100 text-gray-600' },
        };
        const isMySent = d.from_user_id === currentUser.id || d.from_role === currentUser.role_title;
        const isMyReceived = d.to_user_id === currentUser.id || d.to_role === currentUser.role_title;
        const fromOnto = ROLE_ONTOLOGY[d.from_role];
        const toOnto = ROLE_ONTOLOGY[d.to_role];
        const isOverdue = d.deadline && new Date(d.deadline) < new Date() && !['completed', 'verified', 'agreed'].includes(d.status);

        const doAction = async (action: string) => {
          await handleDirectiveAction(d.id, action, actionMemo);
          setActionMemo('');
          setDetailModal(null);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setDetailModal(null); setActionMemo(''); }}>
            <div className="bg-white rounded-2xl w-[560px] max-h-[85vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_ARROWS[d.type]}</span>
                    <span className="text-sm font-bold text-gray-900">{TYPE_LABELS_M[d.type]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_LABELS[d.priority]?.color || 'bg-gray-100'}`}>
                      {PRIORITY_LABELS[d.priority]?.label || d.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_LABELS[d.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_LABELS[d.status]?.label || d.status}
                    </span>
                    {isOverdue && <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white">기한 초과</span>}
                  </div>
                  <button onClick={() => { setDetailModal(null); setActionMemo(''); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>
                <h2 className="text-lg font-bold text-gray-900">{d.title}</h2>
              </div>

              <div className="overflow-y-auto max-h-[60vh]">
                {/* 발신/수신 정보 */}
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 uppercase mb-1">발신</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${fromOnto?.color || 'bg-gray-100'}`}>
                          {fromOnto?.label || d.from_role}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{d.from_user_name}</span>
                      </div>
                    </div>
                    <div className="text-2xl text-gray-300">→</div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-400 uppercase mb-1">수신</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${toOnto?.color || 'bg-gray-100'}`}>
                          {toOnto?.label || d.to_role}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{d.to_user_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>생성: {new Date(d.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {d.deadline && <span>기한: {new Date(d.deadline).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>

                {/* 내용 */}
                {d.content && (
                  <div className="px-6 py-4 border-b">
                    <div className="text-[10px] text-gray-400 uppercase mb-2">내용</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{d.content}</div>
                  </div>
                )}

                {/* 결과/메모 */}
                {d.result_memo && (
                  <div className="px-6 py-4 border-b">
                    <div className="text-[10px] text-gray-400 uppercase mb-2">
                      {d.status === 'completed' ? '완료 보고' : d.status === 'reopened' ? '수정 요청' : d.status === 'rejected' ? '반려 사유' : d.status === 'countered' ? '대안' : '결과'}
                    </div>
                    <div className={`text-sm whitespace-pre-wrap rounded-lg p-3 ${
                      d.status === 'rejected' ? 'bg-red-50 text-red-700' :
                      d.status === 'reopened' ? 'bg-orange-50 text-orange-700' :
                      d.status === 'countered' ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>{d.result_memo}</div>
                  </div>
                )}

                {/* === 조치 영역 === */}
                <div className="px-6 py-4">
                  <div className="text-[10px] text-gray-400 uppercase mb-3">조치</div>

                  {/* 메모 입력 */}
                  <textarea
                    value={actionMemo}
                    onChange={e => setActionMemo(e.target.value)}
                    placeholder="메모를 입력하세요 (조치 내용, 완료 보고, 반려 사유 등)"
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  {/* 조치 버튼 — 상태와 역할에 따라 다르게 표시 */}
                  <div className="flex flex-wrap gap-2">
                    {/* 내가 받은 지시 (수신자 액션) */}
                    {isMyReceived && d.type === 'directive' && (
                      <>
                        {d.status === 'pending' && (
                          <button onClick={() => doAction('acknowledge')}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">확인</button>
                        )}
                        {['pending', 'acknowledged', 'reopened'].includes(d.status) && (
                          <button onClick={() => doAction('start')}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700">진행 시작</button>
                        )}
                        {['in_progress', 'acknowledged', 'reopened'].includes(d.status) && (
                          <button onClick={() => doAction('complete')}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">완료 보고</button>
                        )}
                        <button onClick={() => doAction('reject')}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300">반려</button>
                      </>
                    )}

                    {/* 내가 받은 보고 (상위자 액션) */}
                    {isMyReceived && d.type === 'report' && ['pending', 'completed'].includes(d.status) && (
                      <>
                        <button onClick={() => doAction('approve')}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">승인</button>
                        <button onClick={() => doAction('request-revision')}
                          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600">수정 요청</button>
                        <button onClick={() => doAction('reject')}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300">반려</button>
                      </>
                    )}

                    {/* 내가 받은 협의 (lateral 수신자 액션) */}
                    {isMyReceived && d.type === 'lateral' && ['pending', 'acknowledged'].includes(d.status) && (
                      <>
                        <button onClick={() => doAction('agree')}
                          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700">합의</button>
                        <button onClick={() => doAction('counter')}
                          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">대안 제시</button>
                        <button onClick={() => doAction('escalate')}
                          className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900">Founder 중재</button>
                      </>
                    )}

                    {/* 내가 보낸 지시 — 완료 보고 확인/재작업 */}
                    {isMySent && d.status === 'completed' && (
                      <>
                        <button onClick={() => doAction('verify')}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">완료 확인</button>
                        <button onClick={() => doAction('reopen')}
                          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600">재작업 요청</button>
                      </>
                    )}

                    {/* 내가 보낸 lateral — 대안 수용/중재 */}
                    {isMySent && d.status === 'countered' && (
                      <>
                        <button onClick={() => doAction('agree')}
                          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700">대안 수용</button>
                        <button onClick={() => doAction('escalate')}
                          className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900">Founder 중재</button>
                      </>
                    )}

                    {/* 전달 (다른 역할에게) */}
                    {(isMySent || isMyReceived) && !['verified', 'agreed', 'rejected'].includes(d.status) && (
                      <button onClick={() => {
                        const role = prompt('전달할 역할 (ceo/cto/cfo/operations/cleaning_dispatch/field/marketing)');
                        if (role) {
                          handleSendDirective_forward(d, role);
                        }
                      }} className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 ml-auto">
                        → 전달
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 활동 로그 모달 */}
      {logModal && (() => {
        const member = members.find(m => m.name === logModal.name);
        const onto = member ? ROLE_ONTOLOGY[member.role_title] : null;
        const att = attendance.find(a => a.user_id === member?.user_id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLogModal(null)}>
            <div className="bg-white rounded-xl w-[600px] max-h-[85vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-3">
                  {onto && <span className={`px-2 py-1 rounded text-xs font-bold ${onto.color}`}>{onto.label}</span>}
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{logModal.name}</h3>
                    <p className="text-xs text-gray-500">{onto?.layerLabel} · {onto?.responsibilities.slice(0, 3).join(' · ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {att ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                  <span className="text-xs text-gray-500">{att ? '접속 중' : '오프라인'}</span>
                  <button onClick={() => setLogModal(null)} className="ml-2 text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[70vh]">
                {/* KPI 요약 — 클릭 드릴다운 */}
                {member && (
                  <div className="px-5 py-4 border-b bg-gray-50">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="cursor-pointer hover:bg-white rounded-lg p-1 transition"
                        onClick={() => { setLogModal(null); navigate(`/issues?assignee=${encodeURIComponent(member.name)}&status=open`); }}>
                        <div className="text-lg font-bold text-gray-800">{member.stats.open_issues}</div>
                        <div className="text-[10px] text-gray-500">미처리 →</div>
                      </div>
                      <div className="cursor-pointer hover:bg-white rounded-lg p-1 transition"
                        onClick={() => { setLogModal(null); navigate(`/issues?assignee=${encodeURIComponent(member.name)}&status=resolved&period=week`); }}>
                        <div className="text-lg font-bold text-emerald-700">{member.stats.resolved_week}</div>
                        <div className="text-[10px] text-gray-500">주간 해결 →</div>
                      </div>
                      <div className="cursor-pointer hover:bg-white rounded-lg p-1 transition"
                        onClick={() => { /* 이미 로그 모달 내 — 스크롤 다운 */ }}>
                        <div className="text-lg font-bold text-blue-700">{member.stats.activity_week}</div>
                        <div className="text-[10px] text-gray-500">주간 활동</div>
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${member.stats.avg_resolve_hours > 24 ? 'text-red-600' : 'text-gray-700'}`}>
                          {member.stats.avg_resolve_hours > 0 ? `${member.stats.avg_resolve_hours}h` : '-'}
                        </div>
                        <div className="text-[10px] text-gray-500">평균 해결</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 근태 이력 (최근 14일) */}
                {memberAttendance.length > 0 && (
                  <div className="px-5 py-4 border-b">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">근태 이력 (최근 14일)</h4>
                    <div className="space-y-1">
                      {memberAttendance.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{new Date(a.login_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                          <span className="text-gray-500">
                            {new Date(a.login_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            {a.logout_at ? ` ~ ${new Date(a.logout_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ' ~ 접속 중'}
                          </span>
                          <span className="font-medium text-gray-700 w-12 text-right">
                            {a.duration > 0 ? `${Math.floor(a.duration / 60)}h${a.duration % 60}m` : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 업무 로그 */}
                <div className="px-5 py-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">업무 로그</h4>
                  {logs.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-6">기록된 활동이 없습니다</div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map(l => (
                        <div key={l.id} className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {ACTION_LABELS[l.action] || l.action}
                              </span>
                              <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5 truncate">{l.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <AiAgentPanel
        page="team"
        pageLabel="팀 관리"
        getPageData={() => members.map(m => {
          const onto = ROLE_ONTOLOGY[m.role_title];
          return `${m.name}(${onto?.label},${m.role_layer}): 미처리=${m.stats.open_issues},주간해결=${m.stats.resolved_week},평균${m.stats.avg_resolve_hours}h,활동=${m.stats.activity_week},↑${m.stats.escalated_up},↓${m.stats.delegated_down}`;
        }).join('\n')}
      />
    </div>
  );
}
