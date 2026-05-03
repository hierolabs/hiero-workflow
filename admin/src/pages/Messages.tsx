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
    const params: Record<string, string> = {};
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

      {/* Right: 요청사항 */}
      {selected && (
        <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">요청사항</h3>
              <button
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
              >
                + 추가
              </button>
            </div>
          </div>


          {/* 요청 추가 폼 */}
          {showRequestForm && (
            <div className="p-3 border-b border-gray-100 space-y-2">
              <select
                value={newRequestType}
                onChange={(e) => setNewRequestType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                value={newRequestNote}
                onChange={(e) => setNewRequestNote(e.target.value)}
                placeholder="상세 내용..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded resize-none"
                rows={2}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateRequest}
                  className="flex-1 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  저장
                </button>
                <button
                  onClick={() => setShowRequestForm(false)}
                  className="flex-1 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 요청 목록 */}
          <div className="flex-1 overflow-y-auto">
            {requests.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">
                등록된 요청이 없습니다
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="px-3 py-2 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {getRequestLabel(req.request_type)}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        STATUS_COLORS[req.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  {req.note && (
                    <p className="text-xs text-gray-500 mt-0.5">{req.note}</p>
                  )}
                  {req.status === "pending" && (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => handleRequestStatus(req.id, "confirmed")}
                        className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => handleRequestStatus(req.id, "rejected")}
                        className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        거절
                      </button>
                      <button
                        onClick={() => handleRequestStatus(req.id, "completed")}
                        className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100"
                      >
                        완료
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showManual && <OperationManual page="messages" onClose={() => setShowManual(false)} />}
    </div>
  );
}
