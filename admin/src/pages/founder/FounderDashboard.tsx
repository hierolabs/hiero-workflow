import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// --- Types ---

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
}

interface ETFSummary {
  ceo: { bottlenecks: number; delayed_tasks: number; approval_pending: number };
  cto: { documentation_tasks: number; research_tasks: number; message_review: number };
  cfo: { unsettled_count: number; tax_review_count: number; accounting_review_count: number };
}

interface DailyBrief {
  date: string;
  top_decisions: TopDecision[];
  risk_alerts: number;
  category_decisions: Record<string, TopDecision[]>;
  got_directives_sent: number;
  got_directives_pending: number;
}

interface Directive {
  id: number;
  type: string;
  from_role: string;
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
}

interface Pipeline {
  active: number;
  bottleneck_count: number;
}

interface GOTReport {
  id: number;
  report_type: string;
  period: string;
  revenue: number;
  cost: number;
  net: number;
  revenue_prev: number;
  cost_prev: number;
  net_prev: number;
  cash_gap: number;
  expected_deposit_7d: number;
  top_cost_category: string;
  alerts: string;
  decisions: string;
  summary: string;
  is_read: boolean;
  created_at: string;
}

// --- Constants ---

const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
  marketing: '마케팅', operations: '운영',
  cleaning_dispatch: '청소배정', field: '현장',
};

const DOMAIN_COLORS: Record<string, string> = {
  strategy: 'bg-purple-100 text-purple-800',
  money: 'bg-emerald-100 text-emerald-800',
  property: 'bg-blue-100 text-blue-800',
  operations: 'bg-amber-100 text-amber-800',
};

const CATEGORY_META: Record<string, { label: string; sub: string; icon: string; color: string; border: string }> = {
  revenue: { label: '매출 · 가격', sub: '수익 관련 핵심 결정', icon: '$', color: 'bg-emerald-600', border: 'border-emerald-300' },
  risk: { label: '운영 · 리스크', sub: '운영 안정성 관련 결정', icon: '!', color: 'bg-amber-600', border: 'border-amber-300' },
  strategy: { label: '조직 · 전략', sub: '방향성 · 팀 · 전략 결정', icon: '?', color: 'bg-indigo-600', border: 'border-indigo-300' },
};

const STATUS_BADGES: Record<string, { bg: string; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', label: '대기' },
  acknowledged: { bg: 'bg-blue-100 text-blue-700', label: '확인' },
  in_progress: { bg: 'bg-purple-100 text-purple-700', label: '진행' },
  completed: { bg: 'bg-green-100 text-green-700', label: '완료' },
  rejected: { bg: 'bg-red-100 text-red-700', label: '반려' },
};

// --- Component ---

export default function FounderDashboard() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [etfSummary, setETFSummary] = useState<ETFSummary | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [sentDirectives, setSentDirectives] = useState<Directive[]>([]);
  const [latestReports, setLatestReports] = useState<Record<string, GOTReport>>({});
  const [anomalies, setAnomalies] = useState<{ type: string; severity: string; title: string; evidence: string; impact: string; action: string; value: number; change_rate: number; category: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDirectiveForm, setShowDirectiveForm] = useState(false);
  const navigate = useNavigate();

  const [newDir, setNewDir] = useState({ to_role: 'ceo', title: '', content: '', priority: 'normal' });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/founder/daily-brief').catch(() => ({ data: null })),
      api.get('/founder/etf-summary').catch(() => ({ data: null })),
      api.get('/lifecycle/pipeline').catch(() => ({ data: null })),
      api.get('/me').catch(() => ({ data: { id: 0 } })),
      api.get('/founder/reports/latest').catch(() => ({ data: {} })),
      api.get('/founder/anomalies').catch(() => ({ data: { alerts: [] } })),
    ]).then(([briefRes, etfRes, pipeRes, meRes, reportsRes, anomalyRes]) => {
      setBrief(briefRes.data);
      setETFSummary(etfRes.data);
      setPipeline(pipeRes.data);
      setLatestReports(reportsRes.data ?? {});
      setAnomalies(anomalyRes.data?.alerts ?? []);
      const uid = meRes.data?.id ?? 0;
      setCurrentUser({ id: uid });
      if (uid > 0) return api.get(`/directives/sent?user_id=${uid}`).catch(() => ({ data: { directives: [] } }));
      return { data: { directives: [] } };
    }).then(dirRes => {
      setSentDirectives(dirRes.data.directives ?? []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (issueId: number, action: 'approve' | 'reject' | 'return') => {
    try {
      if (action === 'approve') {
        await api.patch(`/issues/${issueId}/status`, { status: 'resolved', resolution: 'Founder 승인' });
      } else if (action === 'reject') {
        await api.patch(`/issues/${issueId}/status`, { status: 'closed', resolution: 'Founder 반려' });
      } else {
        const usersRes = await api.get('/users');
        const users = usersRes.data.users || usersRes.data || [];
        const ceo = users.find((u: { role_title: string }) => u.role_title === 'ceo');
        if (ceo) await api.patch(`/issues/${issueId}/assignee`, { assignee_name: ceo.name });
      }
      fetchData();
    } catch { alert('처리 실패'); }
  };

  const handleCreateDirective = async () => {
    if (!currentUser || !newDir.title.trim()) return;
    try {
      await api.post('/directives', {
        type: 'directive', from_user_id: currentUser.id,
        to_role: newDir.to_role, title: newDir.title,
        content: newDir.content, priority: newDir.priority,
      });
      setNewDir({ to_role: 'ceo', title: '', content: '', priority: 'normal' });
      setShowDirectiveForm(false);
      fetchData();
    } catch { alert('생성 실패'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const categories = brief?.category_decisions ?? { revenue: [], risk: [], strategy: [] };
  const totalDecisions = brief?.top_decisions?.length ?? 0;
  const activeDirectives = sentDirectives.filter(d => d.status !== 'completed' && d.status !== 'rejected');

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ===== Header ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center">
            <span className="text-white text-lg font-black">F</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Founder</h1>
            <p className="text-sm text-gray-500">{dateStr} ({dayNames[today.getDay()]}) — 김진우</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/got')} className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">ETF S.T</button>
          <button onClick={() => navigate('/etf-board')} className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">ETF Board</button>
        </div>
      </div>

      {/* ===== 이상 감지 (최상단) ===== */}
      {anomalies.length > 0 && (
        <section>
          <div className="space-y-2">
            {anomalies.map((a, i) => {
              const sevStyles: Record<string, { bg: string; border: string; icon: string; text: string }> = {
                critical: { bg: 'bg-red-50', border: 'border-red-300', icon: '🔴', text: 'text-red-800' },
                warning: { bg: 'bg-amber-50', border: 'border-amber-300', icon: '🟡', text: 'text-amber-800' },
                info: { bg: 'bg-blue-50', border: 'border-blue-300', icon: '🔵', text: 'text-blue-800' },
              };
              const sty = sevStyles[a.severity] || sevStyles.info;
              return (
                <div key={i} className={`${sty.bg} border ${sty.border} rounded-xl p-4`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{sty.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${sty.text}`}>{a.title}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">근거:</span> {a.evidence}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        <span className="font-medium">영향:</span> {a.impact}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">조치:</span> {a.action}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.severity === 'critical' ? '긴급' : '주의'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== 핵심 숫자 4개 ===== */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="고위험" value={brief?.risk_alerts ?? 0} alert={(brief?.risk_alerts ?? 0) > 0} />
        <SummaryCard label="결정 대기" value={totalDecisions} alert={totalDecisions > 0} />
        <SummaryCard label="ETF 지시" value={activeDirectives.length} color="text-indigo-700" />
        <SummaryCard label="Active" value={pipeline?.active ?? 0} color="text-emerald-600" />
      </div>

      {/* ===== 오늘 결정할 3가지 ===== */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 결정할 3가지</h2>

        {totalDecisions === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="text-gray-300 text-sm">결정할 사항 없음 — ETF가 잘 돌아가고 있습니다</div>
          </div>
        ) : (
          <div className="space-y-3">
            {(['revenue', 'risk', 'strategy'] as const).map(cat => {
              const meta = CATEGORY_META[cat];
              const items = categories[cat] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={cat} className={`bg-white border-l-4 ${meta.border} border border-gray-200 rounded-xl overflow-hidden`}>
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                    <div className={`w-7 h-7 rounded-lg ${meta.color} flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{meta.icon}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{meta.label}</span>
                    <span className="text-xs text-gray-400">{items.length}건</span>
                  </div>
                  <div className="divide-y">
                    {items.map(d => (
                      <div key={d.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${DOMAIN_COLORS[d.domain] || 'bg-gray-100'}`}>{d.domain}</span>
                          {d.priority === 'P0' && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">P0</span>}
                          {d.escalated_from && <span className="text-[10px] text-gray-400">{ROLE_LABELS[d.escalated_from]}에서 올림</span>}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{d.title}</div>
                        {d.reason && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{d.reason}</div>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleAction(d.id, 'approve')} className="px-3 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">승인</button>
                          <button onClick={() => handleAction(d.id, 'return')} className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">ETF로</button>
                          <button onClick={() => handleAction(d.id, 'reject')} className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100">반려</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 재무 보고 (GOT Report) ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">재무 보고</h2>
          <button
            onClick={() => api.post('/founder/reports/generate?type=daily').then(() => fetchData()).catch(() => alert('생성 실패'))}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
          >
            수동 생성
          </button>
        </div>

        {Object.keys(latestReports).length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
            아직 보고서가 없습니다. 매일 08:00에 자동 생성됩니다.
          </div>
        ) : (
          <div className="space-y-3">
            {/* 재무 흐름 카드 */}
            {latestReports.daily && (() => {
              const r = latestReports.daily;
              const fmt = (n: number) => {
                const abs = Math.abs(n);
                if (abs >= 100000000) return `${Math.floor(abs / 100000000)}억${Math.floor((abs % 100000000) / 10000)}만`;
                if (abs >= 10000) return `${Math.floor(abs / 10000)}만`;
                return String(abs);
              };
              return (
                <div className={`bg-white border rounded-xl p-5 ${r.is_read ? 'border-gray-200' : 'border-blue-300 bg-blue-50/30'}`}
                  onClick={() => { if (!r.is_read) api.patch(`/founder/reports/${r.id}/read`); }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">일간</span>
                      <span className="text-sm font-medium text-gray-900">{r.period}</span>
                      {!r.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  </div>

                  {/* Data 1/2/3 */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-emerald-50 rounded-lg p-3 text-center cursor-pointer hover:shadow-sm" onClick={() => navigate('/revenue')}>
                      <div className="text-[10px] text-emerald-500 uppercase">Data 1 · 매출</div>
                      <div className="text-lg font-bold text-emerald-700">₩{fmt(r.revenue)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center cursor-pointer hover:shadow-sm" onClick={() => navigate('/settlement')}>
                      <div className="text-[10px] text-red-500 uppercase">Data 2 · 비용</div>
                      <div className="text-lg font-bold text-red-700">₩{fmt(r.cost)}</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center cursor-pointer hover:shadow-sm ${r.net >= 0 ? 'bg-blue-50' : 'bg-red-50'}`} onClick={() => navigate('/profit')}>
                      <div className="text-[10px] opacity-70 uppercase">Data 3 · 순이익</div>
                      <div className={`text-lg font-bold ${r.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {r.net >= 0 ? '' : '-'}₩{fmt(Math.abs(r.net))}
                      </div>
                    </div>
                  </div>

                  {/* 현금 갭 + 입금 예정 */}
                  <div className="flex items-center gap-4 text-xs mb-3">
                    {r.cash_gap > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">현금 갭 ₩{fmt(r.cash_gap)}</span>
                    )}
                    {r.expected_deposit_7d > 0 && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">7일 입금예정 ₩{fmt(r.expected_deposit_7d)}</span>
                    )}
                    {r.top_cost_category && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">최대비용: {r.top_cost_category}</span>
                    )}
                  </div>

                  {/* 요약 */}
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{r.summary}</div>

                  {/* 알림 */}
                  {r.alerts && r.alerts !== '[]' && r.alerts !== 'null' && (() => {
                    try {
                      const alerts: { category: string; change_rate: number }[] = JSON.parse(r.alerts);
                      if (alerts.length === 0) return null;
                      return (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="text-xs font-bold text-red-700 mb-1">비용 이상 감지</div>
                          {alerts.map((a, i) => (
                            <div key={i} className="text-xs text-red-600">{a.category} +{a.change_rate.toFixed(0)}%</div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              );
            })()}

            {/* 주간/월간 요약 */}
            <div className="grid grid-cols-2 gap-3">
              {latestReports.weekly && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">주간 ({latestReports.weekly.period})</div>
                  <div className="text-xs text-gray-600">{latestReports.weekly.summary}</div>
                </div>
              )}
              {latestReports.monthly && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">월간 ({latestReports.monthly.period})</div>
                  <div className="text-xs text-gray-600">{latestReports.monthly.summary}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ===== ETF 건강 ===== */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">ETF 건강</h2>
        <div className="grid grid-cols-3 gap-3">
          <ETFCard
            label="CEO" color="bg-indigo-600"
            onClick={() => navigate('/etf-board/ceo')}
            rows={etfSummary ? [
              { k: '병목', v: etfSummary.ceo.bottlenecks, alert: etfSummary.ceo.bottlenecks > 0 },
              { k: '지연', v: etfSummary.ceo.delayed_tasks, alert: etfSummary.ceo.delayed_tasks > 0 },
              { k: '승인대기', v: etfSummary.ceo.approval_pending },
            ] : []}
          />
          <ETFCard
            label="CTO" color="bg-violet-600"
            onClick={() => navigate('/etf-board/cto')}
            rows={etfSummary ? [
              { k: '문서화', v: etfSummary.cto.documentation_tasks },
              { k: '연구', v: etfSummary.cto.research_tasks },
              { k: '메시지', v: etfSummary.cto.message_review },
            ] : []}
          />
          <ETFCard
            label="CFO" color="bg-emerald-600"
            onClick={() => navigate('/etf-board/cfo')}
            rows={etfSummary ? [
              { k: '미정산', v: etfSummary.cfo.unsettled_count, alert: etfSummary.cfo.unsettled_count > 0 },
              { k: '세무', v: etfSummary.cfo.tax_review_count },
              { k: '회계', v: etfSummary.cfo.accounting_review_count },
            ] : []}
          />
        </div>
      </section>

      {/* ===== ETF에 지시 ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">ETF에 지시</h2>
          <button
            onClick={() => setShowDirectiveForm(!showDirectiveForm)}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800"
          >
            {showDirectiveForm ? '닫기' : '+ 새 지시'}
          </button>
        </div>

        {showDirectiveForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={newDir.to_role} onChange={e => setNewDir(p => ({ ...p, to_role: e.target.value }))} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="ceo">CEO</option>
                <option value="cto">CTO</option>
                <option value="cfo">CFO</option>
              </select>
              <select value={newDir.priority} onChange={e => setNewDir(p => ({ ...p, priority: e.target.value }))} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
                <option value="urgent">즉시</option>
                <option value="high">오늘</option>
                <option value="normal">이번 주</option>
                <option value="low">여유</option>
              </select>
            </div>
            <input type="text" value={newDir.title} onChange={e => setNewDir(p => ({ ...p, title: e.target.value }))}
              placeholder="지시 제목" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              onKeyDown={e => e.key === 'Enter' && newDir.title.trim() && handleCreateDirective()} />
            <div className="flex justify-end">
              <button onClick={handleCreateDirective} disabled={!newDir.title.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-40">전송</button>
            </div>
          </div>
        )}

        {activeDirectives.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-xs text-gray-400">미완료 지시 없음</div>
        ) : (
          <div className="space-y-2">
            {activeDirectives.map(d => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{d.title}</div>
                  <div className="text-xs text-gray-400">→ {d.to_user_name} ({ROLE_LABELS[d.to_role]}) · {d.created_at?.slice(5, 10)}</div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGES[d.status]?.bg ?? 'bg-gray-100'}`}>
                  {STATUS_BADGES[d.status]?.label ?? d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Sub Components ---

function SummaryCard({ label, value, alert, color }: { label: string; value: number; alert?: boolean; color?: string }) {
  return (
    <div className={`rounded-xl p-4 text-center border ${alert ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`text-2xl font-black ${alert ? 'text-red-700' : color ?? (value > 0 ? 'text-gray-900' : 'text-gray-300')}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function ETFCard({ label, color, onClick, rows }: {
  label: string; color: string; onClick: () => void;
  rows: { k: string; v: number; alert?: boolean }[];
}) {
  return (
    <div onClick={onClick} className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <span className="text-white text-[10px] font-bold">{label}</span>
      </div>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.k} className="flex justify-between text-xs">
            <span className="text-gray-500">{r.k}</span>
            <span className={`font-medium ${r.alert ? 'text-red-600' : r.v > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
