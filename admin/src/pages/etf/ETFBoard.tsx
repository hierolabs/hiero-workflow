import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

interface ETFOverview {
  ceo: { bottlenecks: number; delayed_tasks: number; approval_pending: number; team_count: number };
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

interface DataMetric {
  label: string;
  value: number | string;
  unit: string;
}

interface DataFolder {
  key: string;
  label: string;
  desc: string;
  total: number;
  this_month: number;
  metrics: DataMetric[];
}

interface InfraDB {
  host: string;
  name: string;
  version: string;
  total_mb: number;
  table_count: number;
  total_rows: number;
  region: string;
  engine: string;
}
interface InfraTable {
  name: string;
  rows: number;
  data_mb: number;
  index_mb: number;
  category: string;
}
interface InfraSource {
  name: string;
  type: string;
  target: string;
  desc: string;
}
interface InfraData {
  db: InfraDB;
  tables: InfraTable[];
  server: { go_version: string; os: string; arch: string; port: string; uptime: string };
  data_sources: InfraSource[];
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

export default function ETFBoard() {
  const [data, setData] = useState<ETFOverview | null>(null);
  const [folders, setFolders] = useState<DataFolder[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [infra, setInfra] = useState<InfraData | null>(null);
  const [showInfra, setShowInfra] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/etf-board'),
      api.get('/multidata'),
      api.get('/attendance/today'),
      api.get('/infra'),
    ]).then(([etfRes, mdRes, attRes, infraRes]) => {
      setData(etfRes.data);
      setFolders(mdRes.data.folders ?? []);
      setActiveUsers(attRes.data.users ?? []);
      setInfra(infraRes.data);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header + Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">경영 대시보드</button>
          <span>/</span>
          <span className="text-gray-600">ETF Board</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">ETF Executive Layer</h1>
        <p className="text-sm text-gray-500 mt-1">CEO · CTO · CFO — 각 보드를 선택하세요</p>
      </div>

      {/* Folder-style Board List */}
      <div className="space-y-4">
        {BOARDS.map(board => (
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
                    <span className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded">{board.title}</span>
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
              </div>
              <div className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
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
        ))}
      </div>

      {/* 오늘 근태 현황 */}
      {activeUsers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">오늘 근태 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeUsers.map(u => {
              const hrs = Math.floor(u.duration / 60);
              const mins = u.duration % 60;
              const roleLabels: Record<string, string> = {
                founder: 'Founder', ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
                marketing: 'Marketing', operations: 'Operations',
                cleaning_dispatch: 'Cleaning', field: 'Field',
              };
              return (
                <div key={u.user_id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm font-semibold text-gray-900">{u.user_name}</span>
                    <span className="text-[10px] text-gray-400">{roleLabels[u.role_title] ?? u.role_title}</span>
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

      {/* Multidata Folders */}
      {folders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Multidata — 운영 데이터 누적 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {folders.map(f => {
              const icons: Record<string, string> = {
                properties: '🏠', reservations: '📅', cleaning: '🧹', issues: '⚠️',
                transactions: '💰', leads: '📞', messages: '💬', reviews: '⭐',
                team: '👥', costs: '📊', hestory: '📚', diagnosis: '🔍',
              };
              return (
                <div key={f.key} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{icons[f.key] ?? '📁'}</span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{f.label}</div>
                      <div className="text-[10px] text-gray-400">{f.desc}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {f.metrics.map(m => (
                      <div key={m.label} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{m.label}</span>
                        <span className="font-medium text-gray-800">
                          {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}{' '}
                          <span className="text-gray-400 text-[10px]">{m.unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 데이터 인프라 */}
      {infra && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Data Infrastructure</h2>
            <button
              onClick={() => setShowInfra(!showInfra)}
              className="text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {showInfra ? '접기' : '상세 보기'}
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] text-slate-400 uppercase">Database</div>
              <div className="text-sm font-bold text-slate-800 mt-1">{infra.db.name}</div>
              <div className="text-[10px] text-slate-500">{infra.db.engine} · {infra.db.region}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] text-slate-400 uppercase">Storage</div>
              <div className="text-sm font-bold text-slate-800 mt-1">{infra.db.total_mb} MB</div>
              <div className="text-[10px] text-slate-500">{infra.db.table_count}개 테이블 · {infra.db.total_rows.toLocaleString()}행</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] text-slate-400 uppercase">Engine</div>
              <div className="text-sm font-bold text-slate-800 mt-1">{infra.db.version}</div>
              <div className="text-[10px] text-slate-500">{infra.server.go_version} · {infra.server.os}/{infra.server.arch}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] text-slate-400 uppercase">Uptime</div>
              <div className="text-sm font-bold text-slate-800 mt-1">{infra.server.uptime}</div>
              <div className="text-[10px] text-slate-500">Port {infra.server.port}</div>
            </div>
          </div>

          {/* Data Sources */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
            <h3 className="text-xs font-semibold text-gray-600 mb-3">데이터 유입 경로</h3>
            <div className="space-y-2">
              {infra.data_sources.map(s => {
                const typeColors: Record<string, string> = {
                  webhook: 'bg-green-50 text-green-700',
                  csv_upload: 'bg-amber-50 text-amber-700',
                  manual: 'bg-blue-50 text-blue-700',
                  ai_auto: 'bg-purple-50 text-purple-700',
                  seed: 'bg-gray-100 text-gray-600',
                  auto_track: 'bg-cyan-50 text-cyan-700',
                };
                const typeLabels: Record<string, string> = {
                  webhook: '자동', csv_upload: 'CSV', manual: '수동',
                  ai_auto: 'AI', seed: '시드', auto_track: '추적',
                };
                return (
                  <div key={s.name} className="flex items-start gap-3">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColors[s.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {typeLabels[s.type] ?? s.type}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800">{s.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{s.desc}</div>
                      <div className="text-[10px] text-gray-300 mt-0.5">→ {s.target}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Detail (collapsible) */}
          {showInfra && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-600 mb-3">테이블별 저장 현황</h3>
              {['운영', '재무', '워크플로우', '조직·인사', '마케팅', 'AI·지식', '협업', '기타'].map(cat => {
                const tables = infra.tables.filter(t => t.category === cat);
                if (tables.length === 0) return null;
                return (
                  <div key={cat} className="mb-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{cat}</div>
                    <div className="space-y-0.5">
                      {tables.map(t => (
                        <div key={t.name} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-gray-600 font-mono text-[11px]">{t.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-800 font-medium w-16 text-right">{t.rows.toLocaleString()}</span>
                            <span className="text-gray-400 w-16 text-right">{(t.data_mb + t.index_mb).toFixed(2)} MB</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Execution Layer 바로가기 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Execution Layer</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: '마케팅', role: '마케팅·디자인·외부영업', path: '/execution/marketing', icon: 'M' },
            { title: '운영', role: '예약·운영·고객 CS', path: '/execution/operations', icon: 'O' },
            { title: '청소배정', role: '예약보조·청소배정', path: '/execution/cleaning_dispatch', icon: 'C' },
            { title: '현장', role: '현장민원·세팅·데이터', path: '/execution/field', icon: 'F' },
          ].map(member => (
            <div
              key={member.title}
              onClick={() => navigate(member.path)}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm hover:border-gray-300 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {member.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{member.title}</div>
                  <div className="text-xs text-gray-500">{member.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
