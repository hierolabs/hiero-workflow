import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import type { DashboardFilters, Channel, Region, PropertyType } from '../types';
import { CHANNEL_COLORS, CHANNEL_LABELS } from '../config/menu';
import AiAgentPanel from '../components/AiAgentPanel';
import {
  mockKPI, mockMonthlyRevenue, mockChannelRevenue,
  mockRegionOccupancy, mockPropertyProfit, mockCostBreakdown,
  mockCleaningStats, mockReservationStatusDist,
} from '../mock';

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtM = (n: number) => `${(n / 10000).toFixed(0)}만`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3B82F6',
  checked_in: '#10B981',
  checked_out: '#6B7280',
  cancelled: '#EF4444',
  no_show: '#F59E0B',
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: '확정', checked_in: '체크인', checked_out: '체크아웃',
  cancelled: '취소', no_show: '노쇼',
};

const COST_COLORS = ['#1E3A5F', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#7C3AED', '#A78BFA'];

const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
const channels: (Channel | 'all')[] = ['all', 'airbnb', 'booking', 'agoda', 'samsam', 'liveanywhere', 'direct', 'hostex'];
const regions: (Region | 'all')[] = ['all', '성수', '을지로', '홍대', '강남', '잠실', '여의도', '마포', '용산', '종로'];
const types: (PropertyType | 'all')[] = ['all', '원룸', '투룸', '쓰리룸', '복층', '펜트하우스', '오피스텔'];

export default function HieroDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    month: '2026-05', channel: 'all', region: 'all', property_type: 'all',
  });

  const kpi = mockKPI;
  const profitSorted = [...mockPropertyProfit].sort((a, b) => b.profit - a.profit);
  const top5 = profitSorted.slice(0, 5);
  const bottom5 = profitSorted.slice(-3);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header + Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">HIERO 경영 대시보드</h1>
            <p className="text-sm text-slate-500 mt-1">운영 현황 · 매출 · 수익성 · 실행 KPI</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">최근 업데이트</p>
            <p className="text-sm font-medium text-slate-600">2026-05-07 12:00</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel: e.target.value as Channel | 'all' }))}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            {channels.map(c => <option key={c} value={c}>{c === 'all' ? '전체 채널' : CHANNEL_LABELS[c] || c}</option>)}
          </select>
          <select value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value as Region | 'all' }))}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            {regions.map(r => <option key={r} value={r}>{r === 'all' ? '전체 권역' : r}</option>)}
          </select>
          <select value={filters.property_type} onChange={e => setFilters(f => ({ ...f, property_type: e.target.value as PropertyType | 'all' }))}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white">
            {types.map(t => <option key={t} value={t}>{t === 'all' ? '전체 타입' : t}</option>)}
          </select>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="총 숙소 수" value={`${kpi.total_properties}개`} sub="운영 중 8 · 중단 2" color="slate" />
          <KpiCard label="예약일 기준 매출" value={`${fmtM(kpi.revenue_by_booking)}원`} sub="이번 달 예약 확정 기준" color="blue" />
          <KpiCard label="입금일 기준 매출" value={`${fmtM(kpi.revenue_by_payment)}원`} sub="실제 입금 확인 기준" color="emerald" />
          <KpiCard label="숙박일 분할 매출" value={`${fmtM(kpi.revenue_by_stay)}원`} sub="숙박 기간 1/N 분할" color="violet" />
          <KpiCard label="평균 가동률" value={fmtPct(kpi.avg_occupancy)} sub="운영 중 숙소 기준" color="amber" highlight={kpi.avg_occupancy < 70} />
          <KpiCard label="ADR" value={`${fmt(kpi.adr)}원`} sub="Average Daily Rate" color="cyan" />
          <KpiCard label="미정산 금액" value={`${fmtM(kpi.unsettled_amount)}원`} sub="입금 미확인 건" color="orange" highlight={kpi.unsettled_amount > 3000000} />
          <KpiCard label="문제 숙소" value={`${kpi.problem_properties}개`} sub="수리·누수·민원" color="red" highlight={kpi.problem_properties > 0} />
        </div>

        {/* Row 1: 월별 매출 추이 + 채널별 매출 비중 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">월별 매출 추이</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mockMonthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${fmt(v)}원`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="booking_revenue" name="예약일 기준" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payment_revenue" name="입금일 기준" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stay_revenue" name="숙박일 분할" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">채널별 매출 비중</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mockChannelRevenue} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={75} label={({ channel, share }) => `${CHANNEL_LABELS[channel] || channel} ${share}%`} labelLine={false}>
                  {mockChannelRevenue.map((entry) => (
                    <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${fmt(v)}원`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {mockChannelRevenue.map(c => (
                <div key={c.channel} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: CHANNEL_COLORS[c.channel] }} />
                    {CHANNEL_LABELS[c.channel] || c.channel}
                  </span>
                  <span className="text-slate-600 font-medium">{c.bookings}건 · {c.share}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: 권역별 가동률 + 예약 상태 분포 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">권역별 가동률</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mockRegionOccupancy} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="region" tick={{ fontSize: 12 }} width={50} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="occupancy" fill="#2563EB" radius={[0, 4, 4, 0]}>
                  {mockRegionOccupancy.map((entry) => (
                    <Cell key={entry.region} fill={entry.occupancy >= 80 ? '#10B981' : entry.occupancy >= 50 ? '#F59E0B' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">예약 상태별 분포</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mockReservationStatusDist.filter(d => d.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  label={({ status, count }) => `${STATUS_LABELS[status]} ${count}`}>
                  {mockReservationStatusDist.filter(d => d.count > 0).map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v}건`, STATUS_LABELS[name] || name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {mockReservationStatusDist.map(d => (
                <div key={d.status} className="text-center">
                  <p className="text-lg font-bold text-slate-800">{d.count}</p>
                  <p className="text-xs text-slate-500">{STATUS_LABELS[d.status]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: 숙소별 순이익 TOP/BOTTOM + 비용 항목별 비중 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">숙소별 순이익 TOP 5 / BOTTOM 3</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-emerald-600 mb-2">TOP 5</p>
                <div className="space-y-2">
                  {top5.map((p, i) => (
                    <div key={p.property_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.property_name}</p>
                          <p className="text-xs text-slate-400">{p.region}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">+{fmt(p.profit)}원</p>
                        <p className="text-xs text-slate-400">마진 {fmtPct(p.margin)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-red-600 mb-2">BOTTOM 3 (적자)</p>
                <div className="space-y-2">
                  {bottom5.map((p, i) => (
                    <div key={p.property_id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.property_name}</p>
                          <p className="text-xs text-slate-400">{p.region}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{fmt(p.profit)}원</p>
                        <p className="text-xs text-slate-400">매출 {fmt(p.revenue)}원</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">비용 항목별 비중</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mockCostBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={75}>
                  {mockCostBreakdown.map((_, i) => (
                    <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${fmt(v)}원`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {mockCostBreakdown.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COST_COLORS[i] }} />
                    {c.category}
                  </span>
                  <span className="text-slate-600">{c.share}% · {fmtM(c.amount)}원</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 4: 청소 완료율 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">청소 현황</h3>
          <div className="grid grid-cols-6 gap-4">
            <CleaningStatCard label="전체" value={mockCleaningStats.total} color="slate" />
            <CleaningStatCard label="완료" value={mockCleaningStats.completed} color="emerald" />
            <CleaningStatCard label="진행 중" value={mockCleaningStats.in_progress} color="blue" />
            <CleaningStatCard label="대기" value={mockCleaningStats.pending} color="amber" />
            <CleaningStatCard label="생략" value={mockCleaningStats.skipped} color="gray" />
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{fmtPct(mockCleaningStats.completion_rate)}</p>
              <p className="text-xs text-slate-500 mt-1">완료율</p>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${mockCleaningStats.completion_rate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AiAgentPanel
        page="dashboard"
        pageLabel="경영 대시보드"
        getPageData={() => `KPI: 총숙소=${kpi.total_properties}, 예약기준매출=${kpi.revenue_by_booking}, 입금기준매출=${kpi.revenue_by_payment}, 숙박분할매출=${kpi.revenue_by_stay}, 가동률=${kpi.avg_occupancy}%, ADR=${kpi.adr}, 미정산=${kpi.unsettled_amount}, 문제숙소=${kpi.problem_properties}`}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, color, highlight }: {
  label: string; value: string; sub: string; color: string; highlight?: boolean;
}) {
  const borderColor = highlight ? 'border-red-400' : 'border-slate-200';
  const bgColor = highlight ? 'bg-red-50' : 'bg-white';
  return (
    <div className={`${bgColor} rounded-xl border ${borderColor} p-4`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold text-${color}-700`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function CleaningStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
