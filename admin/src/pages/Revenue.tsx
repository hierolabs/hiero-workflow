import { useEffect, useState, useMemo } from "react";
import { apiRequest } from "../utils/api";

// --- Types ---
interface PeriodRevenue {
  period: string;
  revenue: number;
  commission: number;
  net: number;
  bookings: number;
  nights: number;
  adr: number;
}

interface ChannelRevenue {
  channel: string;
  revenue: number;
  commission: number;
  net: number;
  bookings: number;
  nights: number;
  adr: number;
  share: number;
}

interface RevenueData {
  start_date: string;
  end_date: string;
  group_by: string;
  total_revenue: number;
  total_commission: number;
  total_net: number;
  total_bookings: number;
  total_nights: number;
  avg_adr: number;
  periods: PeriodRevenue[];
  channels: ChannelRevenue[];
}

type GroupBy = "day" | "week" | "month";
type Preset = "7d" | "30d" | "90d" | "this_month" | "last_month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "최근 7일" },
  { key: "30d", label: "최근 30일" },
  { key: "90d", label: "최근 90일" },
  { key: "this_month", label: "이번 달" },
  { key: "last_month", label: "지난 달" },
  { key: "custom", label: "직접 선택" },
];

function getPresetDates(preset: Preset): { start: string; end: string; group: GroupBy } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case "7d":
      return { start: fmt(new Date(now.getTime() - 6 * 86400000)), end: fmt(now), group: "day" };
    case "30d":
      return { start: fmt(new Date(now.getTime() - 29 * 86400000)), end: fmt(now), group: "day" };
    case "90d":
      return { start: fmt(new Date(now.getTime() - 89 * 86400000)), end: fmt(now), group: "week" };
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(s), end: fmt(now), group: "day" };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(s), end: fmt(e), group: "day" };
    }
    default:
      return { start: fmt(new Date(now.getTime() - 29 * 86400000)), end: fmt(now), group: "day" };
  }
}

const krw = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

// --- Component ---
export default function Revenue() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  // 프리셋 변경 시 날짜 자동 설정
  useEffect(() => {
    if (preset !== "custom") {
      const { start, end, group } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
      setGroupBy(group);
    }
  }, [preset]);

  // 데이터 fetch
  useEffect(() => {
    if (!startDate || !endDate) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiRequest(
          `/revenue/summary?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`
        );
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [startDate, endDate, groupBy]);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">매출 현황</h1>
        <p className="mt-0.5 text-sm text-gray-500">일별 / 주별 / 월별 매출·수수료·순수익 추이</p>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Preset buttons */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === p.key
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {/* Group by */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(["day", "week", "month"] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                groupBy === g
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {{ day: "일별", week: "주별", month: "월별" }[g]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">불러오는 중...</div>
      ) : !data ? (
        <div className="py-20 text-center text-gray-400">데이터가 없습니다</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard label="총 매출" value={`₩${krw(data.total_revenue)}`} />
            <KpiCard label="수수료" value={`₩${krw(data.total_commission)}`} sub />
            <KpiCard label="순수익" value={`₩${krw(data.total_net)}`} highlight />
            <KpiCard label="예약 건수" value={`${krw(data.total_bookings)}건`} />
            <KpiCard label="평균 ADR" value={`₩${krw(data.avg_adr)}`} />
          </div>

          {/* Chart */}
          <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">매출 추이</h2>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" /> 매출
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" /> 순수익
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-red-300" /> 수수료
                </span>
              </div>
            </div>
            <BarChart periods={data.periods} groupBy={groupBy} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Period Table */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-3">
                <h2 className="text-sm font-bold text-gray-900">
                  {{ day: "일별", week: "주별", month: "월별" }[groupBy]} 상세
                </h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">기간</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">매출</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">수수료</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">순수익</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">건수</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.periods.map((p) => (
                      <tr key={p.period} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          <PeriodLabel period={p.period} groupBy={groupBy} />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">₩{krw(p.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-500">-₩{krw(p.commission)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600">₩{krw(p.net)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{p.bookings}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">₩{krw(p.adr)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data.periods.length > 0 && (
                    <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-gray-900">합계</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900">₩{krw(data.total_revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-500">-₩{krw(data.total_commission)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-emerald-600">₩{krw(data.total_net)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-500">{data.total_bookings}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-500">₩{krw(data.avg_adr)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Channel Breakdown */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-3">
                <h2 className="text-sm font-bold text-gray-900">채널별 매출</h2>
              </div>
              <div className="p-5 space-y-3">
                {data.channels.map((c) => (
                  <ChannelBar key={c.channel} channel={c} maxRevenue={data.channels[0]?.revenue || 1} />
                ))}
                {data.channels.length === 0 && (
                  <p className="py-8 text-center text-gray-400">채널 데이터가 없습니다</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub Components ---

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${highlight ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${sub ? "text-red-500" : highlight ? "text-emerald-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function PeriodLabel({ period, groupBy }: { period: string; groupBy: string }) {
  if (groupBy === "month") {
    const [y, m] = period.split("-");
    return <>{y}년 {parseInt(m)}월</>;
  }
  if (groupBy === "week") {
    const d = new Date(period + "T00:00:00");
    const end = new Date(d.getTime() + 6 * 86400000);
    const fm = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`;
    return <>{fm(d)} ~ {fm(end)}</>;
  }
  // day
  const d = new Date(period + "T00:00:00");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return <>{d.getMonth() + 1}/{d.getDate()} ({weekday})</>;
}

function BarChart({ periods, groupBy }: { periods: PeriodRevenue[]; groupBy: string }) {
  const maxVal = useMemo(() => Math.max(...periods.map(p => p.revenue), 1), [periods]);

  if (periods.length === 0) {
    return <div className="flex h-48 items-center justify-center text-gray-400">데이터가 없습니다</div>;
  }

  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: 200 }}>
      {periods.map((p) => {
        const revH = (p.revenue / maxVal) * 160;
        const netH = (p.net / maxVal) * 160;
        const commH = (p.commission / maxVal) * 160;

        return (
          <div key={p.period} className="group relative flex flex-col items-center" style={{ minWidth: periods.length > 31 ? 14 : 28 }}>
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block whitespace-nowrap">
              <p className="font-semibold">{p.period}</p>
              <p>매출: ₩{krw(p.revenue)}</p>
              <p>순수익: ₩{krw(p.net)}</p>
              <p>{p.bookings}건 · ADR ₩{krw(p.adr)}</p>
            </div>
            {/* Bars */}
            <div className="flex items-end gap-px">
              <div
                className="rounded-t-sm bg-blue-400 group-hover:bg-blue-500 transition-colors"
                style={{ height: Math.max(revH, 2), width: periods.length > 31 ? 5 : 8 }}
              />
              <div
                className="rounded-t-sm bg-emerald-400 group-hover:bg-emerald-500 transition-colors"
                style={{ height: Math.max(netH, 2), width: periods.length > 31 ? 5 : 8 }}
              />
            </div>
            {/* Label */}
            {periods.length <= 31 && (
              <div className="mt-1 text-[9px] text-gray-400 tabular-nums leading-tight text-center" style={{ width: 28 }}>
                <PeriodShort period={p.period} groupBy={groupBy} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PeriodShort({ period, groupBy }: { period: string; groupBy: string }) {
  if (groupBy === "month") {
    return <>{period.slice(5)}월</>;
  }
  if (groupBy === "week") {
    const d = new Date(period + "T00:00:00");
    return <>{d.getMonth() + 1}/{d.getDate()}</>;
  }
  const d = new Date(period + "T00:00:00");
  return <>{d.getDate()}</>;
}

const CHANNEL_COLORS: Record<string, string> = {
  airbnb: "bg-red-500",
  Airbnb: "bg-red-500",
  "booking.com": "bg-blue-600",
  Booking: "bg-blue-600",
  agoda: "bg-purple-500",
  Agoda: "bg-purple-500",
};

function ChannelBar({ channel, maxRevenue }: { channel: ChannelRevenue; maxRevenue: number }) {
  const barColor = CHANNEL_COLORS[channel.channel] || "bg-gray-500";
  const pct = (channel.revenue / maxRevenue) * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{channel.channel}</span>
          <span className="text-xs text-gray-400">{channel.bookings}건 · {channel.nights}박</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold tabular-nums text-gray-900">₩{krw(channel.revenue)}</span>
          <span className="ml-2 text-xs tabular-nums text-gray-400">{channel.share.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-gray-400 tabular-nums">
        <span>수수료 ₩{krw(channel.commission)}</span>
        <span>순수익 ₩{krw(channel.net)}</span>
        <span>ADR ₩{krw(channel.adr)}</span>
      </div>
    </div>
  );
}
