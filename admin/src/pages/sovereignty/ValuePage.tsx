import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

/* ━━━ Types ━━━ */
interface ReviewKeyword { word: string; category: string; }
interface BlogPost { title: string; blogger: string; date: string; }
interface ReviewSnippet { author: string; rating: number; text: string; time: string; }

interface PlaceValue {
  name: string;
  address: string;
  district: string;
  dong?: string;
  category?: string;
  industry?: string;
  rating: number;
  reviewCount: number;
  blogCount: number;
  phone: string;
  website: string;
  googleUrl?: string;
  kakaoUrl?: string;
  hasDigitalPresence: boolean;
  gapCount?: number;
  dataSource: string;
  sentimentScore: number;
  keywords: ReviewKeyword[];
  identity: string[];
  reviews: ReviewSnippet[];
  blogPosts?: BlogPost[];
  valueScore: number;
  isHiddenGem: boolean;
  tags?: string[];
}

interface ReviewData {
  generatedAt: string;
  source: string;
  summary: {
    totalAnalyzed: number;
    avgRating: number;
    totalReviews: number;
    totalBlogPosts: number;
    hiddenGems: number;
  };
  places: PlaceValue[];
  keywords: Record<string, number>;
  districtValues: Record<string, {
    count: number;
    avgRating: number;
    totalReviews: number;
    totalBlogs: number;
    hiddenGems: number;
  }>;
}

/* ━━━ Hook ━━━ */
function useReviewData() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/review-values.json")
      .then(res => { if (!res.ok) throw new Error("리뷰 데이터 로드 실패"); return res.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/* ━━━ 블로그 인기도 표시 ━━━ */
function BlogHeat({ count }: { count: number }) {
  if (count <= 0) return <span className="text-xs text-gray-400">블로그 없음</span>;
  const level = count >= 10000 ? "🔥🔥🔥" : count >= 3000 ? "🔥🔥" : count >= 500 ? "🔥" : "📝";
  const color = count >= 10000 ? "text-red-600" : count >= 3000 ? "text-orange-600" : count >= 500 ? "text-amber-600" : "text-gray-600";
  return (
    <span className={`text-sm font-bold ${color}`}>
      {level} {count >= 10000 ? `${(count / 10000).toFixed(1)}만` : count >= 1000 ? `${(count / 1000).toFixed(1)}천` : count}건
    </span>
  );
}

/* ━━━ 감성 바 ━━━ */
function SentimentBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{score}%</span>
    </div>
  );
}

type ViewFilter = "all" | "hot" | "hidden";

export default function ValuePage() {
  const { data, loading, error } = useReviewData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [expandedPlace, setExpandedPlace] = useState<string | null>(null);

  // 블로그 수 기준 정렬
  const sortedPlaces = useMemo(() => {
    if (!data) return [];
    return [...data.places].sort((a, b) => b.blogCount - a.blogCount);
  }, [data]);

  const filteredPlaces = useMemo(() => {
    if (filter === "hot") return sortedPlaces.filter(p => p.blogCount >= 3000);
    if (filter === "hidden") return sortedPlaces.filter(p => p.blogCount >= 500 && (p.gapCount ?? 0) >= 2);
    return sortedPlaces;
  }, [sortedPlaces, filter]);

  const topKeywords = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.keywords).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [data]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">리뷰 데이터 분석 중...</div>;
  if (error || !data) return <div className="text-red-500 p-8">오류: {error}</div>;

  const { summary } = data;
  const hotPlaces = sortedPlaces.filter(p => p.blogCount >= 3000);
  const hiddenGems = sortedPlaces.filter(p => p.blogCount >= 500 && (p.gapCount ?? 0) >= 2);
  const topByBlog = sortedPlaces.slice(0, 5);

  return (
    <div className="space-y-6">

      {/* ━━━ Step 내비게이션 ━━━ */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
        <button onClick={() => navigate("/sovereignty/discover")}
          className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 whitespace-nowrap">1. 장소 발견</button>
        <span className="text-gray-300">→</span>
        <span className="px-2.5 py-1 bg-blue-600 text-white rounded-full font-bold whitespace-nowrap">2. 가치 발견</span>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/structure")}
          className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">3. 구조화</button>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/fusion")}
          className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">4. 결합</button>
        <span className="text-gray-300">→</span>
        <button onClick={() => navigate("/sovereignty/report")}
          className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-full whitespace-nowrap">5. 리포트</button>
      </div>

      {/* ━━━ 헤더 ━━━ */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">2. 가치 발견</h1>
        <p className="text-sm text-gray-500 mt-1">
          네이버 블로그 · Google 리뷰 · 카카오 로컬에서 장소의 진짜 가치를 발견합니다
        </p>
      </div>

      {/* ━━━ 핵심 발견 ━━━ */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-5 text-white">
        <span className="text-xs bg-white/20 text-amber-100 px-2 py-0.5 rounded-full">핵심 발견</span>
        <p className="text-xl font-bold mt-2">
          {summary.totalAnalyzed}개 장소에서 <span className="text-yellow-200">블로그 후기 {summary.totalBlogPosts.toLocaleString()}건</span> 발견
        </p>
        <p className="text-sm text-amber-100 mt-1">
          사람들이 직접 방문하고 남긴 후기 — 이것이 장소의 진짜 가치를 증명합니다
        </p>

        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{summary.totalAnalyzed}</p>
            <p className="text-xs text-amber-200">분석 장소</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{summary.totalBlogPosts.toLocaleString()}</p>
            <p className="text-xs text-amber-200">블로그 후기</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-300">{hotPlaces.length}</p>
            <p className="text-xs text-amber-200">🔥 입소문 장소</p>
            <p className="text-[10px] text-amber-300">3,000건+</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-yellow-300">{hiddenGems.length}</p>
            <p className="text-xs text-amber-200">💎 숨은 보석</p>
            <p className="text-[10px] text-amber-300">후기多+정보無</p>
          </div>
        </div>
      </div>

      {/* ━━━ 데이터 소스 설명 ━━━ */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-lg">📝</p>
          <p className="text-sm font-bold text-gray-900 mt-1">네이버 블로그</p>
          <p className="text-xs text-gray-500 mt-0.5">250,867건 수집 완료</p>
          <p className="text-[10px] text-green-600 mt-1">✅ 실시간 연동</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-lg">⭐</p>
          <p className="text-sm font-bold text-gray-900 mt-1">Google 리뷰</p>
          <p className="text-xs text-gray-500 mt-0.5">별점 + 리뷰 텍스트</p>
          <p className="text-[10px] text-orange-500 mt-1">⏳ API 키 설정 중</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-lg">🗺</p>
          <p className="text-sm font-bold text-gray-900 mt-1">카카오 로컬</p>
          <p className="text-xs text-gray-500 mt-0.5">장소 상세 + 카카오맵</p>
          <p className="text-[10px] text-orange-500 mt-1">⏳ REST키 필요</p>
        </div>
      </div>

      {/* ━━━ 블로그 인기 TOP 5 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-bold text-gray-900">🔥 블로그 인기 TOP 5</h2>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">사람들이 가장 많이 후기를 남긴 곳</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          블로그 후기가 많다 = 방문 경험을 공유하고 싶을 만큼 가치가 있다
        </p>

        <div className="space-y-3">
          {topByBlog.map((p, i) => (
            <div key={p.name} className="border border-gray-100 bg-gray-50/50 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className={`text-2xl font-bold mt-0.5 ${i < 3 ? "text-red-500" : "text-gray-400"}`}>#{i + 1}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.district} · {p.category || p.industry || ""}</p>
                  </div>
                </div>
                <div className="text-right">
                  <BlogHeat count={p.blogCount} />
                  <p className="text-[10px] text-gray-400 mt-0.5">네이버 블로그</p>
                </div>
              </div>

              {/* 정체성 */}
              {p.identity.length > 0 && (
                <div className="mt-3 space-y-1">
                  {p.identity.map((id, j) => (
                    <p key={j} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-amber-500 shrink-0">▸</span> {id}
                    </p>
                  ))}
                </div>
              )}

              {/* 블로그 후기 미리보기 */}
              {p.blogPosts && p.blogPosts.length > 0 && (
                <div className="mt-3 bg-white rounded-lg p-3 space-y-1.5">
                  <p className="text-[10px] text-gray-400 font-bold">📝 블로그 후기</p>
                  {p.blogPosts.map((b, k) => (
                    <p key={k} className="text-xs text-gray-600 truncate">
                      <span className="text-green-600 mr-1">▸</span>
                      {b.title}
                      <span className="text-gray-400 ml-1">— {b.blogger}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* 감성 + 디지털 상태 */}
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 mb-1">감성 분석</p>
                  <SentimentBar score={p.sentimentScore} />
                </div>
                <div className="flex gap-1 shrink-0">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${p.phone ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                    {p.phone ? "✅" : "❌"} 전화
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${p.website ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                    {p.website ? "✅" : "❌"} 웹
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ 숨은 보석 ━━━ */}
      {hiddenGems.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-gray-900">💎 숨은 보석</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">후기 많은데 디지털 정보 없는 곳</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            블로그 500건 이상이지만 전화번호·웹사이트가 없는 장소 — 가치는 증명됐지만 검색으로 못 찾는 곳
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {hiddenGems.slice(0, 6).map((p) => (
              <div key={p.name} className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                    <p className="text-xs text-gray-500">{p.district}</p>
                  </div>
                  <BlogHeat count={p.blogCount} />
                </div>
                {p.identity[0] && (
                  <p className="text-xs text-gray-600 mt-2"><span className="text-amber-500">▸</span> {p.identity[0]}</p>
                )}
                <div className="flex gap-1 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">❌ 전화</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">❌ 웹</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">감성 {p.sentimentScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ 키워드 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">🏷 고객이 말한 가치 키워드</h2>
        <p className="text-sm text-gray-500 mb-4">
          {summary.totalBlogPosts.toLocaleString()}건 블로그 후기에서 추출한 감성 키워드
        </p>
        <div className="flex flex-wrap gap-2">
          {topKeywords.map(([word, count], i) => {
            const size = i < 3 ? "text-lg px-4 py-2" : i < 8 ? "text-base px-3 py-1.5" : i < 14 ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5";
            const color = i < 3 ? "bg-amber-100 text-amber-800"
              : i < 8 ? "bg-emerald-50 text-emerald-700"
              : i < 14 ? "bg-blue-50 text-blue-700"
              : "bg-gray-100 text-gray-600";
            return (
              <span key={word} className={`rounded-full font-medium ${size} ${color}`}>
                {word} <span className="opacity-50">({count})</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ━━━ 구별 가치 분포 ━━━ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">🗺 구별 블로그 후기 분포</h2>
        <p className="text-sm text-gray-500 mb-4">어느 구의 장소가 가장 많이 이야기되고 있는가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.districtValues)
            .sort((a, b) => (b[1].totalBlogs || 0) - (a[1].totalBlogs || 0))
            .map(([district, val]) => (
            <div key={district} className="bg-gray-50 rounded-lg p-3">
              <p className="font-bold text-gray-900 text-sm">{district}</p>
              <p className="text-xs text-gray-500 mt-1">{val.count}곳 분석</p>
              <p className="text-sm font-bold text-amber-600 mt-1">
                📝 {(val.totalBlogs || 0).toLocaleString()}건
              </p>
              {val.hiddenGems > 0 && (
                <p className="text-[10px] text-amber-700 mt-1">💎 숨은보석 {val.hiddenGems}곳</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ━━━ 전체 장소 리스트 ━━━ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">📋 전체 분석 결과</h2>
          <div className="flex gap-1.5">
            {([
              { key: "all" as ViewFilter, label: `전체 ${sortedPlaces.length}` },
              { key: "hot" as ViewFilter, label: `🔥 인기 ${hotPlaces.length}` },
              { key: "hidden" as ViewFilter, label: `💎 숨은보석 ${hiddenGems.length}` },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs transition whitespace-nowrap ${
                  filter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredPlaces.slice(0, 30).map((p) => {
            const isExpanded = expandedPlace === p.name;
            return (
              <div key={p.name}
                className={`bg-white rounded-xl border transition ${isExpanded ? "border-blue-300 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
                <button onClick={() => setExpandedPlace(isExpanded ? null : p.name)}
                  className="w-full p-4 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                        {p.blogCount >= 3000 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">🔥 인기</span>}
                        {p.blogCount >= 500 && (p.gapCount ?? 0) >= 2 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">💎 숨은보석</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{p.district} · {p.category || p.industry || ""}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <BlogHeat count={p.blogCount} />
                    </div>
                  </div>

                  {p.identity[0] && (
                    <p className="text-xs text-gray-600 mt-2 truncate">
                      <span className="text-amber-500">▸</span> {p.identity[0]}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <SentimentBar score={p.sentimentScore} />
                    <div className="flex gap-1 shrink-0">
                      <span className={`text-[10px] px-1 py-0.5 rounded ${p.phone ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                        {p.phone ? "✅📞" : "❌📞"}
                      </span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${p.website ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                        {p.website ? "✅🌐" : "❌🌐"}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {p.identity.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1">🎯 장소 정체성</p>
                        {p.identity.map((id, j) => (
                          <p key={j} className="text-sm text-gray-700"><span className="text-amber-500">▸</span> {id}</p>
                        ))}
                      </div>
                    )}

                    {p.blogPosts && p.blogPosts.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1">📝 블로그 후기</p>
                        {p.blogPosts.map((b, k) => (
                          <p key={k} className="text-xs text-gray-600 mt-1">
                            <span className="text-green-600">▸</span> {b.title}
                            <span className="text-gray-400 ml-1">— {b.blogger} ({b.date})</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {p.keywords.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1">🏷 감성 키워드</p>
                        <div className="flex flex-wrap gap-1">
                          {p.keywords.map((kw, j) => (
                            <span key={j} className={`px-2 py-0.5 text-xs rounded-full ${
                              kw.category === "긍정" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                            }`}>{kw.word}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.reviews.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1">⭐ Google 리뷰</p>
                        {p.reviews.map((r, k) => (
                          <div key={k} className="bg-gray-50 rounded-lg p-3 mt-1">
                            <span className="text-amber-500 text-xs">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                            <span className="text-xs text-gray-400 ml-1">{r.author} · {r.time}</span>
                            <p className="text-xs text-gray-600 mt-1">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-gray-300">출처: {p.dataSource}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredPlaces.length > 30 && (
          <p className="text-center text-xs text-gray-400 mt-3">+ {filteredPlaces.length - 30}건 더 있음</p>
        )}
      </div>

      {/* ━━━ 인사이트 ━━━ */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">💡 가치 발견 인사이트</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex gap-3">
            <span className="text-2xl shrink-0">📝</span>
            <div>
              <p className="text-sm font-bold text-gray-900">블로그가 가치를 증명</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {summary.totalBlogPosts.toLocaleString()}건의 후기 — 공공데이터 태그가 아니라 실제 방문자가 남긴 경험이 장소의 진짜 가치입니다.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl shrink-0">💎</span>
            <div>
              <p className="text-sm font-bold text-gray-900">숨은 보석 {hiddenGems.length}곳</p>
              <p className="text-xs text-gray-600 mt-0.5">
                블로그에서는 화제인데 기본 정보가 없는 곳. 디지털 정보만 채우면 방문객이 폭발적으로 늘 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl shrink-0">🔑</span>
            <div>
              <p className="text-sm font-bold text-gray-900">Google+카카오 연동 시</p>
              <p className="text-xs text-gray-600 mt-0.5">
                API 키 설정 완료 시 별점·리뷰 텍스트·카카오맵 URL까지 추가되어 가치 분석이 3배 풍부해집니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ 다음 단계 CTA ━━━ */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-violet-200">Step 2 완료 → Step 3</p>
            <h2 className="text-xl font-bold mt-1">발견한 가치를 데이터로 구조화</h2>
            <p className="text-sm text-violet-100 mt-1">
              블로그 후기에서 발견한 정체성·감성·키워드를 체계적으로 정리하고 회복 우선순위를 도출합니다
            </p>
          </div>
          <button onClick={() => navigate("/sovereignty/structure")}
            className="shrink-0 ml-4 px-6 py-3 bg-white text-violet-700 font-bold rounded-xl hover:bg-violet-50 transition text-sm">
            구조화 →
          </button>
        </div>
      </div>
    </div>
  );
}
