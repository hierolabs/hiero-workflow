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
  const [syncing, setSyncing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newRequestType, setNewRequestType] = useState("special_request");
  const [newRequestNote, setNewRequestNote] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [rightTab, setRightTab] = useState<'requests' | 'ai' | 'issue'>('requests');
  const [aiSuggestion, setAiSuggestion] = useState<{category:string; severity:string; suggested_reply:string; assign_to:string; assign_role:string} | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 대화 목록 로드 + URL에서 conv 파라미터 처리
  useEffect(() => {
    loadConversations().then(() => {
      const convParam = searchParams.get("conv");
      if (convParam) {
        selectConversation(convParam);
      }
    });
    // 30초마다 대화 목록 새로고침
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadConversations() {
    const params: Record<string, string> = { page_size: "500" };
    if (keyword) params.keyword = keyword;
    const data = await getConversations(params);
    setConversations(data.conversations || []);
  }

  // 대화 선택
  async function selectConversation(convId: string) {
    setSelected(convId);
    const data = await getConversation(convId);
    setMessages(data.messages || []);
    setRequests(data.requests || []);
    setConvDetail(data.conversation || null);

    // 읽음 처리 반���
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

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left: 대화 목록 */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">게스트 메시지</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
              >
                {syncing ? "동기화중..." : "동기화"}
              </button>
            </div>
          </div>
          <input
            type="text"
            placeholder="게스트명 검색..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadConversations()}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 text-center">
              대화가 없습니다. 동기화를 실행해주세요.
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.conversation_id}
                onClick={() => selectConversation(conv.conversation_id)}
                className={`px-3 py-2.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selected === conv.conversation_id ? "bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {conv.guest_name || "게스트"}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500 truncate flex-1">
                    {conv.last_message_preview || "메시지 없음"}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                {conv.channel_type && (
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {conv.channel_type}
                  </span>
                )}
              </div>
            ))
          )}
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
            {/* 채팅 헤더 */}
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900">
                  {convDetail?.guest_name || "게스트"}
                </span>
                {convDetail?.reservation_code && (
                  <span className="ml-2 text-xs text-gray-400">
                    {convDetail.reservation_code}
                  </span>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                새로고침
              </button>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === "host" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      msg.sender_type === "host"
                        ? "bg-blue-500 text-white"
                        : msg.sender_type === "system"
                        ? "bg-gray-200 text-gray-600 text-xs italic"
                        : "bg-white text-gray-900 border border-gray-200"
                    }`}
                  >
                    {msg.message_type === "image" && msg.image_url ? (
                      <img src={msg.image_url} alt="" className="max-w-full rounded" />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div
                      className={`text-[10px] mt-1 ${
                        msg.sender_type === "host" ? "text-blue-100" : "text-gray-400"
                      }`}
                    >
                      {formatTime(msg.sent_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

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

      {/* Right: 요청/AI/이슈 패널 */}
      {selected && (
        <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
          {/* 탭 */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'requests' as const, label: '요청', count: requests.length },
              { key: 'ai' as const, label: 'AI 대응' },
              { key: 'issue' as const, label: '이슈 등록' },
            ].map(t => (
              <button key={t.key} onClick={() => setRightTab(t.key)}
                className={`flex-1 py-2 text-xs font-medium ${rightTab === t.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                {t.label}{t.count ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* 요청사항 탭 */}
            {rightTab === 'requests' && (
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[req.status] || "bg-gray-100"}`}>{req.status}</span>
                    </div>
                    {req.note && <p className="text-xs text-gray-500 mt-0.5">{req.note}</p>}
                    {req.status === "pending" && (
                      <div className="flex gap-1 mt-1">
                        <button onClick={() => handleRequestStatus(req.id, "confirmed")} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">확인</button>
                        <button onClick={() => handleRequestStatus(req.id, "rejected")} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">거절</button>
                        <button onClick={() => handleRequestStatus(req.id, "completed")} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">완료</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* AI 대응 탭 */}
            {rightTab === 'ai' && (
              <div className="p-3 space-y-3">
                <button
                  onClick={async () => {
                    const lastGuest = [...messages].reverse().find(m => m.sender_type === 'guest');
                    if (!lastGuest) return;
                    setAiLoading(true);
                    try {
                      const res = await api.post('/admin/cs-agent/suggest', {
                        message: lastGuest.content,
                        guest_name: convDetail?.guest_name || '',
                      });
                      setAiSuggestion(res.data);
                    } finally { setAiLoading(false); }
                  }}
                  disabled={aiLoading}
                  className="w-full py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiLoading ? '분석 중...' : '마지막 게스트 메시지 분석'}
                </button>

                {aiSuggestion && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        aiSuggestion.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        aiSuggestion.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{aiSuggestion.severity}</span>
                      <span className="text-xs font-medium text-gray-700">{aiSuggestion.category}</span>
                      <span className="text-[10px] text-gray-400">→ {aiSuggestion.assign_to}</span>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <div className="text-[10px] text-indigo-600 font-medium mb-1">추천 응답</div>
                      <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">{aiSuggestion.suggested_reply}</div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setInput(aiSuggestion.suggested_reply);
                          setRightTab('requests');
                        }}
                        className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        입력창에 복사
                      </button>
                      <button
                        onClick={async () => {
                          if (!selected) return;
                          await sendMessage(selected, aiSuggestion.suggested_reply);
                          const data = await getConversation(selected);
                          setMessages(data.messages || []);
                          loadConversations();
                        }}
                        className="flex-1 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        바로 전송
                      </button>
                    </div>
                  </div>
                )}

                {!aiSuggestion && !aiLoading && (
                  <div className="text-xs text-gray-400 text-center py-4">
                    게스트 메시지를 분석하여<br/>카테고리 감지 + 응답 초안을 제안합니다
                  </div>
                )}
              </div>
            )}

            {/* 이슈 등록 탭 */}
            {rightTab === 'issue' && (
              <div className="p-3 space-y-3">
                <div className="text-xs text-gray-500">이 대화에서 이슈를 바로 생성합니다</div>
                <IssueCreateForm
                  conversationId={selected}
                  guestName={convDetail?.guest_name || ''}
                  lastMessage={[...messages].reverse().find(m => m.sender_type === 'guest')?.content || ''}
                  onCreated={() => { setRightTab('requests'); }}
                />
              </div>
            )}
          </div>
        </div>
      )}
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
      <div className="text-[10px] text-gray-400 text-center">이슈 유형에 따라 담당자가 자동 배정됩니다</div>
    </div>
  );
}
