import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSeoulData, useRestaurantData } from "./useSeoulData";
import type { SeoulPlace } from "./useSeoulData";

const INDUSTRY_ICONS: Record<string, string> = {
  "카페·커피": "☕", "편의점": "🏪", "일반음식점": "🍽", "패스트푸드": "🍔",
  "디저트·베이커리": "🍰", "백화점·대형마트": "🏬", "푸드트럭": "🚚",
  "키즈카페": "👶", "주점": "🍺", "교통·시설 내": "🚉", "기타 휴게음식": "🍴",
};

const ATTRACTION_ICONS: Record<string, string> = {
  "오래가게": "🏪", "박물관·전시": "🖼", "역사·유적": "🏛",
  "카페·맛집": "☕", "공연·문화": "🎭", "자연·공원": "🌳",
  "쇼핑·거리": "🛍", "관광안내": "ℹ️", "기타": "📍",
};

type ViewMode = "overview" | "district" | "dong" | "industry" | "places";
type StatusFilter = "all" | "blind" | "partial" | "ok";

export default function DiscoverPage() {
  const { data, loading, error } = useSeoulData();
  const restaurants = useRestaurantData();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>("overview");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedDong, setSelectedDong] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // 정렬된 구 목록
  const districtList = useMemo(() => {
    if (!data?.districtStats) return [];
    return Object.entries(data.districtStats)
      .sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  // 정렬된 업종 목록
  const industryList = useMemo(() => {
    if (!data?.industryStats) return [];
    return Object.entries(data.industryStats)
      .sort((a, b) => b[1].total - a[1].total);
  }, [data]);

  // 선택된 구의 동 목록
  const dongList = useMemo(() => {
    if (!data?.districtStats || !selectedDistrict) return [];
    const dongs = data.districtStats[selectedDistrict]?.dongs || {};
    return Object.entries(dongs)
      .sort((a, b) => b[1].total - a[1].total);
  }, [data, selectedDistrict]);

  // 개별 장소 목록 (샘플 500 + 관광명소)
  const placesList = useMemo(() => {
    if (!data) return [];
    let list: SeoulPlace[] = [...(data.restaurants || []), ...(data.attractions || [])];

    if (selectedDistrict) list = list.filter(p => p.district === selectedDistrict);
    if (selectedIndustry) list = list.filter(p => p.industry === selectedIndustry || p.category === selectedIndustry);
    if (statusFilter === "blind") list = list.filter(p => p.gapCount >= 2);
    else if (statusFilter === "partial") list = list.filter(p => p.gapCount === 1);
    else if (statusFilter === "ok") list = list.filter(p => p.gapCount === 0);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) ||
        p.district?.includes(q) || p.dong?.includes(q) || p.industry?.includes(q)
      );
    }

    return list.sort((a, b) => b.gapCount - a.gapCount);
  }, [data, selectedDistrict, selectedIndustry, statusFilter, search]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">데이터 분석 중...</div>;
  if (error || !data) return <div className="text-red-500 p-8">오류: {error}</div>;

  const { stats } = data;
  const noPhoneRate = ((stats.noPhone / stats.totalPlaces) * 100).toFixed(1);
  const noWebRate = ((stats.noWeb / stats.totalPlaces) * 100).toFixed(1);

  return (
    <div className="space-y-5">

      {/* ━━━ Step 내비게이션 ━━━ */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
        <span className="px-2.5 py-1 bg-blue-600 text-white rounded-full font-bold whitespace-nowrap">1. 장소 발견</span>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/value")} className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 whitespace-nowrap">2. 가치 발견</button>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/structure")} className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">3. 구조화</button>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/fusion")} className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">4. 결합</button>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/report")} className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">5. 리포트</button>
      </div>

      {/* ━━━ 헤더 ━━━ */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">1. 장소 발견</h1>
        <p className="text-sm text-gray-500 mt-1">서울특별시 전역 · 25개 구 · {stats.totalPlaces.toLocaleString()}개 장소 전수 조사</p>
      </div>

      {/* ━━━ 핵심 지표 ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">분석 장소</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPlaces.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">음식점 {stats.totalRestaurants.toLocaleString()} + 명소 {stats.totalAttractions}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">📞 전화 없음</p>
          <p className="text-2xl font-bold text-red-600">{stats.noPhone.toLocaleString()}</p>
          <p className="text-[10px] text-red-400">{noPhoneRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">🌐 공식채널 없음</p>
          <p className="text-2xl font-bold text-orange-600">{stats.noWeb.toLocaleString()}</p>
          <p className="text-[10px] text-orange-400">{noWebRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">🏪 서울 전체 점포</p>
          <p className="text-2xl font-bold text-blue-600">{stats.storeStatsTotal.toLocaleString()}</p>
          <p className="text-[10px] text-blue-400">{stats.storeStatsQuarter}분기 상권분석</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">🎭 문화행사</p>
          <p className="text-2xl font-bold text-purple-600">{stats.cultureTotal.toLocaleString()}</p>
          <p className="text-[10px] text-purple-400">서울 전역</p>
        </div>
      </div>

      {/* ━━━ 비율 바 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex h-6 rounded-lg overflow-hidden">
          <div className="bg-red-500 flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${(stats.blind / stats.totalPlaces) * 100}%` }}>
            {stats.blind.toLocaleString()}
          </div>
          <div className="bg-orange-400 flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${(stats.partial / stats.totalPlaces) * 100}%` }}>
            {stats.partial.toLocaleString()}
          </div>
          <div className="bg-emerald-400 flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${(stats.ok / stats.totalPlaces) * 100}%` }}>
            {stats.ok}
          </div>
        </div>
        <div className="flex gap-4 mt-1.5 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" />사각지대 {stats.blind.toLocaleString()} ({((stats.blind / stats.totalPlaces) * 100).toFixed(1)}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400" />부분누락 {stats.partial.toLocaleString()}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" />정보완비 {stats.ok}</span>
        </div>
      </div>

      {/* ━━━ 세부 목차 탭 ━━━ */}
      <div className="flex gap-1.5 border-b border-gray-200 pb-0">
        {([
          { key: "overview" as ViewMode, label: "📊 전체 현황" },
          { key: "district" as ViewMode, label: "🗺 자치구별" },
          { key: "industry" as ViewMode, label: "🏷 업종별" },
          { key: "places" as ViewMode, label: "📍 개별 장소" },
        ]).map(tab => (
          <button key={tab.key} onClick={() => { setView(tab.key); setSelectedDistrict(null); setSelectedDong(null); setSelectedIndustry(null); }}
            className={`px-4 py-2 text-sm font-medium transition rounded-t-lg ${
              view === tab.key ? "bg-white border border-b-white border-gray-200 text-gray-900 -mb-px" : "text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━ 전체 현황 ━━━ */}
      {view === "overview" && (
        <div className="space-y-5">
          {/* 구별 요약 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">자치구별 디지털 자산 현황 (25개 구)</h3>
            <div className="space-y-1.5">
              {districtList.map(([name, stat]) => {
                const blindRate = stat.total > 0 ? (stat.blind / stat.total) * 100 : 0;
                return (
                  <button key={name} onClick={() => { setView("district"); setSelectedDistrict(name); }}
                    className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition text-left">
                    <span className="text-xs text-gray-600 w-16 shrink-0">{name}</span>
                    <div className="flex-1 flex h-4 rounded overflow-hidden bg-gray-100">
                      <div className="bg-red-400" style={{ width: `${blindRate}%` }} />
                      <div className="bg-orange-300" style={{ width: `${stat.total > 0 ? (stat.partial / stat.total) * 100 : 0}%` }} />
                      <div className="bg-emerald-400" style={{ width: `${stat.total > 0 ? (stat.ok / stat.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">{stat.total.toLocaleString()}</span>
                    <span className="text-[10px] text-red-500 w-10 text-right">{blindRate > 0 ? `${blindRate.toFixed(0)}%` : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 업종별 요약 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">업종별 디지털 자산 현황 ({industryList.length}개 업종)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {industryList.map(([name, stat]) => {
                const icon = INDUSTRY_ICONS[name] || "📍";
                const noPhoneR = stat.total > 0 ? Math.round((stat.noPhone / stat.total) * 100) : 0;
                const noWebR = stat.total > 0 ? Math.round((stat.noWeb / stat.total) * 100) : 0;
                return (
                  <button key={name} onClick={() => { setView("industry"); setSelectedIndustry(name); }}
                    className="bg-gray-50 rounded-lg p-3 text-left hover:bg-gray-100 transition border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm font-bold text-gray-800">{stat.total.toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-700 mt-1">{name}</p>
                    <div className="flex gap-3 mt-1.5 text-[10px]">
                      <span className="text-red-500">📞 없음 {noPhoneR}%</span>
                      <span className="text-orange-500">🌐 없음 {noWebR}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 관광명소 카테고리 */}
          {data.categoryStats && Object.keys(data.categoryStats).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">관광명소 카테고리별 ({stats.totalAttractions}건)</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {Object.entries(data.categoryStats)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([name, stat]) => {
                    const icon = ATTRACTION_ICONS[name] || "📍";
                    return (
                      <div key={name} className="bg-gray-50 rounded-lg p-2.5 text-center">
                        <span className="text-lg">{icon}</span>
                        <p className="text-xs font-medium text-gray-700 mt-0.5">{name}</p>
                        <p className="text-sm font-bold text-gray-900">{stat.total}</p>
                        {stat.blind > 0 && <p className="text-[10px] text-red-500">사각지대 {stat.blind}</p>}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 상권 통계 */}
          {data.storeStats && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-1">서울시 상권 점포 현황</h3>
              <p className="text-xs text-gray-400 mb-3">{data.storeStats.quarter}분기 · 총 {data.storeStats.totalStores.toLocaleString()}개 점포</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {data.storeStats.topIndustries.slice(0, 10).map(ind => (
                  <div key={ind.name} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs font-medium text-gray-700 truncate">{ind.name}</p>
                    <p className="text-sm font-bold text-gray-900">{ind.count.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━ 자치구별 뷰 ━━━ */}
      {view === "district" && (
        <div className="space-y-4">
          {/* 구 선택 */}
          <div className="flex flex-wrap gap-1.5">
            {districtList.map(([name, stat]) => (
              <button key={name} onClick={() => { setSelectedDistrict(name); setSelectedDong(null); }}
                className={`px-2.5 py-1.5 rounded-lg text-xs transition ${
                  selectedDistrict === name
                    ? "bg-blue-600 text-white"
                    : stat.blind > 0
                      ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {name} <span className="font-mono">{stat.total.toLocaleString()}</span>
              </button>
            ))}
          </div>

          {/* 선택된 구 상세 */}
          {selectedDistrict && data.districtStats[selectedDistrict] && (() => {
            const ds = data.districtStats[selectedDistrict];
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedDistrict}</h3>
                  <p className="text-xs text-gray-500">
                    총 {ds.total.toLocaleString()}개 장소 · 음식점 {ds.restaurants.toLocaleString()} · 명소 {ds.attractions}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{ds.total.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">전체</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{ds.noPhone.toLocaleString()}</p>
                    <p className="text-xs text-red-500">📞 전화 없음</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{ds.noWeb.toLocaleString()}</p>
                    <p className="text-xs text-orange-500">🌐 채널 없음</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{ds.ok}</p>
                    <p className="text-xs text-emerald-500">✅ 완비</p>
                  </div>
                </div>

                {/* 행정동별 */}
                {dongList.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">행정동별 현황 ({dongList.length}개 동)</h4>
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50">
                          <tr>
                            <th className="text-left py-1.5 px-3 text-xs text-gray-500 font-medium">행정동</th>
                            <th className="text-right py-1.5 px-3 text-xs text-gray-500 font-medium">장소</th>
                            <th className="text-right py-1.5 px-3 text-xs text-gray-500 font-medium">📞없음</th>
                            <th className="text-right py-1.5 px-3 text-xs text-gray-500 font-medium">🌐없음</th>
                            <th className="text-right py-1.5 px-3 text-xs text-gray-500 font-medium">📞비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dongList.map(([dong, st]) => (
                            <tr key={dong} className="border-t border-gray-100 hover:bg-blue-50/50 cursor-pointer"
                              onClick={() => { setSelectedDong(dong); setView("places"); setSearch(dong); }}>
                              <td className="py-1.5 px-3 font-medium text-gray-800">{dong}</td>
                              <td className="py-1.5 px-3 text-right text-gray-600">{st.total}</td>
                              <td className="py-1.5 px-3 text-right text-red-600">{st.noPhone}</td>
                              <td className="py-1.5 px-3 text-right text-orange-600">{st.noWeb}</td>
                              <td className="py-1.5 px-3 text-right">
                                <span className={`text-xs ${st.noPhone / st.total > 0.5 ? "text-red-600 font-bold" : "text-gray-500"}`}>
                                  {st.total > 0 ? Math.round((st.noPhone / st.total) * 100) : 0}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button onClick={() => { setView("places"); }}
                  className="text-xs text-blue-600 hover:underline">
                  → {selectedDistrict} 개별 장소 보기
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ━━━ 업종별 뷰 ━━━ */}
      {view === "industry" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {industryList.map(([name, stat]) => (
              <button key={name} onClick={() => setSelectedIndustry(selectedIndustry === name ? null : name)}
                className={`px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
                  selectedIndustry === name ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                <span>{INDUSTRY_ICONS[name] || "📍"}</span>
                {name} <span className="font-mono">{stat.total.toLocaleString()}</span>
              </button>
            ))}
          </div>

          {selectedIndustry && data.industryStats[selectedIndustry] && (() => {
            const ind = data.industryStats[selectedIndustry];
            const noPhoneR = Math.round((ind.noPhone / ind.total) * 100);
            const noWebR = Math.round((ind.noWeb / ind.total) * 100);
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{INDUSTRY_ICONS[selectedIndustry] || "📍"}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedIndustry}</h3>
                    <p className="text-xs text-gray-500">서울 전역 {ind.total.toLocaleString()}개 영업 중</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{ind.total.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">전체</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">{ind.noPhone.toLocaleString()}</p>
                    <p className="text-xs text-red-500">📞 전화 없음 ({noPhoneR}%)</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-orange-600">{ind.noWeb.toLocaleString()}</p>
                    <p className="text-xs text-orange-500">🌐 채널 없음 ({noWebR}%)</p>
                  </div>
                </div>

                {/* 이 업종의 구별 분포 */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">구별 분포</h4>
                  <p className="text-xs text-gray-400">* 구별 세부 수치는 개별 장소 탭에서 확인</p>
                </div>

                <button onClick={() => setView("places")}
                  className="text-xs text-blue-600 hover:underline">
                  → {selectedIndustry} 개별 장소 보기
                </button>
              </div>
            );
          })()}

          {!selectedIndustry && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">업종별 디지털 사각지대 비교</h3>
              <div className="space-y-2">
                {industryList.map(([name, stat]) => {
                  const noPhoneR = stat.total > 0 ? (stat.noPhone / stat.total) * 100 : 0;
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-sm w-6">{INDUSTRY_ICONS[name] || "📍"}</span>
                      <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{name}</span>
                      <div className="flex-1 flex h-4 rounded overflow-hidden bg-gray-100">
                        <div className="bg-red-400" style={{ width: `${noPhoneR}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">{stat.total.toLocaleString()}</span>
                      <span className="text-[10px] text-red-500 w-10 text-right">{noPhoneR.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━ 개별 장소 뷰 ━━━ */}
      {view === "places" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="장소명, 주소, 동, 업종으로 검색..." />
            <div className="flex gap-1.5">
              {([
                { key: "all" as StatusFilter, label: "전체" },
                { key: "blind" as StatusFilter, label: "🔴 사각지대" },
                { key: "partial" as StatusFilter, label: "🟠 부분누락" },
                { key: "ok" as StatusFilter, label: "🟢 완비" },
              ]).map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-2 rounded-lg text-xs transition whitespace-nowrap ${
                    statusFilter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 활성 필터 표시 */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-400">{placesList.length.toLocaleString()}건 표시 (샘플)</p>
            {selectedDistrict && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                {selectedDistrict} <button onClick={() => setSelectedDistrict(null)} className="hover:text-blue-900">×</button>
              </span>
            )}
            {selectedIndustry && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                {selectedIndustry} <button onClick={() => setSelectedIndustry(null)} className="hover:text-purple-900">×</button>
              </span>
            )}
            {!restaurants.data && (
              <button onClick={restaurants.load}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full hover:bg-blue-100 transition">
                {restaurants.loading ? "로딩 중..." : "📥 전체 36,757건 로드"}
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {placesList.slice(0, 50).map((p, i) => {
              const icon = p.type === "restaurant"
                ? (INDUSTRY_ICONS[p.industry || ""] || "🍴")
                : (ATTRACTION_ICONS[p.category || ""] || "📍");
              const statusColor = p.gapCount >= 2
                ? "bg-red-100 text-red-700 border-red-200"
                : p.gapCount === 1
                  ? "bg-orange-100 text-orange-700 border-orange-200"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200";
              const statusLabel = p.gapCount >= 2 ? "사각지대" : p.gapCount === 1 ? "부분누락" : "완비";

              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{icon}</span>
                        <h3 className="text-sm font-bold text-gray-900 truncate">{p.name}</h3>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {p.district}{p.dong ? ` · ${p.dong}` : ""} · {p.industry || p.category || p.type}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-1 truncate">{p.address}</p>

                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className={`rounded-md p-1.5 text-center text-[11px] ${p.phone ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                      {p.phone ? "✅" : "❌"} 전화 {p.phone ? <span className="text-[10px] text-gray-400 ml-1">{p.phone.slice(0, 13)}</span> : ""}
                    </div>
                    <div className={`rounded-md p-1.5 text-center text-[11px] ${p.web ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                      {p.web ? "✅" : "❌"} 공식채널
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {placesList.length > 50 && (
            <p className="text-center text-xs text-gray-400">+ {(placesList.length - 50).toLocaleString()}건 더 있음</p>
          )}
        </div>
      )}
    </div>
  );
}
