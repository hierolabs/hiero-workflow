import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "../utils/api";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
}

interface AiChatContext {
  page: string;
  view_mode: string;
  period: string;
  date_from: string;
  date_to: string;
  total: number;
  sum_rate: number;
  sum_nights: number;
}

interface AiChatProps {
  context: AiChatContext;
  onClose: () => void;
}

export default function AiChat({ context, onClose }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (overrideMsg?: string) => {
    const msg = (overrideMsg || input).trim();
    if (!msg || loading) return;

    if (!overrideMsg) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await apiRequest("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg, context }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "ai", content: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: `오류: ${data.error || "응답 실패"}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "네트워크 오류가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex w-96 flex-col rounded-xl border border-gray-200 bg-white shadow-2xl" style={{ height: "520px" }}>
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b border-gray-100 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-wide">HIERO OAI</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white/80">예약 데이터</span>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-sm font-bold text-gray-600 mb-0.5">HIERO OAI</p>
            <p className="text-xs leading-relaxed text-gray-400 mb-4">
              현재 화면의 예약 데이터를 기반으로<br />
              질문에 답변합니다.
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {["채널별 매출 비교해줘", "가장 많이 예약된 숙소는?", "평균 숙박일수 알려줘"].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-slate-800 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
            placeholder="예약 데이터에 대해 질문하세요..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
