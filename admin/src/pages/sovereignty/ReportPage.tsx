import { useState } from "react";
import { PLACES, GAP_LABELS } from "./data";

const GAP_TO_TASK: Record<string, string> = {
  phone: "연락처 표준 데이터 등록",
  hours: "운영시간 등록",
  web: "공식 채널 연결",
  official_channel_missing: "공식 채널 생성 및 연결",
  map_platform_coverage_low: "지도 플랫폼 등록 요청",
  public_memory_sparse: "시민 기록 수집 캠페인",
  photo_data_sparse: "현장 사진 촬영 및 업로드",
  hours_missing: "운영시간 데이터 확보",
  phone_missing: "연락처 확보",
  owner_control_missing: "관리권 소유자 확인",
  address_inconsistent: "주소 데이터 통일",
  hours_inconsistent: "영업시간 교차 검증",
  platform_memory_dependency_high: "다중 플랫폼 분산 등록",
  high_value_data_gap: "핵심 데이터 우선 확보",
};

export default function ReportPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const place = PLACES[selectedIdx];

  const scoreKeys = [
    { key: "visibility" as const, label: "노출도", color: "bg-blue-500", bg: "bg-blue-100" },
    { key: "sovereignty" as const, label: "주권", color: "bg-red-500", bg: "bg-red-100" },
    { key: "consistency" as const, label: "정합성", color: "bg-yellow-500", bg: "bg-yellow-100" },
    { key: "activation" as const, label: "활성도", color: "bg-green-500", bg: "bg-green-100" },
  ];

  const avgScore = Math.round(
    (place.scores.visibility + place.scores.sovereignty + place.scores.consistency + place.scores.activation) / 4
  );

  // Summary stats
  const totalGaps = PLACES.reduce((sum, p) => sum + p.gaps.length, 0);
  const avgSovereignty = Math.round(PLACES.reduce((sum, p) => sum + p.scores.sovereignty, 0) / PLACES.length);
  const frozenCount = PLACES.filter((p) => p.scores.sovereignty === 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">리포트</h1>
        <p className="text-sm text-gray-500 mt-1">장소별 디지털 주권 분석 리포트를 생성합니다</p>
      </div>

      {/* Place Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">장소 선택</label>
        <select
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PLACES.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name} ({p.district})
            </option>
          ))}
        </select>
      </div>

      {/* Place Detail Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
            <p className="text-sm text-gray-500">{place.district} · {place.category} · {place.subway}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">종합 평균</p>
            <p className={`text-3xl font-bold ${avgScore >= 50 ? "text-green-600" : "text-red-600"}`}>{avgScore}</p>
          </div>
        </div>

        {/* Radar-like Score Bars */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {scoreKeys.map((sk) => (
            <div key={sk.key} className={`${sk.bg} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{sk.label}</span>
                <span className="text-lg font-bold text-gray-900">{place.scores[sk.key]}</span>
              </div>
              <div className="w-full bg-white bg-opacity-60 rounded-full h-3">
                <div
                  className={`${sk.color} h-3 rounded-full transition-all`}
                  style={{ width: `${Math.max(place.scores[sk.key], 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Gap Tags */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">데이터 공백</h3>
          <div className="flex flex-wrap gap-2">
            {place.gaps.map((g) => (
              <span key={g} className="px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-600 border border-red-200">
                {GAP_LABELS[g] || g}
              </span>
            ))}
            {place.gaps.length === 0 && (
              <span className="text-sm text-gray-400">공백 없음</span>
            )}
          </div>
        </div>

        {/* AI Value Insight */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">AI 가치 분석</h3>
          <p className="text-sm text-amber-900 leading-relaxed">{place.aiValue}</p>
        </div>
      </div>

      {/* Recovery Checklist */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">회복 과제</h2>
        <p className="text-sm text-gray-500 mb-4">데이터 공백으로부터 자동 생성된 작업 목록</p>
        {place.gaps.length > 0 ? (
          <div className="space-y-2">
            {place.gaps.map((g, i) => (
              <div key={g} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{GAP_TO_TASK[g] || g}</p>
                  <p className="text-xs text-gray-500">{GAP_LABELS[g] || g} 해결</p>
                </div>
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 font-medium">미완료</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">모든 과제가 완료되었습니다</p>
        )}
      </div>

      {/* Export Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">내보내기</h2>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors">
            JSON 내보내기
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
            CSV 내보내기
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            MD 내보내기
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">전체 요약 통계</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">분석 장소</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{PLACES.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">총 데이터 공백</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{totalGaps}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">평균 주권 점수</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{avgSovereignty}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">동결 장소</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{frozenCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
