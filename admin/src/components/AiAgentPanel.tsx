import { useState, useRef, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Memory {
  id: number;
  page: string;
  type: string;
  content: string;
  created_at: string;
}

interface AiAgentPanelProps {
  page: string;
  pageLabel: string;
  getPageData?: () => string;
  quickActions?: string[];
}

const DEFAULT_QUICK_ACTIONS: Record<string, string[]> = {
  dashboard: ['이번 달 핵심 이슈 요약해줘', '매출 이상치 있어?', '문제 숙소 분석해줘', '비용 절감 포인트는?'],
  reservations: ['오늘 체크인 리스크 분석', '채널별 예약 성과 비교', '가동률 올릴 방법은?', '노쇼 위험 건 있어?'],
  settlement: ['미정산 건 정리해줘', '이번 달 정산 요약', '수수료 비교 분석', '이상 금액 있어?'],
  profit: ['적자 숙소 분석해줘', '수익률 TOP/BOTTOM', '비용 구조 최적화', '권역별 수익률 비교'],
  cleaning: ['오늘 청소 현황 요약', '배정 최적화 제안', '청소자별 효율 비교', '누락 위험 있어?'],
  issues: ['우선 처리할 이슈는?', '반복 이슈 패턴 있어?', '대응 시간 분석', '예방 조치 제안해줘'],
  team: ['팀원별 업무량 분석', 'KPI 리포트 생성', '인력 재배치 필요?', '이번 주 성과 요약'],
  properties: ['운영 중단 숙소 현황', '권역별 포트폴리오', '숙소 타입별 성과', '계약 만료 임박 건'],
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: '대시보드', reservations: '예약', settlement: '정산',
  profit: '수익성', cleaning: '청소', issues: '민원', team: '팀', properties: '숙소',
};

export default function AiAgentPanel({ page, pageLabel, getPageData, quickActions }: AiAgentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'memory'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = quickActions || DEFAULT_QUICK_ACTIONS[page] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // 패널 열 때 이전 대화 불러오기
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const res = await apiRequest(`/ai/agent/history?page=${page}`);
      const data = await res.json();
      if (data.history && data.history.length > 0) {
        setMessages(data.history.map((h: { role: string; content: string; timestamp: string }) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
          timestamp: h.timestamp,
        })));
      }
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  }, [page, historyLoaded]);

  // 장기 기억 불러오기
  const loadMemories = useCallback(async () => {
    try {
      const res = await apiRequest('/ai/agent/memories');
      const data = await res.json();
      if (data.memories) setMemories(data.memories);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      if (tab === 'memory') loadMemories();
    }
  }, [isOpen, tab, loadHistory, loadMemories]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const pageData = getPageData?.() || '';
      const res = await apiRequest('/ai/agent', {
        method: 'POST',
        body: JSON.stringify({ page, message: text, data: pageData }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg: Message = { role: 'assistant', content: data.answer, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = { role: 'assistant', content: `오류: ${err instanceof Error ? err.message : '응답 실패'}`, timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await apiRequest(`/ai/agent/history?page=${page}`, { method: 'DELETE' });
      setMessages([]);
    } catch { /* ignore */ }
  };

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center z-50 group"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        <span className="absolute -top-8 right-0 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          AI Agent
        </span>
      </button>
    );
  }

  // Panel
  return (
    <div className="fixed bottom-0 right-0 w-[420px] h-[640px] bg-white border-l border-t border-slate-200 shadow-2xl rounded-tl-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 rounded-tl-2xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-white">AI Agent</span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{pageLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setTab(tab === 'chat' ? 'memory' : 'chat')}
            className={`p-1.5 transition-colors ${tab === 'memory' ? 'text-amber-400' : 'text-slate-400 hover:text-white'}`}
            title="장기 기억">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </button>
          <button onClick={clearHistory} className="p-1.5 text-slate-400 hover:text-white transition-colors" title="대화 초기화">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Memory Tab */}
      {tab === 'memory' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">장기 기억</h3>
          <p className="text-xs text-slate-400">Agent들이 대화에서 축적한 인사이트와 요약입니다.</p>
          {memories.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">아직 축적된 기억이 없습니다. 대화를 진행하면 자동으로 기억됩니다.</p>
          )}
          {memories.map(m => (
            <div key={m.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  m.type === 'insight' ? 'bg-blue-100 text-blue-700' :
                  m.type === 'summary' ? 'bg-violet-100 text-violet-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{m.type === 'insight' ? '인사이트' : m.type === 'summary' ? '요약' : '결정'}</span>
                <span className="text-[10px] text-slate-400">{PAGE_LABELS[m.page] || m.page}</span>
                <span className="text-[10px] text-slate-300">{new Date(m.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chat Tab */}
      {tab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">{pageLabel} AI Agent</p>
                <p className="text-xs text-slate-400 mb-1">이 페이지의 데이터를 분석하고 인사이트를 제공합니다</p>
                <p className="text-[10px] text-slate-300">대화는 자동 저장되며, 다른 페이지 Agent와 인사이트를 공유합니다</p>
              </div>
            )}

            {messages.length > 0 && !loading && messages[0].role === 'user' && (
              <div className="text-center">
                <span className="text-[10px] text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full">이전 대화가 복원되었습니다</span>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-[10px] mt-1 text-slate-400">{msg.timestamp}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && actions.length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {actions.map((action, i) => (
                  <button key={i} onClick={() => sendMessage(action)}
                    className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-200 p-3">
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="질문을 입력하세요..."
                disabled={loading}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50"
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
