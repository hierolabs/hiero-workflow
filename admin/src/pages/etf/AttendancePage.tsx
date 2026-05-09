import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// --- Types ---

interface ActiveUser {
  user_id: number;
  user_name: string;
  role_title: string;
  login_at: string;
  duration: number;
  is_online: boolean;
}

interface SessionRecord {
  date: string;
  login_at: string;
  logout_at: string;
  duration: number;
  activities: number;
}

interface AttendanceUser {
  user_id: number;
  user_name: string;
  role_title: string;
  records: SessionRecord[];
}

interface ProductivityUser {
  user_id: number;
  user_name: string;
  role_title: string;
  total_hours: number;
  total_actions: number;
  page_views: number;
  issues_created: number;
  issues_resolved: number;
  escalations: number;
  actions_per_hour: number;
}

// --- Constants ---

const ROLE_LABELS: Record<string, string> = {
  founder: 'GOT', ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장',
};

const ROLE_COLORS: Record<string, string> = {
  founder: 'bg-gray-900', ceo: 'bg-indigo-600', cto: 'bg-violet-600', cfo: 'bg-emerald-600',
  marketing: 'bg-pink-500', operations: 'bg-amber-500',
  cleaning_dispatch: 'bg-cyan-500', field: 'bg-orange-500',
};

// --- Component ---

export default function AttendancePage() {
  const [today, setToday] = useState<ActiveUser[]>([]);
  const [report, setReport] = useState<AttendanceUser[]>([]);
  const [productivity, setProductivity] = useState<ProductivityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'today' | 'history' | 'productivity'>('today');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/attendance/today').catch(() => ({ data: { users: [] } })),
      api.get('/attendance/report').catch(() => ({ data: { attendance: [] } })),
      api.get('/attendance/productivity').catch(() => ({ data: { productivity: [] } })),
    ]).then(([todayRes, reportRes, prodRes]) => {
      setToday(todayRes.data?.users ?? []);
      setReport(reportRes.data?.attendance ?? []);
      setProductivity(prodRes.data?.productivity ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  // 이번 주 / 이번 달 집계
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const getUserSummary = (records: SessionRecord[]) => {
    const todayRecs = records.filter(r => r.date === todayStr);
    const weekRecs = records.filter(r => r.date >= weekStartStr);
    const monthRecs = records.filter(r => r.date >= monthStartStr);

    const sum = (recs: SessionRecord[]) => recs.reduce((a, r) => a + r.duration, 0);
    const days = (recs: SessionRecord[]) => new Set(recs.map(r => r.date)).size;

    return {
      today: { minutes: sum(todayRecs), days: days(todayRecs) },
      week: { minutes: sum(weekRecs), days: days(weekRecs) },
      month: { minutes: sum(monthRecs), days: days(monthRecs) },
    };
  };

  const fmtDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const onlineCount = today.filter(u => u.is_online).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/etf-board/ceo')} className="hover:text-gray-600">CEO Board</button>
          <span>/</span>
          <span className="text-gray-600">근태 현황</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">근태 현황</h1>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {onlineCount}명 접속 중
          </div>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'today' as const, label: `오늘 (${today.length}명)` },
          { key: 'history' as const, label: '기간별 근무' },
          { key: 'productivity' as const, label: '생산성' },
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

      {/* ===== 오늘 ===== */}
      {tab === 'today' && (
        <div className="space-y-3">
          {today.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">오늘 접속 기록이 없습니다</div>
          ) : (
            today.map(u => (
              <div key={u.user_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl ${ROLE_COLORS[u.role_title] ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <span className="text-white text-[10px] font-bold">{ROLE_LABELS[u.role_title] ?? u.role_title}</span>
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{u.user_name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[u.role_title]}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{fmtDuration(u.duration)}</div>
                  <div className="text-xs text-gray-400">접속 {u.login_at}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== 기간별 근무 ===== */}
      {tab === 'history' && (
        <div className="space-y-4">
          {report.map(user => {
            const summary = getUserSummary(user.records);
            return (
              <div key={user.user_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* User Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${ROLE_COLORS[user.role_title] ?? 'bg-gray-400'} flex items-center justify-center`}>
                      <span className="text-white text-[9px] font-bold">{ROLE_LABELS[user.role_title] ?? '?'}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{user.user_name}</div>
                      <div className="text-xs text-gray-500">{ROLE_LABELS[user.role_title]}</div>
                    </div>
                  </div>
                </div>

                {/* Period Summary */}
                <div className="grid grid-cols-3 divide-x border-b border-gray-100">
                  <PeriodCell label="오늘" minutes={summary.today.minutes} days={summary.today.days} />
                  <PeriodCell label="이번 주" minutes={summary.week.minutes} days={summary.week.days} />
                  <PeriodCell label="이번 달" minutes={summary.month.minutes} days={summary.month.days} />
                </div>

                {/* Recent Records */}
                <div className="max-h-40 overflow-y-auto">
                  {user.records.slice(-10).reverse().map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-xs border-b border-gray-50 last:border-0">
                      <span className="text-gray-500 w-20">{r.date.slice(5)}</span>
                      <span className="text-gray-600">{r.login_at} ~ {r.logout_at || '진행중'}</span>
                      <span className="font-medium text-gray-900 w-16 text-right">{fmtDuration(r.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {report.length === 0 && (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">근태 기록이 없습니다</div>
          )}
        </div>
      )}

      {/* ===== 생산성 ===== */}
      {tab === 'productivity' && (
        <div className="space-y-3">
          {productivity.map(u => (
            <div key={u.user_id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${ROLE_COLORS[u.role_title] ?? 'bg-gray-400'} flex items-center justify-center`}>
                    <span className="text-white text-[9px] font-bold">{ROLE_LABELS[u.role_title] ?? '?'}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{u.user_name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[u.role_title]}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-gray-900">{u.total_hours.toFixed(1)}h</div>
                  <div className="text-[10px] text-gray-400">총 근무시간</div>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <StatCell label="총 액션" value={u.total_actions} />
                <StatCell label="페이지 뷰" value={u.page_views} />
                <StatCell label="이슈 생성" value={u.issues_created} />
                <StatCell label="이슈 해결" value={u.issues_resolved} />
                <StatCell label="에스컬레이션" value={u.escalations} />
                <StatCell label="액션/시간" value={u.actions_per_hour} decimal />
              </div>
            </div>
          ))}
          {productivity.length === 0 && (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-sm text-gray-400">생산성 데이터가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

function PeriodCell({ label, minutes, days }: { label: string; minutes: number; days: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="p-3 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-base font-bold text-gray-900">{h > 0 ? `${h}h ${m}m` : `${m}m`}</div>
      <div className="text-[10px] text-gray-400">{days}일 접속</div>
    </div>
  );
}

function StatCell({ label, value, decimal }: { label: string; value: number; decimal?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className={`text-sm font-bold ${value > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
        {decimal ? value.toFixed(1) : value}
      </div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
