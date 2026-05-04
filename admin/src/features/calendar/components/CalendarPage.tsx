import { useState, useCallback, useMemo } from "react";
import { useDateRange } from "../hooks/useDateRange";
import { useCalendarData } from "../hooks/useCalendarData";
import { useCalendarFilters } from "../hooks/useCalendarFilters";
import { triggerSync } from "../api/calendarApi";
import type { CalendarReservation } from "../types/calendar";
import CalendarToolbar from "./CalendarToolbar";
import CalendarGrid from "./CalendarGrid";
import ReservationDetailModal from "./ReservationDetailModal";

export default function CalendarPage() {
  const dateRange = useDateRange();
  const { data, loading, error, reload } = useCalendarData(
    dateRange.startDate,
    dateRange.endDate
  );

  const {
    filters,
    setStatus,
    setRegion,
    setSearch,
    regions,
    filteredProperties,
    filteredReservations,
  } = useCalendarFilters(
    data?.properties || [],
    data?.reservations || []
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const props = data?.properties || [];
    for (const p of props) {
      const s = p.today_status || "vacant";
      counts[s] = (counts[s] || 0) + 1;
    }
    counts["all"] = props.length;
    // 체크인/체크아웃은 턴오버 포함 (중복 카운팅)
    const turnover = counts["turnover_today"] || 0;
    counts["checkin_today"] = (counts["checkin_today"] || 0) + turnover;
    counts["checkout_today"] = (counts["checkout_today"] || 0) + turnover;
    return counts;
  }, [data?.properties]);

  const [selectedReservation, setSelectedReservation] =
    useState<CalendarReservation | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await reload();
    } catch {
      // sync failure visible via stale data
    } finally {
      setSyncing(false);
    }
  }, [reload]);

  return (
    <div className="space-y-2">
      <CalendarToolbar
        title={dateRange.title}
        baseDate={dateRange.baseDate}
        onPrev={dateRange.goPrev}
        onNext={dateRange.goNext}
        onToday={dateRange.goToday}
        onGoToDate={dateRange.goToDate}
        statusFilter={filters.status}
        onStatusFilterChange={setStatus}
        statusCounts={statusCounts}
        regions={regions}
        regionFilter={filters.region}
        onRegionFilterChange={setRegion}
        search={filters.search}
        onSearchChange={setSearch}
        onSync={handleSync}
        syncing={syncing}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          데이터를 불러오는 중...
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-red-500">
          <p>{error}</p>
          <button type="button" onClick={reload} className="rounded bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
            다시 시도
          </button>
        </div>
      ) : (
        <CalendarGrid
          properties={filteredProperties}
          reservations={filteredReservations}
          dates={dateRange.dates}
          onReservationClick={setSelectedReservation}
        />
      )}

      <ReservationDetailModal
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />
    </div>
  );
}
