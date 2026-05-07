import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Summary {
  check_ins: number; check_outs: number; issues_created: number;
  issues_pending: number; detections: number; cleaning_tasks: number;
}
interface FeedItem {
  type: string; title: string; detail: string; severity: string;
  assignee: string; ref_id: number; ref_type: string;
}
interface Issue {
  id: number; title: string; priority: string; status: string;
  issue_type: string; assignee_name: string; property_name: string; created_at: string;
}

const FEED_BG: Record<string, string> = {
  checkin: 'bg-blue-50 border-blue-200', checkout: 'bg-gray-50 border-gray-200',
  issue_assigned: 'bg-red-50 border-red-200', issue_detected: 'bg-amber-50 border-amber-200',
  cleaning: 'bg-cyan-50 border-cyan-200',
};
const FEED_TAG: Record<string, { label: string; color: string }> = {
  checkin: { label: 'IN', color: 'bg-blue-500 text-white' },
  checkout: { label: 'OUT', color: 'bg-gray-500 text-white' },
  issue_assigned: { label: '이슈', color: 'bg-red-500 text-white' },
  issue_detected: { label: '감지', color: 'bg-amber-500 text-white' },
  cleaning: { label: '청소', color: 'bg-cyan-500 text-white' },
};
const P_COLOR: Record<string, string> = {
  P0: 'bg-red-100 text-red-700', P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700', P3: 'bg-gray-100 text-gray-600',
};

export default function TodayDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    Promise.all([
      api.get('/admin/ops/feed'),
      api.get('/admin/issues?status=open&page_size=10'),
    ]).then(([feedRes, issueRes]) => {
      setSummary(feedRes.data?.summary || null);
      setFeed(feedRes.data?.feed || []);
      setIssues(issueRes.data?.issues || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  // 피드를 타입별로 분리
  const checkIns = feed.filter(f => f.type === 'checkin');
  const checkOuts = feed.filter(f => f.type === 'checkout');
  const issueFeed = feed.filter(f => f.type === 'issue_assigned' || f.type === 'issue_detected');
  const cleaningFeed = feed.filter(f => f.type === 'cleaning');

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {dateStr} ({days[today.getDay()]}) 오늘의 업무
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{user.name || '관리자'} — HIERO Operations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/chat')} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
            팀 채팅
          </button>
          <button onClick={() => navigate('/issue-detections')} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700">
            이슈 감지 {summary?.detections ? `(${summary.detections})` : ''}
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: '체크인', value: summary.check_ins, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            { label: '체크아웃', value: summary.check_outs, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
            { label: '미처리 이슈', value: summary.issues_pending, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: '오늘 이슈', value: summary.issues_created, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
            { label: '이슈 감지', value: summary.detections, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: '청소', value: summary.cleaning_tasks, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
          ].map(k => (
            <div key={k.label} className={`border rounded-xl p-3 text-center ${k.bg}`}>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 메인 그리드: 체크인/아웃 + 이슈 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 체크인 */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">체크인 ({checkIns.length})</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">IN</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {checkIns.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">오늘 체크인 없음</div>
            ) : checkIns.map((f, i) => (
              <div key={i} className="px-4 py-2">
                <div className="text-xs font-medium text-gray-900">{f.title.replace('체크인: ', '')}</div>
                <div className="text-[10px] text-gray-500">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 체크아웃 */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">체크아웃 ({checkOuts.length})</span>
            <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">OUT</span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {checkOuts.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">오늘 체크아웃 없음</div>
            ) : checkOuts.map((f, i) => (
              <div key={i} className="px-4 py-2">
                <div className="text-xs font-medium text-gray-900">{f.title.replace('체크아웃: ', '')}</div>
                <div className="text-[10px] text-gray-500">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 이슈/감지 */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">이슈/감지 ({issueFeed.length})</span>
            <button onClick={() => navigate('/issues')} className="text-[10px] text-indigo-600 hover:text-indigo-800">전체 보기</button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {issueFeed.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">오늘 이슈 없음</div>
            ) : issueFeed.slice(0, 10).map((f, i) => (
              <div key={i} className={`px-4 py-2 ${f.severity === 'critical' ? 'bg-red-50' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] px-1 py-px rounded font-medium ${FEED_TAG[f.type]?.color || 'bg-gray-200'}`}>
                    {FEED_TAG[f.type]?.label || ''}
                  </span>
                  <span className="text-xs font-medium text-gray-900 truncate">{f.title}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 미처리 이슈 테이블 */}
      {issues.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">미처리 이슈</span>
            <button onClick={() => navigate('/issues')} className="text-[10px] text-indigo-600 hover:text-indigo-800">전체</button>
          </div>
          <div className="divide-y divide-gray-50">
            {issues.map(iss => (
              <div key={iss.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${P_COLOR[iss.priority] || 'bg-gray-100'}`}>
                    {iss.priority}
                  </span>
                  <span className="text-xs text-gray-900 truncate">{iss.title}</span>
                </div>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-500">{iss.assignee_name || '미배정'}</span>
                  <span className="text-[10px] text-gray-400">{iss.created_at?.slice(5, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '예약 관리', path: '/reservations', color: 'border-blue-200 bg-blue-50 text-blue-700' },
          { label: '청소 관리', path: '/cleaning', color: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
          { label: '민원/하자', path: '/issues', color: 'border-red-200 bg-red-50 text-red-700' },
          { label: '메시지', path: '/messages', color: 'border-purple-200 bg-purple-50 text-purple-700' },
        ].map(l => (
          <button key={l.path} onClick={() => navigate(l.path)}
            className={`border rounded-xl p-3 text-sm font-medium text-center hover:shadow-sm transition ${l.color}`}>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
