import { useState, useCallback, useMemo } from "react";
import { useDateRange } from "../hooks/useDateRange";
import { useCalendarData } from "../hooks/useCalendarData";
import { useCalendarFilters } from "../hooks/useCalendarFilters";
import { usePricingData } from "../hooks/usePricingData";
import { triggerSync } from "../api/calendarApi";
import type { CalendarReservation, DayPricing } from "../types/calendar";
import CalendarToolbar from "./CalendarToolbar";
import CalendarGrid from "./CalendarGrid";
import ReservationDetailModal from "../../../components/ReservationDetailModal";
import PriceEditModal from "./PriceEditModal";

export default function CalendarPage() {
  const dateRange = useDateRange();
  const { data, loading, error, reload } = useCalendarData(
    dateRange.startDate,
    dateRange.endDate
  );
  const { pricing, reloadPricing } = usePricingData(dateRange.startDate, dateRange.endDate);

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
    const turnover = counts["turnover_today"] || 0;
    counts["checkin_today"] = (counts["checkin_today"] || 0) + turnover;
    counts["checkout_today"] = (counts["checkout_today"] || 0) + turnover;
    return counts;
  }, [data?.properties]);

  const [selectedResId, setSelectedResId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // 가격 편집 모달 상태
  const [priceEdit, setPriceEdit] = useState<{
    propertyId: number;
    propertyName: string;
    date: string;
    pricing: DayPricing;
  } | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await reload();
      await reloadPricing();
    } catch {
      // sync failure visible via stale data
    } finally {
      setSyncing(false);
    }
  }, [reload, reloadPricing]);

  const handlePriceClick = useCallback((propertyId: number, date: string, dayPricing: DayPricing) => {
    const prop = data?.properties.find(p => p.id === propertyId);
    setPriceEdit({
      propertyId,
      propertyName: prop?.name || `숙소 #${propertyId}`,
      date,
      pricing: dayPricing,
    });
  }, [data?.properties]);

  const handlePriceSaved = useCallback(() => {
    setPriceEdit(null);
    reloadPricing();
  }, [reloadPricing]);

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
          onReservationClick={(r: CalendarReservation) => setSelectedResId(r.id)}
          pricing={pricing}
          onPriceClick={handlePriceClick}
        />
      )}

      <ReservationDetailModal
        reservationId={selectedResId}
        onClose={() => setSelectedResId(null)}
      />

      {priceEdit && (
        <PriceEditModal
          propertyId={priceEdit.propertyId}
          propertyName={priceEdit.propertyName}
          date={priceEdit.date}
          currentPricing={priceEdit.pricing}
          onClose={() => setPriceEdit(null)}
          onSaved={handlePriceSaved}
        />
      )}
    </div>
  );
}
