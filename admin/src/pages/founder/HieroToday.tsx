import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// --- Types ---

interface CalendarSummary {
  today_checkins: number;
  today_checkouts: number;
  turnover: number;
  in_house: number;
  vacant: number;
  tomorrow_checkins: number;
}

interface IssueSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

interface CleaningSummary {
  total: number;
  pending: number;
  assigned: number;
  completed: number;
}

interface PulseItem {
  key: string;
  label: string;
  total: number;
  done: number;
  pct: number;
  color: string;
  link: string;
}

interface ActiveUser {
  user_id: number;
  user_name: string;
  role_title: string;
  is_online: boolean;
  login_at: string;
  duration: number;
}

interface CycleStat {
  label: string;
  tension: number;
  active_count: number;
}

interface CycleData {
  categories: Record<string, CycleStat>;
  hot_spot: string;
  cycle_status: string;
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

const BOARDS = [
  { path: '/founder', label: 'GOT', sub: 'Founder 관제탑', color: 'bg-gray-900', textColor: 'text-white' },
  { path: '/got', label: '조직도', sub: 'GOT 조직 구조', color: 'bg-gray-100', textColor: 'text-gray-700' },
  { path: '/etf-board', label: 'ETF', sub: 'CEO·CTO·CFO', color: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { path: '/today', label: '오늘', sub: '운영 현황', color: 'bg-amber-50', textColor: 'text-amber-700' },
];

// --- Component ---

export default function HieroToday() {
  const [calendar, setCalendar] = useState<CalendarSummary | null>(null);
  const [issues, setIssues] = useState<IssueSummary | null>(null);
  const [cleaning, setCleaning] = useState<CleaningSummary | null>(null);
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [cycle, setCycle] = useState<CycleData | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; role_title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/calendar/summary').catch(() => ({ data: { data: null } })),
      api.get('/issues/summary').catch(() => ({ data: null })),
      api.get('/cleaning/summary').catch(() => ({ data: null })),
      api.get('/ops/pulse').catch(() => ({ data: { daily: [] } })),
      api.get('/attendance/today').catch(() => ({ data: { users: [] } })),
      api.get('/founder/cycle').catch(() => ({ data: null })),
      api.get('/me').catch(() => ({ data: { name: '', role_title: '' } })),
    ]).then(([calRes, issRes, clnRes, pulseRes, attRes, cycleRes, meRes]) => {
      setCalendar(calRes.data?.data ?? calRes.data);
      setIssues(issRes.data);
      setCleaning(clnRes.data);
      setPulse(pulseRes.data?.daily ?? []);
      setUsers(attRes.data?.users ?? []);
      setCycle(cycleRes.data);
      setCurrentUser(meRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = dayNames[today.getDay()];
  const onlineCount = users.filter(u => u.is_online).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* === Header === */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">HIERO</h1>
          <p className="text-sm text-gray-500">{dateStr} ({dayStr})</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {onlineCount}명 접속 중
          {currentUser && (
            <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-gray-600">
              {currentUser.name} ({ROLE_LABELS[currentUser.role_title] ?? currentUser.role_title})
            </span>
          )}
        </div>
      </div>

      {/* === 오늘 숫자 — 한눈에 === */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <NumCard label="체크인" value={calendar?.today_checkins ?? 0} color="text-blue-600" bg="bg-blue-50" onClick={() => navigate('/calendar')} />
        <NumCard label="체크아웃" value={calendar?.today_checkouts ?? 0} color="text-orange-600" bg="bg-orange-50" onClick={() => navigate('/calendar')} />
        <NumCard label="턴오버" value={calendar?.turnover ?? 0} color="text-cyan-600" bg="bg-cyan-50" onClick={() => navigate('/cleaning')} />
        <NumCard label="재실" value={calendar?.in_house ?? 0} color="text-gray-700" bg="bg-gray-50" />
        <NumCard label="공실" value={calendar?.vacant ?? 0} color="text-amber-600" bg="bg-amber-50" alert={!!(calendar && calendar.vacant > 15)} onClick={() => navigate('/properties')} />
        <NumCard label="미해결 이슈" value={issues?.open ?? 0} color="text-red-600" bg="bg-red-50" alert={!!(issues && issues.open > 5)} onClick={() => navigate('/issues')} />
      </div>

      {/* === 오늘 진행률 (Pulse) === */}
      {pulse.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">오늘 진행률</h2>
          <div className="space-y-2">
            {pulse.map(p => (
              <div
                key={p.key}
                onClick={() => navigate(p.link)}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5 transition"
              >
                <span className="text-xs text-gray-600 w-24 shrink-0">{p.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`rounded-full h-2.5 transition-all ${
                      p.pct >= 100 ? 'bg-green-500' : p.pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(p.pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-16 text-right">
                  {p.done}/{p.total}
                </span>
                <span className={`text-xs font-bold w-10 text-right ${
                  p.pct >= 100 ? 'text-green-600' : p.pct >= 50 ? 'text-blue-600' : 'text-amber-600'
                }`}>
                  {p.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === 보드 진입 === */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">보드</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BOARDS.map(b => (
            <button
              key={b.path}
              onClick={() => navigate(b.path)}
              className={`${b.color} rounded-xl p-4 text-left hover:shadow-md transition`}
            >
              <div className={`text-lg font-black ${b.textColor}`}>{b.label}</div>
              <div className={`text-xs mt-0.5 ${b.textColor} opacity-70`}>{b.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* === 팀 현황 === */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">팀</h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {(['founder', 'ceo', 'cto', 'cfo', 'marketing', 'operations', 'cleaning_dispatch', 'field'] as const).map(role => {
            const user = users.find(u => u.role_title === role);
            const names: Record<string, string> = {
              founder: '김진우', ceo: '김지훈', cto: '변유진', cfo: '박수빈',
              marketing: '이예린', operations: '오재관', cleaning_dispatch: '김우현', field: '김진태',
            };
            const online = user?.is_online ?? false;
            return (
              <div key={role} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-xl ${ROLE_COLORS[role]} flex items-center justify-center`}>
                    <span className="text-white text-[9px] font-bold">{ROLE_LABELS[role]}</span>
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <span className="text-[10px] text-gray-600">{names[role]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* === 순환 상태 (미니) === */}
      {cycle && (
        <div
          onClick={() => navigate('/founder')}
          className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">의사결정 순환</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                (cycle.categories[cycle.hot_spot]?.tension ?? 0) >= 70 ? 'bg-red-100 text-red-700' :
                (cycle.categories[cycle.hot_spot]?.tension ?? 0) >= 40 ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {cycle.cycle_status}
              </span>
            </div>
            <span className="text-xs text-gray-400">상세 →</span>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            {(['strategy', 'revenue', 'risk'] as const).map(cat => {
              const stat = cycle.categories[cat];
              if (!stat) return null;
              const icons: Record<string, string> = { strategy: '?', revenue: '$', risk: '!' };
              const colors: Record<string, string> = { strategy: 'bg-indigo-600', revenue: 'bg-emerald-600', risk: 'bg-amber-600' };
              const isHot = cycle.hot_spot === cat;
              return (
                <div key={cat} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isHot ? 'bg-gray-50 ring-1 ring-gray-200' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg ${colors[cat]} flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{icons[cat]}</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-900">{stat.label}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">{stat.active_count}건</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        stat.tension >= 70 ? 'bg-red-500' : stat.tension >= 40 ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === 청소 / 이슈 미니 === */}
      <div className="grid grid-cols-2 gap-4">
        {/* 청소 */}
        <div
          onClick={() => navigate('/cleaning')}
          className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition"
        >
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">청소</h2>
          {cleaning && (
            <div className="space-y-1.5">
              <MiniRow label="전체" value={cleaning.total} />
              <MiniRow label="대기" value={cleaning.pending} alert={cleaning.pending > 0} />
              <MiniRow label="배정" value={cleaning.assigned} />
              <MiniRow label="완료" value={cleaning.completed} color="text-green-600" />
            </div>
          )}
        </div>

        {/* 이슈 */}
        <div
          onClick={() => navigate('/issues')}
          className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition"
        >
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">이슈</h2>
          {issues && (
            <div className="space-y-1.5">
              <MiniRow label="전체" value={issues.total} />
              <MiniRow label="미해결" value={issues.open} alert={issues.open > 5} />
              <MiniRow label="진행 중" value={issues.in_progress} />
              <MiniRow label="해결" value={issues.resolved} color="text-green-600" />
            </div>
          )}
        </div>
      </div>

      {/* === 내일 예고 === */}
      {calendar && calendar.tomorrow_checkins > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm text-blue-800">
            내일 체크인 <strong>{calendar.tomorrow_checkins}건</strong> 예정
          </div>
          <button onClick={() => navigate('/calendar')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            캘린더 →
          </button>
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

function NumCard({ label, value, color, bg, alert, onClick }: {
  label: string; value: number; color: string; bg: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`${bg} rounded-xl p-3 text-center ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} transition ${alert ? 'ring-2 ring-red-300' : ''}`}
    >
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function MiniRow({ label, value, alert, color }: { label: string; value: number; alert?: boolean; color?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${alert ? 'text-red-600' : color ?? (value > 0 ? 'text-gray-700' : 'text-gray-300')}`}>{value}</span>
    </div>
  );
}
