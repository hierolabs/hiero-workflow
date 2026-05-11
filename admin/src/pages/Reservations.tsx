import { useEffect, useState, useCallback, useMemo } from "react";
import OperationManual from "../components/OperationManual";
import AiAgentPanel from "../components/AiAgentPanel";
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
import AiChat from "../components/AiChat";
import GuestList from "../components/GuestList";

type PageTab = "reservations" | "guests";
type ViewMode = "booked" | "checkin" | "checkout" | "extension" | "cancelled";
type PeriodPreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

// 네비게이션 가능한 preset 그룹
type NavGroup = "day" | "week" | "month" | "quarter" | "year" | null;

function getNavGroup(preset: PeriodPreset): NavGroup {
  if (preset === "today" || preset === "yesterday") return "day";
  if (preset === "this_week" || preset === "last_week") return "week";
  if (preset === "this_month" || preset === "last_month") return "month";
  if (preset === "this_quarter" || preset === "last_quarter") return "quarter";
  if (preset === "this_year" || preset === "last_year") return "year";
  return null;
}

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

function getDateRangeWithOffset(group: NavGroup, offset: number): { from: string; to: string } {
  const now = new Date();

  switch (group) {
    case "day": {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return { from: fmt(d), to: fmt(d) };
    }
    case "week": {
      const s = startOfWeek(new Date(now));
      s.setDate(s.getDate() + offset * 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { from: fmt(s), to: fmt(e) };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "quarter": {
      const curQ = Math.floor(now.getMonth() / 3);
      const totalQ = curQ + offset;
      const y = now.getFullYear() + Math.floor(totalQ / 4);
      const q = ((totalQ % 4) + 4) % 4;
      const s = new Date(y, q * 3, 1);
      const e = new Date(y, q * 3 + 3, 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "year": {
      const y = now.getFullYear() + offset;
      return { from: fmt(new Date(y, 0, 1)), to: fmt(new Date(y, 11, 31)) };
    }
    default:
      return { from: fmt(now), to: fmt(now) };
  }
}

function getNavLabel(group: NavGroup, offset: number): string {
  const now = new Date();
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  switch (group) {
    case "day": {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      const dayLabel = offset === 0 ? " (오늘)" : offset === -1 ? " (어제)" : "";
      return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}${dayLabel}`;
    }
    case "week": {
      const s = startOfWeek(new Date(now));
      s.setDate(s.getDate() + offset * 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      const label = offset === 0 ? " (이번주)" : offset === -1 ? " (지난주)" : "";
      return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}${label}`;
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const label = offset === 0 ? " (이번달)" : offset === -1 ? " (지난달)" : "";
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월${label}`;
    }
    case "quarter": {
      const curQ = Math.floor(now.getMonth() / 3);
      const totalQ = curQ + offset;
      const y = now.getFullYear() + Math.floor(totalQ / 4);
      const q = ((totalQ % 4) + 4) % 4 + 1;
      const label = offset === 0 ? " (이번)" : offset === -1 ? " (지난)" : "";
      return `${y}년 Q${q}${label}`;
    }
    case "year": {
      const y = now.getFullYear() + offset;
      const label = offset === 0 ? " (올해)" : offset === -1 ? " (작년)" : "";
      return `${y}년${label}`;
    }
    default:
      return "";
  }
}

// 기존 호환용
function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const group = getNavGroup(preset);
  if (!group) return { from: fmt(new Date()), to: fmt(new Date()) };
  const offsetMap: Record<string, number> = {
    today: 0, yesterday: -1,
    this_week: 0, last_week: -1,
    this_month: 0, last_month: -1,
    this_quarter: 0, last_quarter: -1,
    this_year: 0, last_year: -1,
  };
  return getDateRangeWithOffset(group, offsetMap[preset] ?? 0);
}

export default function Reservations() {
  const [pageTab, setPageTab] = useState<PageTab>("reservations");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sumRate, setSumRate] = useState(0);
  const [sumNights, setSumNights] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("booked");
  const [period, setPeriod] = useState<PeriodPreset>("today");
  const [navOffset, setNavOffset] = useState(0); // 날짜 네비게이션 오프셋
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [selectedResId, setSelectedResId] = useState<number | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 숙소/채널 필터 (다중 선택)
  const [filterPropIds, setFilterPropIds] = useState<string[]>([]);
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [propOptions, setPropOptions] = useState<{ id: number; name: string; display_name?: string }[]>([]);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);

  const buildQuery = useCallback((): ReservationListQuery => {
    const navGroup = getNavGroup(period);
    const range = period === "custom"
      ? { from: customFrom, to: customTo }
      : navGroup
        ? getDateRangeWithOffset(navGroup, navOffset)
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
  }, [viewMode, period, navOffset, customFrom, customTo, page, keyword, filterPropIds, filterChannels, sortBy, sortOrder]);

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
        const list = (propData.properties || []).map((p: { id: number; name: string; display_name?: string }) => ({ id: p.id, name: p.display_name || p.name }));
        setPropOptions(list.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)));
      }
      if (chData) setChannelOptions(chData || []);
    });
  }, []);

  // 각 탭별 카운트 로드
  useEffect(() => {
    const navGroup = getNavGroup(period);
    const range = period === "custom"
      ? { from: customFrom, to: customTo }
      : navGroup
        ? getDateRangeWithOffset(navGroup, navOffset)
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
  }, [period, navOffset, customFrom, customTo]);

  const handleViewChange = (v: ViewMode) => { setViewMode(v); setPage(1); };
  const handlePeriodChange = (p: PeriodPreset) => {
    setPeriod(p);
    // preset 매핑: "어제" → day -1, "지난주" → week -1 등
    const presetOffsets: Partial<Record<PeriodPreset, number>> = {
      today: 0, yesterday: -1,
      this_week: 0, last_week: -1,
      this_month: 0, last_month: -1,
      this_quarter: 0, last_quarter: -1,
      this_year: 0, last_year: -1,
    };
    setNavOffset(presetOffsets[p] ?? 0);
    setPage(1);
  };
  const handleSort = (col: string) => {
    if (sortBy === col) {
      if (sortOrder === "desc") setSortOrder("asc");
      else { setSortBy(""); setSortOrder("desc"); } // 3rd click: reset
    } else {
      setSortBy(col); setSortOrder("desc");
    }
    setPage(1);
  };

  const aiContext = useMemo(() => {
    const navGroup = getNavGroup(period);
    const range = period === "custom"
      ? { from: customFrom, to: customTo }
      : navGroup
        ? getDateRangeWithOffset(navGroup, navOffset)
        : getDateRange(period);
    return {
      page: "reservations",
      view_mode: viewMode,
      period,
      date_from: range.from,
      date_to: range.to,
      total,
      sum_rate: sumRate,
      sum_nights: sumNights,
    };
  }, [viewMode, period, navOffset, customFrom, customTo, total, sumRate, sumNights]);

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

  const periodGroups: { group: NavGroup; label: string; presets: PeriodPreset[] }[] = [
    { group: "day", label: "일", presets: ["today", "yesterday"] },
    { group: "week", label: "주", presets: ["this_week", "last_week"] },
    { group: "month", label: "월", presets: ["this_month", "last_month"] },
    { group: "quarter", label: "분기", presets: ["this_quarter", "last_quarter"] },
    { group: "year", label: "년", presets: ["this_year", "last_year"] },
  ];
  const activeNavGroup = getNavGroup(period);
  const navLabel = activeNavGroup ? getNavLabel(activeNavGroup, navOffset) : "";

  return (
    <div>
      {showManual && <OperationManual page="reservations" onClose={() => setShowManual(false)} />}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-gray-900">예약 관리</h1>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">히로가이드</button>
      </div>

      {/* 상위 탭: 예약 목록 / 게스트 */}
      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setPageTab("reservations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            pageTab === "reservations" ? "border-slate-900 text-slate-900" : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          예약 목록
        </button>
        <button
          onClick={() => setPageTab("guests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            pageTab === "guests" ? "border-slate-900 text-slate-900" : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          게스트 내역
        </button>
      </div>

      {pageTab === "guests" ? (
        <GuestList />
      ) : (
      <>
      {/* 1줄: ViewMode + 통계 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {viewModes.map((m) => (
          <button key={m.value} onClick={() => handleViewChange(m.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === m.value ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >{m.label}{viewCounts[m.value] != null && <span className="ml-1 opacity-60">{viewCounts[m.value]}</span>}</button>
        ))}
        <span className="ml-auto text-sm text-gray-500">{total}건 · {sumNights.toLocaleString()}박 · <span className="text-blue-600 font-medium">{sumRate.toLocaleString("ko-KR")}원</span></span>
      </div>
      {/* 2줄: Period + Navigator */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {periodGroups.map((g) => (
          <button key={g.group} onClick={() => handlePeriodChange(g.presets[0])}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeNavGroup === g.group ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
          >{g.label}</button>
        ))}
        <button onClick={() => handlePeriodChange("custom")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${period === "custom" ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
        >기간</button>
        {activeNavGroup && (<>
          <span className="mx-1 text-gray-300">|</span>
          <button onClick={() => { setNavOffset((o) => o - 1); setPage(1); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 text-base">‹</button>
          <button onClick={() => { setNavOffset(0); setPage(1); }} className="px-2 py-1 text-sm font-semibold text-gray-700 hover:text-blue-600 min-w-[120px] text-center">{navLabel}</button>
          <button onClick={() => { setNavOffset((o) => o + 1); setPage(1); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 text-base">›</button>
        </>)}
        {period === "custom" && (<>
          <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
          <span className="text-gray-400">~</span>
          <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </>)}
      </div>

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MultiSelect
          options={propOptions.map((p) => ({ value: String(p.id), label: p.display_name || p.name }))}
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
        <AiChatToggle open={aiOpen} onClick={() => setAiOpen(!aiOpen)} />
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
                  <Th info="Hostex에 등록된 숙소명. 미매칭 시 '-' 표시">숙소</Th>
                  <Th info="OTA 플랫폼에서 발급된 예약 고유 코드">예약코드</Th>
                  <SortTh col="guest_name" current={sortBy} order={sortOrder} onClick={handleSort} info="게스트 이름과 연락처. 클릭 시 이름순 정렬">게스트</SortTh>
                  <Th info="예약이 들어온 OTA 채널 (Airbnb, Booking.com 등)">채널</Th>
                  <SortTh col="check_in_date" current={sortBy} order={sortOrder} onClick={handleSort} info="게스트 입실일. 보통 15:00~16:00 체크인">체크인</SortTh>
                  <SortTh col="check_out_date" current={sortBy} order={sortOrder} onClick={handleSort} info="게스트 퇴실일. 보통 11:00 체크아웃">체크아웃</SortTh>
                  <SortTh col="nights" current={sortBy} order={sortOrder} onClick={handleSort} info="체크인~체크아웃 사이 숙박 일수">박</SortTh>
                  <Th info="확정: 예약 완료 / 대기: 승인 전 / 취소: 취소됨">상태</Th>
                  <SortTh col="total_rate" current={sortBy} order={sortOrder} onClick={handleSort} info="OTA 수수료 포함 총 결제 금액 (KRW)">매출</SortTh>
                  <SortTh col="booked_at" current={sortBy} order={sortOrder} onClick={handleSort} info="게스트가 예약을 완료한 일시">예약일</SortTh>
                  {viewMode === "cancelled" && <Th info="예약이 취소된 일시">취소일</Th>}
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
                        <p className="text-sm font-medium text-gray-900">{r.guest_name_clean || r.guest_name || "-"}</p>
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

      {aiOpen && (
        <AiChat
          context={aiContext}
          onClose={() => setAiOpen(false)}
        />
      )}

      <AiAgentPanel page="reservations" pageLabel="예약 관리" getPageData={() => {
        if (!reservations.length) return '예약 데이터 없음';
        const total = reservations.reduce((s: number, r: { total_rate?: number }) => s + (r.total_rate || 0), 0);
        const channels: Record<string, number> = {};
        reservations.forEach((r: { channel_name?: string; channel_type?: string }) => { const ch = r.channel_name || r.channel_type || '기타'; channels[ch] = (channels[ch] || 0) + 1; });
        return `총 ${reservations.length}건, 총매출 ${total}원\n채널별: ${Object.entries(channels).map(([k, v]) => `${k}=${v}건`).join(', ')}`;
      }} />
      </>
      )}
    </div>
  );
}

function AiChatToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
        open
          ? "border-slate-800 bg-slate-800 text-white"
          : "border-gray-300 text-gray-600 hover:bg-gray-100"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        HIERO OAI
      </span>
    </button>
  );
}

function InfoBadge({ tip }: { tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-gray-300 hover:text-gray-500 cursor-help transition-colors">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor">i</text>
      </svg>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-48 rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-white shadow-lg whitespace-normal">
          {tip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

function Th({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-400">
      <span className="inline-flex items-center">
        {children}
        {info && <InfoBadge tip={info} />}
      </span>
    </th>
  );
}
function SortTh({ children, col, current, order, onClick, info }: { children: React.ReactNode; col: string; current: string; order: string; onClick: (col: string) => void; info?: string }) {
  const active = current === col;
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium tracking-wider cursor-pointer select-none transition-colors ${active ? "text-slate-900 bg-gray-100" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
      onClick={() => onClick(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {info && <InfoBadge tip={info} />}
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
