import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

interface TopDecision {
  id: number;
  title: string;
  domain: string;
  reason: string;
  requested_by: string;
  decision_type: string;
  priority: string;
  created_at: string;
  escalated_from: string;
  escalation_level: string;
  assignee_name: string;
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장',
};

interface ETFSummary {
  ceo: { bottlenecks: number; delayed_tasks: number; approval_pending: number };
  cto: { documentation_tasks: number; research_tasks: number; message_review: number };
  cfo: { unsettled_count: number; tax_review_count: number; accounting_review_count: number };
}

interface DailyBrief {
  date: string;
  top_decisions: TopDecision[];
  etf_summary: { ceo_status: string; cto_status: string; cfo_status: string };
  risk_alerts: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  strategy: 'bg-purple-100 text-purple-800',
  money: 'bg-emerald-100 text-emerald-800',
  property: 'bg-blue-100 text-blue-800',
  operations: 'bg-amber-100 text-amber-800',
  growth: 'bg-pink-100 text-pink-800',
  people: 'bg-sky-100 text-sky-800',
  risk: 'bg-red-100 text-red-800',
};

const DECISION_LABELS: Record<string, string> = {
  strategic_direction: '전략 결정',
  high_risk: '고위험 승인',
  approve_or_reject: '승인/반려',
  policy_decision: '정책 결정',
  operational: '운영 결정',
};

// HIERO 업무 퍼널 (발견→분석→생성→영업→운영) × ETF × Founder OS
const WORK_FUNNEL = [
  {
    stage: '01', label: '발견', desc: 'Discovery',
    etf: 'CTO', color: 'border-violet-400',
    modules: [
      { label: 'Property OS', sub: '숙소·진단·등급', path: '/diagnosis', color: 'bg-blue-600' },
    ],
  },
  {
    stage: '02', label: '분석', desc: 'Analysis',
    etf: 'CTO', color: 'border-violet-400',
    modules: [
      { label: 'Property OS', sub: '데이터·KPI·등급', path: '/properties', color: 'bg-blue-600' },
    ],
  },
  {
    stage: '03', label: '생성', desc: 'Generation',
    etf: 'CTO', color: 'border-violet-400',
    modules: [
      { label: 'Growth OS', sub: '콘텐츠·제안서·랜딩', path: '/leads', color: 'bg-pink-600' },
    ],
  },
  {
    stage: '04', label: '영업', desc: 'Sales',
    etf: 'CEO', color: 'border-indigo-400',
    modules: [
      { label: 'Growth OS', sub: '리드·전환·영업', path: '/leads', color: 'bg-pink-600' },
      { label: 'People OS', sub: '팀·역할·성과', path: '/team', color: 'bg-sky-600' },
    ],
  },
  {
    stage: '05', label: '운영', desc: 'Operations',
    etf: 'CEO + CFO', color: 'border-emerald-400',
    modules: [
      { label: 'Operations OS', sub: '예약·청소·CS', path: '/calendar', color: 'bg-amber-600' },
      { label: 'Money OS', sub: '매출·정산·비용', path: '/settlement', color: 'bg-emerald-600' },
      { label: 'Risk OS', sub: '민원·하자·지연', path: '/issues', color: 'bg-red-600' },
    ],
  },
];

export default function FounderDashboard() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [etfSummary, setETFSummary] = useState<ETFSummary | null>(null);
  const [pipeline, setPipeline] = useState<{ lead: number; meeting: number; negotiating: number; contracted: number; setting: number; filming: number; ota_registering: number; operation_ready: number; active: number; bottleneck_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/founder/daily-brief'),
      api.get('/founder/etf-summary'),
      api.get('/lifecycle/pipeline'),
    ]).then(([briefRes, etfRes, pipeRes]) => {
      setBrief(briefRes.data);
      setETFSummary(etfRes.data);
      setPipeline(pipeRes.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFounderAction = async (issueId: number, action: 'approve' | 'reject' | 'return') => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_URL;
    try {
      if (action === 'approve') {
        await fetch(`${base}/issues/${issueId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'resolved', resolution: 'Founder 승인' }),
        });
      } else if (action === 'reject') {
        await fetch(`${base}/issues/${issueId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'closed', resolution: 'Founder 반려' }),
        });
      } else if (action === 'return') {
        // ETF로 돌려보내기 — escalation_level을 etf로 내림
        await api.post(`/issues/${issueId}/escalate`); // 현재는 위로만 가지만, assignee 변경으로 대체
        // 실제로는 이전 ETF 담당자에게 재배정
        const usersRes = await fetch(`${base}/users`, { headers: { Authorization: `Bearer ${token}` } });
        const users = await usersRes.json();
        const ceo = (users.users || users || []).find((u: { role_title: string }) => u.role_title === 'ceo');
        if (ceo) {
          await fetch(`${base}/issues/${issueId}/assignee`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ assignee_name: ceo.name }),
          });
        }
      }
      fetchData();
    } catch { alert('처리 실패'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = dayNames[today.getDay()];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
            <span className="text-white text-sm font-bold">F</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">경영 대시보드</h1>
            <p className="text-sm text-gray-500">{dateStr} ({dayStr}) — Founder OS</p>
          </div>
        </div>
      </div>

      {/* Risk Alert */}
      {brief && brief.risk_alerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <div>
            <span className="text-red-800 text-sm font-semibold">고위험 이슈 {brief.risk_alerts}건</span>
            <span className="text-red-600 text-xs ml-2">즉시 확인 필요</span>
          </div>
        </div>
      )}

      {/* 오늘 결정할 3가지 */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 결정할 3가지</h2>
        {brief && brief.top_decisions.length > 0 ? (
          <div className="space-y-3">
            {brief.top_decisions.slice(0, 3).map((d, i) => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${DOMAIN_COLORS[d.domain] || 'bg-gray-100 text-gray-700'}`}>
                        {d.domain}
                      </span>
                      <span className="text-xs text-gray-500">
                        {DECISION_LABELS[d.decision_type] || d.decision_type}
                      </span>
                      {d.priority === 'P0' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">긴급</span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{d.title}</h3>
                    {d.reason && <p className="text-sm text-gray-600 mt-1 line-clamp-3">{d.reason}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {d.escalated_from && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                            {ROLE_LABELS[d.escalated_from] || d.escalated_from}에서 올림
                          </span>
                        )}
                        {d.requested_by && (
                          <span className="text-xs text-gray-400">요청: {d.requested_by}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFounderAction(d.id, 'approve')}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                        >
                          ✓ 승인
                        </button>
                        <button
                          onClick={() => handleFounderAction(d.id, 'return')}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        >
                          ↓ ETF로 돌려보내기
                        </button>
                        <button
                          onClick={() => handleFounderAction(d.id, 'reject')}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
                        >
                          ✗ 반려
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="text-gray-400 text-sm">오늘 결정할 사항이 없습니다</div>
            <div className="text-gray-300 text-xs mt-1">ETF가 잘 돌아가고 있습니다</div>
          </div>
        )}
      </section>

      {/* ETF Executive Layer — 폴더 진입 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">ETF Executive Layer</h2>
          <button
            onClick={() => navigate('/etf-board')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            전체 보기 →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CEO */}
          <div
            onClick={() => navigate('/etf-board/ceo')}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs group-hover:bg-indigo-200 transition">
                CEO
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">CEO</div>
                <div className="text-xs text-gray-500">경영 전반 · 조직 운영</div>
              </div>
            </div>
            {etfSummary && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">병목</span>
                  <span className={`font-medium ${etfSummary.ceo.bottlenecks > 0 ? 'text-red-600' : 'text-gray-400'}`}>{etfSummary.ceo.bottlenecks}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">지연</span>
                  <span className={`font-medium ${etfSummary.ceo.delayed_tasks > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{etfSummary.ceo.delayed_tasks}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">승인 대기</span>
                  <span className={`font-medium ${etfSummary.ceo.approval_pending > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{etfSummary.ceo.approval_pending}</span>
                </div>
              </div>
            )}
          </div>

          {/* CTO */}
          <div
            onClick={() => navigate('/etf-board/cto')}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs group-hover:bg-violet-200 transition">
                CTO
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">CTO</div>
                <div className="text-xs text-gray-500">기술 · 기록 · 연구</div>
              </div>
            </div>
            {etfSummary && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">문서화</span>
                  <span className="font-medium text-violet-600">{etfSummary.cto.documentation_tasks}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">연구</span>
                  <span className="font-medium text-violet-600">{etfSummary.cto.research_tasks}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">메시지 검토</span>
                  <span className="font-medium text-violet-600">{etfSummary.cto.message_review}</span>
                </div>
              </div>
            )}
          </div>

          {/* CFO */}
          <div
            onClick={() => navigate('/etf-board/cfo')}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition cursor-pointer group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs group-hover:bg-emerald-200 transition">
                CFO
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">CFO</div>
                <div className="text-xs text-gray-500">정산 · 재무 · 회계</div>
              </div>
            </div>
            {etfSummary && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">미정산</span>
                  <span className={`font-medium ${etfSummary.cfo.unsettled_count > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{etfSummary.cfo.unsettled_count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">세무 검토</span>
                  <span className={`font-medium ${etfSummary.cfo.tax_review_count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{etfSummary.cfo.tax_review_count}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">회계 확인</span>
                  <span className="font-medium text-gray-400">{etfSummary.cfo.accounting_review_count}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 공급 파이프라인 */}
      {pipeline && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">공급 파이프라인</h2>
            {pipeline.bottleneck_count > 0 && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                병목 {pipeline.bottleneck_count}건
              </span>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-9 gap-1 text-center text-xs">
              {[
                { k: 'lead', l: 'Lead', c: 'bg-pink-50 text-pink-700' },
                { k: 'meeting', l: 'Meeting', c: 'bg-pink-50 text-pink-700' },
                { k: 'negotiating', l: '협상', c: 'bg-pink-50 text-pink-700' },
                { k: 'contracted', l: '계약', c: 'bg-indigo-50 text-indigo-700' },
                { k: 'setting', l: '세팅', c: 'bg-amber-50 text-amber-700' },
                { k: 'filming', l: '촬영', c: 'bg-amber-50 text-amber-700' },
                { k: 'ota_registering', l: 'OTA', c: 'bg-violet-50 text-violet-700' },
                { k: 'operation_ready', l: '준비', c: 'bg-violet-50 text-violet-700' },
                { k: 'active', l: 'Active', c: 'bg-emerald-50 text-emerald-700' },
              ].map(s => {
                const v = (pipeline as Record<string, number>)[s.k] || 0;
                return (
                  <div key={s.k} className={`rounded-lg py-2 ${s.c} ${v > 0 ? 'font-bold' : 'opacity-40'}`}>
                    <div className="text-lg">{v}</div>
                    <div className="text-[10px]">{s.l}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 업무 퍼널 (발견→분석→생성→영업→운영) */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-1">업무 퍼널</h2>
        <p className="text-xs text-gray-400 mb-4">발견 → 분석 → 생성 → 영업 → 운영</p>
        <div className="space-y-3">
          {WORK_FUNNEL.map(stage => (
            <div key={stage.stage} className={`bg-white border-l-4 ${stage.color} border border-gray-200 rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-200">{stage.stage}</span>
                  <div>
                    <span className="text-sm font-bold text-gray-900">{stage.label}</span>
                    <span className="text-xs text-gray-400 ml-2">{stage.desc}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">{stage.etf}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stage.modules.map(m => (
                  <button
                    key={m.label + m.path}
                    onClick={() => navigate(m.path)}
                    className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition"
                  >
                    <div className={`w-6 h-6 rounded ${m.color} flex items-center justify-center`}>
                      <span className="text-white text-[10px] font-bold">{m.label.charAt(0)}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold text-gray-800">{m.label}</div>
                      <div className="text-[10px] text-gray-500">{m.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
