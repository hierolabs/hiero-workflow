import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import api from '../utils/api';
import AiAgentPanel from '../components/AiAgentPanel';

interface MonthlyReport {
  id: number;
  property_id: number;
  property_name: string;
  month: string;
  aor: number;
  adr: number;
  gross: number;
  total_cost: number;
  net: number;
  margin: number;
  room: number;
  cleaning_fee: number;
  commission: number;
  cleaning_cost: number;
  rent_out: number;
  mgmt: number;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function Profit() {
  const [month, setMonth] = useState('');
  const [months, setMonths] = useState<string[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [summary, setSummary] = useState<{ total_gross: number; total_cost: number; total_net: number; avg_aor: number; avg_margin: number }>({ total_gross: 0, total_cost: 0, total_net: 0, avg_aor: 0, avg_margin: 0 });
  const [sortBy, setSortBy] = useState<'net' | 'margin' | 'gross'>('net');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/months').then(res => {
      const m = res.data || [];
      setMonths(m);
      if (m.length > 0) setMonth(m[0]);
    });
  }, []);

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    api.get(`/reports/monthly?month=${month}`).then(res => {
      setReports(res.data.reports || []);
      setSummary(res.data.summary || { total_gross: 0, total_cost: 0, total_net: 0, avg_aor: 0, avg_margin: 0 });
    }).finally(() => setLoading(false));
  }, [month]);

  const sorted = [...reports].sort((a, b) => {
    if (sortBy === 'net') return b.net - a.net;
    if (sortBy === 'margin') return b.margin - a.margin;
    return b.gross - a.gross;
  });

  if (loading && !reports.length) return <div className="p-8 text-slate-500">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data 3 · 수익성 분석</h1>
        <p className="text-sm text-slate-500 mt-1">월간 매출·비용·순이익·마진율 (monthly_property_reports 실데이터)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 매출</p>
          <p className="text-xl font-bold text-slate-800">{fmt(summary.total_gross)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 비용</p>
          <p className="text-xl font-bold text-slate-800">{fmt(summary.total_cost)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 순이익</p>
          <p className={`text-xl font-bold ${summary.total_net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(summary.total_net)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">평균 점유율</p>
          <p className="text-xl font-bold text-blue-600">{(summary.avg_aor * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">평균 마진율</p>
          <p className={`text-xl font-bold ${summary.avg_margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{summary.avg_margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'net' | 'margin' | 'gross')}
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">
          <option value="net">순이익순</option>
          <option value="margin">마진율순</option>
          <option value="gross">매출순</option>
        </select>
        <span className="text-sm text-slate-400 self-center">{sorted.length}개 숙소</span>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">숙소별 순이익</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sorted.slice(0, 30)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="property_name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={70}
              tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '...' : v} />
            <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${fmt(v)}원`} />
            <ReferenceLine y={0} stroke="#94A3B8" />
            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
              {sorted.slice(0, 30).map((entry) => (
                <Cell key={entry.property_id} fill={entry.net >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">숙소</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">점유율</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">ADR</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">매출</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">비용</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">순이익</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">마진율</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.property_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{p.property_name}</td>
                <td className="px-4 py-3 text-right text-slate-600">{(p.aor * 100).toFixed(0)}%</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmt(p.adr)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmt(p.gross)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmt(p.total_cost)}</td>
                <td className={`px-4 py-3 text-right font-bold ${p.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.net)}</td>
                <td className={`px-4 py-3 text-right ${p.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(p.margin * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AiAgentPanel
        page="profit"
        pageLabel="수익성 분석"
        getPageData={() => sorted.map(p => `${p.property_name}: 매출${p.gross} 비용${p.total_cost} 순이익${p.net} 점유${(p.aor*100).toFixed(0)}% 마진${(p.margin*100).toFixed(1)}%`).join('\n')}
      />
    </div>
  );
}
