import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

interface ExecData {
  name: string;
  role_title: string;
  today_tasks: Issue[];
  delayed_tasks: Issue[];
  my_issues: Issue[];
  today_count: number;
  delayed_count: number;
  resolved_today: number;
}

const ROLE_INFO: Record<string, { title: string; desc: string; links: { label: string; path: string }[] }> = {
  marketing: {
    title: '마케팅 / 디자인 / 외부영업',
    desc: '이예린',
    links: [
      { label: '리드 관리', path: '/leads' },
    ],
  },
  operations: {
    title: '예약 / 운영 / CS',
    desc: '오재관',
    links: [
      { label: '예약 관리', path: '/reservations' },
      { label: '운영 캘린더', path: '/calendar' },
      { label: '메시지', path: '/messages' },
    ],
  },
  cleaning: {
    title: '예약보조 / 청소배정',
    desc: '김우현',
    links: [
      { label: '청소 관리', path: '/cleaning' },
      { label: '예약 관리', path: '/reservations' },
    ],
  },
  field: {
    title: '현장 / 세팅 / 데이터',
    desc: '김진태',
    links: [
      { label: '숙소 관리', path: '/properties' },
      { label: '민원/하자', path: '/issues' },
    ],
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-gray-100 text-gray-600',
};

export default function ExecutionDashboard() {
  const { role } = useParams<{ role: string }>();
  const [data, setData] = useState<ExecData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    api.get(`/admin/execution/${role}`).then(res => setData(res.data)).finally(() => setLoading(false));
  }, [role]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  const info = ROLE_INFO[role || ''] || { title: role, desc: '', links: [] };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{info.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{info.desc} — 오늘 업무</p>
      </div>

      {data && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.today_count}</div>
              <div className="text-sm text-gray-600">오늘 할 일</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">{data.delayed_count}</div>
              <div className="text-sm text-gray-600">지연 업무</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-emerald-700">{data.resolved_today}</div>
              <div className="text-sm text-gray-600">오늘 완료</div>
            </div>
          </div>

          {/* Quick Links */}
          {info.links.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {info.links.map(l => (
                <a
                  key={l.path}
                  href={l.path}
                  className="border border-gray-200 bg-gray-50 text-gray-700 rounded-lg p-3 text-sm font-medium text-center hover:shadow-sm transition"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}

          {/* Today Tasks */}
          <TaskSection title="오늘 할 일" tasks={data.today_tasks} emptyText="오늘 할 일이 없습니다" />

          {/* Delayed */}
          {data.delayed_tasks.length > 0 && (
            <TaskSection title="지연 업무" tasks={data.delayed_tasks} />
          )}

          {/* In Progress */}
          {data.my_issues.length > 0 && (
            <TaskSection title="진행 중" tasks={data.my_issues} />
          )}
        </>
      )}
    </div>
  );
}

function TaskSection({ title, tasks, emptyText }: { title: string; tasks: Issue[]; emptyText?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title} ({tasks.length})</h2>
      {tasks.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg divide-y">
          {tasks.map(t => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority] || 'bg-gray-100'}`}>
                    {t.priority}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                </div>
                {t.property_name && <div className="text-xs text-gray-500 mt-1">{t.property_name}</div>}
              </div>
              <div className="text-xs text-gray-500 ml-4">{t.created_at?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      ) : emptyText ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">{emptyText}</div>
      ) : null}
    </div>
  );
}
