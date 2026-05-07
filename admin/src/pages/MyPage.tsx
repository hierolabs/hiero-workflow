import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AiAgentPanel from '../components/AiAgentPanel';

const API_URL = import.meta.env.VITE_API_URL;
const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

interface MyStats {
  open_issues: number;
  resolved_today: number;
  resolved_week: number;
  resolved_month: number;
  escalated_up: number;
  delegated_down: number;
  avg_resolve_hours: number;
  activity_week: number;
  unread_notifications: number;
}

interface AttendanceRecord {
  login_at: string;
  logout_at: string | null;
  duration: number;
}

interface ActivityLog {
  id: number;
  action: string;
  detail: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영', cleaning_dispatch: '청소배정', field: '현장',
};

const LAYER_LABELS: Record<string, string> = {
  founder: 'Founder / GOT', etf: 'ETF / Executive', execution: 'Execution',
};

const ACTION_LABELS: Record<string, string> = {
  issue_created: '이슈 생성', issue_assigned: '배정', issue_escalated: '에스컬레이트',
  issue_resolved: '해결', issue_delegated: '업무지시', status_changed: '상태 변경',
  lifecycle_changed: '상태 전환', onboarding_checked: '체크리스트',
};

type Tab = 'overview' | 'attendance' | 'activity' | 'documents';

export default function MyPage() {
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const token = localStorage.getItem('token');

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<MyStats | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 이번달 범위
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/users/team-stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/attendance/report?start=${monthStart}&end=${today}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/activity-logs?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([statsData, attData, logData]) => {
      const me = (Array.isArray(statsData) ? statsData : []).find((s: { user_id: number }) => s.user_id === user?.id);
      if (me) setStats(me.stats);
      const myAtt = (attData.attendance || []).filter((a: { user_id: number }) => a.user_id === user?.id);
      setAttendance(myAtt.slice(0, 30));
      const myLogs = (logData.logs || []).filter((l: { user_name: string }) => l.user_name === user?.name);
      setActivities(myLogs);
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return <div className="text-center text-gray-400 py-16">로그인 정보가 없습니다</div>;

  const totalMinutes = attendance.reduce((s, a) => s + (a.duration || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const avgHoursPerDay = attendance.length > 0 ? (totalMinutes / attendance.length / 60).toFixed(1) : '0';
  const workDays = attendance.filter(a => a.duration > 0).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* 프로필 헤더 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xl font-bold">{(user.name || '?').charAt(0)}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">
                {ROLE_LABELS[user.role_title] || user.role_title}
              </span>
              <span className="text-xs text-gray-500">{LAYER_LABELS[user.role_layer] || user.role_layer}</span>
              <span className="text-xs text-gray-400">@{user.login_id}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">이번달 근무</div>
            <div className="text-xl font-bold text-gray-800">{workDays}일 / {totalHours}h</div>
            <div className="text-xs text-gray-500">일평균 {avgHoursPerDay}h</div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([
          { key: 'overview' as Tab, label: '업무 현황' },
          { key: 'attendance' as Tab, label: '근태 이력' },
          { key: 'activity' as Tab, label: '활동 로그' },
          { key: 'documents' as Tab, label: '문서함' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : (
        <>
          {/* 업무 현황 */}
          {tab === 'overview' && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="미처리 이슈" value={stats.open_issues} color={stats.open_issues > 3 ? 'red' : stats.open_issues > 0 ? 'amber' : 'gray'} onClick={() => navigate('/issues')} />
                <StatCard label="오늘 해결" value={stats.resolved_today} color="emerald" onClick={() => navigate('/issues')} />
                <StatCard label="주간 해결" value={stats.resolved_week} color="blue" onClick={() => setTab('activity')} />
                <StatCard label="월간 해결" value={stats.resolved_month} color="indigo" onClick={() => setTab('activity')} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="평균 해결시간" value={`${stats.avg_resolve_hours}h`} color={stats.avg_resolve_hours > 24 ? 'red' : 'gray'} />
                <StatCard label="에스컬레이트 ↑" value={stats.escalated_up} color="gray" />
                <StatCard label="업무지시 ↓" value={stats.delegated_down} color="gray" />
                <StatCard label="주간 활동" value={stats.activity_week} color="gray" onClick={() => setTab('activity')} />
              </div>

              {/* KPI 달성 게이지 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3">KPI 달성 현황</h3>
                <div className="space-y-3">
                  <KpiRow label="이슈 해결률" current={stats.resolved_week} target={stats.resolved_week + stats.open_issues} unit="건" />
                  <KpiRow label="평균 해결시간" current={Math.max(0, 24 - stats.avg_resolve_hours)} target={24} unit="h (목표 24h 이내)" />
                  <KpiRow label="주간 활동량" current={stats.activity_week} target={30} unit="건 (목표 30건)" />
                </div>
              </div>
            </div>
          )}

          {/* 근태 이력 */}
          {tab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500">출근일수</div>
                  <div className="text-2xl font-bold text-gray-800">{workDays}일</div>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500">총 근무시간</div>
                  <div className="text-2xl font-bold text-blue-700">{totalHours}h {totalMinutes % 60}m</div>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                  <div className="text-xs text-gray-500">일평균</div>
                  <div className="text-2xl font-bold text-emerald-700">{avgHoursPerDay}h</div>
                </div>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2 text-xs text-gray-500">날짜</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">출근</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">퇴근</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">근무시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendance.map((a, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{new Date(a.login_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{new Date(a.login_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{a.logout_at ? new Date(a.logout_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '접속 중'}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {a.duration > 0 ? `${Math.floor(a.duration / 60)}h ${a.duration % 60}m` : '-'}
                        </td>
                      </tr>
                    ))}
                    {attendance.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-gray-400">근태 기록이 없습니다</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 활동 로그 */}
          {tab === 'activity' && (
            <div className="bg-white border rounded-xl p-5">
              {activities.length === 0 ? (
                <div className="text-center text-gray-400 py-8">기록된 활동이 없습니다</div>
              ) : (
                <div className="space-y-3">
                  {activities.map(l => (
                    <div key={l.id} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {ACTION_LABELS[l.action] || l.action}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(l.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{l.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 문서함 */}
          {tab === 'documents' && (
            <div className="space-y-3">
              {/* 재직증명서 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">재직증명서</div>
                  <div className="text-xs text-gray-500 mt-0.5">현재 재직 중인 것을 증명하는 문서</div>
                </div>
                <button onClick={() => {
                  const content = `재직증명서\n\n성명: ${user.name}\n직위: ${ROLE_LABELS[user.role_title] || user.role_title}\n소속: HIERO (${LAYER_LABELS[user.role_layer]})\n재직기간: 2026.03 ~ 현재\n\n위 사실을 증명합니다.\n\n${today}\nHIERO 대표 김진우`;
                  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `재직증명서_${user.name}_${today}.txt`; a.click();
                }} className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                  다운로드
                </button>
              </div>

              {/* 근태확인서 */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">근태확인서</div>
                  <div className="text-xs text-gray-500 mt-0.5">이번달 출퇴근 기록 확인서</div>
                </div>
                <button onClick={() => {
                  let content = `근태확인서\n\n성명: ${user.name}\n직위: ${ROLE_LABELS[user.role_title]}\n기간: ${monthStart} ~ ${today}\n출근일수: ${workDays}일\n총 근무시간: ${totalHours}시간 ${totalMinutes % 60}분\n일평균: ${avgHoursPerDay}시간\n\n상세 기록:\n`;
                  attendance.forEach(a => {
                    const d = new Date(a.login_at);
                    const login = d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const logout = a.logout_at ? new Date(a.logout_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '접속중';
                    const dur = a.duration > 0 ? `${Math.floor(a.duration / 60)}h${a.duration % 60}m` : '-';
                    content += `${login} ~ ${logout} (${dur})\n`;
                  });
                  content += `\n위 사실을 확인합니다.\n${today}\nHIERO`;
                  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `근태확인서_${user.name}_${monthStart.slice(0,7)}.txt`; a.click();
                }} className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                  다운로드
                </button>
              </div>

              {/* 준비 중 문서 */}
              {[
                { title: '급여명세서', desc: '월별 급여 내역 (세무사 확정 후 제공)' },
                { title: '업무평가서', desc: '분기별 KPI 달성 기반 업무 평가' },
                { title: '원천징수영수증', desc: '연간 원천징수 내역 (세무사 확정 후)' },
              ].map(doc => (
                <div key={doc.title} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{doc.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{doc.desc}</div>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">준비 중</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AiAgentPanel page="mypage" pageLabel="마이페이지" getPageData={() => {
        if (!stats) return '';
        return `${user.name}(${ROLE_LABELS[user.role_title]}): 미처리=${stats.open_issues},주간해결=${stats.resolved_week},평균${stats.avg_resolve_hours}h,근무${workDays}일/${totalHours}h`;
      }} />
    </div>
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number | string; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    red: 'text-red-700', amber: 'text-amber-700', emerald: 'text-emerald-700',
    blue: 'text-blue-700', indigo: 'text-indigo-700', gray: 'text-gray-700',
  };
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 text-center ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition' : ''}`} onClick={onClick}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colors[color] || 'text-gray-700'}`}>{typeof value === 'number' ? fmt(value) : value}</div>
    </div>
  );
}

function KpiRow({ label, current, target, unit }: { label: string; current: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium text-gray-700">{current}/{target} {unit} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
