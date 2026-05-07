import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

// --- Types ---
interface Channel { id: number; name: string; channel_type: string; role_filter: string; last_message: string; last_sender: string; unread_count: number; }
interface ChatMsg { id: number; channel_id: number; sender_id: number; sender_name: string; sender_role: string; content: string; message_type: string; ref_issue_id: number | null; created_at: string; }
interface FeedItem { type: string; title: string; detail: string; severity: string; assignee: string; ref_id: number; ref_type: string; created_at: string; }
interface Summary { check_ins: number; check_outs: number; issues_created: number; issues_pending: number; detections: number; cleaning_tasks: number; }
interface Detection { id: number; guest_name: string; property_name: string; detected_category: string; detected_keywords: string; severity: string; message_content: string; status: string; }

// --- Constants ---
const ROLE_COLORS: Record<string, string> = {
  founder: 'bg-gray-900 text-white', ceo: 'bg-indigo-600 text-white', cto: 'bg-violet-600 text-white',
  cfo: 'bg-emerald-600 text-white', marketing: 'bg-pink-600 text-white', operations: 'bg-amber-600 text-white',
  cleaning_dispatch: 'bg-cyan-600 text-white', field: 'bg-orange-600 text-white',
};
const ROLE_LABELS: Record<string, string> = {
  founder: 'F', ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: 'MK', operations: 'OPS', cleaning_dispatch: 'CL', field: 'FD',
};
const FEED_ICONS: Record<string, string> = {
  checkin: 'text-blue-500', checkout: 'text-gray-500', issue_assigned: 'text-red-500',
  issue_detected: 'text-amber-500', cleaning: 'text-cyan-500', system: 'text-gray-400',
};
const FEED_LABELS: Record<string, string> = {
  checkin: 'IN', checkout: 'OUT', issue_assigned: 'ISS', issue_detected: 'DET', cleaning: 'CLN',
};
const CATEGORY_LABELS: Record<string, string> = {
  checkin: '체크인', parking: '주차', boiler: '보일러', cleaning: '청소', reservation: '예약', emergency: '긴급',
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-gray-400',
};

export default function TeamChat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tab, setTab] = useState<'feed' | 'detections'>('feed');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // --- Data Fetching ---
  const fetchAll = useCallback(() => {
    api.get('/admin/chat/channels').then(res => {
      const chs = res.data || [];
      setChannels(chs);
      if (!selectedChannel && chs.length > 0) setSelectedChannel(chs[0].id);
    });
    api.get('/admin/ops/feed').then(res => {
      setFeed(res.data?.feed || []);
      setSummary(res.data?.summary || null);
    });
    api.get('/admin/issue-detections').then(res => {
      setDetections(res.data?.detections || []);
    });
  }, [selectedChannel]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!selectedChannel) return;
    api.get(`/admin/chat/channels/${selectedChannel}/messages?limit=80`).then(res => setMessages(res.data || []));
  }, [selectedChannel]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 8초 폴링
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedChannel) {
        api.get(`/admin/chat/channels/${selectedChannel}/messages?limit=80`).then(res => setMessages(res.data || []));
      }
      fetchAll();
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedChannel, fetchAll]);

  const handleSend = async () => {
    if (!input.trim() || !selectedChannel) return;
    await api.post(`/admin/chat/channels/${selectedChannel}/messages`, { content: input.trim() });
    setInput('');
    const res = await api.get(`/admin/chat/channels/${selectedChannel}/messages?limit=80`);
    setMessages(res.data || []);
  };

  const handleCreateIssue = async (id: number) => {
    await api.post(`/admin/issue-detections/${id}/create-issue`);
    fetchAll();
  };

  const handleDismiss = async (id: number) => {
    await api.post(`/admin/issue-detections/${id}/dismiss`);
    fetchAll();
  };

  const handleForwardToChat = async (det: Detection) => {
    if (!selectedChannel) return;
    await api.post(`/admin/chat/channels/${selectedChannel}/messages`, {
      content: `[이슈 감지] ${CATEGORY_LABELS[det.detected_category] || det.detected_category}\n게스트: ${det.guest_name}\n${det.message_content?.slice(0, 100)}\n키워드: ${det.detected_keywords}`,
    });
    const res = await api.get(`/admin/chat/channels/${selectedChannel}/messages?limit=80`);
    setMessages(res.data || []);
  };

  const selectedCh = channels.find(c => c.id === selectedChannel);

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* === 왼쪽: 운영 피드 + 이슈 감지 === */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        {/* 오늘 요약 */}
        {summary && (
          <div className="grid grid-cols-3 gap-px bg-gray-200 border-b border-gray-200">
            {[
              { label: 'IN', value: summary.check_ins, color: 'text-blue-600' },
              { label: 'OUT', value: summary.check_outs, color: 'text-gray-600' },
              { label: '이슈', value: summary.issues_pending, color: 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="bg-white p-2 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setTab('feed')} className={`flex-1 py-2 text-xs font-medium ${tab === 'feed' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>
            운영 피드
          </button>
          <button onClick={() => setTab('detections')} className={`flex-1 py-2 text-xs font-medium relative ${tab === 'detections' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
            이슈 감지
            {detections.length > 0 && (
              <span className="absolute -top-0.5 right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{detections.length}</span>
            )}
          </button>
        </div>

        {/* 피드 내용 */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'feed' ? (
            feed.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">오늘 피드가 없습니다</div>
            ) : feed.map((item, i) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${item.severity === 'critical' ? 'bg-red-50' : ''}`}>
                <span className={`text-[10px] font-bold mt-0.5 w-6 flex-shrink-0 ${FEED_ICONS[item.type] || 'text-gray-400'}`}>
                  {FEED_LABELS[item.type] || ''}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">{item.title}</div>
                  <div className="text-[10px] text-gray-500 truncate">{item.detail}</div>
                </div>
              </div>
            ))
          ) : (
            detections.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">감지된 이슈 없음</div>
            ) : detections.map(det => (
              <div key={det.id} className={`px-3 py-2.5 border-b border-gray-100 ${det.severity === 'critical' ? 'bg-red-50' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_COLORS[det.severity]}`} />
                  <span className="text-[10px] font-medium text-gray-600">
                    {CATEGORY_LABELS[det.detected_category]}
                  </span>
                  <span className="text-[10px] text-gray-400">{det.guest_name}</span>
                </div>
                <div className="text-xs text-gray-800 line-clamp-2 mb-1.5">{det.message_content}</div>
                <div className="flex gap-1">
                  <button onClick={() => handleCreateIssue(det.id)} className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded hover:bg-red-700">
                    이슈 등록
                  </button>
                  <button onClick={() => handleForwardToChat(det)} className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded hover:bg-indigo-700">
                    채팅 전달
                  </button>
                  <button onClick={() => handleDismiss(det.id)} className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded hover:bg-gray-300">
                    무시
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* === 가운데: 채팅 === */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* 채널 탭 */}
        <div className="flex items-center bg-white border-b border-gray-200 overflow-x-auto">
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                selectedChannel === ch.id
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {ch.name}
              {ch.unread_count > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1">{ch.unread_count}</span>
              )}
            </button>
          ))}
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-8">메시지가 없습니다</div>
          ) : messages.map(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const isIssue = msg.message_type === 'issue_link';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%]">
                  {!isMe && (
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`px-1 py-px rounded text-[9px] font-bold ${ROLE_COLORS[msg.sender_role] || 'bg-gray-200 text-gray-600'}`}>
                        {ROLE_LABELS[msg.sender_role] || '?'}
                      </span>
                      <span className="text-[10px] text-gray-600">{msg.sender_name}</span>
                    </div>
                  )}
                  <div className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    isMe ? 'bg-indigo-600 text-white' :
                    isIssue ? 'bg-amber-50 border border-amber-200 text-amber-900' :
                    'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    {isIssue && <span className="text-[9px] font-bold text-amber-500 block">ISSUE</span>}
                    {msg.content}
                  </div>
                  <div className={`text-[9px] text-gray-400 mt-px ${isMe ? 'text-right' : ''}`}>
                    {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 */}
        {selectedChannel && (
          <div className="px-4 py-2 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`#${selectedCh?.name || ''} 에 메시지 입력...`}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={handleSend} disabled={!input.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40">
                전송
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
