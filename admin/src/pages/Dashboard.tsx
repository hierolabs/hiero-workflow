import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionDispatchModal, { type DispatchAction } from "../components/ActionDispatchModal";
import OperationManual from "../components/OperationManual";

const API_URL = import.meta.env.VITE_API_URL;
const PUBLIC_API_URL = API_URL.replace("/admin", "/api");

interface DiagItem {
  property_id: number;
  property_name: string;
  overall_score: number;
  overall_grade: string;
  weakest_engine: string;
  headline: string;
  engines: { engine: string; label: string; score: number; status: string }[];
}

interface Action {
  priority: string;
  type: string;
  title: string;
  detail: string;
  action: string;
  dispatch_target: string;
  dispatch_payload: Record<string, unknown>;
  property_ids?: number[];
}

interface VacantProperty {
  id: number;
  title: string;
  vacant_days: number;
  severity: string;
  action: string;
}

interface DashboardData {
  actions: Action[];
  revenue: {
    today_revenue: number;
    today_commission: number;
    today_net: number;
    daily_in_house: number;
  };
  risk: {
    vacant_count: number;
    critical_count: number;
    warning_count: number;
    vacant_properties: VacantProperty[];
    total_properties: number;
  };
  pricing: {
    avg_adr: number;
    target_adr: number;
    adr_gap_pct: string;
    channel_pricing: { channel: string; avg_adr: number; count: number; diff_pct: string }[];
  };
  growth: {
    today_new_bookings: number;
    upcoming_7d_bookings: number;
    channels: { channel: string; count: number; revenue: number }[];
  };
  metrics: {
    occupancy_rate: string;
    target_occupancy: string;
    avg_adr: number;
    check_in_count: number;
    check_out_count: number;
    in_house_count: number;
    total_properties: number;
  };
}

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dispatchAction, setDispatchAction] = useState<Action | null>(null);
  const [toast, setToast] = useState("");
  const [diagList, setDiagList] = useState<DiagItem[]>([]);
  const [showManual, setShowManual] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${PUBLIC_API_URL}/dashboard/ceo`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      // 사업진단 데이터 로드
      try {
        const token = localStorage.getItem("token");
        const diagRes = await fetch(`${API_URL}/diagnosis`, { headers: { Authorization: `Bearer ${token}` } });
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          setDiagList((diagData.results || []).slice(0, 5));
        }
      } catch { /* 진단 데이터 없어도 대시보드 정상 표시 */ }
    } catch {
      setError("대시보드 데이터를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (loading) return <Loading />;
  if (error) return <Error msg={error} />;
  if (!data) return null;

  const occGap = parseFloat(data.metrics.occupancy_rate) - parseFloat(data.metrics.target_occupancy);
  const adrGap = parseFloat(data.pricing.adr_gap_pct);

  const handleDispatchSuccess = (target: string) => {
    setDispatchAction(null);
    setToast("업무가 등록되었습니다");
    setTimeout(() => navigate(`/${target}`), 800);
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchAction && (
        <ActionDispatchModal
          action={dispatchAction as DispatchAction}
          onClose={() => setDispatchAction(null)}
          onSuccess={handleDispatchSuccess}
        />
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CEO Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManual(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
            운영 매뉴얼
          </button>
          <button onClick={fetch_} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
            새로고침
          </button>
        </div>
      </div>

      {/* 🔥 P0: 오늘 해야 할 액션 — 클릭하면 dispatch */}
      {data.actions.length > 0 && (
        <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-red-800 uppercase tracking-wider">오늘 해야 할 액션</h2>
            <span className="text-xs text-red-400">클릭하여 업무 등록</span>
          </div>
          <div className="space-y-2">
            {data.actions.map((a, i) => (
              <div
                key={i}
                onClick={() => a.dispatch_target && setDispatchAction(a)}
                className={`rounded-md p-3 transition-all ${
                  a.priority === "P0"
                    ? "bg-red-100 border border-red-200 hover:border-red-400 hover:shadow-md"
                    : "bg-orange-50 border border-orange-200 hover:border-orange-400 hover:shadow-md"
                } ${a.dispatch_target ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${a.priority === "P0" ? "bg-red-600 text-white" : "bg-orange-500 text-white"}`}>
                    {a.priority}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{a.detail}</p>
                    <p className="mt-1 text-xs font-medium text-blue-700">→ {a.action}</p>
                  </div>
                  {a.dispatch_target && (
                    <span className="mt-0.5 shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 uppercase">
                      {a.dispatch_target === "cleaning" ? "청소" : a.dispatch_target === "settlement" ? "정산" : "이슈"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상단 KPI: CEO 관점 (목표 대비) */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="가동률"
          value={`${data.metrics.occupancy_rate}%`}
          target={`목표 ${data.metrics.target_occupancy}%`}
          gap={occGap}
          gapLabel={`${occGap >= 0 ? "+" : ""}${occGap.toFixed(1)}%p`}
        />
        <KPICard
          label="평균 ADR"
          value={`₩${fmt(data.metrics.avg_adr)}`}
          target={`목표 ₩${fmt(data.pricing.target_adr)}`}
          gap={adrGap}
          gapLabel={`${adrGap >= 0 ? "+" : ""}${adrGap}%`}
        />
        <KPICard
          label="순 매출"
          value={`₩${fmt(data.revenue.today_net)}`}
          target={`수수료 ₩${fmt(data.revenue.today_commission)}`}
          plain
        />
        <KPICard
          label="공실"
          value={`${data.risk.vacant_count}개`}
          target={`위험 ${data.risk.critical_count}개`}
          gap={-data.risk.critical_count}
          gapLabel={data.risk.critical_count > 0 ? `${data.risk.critical_count}개 즉시 대응` : "정상"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 🔴 리스크: 정렬 + 며칠 공실 + 위험도 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">🔴 리스크</h2>
              <p className="text-xs text-gray-400">공실 {data.risk.vacant_count}개 / 전체 {data.risk.total_properties}개</p>
            </div>
            {data.risk.critical_count > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                위험 {data.risk.critical_count}
              </span>
            )}
          </div>

          {data.risk.vacant_count === 0 ? (
            <p className="text-sm text-green-600">모든 숙소 가동 중</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {data.risk.vacant_properties.slice(0, 20).map((p) => (
                <div key={p.id} className={`flex items-center justify-between rounded-md px-3 py-2 ${
                  p.severity === "critical" ? "bg-red-50 border border-red-200" :
                  p.severity === "warning" ? "bg-orange-50 border border-orange-200" :
                  "bg-gray-50 border border-gray-100"
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.action}</p>
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <span className={`text-sm font-bold ${
                      p.severity === "critical" ? "text-red-600" :
                      p.severity === "warning" ? "text-orange-600" :
                      "text-gray-500"
                    }`}>
                      {p.vacant_days}일
                    </span>
                    <p className="text-xs text-gray-400">공실</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 💲 가격 컨트롤 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900">💲 가격 컨트롤</h2>
            <p className="text-xs text-gray-400">Pricing Control</p>
          </div>

          {/* ADR 게이지 */}
          <div className="mb-4 rounded-md bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">평균 ADR</span>
              <span className={`text-xs font-bold ${adrGap >= 0 ? "text-green-600" : "text-red-600"}`}>
                목표 대비 {adrGap >= 0 ? "+" : ""}{adrGap}%
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">₩{fmt(data.metrics.avg_adr)}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ 목표 ₩{fmt(data.pricing.target_adr)}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full ${adrGap >= 0 ? "bg-green-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, (data.metrics.avg_adr / data.pricing.target_adr) * 100)}%` }}
              />
            </div>
          </div>

          {/* 채널별 ADR */}
          {data.pricing.channel_pricing.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase">채널별 ADR 비교</p>
              <div className="space-y-1.5">
                {data.pricing.channel_pricing.map((cp) => (
                  <div key={cp.channel} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={cp.channel} />
                      <span className="text-xs text-gray-500">{cp.count}건</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">₩{fmt(cp.avg_adr)}</span>
                      <span className={`ml-2 text-xs font-bold ${parseFloat(cp.diff_pct) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {parseFloat(cp.diff_pct) >= 0 ? "+" : ""}{cp.diff_pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 💰 매출 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900">💰 매출</h2>
            <p className="text-xs text-gray-400">Revenue Reality</p>
          </div>
          <div className="space-y-3">
            <Row label="체크인 매출 (총)" value={`₩${fmt(data.revenue.today_revenue)}`} />
            <Row label="수수료" value={`-₩${fmt(data.revenue.today_commission)}`} sub />
            <div className="border-t border-gray-200 pt-3">
              <Row label="순 매출" value={`₩${fmt(data.revenue.today_net)}`} bold />
            </div>
            <div className="border-t border-gray-100 pt-3">
              <Row label="일일 투숙 매출 (ADR 합계)" value={`₩${fmt(data.revenue.daily_in_house)}`} muted />
              <p className="mt-1 text-xs text-gray-400">현재 투숙 중인 {data.metrics.in_house_count}실의 하루 매출 합계</p>
            </div>
          </div>
        </div>

        {/* 📈 성장 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900">📈 성장</h2>
            <p className="text-xs text-gray-400">Growth Signal</p>
          </div>
          <div className="mb-4 flex gap-3">
            <div className="flex-1 rounded-md bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{data.growth.today_new_bookings}</p>
              <p className="text-xs text-blue-500">오늘 신규</p>
            </div>
            <div className="flex-1 rounded-md bg-slate-50 p-3 text-center">
              <p className="text-2xl font-bold text-slate-700">{data.growth.upcoming_7d_bookings}</p>
              <p className="text-xs text-slate-500">7일 체크인</p>
            </div>
            <div className="flex-1 rounded-md bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{data.metrics.in_house_count}</p>
              <p className="text-xs text-green-500">현재 투숙</p>
            </div>
          </div>

          {data.growth.channels.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase">채널별 신규 예약</p>
              <div className="space-y-1.5">
                {data.growth.channels.map((ch) => (
                  <div key={ch.channel} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={ch.channel} />
                      <span className="text-sm text-gray-700">{ch.count}건</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">₩{fmt(ch.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">오늘 신규 예약이 없습니다</p>
          )}
        </div>
      </div>

      {/* 🏥 숙소 사업 진단 */}
      {diagList.length > 0 && (
        <div className="mt-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">숙소 사업 진단</h2>
              <p className="text-xs text-gray-400">5엔진 기준 · 점수 낮은 순</p>
            </div>
            <button
              onClick={() => navigate("/diagnosis")}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              전체 보기
            </button>
          </div>
          <div className="space-y-2">
            {diagList.map((d) => (
              <div
                key={d.property_id}
                onClick={() => navigate(`/diagnosis?id=${d.property_id}`)}
                className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <span className={`shrink-0 rounded border px-2 py-0.5 text-sm font-bold ${
                  d.overall_grade === "S" ? "bg-violet-100 text-violet-700 border-violet-300" :
                  d.overall_grade === "A" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                  d.overall_grade === "B" ? "bg-blue-100 text-blue-700 border-blue-300" :
                  d.overall_grade === "C" ? "bg-amber-100 text-amber-700 border-amber-300" :
                  "bg-red-100 text-red-700 border-red-300"
                }`}>
                  {d.overall_grade}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.property_name}</p>
                  <p className="text-xs text-gray-500 truncate">{d.headline}</p>
                </div>
                <div className="hidden sm:flex gap-1">
                  {d.engines.map((e) => (
                    <span key={e.engine} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      e.status === "healthy" ? "bg-emerald-50 text-emerald-700" :
                      e.status === "warning" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      {e.label} {e.score.toFixed(0)}
                    </span>
                  ))}
                </div>
                <span className={`shrink-0 text-lg font-bold ${
                  d.overall_score >= 65 ? "text-gray-900" : d.overall_score >= 40 ? "text-amber-600" : "text-red-600"
                }`}>
                  {d.overall_score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- 컴포넌트 ---- */

function KPICard({ label, value, target, gap, gapLabel, plain }: {
  label: string; value: string; target: string; gap?: number; gapLabel?: string; plain?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-400">{target}</span>
        {!plain && gapLabel && (
          <span className={`text-xs font-bold ${(gap ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
            {gapLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, sub, muted }: {
  label: string; value: string; bold?: boolean; sub?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? "text-gray-400" : "text-gray-600"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-gray-900" : sub ? "text-red-600" : muted ? "text-gray-400" : "font-medium text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const c: Record<string, string> = {
    Airbnb: "bg-red-100 text-red-700", airbnb: "bg-red-100 text-red-700",
    "booking.com": "bg-blue-100 text-blue-700", Booking: "bg-blue-100 text-blue-700",
    agoda: "bg-purple-100 text-purple-700", Agoda: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c[channel] || "bg-gray-100 text-gray-700"}`}>
      {channel}
    </span>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-20"><p className="text-gray-500">호스텍스에서 데이터를 불러오는 중...</p></div>;
}

function Error({ msg }: { msg: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</div>;
}
