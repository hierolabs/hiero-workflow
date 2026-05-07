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

interface CTOData {
  my_tasks: Issue[];
  total_tasks: number;
  domains: Record<string, number>;
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

const DOMAIN_LABELS: Record<string, string> = {
  knowledge: '지식 관리',
  research: '연구',
  documentation: '문서화',
  message: '메시지',
  business_plan: '사업계획서',
  technology: '기술 전략',
};

const DOMAIN_ICONS: Record<string, string> = {
  knowledge: 'bg-blue-100 text-blue-700',
  research: 'bg-purple-100 text-purple-700',
  documentation: 'bg-amber-100 text-amber-700',
  message: 'bg-cyan-100 text-cyan-700',
  business_plan: 'bg-pink-100 text-pink-700',
  technology: 'bg-indigo-100 text-indigo-700',
};

const CTO_MISSION = [
  { label: '도시계획의 가치', desc: '변하지 않는 메시지를 기록하고 전달' },
  { label: '아카이빙', desc: '개발 과정 → 블로그·에세이·논문·강의·백서' },
  { label: '연구', desc: '데이터 분석, 방법론, 도시계획+AI 교차점' },
  { label: '실천 방법', desc: '기술 전략과 구현 방향 설계' },
];

export default function CTOBoard() {
  const [data, setData] = useState<CTOData | null>(null);
  const [wiki, setWiki] = useState<WikiProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/etf-board/cto'),
      api.get('/wiki/progress'),
    ]).then(([ctoRes, wikiRes]) => {
      setData(ctoRes.data);
      setWiki(wikiRes.data);
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
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved', resolution }),
      });
      fetchData();
    } catch { alert('해결 처리 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">경영 대시보드</button>
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

      {/* CTO Mission */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">CTO 핵심 역할</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CTO_MISSION.map(m => (
            <div key={m.label} className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-violet-800">{m.label}</div>
              <div className="text-xs text-violet-600 mt-1">{m.desc}</div>
            </div>
          ))}
        </div>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              진행 업무 ({data.total_tasks}건)
            </h2>
            {data.my_tasks.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl divide-y">
                {data.my_tasks.map(task => (
                  <div key={task.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        task.priority === 'P0' ? 'bg-red-100 text-red-700' :
                        task.priority === 'P1' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {task.status === 'in_progress' ? '진행 중' : '대기'}
                      </span>
                      <span className="text-xs text-gray-400">{task.created_at?.slice(0, 10)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900 flex-1">{task.title}</div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() => handleResolve(task.id, '')}
                          className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          ✓ 해결
                        </button>
                        <button
                          onClick={() => handleEscalate(task.id)}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                        >
                          ↑ Founder
                        </button>
                      </div>
                    </div>
                    {task.description && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                진행 중인 업무가 없습니다
              </div>
            )}
          </section>

          {/* Hestory Progress */}
          {wiki && wiki.total > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Hestory — 운영 기록 아카이브</h2>
                <button
                  onClick={() => navigate('/wiki')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                >
                  Hestory
                </button>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round(((wiki.total - wiki.empty) / wiki.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    {Math.round(((wiki.total - wiki.empty) / wiki.total) * 100)}%
                  </span>
                </div>
                <div className="flex gap-3 text-xs mb-4">
                  <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">완료 {wiki.published}</span>
                  <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">검토 {wiki.review}</span>
                  <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">초안 {wiki.draft}</span>
                  <span className="rounded bg-gray-100 px-2 py-1 text-gray-500">빈칸 {wiki.empty}</span>
                  <span className="rounded bg-gray-50 px-2 py-1 text-gray-700">전체 {wiki.total}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(wiki.by_role ?? []).map(r => {
                    const pct = Math.round((r.filled / Math.max(r.total, 1)) * 100);
                    const labels: Record<string, string> = {
                      cto: 'CTO', ceo: 'CEO', cfo: 'CFO', operations: 'Operations',
                      cleaning_dispatch: 'Cleaning', field: 'Field', marketing: 'Marketing', unassigned: '미배정',
                    };
                    return (
                      <div key={r.role} className="flex items-center gap-2">
                        <span className="w-20 text-xs text-gray-600">{labels[r.role] ?? r.role}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 text-right text-[10px] text-gray-500">{r.filled}/{r.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Content Pipeline Status */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">콘텐츠 파이프라인</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y">
              {[
                { type: '블로그', cycle: '주 3회', desc: '개발 로그, 기술 결정, 데이터 인사이트' },
                { type: '에세이', cycle: '주 1회', desc: '"왜 이걸 만드는가" 관점 정리' },
                { type: '논문', cycle: '월 1회', desc: '데이터 분석, 방법론, 도시계획+AI' },
                { type: '강의자료', cycle: '분기 1회', desc: '33 START / 84 STANDARD / 256 SIGNATURE' },
                { type: '백서', cycle: '수시', desc: 'HIERO 기술/비즈니스 백서' },
                { type: '책', cycle: '연 1회', desc: '전체 통합' },
              ].map(item => (
                <div key={item.type} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 w-16">{item.type}</span>
                    <span className="text-xs text-gray-500">{item.desc}</span>
                  </div>
                  <span className="text-xs text-violet-600 font-medium bg-violet-50 px-2 py-1 rounded">{item.cycle}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
