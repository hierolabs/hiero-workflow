import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import OperationManual from "../components/OperationManual";

const API_URL = import.meta.env.VITE_API_URL;

interface EngineScore {
  engine: string;
  label: string;
  score: number;
  status: string;
  bottleneck: string;
  details: Record<string, number>;
  actions: string[];
}

interface DiagnosisResult {
  property_id: number;
  property_code: string;
  property_name: string;
  overall_score: number;
  overall_grade: string;
  engines: EngineScore[];
  weakest_engine: string;
  strongest_engine: string;
  monthly_revenue: number;
  monthly_cost: number;
  monthly_profit: number;
  profit_rate: number;
  break_even_occupancy: number;
  headline: string;
  root_cause: string;
  note?: string;
}

interface PortfolioData {
  total_listings: number;
  averages: Record<string, number>;
  distribution: Record<string, number>;
  bottleneck_counts: Record<string, number>;
  portfolio_finance: Record<string, number>;
}

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

const ENGINE_ORDER = ["value_creation", "marketing", "sales", "value_delivery", "finance"];
const ENGINE_LABELS: Record<string, string> = {
  value_creation: "가치 창출",
  marketing: "마케팅",
  sales: "판매",
  value_delivery: "운영 전달",
  finance: "재무",
};

const DETAIL_LABELS: Record<string, string> = {
  location_score: "입지",
  room_type_score: "침대 구성",
  price_value_score: "가격 대비 가치",
  interior_score: "인테리어",
  target_fit_score: "타겟 적합성",
  photo_score: "대표사진",
  channel_exposure_score: "플랫폼 노출",
  listing_score: "제목/설명",
  review_score: "후기/평점",
  channel_performance_score: "채널별 성과",
  occupancy_rate: "가동률",
  inquiry_conversion: "문의 전환율",
  booking_conversion: "예약 전환율",
  price_flexibility: "가격 조정",
  long_stay_conversion: "장기숙박 전환",
  cleaning_score: "청소 품질",
  checkin_score: "체크인",
  cs_score: "CS 응답",
  amenity_score: "비품 관리",
  claim_rate: "클레임 발생률",
  monthly_revenue: "월 매출",
  monthly_rent: "월세",
  monthly_mgmt_fee: "관리비",
  monthly_clean_fee: "청소비",
  platform_fee: "플랫폼 수수료",
  monthly_cost: "월 비용",
  profit: "순이익",
  profit_rate: "순이익률",
  break_even_occupancy: "BEP 가동률",
};

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  healthy: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "양호" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "주의" },
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "위험" },
};

const GRADE_CFG: Record<string, string> = {
  S: "bg-violet-100 text-violet-700 border-violet-300",
  A: "bg-emerald-100 text-emerald-700 border-emerald-300",
  B: "bg-blue-100 text-blue-700 border-blue-300",
  C: "bg-amber-100 text-amber-700 border-amber-300",
  D: "bg-red-100 text-red-700 border-red-300",
};

export default function Diagnosis() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const propertyId = searchParams.get("id");

  const [list, setList] = useState<DiagnosisResult[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [detail, setDetail] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<string>("");
  const [showManual, setShowManual] = useState(false);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (propertyId) {
      loadDetail(Number(propertyId));
    } else {
      loadList();
    }
  }, [propertyId]);

  const loadList = async () => {
    setLoading(true);
    try {
      const [listRes, portRes] = await Promise.all([
        fetch(`${API_URL}/diagnosis`, { headers }),
        fetch(`${API_URL}/diagnosis/portfolio`, { headers }),
      ]);
      const listData = await listRes.json();
      const portData = await portRes.json();
      setList(listData.results || []);
      setPortfolio(portData);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadDetail = async (pid: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/diagnosis/${pid}`, { headers });
      const data = await res.json();
      setDetail(data);
      setSelectedEngine(data.weakest_engine || "value_creation");
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">진단 데이터 로딩 중...</div>;

  // 상세 뷰
  if (propertyId && detail) return <DetailView detail={detail} selectedEngine={selectedEngine} setSelectedEngine={setSelectedEngine} onBack={() => navigate("/diagnosis")} />;

  // 리스트 뷰
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">숙소 사업 진단</h1>
          <p className="mt-0.5 text-sm text-gray-500">5엔진 기준 · 점수 낮은 순 정렬</p>
        </div>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
      </div>

      {/* 포트폴리오 요약 */}
      {portfolio && portfolio.total_listings > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {ENGINE_ORDER.map((eng) => (
            <div key={eng} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-gray-500">{ENGINE_LABELS[eng]}</p>
              <p className={`mt-1 text-xl font-bold ${(portfolio.averages[eng] ?? 0) >= 65 ? "text-gray-900" : (portfolio.averages[eng] ?? 0) >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {portfolio.averages[eng]?.toFixed(0) ?? "-"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 분포 + 재무 요약 */}
      {portfolio && portfolio.total_listings > 0 && (
        <div className="mb-6 flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5">
            <span className="text-xs text-emerald-700 font-medium">양호 {portfolio.distribution.healthy ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5">
            <span className="text-xs text-amber-700 font-medium">주의 {portfolio.distribution.warning ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5">
            <span className="text-xs text-red-700 font-medium">위험 {portfolio.distribution.critical ?? 0}</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-gray-500">총 매출 <strong className="text-gray-900">₩{fmt(portfolio.portfolio_finance.total_revenue ?? 0)}</strong></span>
            <span className={`font-bold ${(portfolio.portfolio_finance.total_profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              순이익 ₩{fmt(portfolio.portfolio_finance.total_profit ?? 0)}
            </span>
          </div>
        </div>
      )}

      {/* 숙소 리스트 */}
      <div className="space-y-3">
        {list.map((r) => (
          <div
            key={r.property_id}
            onClick={() => navigate(`/diagnosis?id=${r.property_id}`)}
            className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-sm font-bold ${GRADE_CFG[r.overall_grade] || "bg-gray-100 text-gray-700"}`}>
                    {r.overall_grade}
                  </span>
                  <span className="text-base font-semibold text-gray-900 truncate">{r.property_name}</span>
                  <span className="text-xs text-gray-400">{r.property_code}</span>
                </div>
                <p className="text-sm text-gray-600">{r.headline}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.root_cause}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-2xl font-bold ${r.overall_score >= 65 ? "text-gray-900" : r.overall_score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                  {r.overall_score}
                </p>
                <p className="text-xs text-gray-400">종합</p>
              </div>
            </div>

            {/* 5엔진 미니바 */}
            <div className="mt-3 flex gap-2">
              {r.engines.map((e) => {
                const cfg = STATUS_CFG[e.status] || STATUS_CFG.warning;
                return (
                  <div key={e.engine} className={`flex-1 rounded-md ${cfg.bg} border ${cfg.border} px-2 py-1.5 text-center`}>
                    <p className="text-[10px] text-gray-500">{e.label}</p>
                    <p className={`text-sm font-bold ${cfg.text}`}>{e.score.toFixed(0)}</p>
                  </div>
                );
              })}
            </div>

            {/* 재무 요약 */}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span>매출 ₩{fmt(r.monthly_revenue)}</span>
              <span>비용 ₩{fmt(r.monthly_cost)}</span>
              <span className={r.monthly_profit >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                순이익 ₩{fmt(r.monthly_profit)}
              </span>
              <span>이익률 {r.profit_rate}%</span>
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            진단 데이터가 없습니다
          </div>
        )}
      </div>
      {showManual && <OperationManual page="diagnosis" onClose={() => setShowManual(false)} />}
    </div>
  );
}

/* ─── 상세 뷰 ─────────────────────────────────────────────── */

function DetailView({ detail, selectedEngine, setSelectedEngine, onBack }: {
  detail: DiagnosisResult;
  selectedEngine: string;
  setSelectedEngine: (e: string) => void;
  onBack: () => void;
}) {
  const engine = detail.engines.find((e) => e.engine === selectedEngine);

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-5">
        <button onClick={onBack} className="mb-2 text-sm text-blue-600 hover:underline">&larr; 전체 목록</button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center rounded border px-2.5 py-1 text-lg font-bold ${GRADE_CFG[detail.overall_grade] || ""}`}>
                {detail.overall_grade}
              </span>
              <h1 className="text-2xl font-bold text-gray-900">{detail.property_name}</h1>
              <span className="text-sm text-gray-400">{detail.property_code}</span>
            </div>
            <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-4 py-2.5">
              <p className="text-sm font-semibold text-red-800">{detail.headline}</p>
              <p className="text-xs text-red-600 mt-0.5">{detail.root_cause}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold text-gray-900">{detail.overall_score}</p>
            <p className="text-xs text-gray-400">종합 점수</p>
          </div>
        </div>
      </div>

      {/* 재무 요약 카드 */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <FinCard label="월 매출" value={`₩${fmt(detail.monthly_revenue)}`} />
        <FinCard label="월 비용" value={`₩${fmt(detail.monthly_cost)}`} />
        <FinCard label="순이익" value={`₩${fmt(detail.monthly_profit)}`} tone={detail.monthly_profit >= 0 ? "green" : "red"} />
        <FinCard label="이익률" value={`${detail.profit_rate}%`} tone={detail.profit_rate >= 0 ? "green" : "red"} />
        <FinCard label="BEP 가동률" value={`${detail.break_even_occupancy}%`} tone={detail.break_even_occupancy <= 70 ? "green" : "amber"} />
      </div>

      {/* 5엔진 탭 */}
      <div className="mb-4 flex gap-2">
        {detail.engines.map((e) => {
          const cfg = STATUS_CFG[e.status] || STATUS_CFG.warning;
          const active = selectedEngine === e.engine;
          return (
            <button
              key={e.engine}
              onClick={() => setSelectedEngine(e.engine)}
              className={`flex-1 rounded-lg border-2 px-3 py-3 text-center transition-all ${
                active ? `${cfg.bg} ${cfg.border} shadow-md` : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-[11px] text-gray-500">{e.label}</p>
              <p className={`text-xl font-bold ${active ? cfg.text : "text-gray-700"}`}>{e.score.toFixed(0)}</p>
              <p className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* 선택된 엔진 상세 */}
      {engine && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* 세부 지표 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">세부 지표</h3>
            <div className="space-y-2.5">
              {Object.entries(engine.details)
                .filter(([k]) => !["monthly_cost", "profit", "profit_rate", "break_even_occupancy"].includes(k))
                .map(([key, val]) => {
                  const isBottleneck = key === engine.bottleneck;
                  const numVal = typeof val === "number" ? val : 0;
                  const isPercent = key.includes("rate") || key.includes("occupancy");
                  const isMoney = key.includes("revenue") || key.includes("rent") || key.includes("fee") || key.includes("cost");
                  const display = isMoney ? `₩${fmt(numVal)}` : isPercent ? `${numVal}%` : String(numVal);
                  const barWidth = isMoney ? 0 : Math.min(Math.abs(numVal), 100);

                  return (
                    <div key={key} className={`flex items-center gap-3 rounded-md px-3 py-2 ${isBottleneck ? "bg-red-50 ring-1 ring-red-200" : "bg-gray-50"}`}>
                      <div className="w-28 text-xs text-gray-600 flex items-center gap-1.5">
                        {isBottleneck && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                        {DETAIL_LABELS[key] || key}
                      </div>
                      {!isMoney && (
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isBottleneck ? "bg-red-400" : numVal >= 70 ? "bg-emerald-400" : numVal >= 50 ? "bg-amber-400" : "bg-gray-400"}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}
                      {isMoney && <div className="flex-1" />}
                      <div className={`text-sm font-semibold w-24 text-right ${isBottleneck ? "text-red-600" : "text-gray-800"}`}>
                        {display}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 추천 액션 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">추천 실행 액션</h3>
            {engine.actions && engine.actions.length > 0 ? (
              <div className="space-y-2">
                {engine.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md bg-gray-50 border border-gray-100 p-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700">{action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">추천 액션이 없습니다</p>
            )}

            {/* 운영자 메모 */}
            {detail.note && (
              <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-xs font-medium text-yellow-800 mb-1">운영자 메모</p>
                <p className="text-sm text-yellow-700">{detail.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FinCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const cls = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
