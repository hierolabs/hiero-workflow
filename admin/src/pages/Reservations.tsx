import { useEffect, useState, useCallback } from "react";
import {
  fetchReservations,
  STATUS_LABELS,
  STATUS_STYLES,
  CHANNEL_LABELS,
  type Reservation,
  type ReservationListQuery,
} from "../utils/reservation-api";
import OperationManual from "../components/OperationManual";

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState<ReservationListQuery>({
    page: 1,
    page_size: 20,
  });
  const [keyword, setKeyword] = useState("");
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReservations(query);
      setReservations(data.reservations || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setQuery((prev) => ({ ...prev, page: 1, keyword: keyword || undefined }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleFilterChange = (key: keyof ReservationListQuery, value: string) => {
    setQuery((prev) => ({ ...prev, page: 1, [key]: value || undefined }));
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예약 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            전체 {total}건의 예약이 있습니다.
          </p>
        </div>
        <button onClick={() => setShowManual(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">운영 매뉴얼</button>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예약코드, 게스트 이름으로 검색..."
            className="block w-72 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            검색
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="상태"
            value={query.status || ""}
            onChange={(v) => handleFilterChange("status", v)}
            options={[
              { value: "accepted", label: "확정" },
              { value: "pending", label: "대기" },
              { value: "cancelled", label: "취소" },
            ]}
          />
          <FilterSelect
            label="채널"
            value={query.channel_type || ""}
            onChange={(v) => handleFilterChange("channel_type", v)}
            options={[
              { value: "airbnb", label: "Airbnb" },
              { value: "booking.com", label: "Booking.com" },
              { value: "agoda", label: "Agoda" },
            ]}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">체크인:</label>
            <input
              type="date"
              value={query.check_in_from || ""}
              onChange={(e) => handleFilterChange("check_in_from", e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={query.check_in_to || ""}
              onChange={(e) => handleFilterChange("check_in_to", e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={query.unmatched_only || false}
              onChange={(e) =>
                setQuery((prev) => ({
                  ...prev,
                  page: 1,
                  unmatched_only: e.target.checked || undefined,
                }))
              }
              className="accent-slate-900"
            />
            미매칭만
          </label>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <Th>예약코드</Th>
                  <Th>게스트</Th>
                  <Th>채널</Th>
                  <Th>체크인</Th>
                  <Th>체크아웃</Th>
                  <Th>박</Th>
                  <Th>인원</Th>
                  <Th>상태</Th>
                  <Th>매칭</Th>
                  <Th>매출</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-400">
                      예약이 없습니다.
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <Td>
                        <span className="font-mono text-xs text-slate-700">
                          {r.reservation_code.length > 12
                            ? r.reservation_code.slice(0, 12) + "..."
                            : r.reservation_code}
                        </span>
                      </Td>
                      <Td>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.guest_name || "-"}</p>
                          {r.guest_phone && (
                            <p className="text-xs text-gray-400">{r.guest_phone}</p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getChannelStyle(r.channel_type)}`}>
                          {getChannelLabel(r)}
                        </span>
                      </Td>
                      <Td>{r.check_in_date}</Td>
                      <Td>{r.check_out_date}</Td>
                      <Td>{r.nights}박</Td>
                      <Td>{r.number_of_guests}명</Td>
                      <Td>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </Td>
                      <Td>
                        {r.internal_prop_id ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            연결됨
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            미매칭
                          </span>
                        )}
                      </Td>
                      <Td>{formatWon(r.total_rate)}</Td>
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
                {total}건 중 {(query.page! - 1) * query.page_size! + 1}-
                {Math.min(query.page! * query.page_size!, total)}
              </p>
              <div className="flex gap-1">
                <PaginationButton
                  disabled={query.page === 1}
                  onClick={() => setQuery((prev) => ({ ...prev, page: prev.page! - 1 }))}
                >
                  이전
                </PaginationButton>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - query.page!) <= 2)
                  .map((p) => (
                    <PaginationButton
                      key={p}
                      active={p === query.page}
                      onClick={() => setQuery((prev) => ({ ...prev, page: p }))}
                    >
                      {p}
                    </PaginationButton>
                  ))}
                <PaginationButton
                  disabled={query.page === totalPages}
                  onClick={() => setQuery((prev) => ({ ...prev, page: prev.page! + 1 }))}
                >
                  다음
                </PaginationButton>
              </div>
            </div>
          )}
        </div>
      )}
      {showManual && <OperationManual page="reservations" onClose={() => setShowManual(false)} />}
    </div>
  );
}

// --- Shared UI ---

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
      {children}
    </td>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none"
    >
      <option value="">{label} 전체</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function PaginationButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : disabled
            ? "text-gray-300 cursor-not-allowed"
            : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
