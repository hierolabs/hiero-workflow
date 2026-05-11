import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Summary {
  check_ins: number; check_outs: number; issues_created: number;
  issues_pending: number; detections: number; cleaning_tasks: number;
}
interface FeedItem {
  type: string; title: string; detail: string; severity: string;
  assignee: string; ref_id: number; ref_type: string;
}
interface Issue {
  id: number; title: string; priority: string; status: string;
  issue_type: string; assignee_name: string; property_name: string; created_at: string;
}
interface Detection {
  id: number; conversation_id: string; guest_name: string; guest_name_clean?: string; property_name: string;
  detected_category: string; detected_keywords: string; severity: string;
  message_content: string; status: string; assigned_to: string; ai_assisted: boolean;
  created_at: string; responded_at: string | null; resolved_at: string | null;
  resolution_type: string; resolution_team: string; response_time_sec: number; resolve_time_sec: number;
}
interface ResolvedStats {
  guide_count: number; action_count: number; avg_response_sec: number; avg_resolve_sec: number;
}

const DET_CAT: Record<string, string> = {
  checkin: '체크인', parking: '주차', boiler: '보일러',
  cleaning: '청소', reservation: '예약', emergency: '긴급',
};

interface PulseItem {
  key: string; label: string; frequency: string;
  total: number; done: number; pct: number;
  color: string; link: string;
}
interface PulseData {
  daily: PulseItem[]; weekly: PulseItem[]; monthly: PulseItem[];
  overall_pct: number;
}

const FEED_TAG: Record<string, { label: string; color: string }> = {
  checkin: { label: 'IN', color: 'bg-blue-100 text-blue-700' },
  checkout: { label: 'OUT', color: 'bg-gray-100 text-gray-600' },
  issue_assigned: { label: '이슈', color: 'bg-red-100 text-red-700' },
  issue_detected: { label: '감지', color: 'bg-amber-100 text-amber-700' },
  cleaning: { label: '청소', color: 'bg-emerald-100 text-emerald-700' },
};
const P_COLOR: Record<string, string> = {
  P0: 'bg-red-100 text-red-700', P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700', P3: 'bg-gray-100 text-gray-600',
};
const BAR_COLOR: Record<string, string> = {
  blue: 'bg-blue-500', gray: 'bg-gray-400', cyan: 'bg-emerald-500',
  red: 'bg-red-500', amber: 'bg-amber-500', purple: 'bg-purple-500',
  indigo: 'bg-indigo-500', green: 'bg-emerald-500', orange: 'bg-orange-500',
  teal: 'bg-teal-500',
};

// 현재 시간대 판별
function getCurrentBlock(): string {
  const h = new Date().getHours();
  if (h < 10) return 'morning';
  if (h < 13) return 'midday';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// 시간대별 업무 정의 (데이터 분석 기반)
const TIME_BLOCKS = [
  {
    id: 'morning',
    time: '06:00 — 10:00',
    label: '오늘 준비',
    tasks: [
      { text: '체크인 안내 발송', link: '/messages', key: 'manual_checkin' },
      { text: '오늘 청소 배정 확인', link: '/cleaning', key: 'cleaning' },
      { text: '어제 미해결 이슈 확인', link: '/issues?status=open', key: 'issues' },
      { text: '이슈 감지 처리', link: '/issue-detections', key: 'detections' },
    ],
  },
  {
    id: 'midday',
    time: '10:00 — 13:00',
    label: '체크인 응대 · 현장',
    tasks: [
      { text: '얼리/레이트 체크인 요청 응대', link: '/messages', key: 'early_late' },
      { text: '현장 이슈 대응', link: '/issues', key: 'issues' },
    ],
  },
];

function OverallRing({ pct }: { pct: number }) {
  const r = 40, c = 2 * Math.PI * r;
  const offset = c - (c * pct) / 100;
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{pct}%</span>
        <span className="text-xs text-gray-500">진행률</span>
      </div>
    </div>
  );
}

function PulseBar({ item, onClick }: { item: PulseItem; onClick: () => void }) {
  const bar = BAR_COLOR[item.color] || 'bg-gray-400';
  return (
    <button onClick={onClick} className="w-full text-left group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{item.label}</span>
        <span className="text-sm font-semibold text-gray-700">
          {item.done}<span className="text-gray-400 font-normal">/{item.total}</span>
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${Math.max(item.pct, 2)}%` }} />
      </div>
    </button>
  );
}

interface DirectiveItem {
  id: number; type: string; from_role: string; from_user_name: string;
  to_role: string; to_user_name: string; title: string; content: string;
  priority: string; status: string; result_memo: string; deadline: string | null;
  report_type: string; created_at: string;
}

const DIR_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-700' },
  acknowledged: { label: '확인', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '진행', color: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  verified: { label: '확인됨', color: 'bg-emerald-100 text-emerald-700' },
  reopened: { label: '재작업', color: 'bg-orange-100 text-orange-700' },
};
const DIR_TYPE: Record<string, string> = { directive: '↓ 지시', report: '↑ 보고', lateral: '↔ 협의' };
const ROLE_NAME: Record<string, string> = { founder: 'Founder', ceo: 'CEO', cto: 'CTO', cfo: 'CFO', operations: '운영', cleaning_dispatch: '청소배정', field: '현장', marketing: '마케팅' };

export default function TodayDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [resolved, setResolved] = useState<Detection[]>([]);
  const [resolvedStats, setResolvedStats] = useState<ResolvedStats | null>(null);
  const [receivedDirs, setReceivedDirs] = useState<DirectiveItem[]>([]);
  const [sentDirs, setSentDirs] = useState<DirectiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'flow' | 'pulse' | 'feed'>('flow');
  const [actionMemo, setActionMemo] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const currentBlock = getCurrentBlock();

  const loadDetections = () => {
    Promise.all([
      api.get('/issue-detections'),
      api.get('/issue-detections/resolved'),
    ]).then(([detRes, resRes]) => {
      setDetections((detRes.data?.detections || []).filter((d: Detection) => d.status === 'pending' || d.status === 'responding'));
      setResolved(resRes.data?.items || []);
      setResolvedStats(resRes.data?.stats || null);
    });
  };

  const loadDirectives = () => {
    if (!user.id) return;
    Promise.all([
      api.get(`/directives/received?role=${user.role_title}`).catch(() => ({ data: { directives: [] } })),
      api.get(`/directives/sent?user_id=${user.id}`).catch(() => ({ data: { directives: [] } })),
    ]).then(([recvRes, sentRes]) => {
      setReceivedDirs(recvRes.data.directives || []);
      setSentDirs(sentRes.data.directives || []);
    });
  };

  const handleDirAction = async (id: number, action: string, memo?: string) => {
    const body: Record<string, string> = {};
    if (action === 'complete') body.result_memo = memo || '';
    else if (action === 'reject') body.reason = memo || '';
    else if (action === 'verify' || action === 'agree') body.user_name = user.name || '';
    else if (action === 'approve') { body.user_name = user.name || ''; body.comment = memo || ''; }
    else if (action === 'request-revision') { body.user_name = user.name || ''; body.memo = memo || ''; }
    else if (action === 'reopen') { body.user_name = user.name || ''; body.memo = memo || ''; }
    await api.patch(`/directives/${id}/${action}`, body);
    setActionMemo('');
    loadDirectives();
  };

  useEffect(() => {
    Promise.all([
      api.get('/ops/feed'),
      api.get('/issues?status=open&page_size=10'),
      api.get('/ops/pulse'),
      api.get('/issue-detections'),
      api.get('/issue-detections/resolved'),
    ]).then(([feedRes, issueRes, pulseRes, detRes, resRes]) => {
      setSummary(feedRes.data?.summary || null);
      setFeed(feedRes.data?.feed || []);
      setIssues(issueRes.data?.issues || []);
      setPulse(pulseRes.data || null);
      setDetections((detRes.data?.detections || []).filter((d: Detection) => d.status === 'pending' || d.status === 'responding'));
      setResolved(resRes.data?.items || []);
      setResolvedStats(resRes.data?.stats || null);
    }).finally(() => setLoading(false));
    loadDirectives();
  }, []);

  const handleRespond = async (id: number, assignedTo: string, aiAssisted: boolean) => {
    await api.post(`/issue-detections/${id}/respond`, { assigned_to: assignedTo, ai_assisted: aiAssisted });
    loadDetections();
  };

  const handleResolve = async (id: number, type: string, team: string, note: string) => {
    await api.post(`/issue-detections/${id}/resolve`, { resolution_type: type, resolution_team: team, resolution_note: note });
    loadDetections();
  };

  const handleDismiss = async (id: number) => {
    await api.post(`/issue-detections/${id}/dismiss`);
    loadDetections();
  };

  const fmtTime = (sec: number) => sec < 60 ? `${sec}초` : sec < 3600 ? `${Math.floor(sec / 60)}분` : `${Math.floor(sec / 3600)}시간`;

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const checkIns = feed.filter(f => f.type === 'checkin');
  const checkOuts = feed.filter(f => f.type === 'checkout');
  const issueFeed = feed.filter(f => f.type === 'issue_assigned' || f.type === 'issue_detected');

  // pulse에서 key로 수치 찾기
  const getPulse = (key: string): PulseItem | undefined => {
    if (!pulse) return undefined;
    return [...pulse.daily, ...pulse.weekly, ...pulse.monthly].find(p => p.key === key);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {dateStr} ({days[today.getDay()]}) 오늘의 업무
          </h1>
          <p className="mt-1 text-sm text-gray-500">{user.name || '관리자'} — {nowTime}</p>
        </div>
        <button onClick={() => navigate('/messages')}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          게스트 메시지
        </button>
      </div>

      {/* 탭 */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === 'flow'} onClick={() => setTab('flow')}>업무 흐름</TabBtn>
        <TabBtn active={tab === 'pulse'} onClick={() => setTab('pulse')}>Pulse</TabBtn>
        <TabBtn active={tab === 'feed'} onClick={() => setTab('feed')}>피드</TabBtn>
      </div>

      {/* 빠른 이동 */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '예약 관리', path: '/reservations' },
          { label: '청소 관리', path: '/cleaning' },
          { label: '민원/하자', path: '/issues' },
          { label: '메시지', path: '/messages' },
        ].map(l => (
          <button key={l.path} onClick={() => navigate(l.path)}
            className="rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-center text-gray-700 hover:bg-gray-50 transition">
            {l.label}
          </button>
        ))}
      </div>

      {/* ========== 업무 흐름 탭 ========== */}
      {tab === 'flow' && (
        <div className="space-y-3">

          {/* === 내 지시함: 운영 업무만 (Founder는 /founder에서 처리) === */}
          {user.role_layer !== 'founder' && (() => {
            // execution: 내가 받은 지시(directive)만
            // etf: 내가 받은 지시 + 하위에서 올라온 보고
            const needAction = receivedDirs.filter(d =>
              ['pending', 'reopened'].includes(d.status) &&
              (user.role_layer === 'execution' ? d.type === 'directive' : true)
            );
            const needVerify = sentDirs.filter(d =>
              d.status === 'completed' && d.type === 'directive'
            );
            const inProgress = receivedDirs.filter(d =>
              ['acknowledged', 'in_progress'].includes(d.status) && d.type === 'directive'
            );
            if (needAction.length === 0 && needVerify.length === 0 && inProgress.length === 0) return null;

            return (
              <div className="rounded-lg border border-orange-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-orange-900">
                      내 지시함
                      {needAction.length > 0 && <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white rounded-full text-xs">{needAction.length} 처리 필요</span>}
                    </h3>
                  </div>
                  <span className="text-xs text-orange-600">
                    {ROLE_NAME[user.role_title] || user.role_title} · {user.name}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* 처리 필요 (받은 것 중 pending/reopened) */}
                  {needAction.map(d => (
                    <div key={d.id} className="px-4 py-3 bg-orange-50/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-400">{DIR_TYPE[d.type]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${DIR_STATUS[d.status]?.color}`}>{DIR_STATUS[d.status]?.label}</span>
                        {d.priority === 'urgent' && <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-600">긴급</span>}
                        <span className="text-xs text-gray-500">{d.from_user_name} ({ROLE_NAME[d.from_role]})</span>
                        {d.deadline && <span className="text-[10px] text-gray-400 ml-auto">기한: {d.deadline.slice(5, 10)}</span>}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">{d.title}</div>
                      {d.content && <div className="text-xs text-gray-600 mb-2 line-clamp-2">{d.content}</div>}
                      {d.status === 'reopened' && d.result_memo && (
                        <div className="text-xs text-orange-700 bg-orange-50 rounded p-2 mb-2">수정 요청: {d.result_memo}</div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2">
                        {d.type === 'directive' && d.status === 'pending' && (
                          <>
                            <button onClick={() => handleDirAction(d.id, 'acknowledge')}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">확인</button>
                            <button onClick={() => handleDirAction(d.id, 'start')}
                              className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">바로 시작</button>
                          </>
                        )}
                        {d.type === 'directive' && ['acknowledged', 'reopened'].includes(d.status) && (
                          <button onClick={() => handleDirAction(d.id, 'start')}
                            className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">진행 시작</button>
                        )}
                        {d.type === 'report' && (
                          <>
                            <button onClick={() => { const m = prompt('승인 메모:'); handleDirAction(d.id, 'approve', m || ''); }}
                              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">승인</button>
                            <button onClick={() => { const m = prompt('수정 요청:'); if (m) handleDirAction(d.id, 'request-revision', m); }}
                              className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">수정 요청</button>
                          </>
                        )}
                        {d.type === 'lateral' && (
                          <>
                            <button onClick={() => handleDirAction(d.id, 'agree')}
                              className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">합의</button>
                            <button onClick={() => { const m = prompt('대안:'); if (m) handleDirAction(d.id, 'counter', m); }}
                              className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">대안</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 완료 확인 필요 (보낸 것 중 completed) */}
                  {needVerify.map(d => (
                    <div key={d.id} className="px-4 py-3 bg-green-50/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">완료 보고</span>
                        <span className="text-xs text-gray-500">→ {d.to_user_name} ({ROLE_NAME[d.to_role]})</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">{d.title}</div>
                      {d.result_memo && <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2 mb-2">결과: {d.result_memo}</div>}
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDirAction(d.id, 'verify')}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">완료 확인</button>
                        <button onClick={() => { const m = prompt('재작업 사유:'); if (m) handleDirAction(d.id, 'reopen', m); }}
                          className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">재작업</button>
                      </div>
                    </div>
                  ))}

                  {/* 진행 중 (내가 받아서 작업 중인 것) */}
                  {inProgress.map(d => (
                    <div key={d.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-gray-400">{DIR_TYPE[d.type]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${DIR_STATUS[d.status]?.color}`}>{DIR_STATUS[d.status]?.label}</span>
                        <span className="text-xs text-gray-500">{d.from_user_name}</span>
                      </div>
                      <div className="text-sm text-gray-900 mb-1">{d.title}</div>
                      <div className="flex items-center gap-2">
                        <input type="text" value={actionMemo} onChange={e => setActionMemo(e.target.value)}
                          placeholder="완료 메모" className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5"
                          onKeyDown={e => { if (e.key === 'Enter') { handleDirAction(d.id, 'complete', actionMemo); } }} />
                        <button onClick={() => handleDirAction(d.id, 'complete', actionMemo)}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">완료 보고</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {TIME_BLOCKS.map((block, bi) => {
            const isCurrent = block.id === currentBlock;
            const isPast = bi < TIME_BLOCKS.findIndex(b => b.id === currentBlock);
            return (
              <div key={block.id}
                className={`rounded-lg border bg-white overflow-hidden transition-all ${
                  isCurrent ? 'border-slate-400 shadow-sm' : 'border-gray-200'
                }`}>
                {/* 시간대 헤더 */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${
                  isCurrent ? 'bg-slate-800 text-white border-slate-700' :
                  isPast ? 'bg-gray-50 text-gray-400 border-gray-100' :
                  'bg-gray-50 text-gray-700 border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    <span className="text-sm font-semibold">{block.time}</span>
                    <span className={`text-sm ${isCurrent ? 'text-slate-300' : ''}`}>{block.label}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">지금</span>
                  )}
                </div>

                {/* 업무 리스트 — 클릭하면 확장하여 상세 표시 */}
                <div className={`divide-y divide-gray-100 ${isPast ? 'opacity-50' : ''}`}>
                  {block.tasks.map((task, ti) => {
                    const p = getPulse(task.key);
                    const isExpanded = expandedTask === `${block.id}-${ti}`;
                    return (
                      <div key={ti}>
                        <button onClick={() => setExpandedTask(isExpanded ? null : `${block.id}-${ti}`)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition text-left group">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${p && p.pct >= 100 ? 'bg-emerald-500' : p && p.total > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} />
                            <span className={`text-sm group-hover:text-blue-600 ${p && p.pct >= 100 ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {task.text}
                            </span>
                          </div>
                          {p && p.total > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${BAR_COLOR[p.color] || 'bg-gray-400'}`}
                                  style={{ width: `${Math.max(p.pct, 5)}%` }} />
                              </div>
                              <span className={`text-xs font-medium w-10 text-right ${p.pct >= 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                {p.done}/{p.total}
                              </span>
                              <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                          )}
                        </button>

                        {/* 확장: 상세 목록 */}
                        {isExpanded && p && p.total > 0 && (
                          <TaskDetail taskKey={task.key} pulse={p} navigate={navigate} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 미처리 이슈 */}
          {issues.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">미처리 이슈 ({issues.length})</h3>
                <button onClick={() => navigate('/issues?status=open')} className="text-xs text-gray-500 hover:text-gray-700">전체</button>
              </div>
              <div className="divide-y divide-gray-100">
                {issues.slice(0, 5).map(iss => (
                  <div key={iss.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/issues')}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${P_COLOR[iss.priority] || 'bg-gray-100 text-gray-600'}`}>
                        {iss.priority}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{iss.title}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{iss.assignee_name || '미배정'}</span>
                      <span className="text-xs text-gray-400">{iss.created_at?.slice(5, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 감지(왼쪽) / 대응완료(오른쪽) 패널 */}
          {(detections.length > 0 || resolved.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 왼쪽: 감지/대기 */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-amber-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-amber-900">감지 · 대기 ({detections.length})</h3>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {detections.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400 text-center">감지된 이슈 없음</div>
                  ) : detections.map(d => (
                    <div key={d.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {DET_CAT[d.detected_category] || d.detected_category}
                          </span>
                          <span className="text-sm text-gray-900">{d.guest_name_clean || d.guest_name}</span>
                          {d.property_name && <span className="text-xs text-gray-400">{d.property_name}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2 mb-2">{d.message_content}</div>
                      <div className="flex gap-1.5">
                        {d.status === 'pending' && (
                          <>
                            <button onClick={() => handleRespond(d.id, user.name || '', false)}
                              className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">대응 시작</button>
                            <button onClick={() => handleRespond(d.id, '', true)}
                              className="rounded border border-purple-300 px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50">AI 활용</button>
                            <button onClick={() => navigate(`/messages?conv=${d.conversation_id}`)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">메시지</button>
                            <button onClick={() => handleDismiss(d.id)}
                              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50">무시</button>
                          </>
                        )}
                        {d.status === 'responding' && (
                          <>
                            <span className="text-xs text-blue-600">{d.assigned_to || '대응 중'}{d.ai_assisted ? ' (AI)' : ''}</span>
                            <button onClick={() => handleResolve(d.id, 'guide', 'office', '')}
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50">안내 완료</button>
                            <button onClick={() => handleResolve(d.id, 'action', 'field', '')}
                              className="rounded border border-orange-300 px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50">조치 완료</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 오른쪽: 대응완료 */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-emerald-50">
                  <h3 className="text-sm font-semibold text-emerald-900">대응 완료 ({resolved.length})</h3>
                  {resolvedStats && (
                    <div className="flex gap-3 text-xs">
                      <span className="text-gray-500">안내 {resolvedStats.guide_count}</span>
                      <span className="text-gray-500">조치 {resolvedStats.action_count}</span>
                      <span className="text-gray-500">평균 {fmtTime(resolvedStats.avg_resolve_sec)}</span>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {resolved.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400 text-center">오늘 대응 완료 건 없음</div>
                  ) : resolved.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.resolution_type === 'guide' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {d.resolution_type === 'guide' ? '안내' : '조치'}
                        </span>
                        <span className="text-sm text-gray-900 truncate">
                          {d.guest_name_clean || d.guest_name} · {DET_CAT[d.detected_category] || d.detected_category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {d.ai_assisted && <span className="text-xs text-purple-500">AI</span>}
                        <span className="text-xs text-gray-400">{fmtTime(d.resolve_time_sec)}</span>
                        <span className={`text-xs ${d.resolution_team === 'office' ? 'text-blue-500' : 'text-orange-500'}`}>
                          {d.resolution_team === 'office' ? '사무실' : '현장'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== Pulse 탭 ========== */}
      {tab === 'pulse' && pulse && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-center flex flex-col items-center justify-center">
              <OverallRing pct={pulse.overall_pct} />
            </div>
            <SummaryCard label="일간 완료" value={pulse.daily.reduce((s, d) => s + d.done, 0)} />
            <SummaryCard label="주간 완료" value={pulse.weekly.reduce((s, d) => s + d.done, 0)} />
            <SummaryCard label="월간 완료" value={pulse.monthly.reduce((s, d) => s + d.done, 0)} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Pulse</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              {pulse.daily.map(item => (
                <PulseBar key={item.key} item={item} onClick={() => navigate(item.link)} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Pulse</h3>
              <div className="space-y-4">
                {pulse.weekly.map(item => (
                  <PulseBar key={item.key} item={item} onClick={() => navigate(item.link)} />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Pulse</h3>
              <div className="space-y-4">
                {pulse.monthly.map(item => (
                  <PulseBar key={item.key} item={item} onClick={() => navigate(item.link)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 피드 탭 ========== */}
      {tab === 'feed' && (
        <div className="space-y-4">
          {summary && (
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: '체크인', value: summary.check_ins, color: 'text-blue-600', link: '/reservations' },
                { label: '체크아웃', value: summary.check_outs, color: 'text-gray-600', link: '/reservations' },
                { label: '미처리 이슈', value: summary.issues_pending, color: 'text-red-600', link: '/issues?status=open' },
                { label: '오늘 이슈', value: summary.issues_created, color: 'text-yellow-600', link: '/issues' },
                { label: '이슈 감지', value: summary.detections, color: 'text-amber-600', link: '/messages' },
                { label: '청소', value: summary.cleaning_tasks, color: 'text-green-600', link: '/cleaning' },
              ].map(k => (
                <button key={k.label} onClick={() => navigate(k.link)}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-center hover:bg-gray-50 transition">
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FeedCard title={`체크인 (${checkIns.length})`} badge="IN" badgeColor="bg-blue-100 text-blue-700"
              empty="오늘 체크인 없음" items={checkIns} prefix="체크인: " navigate={navigate} />
            <FeedCard title={`체크아웃 (${checkOuts.length})`} badge="OUT" badgeColor="bg-gray-100 text-gray-600"
              empty="오늘 체크아웃 없음" items={checkOuts} prefix="체크아웃: " navigate={navigate} />
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                <span className="text-sm font-semibold text-gray-700">이슈/감지 ({issueFeed.length})</span>
                <button onClick={() => navigate('/issues')} className="text-xs text-gray-500 hover:text-gray-700">전체 보기</button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                {issueFeed.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">오늘 이슈 없음</div>
                ) : issueFeed.slice(0, 10).map((f, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEED_TAG[f.type]?.color || 'bg-gray-100'}`}>
                        {FEED_TAG[f.type]?.label || ''}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{f.title}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== Shared =====================
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>;
}
function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-3 text-center"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>;
}
function FeedCard({ title, badge, badgeColor, empty, items, prefix, navigate }: {
  title: string; badge: string; badgeColor: string; empty: string;
  items: FeedItem[]; prefix: string; navigate: (path: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badge}</span>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">{empty}</div>
        ) : items.map((f, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="text-sm text-gray-900">{f.title.replace(prefix, '')}</div>
            <div className="text-xs text-gray-500">{f.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === TaskDetail: 업무 항목 클릭 시 상세 목록 + 체크포인트 ===
function TaskDetail({ taskKey, navigate }: { taskKey: string; pulse: PulseItem; navigate: (p: string) => void }) {
  const [items, setItems] = useState<{id: number; label: string; sub: string; done: boolean; checkStatus: string; link: string}[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const userName = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || ''; } catch { return ''; } })();

  const API_URL = import.meta.env.VITE_API_URL;
  const headers = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' });

  const loadChecks = async (rawItems: {id: number; label: string; sub: string; done: boolean; link: string}[]) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`${API_URL}/daily-tasks?date=${today}&task_key=${taskKey}`, { headers: headers() });
      const d = await res.json();
      const checks = d.checks || [];
      const checkMap: Record<number, string> = {};
      checks.forEach((c: {ref_id: number; status: string}) => { checkMap[c.ref_id] = c.status; });
      setItems(rawItems.map(item => ({
        ...item,
        checkStatus: checkMap[item.id] || '',
        done: item.done || !!checkMap[item.id],
      })));
    } catch {
      setItems(rawItems.map(item => ({ ...item, checkStatus: '' })));
    }
  };

  const doCheck = async (refId: number, status: string) => {
    await fetch(`${API_URL}/daily-tasks/check`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ task_key: taskKey, ref_id: refId, status, checked_by: userName }),
    });
    // 갱신
    setItems(prev => prev.map(item =>
      item.id === refId ? { ...item, checkStatus: status, done: true } : item
    ));
  };

  const doBulkCheck = async (status: string) => {
    const unchecked = items.filter(i => !i.checkStatus);
    if (unchecked.length === 0) return;
    await fetch(`${API_URL}/daily-tasks/bulk-check`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ task_key: taskKey, ref_ids: unchecked.map(i => i.id), status, checked_by: userName }),
    });
    setItems(prev => prev.map(item =>
      !item.checkStatus ? { ...item, checkStatus: status, done: true } : item
    ));
    setShowBulk(false);
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const h = headers();

    const load = async () => {
      let rawItems: {id: number; label: string; sub: string; done: boolean; link: string}[] = [];

      if (taskKey === 'manual_checkin') {
        const res = await fetch(`${API_URL}/daily-tasks/checkin-targets?date=${today}`, { headers: h });
        const d = await res.json();
        const manual = d.reservations || [];
        rawItems = manual.map((r: {id:number;guest_name:string;guest_name_clean?:string;channel_name:string;property_name:string;conversation_id:string}) => ({
          id: r.id, label: `${r.guest_name_clean || r.guest_name} — ${r.channel_name}`, sub: r.property_name || '',
          done: !!r.conversation_id, link: '/messages',
        }));
      } else if (taskKey === 'cleaning') {
        const res = await fetch(`${API_URL}/cleaning/tasks?cleaning_date=${today}&page_size=50`, { headers: h });
        const d = await res.json();
        rawItems = (d.tasks || []).map((t: {id:number;property_name:string;cleaner_name:string;status:string}) => ({
          id: t.id,
          label: t.property_name || `청소 #${t.id}`,
          sub: `${t.cleaner_name || '미배정'} · ${t.status === 'completed' ? '완료' : t.status === 'assigned' ? '배정됨' : '대기'}`,
          done: t.status === 'completed',
          link: '/cleaning',
        }));
      } else if (taskKey === 'issues') {
        const res = await fetch(`${API_URL}/issues?status=open&page_size=20`, { headers: h });
        const d = await res.json();
        rawItems = (d.issues || []).map((i: {id:number;title:string;assignee_name:string;priority:string}) => ({
          id: i.id, label: `[${i.priority}] ${i.title}`, sub: i.assignee_name || '미배정',
          done: false, link: '/issues',
        }));
      } else if (taskKey === 'detections') {
        const res = await fetch(`${API_URL}/issue-detections`, { headers: h });
        const d = await res.json();
        const dets = (d.detections || []).filter((x: {status:string}) => x.status === 'pending' || x.status === 'responding');
        rawItems = dets.map((x: {id:number;guest_name:string;guest_name_clean?:string;detected_category:string;property_name:string;status:string}) => ({
          id: x.id, label: `${x.guest_name_clean || x.guest_name} — ${x.detected_category}`, sub: x.property_name || '',
          done: x.status !== 'pending', link: '/issue-detections',
        }));
      } else if (taskKey === 'early_late') {
        const res = await fetch(`${API_URL}/issue-detections/resolved?start=${today}&end=${today}`, { headers: h });
        const d = await res.json();
        const items = (d.items || []).filter((x: {detected_category:string;detected_keywords:string}) =>
          x.detected_category === 'checkin' || (x.detected_keywords || '').includes('연장') || (x.detected_keywords || '').includes('레이트')
        );
        rawItems = items.map((x: {id:number;guest_name:string;guest_name_clean?:string;detected_keywords:string;property_name:string;status:string;message_content:string}) => ({
          id: x.id,
          label: `${x.guest_name_clean || x.guest_name} — ${x.detected_keywords}`,
          sub: x.property_name || '',
          done: x.status === 'resolved',
          link: '/messages',
        }));
      }

      await loadChecks(rawItems);
      setLoaded(true);
    };

    load().catch(() => setLoaded(true));
  }, [taskKey]);

  if (!loaded) return <div className="px-6 py-2 text-xs text-gray-400">로딩...</div>;
  if (items.length === 0) return <div className="px-6 py-2 text-xs text-gray-400">해당 항목 없음</div>;

  const uncheckedCount = items.filter(i => !i.checkStatus).length;
  const STATUS_BADGE: Record<string, {label: string; color: string}> = {
    completed: { label: '완료', color: 'bg-emerald-500 text-white' },
    rejected: { label: '반려', color: 'bg-red-500 text-white' },
    deleted: { label: '삭제', color: 'bg-gray-500 text-white' },
  };

  return (
    <div className="bg-gray-50 border-t border-gray-100 px-4 py-2">
      {/* 일괄 처리 버튼 */}
      {uncheckedCount > 0 && (
        <div className="flex items-center justify-between py-2 mb-1 border-b border-gray-200">
          <span className="text-xs text-gray-500">미처리 {uncheckedCount}건</span>
          <button onClick={() => setShowBulk(true)}
            className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            일괄 처리
          </button>
        </div>
      )}

      {/* 일괄 처리 팝업 */}
      {showBulk && (
        <div className="mb-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="text-sm font-medium text-indigo-900 mb-2">미처리 {uncheckedCount}건 일괄 처리</div>
          <div className="flex gap-2">
            <button onClick={() => doBulkCheck('completed')}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              전체 완료
            </button>
            <button onClick={() => doBulkCheck('rejected')}
              className="px-4 py-2 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600">
              전체 반려
            </button>
            <button onClick={() => doBulkCheck('deleted')}
              className="px-4 py-2 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600">
              전체 삭제
            </button>
            <button onClick={() => setShowBulk(false)}
              className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 ml-auto">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 항목 목록 */}
      <div className="space-y-0.5">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white transition group">
            {/* 상태 뱃지 */}
            {item.checkStatus ? (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[item.checkStatus]?.color || 'bg-gray-100'}`}>
                {STATUS_BADGE[item.checkStatus]?.label || item.checkStatus}
              </span>
            ) : (
              <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" />
            )}

            {/* 내용 */}
            <span className={`text-sm flex-1 cursor-pointer hover:text-blue-600 ${item.checkStatus ? 'text-gray-400 line-through' : 'text-gray-800'}`}
              onClick={() => navigate(item.link)}>
              {item.label}
            </span>
            <span className="text-xs text-gray-400">{item.sub}</span>

            {/* 액션 버튼 (미처리일 때만) */}
            {!item.checkStatus && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => doCheck(item.id, 'completed')}
                  className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">완료</button>
                <button onClick={() => doCheck(item.id, 'rejected')}
                  className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded hover:bg-red-200">반려</button>
                <button onClick={() => doCheck(item.id, 'deleted')}
                  className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200">삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-400 pt-1.5 mt-1 border-t border-gray-100 flex justify-between">
        <span>{items.filter(i => i.checkStatus === 'completed').length}/{items.length} 완료</span>
        {items.some(i => i.checkStatus === 'rejected') && <span className="text-red-500">{items.filter(i => i.checkStatus === 'rejected').length}건 반려</span>}
      </div>
    </div>
  );
}
