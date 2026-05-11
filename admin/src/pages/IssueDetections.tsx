import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

interface Detection {
  id: number;
  conversation_id: string;
  guest_name: string;
  guest_name_clean?: string;
  property_name: string;
  detected_category: string;
  detected_keywords: string;
  severity: string;
  message_content: string;
  status: string;
  created_issue_id: number | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  checkin: '체크인/출입',
  parking: '주차',
  boiler: '보일러/온수',
  cleaning: '청소/시설',
  reservation: '예약/환불',
  emergency: '긴급/안전',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: '긴급', high: '높음', medium: '보통', low: '낮음',
};

export default function IssueDetections() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchDetections = useCallback(() => {
    api.get('/admin/issue-detections').then(res => {
      setDetections(res.data?.detections || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDetections(); }, [fetchDetections]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await api.post('/admin/issue-detections/scan?limit=500');
      alert(`스캔 완료: ${res.data?.detected || 0}건 감지`);
      fetchDetections();
    } finally {
      setScanning(false);
    }
  };

  const handleCreateIssue = async (id: number) => {
    if (!confirm('이 감지를 이슈로 등록하시겠습니까?')) return;
    await api.post(`/admin/issue-detections/${id}/create-issue`);
    fetchDetections();
  };

  const handleDismiss = async (id: number) => {
    await api.post(`/admin/issue-detections/${id}/dismiss`);
    fetchDetections();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이슈 감지</h1>
          <p className="text-sm text-gray-500 mt-1">고객 메시지에서 자동 감지된 문제 — 이슈 등록 또는 무시</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {scanning ? '스캔 중...' : '메시지 스캔'}
        </button>
      </div>

      {detections.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-gray-400 text-sm">감지된 이슈가 없습니다</div>
          <div className="text-gray-300 text-xs mt-1">메시지 스캔을 실행하면 고객 문의에서 이슈를 자동 감지합니다</div>
        </div>
      ) : (
        <div className="space-y-3">
          {detections.map(d => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* 태그 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[d.severity]}`}>
                      {SEVERITY_LABELS[d.severity]}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {CATEGORY_LABELS[d.detected_category] || d.detected_category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {/* 게스트 / 숙소 */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900">{d.guest_name_clean || d.guest_name}</span>
                    {d.property_name && (
                      <span className="text-xs text-gray-500">{d.property_name}</span>
                    )}
                  </div>

                  {/* 원문 */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                    {d.message_content}
                  </div>

                  {/* 키워드 */}
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-gray-400">감지 키워드:</span>
                    {d.detected_keywords.split(', ').map((kw, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCreateIssue(d.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition"
                  >
                    이슈 등록
                  </button>
                  <button
                    onClick={() => handleDismiss(d.id)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition"
                  >
                    무시
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
