import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';


interface Issue {
  id: number;
  title: string;
  priority: string;
  status: string;
  issue_type: string;
  description: string;
  created_at: string;
}

interface Directive {
  id: number;
  type: string;
  from_role: string;
  from_user_name: string;
  to_role: string;
  to_user_name: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  server_analysis: string;
  has_conflict: boolean;
  result_memo: string;
  created_at: string;
}

interface CTOData {
  my_tasks: Issue[];
  total_tasks: number;
  domains: Record<string, number>;
  received_directives: Directive[];
  sent_directives: Directive[];
}

interface WikiProgress {
  total: number;
  empty: number;
  draft: number;
  review: number;
  published: number;
  by_part: { part_number: number; part_title: string; total: number; filled: number }[];
  by_role: { role: string; total: number; filled: number }[];
}

interface WikiTOCItem {
  id: number;
  part_number: number;
  part_title: string;
  section: string;
  title: string;
  status: string;
  word_count: number;
  updated_at: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  knowledge: '지식 관리', research: '연구', documentation: '문서화',
  message: '메시지', business_plan: '사업계획서', technology: '기술 전략',
};

const DOMAIN_ICONS: Record<string, string> = {
  knowledge: 'bg-blue-100 text-blue-700', research: 'bg-purple-100 text-purple-700',
  documentation: 'bg-amber-100 text-amber-700', message: 'bg-cyan-100 text-cyan-700',
  business_plan: 'bg-pink-100 text-pink-700', technology: 'bg-indigo-100 text-indigo-700',
};

const CTO_MISSION = [
  { label: '도시계획의 가치', desc: '변하지 않는 메시지를 기록하고 전달', parts: [0, 10] },
  { label: '아카이빙', desc: '개발 과정 → 블로그·에세이·논문·강의·백서', parts: [9, 11] },
  { label: '연구', desc: '데이터 분석, 방법론, 도시계획+AI 교차점', parts: [10, 2] },
  { label: '실천 방법', desc: '기술 전략과 구현 방향 설계', parts: [7, 8] },
];

const statusDot: Record<string, string> = {
  published: 'bg-green-500', review: 'bg-blue-500', draft: 'bg-amber-500', empty: 'bg-gray-300',
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO', founder: 'Founder',
  marketing: '마케팅', operations: '운영', cleaning_dispatch: '청소배정', field: '현장',
};

const PRIORITY_DOTS: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-blue-400', low: 'bg-gray-400',
};

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
  completed: { bg: 'bg-green-100 text-green-700', label: '완료' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
};

const TYPE_LABELS: Record<string, string> = {
  directive: '↓ 지시', report: '↑ 보고', lateral: '↔ 협의',
};

export default function CTOBoard() {
  const [data, setData] = useState<CTOData | null>(null);
  const [wiki, setWiki] = useState<WikiProgress | null>(null);
  const [wikiToc, setWikiToc] = useState<WikiTOCItem[]>([]);
  const [expandedMission, setExpandedMission] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'work' | 'received' | 'sent'>('work');
  const navigate = useNavigate();

  // 지시 작성 폼
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ to_role: 'marketing', type: 'directive', priority: 'normal', title: '', content: '' });
  // 평가 요약
  const [reviewSummary, setReviewSummary] = useState<{ article_id: number; article_title: string; avg_score: number; min_score: number; review_count: number }[]>([]);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/etf-board/cto'),
      api.get('/wiki/progress'),
      api.get('/wiki/toc'),
      api.get('/archiving/review-summary'),
    ]).then(([ctoRes, wikiRes, tocRes, revRes]) => {
      setData(ctoRes.data);
      setWiki(wikiRes.data);
      setWikiToc(tocRes.data?.items ?? []);
      setReviewSummary(revRes.data?.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEscalate = async (issueId: number) => {
    if (!confirm('이 이슈를 Founder에게 에스컬레이트하시겠습니까?')) return;
    try {
      await api.post(`/issues/${issueId}/escalate`);
      fetchData();
    } catch { alert('에스컬레이트 실패'); }
  };

  const handleResolve = async (issueId: number, resolution: string) => {
    try {
      await api.patch(`/issues/${issueId}/status`, { status: 'resolved', resolution });
      fetchData();
    } catch { alert('해결 처리 실패'); }
  };

  const handleDirectiveAction = async (id: number, action: string, memo?: string) => {
    try {
      if (action === 'complete') {
        await api.patch(`/directives/${id}/complete`, { result_memo: memo || '' });
      } else {
        await api.patch(`/directives/${id}/${action}`);
      }
      fetchData();
    } catch { alert('처리 실패'); }
  };

  const handleCreateDirective = async () => {
    if (!formData.title.trim()) { alert('제목을 입력하세요'); return; }
    try {
      const me = JSON.parse(localStorage.getItem('user') || '{}');
      await api.post('/directives', { ...formData, from_user_id: me.id || 3 });
      setShowForm(false);
      setFormData({ to_role: 'marketing', type: 'directive', priority: 'normal', title: '', content: '' });
      fetchData();
    } catch { alert('지시 생성 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const receivedCount = data?.received_directives?.length ?? 0;
  const sentCount = data?.sent_directives?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">GOT</button>
          <span>/</span>
          <button onClick={() => navigate('/etf-board')} className="hover:text-gray-600">ETF Board</button>
          <span>/</span>
          <span className="text-gray-600">CTO</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CTO</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CTO Board</h1>
            <p className="text-sm text-gray-500">기술 총괄 · 기록 · 연구 · 도시계획의 가치</p>
          </div>
        </div>
      </div>

      {/* 3탭 네비게이션 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'work' as const, label: '업무 현황', badge: data?.total_tasks },
          { key: 'received' as const, label: '받은 지시', badge: receivedCount },
          { key: 'sent' as const, label: '보낸 지시', badge: sentCount },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge ? <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* === TAB 1: 업무 현황 === */}
      {tab === 'work' && (
        <>
          {/* CTO Mission */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">CTO 핵심 역할</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CTO_MISSION.map((m, idx) => {
                const articles = wikiToc.filter(a => m.parts.includes(a.part_number));
                const filled = articles.filter(a => a.status !== 'empty').length;
                const isExpanded = expandedMission === idx;
                return (
                  <div key={m.label}>
                    <button
                      onClick={() => setExpandedMission(isExpanded ? null : idx)}
                      className={`w-full text-left rounded-xl p-4 border transition-all ${
                        isExpanded ? 'bg-violet-100 border-violet-400 shadow-sm' : 'bg-violet-50 border-violet-200 hover:border-violet-300'
                      }`}
                    >
                      <div className="text-sm font-semibold text-violet-800">{m.label}</div>
                      <div className="text-xs text-violet-600 mt-1">{m.desc}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-violet-200">
                          <div className="h-1 rounded-full bg-violet-600 transition-all" style={{ width: `${(filled / Math.max(articles.length, 1)) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-violet-500">{filled}/{articles.length}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
            {expandedMission !== null && (() => {
              const m = CTO_MISSION[expandedMission];
              const articles = wikiToc
                .filter(a => m.parts.includes(a.part_number))
                .sort((a, b) => {
                  const order: Record<string, number> = { draft: 0, review: 1, published: 2, empty: 3 };
                  return (order[a.status] ?? 9) - (order[b.status] ?? 9);
                });
              return (
                <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">{m.label} — 관련 위키 ({articles.length})</h3>
                    <button onClick={() => navigate('/wiki')} className="text-xs text-violet-600 hover:underline">위키 열기</button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {articles.map(a => (
                      <button key={a.id} onClick={() => navigate('/wiki')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[a.status] || 'bg-gray-300'}`} />
                        <span className="text-xs text-gray-400 w-8 shrink-0">{a.section}</span>
                        <span className="flex-1 text-xs text-gray-700 truncate">{a.title}</span>
                        {a.word_count > 0 && <span className="text-[10px] text-gray-400 shrink-0">{a.word_count.toLocaleString()}자</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>

          {data && (
            <>
              {/* Domain Summary */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">업무 도메인</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(data.domains).map(([key, count]) => (
                    <div key={key} className={`rounded-xl p-4 ${DOMAIN_ICONS[key] || 'bg-gray-100 text-gray-700'}`}>
                      <div className="text-xs font-medium mb-1">{DOMAIN_LABELS[key] || key}</div>
                      <div className="text-2xl font-bold">{count}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Task List */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">진행 업무 ({data.total_tasks}건)</h2>
                {data.my_tasks.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl divide-y">
                    {data.my_tasks.map(task => (
                      <div key={task.id} className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            task.priority === 'P0' ? 'bg-red-100 text-red-700' :
                            task.priority === 'P1' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                          }`}>{task.priority}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>{task.status === 'in_progress' ? '진행 중' : '대기'}</span>
                          <span className="text-xs text-gray-400">{task.created_at?.slice(0, 10)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-900 flex-1">{task.title}</div>
                          <div className="flex items-center gap-2 ml-3">
                            <button onClick={() => handleResolve(task.id, '')} className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                              ✓ 해결
                            </button>
                            <button onClick={() => handleEscalate(task.id)} className="px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700">
                              ↑ GOT
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">진행 중인 업무가 없습니다</div>
                )}
              </section>

              {/* Hestory */}
              {wiki && wiki.total > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Hestory — 운영 기록 아카이브</h2>
                    <button onClick={() => navigate('/wiki')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-700">Hestory</button>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${Math.round(((wiki.total - wiki.empty) / wiki.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{Math.round(((wiki.total - wiki.empty) / wiki.total) * 100)}%</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">완료 {wiki.published}</span>
                      <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">검토 {wiki.review}</span>
                      <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">초안 {wiki.draft}</span>
                      <span className="rounded bg-gray-100 px-2 py-1 text-gray-500">빈칸 {wiki.empty}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 위키 평가 현황 */}
              {reviewSummary.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">위키 평가 현황</h2>
                    <span className="text-xs text-gray-400">{reviewSummary.length}개 평가됨</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl divide-y">
                    {reviewSummary.slice(0, 5).map(r => {
                      const scoreColor = r.avg_score >= 8 ? 'text-emerald-700 bg-emerald-50' :
                                         r.avg_score >= 6 ? 'text-blue-700 bg-blue-50' :
                                         r.avg_score >= 4 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
                      return (
                        <button
                          key={r.article_id}
                          onClick={() => navigate('/wiki')}
                          className="flex items-center justify-between w-full p-3 hover:bg-gray-50 transition text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{r.article_title}</div>
                            <div className="text-[10px] text-gray-400">{r.review_count}개 관점</div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${scoreColor}`}>
                              평균 {r.avg_score}
                            </span>
                            {r.min_score < 6 && (
                              <span className="text-[10px] text-red-500">최저 {r.min_score}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* === TAB 2: 받은 지시 === */}
      {tab === 'received' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">받은 지시 ({receivedCount}건)</h2>
          {receivedCount === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center text-sm text-gray-400">받은 지시가 없습니다</div>
          ) : (
            <div className="space-y-3">
              {(data?.received_directives ?? []).map(d => (
                <div key={d.id} className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[d.priority] ?? 'bg-gray-400'}`} />
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{TYPE_LABELS[d.type] ?? d.type}</span>
                      <span className="text-sm font-medium text-gray-900">{d.title}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
                      {STATUS_BADGES[d.status]?.label ?? d.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {d.from_user_name} ({ROLE_LABELS[d.from_role]}) → CTO · {d.created_at?.slice(5, 16)}
                  </div>
                  {d.content && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">{d.content}</div>}
                  {d.server_analysis && (
                    <div className={`text-xs rounded p-2 mb-3 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {d.server_analysis}
                    </div>
                  )}
                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    {d.status === 'pending' && (
                      <button onClick={() => handleDirectiveAction(d.id, 'acknowledge')} className="px-3 py-1.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">확인</button>
                    )}
                    {d.status === 'acknowledged' && (
                      <button onClick={() => handleDirectiveAction(d.id, 'start')} className="px-3 py-1.5 rounded text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100">시작</button>
                    )}
                    {(d.status === 'acknowledged' || d.status === 'in_progress') && (
                      <button onClick={() => {
                        const memo = prompt('완료 메모를 입력하세요:');
                        if (memo !== null) handleDirectiveAction(d.id, 'complete', memo);
                      }} className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100">완료</button>
                    )}
                    {d.status !== 'completed' && d.status !== 'rejected' && (
                      <button onClick={() => {
                        const reason = prompt('거부 사유:');
                        if (reason) handleDirectiveAction(d.id, 'reject');
                      }} className="px-3 py-1.5 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">거부</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* === TAB 3: 보낸 지시 === */}
      {tab === 'sent' && (
        <>
          {/* 새 지시 작성 */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700"
            >
              {showForm ? '취소' : '+ 새 지시'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">새 업무 지시 작성</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">수신자</label>
                  <select value={formData.to_role} onChange={e => setFormData({ ...formData, to_role: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="marketing">마케팅</option>
                    <option value="operations">운영</option>
                    <option value="ceo">CEO (협의)</option>
                    <option value="cfo">CFO (협의)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">유형</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="directive">↓ 지시</option>
                    <option value="lateral">↔ 협의</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">우선순위</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="urgent">즉시</option>
                    <option value="high">오늘</option>
                    <option value="normal">이번 주</option>
                    <option value="low">여유</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">제목</label>
                <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="업무 제목" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">내용</label>
                <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} placeholder="상세 내용" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={handleCreateDirective} className="w-full py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700">
                보내기 (서버 분석 후 저장)
              </button>
            </div>
          )}

          {/* 보낸 지시 목록 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">보낸 지시 ({sentCount}건)</h2>
            {sentCount === 0 ? (
              <div className="bg-gray-50 rounded-xl p-12 text-center text-sm text-gray-400">보낸 지시가 없습니다</div>
            ) : (
              <div className="space-y-3">
                {(data?.sent_directives ?? []).map(d => (
                  <div key={d.id} className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[d.priority] ?? 'bg-gray-400'}`} />
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{TYPE_LABELS[d.type] ?? d.type}</span>
                        <span className="text-sm font-medium text-gray-900">{d.title}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
                        {STATUS_BADGES[d.status]?.label ?? d.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      CTO → {d.to_user_name} ({ROLE_LABELS[d.to_role]}) · {d.created_at?.slice(5, 16)}
                    </div>
                    {d.content && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-2">{d.content}</div>}
                    {d.result_memo && <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2 mt-2">결과: {d.result_memo}</div>}
                    {d.server_analysis && (
                      <div className={`text-xs rounded p-2 mt-2 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        {d.server_analysis}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
