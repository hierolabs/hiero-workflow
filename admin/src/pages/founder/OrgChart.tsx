import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// --- Types ---

interface CategoryStat {
  label: string;
  question: string;
  active_count: number;
  resolved_week: number;
  tension: number;
  top_issue: string;
}

interface CategoryFlow {
  from: string;
  to: string;
  label: string;
  count: number;
  examples: string;
}

interface CycleAnalysis {
  categories: Record<string, CategoryStat>;
  flows: CategoryFlow[];
  hot_spot: string;
  cycle_status: string;
}

interface ETFSummary {
  ceo: { bottlenecks: number; delayed_tasks: number; approval_pending: number };
  cto: { documentation_tasks: number; research_tasks: number; message_review: number };
  cfo: { unsettled_count: number; tax_review_count: number; accounting_review_count: number };
}

interface WorkloadStat {
  pending: number;
  in_progress: number;
  completed_today: number;
  sent_today: number;
}

interface DirectiveFlow {
  from_role: string;
  to_role: string;
  type: string;
  count: number;
}

interface ActiveUser {
  user_id: number;
  user_name: string;
  role_title: string;
  login_at: string;
  duration: number;
  is_online: boolean;
}

// --- Constants ---

const ROLE_META: Record<string, { label: string; name: string; color: string; bg: string; desc: string }> = {
  founder: { label: 'GOT', name: '김진우', color: 'bg-gray-900', bg: 'bg-gray-50', desc: 'Founder 관제탑 · 최종 의사결정' },
  ceo: { label: 'CEO', name: '김지훈', color: 'bg-indigo-600', bg: 'bg-indigo-50', desc: '경영 전반 · 팀 리드 · 승인' },
  cto: { label: 'CTO', name: '변유진', color: 'bg-violet-600', bg: 'bg-violet-50', desc: '기술 · 기록 · 연구 · 메시지' },
  cfo: { label: 'CFO', name: '박수빈', color: 'bg-emerald-600', bg: 'bg-emerald-50', desc: '정산 · 재무 · 회계 · 세무' },
  marketing: { label: '마케팅', name: '이예린', color: 'bg-pink-500', bg: 'bg-pink-50', desc: '마케팅 · 디자인 · 외부영업' },
  operations: { label: '운영', name: '오재관', color: 'bg-amber-500', bg: 'bg-amber-50', desc: '예약 · 운영 · 고객 CS' },
  cleaning_dispatch: { label: '청소배정', name: '김우현', color: 'bg-cyan-500', bg: 'bg-cyan-50', desc: '예약보조 · 청소배정' },
  field: { label: '현장', name: '김진태', color: 'bg-orange-500', bg: 'bg-orange-50', desc: '현장민원 · 세팅 · 데이터' },
};

const CYCLE_META: Record<string, { icon: string; color: string; border: string }> = {
  strategy: { icon: '?', color: 'bg-indigo-600', border: 'border-indigo-400' },
  revenue: { icon: '$', color: 'bg-emerald-600', border: 'border-emerald-400' },
  risk: { icon: '!', color: 'bg-amber-600', border: 'border-amber-400' },
};

// --- Component ---

export default function OrgChart() {
  const [cycle, setCycle] = useState<CycleAnalysis | null>(null);
  const [etf, setEtf] = useState<ETFSummary | null>(null);
  const [workload, setWorkload] = useState<Record<string, WorkloadStat>>({});
  const [flows, setFlows] = useState<DirectiveFlow[]>([]);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/founder/cycle').catch(() => ({ data: null })),
      api.get('/founder/etf-summary').catch(() => ({ data: null })),
      api.get('/directives/relationship').catch(() => ({ data: { workload: {}, flows: [] } })),
      api.get('/attendance/today').catch(() => ({ data: { users: [] } })),
    ]).then(([cycleRes, etfRes, relRes, attRes]) => {
      setCycle(cycleRes.data);
      setEtf(etfRes.data);
      setWorkload(relRes.data?.workload ?? {});
      setFlows(relRes.data?.flows ?? []);
      setUsers(attRes.data?.users ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  const isOnline = (role: string) => users.some(u => u.role_title === role && u.is_online);
  const getUser = (role: string) => users.find(u => u.role_title === role);

  // 역할 간 활성 지시 수
  const getFlowCount = (from: string, to: string) => {
    return flows.filter(f => f.from_role === from && f.to_role === to).reduce((sum, f) => sum + f.count, 0);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* GOT Header — 김진우 Founder */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 text-white">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-200">경영 대시보드</button>
          <span>/</span>
          <span className="text-gray-300">GOT</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white text-xl font-black">G</span>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">GOT — 김진우</h1>
            <p className="text-sm text-gray-400 mt-1">Founder · HIERO 관제탑 · 최종 의사결정</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">핵심 역할</div>
            <div className="text-sm font-semibold">전체 방향 · 전략</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">관리 범위</div>
            <div className="text-sm font-semibold">ETF만 직접 지시</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">의사결정</div>
            <div className="text-sm font-semibold">오늘 결정할 3가지</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 text-center">
          GOT는 직접 모든 일을 하는 자리가 아니라, ETF가 올린 핵심 이슈를 보고 최종 판단하는 관제탑
        </div>
      </div>

      {/* ========== 조직도 본체 ========== */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-5 text-center">조직 구조 — 실시간 업무 흐름</h2>

        {/* --- Layer 1: GOT --- */}
        <div className="flex justify-center mb-2">
          <RoleCard
            role="founder"
            meta={ROLE_META.founder}
            online={isOnline('founder')}
            user={getUser('founder')}
            onClick={() => navigate('/')}
            size="lg"
          />
        </div>

        {/* GOT → ETF 연결선 + 흐름 수 */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex items-center gap-6">
              {['ceo', 'cto', 'cfo'].map(role => {
                const down = getFlowCount('founder', role);
                const up = getFlowCount(role, 'founder');
                return (
                  <div key={role} className="flex flex-col items-center">
                    {(down > 0 || up > 0) && (
                      <div className="flex items-center gap-1 text-[10px] mb-0.5">
                        {down > 0 && <span className="text-blue-500">↓{down}</span>}
                        {up > 0 && <span className="text-amber-500">↑{up}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="w-px h-2 bg-gray-300" />
          </div>
        </div>

        {/* 레이어 라벨 */}
        <div className="flex justify-center mb-2">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest bg-gray-50 px-3 py-0.5 rounded-full">
            ETF Layer
          </span>
        </div>

        {/* --- Layer 2: ETF --- */}
        <div className="flex justify-center gap-4 md:gap-6 mb-2">
          {(['ceo', 'cto', 'cfo'] as const).map(role => {
            const meta = ROLE_META[role];
            const wl = workload[role];
            const pending = wl ? wl.pending + wl.in_progress : 0;
            return (
              <RoleCard
                key={role}
                role={role}
                meta={meta}
                online={isOnline(role)}
                user={getUser(role)}
                onClick={() => navigate(`/etf-board/${role}`)}
                size="md"
                badge={pending > 0 ? `${pending}` : undefined}
                etfData={role === 'ceo' ? etf?.ceo : role === 'cto' ? etf?.cto : etf?.cfo}
              />
            );
          })}
        </div>

        {/* ETF 간 Lateral 흐름 */}
        <div className="flex justify-center mb-1">
          <div className="flex items-center gap-2 text-[10px]">
            {getFlowCount('ceo', 'cto') + getFlowCount('cto', 'ceo') > 0 && (
              <span className="text-violet-500">CEO↔CTO {getFlowCount('ceo', 'cto') + getFlowCount('cto', 'ceo')}</span>
            )}
            {getFlowCount('ceo', 'cfo') + getFlowCount('cfo', 'ceo') > 0 && (
              <span className="text-emerald-500">CEO↔CFO {getFlowCount('ceo', 'cfo') + getFlowCount('cfo', 'ceo')}</span>
            )}
            {getFlowCount('cto', 'cfo') + getFlowCount('cfo', 'cto') > 0 && (
              <span className="text-teal-500">CTO↔CFO {getFlowCount('cto', 'cfo') + getFlowCount('cfo', 'cto')}</span>
            )}
          </div>
        </div>

        {/* ETF → Execution 연결선 */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-gray-200" />
            <div className="w-64 h-px bg-gray-200" />
            <div className="w-px h-2 bg-gray-200" />
          </div>
        </div>

        {/* 레이어 라벨 */}
        <div className="flex justify-center mb-2">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest bg-gray-50 px-3 py-0.5 rounded-full">
            Execution Layer
          </span>
        </div>

        {/* --- Layer 3: Execution --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['marketing', 'operations', 'cleaning_dispatch', 'field'] as const).map(role => {
            const meta = ROLE_META[role];
            const wl = workload[role];
            const pending = wl ? wl.pending + wl.in_progress : 0;
            return (
              <RoleCard
                key={role}
                role={role}
                meta={meta}
                online={isOnline(role)}
                user={getUser(role)}
                onClick={() => navigate(`/execution/${role === 'cleaning_dispatch' ? 'cleaning' : role}`)}
                size="sm"
                badge={pending > 0 ? `${pending}` : undefined}
              />
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 접속 중</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> 오프라인</span>
          <span className="flex items-center gap-1"><span className="text-blue-500">↓</span> 지시</span>
          <span className="flex items-center gap-1"><span className="text-amber-500">↑</span> 보고</span>
          <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1 rounded">N</span> 미완료 지시
        </div>
      </div>

      {/* ========== 의사결정 순환 ========== */}
      {cycle && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">의사결정 순환 구조</h2>
              <p className="text-xs text-gray-400">전략 → 매출 → 리스크 → 전략 (반복)</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
              cycle.categories[cycle.hot_spot]?.tension >= 70 ? 'bg-red-50 text-red-700' :
              cycle.categories[cycle.hot_spot]?.tension >= 40 ? 'bg-amber-50 text-amber-700' :
              'bg-green-50 text-green-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                cycle.categories[cycle.hot_spot]?.tension >= 70 ? 'bg-red-500 animate-pulse' :
                cycle.categories[cycle.hot_spot]?.tension >= 40 ? 'bg-amber-500' : 'bg-green-500'
              }`} />
              {cycle.cycle_status}
            </div>
          </div>

          {/* 순환 삼각형 */}
          <div className="flex flex-col items-center gap-2">
            {/* 상단: 전략 */}
            <CycleCard cat="strategy" stat={cycle.categories.strategy} isHot={cycle.hot_spot === 'strategy'} />

            {/* 화살표 행 */}
            <div className="flex items-center gap-12 md:gap-20">
              <CycleArrow flow={cycle.flows.find(f => f.from === 'risk' && f.to === 'strategy')} symbol="↗" />
              <CycleArrow flow={cycle.flows.find(f => f.from === 'strategy' && f.to === 'revenue')} symbol="↘" />
            </div>

            {/* 하단: 리스크 ←── 매출 */}
            <div className="flex items-center gap-6 md:gap-12">
              <CycleCard cat="risk" stat={cycle.categories.risk} isHot={cycle.hot_spot === 'risk'} />
              <CycleArrow flow={cycle.flows.find(f => f.from === 'revenue' && f.to === 'risk')} symbol="←" />
              <CycleCard cat="revenue" stat={cycle.categories.revenue} isHot={cycle.hot_spot === 'revenue'} />
            </div>
          </div>

          {/* 흐름 상세 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-4 border-t border-gray-100">
            {cycle.flows.map((flow, i) => {
              const fromM = CYCLE_META[flow.from as keyof typeof CYCLE_META];
              const toM = CYCLE_META[flow.to as keyof typeof CYCLE_META];
              return (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-5 h-5 rounded ${fromM?.color ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <span className="text-white text-[9px] font-bold">{fromM?.icon}</span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className={`w-5 h-5 rounded ${toM?.color ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <span className="text-white text-[9px] font-bold">{toM?.icon}</span>
                    </div>
                    <span className={`text-xs font-bold ${flow.count > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{flow.count}건</span>
                  </div>
                  <div className="text-xs font-medium text-gray-800">{flow.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{flow.examples}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== 지시 범위 규칙 ========== */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">지시 범위 규칙</h2>
        <div className="space-y-4">
          {/* GOT */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">GOT</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">GOT → ETF만 지시</div>
              <div className="text-xs text-gray-500">CEO · CTO · CFO에게만 직접 지시. Execution은 ETF를 경유해야 함</div>
              <div className="flex gap-1 mt-1">
                {['CEO', 'CTO', 'CFO'].map(r => (
                  <span key={r} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </div>
          {/* CEO */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">CEO</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">CEO → 전체 Execution</div>
              <div className="text-xs text-gray-500">마케팅 · 운영 · 청소배정 · 현장 4개 역할 모두 지시 가능</div>
              <div className="flex gap-1 mt-1">
                {['마케팅', '운영', '청소배정', '현장'].map(r => (
                  <span key={r} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </div>
          {/* CTO */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">CTO</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">CTO → 마케팅 · 운영</div>
              <div className="text-xs text-gray-500">기술·기록 관련 마케팅 콘텐츠 및 운영 메시지 관리</div>
              <div className="flex gap-1 mt-1">
                {['마케팅', '운영'].map(r => (
                  <span key={r} className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </div>
          {/* CFO */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">CFO</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">CFO → 운영 · 청소배정</div>
              <div className="text-xs text-gray-500">정산·비용 관련 운영 및 청소 비용 관리</div>
              <div className="flex gap-1 mt-1">
                {['운영', '청소배정'].map(r => (
                  <span key={r} className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub Components ---

function RoleCard({ role, meta, online, user, onClick, size, badge, etfData }: {
  role: string;
  meta: { label: string; name: string; color: string; bg: string; desc: string };
  online: boolean;
  user?: ActiveUser;
  onClick: () => void;
  size: 'lg' | 'md' | 'sm';
  badge?: string;
  etfData?: Record<string, number>;
}) {
  const sizeClass = size === 'lg' ? 'w-52 p-5' : size === 'md' ? 'w-40 p-4' : 'p-3';
  const iconSize = size === 'lg' ? 'w-12 h-12 text-sm' : size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]';

  return (
    <div
      onClick={onClick}
      className={`${sizeClass} ${meta.bg} border border-gray-200 rounded-xl cursor-pointer hover:shadow-md hover:border-gray-300 transition relative group`}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className={`${iconSize} rounded-xl ${meta.color} flex items-center justify-center group-hover:scale-105 transition`}>
          <span className="text-white font-bold">{meta.label}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className={`font-semibold text-gray-900 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
              {meta.name}
            </span>
          </div>
          {size !== 'sm' && (
            <div className="text-[10px] text-gray-400 truncate">{meta.desc}</div>
          )}
        </div>
      </div>

      {/* ETF Data (mini stats) */}
      {etfData && size === 'md' && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
          {Object.entries(etfData).slice(0, 3).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px]">
              <span className="text-gray-400">{k.replace(/_/g, ' ')}</span>
              <span className={`font-medium ${Number(v) > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Duration */}
      {user && size !== 'sm' && (
        <div className="text-[10px] text-gray-400 mt-1">
          {user.is_online ? `접속 ${user.login_at}` : '오프라인'}
          {user.duration > 0 && ` · ${Math.floor(user.duration / 60)}h ${user.duration % 60}m`}
        </div>
      )}
    </div>
  );
}

function CycleCard({ cat, stat, isHot }: {
  cat: string;
  stat: CategoryStat;
  isHot: boolean;
}) {
  const meta = CYCLE_META[cat as keyof typeof CYCLE_META];
  return (
    <div className={`rounded-xl border-2 p-3 w-36 text-center ${isHot ? meta.border + ' shadow-md' : 'border-gray-200'}`}>
      <div className={`w-8 h-8 rounded-lg ${meta.color} flex items-center justify-center mx-auto mb-1`}>
        <span className="text-white text-sm font-black">{meta.icon}</span>
      </div>
      <div className="text-xs font-bold text-gray-900">{stat.label}</div>
      <div className="flex items-center justify-center gap-2 mt-1">
        <span className={`text-base font-black ${stat.active_count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
          {stat.active_count}
        </span>
        <div className={`w-2 h-2 rounded-full ${
          stat.tension >= 70 ? 'bg-red-500 animate-pulse' :
          stat.tension >= 40 ? 'bg-amber-500' : 'bg-green-500'
        }`} />
      </div>
      {/* Tension mini bar */}
      <div className="bg-gray-100 rounded-full h-1 mt-1 mx-4">
        <div
          className={`rounded-full h-1 ${
            stat.tension >= 70 ? 'bg-red-500' : stat.tension >= 40 ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(stat.tension, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CycleArrow({ flow, symbol }: { flow?: CategoryFlow; symbol: string }) {
  const count = flow?.count ?? 0;
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xl ${count > 0 ? 'text-gray-500' : 'text-gray-200'}`}>{symbol}</span>
      <span className={`text-[10px] font-medium ${count > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{count}건</span>
    </div>
  );
}
