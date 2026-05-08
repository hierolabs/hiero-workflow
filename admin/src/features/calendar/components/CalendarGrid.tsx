import { useRef, useEffect } from "react";
import type { CalendarProperty, CalendarReservation, PricingMap, DayPricing } from "../types/calendar";
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
  pricing?: PricingMap;
  onPriceClick?: (propertyId: number, date: string, pricing: DayPricing) => void;
}

const CELL_WIDTH = 48;
const LEFT_COL = 120;

export default function CalendarGrid({
  properties,
  reservations,
  dates,
  onReservationClick,
  pricing,
  onPriceClick,
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
    >
      <div style={{ width: totalWidth }}>
        {/* Header — sticky top */}
        <div className="sticky top-0 z-10 flex">
          <div
            className="sticky left-0 z-20 flex-shrink-0 border-b border-r border-gray-200 bg-gray-50 px-3 flex items-center text-xs font-semibold text-gray-500"
            style={{ width: LEFT_COL, height: 40 }}
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
            pricing={pricing?.[property.id]}
            onPriceClick={onPriceClick}
          />
        ))}
      </div>
    </div>
  );
}
