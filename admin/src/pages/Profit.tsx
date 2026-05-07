import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { mockPropertyProfit } from '../mock';
import AiAgentPanel from '../components/AiAgentPanel';
import type { Region } from '../types';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function Profit() {
  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue'>('profit');

  const filtered = regionFilter === 'all'
    ? mockPropertyProfit
    : mockPropertyProfit.filter(p => p.region === regionFilter);

  const sorted = [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);

  const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0);
  const totalCost = sorted.reduce((s, p) => s + p.cost, 0);
  const totalProfit = sorted.reduce((s, p) => s + p.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const regions: (Region | 'all')[] = ['all', '성수', '을지로', '홍대', '강남', '잠실', '여의도', '마포', '용산', '종로'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">숙소별 수익성 분석</h1>
        <p className="text-sm text-slate-500 mt-1">숙소별 매출·비용·순이익·마진율 비교</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 매출</p>
          <p className="text-xl font-bold text-slate-800">{fmt(totalRevenue)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 비용</p>
          <p className="text-xl font-bold text-slate-800">{fmt(totalCost)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">총 순이익</p>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(totalProfit)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">평균 마진율</p>
          <p className={`text-xl font-bold ${avgMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{avgMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value as Region | 'all')}
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">
          {regions.map(r => <option key={r} value={r}>{r === 'all' ? '전체 권역' : r}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'profit' | 'margin' | 'revenue')}
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm">
          <option value="profit">순이익순</option>
          <option value="margin">마진율순</option>
          <option value="revenue">매출순</option>
        </select>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">숙소별 순이익</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sorted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="property_name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${fmt(v)}원`} />
            <ReferenceLine y={0} stroke="#94A3B8" />
            <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
              {sorted.map((entry) => (
                <Cell key={entry.property_id} fill={entry.profit >= 0 ? '#10B981' : '#EF4444'} />
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
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">권역</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">매출</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">비용</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">순이익</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">마진율</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.property_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{p.property_name}</td>
                <td className="px-4 py-3 text-slate-600">{p.region}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmt(p.revenue)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmt(p.cost)}</td>
                <td className={`px-4 py-3 text-right font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.profit)}</td>
                <td className={`px-4 py-3 text-right ${p.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.margin.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AiAgentPanel
        page="profit"
        pageLabel="수익성 분석"
        getPageData={() => sorted.map(p => `${p.property_name}(${p.region}): 매출${p.revenue} 비용${p.cost} 순이익${p.profit} 마진${p.margin}%`).join('\n')}
      />
    </div>
  );
}
