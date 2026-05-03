import { useRef, useEffect, useCallback } from "react";
import type { CalendarProperty, CalendarReservation } from "../types/calendar";
import { groupReservationsByProperty } from "../utils/reservationLayout";
import { isToday } from "../utils/date";
import CalendarHeader from "./CalendarHeader";
import PropertyRow from "./PropertyRow";
import AvailabilityStrip from "./AvailabilityStrip";

interface CalendarGridProps {
  properties: CalendarProperty[];
  reservations: CalendarReservation[];
  dates: string[];
  onReservationClick: (reservation: CalendarReservation) => void;
}

const CELL_WIDTH = 40;
const LEFT_COL = 110;

export default function CalendarGrid({
  properties,
  reservations,
  dates,
  onReservationClick,
}: CalendarGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reservationMap = groupReservationsByProperty(reservations);

  // Scroll to today on mount / date change
  useEffect(() => {
    if (!scrollRef.current || dates.length === 0) return;
    const todayIdx = dates.findIndex(isToday);
    if (todayIdx >= 0) {
      const target = todayIdx * CELL_WIDTH - scrollRef.current.clientWidth / 2 + LEFT_COL;
      scrollRef.current.scrollLeft = Math.max(0, target);
    }
  }, [dates]);

  // Mouse wheel → horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    // If mostly vertical scroll, convert to horizontal
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (properties.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        표시할 숙소가 없습니다
      </div>
    );
  }

  const totalWidth = LEFT_COL + dates.length * CELL_WIDTH;

  return (
    <div
      ref={scrollRef}
      className="rounded-lg border border-gray-200 bg-white overflow-auto"
      style={{ maxHeight: "calc(100vh - 160px)", WebkitOverflowScrolling: "touch" }}
      onWheel={handleWheel}
    >
      <div style={{ width: totalWidth }}>
        {/* Header — sticky top */}
        <div className="sticky top-0 z-10 flex">
          <div
            className="sticky left-0 z-20 flex-shrink-0 border-b border-r border-gray-200 bg-gray-50 px-2 flex items-center text-[11px] font-semibold text-gray-600"
            style={{ width: LEFT_COL, minHeight: 36 }}
          >
            숙소
          </div>
          <CalendarHeader dates={dates} cellWidth={CELL_WIDTH} />
        </div>

        {/* Availability strip */}
        <AvailabilityStrip
          properties={properties}
          reservations={reservations}
          dates={dates}
          cellWidth={CELL_WIDTH}
          leftColWidth={LEFT_COL}
        />

        {/* Property rows */}
        {properties.map((property) => (
          <PropertyRow
            key={property.id}
            property={property}
            reservations={reservationMap.get(property.id) || []}
            dates={dates}
            cellWidth={CELL_WIDTH}
            leftColWidth={LEFT_COL}
            onReservationClick={onReservationClick}
          />
        ))}
      </div>
    </div>
  );
}
