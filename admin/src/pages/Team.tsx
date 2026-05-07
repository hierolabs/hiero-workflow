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

export default function Team() {
  const [members, setMembers] = useState<TeamMemberStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ name: string } | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/users/team-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const openLogModal = async (name: string) => {
    setLogModal({ name });
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/activity-logs?limit=30`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setLogs((data.logs || []).filter((l: ActivityLog) => l.user_name === name));
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
                {selectedOntology.domains.map(d => (
                  <span key={d} className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{d}</span>
                ))}
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
                      <div className="text-sm font-semibold text-gray-900 mt-1">{m.name}</div>
                    </div>
                    {m.stats.unread_notifications > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {m.stats.unread_notifications}
                      </span>
                    )}
                  </div>

                  {/* KPI */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">미처리</span>
                      <span className={`font-bold ${m.stats.open_issues > 3 ? 'text-red-600' : m.stats.open_issues > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {m.stats.open_issues}건
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">오늘 해결</span>
                      <span className="font-medium text-emerald-600">{m.stats.resolved_today}건</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
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
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">↑ 에스컬레이트</span>
                      <span className="font-medium text-gray-600">{m.stats.escalated_up}건</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">↓ 업무지시</span>
                      <span className="font-medium text-gray-600">{m.stats.delegated_down}건</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">주간 활동</span>
                      <span className="font-medium text-gray-700">{m.stats.activity_week}건</span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200/60">
                    <button
                      onClick={() => navigate('/chat')}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      채팅
                    </button>
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
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* 활동 로그 모달 */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLogModal(null)}>
          <div className="bg-white rounded-xl w-[500px] max-h-[70vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-sm font-bold text-gray-900">{logModal.name} — 활동 로그</h3>
              <button onClick={() => setLogModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[55vh] p-4">
              {logs.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">기록된 활동이 없습니다</div>
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
      )}

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
