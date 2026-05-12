import { useNavigate, useLocation } from "react-router-dom";
import { useSeoulData } from "./useSeoulData";

const FUNNEL_STEPS = [
  {
    num: 1, label: "장소 발견", path: "/sovereignty/discover",
    icon: "📡", desc: "서울 전역 소상공인 디지털 자산 전수 조사",
    metric: (d: any) => `${d.stats.totalPlaces?.toLocaleString() || d.stats.total?.toLocaleString()}개 장소 분석`,
    status: "live",
  },
  {
    num: 2, label: "가치 발견", path: "/sovereignty/value",
    icon: "💎", desc: "태그·리뷰·감성 분석으로 숨겨진 가치 도출",
    metric: () => "태그 분석 · 감성 매핑",
    status: "live",
  },
  {
    num: 3, label: "구조화", path: "/sovereignty/structure",
    icon: "🏗", desc: "발견된 가치를 체계적 데이터로 변환",
    metric: () => "칸반 · 태스크 관리",
    status: "live",
  },
  {
    num: 4, label: "데이터 결합", path: "/sovereignty/fusion",
    icon: "🔗", desc: "서울시 빅데이터와 결합하여 입체적 분석",
    metric: () => "상권 + 유동인구 + 문화",
    status: "live",
  },
  {
    num: 5, label: "리포트", path: "/sovereignty/report",
    icon: "📊", desc: "분석 결과를 리포트로 생성·공유",
    metric: () => "PDF · 대시보드 공유",
    status: "live",
  },
];

export default function SovereigntyIndex() {
  const { data, loading, error } = useSeoulData();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">데이터 로딩 중...</div>;
  if (error || !data) return <div className="text-red-500 p-8">오류: {error}</div>;

  const { stats } = data;
  const total = stats.totalPlaces || (stats as any).total || 0;
  const blind = stats.blind || (stats as any).frozen3 || 0;
  const partial = stats.partial || (stats as any).frozen2 || 0;
  const ok = stats.ok || (stats as any).active || 0;
  const problemCount = blind + partial;
  const problemRate = total > 0 ? ((problemCount / total) * 100).toFixed(1) : "0";

  // 구별 상위 5개
  const topDistricts = data.districtStats
    ? Object.entries(data.districtStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
    : [];

  // 카테고리별
  const categories = data.categoryStats
    ? Object.entries(data.categoryStats)
        .sort((a, b) => b[1].total - a[1].total)
    : [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">디지털 주권 분석</h1>
          <p className="text-sm text-gray-500 mt-1">서울특별시 전역 · {total.toLocaleString()}개 장소 · 25개 구 · 9개 카테고리</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400">{new Date(data.generatedAt).toLocaleDateString("ko")} 수집</span>
        </div>
      </div>

      {/* ━━━ 데이터 퍼널 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">🔄 데이터 분석 퍼널</h2>
        <div className="flex items-stretch gap-2">
          {FUNNEL_STEPS.map((step, i) => {
            const isActive = location.pathname === step.path;
            return (
              <div key={step.num} className="flex items-stretch flex-1">
                <button
                  onClick={() => navigate(step.path)}
                  className={`flex-1 rounded-xl p-4 text-left transition border-2 hover:shadow-md ${
                    isActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{step.icon}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      isActive ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                    }`}>
                      {step.num}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-2">{step.label}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{step.desc}</p>
                  <p className="text-[10px] text-blue-600 font-medium mt-2">{step.metric(data)}</p>
                </button>
                {i < FUNNEL_STEPS.length - 1 && (
                  <div className="flex items-center px-1">
                    <span className="text-gray-300 text-lg">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ━━━ 핵심 지표 ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">분석 장소</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">서울 전역 25개 구</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">정보 누락</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{problemCount}</p>
          <p className="text-xs text-red-400 mt-0.5">{problemRate}% · 디지털 사각지대</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">정보 완비</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{ok.toLocaleString()}</p>
          <p className="text-xs text-emerald-500 mt-0.5">{total > 0 ? ((ok / total) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">문화행사</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{(stats.cultureTotal || data.culture?.length || 0).toLocaleString()}</p>
          <p className="text-xs text-blue-400 mt-0.5">서울 전역</p>
        </div>
      </div>

      {/* ━━━ 디지털 상태 바 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">디지털 자산 현황</h3>
        <div className="flex h-8 rounded-lg overflow-hidden">
          <div className="bg-red-500 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${total > 0 ? (blind / total) * 100 : 0}%` }}>
            {blind.toLocaleString()}
          </div>
          <div className="bg-orange-400 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${total > 0 ? (partial / total) * 100 : 0}%` }}>
            {partial.toLocaleString()}
          </div>
          <div className="bg-emerald-400 flex items-center justify-center text-white text-xs font-bold" style={{ width: `${total > 0 ? (ok / total) * 100 : 0}%` }}>
            {ok.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" />사각지대</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400" />부분누락</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" />정보완비</span>
        </div>
      </div>

      {/* ━━━ 구별 + 카테고리별 ━━━ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 구별 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">🗺 구별 현황 (상위 8)</h3>
          <div className="space-y-2">
            {topDistricts.map(([name, stat]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-14 shrink-0">{name}</span>
                <div className="flex-1 flex h-5 rounded overflow-hidden bg-gray-100">
                  <div className="bg-red-400" style={{ width: `${(stat.blind / stat.total) * 100}%` }} />
                  <div className="bg-orange-300" style={{ width: `${(stat.partial / stat.total) * 100}%` }} />
                  <div className="bg-emerald-400" style={{ width: `${(stat.ok / stat.total) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{stat.total}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate("/sovereignty/discover")}
            className="mt-3 text-xs text-blue-600 hover:underline">전체 구 보기 →</button>
        </div>

        {/* 카테고리별 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">📂 카테고리별 현황</h3>
          <div className="space-y-2">
            {categories.map(([name, stat]) => {
              const blindRate = stat.total > 0 ? Math.round(((stat.blind + stat.partial) / stat.total) * 100) : 0;
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-20 shrink-0 truncate">{name}</span>
                  <div className="flex-1 flex h-5 rounded overflow-hidden bg-gray-100">
                    <div className="bg-red-400" style={{ width: `${(stat.blind / stat.total) * 100}%` }} />
                    <div className="bg-orange-300" style={{ width: `${(stat.partial / stat.total) * 100}%` }} />
                    <div className="bg-emerald-400" style={{ width: `${(stat.ok / stat.total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{stat.total}</span>
                  {blindRate > 20 && <span className="text-[10px] text-red-500">{blindRate}%</span>}
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate("/sovereignty/discover")}
            className="mt-3 text-xs text-blue-600 hover:underline">카테고리별 상세 →</button>
        </div>
      </div>

      {/* 퍼널 시작 CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
        <h3 className="font-bold">분석 시작하기</h3>
        <p className="text-sm text-blue-100 mt-1">서울시 {total.toLocaleString()}개 장소의 디지털 자산을 분석하고 가치를 발견하세요</p>
        <button onClick={() => navigate("/sovereignty/discover")}
          className="mt-3 px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-50 transition">
          📡 1단계: 장소 발견 →
        </button>
      </div>
    </div>
  );
}
