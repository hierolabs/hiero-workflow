import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ROLE_CONFIGS, type TodoRule } from './config';

// --- Types ---

interface Issue {
  id: number;
  title: string;
  priority: string;
  status: string;
  issue_type: string;
  property_name: string;
  created_at: string;
}

interface ExecutionData {
  name: string;
  today_tasks: Issue[];
  delayed_tasks: Issue[];
  my_issues: Issue[];
  today_count: number;
  delayed_count: number;
  resolved_today: number;
}

interface Directive {
  id: number;
  type: string;
  from_role: string;
  from_user_name: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  created_at: string;
}

interface CalendarData {
  today_checkins: number;
  today_checkouts: number;
  turnover: number;
  in_house: number;
  vacant: number;
  tomorrow_checkins: number;
}

interface CleaningData {
  total: number;
  pending: number;
  assigned: number;
  in_progress: number;
  completed: number;
}

interface CleanerLoad {
  cleaner_name: string;
  assigned: number;
  completed: number;
  in_progress: number;
}

interface ChecklistData {
  total: number;
  completed: number;
  rate: number;
}

// --- Constants ---

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-gray-100 text-gray-600',
};

const URGENCY_COLORS: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
};

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO', founder: 'GOT',
};

// --- Component ---

export default function ExecutionDashboard() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const config = ROLE_CONFIGS[role ?? ''];

  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [cleaning, setCleaning] = useState<CleaningData | null>(null);
  const [cleanerWorkload, setCleanerWorkload] = useState<CleanerLoad[]>([]);
  const [messages, setMessages] = useState<{ unread: number }>({ unread: 0 });
  const [issues, setIssues] = useState<{ total: number; open: number }>({ total: 0, open: 0 });
  const [lifecycle, setLifecycle] = useState<Record<string, number>>({});
  const [leads, setLeads] = useState<{ active_leads: number; total: number }>({ active_leads: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<number | null>(null);
  const [reportMemo, setReportMemo] = useState('');

  const fetchData = useCallback(() => {
    if (!config) return;
    setLoading(true);

    const calls: Record<string, Promise<{ data: unknown }>> = {};

    calls.execution = api.get(`/execution/${role}`).catch(() => ({ data: null }));
    calls.directives = api.get(`/directives/received?role=${config.backendKey}`).catch(() => ({ data: { directives: [] } }));
    calls.checklist = api.get('/checklist/summary').catch(() => ({ data: null }));

    if (config.apis.includes('calendar')) calls.calendar = api.get('/calendar/summary').catch(() => ({ data: null }));
    if (config.apis.includes('messages')) calls.messages = api.get('/messages/stats').catch(() => ({ data: { unread: 0 } }));
    if (config.apis.includes('cleaning')) calls.cleaning = api.get('/cleaning/summary').catch(() => ({ data: null }));
    if (config.apis.includes('cleaningWorkload')) calls.cleaningWorkload = api.get('/cleaning/workload').catch(() => ({ data: [] }));
    if (config.apis.includes('issues')) calls.issues = api.get('/issues/summary').catch(() => ({ data: { total: 0, open: 0 } }));
    if (config.apis.includes('lifecycle')) calls.lifecycle = api.get('/lifecycle/pipeline').catch(() => ({ data: {} }));
    if (config.apis.includes('leads')) calls.leads = api.get('/marketing/dashboard').catch(() => ({ data: { active_leads: 0, total: 0 } }));

    const keys = Object.keys(calls);
    Promise.all(Object.values(calls)).then(results => {
      const data: Record<string, unknown> = {};
      keys.forEach((k, i) => { data[k] = results[i].data; });

      setExecution(data.execution as ExecutionData);
      setDirectives(((data.directives as { directives?: Directive[] })?.directives) ?? []);
      setChecklist(data.checklist as ChecklistData);
      if (data.calendar) {
        const cal = data.calendar as { data?: CalendarData } & CalendarData;
        setCalendar(cal.data ?? cal);
      }
      if (data.messages) setMessages(data.messages as { unread: number });
      if (data.cleaning) setCleaning(data.cleaning as CleaningData);
      if (data.cleaningWorkload) setCleanerWorkload((data.cleaningWorkload as { cleaners?: CleanerLoad[] })?.cleaners ?? data.cleaningWorkload as CleanerLoad[] ?? []);
      if (data.issues) setIssues(data.issues as { total: number; open: number });
      if (data.lifecycle) setLifecycle(data.lifecycle as Record<string, number>);
      if (data.leads) setLeads(data.leads as { active_leads: number; total: number });
    }).finally(() => setLoading(false));
  }, [config, role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDirectiveAction = async (id: number, action: string, memo?: string) => {
    try {
      if (action === 'complete') {
        await api.patch(`/directives/${id}/complete`, { result_memo: memo || '' });
      } else {
        await api.patch(`/directives/${id}/${action}`);
      }
      setReportId(null);
      setReportMemo('');
      fetchData();
    } catch { alert('처리 실패'); }
  };

  if (!config) return <div className="flex items-center justify-center h-64 text-gray-500">알 수 없는 역할입니다</div>;
  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  // 오늘 할 일 자동 생성
  const dataSources: Record<string, Record<string, number>> = {
    execution: { today_count: execution?.today_count ?? 0, delayed_count: execution?.delayed_count ?? 0 },
    calendar: calendar as unknown as Record<string, number> ?? {},
    messages: messages as Record<string, number>,
    cleaning: cleaning as unknown as Record<string, number> ?? {},
    issues: issues as Record<string, number>,
    lifecycle: lifecycle,
    leads: leads as Record<string, number>,
  };

  const todos = config.todoRules
    .map((rule: TodoRule) => {
      const src = dataSources[rule.source] ?? {};
      const count = (src[rule.countPath] as number) ?? 0;
      return { ...rule, count, completed: count === 0 };
    })
    .filter(t => t.count > 0 || t.urgency === 'high');

  const todoCompleted = todos.filter(t => t.completed).length;
  const todoTotal = todos.length || 1;
  const progressPct = checklist ? checklist.rate : Math.round((todoCompleted / todoTotal) * 100);

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const activeDirectives = directives.filter(d => d.status !== 'completed' && d.status !== 'rejected');

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${config.color} flex items-center justify-center`}>
            <span className="text-white text-sm font-bold">{config.icon}</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">{config.person}</h1>
            <p className="text-xs text-gray-500">{config.title} · {dateStr} ({dayNames[today.getDay()]})</p>
          </div>
        </div>
        {execution && (
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded">
            오늘 완료 {execution.resolved_today}건
          </span>
        )}
      </div>

      {/* 오늘 할 일 */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">오늘 할 일</h2>
          <span className={`text-xs font-bold ${progressPct >= 80 ? 'text-green-600' : progressPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
            {progressPct}%
          </span>
        </div>
        <div className="bg-gray-100 rounded-full h-2.5 mb-3">
          <div className={`rounded-full h-2.5 transition-all ${progressPct >= 80 ? 'bg-green-500' : progressPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(progressPct, 100)}%` }} />
        </div>
        <div className="space-y-1.5">
          {todos.map(todo => (
            <div key={todo.key} onClick={() => navigate(todo.link)}
              className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-gray-50 transition">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                {todo.completed && <span className="text-white text-[8px]">✓</span>}
              </div>
              <span className={`text-sm flex-1 ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {todo.label(todo.count)}
              </span>
              <span className={`text-xs font-medium ${URGENCY_COLORS[todo.urgency]}`}>
                {todo.urgency === 'high' ? '긴급' : todo.urgency === 'medium' ? '보통' : '여유'}
              </span>
            </div>
          ))}
          {todos.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-3">오늘 할 일이 모두 완료되었습니다</div>
          )}
        </div>
      </section>

      {/* ETF 지시 */}
      {activeDirectives.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2">ETF 지시 ({activeDirectives.length})</h2>
          <div className="space-y-2">
            {activeDirectives.map(d => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                      {ROLE_LABELS[d.from_role] ?? d.from_role}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{d.title}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
                    {STATUS_BADGES[d.status]?.label ?? d.status}
                  </span>
                </div>
                {d.content && <div className="text-xs text-gray-500 mb-2">{d.content}</div>}
                <div className="flex items-center gap-2">
                  {d.status === 'pending' && (
                    <button onClick={() => handleDirectiveAction(d.id, 'acknowledge')}
                      className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">확인</button>
                  )}
                  {(d.status === 'pending' || d.status === 'acknowledged') && (
                    <button onClick={() => handleDirectiveAction(d.id, 'start')}
                      className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100">시작</button>
                  )}
                  <button onClick={() => { setReportId(d.id); setReportMemo(''); }}
                    className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100">완료 보고</button>
                </div>
                {reportId === d.id && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <input type="text" value={reportMemo} onChange={e => setReportMemo(e.target.value)}
                      placeholder="완료 메모" className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                      onKeyDown={e => e.key === 'Enter' && handleDirectiveAction(d.id, 'complete', reportMemo)} autoFocus />
                    <button onClick={() => handleDirectiveAction(d.id, 'complete', reportMemo)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg">보고</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 역할별 섹션 */}
      {config.sections.map(section => (
        <RoleSection key={section.type} section={section} calendar={calendar} cleaning={cleaning}
          cleanerWorkload={cleanerWorkload} issues={issues} lifecycle={lifecycle} leads={leads}
          messages={messages} navigate={navigate} />
      ))}

      {/* 미해결 이슈 */}
      {execution && (execution.today_tasks.length > 0 || execution.delayed_tasks.length > 0) && (
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2">
            미해결 이슈 ({execution.today_tasks.length + execution.delayed_tasks.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y">
            {[...execution.delayed_tasks, ...execution.today_tasks].slice(0, 10).map(iss => (
              <div key={iss.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${PRIORITY_COLORS[iss.priority] ?? 'bg-gray-100'}`}>
                    {iss.priority}
                  </span>
                  <span className="text-sm text-gray-900 truncate">{iss.title}</span>
                </div>
                {iss.property_name && <span className="text-[10px] text-gray-400 shrink-0 ml-2">{iss.property_name}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 바로가기 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {config.quickLinks.map(link => (
          <button key={link.path} onClick={() => navigate(link.path)}
            className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition">
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Role Section Renderer ---

function RoleSection({ section, calendar, cleaning, cleanerWorkload, issues, lifecycle, leads, messages, navigate }: {
  section: { type: string; title: string };
  calendar: CalendarData | null; cleaning: CleaningData | null; cleanerWorkload: CleanerLoad[];
  issues: { total: number; open: number }; lifecycle: Record<string, number>;
  leads: { active_leads: number; total: number }; messages: { unread: number };
  navigate: (path: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h2>

      {section.type === 'calendar' && calendar && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          <MC label="체크인" value={calendar.today_checkins} color="text-blue-600" bg="bg-blue-50" onClick={() => navigate('/calendar')} />
          <MC label="체크아웃" value={calendar.today_checkouts} color="text-orange-600" bg="bg-orange-50" onClick={() => navigate('/calendar')} />
          <MC label="턴오버" value={calendar.turnover} color="text-cyan-600" bg="bg-cyan-50" onClick={() => navigate('/cleaning')} />
          <MC label="재실" value={calendar.in_house} color="text-gray-700" bg="bg-gray-50" />
          <MC label="공실" value={calendar.vacant} color="text-amber-600" bg="bg-amber-50" alert={calendar.vacant > 15} />
        </div>
      )}

      {section.type === 'messages' && (
        <div onClick={() => navigate('/messages')}
          className={`rounded-xl p-4 cursor-pointer transition ${messages.unread > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">미읽은 메시지</span>
            <span className={`text-2xl font-black ${messages.unread > 0 ? 'text-red-600' : 'text-gray-300'}`}>{messages.unread}</span>
          </div>
        </div>
      )}

      {section.type === 'cleaning' && cleaning && (
        <div className="grid grid-cols-4 gap-2">
          <MC label="대기" value={cleaning.pending} color="text-amber-600" bg="bg-amber-50" alert={cleaning.pending > 0} />
          <MC label="배정" value={cleaning.assigned} color="text-blue-600" bg="bg-blue-50" />
          <MC label="진행" value={cleaning.in_progress} color="text-purple-600" bg="bg-purple-50" />
          <MC label="완료" value={cleaning.completed} color="text-green-600" bg="bg-green-50" />
        </div>
      )}

      {section.type === 'cleaningWorkload' && cleanerWorkload.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y">
          {cleanerWorkload.map(c => (
            <div key={c.cleaner_name} className="flex items-center justify-between p-3">
              <span className="text-sm font-medium text-gray-900">{c.cleaner_name}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-600">배정 {c.assigned}</span>
                <span className="text-purple-600">진행 {c.in_progress}</span>
                <span className="text-green-600">완료 {c.completed}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {section.type === 'issues' && (
        <div onClick={() => navigate('/issues')}
          className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">미해결 이슈</span>
            <span className={`text-2xl font-black ${issues.open > 5 ? 'text-red-600' : issues.open > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{issues.open}</span>
          </div>
        </div>
      )}

      {section.type === 'lifecycle' && Object.keys(lifecycle).length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {[
            { k: 'setting', l: '세팅', c: 'text-amber-600', b: 'bg-amber-50' },
            { k: 'filming', l: '촬영', c: 'text-violet-600', b: 'bg-violet-50' },
            { k: 'ota_registering', l: 'OTA', c: 'text-blue-600', b: 'bg-blue-50' },
            { k: 'operation_ready', l: '준비', c: 'text-cyan-600', b: 'bg-cyan-50' },
            { k: 'active', l: 'Active', c: 'text-green-600', b: 'bg-green-50' },
          ].map(s => (
            <MC key={s.k} label={s.l} value={lifecycle[s.k] ?? 0} color={s.c} bg={s.b} onClick={() => navigate('/properties')} />
          ))}
        </div>
      )}

      {section.type === 'leads' && (
        <div onClick={() => navigate('/leads')}
          className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">활성 리드</span>
            <span className={`text-2xl font-black ${leads.active_leads > 0 ? 'text-pink-600' : 'text-gray-300'}`}>{leads.active_leads}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function MC({ label, value, color, bg, alert, onClick }: {
  label: string; value: number; color: string; bg: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={`${bg} rounded-xl p-3 text-center ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} transition ${alert ? 'ring-2 ring-red-300' : ''}`}>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
