import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import OperationManual from "../components/OperationManual";
import {
  getConversations,
  getConversation,
  sendMessage,
  syncMessages,
  syncConversationMessages,
  createGuestRequest,
  updateGuestRequestStatus,
} from "../utils/message-api";
import api from "../utils/api";

interface Conversation {
  id: number;
  conversation_id: string;
  reservation_code: string;
  property_id: number;
  guest_name: string;
  channel_type: string;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  detection_count: number;
  max_severity: string;
  property_name: string;
  check_in: string;
  check_out: string;
  stay_status: string;
  guest_type: string; // inquiry, cancelled, upcoming, checking_in, in_house, checked_out, past
  reservation_status: string;
  message_date: string;
  // 감지 처리 성과
  resolved_count: number;
  avg_response_sec: number;
  last_handler: string;
  last_status: string;
  ai_assisted: boolean;
}
interface PerformanceSummary {
  total_detected: number;
  total_resolved: number;
  total_pending: number;
  avg_response_sec: number;
  ai_count: number;
  by_handler: Record<string, number>;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}
interface ReservationInfo {
  reservation_code: string; check_in: string; check_out: string;
  nights: number; status: string; guest_name: string; property_name: string;
  channel: string; total_rate: number;
}
interface Detection {
  id: number; message_id: number; conversation_id: string; reservation_code: string;
  detected_category: string; severity: string;
  detected_keywords: string; message_content: string; status: string;
  guest_name: string; property_name: string; created_at: string;
  response_time_sec: number; assigned_to: string; resolution_type: string; resolution_note: string;
}

interface Message {
  id: number;
  conversation_id: string;
  sender_type: string;
  content: string;
  message_type: string;
  image_url: string;
  sent_at: string;
}

interface GuestRequest {
  id: number;
  request_type: string;
  note: string;
  status: string;
  created_at: string;
}

const REQUEST_TYPES = [
  { value: "early_checkin", label: "얼리 체크인" },
  { value: "late_checkout", label: "레이트 체크아웃" },
  { value: "extra_towels", label: "수건 추가" },
  { value: "extra_bedding", label: "침구 추가" },
  { value: "luggage_storage", label: "짐 보관" },
  { value: "airport_pickup", label: "공항 픽업" },
  { value: "special_request", label: "기타 요청" },
];

const CAT_LABELS: Record<string, string> = {
  checkin: '체크인', parking: '주차', boiler: '보일러',
  cleaning: '청소', reservation: '예약', emergency: '긴급',
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
};

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [convDetail, setConvDetail] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<'all' | 'urgent' | 'today' | 'yesterday' | 'checkin'>('today');
  const [syncing, setSyncing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newRequestType, setNewRequestType] = useState("special_request");
  const [newRequestNote, setNewRequestNote] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [rightTab, setRightTab] = useState<'detect' | 'requests' | 'issue' | 'ledger'>('detect');
  const [ledger, setLedger] = useState<{ days: any[]; summary: any } | null>(null);
  const [reservationView, setReservationView] = useState<any>(null);
  const [rvLoading, setRvLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{category:string; severity:string; suggested_reply:string; assign_to:string; assign_role:string} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [allDetections, setAllDetections] = useState<Detection[]>([]);
  const [perfSummary, setPerfSummary] = useState<PerformanceSummary | null>(null);
  const [detHistory, setDetHistory] = useState<any[]>([]);
  const [detStatusFilter, setDetStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'issue_created' | 'dismissed'>('all');
  const [detDateFilter, setDetDateFilter] = useState<string>(new Date().toISOString().slice(0, 10)); // 기본 오늘
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 전체 감지 목록 로드
  async function loadAllDetections() {
    // 전체 상태 (pending+resolved+dismissed) 로드 — 이모지/아이콘에 필요
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.get(`/issue-detections?status=all&start=${today}&end=${today}&limit=500`);
    setAllDetections(res.data?.detections || []);
  }

  // 대장 로드
  async function loadLedger() {
    const res = await api.get('/issue-detections/ledger?days=60');
    setLedger(res.data || null);
  }
  useEffect(() => { loadLedger(); }, []);

  // 감지 이력 로드 (날짜+상태)
  async function loadDetHistory(period?: string) {
    const dateParam = detDateFilter ? `&date=${detDateFilter}` : '';
    const res = await api.get(`/issue-detections?status=${detStatusFilter}&limit=500${dateParam}`);
    setDetHistory(res.data?.detections || []);
  }
  useEffect(() => { loadDetHistory(); }, [detStatusFilter, detDateFilter]);

  // 대화 목록 로드 + URL에서 conv 파라미터 처리
  useEffect(() => {
    loadConversations().then(() => {
      const convParam = searchParams.get("conv");
      if (convParam) {
        selectConversation(convParam);
      }
    });
    loadAllDetections();
    const interval = setInterval(() => { loadConversations(); loadAllDetections(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadConversations() {
    const params: Record<string, string> = { page_size: "50" };
    if (keyword) params.keyword = keyword;
    const data = await getConversations(params);
    setConversations(data.conversations || []);
    setPerfSummary(data.performance_summary || null);
  }

  // 대화 선택
  async function selectConversation(convId: string) {
    setSelected(convId);
    setAiSuggestion(null);
    setReservationView(null);
    const data = await getConversation(convId);
    setMessages(data.messages || []);
    setRequests(data.requests || []);
    setConvDetail(data.conversation || null);
    setReservation(data.reservation || null);
    setDetections(data.detections || []);

    setConversations((prev) =>
      prev.map((c) =>
        c.conversation_id === convId ? { ...c, unread_count: 0 } : c
      )
    );
  }

  // 스크롤 하단
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 메시지 발송
  async function handleSend() {
    if (!input.trim() || !selected) return;
    await sendMessage(selected, input);
    setInput("");
    // responding 중인 감지 → 안내 완료 처리
    const respondingDets = allDetections.filter(d => d.conversation_id === selected && d.status === 'responding');
    if (respondingDets.length > 0) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      for (const d of respondingDets) {
        await api.post(`/issue-detections/${d.id}/resolve`, { resolution_type: 'guide', resolution_team: 'office', resolution_note: user.name || '' });
      }
      loadAllDetections();
    }
    // 재로드
    const data = await getConversation(selected);
    setMessages(data.messages || []);
    loadConversations();
  }

  // 동기화
  async function handleSync() {
    setSyncing(true);
    if (selected) {
      await syncConversationMessages(selected);
      const data = await getConversation(selected);
      setMessages(data.messages || []);
    } else {
      await syncMessages();
    }
    await loadConversations();
    setSyncing(false);
  }

  // 요청 생성
  async function handleCreateRequest() {
    if (!selected) return;
    await createGuestRequest(selected, {
      request_type: newRequestType,
      note: newRequestNote,
    });
    setShowRequestForm(false);
    setNewRequestNote("");
    const data = await getConversation(selected);
    setRequests(data.requests || []);
  }

  // 요청 상태 변경
  async function handleRequestStatus(id: number, status: string) {
    await updateGuestRequestStatus(id, status);
    if (selected) {
      const data = await getConversation(selected);
      setRequests(data.requests || []);
    }
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  function getRequestLabel(type: string) {
    return REQUEST_TYPES.find((r) => r.value === type)?.label || type;
  }

  // 메시지 + 감지 통계
  const [statPeriod, setStatPeriod] = useState('today');
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [msgStats, setMsgStats] = useState<{ total: number; guest: number; host: number; convs: number } | null>(null);
  const [detStats, setDetStats] = useState<{
    total: number;
    items: { assigned_to: string; detected_category: string; status: string }[];
    stats: { guide_count: number; action_count: number; ai_count: number; issue_created: number; dismissed: number; pending: number; avg_response_sec: number; avg_resolve_sec: number; categories: { category: string; count: number }[] };
  } | null>(null);

  function getPeriodDates(period: string): [string, string] {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const dow = now.getDay() || 7;
    switch (period) {
      case 'yesterday': { const t = new Date(y, m, d - 1); return [fmt(t), fmt(t)]; }
      case 'today': return [fmt(now), fmt(now)];
      case 'this_week': { const mon = new Date(y, m, d - dow + 1); return [fmt(mon), fmt(now)]; }
      case 'last_week': { const mon = new Date(y, m, d - dow - 6); const sun = new Date(y, m, d - dow); return [fmt(mon), fmt(sun)]; }
      case 'this_month': return [`${y}-${String(m + 1).padStart(2, '0')}-01`, fmt(now)];
      case 'last_month': { const s = new Date(y, m - 1, 1); const e = new Date(y, m, 0); return [fmt(s), fmt(e)]; }
      case 'this_quarter': { const qm = Math.floor(m / 3) * 3; return [`${y}-${String(qm + 1).padStart(2, '0')}-01`, fmt(now)]; }
      case 'last_quarter': { const qm = Math.floor(m / 3) * 3 - 3; const qy = qm < 0 ? y - 1 : y; const qms = qm < 0 ? qm + 12 : qm; const qe = new Date(qy, qms + 3, 0); return [`${qy}-${String(qms + 1).padStart(2, '0')}-01`, fmt(qe)]; }
      case 'this_year': return [`${y}-01-01`, fmt(now)];
      case 'last_year': return [`${y - 1}-01-01`, `${y - 1}-12-31`];
      case 'custom': return [customStart, customEnd];
      case '': return ['2020-01-01', fmt(now)]; // 전체
      default: return [fmt(now), fmt(now)];
    }
  }

  const fmtSec = (s: number) => s < 60 ? `${s}초` : s < 3600 ? `${Math.floor(s/60)}분` : `${Math.floor(s/3600)}시간 ${Math.floor((s%3600)/60)}분`;

  useEffect(() => {
    const [start, end] = getPeriodDates(statPeriod);
    Promise.all([
      api.get(`/messages/stats?start=${start}&end=${end}`),
      api.get(`/issue-detections/resolved?start=${start}&end=${end}`),
    ]).then(([msgRes, detRes]) => {
      setMsgStats(msgRes.data || null);
      setDetStats(detRes.data || null);
    }).catch(() => { setMsgStats(null); setDetStats(null); });
  }, [statPeriod]);

  const PERIOD_OPTIONS = [
    { value: 'today', label: '오늘' },
    { value: 'yesterday', label: '어제' },
    { value: 'this_week', label: '이번 주' },
    { value: 'last_week', label: '지난 주' },
    { value: 'this_month', label: '이번 달' },
    { value: 'last_month', label: '지난 달' },
    { value: 'this_quarter', label: '이번 분기' },
    { value: 'last_quarter', label: '지난 분기' },
    { value: 'this_year', label: '올해' },
    { value: 'last_year', label: '작년' },
    { value: 'custom', label: '기간설정' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-3 sm:-m-6 overflow-hidden">
      {/* 통계 바 — 기간+지표+KPI */}
      <div className="border-b border-gray-200 bg-white px-4 py-2 flex-shrink-0 space-y-1.5">
        {/* 1줄: 기간 선택 + 숫자 지표 */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 flex-shrink-0">
            {PERIOD_OPTIONS.map(p => (
              <button key={p.value} onClick={() => {
                setStatPeriod(p.value);
                setFilter('all'); // 대화 필터 리셋
                // 오른쪽 감지탭 날짜도 동일 기간으로 연동
                const [s] = getPeriodDates(p.value);
                setDetDateFilter(s);
              }}
                className={`px-2 py-0.5 text-xs rounded-full transition ${statPeriod === p.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {p.label}
              </button>
            ))}
            {statPeriod === 'custom' && (
              <div className="flex items-center gap-1 ml-1">
                <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setDetDateFilter(e.target.value); }}
                  className="text-xs border border-gray-300 rounded px-1.5 py-0.5" />
                <span className="text-gray-400">~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1.5 py-0.5" />
              </div>
            )}
          </div>
          {msgStats && (
            <div className="flex gap-2.5 text-xs pl-3 border-l border-gray-200">
              <div><span className="text-gray-400">대화</span> <b className="text-gray-900">{msgStats.convs}</b></div>
              <div><span className="text-gray-400">메시지</span> <b className="text-gray-900">{msgStats.total}</b></div>
            </div>
          )}
          {detStats && (
            <div className="flex gap-2.5 text-xs pl-3 border-l border-gray-200">
              <div><span className="text-gray-400">감지</span> <b className="text-amber-600">{detStats.total + detStats.stats.issue_created + detStats.stats.dismissed + detStats.stats.pending}</b></div>
              <div><span className="text-gray-400">해결</span> <b className="text-emerald-600">{detStats.total}</b></div>
              <div><span className="text-gray-400">이슈</span> <b className="text-red-600">{detStats.stats.issue_created}</b></div>
              <div><span className="text-gray-400">넘김</span> <b className="text-gray-500">{detStats.stats.dismissed}</b></div>
              {detStats.stats.avg_response_sec > 0 && (
                <div><span className="text-gray-400">응답</span> <b className="text-gray-900">{fmtSec(detStats.stats.avg_response_sec)}</b></div>
              )}
            </div>
          )}
        </div>
        {/* 2줄: 담당자별 + 유형별 KPI */}
        {detStats && (detStats.items?.length > 0 || detStats.stats.categories?.length > 0) && (
          <div className="flex items-center gap-4 text-xs">
            {/* 담당자별 */}
            {(() => {
              const handlers: Record<string, number> = {};
              detStats.items?.forEach(d => { if (d.assigned_to) handlers[d.assigned_to] = (handlers[d.assigned_to] || 0) + 1; });
              const sorted = Object.entries(handlers).sort((a, b) => b[1] - a[1]);
              if (sorted.length === 0) return null;
              const max = sorted[0][1];
              return (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 flex-shrink-0">담당</span>
                  {sorted.map(([name, cnt]) => (
                    <div key={name} className="flex items-center gap-1">
                      <span className="text-gray-700 font-medium">{name}</span>
                      <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(cnt / max) * 100}%` }} />
                      </div>
                      <span className="text-gray-500">{cnt}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* 유형별 */}
            {detStats.stats.categories?.length > 0 && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
                <span className="text-gray-400 flex-shrink-0">유형</span>
                {detStats.stats.categories.sort((a: any, b: any) => b.count - a.count).map((c: any) => (
                  <span key={c.category} className="px-1.5 py-px bg-gray-100 rounded text-gray-600">
                    {CAT_LABELS[c.category] || c.category} <b>{c.count}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 메인 영역 */}
      <div className="flex flex-1 overflow-hidden">
      {/* Left: 대화 목록 */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        {/* 헤더 */}
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">게스트 메시지</h2>
            <button onClick={handleSync} disabled={syncing}
              className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50">
              {syncing ? "..." : "동기화"}
            </button>
          </div>
          <input type="text" placeholder="게스트명 검색..." value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadConversations()}
            className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded" />
        </div>

        {/* 필터 탭 (기간 내 대화 기준) */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(() => {
            const [pS, pE] = getPeriodDates(statPeriod);
            const inPeriod = conversations.filter(c => {
              if (!c.last_message_at) return false;
              const d = c.last_message_at.slice(0, 10);
              return d >= pS && d <= pE;
            });
            return ([
              { key: 'today' as const, label: '오늘', color: 'text-gray-700' },
              { key: 'yesterday' as const, label: '어제', color: 'text-gray-500' },
              { key: 'urgent' as const, label: '감지', color: 'text-red-600' },
              { key: 'checkin' as const, label: '체크인중', color: 'text-blue-600' },
              { key: 'all' as const, label: '전체', color: 'text-gray-500' },
            ]).map(f => {
              const src = inPeriod;
              const count = f.key === 'urgent'
                ? src.filter((c: any) => c.detection_count > 0).length
                : f.key === 'today'
                ? src.filter((c: any) => c.message_date === 'today').length
                : f.key === 'yesterday'
                ? src.filter((c: any) => c.message_date === 'yesterday').length
                : f.key === 'checkin'
                ? src.filter((c: any) => c.stay_status === 'checking_in' || c.stay_status === 'in_house').length
                : src.length;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex-1 py-2 text-xs font-medium relative ${
                  filter === f.key ? `${f.color} border-b-2 border-current` : 'text-gray-400'
                }`}>
                {f.label}
                {count > 0 && <span className="ml-0.5">({count})</span>}
              </button>
            );
          })})()}
        </div>

        {/* 대화 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            // 기간 필터 (상단 통계 기간과 연동)
            const [pStart, pEnd] = getPeriodDates(statPeriod);
            const periodFiltered = conversations.filter(conv => {
              if (!conv.last_message_at) return false;
              const d = conv.last_message_at.slice(0, 10);
              return d >= pStart && d <= pEnd;
            });
            const filtered = periodFiltered.filter(conv => {
              if (filter === 'urgent') return conv.detection_count > 0;
              if (filter === 'today') return conv.message_date === 'today';
              if (filter === 'yesterday') return conv.message_date === 'yesterday';
              if (filter === 'checkin') return conv.stay_status === 'checking_in' || conv.stay_status === 'in_house';
              return true;
            });
            if (filtered.length === 0) {
              return <div className="p-4 text-xs text-gray-400 text-center">해당 대화가 없습니다</div>;
            }
            return filtered.map((conv) => (
              <div key={conv.conversation_id}
                onClick={() => selectConversation(conv.conversation_id)}
                className={`px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selected === conv.conversation_id ? "bg-blue-50" : ""
                } ${conv.max_severity === 'critical' ? 'border-l-2 border-l-red-500' : conv.max_severity === 'high' ? 'border-l-2 border-l-orange-400' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm text-gray-900 truncate">{conv.guest_name || "게스트"}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {conv.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{conv.unread_count}</span>
                    )}
                    <span className="text-xs text-gray-400">{formatTime(conv.last_message_at)}</span>
                  </div>
                </div>
                {/* 상태 이모지 줄 (시간 아래) */}
                {(() => {
                  const dets = allDetections.filter(d => d.conversation_id === conv.conversation_id);
                  const pending = dets.filter(d => d.status === 'pending' || d.status === 'responding');
                  const resolved = dets.filter(d => d.status === 'resolved');
                  const lp = (conv.last_message_preview || '').toLowerCase();
                  const neg = ['안됩니다','안돼','안나와','없어요','ㅜㅜ','ㅠㅠ','안 켜','안켜'].some(k => lp.includes(k));

                  // 상태 이모지 — 감지가 없으면 표시 안 함
                  let emoji = '';
                  if (dets.length === 0) {
                    emoji = ''; // 감지 없음 = 이모지 없음
                  } else if (pending.length > 0 && neg) {
                    emoji = '🔴'; // 미해결 + 부정
                  } else if (pending.length > 0) {
                    emoji = '🟠'; // 대응 중
                  } else if (resolved.length > 0 && resolved.length === dets.length) {
                    emoji = '🟢'; // 전부 해결
                  } else if (resolved.length > 0) {
                    emoji = '🟡'; // 일부 해결
                  } else {
                    emoji = '';
                  }

                  // 문제 아이콘 — 감지된 게스트 메시지 내용만 (호스트 안내 메시지 제외)
                  const cats = new Set(dets.map(d => d.detected_category));
                  const icons: string[] = [];
                  if (cats.has('boiler')) icons.push('🔥');
                  if (cats.has('parking')) icons.push('🚗');
                  if (cats.has('cleaning')) icons.push('🧹');
                  if (cats.has('emergency')) icons.push('🚨');

                  // 게스트가 제기한 문제 키워드만 (감지된 메시지 내용 기준)
                  const guestContent = dets.map(d => (d.message_content || '').toLowerCase()).join(' ');
                  if (guestContent.includes('빔') || guestContent.includes('프로젝터')) icons.push('📽️');
                  if (guestContent.includes('tv') || guestContent.includes('티비') || guestContent.includes('리모컨') || guestContent.includes('넷플릭스')) icons.push('📺');
                  if (guestContent.includes('와이파이') || guestContent.includes('wifi')) icons.push('📶');
                  if (guestContent.includes('카드키') || guestContent.includes('도어락') || guestContent.includes('열쇠')) icons.push('🗝️');
                  if (guestContent.includes('비밀번호') || guestContent.includes('비번')) icons.push('🔐');
                  if (guestContent.includes('세탁') || guestContent.includes('세탁기')) icons.push('👕');
                  if (guestContent.includes('주차')) icons.push('🚗');
                  if (cats.has('checkin') && !icons.includes('🗝️') && !icons.includes('🔐')) icons.push('🔑');
                  if (cats.has('reservation')) icons.push('💰');

                  // 중복 제거
                  const uniqueIcons = [...new Set(icons)];

                  if (!emoji && uniqueIcons.length === 0) return null;
                  const allResolved = dets.length > 0 && pending.length === 0;
                  return (
                    <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${allResolved ? 'opacity-40 grayscale' : ''}`}>
                      {uniqueIcons.map((ic, i) => <span key={i} className="text-sm">{ic}</span>)}
                      {emoji && <span className="text-sm">{emoji}</span>}
                    </div>
                  );
                })()}
                {/* 숙소/체크인 */}
                {conv.property_name && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {conv.property_name}
                    {conv.check_in && <span className="ml-1">IN {conv.check_in.slice(5)}</span>}
                  </div>
                )}
                {/* 감지 내용 또는 메시지 미리보기 */}
                {conv.detection_count > 0 ? (
                  <div className="mt-0.5 space-y-0.5">
                    {allDetections
                      .filter(d => d.conversation_id === conv.conversation_id && d.status === 'pending')
                      .slice(0, 2)
                      .map(d => (
                        <div key={d.id} className={`text-xs px-2 py-1.5 rounded border ${
                          d.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                          d.severity === 'high' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                          'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          <span className="font-semibold">{CAT_LABELS[d.detected_category] || d.detected_category}</span>
                          {d.response_time_sec > 0 && (
                            <span className={`mx-1 font-medium ${d.response_time_sec < 600 ? 'text-green-600' : d.response_time_sec < 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                              {d.response_time_sec < 60 ? `${d.response_time_sec}초` : d.response_time_sec < 3600 ? `${Math.round(d.response_time_sec/60)}분` : `${Math.round(d.response_time_sec/3600)}시간`}
                            </span>
                          )}
                          {d.status === 'pending' && <span className="mx-1 text-red-500 font-medium">미대응</span>}
                          <span className="text-gray-500 mx-1">·</span>
                          <span>{d.message_content?.slice(0, 30)}{(d.message_content?.length || 0) > 30 ? '...' : ''}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message_preview || "메시지 없음"}</div>
                )}
                {/* 처리 성과 인디케이터 */}
                {(conv.resolved_count > 0 || conv.last_handler) && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {conv.resolved_count > 0 && (
                      <span className="text-xs px-1 py-px rounded bg-emerald-50 text-emerald-600">
                        해결 {conv.resolved_count}
                      </span>
                    )}
                    {conv.avg_response_sec > 0 && (
                      <span className={`text-xs px-1 py-px rounded ${
                        conv.avg_response_sec < 300 ? 'bg-green-50 text-green-600' :
                        conv.avg_response_sec < 1800 ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {fmtSec(conv.avg_response_sec)}
                      </span>
                    )}
                    {conv.last_handler && (
                      <span className="text-xs px-1 py-px rounded bg-blue-50 text-blue-600">{conv.last_handler}</span>
                    )}
                    {conv.ai_assisted && (
                      <span className="text-xs px-1 py-px rounded bg-indigo-50 text-indigo-600">AI</span>
                    )}
                  </div>
                )}
                {/* 액션 버튼 */}
                {conv.detection_count > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectConversation(conv.conversation_id).then(() => {
                          setTimeout(() => {
                            const el = document.querySelector('[data-detection]');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 200);
                        });
                      }}
                      className={`text-xs px-1 py-px rounded font-medium ${
                        conv.max_severity === 'critical' ? 'bg-red-100 text-red-700' :
                        conv.max_severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                      {conv.max_severity === 'critical' ? '긴급' : conv.max_severity === 'high' ? '주의' : '감지'} {conv.detection_count}건
                    </button>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      // 1) respond API 호출 → 응답시간 기록
                      const dets = allDetections.filter(d => d.conversation_id === conv.conversation_id && d.status === 'pending');
                      const user = JSON.parse(localStorage.getItem('user') || '{}');
                      for (const d of dets) await api.post(`/issue-detections/${d.id}/respond`, { assigned_to: user.name || '', ai_assisted: false });
                      // 2) AI 분석 + 대화 열기
                      selectConversation(conv.conversation_id).then(() => {
                        const last = messages.filter(m => m.sender_type === 'guest').pop();
                        if (last) {
                          setAiLoading(true);
                          api.post('/cs-agent/suggest', { message: last.content, guest_name: conv.guest_name })
                            .then(res => { setAiSuggestion(res.data); setRightTab('ai'); })
                            .finally(() => setAiLoading(false));
                        }
                      });
                      loadAllDetections();
                    }} className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200">확인</button>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      // resolve(안내) + AI 활용으로 기록
                      const dets = allDetections.filter(d => d.conversation_id === conv.conversation_id && (d.status === 'pending' || d.status === 'responding'));
                      const user = JSON.parse(localStorage.getItem('user') || '{}');
                      for (const d of dets) {
                        if (d.status === 'pending') await api.post(`/issue-detections/${d.id}/respond`, { assigned_to: user.name || '', ai_assisted: true });
                        await api.post(`/issue-detections/${d.id}/resolve`, { resolution_type: 'guide', resolution_team: 'office', resolution_note: '' });
                      }
                      loadAllDetections(); loadConversations();
                    }} className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">해결</button>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      const dets = allDetections.filter(d => d.conversation_id === conv.conversation_id && d.status === 'pending');
                      for (const d of dets) await api.post(`/issue-detections/${d.id}/create-issue`);
                      loadAllDetections(); loadConversations();
                    }} className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200">이슈 등록</button>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      const dets = allDetections.filter(d => d.conversation_id === conv.conversation_id && d.status === 'pending');
                      for (const d of dets) await api.post(`/issue-detections/${d.id}/dismiss`);
                      loadAllDetections(); loadConversations();
                    }} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200">넘김</button>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Center: 채팅 */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            대화를 선택해주세요
          </div>
        ) : (
          <>
            {/* 채팅 헤더 — 게스트 + 예약 + 숙소 + 감지 */}
            <div className="px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {convDetail?.guest_name || "게스트"}
                  </span>
                  {convDetail?.channel_type && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{convDetail.channel_type}</span>
                  )}
                  {detections.filter(d => d.status === 'pending').length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                      이슈 감지 {detections.filter(d => d.status === 'pending').length}
                    </span>
                  )}
                </div>
                <button onClick={handleSync} disabled={syncing}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                  {syncing ? "..." : "새로고침"}
                </button>
              </div>
              {/* 예약/숙소 정보 바 */}
              {reservation && (
                <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{reservation.property_name}</span>
                  <span>IN {reservation.check_in}</span>
                  <span>OUT {reservation.check_out}</span>
                  <span>{reservation.nights}박</span>
                  {reservation.total_rate > 0 && (
                    <span className="text-blue-600">{(reservation.total_rate / 10000).toFixed(0)}만원</span>
                  )}
                  <span className={`px-1 py-px rounded text-xs ${reservation.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {reservation.status}
                  </span>
                </div>
              )}
            </div>

            {/* 게스트 문제 요약 */}
            {selected && messages.length > 0 && (() => {
              // 게스트 메시지에서 문제 흐름 추출
              const guestMsgs = messages.filter(m => m.sender_type === 'guest');
              const lastMsg = messages[messages.length - 1];
              const isGuestWaiting = lastMsg?.sender_type === 'guest';

              // 문제 키워드 감지
              const issueKeywords: Record<string, string[]> = {
                '시설': ['빔', '프로젝터', 'TV', '티비', '리모컨', '세탁기', '에어컨', '보일러', '온수', '와이파이', 'wifi', '고장', '안 켜', '안됩니다', '작동'],
                '출입': ['비밀번호', '카드키', '도어락', '열리지', '잠겨', '출입', '현관'],
                '청소': ['더러', '냄새', '머리카락', '수건', '침구', '청소'],
                '주차': ['주차', '출차', '차량'],
              };
              const issues: {category: string; msg: string; time: string; idx: number}[] = [];
              guestMsgs.forEach((m, i) => {
                const lower = m.content.toLowerCase();
                for (const [cat, kws] of Object.entries(issueKeywords)) {
                  if (kws.some(kw => lower.includes(kw))) {
                    issues.push({ category: cat, msg: m.content.slice(0, 60), time: m.sent_at, idx: i });
                    break;
                  }
                }
              });

              if (issues.length === 0) return null;

              // 해결 여부 판별
              const lastIssue = issues[issues.length - 1];
              const lastIssueTime = lastIssue?.time || '';
              const guestAfterIssue = guestMsgs.filter(m => m.sent_at > lastIssueTime);
              const lastGuestMsg = guestAfterIssue[guestAfterIssue.length - 1];

              // 미해결: 게스트가 부정적 키워드로 끝남
              const unresolvedKw = ['안됩니다', '안돼', '안 돼', '안되', '안나와', '없습니다', '없어요', '모르겠', 'ㅜㅜ', 'ㅠㅠ', '안 켜', '안켜'];
              // 해결: 게스트가 감사/긍정으로 끝남
              const resolvedKw = ['감사', '고마', '됐어', '됐습', '해결', '괜찮', '네 ㄱ', '넵', '알겠', '좋아요', '!!'];

              const stillUnresolved = lastGuestMsg && unresolvedKw.some(kw => lastGuestMsg.content.includes(kw));
              const isResolved = lastGuestMsg && resolvedKw.some(kw => lastGuestMsg.content.includes(kw));

              // 이슈 카테고리 통합 (같은 카테고리 묶기)
              const mainCategory = issues[0]?.category || '';
              const totalTime = issues.length > 1
                ? Math.round((new Date(issues[issues.length-1].time).getTime() - new Date(issues[0].time).getTime()) / 60000)
                : 0;

              return (
                <div className={`border-b px-4 py-2.5 flex-shrink-0 ${
                  stillUnresolved ? 'bg-red-50 border-red-200' :
                  isGuestWaiting ? 'bg-amber-50 border-amber-200' :
                  isResolved ? 'bg-emerald-50 border-emerald-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">게스트 문제 요약</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        mainCategory === '시설' ? 'bg-orange-100 text-orange-700' :
                        mainCategory === '출입' ? 'bg-blue-100 text-blue-700' :
                        mainCategory === '청소' ? 'bg-cyan-100 text-cyan-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{mainCategory}</span>
                      <span className="text-xs text-gray-500">{issues.length}회 문의</span>
                    </div>
                    {stillUnresolved && <span className="text-xs font-bold text-red-600 animate-pulse">미해결 — 게스트 대기 중</span>}
                    {!stillUnresolved && isGuestWaiting && <span className="text-xs font-medium text-amber-600">게스트 응답 대기</span>}
                    {isResolved && !stillUnresolved && (
                      <span className="text-xs font-bold text-emerald-600">
                        ✓ {totalTime > 0 ? `${totalTime < 60 ? `${totalTime}분` : `${Math.floor(totalTime/60)}시간 ${totalTime%60}분`} 만에 해결` : '해결'}
                      </span>
                    )}
                  </div>
                  {issues.map((iss, i) => {
                    const sinceFirst = Math.round((new Date(iss.time).getTime() - new Date(issues[0].time).getTime()) / 60000);
                    const sinceNow = Math.round((Date.now() - new Date(iss.time).getTime()) / 60000);
                    const isLast = i === issues.length - 1;
                    const fmtMin = (m: number) => m < 60 ? `${m}분` : `${Math.floor(m/60)}시간${m%60 ? ` ${m%60}분` : ''}`;
                    return (
                      <div key={i} className={`flex items-center gap-2 mb-1 ${isLast && stillUnresolved ? 'py-1' : ''}`}>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          isLast && stillUnresolved ? 'bg-red-500 text-white' :
                          isLast ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {i + 1}차
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          iss.category === '시설' ? 'bg-orange-100 text-orange-700' :
                          iss.category === '출입' ? 'bg-blue-100 text-blue-700' :
                          iss.category === '청소' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{iss.category}</span>
                        <span className="text-xs text-gray-700 flex-1">{iss.msg}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {new Date(iss.time).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}
                        </span>
                        {i > 0 && (
                          <span className={`text-xs font-medium whitespace-nowrap ${sinceFirst > 60 ? 'text-red-600' : sinceFirst > 30 ? 'text-amber-600' : 'text-gray-500'}`}>
                            +{fmtMin(sinceFirst)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* 전체 경과 시간 바 */}
                  {issues.length > 0 && (
                    <div className={`mt-2 rounded-lg p-2 ${stillUnresolved ? 'bg-red-100' : isGuestWaiting ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${stillUnresolved ? 'text-red-700' : 'text-gray-700'}`}>
                            1차 문제제기부터 {(() => { const t = Math.round((Date.now() - new Date(issues[0].time).getTime()) / 60000); return t < 60 ? `${t}분` : `${Math.floor(t/60)}시간 ${t%60}분`; })()} 경과
                          </span>
                          {issues.length > 1 && (
                            <span className="text-xs text-gray-500">({issues.length}회 제기)</span>
                          )}
                        </div>
                        {stillUnresolved && (
                          <span className="text-xs font-bold text-red-600 animate-pulse">즉시 대응 필요</span>
                        )}
                      </div>
                      {stillUnresolved && lastGuestAfter && (
                        <div className="text-xs text-red-700 mt-1">마지막: "{lastGuestAfter.content.slice(0, 40)}"</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.map((msg) => {
                // 이 메시지에 매칭되는 감지 이슈 (message_id 기반)
                const matched = msg.sender_type === 'guest'
                  ? detections.filter(d => d.message_id === msg.id)
                  : [];

                return (
                  <div key={msg.id}>
                    <div className={`flex ${msg.sender_type === "host" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        msg.sender_type === "host"
                          ? "bg-blue-500 text-white"
                          : msg.sender_type === "system"
                          ? "bg-gray-200 text-gray-600 text-xs italic"
                          : "bg-white text-gray-900 border border-gray-200"
                      }`}>
                        {msg.message_type === "image" && msg.image_url ? (
                          <img src={msg.image_url} alt="" className="max-w-full rounded" />
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <div className={`text-xs mt-1 ${msg.sender_type === "host" ? "text-blue-100" : "text-gray-400"}`}>
                          {formatTime(msg.sent_at)}
                        </div>
                      </div>
                    </div>

                    {/* 감지된 이슈 — 메시지 바로 아래 인라인 카드 */}
                    {matched.length > 0 && matched.map(det => (
                      <div key={det.id} data-detection={det.id} className={`ml-2 mt-1 max-w-[75%] rounded-lg p-2.5 border text-xs ${
                        det.severity === 'critical' ? 'bg-red-50 border-red-300' :
                        det.severity === 'high' ? 'bg-orange-50 border-orange-300' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`px-1 py-px rounded text-xs font-bold ${
                            det.severity === 'critical' ? 'bg-red-500 text-white' :
                            det.severity === 'high' ? 'bg-orange-500 text-white' :
                            'bg-amber-500 text-white'
                          }`}>
                            {det.severity === 'critical' ? '즉시' : det.severity === 'high' ? '주의' : '감지'}
                          </span>
                          <span className="font-medium text-gray-700">{CAT_LABELS[det.detected_category] || det.detected_category}</span>
                          {det.response_time_sec > 0 && (
                            <span className={`font-medium ${det.response_time_sec < 600 ? 'text-green-600' : det.response_time_sec < 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                              {det.response_time_sec < 60 ? `${det.response_time_sec}초` : det.response_time_sec < 3600 ? `${Math.round(det.response_time_sec/60)}분` : `${Math.round(det.response_time_sec/3600)}시간`}
                            </span>
                          )}
                          {det.status === 'pending' && <span className="text-red-500 font-medium">미대응</span>}
                          <span className="text-gray-400">{det.detected_keywords}</span>
                        </div>
                        {(det.status === 'pending' || det.status === 'responding') && (
                          <div className="flex gap-1 mt-1.5">
                            {det.status === 'pending' && (
                              <button onClick={async () => {
                                const user = JSON.parse(localStorage.getItem('user') || '{}');
                                await api.post(`/issue-detections/${det.id}/respond`, { assigned_to: user.name || '', ai_assisted: true });
                                setAiLoading(true);
                                try {
                                  const res = await api.post('/cs-agent/suggest', { message: msg.content, guest_name: convDetail?.guest_name || '' });
                                  setAiSuggestion(res.data); setRightTab('ai');
                                } finally { setAiLoading(false); }
                                const data = await getConversation(selected!);
                                setDetections(data.detections || []); loadAllDetections();
                              }} className="px-2 py-0.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700">확인</button>
                            )}
                            <button onClick={async () => {
                              const user = JSON.parse(localStorage.getItem('user') || '{}');
                              if (det.status === 'pending') await api.post(`/issue-detections/${det.id}/respond`, { assigned_to: user.name || '', ai_assisted: false });
                              await api.post(`/issue-detections/${det.id}/resolve`, { resolution_type: 'guide', resolution_team: 'office', resolution_note: '' });
                              const data = await getConversation(selected!);
                              setDetections(data.detections || []); loadAllDetections();
                            }} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">해결</button>
                            <button onClick={async () => {
                              await api.post(`/issue-detections/${det.id}/create-issue`);
                              const data = await getConversation(selected!);
                              setDetections(data.detections || []); loadAllDetections();
                            }} className="px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700">이슈 등록</button>
                            <button onClick={async () => {
                              await api.post(`/issue-detections/${det.id}/dismiss`);
                              const data = await getConversation(selected!);
                              setDetections(data.detections || []); loadAllDetections();
                            }} className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">넘김</button>
                          </div>
                        )}
                        {det.status === 'issue_created' && (
                          <div className="text-xs text-green-600 mt-1">이슈 등록 완료</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* 응대 가이드 — 게스트 마지막 메시지가 문의일 때 자동 표시 */}
            {(() => {
              const lastGuest = [...messages].reverse().find(m => m.sender_type === 'guest');
              const lastMsg = messages[messages.length - 1];
              if (!lastGuest || lastMsg?.sender_type === 'host') return null; // 호스트가 마지막이면 안 보임

              const gc = lastGuest.content.toLowerCase();
              const guides: {emoji: string; title: string; tip: string; reply: string}[] = [];

              if (gc.includes('비밀번호') || gc.includes('비번') || gc.includes('도어락'))
                guides.push({emoji:'🔐', title:'비밀번호/도어락', tip:'안내문 재전송, 공동현관·객실 구분 확인', reply:'안내드린 비밀번호를 다시 확인해 주세요. 공동현관과 객실 비밀번호가 다를 수 있습니다.'});
              if (gc.includes('카드키') || gc.includes('열쇠'))
                guides.push({emoji:'🗝️', title:'카드키', tip:'소화기함 위치, 경비실 호출 안내', reply:'1층 공동현관 소화기함에 카드키가 비치되어 있습니다. 없으시면 경비실에 문의해 주세요.'});
              if (gc.includes('주차') || gc.includes('차량'))
                guides.push({emoji:'🚗', title:'주차', tip:'차량번호 확인 → 등록 처리, 기계식 제한 안내', reply:'차량번호를 알려주시면 주차 등록 도와드리겠습니다.'});
              if (gc.includes('와이파이') || gc.includes('wifi') || gc.includes('인터넷'))
                guides.push({emoji:'📶', title:'와이파이', tip:'SSID+비밀번호 재안내, 5G/2.4G 구분', reply:'와이파이 정보를 다시 안내드립니다.'});
              if (gc.includes('온수') || gc.includes('보일러') || gc.includes('난방'))
                guides.push({emoji:'🔥', title:'보일러/온수', tip:'전원·온수모드 확인 요청, 에러코드 사진 요청', reply:'보일러 전원이 켜져 있는지, 온수 모드가 설정되어 있는지 확인해 주세요. 에러코드가 보이시면 사진 부탁드립니다.'});
              if (gc.includes('빔') || gc.includes('프로젝터'))
                guides.push({emoji:'📽️', title:'빔프로젝터', tip:'전원·리모컨·HDMI 입력 확인, 비밀번호 0000 시도', reply:'리모컨으로 전원을 켜시고, 외부입력을 HDMI로 변경해 보세요.'});
              if (gc.includes('tv') || gc.includes('티비') || gc.includes('리모컨') || gc.includes('넷플릭스'))
                guides.push({emoji:'📺', title:'TV/OTT', tip:'셋탑박스 전원 확인, 외부입력 변경, 리모컨 건전지', reply:'셋탑박스가 켜져 있는 상태에서 외부입력을 HDMI로 변경해 보세요.'});
              if (gc.includes('청소') || gc.includes('더러') || gc.includes('냄새') || gc.includes('머리카락'))
                guides.push({emoji:'🧹', title:'청소/위생', tip:'사진 요청 → 즉시 재청소 또는 부분 환불 검토', reply:'불편을 드려 죄송합니다. 불편한 부분을 사진으로 보내주시면 바로 조치하겠습니다.'});
              if (gc.includes('환불') || gc.includes('취소'))
                guides.push({emoji:'💸', title:'환불/취소', tip:'예약 채널 정책 우선, 취소 사유 확인', reply:'취소 및 환불은 예약 채널의 정책을 기준으로 안내드립니다. 취소 사유를 알려주시면 확인해 드리겠습니다.'});
              if (gc.includes('연장') || gc.includes('레이트'))
                guides.push({emoji:'⏰', title:'연장/레이트', tip:'다음 예약 확인 → 가능 여부 답변, 추가비 안내', reply:'다음 예약을 확인하고 가능 여부를 안내드리겠습니다.'});
              if (gc.includes('체크인') || gc.includes('입실') || gc.includes('도착'))
                guides.push({emoji:'🔑', title:'체크인', tip:'안내문 재전송, 얼리체크인은 청소 완료 후 가능', reply:'체크인 안내문을 다시 보내드리겠습니다.'});

              if (guides.length === 0) return null;

              return (
                <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-200 flex-shrink-0">
                  <div className="text-[10px] font-bold text-indigo-700 mb-1">응대 가이드</div>
                  {guides.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1.5">
                      <span className="text-sm">{g.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800">{g.title}</div>
                        <div className="text-[10px] text-gray-500">{g.tip}</div>
                      </div>
                      <button
                        onClick={() => setInput(g.reply)}
                        className="flex-shrink-0 px-2 py-0.5 text-[10px] bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >사용</button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 입력창 */}
            <div className="px-4 py-3 bg-white border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  전송
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: 감지 / 대장 / 통합뷰 / AI */}
      <div className="w-[480px] border-l border-gray-200 bg-white flex flex-col">
        <div className="flex items-center justify-end px-2 py-1 border-b border-gray-100">
          <button onClick={() => setShowManual(true)}
            className="text-xs px-2 py-1 rounded text-gray-400 hover:bg-gray-100">히로가이드</button>
        </div>
        <div className="flex border-b border-gray-200">
          {[
            { key: 'detect' as const, label: '감지' },
            { key: 'ledger' as const, label: '대장' },
          ].map(t => (
            <button key={t.key} onClick={() => setRightTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-medium ${rightTab === t.key ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 감지 탭 — DB 이력 테이블 (기본: 오늘) */}
          {rightTab === 'detect' && (
            <div className="flex flex-col h-full">
              {/* 당일 이슈 종합 */}
              <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-2">
                <div className="text-xs font-bold text-gray-800">오늘 이슈 종합</div>

                {/* 대화/메시지 통계 */}
                {msgStats && (
                  <div className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                    <div className="flex gap-3 text-xs">
                      <span className="text-gray-500">대화 <b className="text-gray-900">{msgStats.convs}</b>명</span>
                      <span className="text-gray-500">메시지 <b className="text-gray-900">{msgStats.total}</b>건</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-gray-500">게스트 <b className="text-blue-600">{msgStats.guest}</b></span>
                      <span className="text-gray-500">호스트 <b className="text-emerald-600">{msgStats.host}</b></span>
                    </div>
                  </div>
                )}

                {/* 이슈 요약 */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '감지', value: detHistory.length, color: 'text-amber-600' },
                    { label: '해결', value: detHistory.filter((d: any) => d.status === 'resolved').length, color: 'text-emerald-600' },
                    { label: '대기', value: detHistory.filter((d: any) => d.status === 'pending' || d.status === 'responding').length, color: 'text-red-600' },
                    { label: '이슈', value: detHistory.filter((d: any) => d.status === 'issue_created').length, color: 'text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-gray-50 rounded py-1">
                      <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* 유형별 이모지 카드 */}
                {(() => {
                  const catEmoji: Record<string, string> = {
                    checkin: '🔑', parking: '🚗', boiler: '🔥', cleaning: '🧹',
                    reservation: '💰', emergency: '🚨',
                  };
                  // 세부 키워드별 집계
                  const details: Record<string, { emoji: string; count: number; resolved: number }> = {};
                  detHistory.forEach((d: any) => {
                    const mc = (d.message_content || '').toLowerCase();
                    let key = d.detected_category;
                    let emoji = catEmoji[key] || '📋';

                    // 세분화
                    if (mc.includes('빔') || mc.includes('프로젝터')) { key = '빔프로젝터'; emoji = '📽️'; }
                    else if (mc.includes('tv') || mc.includes('티비') || mc.includes('리모컨') || mc.includes('넷플릭스')) { key = 'TV/OTT'; emoji = '📺'; }
                    else if (mc.includes('와이파이') || mc.includes('wifi')) { key = '와이파이'; emoji = '📶'; }
                    else if (mc.includes('카드키') || mc.includes('열쇠')) { key = '카드키'; emoji = '🗝️'; }
                    else if (mc.includes('비밀번호') || mc.includes('비번')) { key = '비밀번호'; emoji = '🔐'; }
                    else if (mc.includes('도어락')) { key = '도어락'; emoji = '🚪'; }
                    else if (mc.includes('보일러') || mc.includes('온수')) { key = '보일러/온수'; emoji = '🔥'; }
                    else if (mc.includes('주차')) { key = '주차'; emoji = '🚗'; }
                    else if (mc.includes('청소') || mc.includes('머리카락') || mc.includes('냄새')) { key = '청소/위생'; emoji = '🧹'; }
                    else if (mc.includes('수건') || mc.includes('침구')) { key = '수건/침구'; emoji = '🛏️'; }
                    else if (mc.includes('환불') || mc.includes('취소')) { key = '환불/취소'; emoji = '💸'; }
                    else if (mc.includes('연장') || mc.includes('레이트')) { key = '연장/레이트'; emoji = '⏰'; }
                    else if (mc.includes('입금') || mc.includes('결제')) { key = '입금/결제'; emoji = '💰'; }
                    else if (mc.includes('세탁')) { key = '세탁기'; emoji = '👕'; }
                    else { key = CAT_LABELS[key] || key; }

                    if (!details[key]) details[key] = { emoji, count: 0, resolved: 0 };
                    details[key].count++;
                    if (d.status === 'resolved') details[key].resolved++;
                  });

                  const sorted = Object.entries(details).sort((a, b) => b[1].count - a[1].count);
                  if (sorted.length === 0) return null;

                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {sorted.map(([key, { emoji, count, resolved }]) => {
                        const allDone = resolved === count;
                        return (
                          <div key={key} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${
                            allDone ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-amber-50 border-amber-200'
                          }`}>
                            <span className={allDone ? 'grayscale' : ''}>{emoji}</span>
                            <span className="font-medium text-gray-700">{key}</span>
                            <span className={`font-bold ${allDone ? 'text-emerald-600' : 'text-amber-700'}`}>{count}</span>
                            {allDone && <span className="text-emerald-500 text-[10px]">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 평균 응답 시간 */}
                {(() => {
                  const withTime = detHistory.filter((d: any) => d.response_time_sec > 0);
                  if (withTime.length === 0) return null;
                  const avg = Math.round(withTime.reduce((s: number, d: any) => s + d.response_time_sec, 0) / withTime.length);
                  const fmtT = (s: number) => s < 60 ? `${s}초` : s < 3600 ? `${Math.floor(s/60)}분` : `${Math.floor(s/3600)}시간`;
                  return (
                    <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="text-gray-500">평균 응답</span>
                      <span className={`font-bold ${avg < 600 ? 'text-emerald-600' : avg < 1800 ? 'text-amber-600' : 'text-red-600'}`}>{fmtT(avg)}</span>
                    </div>
                  );
                })()}
              </div>

              {/* 필터 */}
              <div className="px-2 py-1.5 border-b border-gray-50 flex gap-1 flex-shrink-0">
                {([
                  ['all', '전체'],
                  ['pending', '대기'],
                  ['resolved', '해결'],
                  ['issue_created', '이슈'],
                  ['dismissed', '넘김'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setDetStatusFilter(key)}
                    className={`px-1.5 py-0.5 text-xs rounded ${detStatusFilter === key ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* 상세 이슈 로그 */}
              <div className="flex-1 overflow-y-auto">
                {detHistory.length === 0 ? (
                  <div className="p-6 text-xs text-gray-400 text-center">감지 이력 없음</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {detHistory.map((d: any) => {
                      // 구체적 아이콘 추출
                      const mc = (d.message_content || '').toLowerCase();
                      const icons: string[] = [];
                      if (mc.includes('카드키') || mc.includes('열쇠')) icons.push('🗝️');
                      if (mc.includes('비밀번호') || mc.includes('비번')) icons.push('🔐');
                      if (mc.includes('빔') || mc.includes('프로젝터')) icons.push('📽️');
                      if (mc.includes('tv') || mc.includes('티비') || mc.includes('리모컨') || mc.includes('넷플릭스')) icons.push('📺');
                      if (mc.includes('와이파이') || mc.includes('wifi') || mc.includes('인터넷')) icons.push('📶');
                      if (mc.includes('보일러') || mc.includes('온수') || mc.includes('난방')) icons.push('🔥');
                      if (mc.includes('주차') || mc.includes('출차')) icons.push('🚗');
                      if (mc.includes('청소') || mc.includes('수건') || mc.includes('침구')) icons.push('🧹');
                      if (mc.includes('환불') || mc.includes('결제') || mc.includes('입금')) icons.push('💰');
                      if (mc.includes('세탁')) icons.push('👕');
                      if (mc.includes('도어락')) icons.push('🚪');
                      if (icons.length === 0) icons.push(
                        d.detected_category === 'checkin' ? '🔑' :
                        d.detected_category === 'parking' ? '🚗' :
                        d.detected_category === 'boiler' ? '🔥' :
                        d.detected_category === 'cleaning' ? '🧹' :
                        d.detected_category === 'reservation' ? '💰' :
                        d.detected_category === 'emergency' ? '🚨' : '📋'
                      );

                      // 해결 내용 요약
                      const note = d.resolution_note || d.message_content || '';
                      const parts = note.split('→');
                      const question = (parts[0] || '').trim().slice(0, 35);
                      const answer = parts[1] ? parts[1].trim().slice(0, 30) : '';

                      const isResolved = d.status === 'resolved' || d.status === 'dismissed';
                      const respTime = d.response_time_sec > 0
                        ? d.response_time_sec < 60 ? `${d.response_time_sec}초` : d.response_time_sec < 3600 ? `${Math.round(d.response_time_sec/60)}분` : `${Math.round(d.response_time_sec/3600)}시간`
                        : '';

                      return (
                        <div key={d.id}
                          onClick={() => { if (d.conversation_id) selectConversation(d.conversation_id); }}
                          className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                            d.status === 'pending' ? 'bg-amber-50/50' : ''
                          } ${isResolved ? 'opacity-70' : ''}`}>
                          {/* 1줄: 아이콘 + 게스트 + 시간 + 상태 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className={`text-sm ${isResolved ? 'grayscale opacity-50' : ''}`}>{icons.join('')}</span>
                              <span className="text-xs font-medium text-gray-900">{d.guest_name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {respTime && (
                                <span className={`text-[10px] font-medium ${d.response_time_sec < 600 ? 'text-emerald-600' : d.response_time_sec < 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {respTime}
                                </span>
                              )}
                              <span className={`text-[10px] px-1 py-px rounded ${
                                d.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                                d.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{d.status === 'resolved' ? '✓' : d.status === 'pending' ? '!' : '—'}</span>
                            </div>
                          </div>
                          {/* 2줄: 문의 → 응답 */}
                          <div className="text-[10px] text-gray-500 mt-0.5 truncate">{question}</div>
                          {answer && <div className="text-[10px] text-emerald-600 truncate">→ {answer}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
            {/* 요청사항 탭 — 대화 선택 시만 */}
            {selected && rightTab === 'requests' && (
              <>
                <div className="p-2 border-b border-gray-100">
                  <button onClick={() => setShowRequestForm(!showRequestForm)}
                    className="w-full text-xs py-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100">+ 요청 추가</button>
                </div>
                {showRequestForm && (
                  <div className="p-3 border-b border-gray-100 space-y-2">
                    <select value={newRequestType} onChange={(e) => setNewRequestType(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded">
                      {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <textarea value={newRequestNote} onChange={(e) => setNewRequestNote(e.target.value)}
                      placeholder="상세 내용..." className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none" rows={2} />
                    <div className="flex gap-1">
                      <button onClick={handleCreateRequest} className="flex-1 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">저장</button>
                      <button onClick={() => setShowRequestForm(false)} className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded">취소</button>
                    </div>
                  </div>
                )}
                {requests.length === 0 ? (
                  <div className="p-4 text-xs text-gray-400 text-center">등록된 요청이 없습니다</div>
                ) : requests.map((req) => (
                  <div key={req.id} className="px-3 py-2 border-b border-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{getRequestLabel(req.request_type)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[req.status] || "bg-gray-100"}`}>{req.status}</span>
                    </div>
                    {req.note && <p className="text-xs text-gray-500 mt-0.5">{req.note}</p>}
                    {req.status === "pending" && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => handleRequestStatus(req.id, "confirmed")} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">확인</button>
                        <button onClick={() => handleRequestStatus(req.id, "rejected")} className="text-xs px-1.5 py-0.5 bg-red-50 text-red-600 rounded">거절</button>
                        <button onClick={() => handleRequestStatus(req.id, "completed")} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">완료</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* 대장 탭 — 일별 감지 요약 */}
            {rightTab === 'ledger' && ledger && (
              <div className="flex flex-col h-full">
                {/* 요약 카드 — HS 중심 */}
                <div className="grid grid-cols-5 gap-1.5 p-2 border-b border-gray-100 flex-shrink-0">
                  <div className="bg-gray-50 rounded px-2 py-1 text-center">
                    <div className="text-[10px] text-gray-400">총</div>
                    <div className="text-sm font-bold text-gray-800">{ledger.summary?.total || 0}</div>
                  </div>
                  <div className="bg-cyan-50 rounded px-2 py-1 text-center">
                    <div className="text-[10px] text-cyan-500">HS</div>
                    <div className="text-sm font-bold text-cyan-700">{ledger.summary?.hs || 0}</div>
                  </div>
                  <div className="bg-blue-50 rounded px-2 py-1 text-center">
                    <div className="text-[10px] text-blue-400">사람</div>
                    <div className="text-sm font-bold text-blue-700">{ledger.summary?.human || 0}</div>
                  </div>
                  <div className="bg-red-50 rounded px-2 py-1 text-center">
                    <div className="text-[10px] text-red-400">민원</div>
                    <div className="text-sm font-bold text-red-600">{ledger.summary?.escalated || 0}</div>
                  </div>
                  <div className="bg-cyan-50 rounded px-2 py-1 text-center">
                    <div className="text-[10px] text-cyan-500">HS률</div>
                    <div className="text-sm font-bold text-cyan-700">{ledger.summary?.hs_rate || 0}%</div>
                  </div>
                </div>
                {/* 일별 테이블 */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="text-gray-400 text-left">
                        <th className="px-2 py-1.5 font-medium">날짜</th>
                        <th className="px-1 py-1.5 font-medium text-right">총</th>
                        <th className="px-1 py-1.5 font-medium text-right text-cyan-500">HS</th>
                        <th className="px-1 py-1.5 font-medium text-right">사람</th>
                        <th className="px-1 py-1.5 font-medium text-right text-red-400">민원</th>
                        <th className="px-1 py-1.5 font-medium text-right">대기</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {ledger.days?.map((d: any) => {
                        const hsR = d.total > 0 ? Math.round(d.hs / d.total * 100) : 0;
                        return (
                          <tr key={d.date}
                            onClick={() => { setDetDateFilter(d.date.slice(0, 10)); setStatPeriod(''); setRightTab('detect'); }}
                            className={`cursor-pointer hover:bg-blue-50 ${d.pending > 0 ? 'bg-yellow-50/50' : ''}`}>
                            <td className="px-2 py-1.5 font-medium text-gray-700">{d.date?.slice(5, 10)}</td>
                            <td className="px-1 py-1.5 text-right font-medium">{d.total}</td>
                            <td className="px-1 py-1.5 text-right text-cyan-600 font-medium">{d.hs || '-'}<span className="text-gray-300 text-[10px] ml-0.5">{hsR > 0 ? `${hsR}%` : ''}</span></td>
                            <td className="px-1 py-1.5 text-right text-blue-600">{d.human || '-'}</td>
                            <td className="px-1 py-1.5 text-right text-red-600">{d.escalated || '-'}</td>
                            <td className="px-1 py-1.5 text-right text-yellow-600">{d.pending || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-2 py-1 border-t border-gray-100 text-xs text-gray-400 text-center flex-shrink-0">
                  HS = 자동 처리 · 날짜 클릭 → 상세
                </div>
              </div>
            )}

            {/* 통합뷰 탭 — 예약코드 기반 감지+청소+이슈 통합 */}
            {rightTab === 'stats' && (
              <div className="p-3 space-y-3">
                {reservation?.reservation_code ? (
                  <>
                    <button
                      onClick={async () => {
                        if (!reservation?.reservation_code) return;
                        setRvLoading(true);
                        try {
                          const res = await api.get(`/issue-detections/by-reservation/${reservation.reservation_code}`);
                          setReservationView(res.data);
                        } catch { setReservationView(null); }
                        finally { setRvLoading(false); }
                      }}
                      disabled={rvLoading}
                      className="w-full py-2 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                    >
                      {rvLoading ? '로딩...' : `${reservation.reservation_code} 통합 조회`}
                    </button>

                    {reservationView && (
                      <div className="space-y-3">
                        {/* 요약 카드 */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-amber-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-amber-600">감지</div>
                            <div className="text-lg font-bold text-amber-700">{reservationView.summary?.detection_total || 0}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-blue-600">청소</div>
                            <div className="text-lg font-bold text-blue-700">{reservationView.summary?.cleaning_count || 0}</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-red-600">이슈</div>
                            <div className="text-lg font-bold text-red-700">{reservationView.summary?.issue_count || 0}</div>
                          </div>
                        </div>

                        {/* 메시지 수 */}
                        <div className="text-xs text-gray-500 flex justify-between px-1">
                          <span>총 메시지</span>
                          <span className="font-medium text-gray-700">{reservationView.message_count || 0}건</span>
                        </div>

                        {/* 카테고리별 감지 */}
                        {reservationView.summary?.by_category && Object.keys(reservationView.summary.by_category).length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1.5">카테고리별 감지</div>
                            <div className="space-y-1">
                              {Object.entries(reservationView.summary.by_category).map(([cat, cnt]) => (
                                <div key={cat} className="flex justify-between items-center text-xs px-2 py-1 bg-gray-50 rounded">
                                  <span className="text-gray-600">{CAT_LABELS[cat] || cat}</span>
                                  <span className="font-medium text-gray-800">{cnt as number}건</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 상태별 감지 */}
                        {reservationView.summary?.by_status && Object.keys(reservationView.summary.by_status).length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1.5">상태별</div>
                            <div className="flex gap-1.5 flex-wrap">
                              {Object.entries(reservationView.summary.by_status).map(([st, cnt]) => (
                                <span key={st} className={`px-2 py-0.5 text-xs rounded-full ${
                                  st === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                                  st === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  st === 'issue_created' ? 'bg-red-100 text-red-700' :
                                  st === 'dismissed' ? 'bg-gray-100 text-gray-600' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {st} {cnt as number}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 감지 이력 */}
                        {reservationView.detections?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1.5">감지 이력</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {reservationView.detections.map((d: any) => (
                                <div key={d.id} className="text-xs px-2 py-1.5 bg-gray-50 rounded border-l-2 border-l-amber-300">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{CAT_LABELS[d.detected_category] || d.detected_category}</span>
                                      {d.response_time_sec > 0 && (
                                        <span className={`font-medium ${d.response_time_sec < 600 ? 'text-green-600' : d.response_time_sec < 1800 ? 'text-amber-600' : 'text-red-600'}`}>
                                          {d.response_time_sec < 60 ? `${d.response_time_sec}초` : d.response_time_sec < 3600 ? `${Math.round(d.response_time_sec/60)}분` : `${Math.round(d.response_time_sec/3600)}시간`}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`px-1 rounded text-xs ${
                                      d.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' :
                                      d.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'
                                    }`}>{d.status === 'resolved' ? '완료' : d.status === 'pending' ? '미대응' : d.status}</span>
                                  </div>
                                  <div className="text-gray-400 mt-0.5 line-clamp-1">{d.resolution_note || d.message_content}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 청소 태스크 */}
                        {reservationView.cleaning_tasks?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1.5">청소</div>
                            <div className="space-y-1">
                              {reservationView.cleaning_tasks.map((ct: any) => (
                                <div key={ct.id} className="text-xs px-2 py-1.5 bg-blue-50 rounded flex justify-between">
                                  <span>{ct.property_name || '숙소'}</span>
                                  <span className="font-medium">{ct.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 이슈 */}
                        {reservationView.issues?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1.5">이슈</div>
                            <div className="space-y-1">
                              {reservationView.issues.map((iss: any) => (
                                <div key={iss.id} className="text-xs px-2 py-1.5 bg-red-50 rounded flex justify-between items-start">
                                  <span className="line-clamp-1 flex-1">{iss.title}</span>
                                  <span className={`ml-1 px-1 rounded ${iss.priority === 'P0' ? 'bg-red-200 text-red-700' : iss.priority === 'P1' ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{iss.priority}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-6">
                    대화를 선택하면 예약코드 기반<br/>통합 뷰를 확인할 수 있습니다
                  </div>
                )}
              </div>
            )}

            {/* AI 에이전트 탭 */}
            {rightTab === 'ai' && (
              <div className="p-3 space-y-3">
                {selected ? (
                  <>
                    <button
                      onClick={async () => {
                        const lastGuest = [...messages].reverse().find(m => m.sender_type === 'guest');
                        if (!lastGuest) return;
                        setAiLoading(true);
                        try {
                          const res = await api.post('/cs-agent/suggest', {
                            message: lastGuest.content,
                            guest_name: convDetail?.guest_name || '',
                          });
                          setAiSuggestion(res.data);
                        } finally { setAiLoading(false); }
                      }}
                      disabled={aiLoading}
                      className="w-full py-2 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                    >
                      {aiLoading ? '분석 중...' : '게스트 메시지 분석'}
                    </button>

                    {aiSuggestion && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            aiSuggestion.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            aiSuggestion.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{aiSuggestion.severity}</span>
                          <span className="text-xs font-medium text-gray-700">{aiSuggestion.category}</span>
                          <span className="text-xs text-gray-400">→ {aiSuggestion.assign_to}</span>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="text-xs text-gray-500 font-medium mb-1">추천 응답</div>
                          <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{aiSuggestion.suggested_reply}</div>
                        </div>

                        <div className="flex gap-1">
                          <button onClick={() => setInput(aiSuggestion.suggested_reply)}
                            className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">복사</button>
                          <button
                            onClick={async () => {
                              if (!selected) return;
                              await sendMessage(selected, aiSuggestion.suggested_reply);
                              const dets = allDetections.filter(d => d.conversation_id === selected && (d.status === 'pending' || d.status === 'responding'));
                              const user = JSON.parse(localStorage.getItem('user') || '{}');
                              for (const d of dets) {
                                if (d.status === 'pending') await api.post(`/issue-detections/${d.id}/respond`, { assigned_to: user.name || '', ai_assisted: true });
                                await api.post(`/issue-detections/${d.id}/resolve`, { resolution_type: 'guide', resolution_team: 'office', resolution_note: 'AI' });
                              }
                              const data = await getConversation(selected);
                              setMessages(data.messages || []);
                              loadConversations(); loadAllDetections();
                              setAiSuggestion(null);
                            }}
                            className="flex-1 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">전송</button>
                        </div>
                      </div>
                    )}

                    {!aiSuggestion && !aiLoading && (
                      <div className="text-xs text-gray-400 text-center py-3">
                        게스트 메시지를 분석하여<br/>카테고리 감지 + 응답 초안을 제안합니다
                      </div>
                    )}

                    {/* 이슈 등록 */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">이슈 등록</div>
                      <IssueCreateForm
                        conversationId={selected}
                        guestName={convDetail?.guest_name || ''}
                        lastMessage={[...messages].reverse().find(m => m.sender_type === 'guest')?.content || ''}
                        onCreated={() => { loadAllDetections(); }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-8">대화를 선택하면<br/>AI 분석과 이슈 등록이 가능합니다</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showManual && <OperationManual page="messages" onClose={() => setShowManual(false)} />}
    </div>
  );
}

// --- 이슈 생성 폼 ---
function IssueCreateForm({ conversationId, guestName, lastMessage, onCreated }: {
  conversationId: string; guestName: string; lastMessage: string; onCreated: () => void;
}) {
  const [title, setTitle] = useState(`[게스트] ${guestName}: `);
  const [issueType, setIssueType] = useState('guest');
  const [priority, setPriority] = useState('P2');
  const [desc, setDesc] = useState(lastMessage);
  const [creating, setCreating] = useState(false);

  const issueTypes = [
    { value: 'guest', label: '게스트 응대' },
    { value: 'cleaning', label: '청소 문제' },
    { value: 'facility', label: '시설 문제' },
    { value: 'settlement', label: '정산/환불' },
    { value: 'decision', label: '의사결정' },
  ];

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.post('/admin/issues', {
        title, description: `대화: ${conversationId}\n게스트: ${guestName}\n\n${desc}`,
        issue_type: issueType, priority,
      });
      alert('이슈가 생성되었습니다');
      onCreated();
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="이슈 제목"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded" />
      <div className="flex gap-2">
        <select value={issueType} onChange={e => setIssueType(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded">
          {issueTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded">
          {['P0','P1','P2','P3'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="상세 내용"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none" rows={4} />
      <button onClick={handleCreate} disabled={creating || !title.trim()}
        className="w-full py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
        {creating ? '생성 중...' : '이슈 생성 (자동 배정)'}
      </button>
      <div className="text-xs text-gray-400 text-center">이슈 유형에 따라 담당자가 자동 배정됩니다</div>
    </div>
  );
}
