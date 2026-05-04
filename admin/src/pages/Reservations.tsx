import { useEffect, useState, useCallback } from "react";
import OperationManual from "../components/OperationManual";
import {
  fetchReservations,
  STATUS_LABELS,
  STATUS_STYLES,
  CHANNEL_LABELS,
  type Reservation,
  type ReservationListQuery,
} from "../utils/reservation-api";
import ReservationDetailModal from "../components/ReservationDetailModal";
import MultiSelect from "../components/MultiSelect";

type ViewMode = "booked" | "checkin" | "checkout" | "extension" | "cancelled";
type PeriodPreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "this_week": {
      const s = startOfWeek(new Date(now));
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { from: fmt(s), to: fmt(e) };
    }
    case "last_week": {
      const s = startOfWeek(new Date(now)); s.setDate(s.getDate() - 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { from: fmt(s), to: fmt(e) };
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "this_quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const s = new Date(now.getFullYear(), qStart, 1);
      const e = new Date(now.getFullYear(), qStart + 3, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "last_quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3 - 3;
      const y = qStart < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const q = qStart < 0 ? qStart + 12 : qStart;
      const s = new Date(y, q, 1);
      const e = new Date(y, q + 3, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "this_year": {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31);
      return { from: fmt(s), to: fmt(e) };
    }
    case "last_year": {
      const s = new Date(now.getFullYear() - 1, 0, 1);
      const e = new Date(now.getFullYear() - 1, 11, 31);
      return { from: fmt(s), to: fmt(e) };
    }
    default:
      return { from: fmt(now), to: fmt(now) };
  }
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sumRate, setSumRate] = useState(0);
  const [sumNights, setSumNights] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("booked");
  const [period, setPeriod] = useState<PeriodPreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [selectedResId, setSelectedResId] = useState<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 숙소/채널 필터 (다중 선택)
  const [filterPropIds, setFilterPropIds] = useState<string[]>([]);
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [propOptions, setPropOptions] = useState<{ id: number; name: string }[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);

  const buildQuery = useCallback((): ReservationListQuery => {
    const range = period === "custom"
      ? { from: customFrom, to: customTo }
      : getDateRange(period);

    const q: ReservationListQuery = {
      page,
      page_size: 30,
      keyword: keyword || undefined,
    };

    if (viewMode === "booked") {
      q.booked_from = range.from;
      q.booked_to = range.to;
    } else if (viewMode === "checkin") {
      q.check_in_from = range.from;
      q.check_in_to = range.to;
    } else if (viewMode === "checkout") {
      q.check_out_from = range.from;
      q.check_out_to = range.to;
    } else if (viewMode === "extension") {
      q.check_in_from = range.from;
      q.check_in_to = range.to;
    } else if (viewMode === "cancelled") {
      q.status = "cancelled";
      q.check_in_from = range.from;
      q.check_in_to = range.to;
    }

    if (filterPropIds.length > 0) q.internal_prop_ids = filterPropIds.join(",");
    if (filterChannels.length > 0) q.channel_type = filterChannels.join(",");
    if (sortBy) { q.sort_by = sortBy; q.sort_order = sortOrder; }
    (q as Record<string, unknown>).view_mode = viewMode;
    return q;
  }, [viewMode, period, customFrom, customTo, page, keyword, filterPropIds, filterChannels, sortBy, sortOrder]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReservations(buildQuery());
      setReservations(data.reservations || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setSumRate(data.sum_rate || 0);
      setSumNights(data.sum_nights || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  // 숙소/채널 옵션 로드
  useEffect(() => {
    const token = localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL;
    Promise.all([
      fetch(`${API_URL}/properties?page_size=200`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/transactions/channels`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([propData, chData]) => {
      if (propData) {
        const list = (propData.properties || []).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }));
        setPropOptions(list.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)));
      }
      if (chData) setChannelOptions(chData || []);
    });
  }, []);

  // 각 탭별 카운트 로드
  useEffect(() => {
    const range = period === "custom"
      ? { from: customFrom, to: customTo }
      : getDateRange(period);
    if (!range.from || !range.to) return;

    const token = localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL;
    const modes = ["booked", "checkin", "checkout", "extension", "cancelled"] as const;

    Promise.all(modes.map(async (m) => {
      const params = new URLSearchParams({ page: "1", page_size: "1", view_mode: m });
      if (m === "booked") { params.set("booked_from", range.from); params.set("booked_to", range.to); }
      else if (m === "checkin") { params.set("check_in_from", range.from); params.set("check_in_to", range.to); }
      else if (m === "checkout") { params.set("check_out_from", range.from); params.set("check_out_to", range.to); }
      else if (m === "extension") { params.set("check_in_from", range.from); params.set("check_in_to", range.to); }
      else { params.set("status", "cancelled"); params.set("check_in_from", range.from); params.set("check_in_to", range.to); }
      const res = await fetch(`${API_URL}/reservations?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); return { mode: m, count: d.total || 0 }; }
      return { mode: m, count: 0 };
    })).then((results) => {
      const counts: Record<string, number> = {};
      results.forEach((r) => { counts[r.mode] = r.count; });
      setViewCounts(counts);
    });
  }, [period, customFrom, customTo]);

  const handleViewChange = (v: ViewMode) => { setViewMode(v); setPage(1); };
  const handlePeriodChange = (p: PeriodPreset) => { setPeriod(p); setPage(1); };
  const handleSort = (col: string) => {
    if (sortBy === col) {
      if (sortOrder === "desc") setSortOrder("asc");
      else { setSortBy(""); setSortOrder("desc"); } // 3rd click: reset
    } else {
      setSortBy(col); setSortOrder("desc");
    }
    setPage(1);
  };

  const formatWon = (value: number) => value.toLocaleString("ko-KR") + "원";
  const getChannelLabel = (r: Reservation) => {
    if (r.channel_name && r.channel_name !== r.channel_type) return r.channel_name;
    return CHANNEL_LABELS[r.channel_type] || r.channel_type;
  };
  const getChannelStyle = (channelType: string) => {
    const styles: Record<string, string> = {
      airbnb: "bg-rose-100 text-rose-800",
      "booking.com": "bg-blue-100 text-blue-800",
      agoda: "bg-indigo-100 text-indigo-800",
    };
    return styles[channelType] || "bg-gray-100 text-gray-700";
  };

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: "booked", label: "예약" },
    { value: "checkin", label: "체크인" },
    { value: "checkout", label: "체크아웃" },
    { value: "extension", label: "연장" },
    { value: "cancelled", label: "취소" },
  ];

  const periodPresets: { value: PeriodPreset; label: string }[] = [
    { value: "today", label: "오늘" },
    { value: "yesterday", label: "어제" },
    { value: "this_week", label: "이번주" },
    { value: "last_week", label: "지난주" },
    { value: "this_month", label: "이번달" },
    { value: "last_month", label: "지난달" },
    { value: "this_quarter", label: "이번 분기" },
    { value: "last_quarter", label: "지난 분기" },
    { value: "this_year", label: "올해" },
    { value: "last_year", label: "작년" },
    { value: "custom", label: "기간설정" },
  ];

  return (
    <div>
      {showManual && <OperationManual page="reservations" onClose={() => setShowManual(false)} />}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-gray-900">예약 관리</h1>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">운영 매뉴얼</button>
      </div>
      <div className="mb-4">
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">총 <strong className="text-gray-900">{total}건</strong></span>
          <span className="text-gray-500">총 <strong className="text-gray-900">{sumNights.toLocaleString()}박</strong></span>
          <span className="text-gray-500">매출 <strong className="text-blue-600">{sumRate.toLocaleString("ko-KR")}원</strong></span>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="mb-3 flex gap-1">
        {viewModes.map((m) => (
          <button
            key={m.value}
            onClick={() => handleViewChange(m.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              viewMode === m.value
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {m.label}
            {viewCounts[m.value] != null && (
              <span className="ml-1 opacity-70">({viewCounts[m.value]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Period Presets */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {periodPresets.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {period === "custom" && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      )}

      {/* 숙소/채널 필터 + 검색 + 내보내기 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MultiSelect
          options={propOptions.map((p) => ({ value: String(p.id), label: p.name }))}
          selected={filterPropIds}
          onChange={(v) => { setFilterPropIds(v); setPage(1); }}
          placeholder="전체 숙소"
        />
        <MultiSelect
          options={channelOptions.map((ch) => ({ value: ch, label: ch }))}
          selected={filterChannels}
          onChange={(v) => { setFilterChannels(v); setPage(1); }}
          placeholder="전체 채널"
        />
        {(filterPropIds.length > 0 || filterChannels.length > 0) && (
          <button
            onClick={() => { setFilterPropIds([]); setFilterChannels([]); setPage(1); }}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            초기화
          </button>
        )}
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }}
          placeholder="예약코드, 게스트 이름..."
          className="block w-48 rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
        />
        <button
          onClick={() => {
            const range = period === "custom" ? { from: customFrom, to: customTo } : getDateRange(period);
            const token = localStorage.getItem("token");
            const API_URL = import.meta.env.VITE_API_URL;
            const params = new URLSearchParams({ start_date: range.from, end_date: range.to });
            fetch(`${API_URL}/reservations/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.blob())
              .then(blob => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `reservations_${range.from}_${range.to}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              });
          }}
          className="ml-auto rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          CSV 내보내기
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">로딩 중...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>숙소</Th>
                  <Th>예약코드</Th>
                  <SortTh col="guest_name" current={sortBy} order={sortOrder} onClick={handleSort}>게스트</SortTh>
                  <Th>채널</Th>
                  <SortTh col="check_in_date" current={sortBy} order={sortOrder} onClick={handleSort}>체크인</SortTh>
                  <SortTh col="check_out_date" current={sortBy} order={sortOrder} onClick={handleSort}>체크아웃</SortTh>
                  <SortTh col="nights" current={sortBy} order={sortOrder} onClick={handleSort}>박</SortTh>
                  <Th>상태</Th>
                  <SortTh col="total_rate" current={sortBy} order={sortOrder} onClick={handleSort}>매출</SortTh>
                  <SortTh col="booked_at" current={sortBy} order={sortOrder} onClick={handleSort}>예약일</SortTh>
                  {viewMode === "cancelled" && <Th>취소일</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === "cancelled" ? 11 : 10} className="px-6 py-12 text-center text-sm text-gray-400">
                      예약이 없습니다.
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedResId(r.id)}>
                      <Td>
                        <span className="text-xs font-medium text-gray-700 max-w-[150px] truncate block" title={r.property_name}>
                          {r.property_name || "-"}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">
                          {r.reservation_code.length > 12
                            ? r.reservation_code.slice(0, 12) + "..."
                            : r.reservation_code}
                        </span>
                      </Td>
                      <Td>
                        <p className="text-sm font-medium text-gray-900">{r.guest_name || "-"}</p>
                        {r.guest_phone && <p className="text-xs text-gray-400">{r.guest_phone}</p>}
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getChannelStyle(r.channel_type)}`}>
                          {getChannelLabel(r)}
                        </span>
                      </Td>
                      <Td>{r.check_in_date}</Td>
                      <Td>{r.check_out_date}</Td>
                      <Td>{r.nights}박</Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </Td>
                      <Td>{formatWon(r.total_rate)}</Td>
                      <Td>
                        <span className="text-xs text-gray-400">
                          {r.booked_at ? new Date(r.booked_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </span>
                      </Td>
                      {viewMode === "cancelled" && (
                        <Td>
                          <span className="text-xs text-red-500">
                            {r.cancelled_at ? new Date(r.cancelled_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </span>
                        </Td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
              <p className="text-sm text-gray-500">
                {total}건 중 {(page - 1) * 30 + 1}-{Math.min(page * 30, total)}
              </p>
              <div className="flex gap-1">
                <PgBtn disabled={page === 1} onClick={() => setPage(page - 1)}>이전</PgBtn>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - page) <= 2)
                  .map((p) => (
                    <PgBtn key={p} active={p === page} onClick={() => setPage(p)}>{p}</PgBtn>
                  ))}
                <PgBtn disabled={page === totalPages} onClick={() => setPage(page + 1)}>다음</PgBtn>
              </div>
            </div>
          )}
        </div>
      )}

      <ReservationDetailModal
        reservationId={selectedResId}
        onClose={() => setSelectedResId(null)}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400">{children}</th>;
}
function SortTh({ children, col, current, order, onClick }: { children: React.ReactNode; col: string; current: string; order: string; onClick: (col: string) => void }) {
  const active = current === col;
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium tracking-wider cursor-pointer select-none transition-colors ${active ? "text-slate-900 bg-gray-100" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
      onClick={() => onClick(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-[10px] ${active ? "text-blue-600" : "text-gray-300"}`}>
          {active ? (order === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{children}</td>;
}
function PgBtn({ children, active, disabled, onClick }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded px-3 py-1 text-sm font-medium transition-colors ${active ? "bg-slate-900 text-white" : disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-200"}`}>
      {children}
    </button>
  );
}
