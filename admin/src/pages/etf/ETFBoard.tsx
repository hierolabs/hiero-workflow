import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

interface ETFOverview {
  ceo: { bottlenecks: number; delayed_tasks: number; approval_pending: number; team_count: number; online_count: number };
  cto: { total_tasks: number; documentation: number; research: number; message_review: number };
  cfo: { unsettled_count: number; tax_review: number; total_tasks: number };
}

interface ActiveUser {
  user_id: number;
  user_name: string;
  role_title: string;
  login_at: string;
  duration: number;
  is_online: boolean;
}

interface DirectiveFlow {
  from_role: string;
  to_role: string;
  type: string;
  count: number;
}

interface WorkloadStat {
  pending: number;
  in_progress: number;
  completed_today: number;
  sent_today: number;
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
  server_analysis: string;
  has_conflict: boolean;
  created_at: string;
}

interface GOTSummary {
  top_decision_count: number;
  etf_pending: Record<string, number>;
  execution_reports: number;
}

interface Relationship {
  domains: Record<string, string[]>;
  flows: DirectiveFlow[];
  conflicts: Directive[];
  workload: Record<string, WorkloadStat>;
}

const BOARDS = [
  {
    key: 'ceo',
    path: '/etf-board/ceo',
    title: 'CEO',
    name: 'Chief Executive Officer',
    role: '경영 전반 · 전체 리드 · 조직 운영 총괄',
    color: 'indigo',
    bgClass: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    badgeClass: 'bg-indigo-600',
  },
  {
    key: 'cto',
    path: '/etf-board/cto',
    title: 'CTO',
    name: 'Chief Technology Officer',
    role: '기술 총괄 · 기록 · 연구 · 메시지',
    color: 'violet',
    bgClass: 'bg-violet-50 border-violet-200 hover:border-violet-400',
    badgeClass: 'bg-violet-600',
  },
  {
    key: 'cfo',
    path: '/etf-board/cfo',
    title: 'CFO',
    name: 'Chief Financial Officer',
    role: '정산 · 재무 · 회계 · 파트너십',
    color: 'emerald',
    bgClass: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    badgeClass: 'bg-emerald-600',
  },
];

const DOMAIN_COLORS: Record<string, string> = {
  strategy: 'bg-indigo-100 text-indigo-700',
  team: 'bg-indigo-100 text-indigo-700',
  lead: 'bg-indigo-100 text-indigo-700',
  approval: 'bg-indigo-100 text-indigo-700',
  partnership: 'bg-indigo-100 text-indigo-700',
  bottleneck: 'bg-indigo-100 text-indigo-700',
  documentation: 'bg-violet-100 text-violet-700',
  research: 'bg-violet-100 text-violet-700',
  technology: 'bg-violet-100 text-violet-700',
  message: 'bg-violet-100 text-violet-700',
  archiving: 'bg-violet-100 text-violet-700',
  knowledge: 'bg-violet-100 text-violet-700',
  settlement: 'bg-emerald-100 text-emerald-700',
  accounting: 'bg-emerald-100 text-emerald-700',
  tax: 'bg-emerald-100 text-emerald-700',
  cost: 'bg-emerald-100 text-emerald-700',
  finance: 'bg-emerald-100 text-emerald-700',
  budget: 'bg-emerald-100 text-emerald-700',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장',
};

const ROLE_COLORS: Record<string, string> = {
  ceo: 'bg-indigo-600', cto: 'bg-violet-600', cfo: 'bg-emerald-600',
  marketing: 'bg-pink-500', operations: 'bg-amber-500',
  cleaning_dispatch: 'bg-cyan-500', field: 'bg-orange-500',
};

const TYPE_LABELS: Record<string, string> = {
  directive: '↓ 지시',
  report: '↑ 보고',
  lateral: '↔ 협의',
};

const PRIORITY_DOTS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-400',
  low: 'bg-gray-400',
};

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
  completed: { bg: 'bg-green-100 text-green-700', label: '완료' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
};

export default function ETFBoard() {
  const [data, setData] = useState<ETFOverview | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [got, setGot] = useState<GOTSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'flow' | 'feed'>('overview');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/etf-board'),
      api.get('/directives/relationship'),
      api.get('/directives'),
      api.get('/attendance/today'),
      api.get('/etf-board/got'),
    ]).then(([etfRes, relRes, dirRes, attRes, gotRes]) => {
      setData(etfRes.data);
      setRelationship(relRes.data);
      setDirectives(dirRes.data.directives ?? []);
      setActiveUsers(attRes.data.users ?? []);
      setGot(gotRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  const getStats = (key: string) => {
    if (!data) return [];
    if (key === 'ceo') return [
      { label: '병목', value: data.ceo.bottlenecks, alert: data.ceo.bottlenecks > 0 },
      { label: '지연', value: data.ceo.delayed_tasks, alert: data.ceo.delayed_tasks > 0 },
      { label: '승인 대기', value: data.ceo.approval_pending, alert: false },
      { label: '관리 팀원', value: `${data.ceo.team_count}명`, alert: false },
    ];
    if (key === 'cto') return [
      { label: '전체 업무', value: data.cto.total_tasks, alert: false },
      { label: '문서화', value: data.cto.documentation, alert: false },
      { label: '연구', value: data.cto.research, alert: false },
      { label: '메시지 검토', value: data.cto.message_review, alert: false },
    ];
    return [
      { label: '미정산', value: data.cfo.unsettled_count, alert: data.cfo.unsettled_count > 0 },
      { label: '세무 REVIEW', value: data.cfo.tax_review, alert: data.cfo.tax_review > 0 },
      { label: '전체 업무', value: data.cfo.total_tasks, alert: false },
    ];
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* GOT Layer */}
      <div
        onClick={() => navigate('/')}
        className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 cursor-pointer hover:from-slate-800 hover:to-slate-700 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">GOT</span>
            </div>
            <div>
              <div className="text-white text-lg font-bold">Founder 관제탑</div>
              <div className="text-slate-400 text-xs">김진우 — 최상위 전략 · 최종 의사결정</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {got && (
              <>
                <div className="text-center">
                  <div className={`text-xl font-bold ${got.top_decision_count > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {got.top_decision_count}
                  </div>
                  <div className="text-[10px] text-slate-500">결정 대기</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-300">
                    {Object.values(got.etf_pending).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-[10px] text-slate-500">ETF 미완료</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-300">{got.execution_reports}</div>
                  <div className="text-[10px] text-slate-500">보고 대기</div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* 흐름 화살표 */}
        <div className="flex items-center justify-center mt-3 gap-2 text-[10px] text-slate-500">
          <span>↑ 보고</span>
          <div className="w-px h-4 bg-slate-600" />
          <span>↓ 지시</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ETF Executive Layer</h1>
            <p className="text-sm text-gray-500 mt-1">CEO · CTO · CFO — 도메인 분리 · 업무지시 · 보고</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {activeUsers.filter(u => u.is_online).length}명 접속 중
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'overview' as const, label: '보드 현황' },
          { key: 'flow' as const, label: '관계 · 마찰 분석' },
          { key: 'feed' as const, label: '지시 · 보고 피드' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* === TAB 1: Overview (기존 + 개선) === */}
      {tab === 'overview' && (
        <>
          {/* Board Cards */}
          <div className="space-y-4">
            {BOARDS.map(board => {
              const wl = relationship?.workload?.[board.key];
              return (
                <div
                  key={board.key}
                  onClick={() => navigate(board.path)}
                  className={`border-2 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all cursor-pointer ${board.bgClass}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${board.badgeClass} flex items-center justify-center`}>
                        <span className="text-white text-sm font-bold">{board.title}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">{board.name}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">{board.role}</div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                      {getStats(board.key).map(stat => (
                        <div key={stat.label} className="text-center">
                          <div className={`text-lg font-bold ${stat.alert ? 'text-red-600' : 'text-gray-700'}`}>
                            {stat.value}
                          </div>
                          <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                      ))}
                      {/* Directive workload badge */}
                      {wl && (wl.pending + wl.in_progress) > 0 && (
                        <div className="text-center border-l border-gray-200 pl-4">
                          <div className="text-lg font-bold text-amber-600">{wl.pending + wl.in_progress}</div>
                          <div className="text-xs text-gray-500">미완료 지시</div>
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* Mobile stats */}
                  <div className="md:hidden mt-4 grid grid-cols-3 gap-3">
                    {getStats(board.key).slice(0, 3).map(stat => (
                      <div key={stat.label} className="text-center bg-white/50 rounded-lg py-2">
                        <div className={`text-base font-bold ${stat.alert ? 'text-red-600' : 'text-gray-700'}`}>
                          {stat.value}
                        </div>
                        <div className="text-xs text-gray-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Execution Layer */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Execution Layer</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: '마케팅', role: '마케팅·디자인·외부영업', path: '/execution/marketing', icon: 'M', key: 'marketing' },
                { title: '운영', role: '예약·운영·고객 CS', path: '/execution/operations', icon: 'O', key: 'operations' },
                { title: '청소배정', role: '예약보조·청소배정', path: '/execution/cleaning', icon: 'C', key: 'cleaning_dispatch' },
                { title: '현장', role: '현장민원·세팅·데이터', path: '/execution/field', icon: 'F', key: 'field' },
              ].map(member => {
                const wl = relationship?.workload?.[member.key];
                return (
                  <div
                    key={member.title}
                    onClick={() => navigate(member.path)}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm hover:border-gray-300 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {member.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{member.title}</div>
                        <div className="text-xs text-gray-500">{member.role}</div>
                      </div>
                      {wl && (wl.pending + wl.in_progress) > 0 && (
                        <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          {wl.pending + wl.in_progress}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오늘 근태 */}
          {activeUsers.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">오늘 근태 현황</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {activeUsers.map(u => {
                  const hrs = Math.floor(u.duration / 60);
                  const mins = u.duration % 60;
                  return (
                    <div key={u.user_id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm font-semibold text-gray-900">{u.user_name}</span>
                        <span className="text-[10px] text-gray-400">{ROLE_LABELS[u.role_title] ?? u.role_title}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>접속 {u.login_at}</span>
                        <span className="font-medium text-gray-700">
                          {hrs > 0 ? `${hrs}시간 ` : ''}{mins}분
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* === TAB 2: 관계 · 마찰 분석 === */}
      {tab === 'flow' && relationship && (
        <>
          {/* 도메인 경계 매트릭스 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">도메인 경계 매트릭스</h2>
            <p className="text-xs text-gray-500 mb-4">각 C-level의 고유 도메인 — 겹치지 않아야 마찰이 없다</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(relationship.domains).map(([role, domains]) => (
                <div key={role} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg ${ROLE_COLORS[role]} flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{ROLE_LABELS[role]}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{ROLE_LABELS[role]} 도메인</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {domains.map(d => (
                      <span key={d} className={`text-xs px-2 py-1 rounded-full font-medium ${DOMAIN_COLORS[d] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 활성 지시 흐름 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">활성 업무 흐름</h2>
            <p className="text-xs text-gray-500 mb-4">현재 진행 중인 지시/보고/협의 흐름</p>
            {relationship.flows.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">
                현재 활성 업무 흐름이 없습니다
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y">
                {relationship.flows.map((flow, i) => (
                  <div key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg ${ROLE_COLORS[flow.from_role] ?? 'bg-gray-400'} flex items-center justify-center`}>
                        <span className="text-white text-[10px] font-bold">{ROLE_LABELS[flow.from_role] ?? flow.from_role}</span>
                      </span>
                      <span className="text-gray-400 text-sm">{TYPE_LABELS[flow.type] ?? flow.type}</span>
                      <span className={`w-8 h-8 rounded-lg ${ROLE_COLORS[flow.to_role] ?? 'bg-gray-400'} flex items-center justify-center`}>
                        <span className="text-white text-[10px] font-bold">{ROLE_LABELS[flow.to_role] ?? flow.to_role}</span>
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-700">{flow.count}건</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 역할별 부하 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">역할별 업무 부하</h2>
            <p className="text-xs text-gray-500 mb-4">과부하 감지 — 미완료 지시가 5건 이상이면 경고</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(relationship.workload).map(([role, wl]) => {
                const total = wl.pending + wl.in_progress;
                const isOverload = total >= 5;
                return (
                  <div key={role} className={`rounded-xl p-4 border ${isOverload ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded ${ROLE_COLORS[role] ?? 'bg-gray-400'} flex items-center justify-center`}>
                        <span className="text-white text-[8px] font-bold">{(ROLE_LABELS[role] ?? role).slice(0, 2)}</span>
                      </span>
                      <span className="text-sm font-medium text-gray-900">{ROLE_LABELS[role] ?? role}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">대기</span>
                        <span className={`font-medium ${wl.pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{wl.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">진행</span>
                        <span className="font-medium text-blue-600">{wl.in_progress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">오늘 완료</span>
                        <span className="font-medium text-green-600">{wl.completed_today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">오늘 발신</span>
                        <span className="font-medium text-gray-700">{wl.sent_today}</span>
                      </div>
                    </div>
                    {isOverload && (
                      <div className="mt-2 text-[10px] text-red-600 font-medium">과부하 주의</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 충돌 감지 */}
          {relationship.conflicts.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-red-700 mb-3">충돌 감지됨</h2>
              <div className="bg-red-50 border border-red-200 rounded-xl divide-y divide-red-100">
                {relationship.conflicts.map(c => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{TYPE_LABELS[c.type]}</span>
                      <span className="text-sm font-medium text-gray-900">{c.title}</span>
                    </div>
                    <div className="text-xs text-gray-500">{c.from_user_name} ({ROLE_LABELS[c.from_role]}) → {c.to_user_name} ({ROLE_LABELS[c.to_role]})</div>
                    {c.server_analysis && (
                      <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2 whitespace-pre-line">{c.server_analysis}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 마찰 방지 규칙 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">마찰 방지 규칙</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-slate-400 text-lg">1</span>
                <div>
                  <div className="font-medium text-gray-900">도메인 분리 원칙</div>
                  <div className="text-xs text-gray-500">CEO=경영·팀·리드, CTO=기술·기록·연구, CFO=정산·재무·회계 — 겹치면 Founder 중재</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 text-lg">2</span>
                <div>
                  <div className="font-medium text-gray-900">지시 범위 제한</div>
                  <div className="text-xs text-gray-500">CEO→전체 Execution, CTO→마케팅·운영, CFO→운영·청소배정 — 범위 밖은 CEO 경유</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 text-lg">3</span>
                <div>
                  <div className="font-medium text-gray-900">Lateral 협의 투명성</div>
                  <div className="text-xs text-gray-500">같은 레벨 간 요청은 '협의' 타입으로 기록 — 지시가 아닌 요청으로 처리</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 text-lg">4</span>
                <div>
                  <div className="font-medium text-gray-900">과부하 경보</div>
                  <div className="text-xs text-gray-500">미완료 지시 5건 이상 시 해당 역할에 경고 — 추가 지시 전 완료 우선</div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* === TAB 3: 지시·보고 피드 === */}
      {tab === 'feed' && (
        <>
          {directives.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <div className="text-gray-400 text-sm">아직 업무지시/보고가 없습니다</div>
              <div className="text-xs text-gray-300 mt-1">각 보드(CEO/CTO/CFO)에서 업무지시를 생성하세요</div>
            </div>
          ) : (
            <div className="space-y-3">
              {directives.map(d => (
                <div
                  key={d.id}
                  className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[d.priority] ?? 'bg-gray-400'}`} />
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[d.type] ?? d.type}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{d.title}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
                      {STATUS_BADGES[d.status]?.label ?? d.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`inline-flex items-center gap-1`}>
                      <span className={`w-4 h-4 rounded text-[8px] text-white flex items-center justify-center ${ROLE_COLORS[d.from_role] ?? 'bg-gray-400'}`}>
                        {(ROLE_LABELS[d.from_role] ?? '?')[0]}
                      </span>
                      {d.from_user_name}
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className={`inline-flex items-center gap-1`}>
                      <span className={`w-4 h-4 rounded text-[8px] text-white flex items-center justify-center ${ROLE_COLORS[d.to_role] ?? 'bg-gray-400'}`}>
                        {(ROLE_LABELS[d.to_role] ?? '?')[0]}
                      </span>
                      {d.to_user_name}
                    </span>
                    <span className="text-gray-300 ml-auto">{d.created_at?.slice(5, 16)}</span>
                  </div>
                  {d.content && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{d.content}</div>
                  )}
                  {d.server_analysis && (
                    <div className={`mt-2 text-xs rounded p-2 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {d.server_analysis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
