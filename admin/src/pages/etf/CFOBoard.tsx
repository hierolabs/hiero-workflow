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

interface CFOData {
  my_tasks: Issue[];
  unsettled_count: number;
  tax_review_count: number;
  accounting_review: number;
  settlement_delayed: number;
  total_tasks: number;
}

export default function CFOBoard() {
  const [data, setData] = useState<CFOData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/etf-board/cfo').then(res => setData(res.data)).finally(() => setLoading(false));
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
          <span className="text-gray-600">CFO</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">CFO</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CFO Board</h1>
            <p className="text-sm text-gray-500">정산 · 재무 · 회계 · 세무 · 파트너십</p>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-700">{data.unsettled_count}</div>
              <div className="text-sm text-emerald-600">미정산</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{data.tax_review_count}</div>
              <div className="text-sm text-amber-600">세무 REVIEW</div>
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
                        ✓ 해결
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
    </div>
  );
}
