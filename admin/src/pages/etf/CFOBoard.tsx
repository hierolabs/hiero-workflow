import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

interface Issue {
  id: number;
  title: string;
  priority: string;
  status: string;
  issue_type: string;
  property_name: string;
  created_at: string;
}

interface DataFlowSummary {
  label: string;
  description: string;
  source: string;
  this_month: number;
  last_month: number;
  change: number;
  change_rate: number;
}

interface MonthlyPL {
  month: string;
  revenue: number;
  cost: number;
  net: number;
  margin: number;
}

interface FinancialFlow {
  data1: DataFlowSummary;
  data2: DataFlowSummary;
  data3: DataFlowSummary;
  monthly_trend: MonthlyPL[];
}

interface CFOData {
  my_tasks: Issue[];
  unsettled_count: number;
  tax_review_count: number;
  accounting_review: number;
  settlement_delayed: number;
  total_tasks: number;
  received_directives: Directive[];
  sent_directives: Directive[];
  financial: FinancialFlow;
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
  result_memo: string;
  server_analysis: string;
  has_conflict: boolean;
  created_at: string;
  completed_at: string | null;
}

const PRIORITY_LABELS: Record<string, { bg: string; label: string }> = {
  urgent: { bg: 'bg-red-100 text-red-700', label: '즉시' },
  high: { bg: 'bg-orange-100 text-orange-700', label: '오늘' },
  normal: { bg: 'bg-blue-100 text-blue-700', label: '이번주' },
  low: { bg: 'bg-gray-100 text-gray-600', label: '여유' },
};

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
  completed: { bg: 'bg-green-100 text-green-700', label: '완료' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
};

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장', founder: 'Founder',
};

// CFO가 지시할 수 있는 대상
const CFO_DIRECTIVE_TARGETS = [
  { role: 'operations', label: '운영' },
  { role: 'cleaning_dispatch', label: '청소배정' },
];

// 기간 프리셋
function getDateRange(preset: string): { start: string; end: string; label: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const dow = now.getDay() || 7; // 월=1 ... 일=7

  switch (preset) {
    case 'yesterday': {
      const t = new Date(y, m, d - 1);
      return { start: fmt(t), end: fmt(t), label: '어제' };
    }
    case 'today':
      return { start: fmt(now), end: fmt(now), label: '오늘' };
    case 'tomorrow': {
      const t = new Date(y, m, d + 1);
      return { start: fmt(t), end: fmt(t), label: '내일' };
    }
    case 'last_week': {
      const s = new Date(y, m, d - dow - 6);
      const e = new Date(y, m, d - dow);
      return { start: fmt(s), end: fmt(e), label: '지난주' };
    }
    case 'this_week': {
      const s = new Date(y, m, d - dow + 1);
      const e = new Date(y, m, d - dow + 7);
      return { start: fmt(s), end: fmt(e), label: '이번주' };
    }
    case 'next_week': {
      const s = new Date(y, m, d - dow + 8);
      const e = new Date(y, m, d - dow + 14);
      return { start: fmt(s), end: fmt(e), label: '다음주' };
    }
    case 'last_month': {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { start: fmt(s), end: fmt(e), label: '지난달' };
    }
    case 'this_month': {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      return { start: fmt(s), end: fmt(e), label: '이번달' };
    }
    case 'next_month': {
      const s = new Date(y, m + 1, 1);
      const e = new Date(y, m + 2, 0);
      return { start: fmt(s), end: fmt(e), label: '다음달' };
    }
    case 'last_quarter': {
      const qm = Math.floor(m / 3) * 3;
      const s = new Date(y, qm - 3, 1);
      const e = new Date(y, qm, 0);
      return { start: fmt(s), end: fmt(e), label: '지난분기' };
    }
    case 'this_quarter': {
      const qm = Math.floor(m / 3) * 3;
      const s = new Date(y, qm, 1);
      const e = new Date(y, qm + 3, 0);
      return { start: fmt(s), end: fmt(e), label: '이번분기' };
    }
    case 'next_quarter': {
      const qm = Math.floor(m / 3) * 3;
      const s = new Date(y, qm + 3, 1);
      const e = new Date(y, qm + 6, 0);
      return { start: fmt(s), end: fmt(e), label: '다음분기' };
    }
    case 'last_year':
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31`, label: '작년' };
    case 'this_year':
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: '올해' };
    case 'next_year':
      return { start: `${y + 1}-01-01`, end: `${y + 1}-12-31`, label: '내년' };
    default:
      return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)), label: '이번달' };
  }
}

const PERIOD_PRESETS = [
  { group: '일', items: [
    { key: 'yesterday', label: '어제' },
    { key: 'today', label: '오늘' },
    { key: 'tomorrow', label: '내일' },
  ]},
  { group: '주', items: [
    { key: 'last_week', label: '지난주' },
    { key: 'this_week', label: '이번주' },
    { key: 'next_week', label: '다음주' },
  ]},
  { group: '월', items: [
    { key: 'last_month', label: '지난달' },
    { key: 'this_month', label: '이번달' },
    { key: 'next_month', label: '다음달' },
  ]},
  { group: '분기', items: [
    { key: 'last_quarter', label: '지난분기' },
    { key: 'this_quarter', label: '이번분기' },
    { key: 'next_quarter', label: '다음분기' },
  ]},
  { group: '연', items: [
    { key: 'last_year', label: '작년' },
    { key: 'this_year', label: '올해' },
    { key: 'next_year', label: '내년' },
  ]},
];

export default function CFOBoard() {
  const [data, setData] = useState<CFOData | null>(null);
  const [sentDirectives, setSentDirectives] = useState<Directive[]>([]);
  const [receivedDirectives, setReceivedDirectives] = useState<Directive[]>([]);
  const [reports, setReports] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'finance' | 'tasks' | 'sent' | 'received' | 'reports'>('finance');
  const [periodKey, setPeriodKey] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [anomalies, setAnomalies] = useState<{ type: string; severity: string; title: string; evidence: string; impact: string; action: string }[]>([]);
  const navigate = useNavigate();

  // 지시 생성 폼
  const [form, setForm] = useState({ to_role: '', title: '', content: '', priority: 'normal' });

  const currentRange = periodKey === 'custom'
    ? { start: customStart, end: customEnd, label: `${customStart} ~ ${customEnd}` }
    : getDateRange(periodKey);

  const fetchData = useCallback(() => {
    setLoading(true);
    const range = periodKey === 'custom'
      ? { start: customStart, end: customEnd }
      : getDateRange(periodKey);

    Promise.all([
      api.get('/etf-board/cfo'),
      api.get(`/etf-board/cfo/financial?start_date=${range.start}&end_date=${range.end}`).catch(() => null),
      api.get('/founder/anomalies').catch(() => null),
    ]).then(([cfoRes, finRes, anomalyRes]) => {
      setAnomalies(anomalyRes?.data?.alerts ?? []);
      const d = cfoRes.data;
      if (finRes?.data) {
        d.financial = finRes.data;
      }
      setData(d);
      setSentDirectives(d.sent_directives ?? []);
      setReceivedDirectives((d.received_directives ?? []).filter((dir: Directive) => dir.type !== 'report'));
      setReports((d.received_directives ?? []).filter((dir: Directive) => dir.type === 'report'));
    }).finally(() => setLoading(false));
  }, [periodKey, customStart, customEnd]);

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

  const handleCreateDirective = async () => {
    if (!form.to_role || !form.title) return;
    try {
      await api.post('/directives', {
        type: 'directive',
        from_user_id: 0, // 서버에서 JWT로 처리
        to_role: form.to_role,
        title: form.title,
        content: form.content,
        priority: form.priority,
      });
      setShowModal(false);
      setForm({ to_role: '', title: '', content: '', priority: 'normal' });
      fetchData();
    } catch { alert('지시 생성 실패'); }
  };

  const handleDirectiveAction = async (id: number, action: 'acknowledge' | 'start' | 'complete' | 'reject') => {
    try {
      await api.patch(`/directives/${id}/${action}`, {});
      fetchData();
    } catch { alert('처리 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-600">GOT</button>
          <span>/</span>
          <button onClick={() => navigate('/etf-board')} className="hover:text-gray-600">ETF Board</button>
          <span>/</span>
          <span className="text-gray-600">CFO</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">CFO</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CFO Board</h1>
              <p className="text-sm text-gray-500">정산 · 재무 · 회계 · 세무 · 파트너십</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
          >
            + 업무지시
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* 이상 감지 */}
          {anomalies.length > 0 && (
            <div className="space-y-2">
              {anomalies.map((a, i) => {
                const isCrit = a.severity === 'critical';
                return (
                  <div key={i} className={`border rounded-xl p-4 ${isCrit ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{isCrit ? '🔴' : '🟡'}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${isCrit ? 'text-red-800' : 'text-amber-800'}`}>{a.title}</div>
                        <div className="text-xs text-gray-600 mt-1"><span className="font-medium">근거:</span> {a.evidence}</div>
                        <div className="text-xs text-gray-600 mt-0.5"><span className="font-medium">영향:</span> {a.impact}</div>
                        <div className="text-xs text-gray-500 mt-1"><span className="font-medium">조치:</span> {a.action}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${isCrit ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isCrit ? '긴급' : '주의'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-sm transition"
              onClick={() => navigate('/settlement')}>
              <div className="text-2xl font-bold text-emerald-700">{data.unsettled_count}</div>
              <div className="text-sm text-emerald-600">미정산 →</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center cursor-pointer hover:shadow-sm transition"
              onClick={() => navigate('/settlement')}>
              <div className="text-2xl font-bold text-amber-700">{data.tax_review_count}</div>
              <div className="text-sm text-amber-600">세무 REVIEW →</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.accounting_review}</div>
              <div className="text-sm text-blue-600">회계 확인</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-700">{data.total_tasks}</div>
              <div className="text-sm text-gray-600">전체 업무</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              { key: 'finance' as const, label: '재무 흐름', count: 0 },
              { key: 'tasks' as const, label: '진행 업무', count: data.my_tasks.length },
              { key: 'sent' as const, label: '보낸 지시', count: sentDirectives.length },
              { key: 'received' as const, label: '받은 지시', count: receivedDirectives.length },
              { key: 'reports' as const, label: '보고 수신', count: reports.length },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition flex items-center justify-center gap-1.5 ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: 재무 흐름 */}
          {tab === 'finance' && data.financial && (
            <>
              {/* 기간 선택 */}
              <section className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPeriodPicker(!showPeriodPicker)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-400 transition"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {currentRange.label}
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <span className="text-xs text-gray-400">{currentRange.start} ~ {currentRange.end}</span>
                  </div>
                  <span className="text-xs text-gray-400">vs 이전 동일 기간</span>
                </div>

                {showPeriodPicker && (
                  <div className="absolute top-12 left-0 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-[480px]" onClick={e => e.stopPropagation()}>
                    <div className="space-y-3">
                      {PERIOD_PRESETS.map(group => (
                        <div key={group.group}>
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">{group.group}</div>
                          <div className="flex gap-1.5">
                            {group.items.map(item => (
                              <button
                                key={item.key}
                                onClick={() => { setPeriodKey(item.key); setShowPeriodPicker(false); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                  periodKey === item.key
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* 직접 설정 */}
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">직접 설정</div>
                        <div className="flex items-center gap-2">
                          <input type="date" value={customStart || currentRange.start}
                            onChange={e => setCustomStart(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                          <span className="text-gray-400">~</span>
                          <input type="date" value={customEnd || currentRange.end}
                            onChange={e => setCustomEnd(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                          <button
                            onClick={() => { if (customStart && customEnd) { setPeriodKey('custom'); setShowPeriodPicker(false); } }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            적용
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Data 1 · 2 · 3 카드 */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">돈의 흐름 · Data 1 → 2 → 3</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { d: data.financial.data1, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-600', link: '/revenue', icon: '↓' },
                    { d: data.financial.data2, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-600', link: '/settlement', icon: '↑' },
                    { d: data.financial.data3, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-600', link: '/profit', icon: '=' },
                  ].map(({ d, bg, border, text, badge, link, icon }) => (
                    <div
                      key={d.label}
                      onClick={() => navigate(link)}
                      className={`${bg} border ${border} rounded-xl p-5 cursor-pointer hover:shadow-md transition`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-gray-500 uppercase">{d.label}</div>
                        <span className={`w-7 h-7 rounded-lg ${badge} flex items-center justify-center text-white text-sm font-bold`}>{icon}</span>
                      </div>
                      <div className={`text-2xl font-bold ${text} mb-1`}>
                        {d.this_month >= 0 ? '' : '-'}₩{Math.abs(d.this_month).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mb-3">{d.description}</div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">이전 기간 ₩{Math.abs(d.last_month).toLocaleString()}</span>
                        {d.change !== 0 && (
                          <span className={d.label.includes('비용') ? (d.change > 0 ? 'text-red-600' : 'text-emerald-600') : (d.change > 0 ? 'text-emerald-600' : 'text-red-600')}>
                            {d.change > 0 ? '+' : ''}{d.change_rate.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-gray-400">{d.source}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 흐름 다이어그램 */}
              <section>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">재무 흐름 구조</h3>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="bg-emerald-100 text-emerald-700 rounded-lg px-4 py-3 text-center">
                      <div className="text-xs text-emerald-500">Data 1</div>
                      <div className="font-bold">매출</div>
                      <div className="text-xs mt-1">₩{data.financial.data1.this_month.toLocaleString()}</div>
                    </div>
                    <span className="text-gray-300 text-lg">−</span>
                    <div className="bg-red-100 text-red-700 rounded-lg px-4 py-3 text-center">
                      <div className="text-xs text-red-500">Data 2</div>
                      <div className="font-bold">비용</div>
                      <div className="text-xs mt-1">₩{Math.abs(data.financial.data2.this_month).toLocaleString()}</div>
                    </div>
                    <span className="text-gray-300 text-lg">=</span>
                    <div className={`rounded-lg px-4 py-3 text-center ${data.financial.data3.this_month >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      <div className="text-xs opacity-70">Data 3</div>
                      <div className="font-bold">순이익</div>
                      <div className="text-xs mt-1">{data.financial.data3.this_month >= 0 ? '' : '-'}₩{Math.abs(data.financial.data3.this_month).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-8 mt-4 text-[10px] text-gray-400">
                    <span>거래일(transaction_at) 기준</span>
                    <span>CSV비용 + 고정비 배분</span>
                    <span>매출 − 비용 = 순이익</span>
                  </div>
                </div>
              </section>

              {/* 월별 P&L 트렌드 */}
              {data.financial.monthly_trend && data.financial.monthly_trend.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">월별 P&L 트렌드</h2>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="text-left px-4 py-3 font-medium">월</th>
                          <th className="text-right px-4 py-3 font-medium">매출</th>
                          <th className="text-right px-4 py-3 font-medium">비용</th>
                          <th className="text-right px-4 py-3 font-medium">순이익</th>
                          <th className="text-right px-4 py-3 font-medium">마진</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.financial.monthly_trend.map(m => (
                          <tr key={m.month} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => navigate(`/profit?month=${m.month}`)}>
                            <td className="px-4 py-3 font-medium text-gray-900">{m.month}</td>
                            <td className="px-4 py-3 text-right text-emerald-700">₩{m.revenue.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-red-600">₩{m.cost.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-medium ${m.net >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                              {m.net >= 0 ? '' : '-'}₩{Math.abs(m.net).toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-right ${m.margin >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                              {m.margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 바로가기 */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">상세 분석</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '정산 관리', desc: '거래 내역 · CSV 업로드', path: '/settlement', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { label: '매출 현황', desc: '일/주/월별 추이 · 채널 분석', path: '/revenue', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: '수익성 분석', desc: '숙소별 P&L · 마진 비교', path: '/profit', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`border rounded-xl p-4 text-left hover:shadow-sm transition ${item.color}`}
                    >
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Tab: 진행 업무 */}
          {tab === 'tasks' && (
            <>
              {/* Data Architecture Reference */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">데이터 기준</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Data 1 · 매출</div>
                    <div className="text-sm font-semibold text-gray-900">reservation_date 기준</div>
                    <div className="text-xs text-gray-500 mt-1">Hostex API 예약 데이터</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Data 2 · 비용</div>
                    <div className="text-sm font-semibold text-gray-900">CSV 정산/비용 전체</div>
                    <div className="text-xs text-gray-500 mt-1">cost_raw → cost_allocations (1/n 분할)</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">Data 3 · 입금예정</div>
                    <div className="text-sm font-semibold text-gray-900">deposit_date 기준</div>
                    <div className="text-xs text-gray-500 mt-1">Data 1 + Data 2 JOIN</div>
                  </div>
                </div>
              </section>

              {/* Quick Links */}
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">바로가기</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: '정산 관리', path: '/settlement', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { label: '매출 현황', path: '/revenue', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { label: '수익성 분석', path: '/profit', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`border rounded-xl p-3 text-sm font-medium text-center hover:shadow-sm transition ${item.color}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Task List */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">진행 업무</h2>
                {data.my_tasks.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl divide-y">
                    {data.my_tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              task.priority === 'P0' ? 'bg-red-100 text-red-700' :
                              task.priority === 'P1' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {task.priority}
                            </span>
                            <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
                          </div>
                          {task.property_name && (
                            <div className="text-xs text-gray-500 mt-1">{task.property_name}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleResolve(task.id, '')}
                            className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            해결
                          </button>
                          <button
                            onClick={() => handleEscalate(task.id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
                          >
                            ↑ Founder
                          </button>
                          <span className="text-xs text-gray-400">{task.created_at?.slice(5, 10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    진행 중인 업무가 없습니다
                  </div>
                )}
              </section>
            </>
          )}

          {/* Tab: 보낸 지시 */}
          {tab === 'sent' && (
            <DirectiveList
              directives={sentDirectives}
              direction="sent"
              emptyMsg="보낸 업무지시가 없습니다"
            />
          )}

          {/* Tab: 받은 지시 */}
          {tab === 'received' && (
            <DirectiveList
              directives={receivedDirectives}
              direction="received"
              emptyMsg="받은 업무지시가 없습니다"
              onAction={handleDirectiveAction}
            />
          )}

          {/* Tab: 보고 수신 */}
          {tab === 'reports' && (
            <DirectiveList
              directives={reports}
              direction="received"
              emptyMsg="수신된 보고가 없습니다"
            />
          )}
        </>
      )}

      {/* 업무지시 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-[500px] max-h-[85vh] overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-base font-bold text-gray-900">업무지시 생성</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* 수신자 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">지시 대상</label>
                <div className="flex gap-2">
                  {CFO_DIRECTIVE_TARGETS.map(t => (
                    <button
                      key={t.role}
                      onClick={() => setForm({ ...form, to_role: t.role })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        form.to_role === t.role
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 우선순위 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">우선순위</label>
                <div className="flex gap-2">
                  {(['urgent', 'high', 'normal', 'low'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, priority: p })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                        form.priority === p
                          ? `${PRIORITY_LABELS[p].bg} border-current`
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {PRIORITY_LABELS[p].label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 제목 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="업무지시 제목"
                />
              </div>
              {/* 내용 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  placeholder="구체적인 업무 내용"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                취소
              </button>
              <button
                onClick={handleCreateDirective}
                disabled={!form.to_role || !form.title}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                지시 발송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 재사용 지시/보고 목록 컴포넌트
function DirectiveList({
  directives, direction, emptyMsg, onAction,
}: {
  directives: Directive[];
  direction: 'sent' | 'received';
  emptyMsg: string;
  onAction?: (id: number, action: 'acknowledge' | 'start' | 'complete' | 'reject') => void;
}) {
  if (directives.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        {emptyMsg}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {directives.map(d => {
        const badge = STATUS_BADGES[d.status];
        const pri = PRIORITY_LABELS[d.priority];
        return (
          <div key={d.id} className={`bg-white border rounded-xl p-4 ${d.has_conflict ? 'border-red-200' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {pri && <span className={`text-xs px-1.5 py-0.5 rounded ${pri.bg}`}>{pri.label}</span>}
                <span className="text-xs text-gray-400">
                  {d.type === 'directive' ? '↓ 지시' : d.type === 'report' ? '↑ 보고' : '↔ 협의'}
                </span>
                <span className="text-sm font-medium text-gray-900">{d.title}</span>
              </div>
              {badge && <span className={`text-xs px-1.5 py-0.5 rounded ${badge.bg}`}>{badge.label}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>{ROLE_LABELS[d.from_role] ?? d.from_role} {d.from_user_name}</span>
              <span className="text-gray-300">→</span>
              <span>{ROLE_LABELS[d.to_role] ?? d.to_role} {d.to_user_name}</span>
              <span className="ml-auto text-gray-400">{d.created_at?.slice(5, 16)}</span>
            </div>
            {d.content && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">{d.content}</div>}
            {d.result_memo && (
              <div className="text-xs text-emerald-700 bg-emerald-50 rounded p-2 mb-2">
                완료 메모: {d.result_memo}
              </div>
            )}
            {d.server_analysis && (
              <div className={`text-xs rounded p-2 mb-2 whitespace-pre-line ${d.has_conflict ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {d.server_analysis}
              </div>
            )}
            {/* 받은 지시 액션 */}
            {direction === 'received' && onAction && d.status !== 'completed' && d.status !== 'rejected' && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                {d.status === 'pending' && (
                  <button onClick={() => onAction(d.id, 'acknowledge')}
                    className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                    확인
                  </button>
                )}
                {(d.status === 'pending' || d.status === 'acknowledged') && (
                  <button onClick={() => onAction(d.id, 'start')}
                    className="px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition">
                    진행 시작
                  </button>
                )}
                {d.status === 'in_progress' && (
                  <button onClick={() => onAction(d.id, 'complete')}
                    className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition">
                    완료
                  </button>
                )}
                <button onClick={() => onAction(d.id, 'reject')}
                  className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition ml-auto">
                  반려
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
