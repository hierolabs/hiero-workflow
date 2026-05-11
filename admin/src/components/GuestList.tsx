import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

interface GuestSummary {
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  total_visits: number;
  total_nights: number;
  total_spent: number;
  first_visit: string;
  last_visit: string;
  last_property: string;
  channels: string;
  properties: string;
  avg_nights: number;
}

interface Stats {
  total_guests: number;
  total_reservations: number;
  total_revenue: number;
  repeat_guests: number;
}

interface Reservation {
  id: number;
  reservation_code: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  status: string;
  channel_name: string;
  total_rate: number;
  property_name: string;
  guest_phone: string;
  guest_email: string;
}

type PeriodPreset = "all" | "this_month" | "last_month" | "this_quarter" | "this_year" | "last_year" | "custom";

function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  switch (preset) {
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
    case "this_year": {
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    }
    case "last_year": {
      return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
    }
    default:
      return { from: "", to: "" };
  }
}

export default function GuestList() {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sort, setSort] = useState("last_visit");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(true);

  // 상세 모달
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [guestReservations, setGuestReservations] = useState<Reservation[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (channel) params.set("channel", channel);
      params.set("sort", sort);
      params.set("order", order);

      // 기간 필터
      const range = period === "custom"
        ? { from: customFrom, to: customTo }
        : getDateRange(period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);

      const res = await fetch(`${API}/guests?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
        setStats(data.stats || null);
        setChannels(data.channels || []);
      }
    } catch { /* */ }
    setLoading(false);
  };

  const fetchDetail = async (name: string) => {
    setDetailLoading(true);
    setSelectedGuest(name);
    try {
      const res = await fetch(`${API}/guests/${encodeURIComponent(name)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGuestReservations(data.reservations || []);
      }
    } catch { /* */ }
    setDetailLoading(false);
  };

  useEffect(() => { fetchGuests(); }, [channel, sort, order, period, customFrom, customTo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuests();
  };

  const toggleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sort !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{order === "desc" ? "↓" : "↑"}</span>;
  };

  const fmt = (n: number) => n?.toLocaleString("ko-KR") ?? "0";

  const periodPresets: { value: PeriodPreset; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "this_month", label: "이번달" },
    { value: "last_month", label: "지난달" },
    { value: "this_quarter", label: "이번 분기" },
    { value: "this_year", label: "올해" },
    { value: "last_year", label: "작년" },
    { value: "custom", label: "기간설정" },
  ];

  return (
    <div className="space-y-4">
      {/* 기간 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        {periodPresets.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-slate-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-1 ml-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs" />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs" />
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">전체 게스트</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.total_guests)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">총 예약</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.total_reservations)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">재방문 게스트</p>
            <p className="text-2xl font-bold text-blue-600">{fmt(stats.repeat_guests)}</p>
            <p className="text-[10px] text-gray-400">
              {stats.total_guests > 0 ? ((stats.repeat_guests / stats.total_guests) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500">총 매출</p>
            <p className="text-2xl font-bold text-green-600">{fmt(stats.total_revenue)}원</p>
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="bg-white rounded-lg border p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">검색</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 전화번호, 이메일"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-gray-500 mb-1">채널</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {channels.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            검색
          </button>
        </form>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort("guest_name")}>
                  게스트명 <SortIcon field="guest_name" />
                </th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-700 text-right" onClick={() => toggleSort("total_visits")}>
                  방문 <SortIcon field="total_visits" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-700 text-right" onClick={() => toggleSort("total_nights")}>
                  총 숙박일 <SortIcon field="total_nights" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-700 text-right" onClick={() => toggleSort("total_spent")}>
                  총 매출 <SortIcon field="total_spent" />
                </th>
                <th className="px-4 py-3 cursor-pointer hover:text-gray-700" onClick={() => toggleSort("last_visit")}>
                  최근 방문 <SortIcon field="last_visit" />
                </th>
                <th className="px-4 py-3">채널</th>
                <th className="px-4 py-3">최근 숙소</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
              ) : guests.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">게스트가 없습니다</td></tr>
              ) : (
                guests.map((g) => (
                  <tr
                    key={g.guest_name}
                    onClick={() => fetchDetail(g.guest_name)}
                    className="border-b hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{g.guest_name}</div>
                      {g.total_visits > 1 && (
                        <span className="inline-block mt-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          재방문 {g.total_visits}회
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="text-xs">{g.guest_phone || "-"}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[160px]">{g.guest_email || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{g.total_visits}</td>
                    <td className="px-4 py-3 text-right">
                      {g.total_nights}박
                      <span className="text-[10px] text-gray-400 ml-1">(평균 {g.avg_nights.toFixed(1)})</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(g.total_spent)}원</td>
                    <td className="px-4 py-3 text-gray-600">{g.last_visit}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.channels.split(", ").filter(Boolean).map((ch) => (
                          <span key={ch} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{ch}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">{g.last_property}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-2 text-xs text-gray-400">
          총 {guests.length}명
        </div>
      </div>

      {/* 상세 모달 */}
      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedGuest(null)} />
          <div className="relative m-auto w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedGuest}</h3>
                <p className="text-xs text-gray-500">예약 이력</p>
              </div>
              <button
                onClick={() => setSelectedGuest(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <p className="text-center text-gray-400 py-8">로딩 중...</p>
              ) : guestReservations.length === 0 ? (
                <p className="text-center text-gray-400 py-8">예약 이력이 없습니다</p>
              ) : (
                <>
                  {/* 게스트 연락처 요약 */}
                  <div className="mb-4 flex gap-4 text-sm">
                    {guestReservations[0]?.guest_phone && (
                      <div><span className="text-gray-400">전화:</span> {guestReservations[0].guest_phone}</div>
                    )}
                    {guestReservations[0]?.guest_email && (
                      <div><span className="text-gray-400">이메일:</span> {guestReservations[0].guest_email}</div>
                    )}
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                        <th className="px-3 py-2">체크인</th>
                        <th className="px-3 py-2">체크아웃</th>
                        <th className="px-3 py-2 text-right">숙박</th>
                        <th className="px-3 py-2">숙소</th>
                        <th className="px-3 py-2">채널</th>
                        <th className="px-3 py-2 text-right">금액</th>
                        <th className="px-3 py-2">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guestReservations.map((r) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{r.check_in_date}</td>
                          <td className="px-3 py-2">{r.check_out_date}</td>
                          <td className="px-3 py-2 text-right">{r.nights}박</td>
                          <td className="px-3 py-2 text-xs">{r.property_name || "-"}</td>
                          <td className="px-3 py-2">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">{r.channel_name}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(r.total_rate)}원</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              r.status === "accepted" ? "bg-green-100 text-green-700" :
                              r.status === "cancelled" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 text-right text-sm text-gray-500">
                    총 {guestReservations.length}건 / {guestReservations.reduce((s, r) => s + r.nights, 0)}박 / {fmt(guestReservations.reduce((s, r) => s + r.total_rate, 0))}원
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
