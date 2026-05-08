import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMarketSummary,
  fetchMarketComparison,
  fetchMarketPrices,
  fetchCrawlJobs,
  autoImportMarket,
  importMarketRooms,
  importMarketContracts,
} from "../api/marketApi";
import type { MarketSummary, MarketCompareResult, MarketPrice, CrawlJob } from "../types/market";

function formatWon(n: number): string {
  if (!n) return "-";
  const man = n / 10000;
  return man >= 10 ? `${man.toFixed(0)}만` : `${man.toFixed(1)}만`;
}

function positionColor(pos: string): string {
  if (pos === "above_avg") return "text-red-600 bg-red-50";
  if (pos === "below_avg") return "text-green-600 bg-green-50";
  return "text-gray-600 bg-gray-50";
}

function positionLabel(pos: string): string {
  if (pos === "above_avg") return "시장↑";
  if (pos === "below_avg") return "시장↓";
  return "적정";
}

// ============================================================
// 플랫폼 정의
// ============================================================
interface PlatformDef {
  key: string;
  label: string;
  color: string;       // 배경색
  textColor: string;
  borderColor: string;
  description: string;
  dataScope: string;    // "내 계정" vs "전체 시장"
  collectItems: CollectItem[];
}

interface CollectItem {
  key: string;
  label: string;
  description: string;
  available: boolean;
}

const PLATFORMS: PlatformDef[] = [
  {
    key: "33m2",
    label: "삼삼엠투",
    color: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-300",
    description: "중단기 임대 플랫폼 · 주간 단위 가격",
    dataScope: "전체 시장 매물",
    collectItems: [
      { key: "prices", label: "매물 가격", description: "주간임대료 · 관리비 · 청소비 · 보증금 · 환불규정", available: true },
      { key: "contracts", label: "계약 현황", description: "거주중 · 입주대기 · 계약종료 · 금액 · 기간", available: true },
      { key: "discount", label: "할인 정보", description: "장기계약 할인 · 즉시입주 할인 조건", available: true },
      { key: "maintenance", label: "관리비 상세", description: "가스/수도/전기 포함 여부 · 금액", available: true },
      { key: "chat", label: "채팅 메시지", description: "계약별 대화 내용 전체", available: false },
      { key: "photos", label: "사진/옵션", description: "매물 사진 · 옵션 목록 · 방 설명", available: false },
    ],
  },
  {
    key: "liv",
    label: "리브애니웨어",
    color: "bg-cyan-50",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-300",
    description: "중장기 임대 플랫폼 · 월 단위 가격",
    dataScope: "전체 시장 매물",
    collectItems: [
      { key: "prices", label: "매물 가격", description: "월 임대료 · 보증금 · 관리비", available: false },
      { key: "availability", label: "입주 가능일", description: "즉시입주 · 예약 가능 날짜", available: false },
      { key: "amenities", label: "시설/옵션", description: "가구 · 가전 · 주차 · 반려동물", available: false },
    ],
  },
  {
    key: "jaritalk",
    label: "자리톡",
    color: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-300",
    description: "원룸/오피스텔 임대 플랫폼",
    dataScope: "전체 시장 매물",
    collectItems: [
      { key: "prices", label: "매물 가격", description: "월세 · 전세 · 보증금 · 관리비", available: false },
      { key: "building", label: "건물 정보", description: "층수 · 면적 · 방향 · 준공년도", available: false },
      { key: "vacancy", label: "공실 현황", description: "입주 가능일 · 공실 기간", available: false },
    ],
  },
];

// ============================================================
// Main Component
// ============================================================
export default function MarketDataPanel({ onBack }: { onBack?: () => void }) {
  // 플랫폼 선택 & 활성화
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(new Set());
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // 수집 설정
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});
  const [collectArea, setCollectArea] = useState<"all" | "region">("all");

  // 데이터
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [comparison, setComparison] = useState<MarketCompareResult[]>([]);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);

  // 수집 진행
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [phase, setPhase] = useState<"select" | "configure" | "results">("select");

  // 파일 업로드
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"rooms" | "contracts">("rooms");

  // 결과 뷰
  const [activeTab, setActiveTab] = useState<"compare" | "prices" | "jobs">("compare");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, compRes, priceRes, jobRes] = await Promise.all([
        fetchMarketSummary().catch(() => ({ success: false, data: null as unknown as MarketSummary })),
        fetchMarketComparison().catch(() => ({ success: false, data: [] as MarketCompareResult[] })),
        fetchMarketPrices().catch(() => ({ success: false, data: [] as MarketPrice[] })),
        fetchCrawlJobs(10).catch(() => ({ success: false, data: [] as CrawlJob[] })),
      ]);
      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
      if (compRes.success) setComparison(compRes.data || []);
      if (priceRes.success) setPrices(priceRes.data || []);
      if (jobRes.success) setJobs(jobRes.data || []);
      const has = (priceRes.success && (priceRes.data || []).length > 0) || (jobRes.success && (jobRes.data || []).length > 0);
      setHasData(has);
      if (has) setPhase("results");
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드: 기존 데이터 있으면 바로 결과 표시
  useEffect(() => { loadData(); }, [loadData]);

  // 플랫폼 활성화/비활성화
  const togglePlatform = (key: string) => {
    setActivePlatforms(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (selectedPlatform === key) setSelectedPlatform(null);
      } else {
        next.add(key);
        setSelectedPlatform(key);
        // 기본 선택 항목 설정
        if (!selectedItems[key]) {
          const platform = PLATFORMS.find(p => p.key === key);
          const defaults = new Set(
            (platform?.collectItems || []).filter(i => i.available).map(i => i.key)
          );
          setSelectedItems(prev => ({ ...prev, [key]: defaults }));
        }
      }
      return next;
    });
  };

  // 수집 항목 토글
  const toggleItem = (platformKey: string, itemKey: string) => {
    setSelectedItems(prev => {
      const current = new Set(prev[platformKey] || []);
      if (current.has(itemKey)) current.delete(itemKey);
      else current.add(itemKey);
      return { ...prev, [platformKey]: current };
    });
  };

  // 수집 실행
  const handleCollect = async () => {
    setCollecting(true);
    setCollectMsg(null);
    const results: string[] = [];

    try {
      // 현재는 삼삼엠투만 실제 수집 가능
      if (activePlatforms.has("33m2") && selectedItems["33m2"]?.size > 0) {
        const res = await autoImportMarket();
        results.push(res.success
          ? `삼삼엠투: ${res.data.processed_records}건 수집 완료`
          : `삼삼엠투: 수집 실패`
        );
      }
      if (activePlatforms.has("liv")) {
        results.push("리브애니웨어: 준비 중 (곧 지원 예정)");
      }
      if (activePlatforms.has("jaritalk")) {
        results.push("자리톡: 준비 중 (곧 지원 예정)");
      }

      setCollectMsg(results.join(" · "));
      await loadData();
      setPhase("results");
    } catch {
      setCollectMsg("수집 중 오류 발생");
    } finally {
      setCollecting(false);
      setTimeout(() => setCollectMsg(null), 10000);
    }
  };

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCollecting(true);
    setCollectMsg(null);
    try {
      const fn = uploadType === "rooms" ? importMarketRooms : importMarketContracts;
      const res = await fn(file);
      setCollectMsg(res.success
        ? `${res.data.processed_records}건 임포트 완료`
        : `실패: ${res.message || "오류"}`
      );
      await loadData();
    } catch {
      setCollectMsg("파일 업로드 실패");
    } finally {
      setCollecting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setCollectMsg(null), 8000);
    }
  };

  const currentPlatform = PLATFORMS.find(p => p.key === selectedPlatform);

  // ============================================================
  // Phase 1: 플랫폼 선택
  // ============================================================
  if (phase === "select" || (phase === "configure" && !selectedPlatform)) {
    return (
      <div className="space-y-4">
        {/* 제목 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">외부 시장 데이터 수집</h2>
            <p className="text-sm text-gray-500 mt-0.5">수집할 플랫폼을 선택하고, 가져올 항목을 체크하세요</p>
          </div>
          {onBack && (
            <button onClick={onBack} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
              ← 가격 캘린더
            </button>
          )}
        </div>

        {/* 플랫폼 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLATFORMS.map(p => {
            const isActive = activePlatforms.has(p.key);
            const hasAvailable = p.collectItems.some(i => i.available);
            return (
              <div
                key={p.key}
                onClick={() => hasAvailable && togglePlatform(p.key)}
                className={`rounded-xl border-2 p-4 transition cursor-pointer ${
                  isActive
                    ? `${p.borderColor} ${p.color}`
                    : hasAvailable
                    ? "border-gray-200 hover:border-gray-300 bg-white"
                    : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${isActive ? p.textColor : "text-gray-700"}`}>{p.label}</span>
                  {/* 토글 스위치 */}
                  <div className={`w-9 h-5 rounded-full transition relative ${isActive ? "bg-emerald-500" : "bg-gray-200"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition ${isActive ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">{p.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">범위: {p.dataScope}</span>
                  {!hasAvailable && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">준비중</span>}
                </div>
                {isActive && (
                  <div className="mt-2 text-[10px] text-emerald-600">
                    {(selectedItems[p.key] || new Set()).size}개 항목 선택됨
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 활성화된 플랫폼이 있으면 설정 진행 버튼 */}
        {activePlatforms.size > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPhase("configure");
                if (!selectedPlatform) setSelectedPlatform(Array.from(activePlatforms)[0]);
              }}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              수집 항목 설정 →
            </button>
            <span className="text-xs text-gray-400">
              {Array.from(activePlatforms).map(k => PLATFORMS.find(p => p.key === k)?.label).join(", ")} 선택됨
            </span>
          </div>
        )}

        {/* 기존 데이터가 있으면 바로가기 */}
        {hasData && (
          <button
            onClick={() => setPhase("results")}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            이전 수집 결과 보기 →
          </button>
        )}
      </div>
    );
  }

  // ============================================================
  // Phase 2: 수집 항목 설정
  // ============================================================
  if (phase === "configure" && currentPlatform) {
    return (
      <div className="space-y-4">
        {/* 상단: 플랫폼 탭 */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50">
              ← 캘린더
            </button>
          )}
          <button onClick={() => setPhase("select")} className="text-xs text-gray-400 hover:text-gray-600">← 플랫폼 선택</button>
          <div className="flex gap-1 ml-4">
            {Array.from(activePlatforms).map(key => {
              const p = PLATFORMS.find(pl => pl.key === key);
              if (!p) return null;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedPlatform(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    selectedPlatform === key
                      ? `${p.color} ${p.textColor} ${p.borderColor} border`
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 수집 설정 패널 */}
        <div className={`rounded-xl border-2 ${currentPlatform.borderColor} ${currentPlatform.color} p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-bold ${currentPlatform.textColor}`}>{currentPlatform.label} 수집 설정</h3>
              <p className="text-xs text-gray-500 mt-0.5">{currentPlatform.description} · {currentPlatform.dataScope}</p>
            </div>
          </div>

          {/* 수집 항목 체크박스 */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">가져올 정보를 선택하세요</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentPlatform.collectItems.map(item => {
                const checked = selectedItems[currentPlatform.key]?.has(item.key) || false;
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                      !item.available
                        ? "border-gray-200 bg-white/50 opacity-50 cursor-not-allowed"
                        : checked
                        ? `border-emerald-300 bg-white`
                        : "border-gray-200 bg-white hover:border-gray-300 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => item.available && toggleItem(currentPlatform.key, item.key)}
                      disabled={!item.available}
                      className="mt-0.5 rounded border-gray-300 text-emerald-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {item.label}
                        {!item.available && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded">준비중</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 수집 범위 */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1.5">수집 범위</div>
            <div className="flex gap-2">
              <button
                onClick={() => setCollectArea("all")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  collectArea === "all" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-500 bg-white"
                }`}
              >전체 시장 매물</button>
              <button
                onClick={() => setCollectArea("region")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  collectArea === "region" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-500 bg-white"
                }`}
              >특정 지역만</button>
            </div>
          </div>
        </div>

        {/* 수집 시작 */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCollect}
            disabled={collecting || !Array.from(activePlatforms).some(k => (selectedItems[k]?.size || 0) > 0)}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition"
          >
            {collecting ? "수집 중..." : "수집 시작"}
          </button>

          {/* 파일 직접 업로드 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">또는</span>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value as "rooms" | "contracts")}
              className="rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500"
            >
              <option value="rooms">매물 JSON</option>
              <option value="contracts">계약 CSV</option>
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={collecting}
              className="rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              파일 업로드
            </button>
            <input ref={fileInputRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileUpload} />
          </div>

          {collectMsg && (
            <span className={`text-xs px-2 py-1 rounded ${
              collectMsg.includes("완료") ? "bg-emerald-50 text-emerald-600" : "bg-yellow-50 text-yellow-700"
            }`}>
              {collectMsg}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Phase 3: 결과 화면
  // ============================================================
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex h-32 items-center justify-center text-gray-400">로딩 중...</div>
      ) : (
        <>
          {/* 상단 컨트롤 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onBack && (
                <button onClick={onBack} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                  ← 가격 캘린더
                </button>
              )}
              <button
                onClick={() => setPhase("select")}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                새로 수집하기
              </button>
              {collectMsg && (
                <span className={`text-xs px-2 py-1 rounded ${
                  collectMsg.includes("완료") ? "bg-emerald-50 text-emerald-600" : "bg-yellow-50 text-yellow-700"
                }`}>
                  {collectMsg}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {summary?.latest_snapshot
                ? `${summary.platform === "33m2" ? "삼삼엠투" : summary.platform} · ${summary.latest_snapshot} · ${summary.total_rooms}실`
                : ""
              }
            </div>
          </div>

          {/* 시장 요약 카드 */}
          {summary && summary.total_rooms > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              <SummaryCard label="총 매물" value={`${summary.total_rooms}실`} />
              <SummaryCard label="평균 주간가" value={formatWon(summary.avg_rent_weekly)} />
              <SummaryCard label="중앙값" value={formatWon(summary.median_rent_weekly)} />
              <SummaryCard label="최저~최고" value={`${formatWon(summary.min_rent_weekly)}~${formatWon(summary.max_rent_weekly)}`} />
              <SummaryCard label="평균 관리비" value={`${formatWon(summary.avg_maintenance)}/주`} />
              <SummaryCard label="평균 청소비" value={formatWon(summary.avg_cleaning_fee)} />
            </div>
          )}

          {/* 탭 */}
          <div className="flex gap-1 border-b border-gray-200">
            {([
              { key: "compare" as const, label: `비교 분석 (${comparison.length})` },
              { key: "prices" as const, label: `전체 매물 (${prices.length})` },
              { key: "jobs" as const, label: `수집 이력 (${jobs.length})` },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                  activeTab === tab.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {activeTab === "compare" && <CompareTab data={comparison} expandedRow={expandedRow} onToggle={setExpandedRow} />}
          {activeTab === "prices" && <PricesTab data={prices} />}
          {activeTab === "jobs" && <JobsTab data={jobs} />}

          {/* 지역별 요약 */}
          {summary && summary.by_region.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">지역별 시장 요약</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {summary.by_region.map(r => (
                  <div key={r.region} className="rounded-lg border border-gray-100 p-2 text-xs">
                    <div className="font-medium text-gray-800">{r.region || "미분류"} <span className="text-gray-400">({r.count}실)</span></div>
                    <div className="text-gray-500 mt-0.5">
                      평균 {formatWon(r.avg_rent_weekly)} · {formatWon(r.min_rent_weekly)}~{formatWon(r.max_rent_weekly)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub components
// ============================================================

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-sm font-bold text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function CompareTab({ data, expandedRow, onToggle }: { data: MarketCompareResult[]; expandedRow: number | null; onToggle: (id: number | null) => void }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <div className="text-sm text-gray-400">비교 데이터가 없습니다</div>
        <div className="text-xs text-gray-300">숙소 관리 &gt; 플랫폼 연동에서 삼삼엠투 room_id를 매칭하면 자동 비교됩니다</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-500">숙소</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">지역</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">우리 가격</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">시장 평균</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">중앙값</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">차이</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500">위치</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">백분위</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">비교군</th>
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <>
              <tr
                key={r.property_id}
                onClick={() => onToggle(expandedRow === r.property_id ? null : r.property_id)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-3 py-2 font-medium text-gray-800">{r.property_name}</td>
                <td className="px-3 py-2 text-gray-500">{r.property_region}</td>
                <td className="px-3 py-2 text-right font-medium">{formatWon(r.our_rent_weekly)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatWon(r.market_avg_weekly)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{formatWon(r.market_median_weekly)}</td>
                <td className={`px-3 py-2 text-right font-medium ${r.diff_percent > 0 ? "text-red-500" : r.diff_percent < 0 ? "text-green-500" : "text-gray-500"}`}>
                  {r.diff_percent > 0 ? "+" : ""}{r.diff_percent.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${positionColor(r.price_position)}`}>
                    {positionLabel(r.price_position)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-500">{r.percentile}%</td>
                <td className="px-3 py-2 text-right text-gray-400">{r.competitor_count}실</td>
              </tr>
              {expandedRow === r.property_id && r.nearby_competitors.length > 0 && (
                <tr key={`${r.property_id}-exp`}>
                  <td colSpan={9} className="bg-gray-50 px-6 py-2">
                    <div className="text-[10px] text-gray-500 mb-1 font-medium">유사 매물 (가격 근접순)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                      {r.nearby_competitors.map((c, i) => (
                        <div key={i} className="rounded border border-gray-200 bg-white px-2 py-1.5 text-[10px]">
                          <div className="font-medium text-gray-700 truncate">{c.room_name}</div>
                          <div className="text-gray-400 truncate">{c.address}</div>
                          <div className="mt-0.5 text-gray-600">
                            임대 {formatWon(c.rent_weekly)} · 관리 {formatWon(c.maintenance_weekly)} · 청소 {formatWon(c.cleaning_fee)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricesTab({ data }: { data: MarketPrice[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">매물 데이터가 없습니다. 먼저 수집을 실행하세요.</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-auto" style={{ maxHeight: "60vh" }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-500">매물명</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">지역</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">주간 임대</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">관리비</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">청소비</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">보증금</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500">환불</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500">공개</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500">HIERO</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-1.5 text-gray-800 max-w-[180px] truncate">{p.room_name}</td>
              <td className="px-3 py-1.5 text-gray-500">{p.region}</td>
              <td className="px-3 py-1.5 text-right font-medium">{formatWon(p.rent_weekly)}</td>
              <td className="px-3 py-1.5 text-right text-gray-500">{formatWon(p.maintenance_weekly)}</td>
              <td className="px-3 py-1.5 text-right text-gray-500">{formatWon(p.cleaning_fee)}</td>
              <td className="px-3 py-1.5 text-right text-gray-400">{formatWon(p.deposit)}</td>
              <td className="px-3 py-1.5 text-center text-gray-400">{p.refund_policy || "-"}</td>
              <td className="px-3 py-1.5 text-center">
                <span className={p.visibility === "공개" ? "text-green-500" : "text-gray-300"}>{p.visibility === "공개" ? "●" : "○"}</span>
              </td>
              <td className="px-3 py-1.5 text-center">
                {p.property_id ? <span className="text-blue-500">●</span> : <span className="text-gray-300">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobsTab({ data }: { data: CrawlJob[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-gray-400 py-8 text-center">수집 이력이 없습니다.</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-500">일시</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">플랫폼</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">유형</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">소스</th>
            <th className="text-right px-3 py-2 font-medium text-gray-500">처리</th>
            <th className="text-center px-3 py-2 font-medium text-gray-500">상태</th>
          </tr>
        </thead>
        <tbody>
          {data.map(j => (
            <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-600">{new Date(j.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="px-3 py-2 text-gray-500">{j.platform === "33m2" ? "삼삼엠투" : j.platform === "liv" ? "리브애니웨어" : j.platform}</td>
              <td className="px-3 py-2 text-gray-500">{j.job_type === "rooms" ? "매물 가격" : j.job_type === "contracts" ? "계약 현황" : j.job_type}</td>
              <td className="px-3 py-2 text-gray-400">{j.source === "auto_import" ? "자동" : j.source === "file_upload" ? "파일" : j.source}</td>
              <td className="px-3 py-2 text-right">{j.processed_records}/{j.total_records}건</td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  j.status === "completed" ? "bg-green-50 text-green-600" :
                  j.status === "failed" ? "bg-red-50 text-red-600" :
                  "bg-yellow-50 text-yellow-600"
                }`}>
                  {j.status === "completed" ? "완료" : j.status === "failed" ? "실패" : "처리중"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
