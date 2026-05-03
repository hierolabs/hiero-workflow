import type { CalendarProperty, CalendarReservation } from "../types/calendar";
import { getStatusColor } from "../utils/status";
import { getReservationPosition } from "../utils/reservationLayout";
import ReservationBlock from "./ReservationBlock";

/** 숙소 타이틀 단축: "A22_예건 202_수동_Q1_TV(케이블)" → "A22 예건 202" */
function shortTitle(title: string): string {
  if (!title) return "";
  const m = title.match(/([A-Za-z0-9]+[_ ]+)?([가-힣][가-힣A-Za-z0-9]*)\s+(\d+)/);
  if (m) {
    const code = m[1] ? m[1].replace("_", " ").trim() : "";
    return code ? `${code} ${m[2]} ${m[3]}` : `${m[2]} ${m[3]}`;
  }
  const i = title.indexOf("_");
  return i > 0 ? title.slice(0, i) : title;
}

interface PropertyRowProps {
  property: CalendarProperty;
  reservations: CalendarReservation[];
  dates: string[];
  cellWidth: number;
  leftColWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
}

export default function PropertyRow({
  property,
  reservations,
  dates,
  cellWidth,
  leftColWidth,
  onReservationClick,
}: PropertyRowProps) {
  const statusColor = getStatusColor(property.today_status);

  return (
    <div className="flex border-b border-gray-100 hover:bg-gray-50/50">
      {/* Property name — sticky left */}
      <div
        className="sticky left-0 z-10 flex flex-shrink-0 items-center gap-1.5 border-r border-gray-200 bg-white px-2 py-1"
        style={{ width: leftColWidth }}
      >
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusColor.dot}`} />
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-900" style={{ fontSize: 11 }} title={property.name}>
            {shortTitle(property.name)}
          </div>
        </div>
      </div>

      {/* Calendar cells */}
      <div className="relative flex-1" style={{ minWidth: dates.length * cellWidth }}>
        <div className="flex" style={{ height: 36 }}>
          {dates.map((date) => (
            <div
              key={date}
              className="flex-shrink-0 border-r border-gray-100"
              style={{ width: cellWidth }}
            />
          ))}
        </div>

        {reservations.map((r) => {
          const pos = getReservationPosition(r, dates);
          if (!pos.visible) return null;
          return (
            <ReservationBlock
              key={r.id}
              reservation={r}
              left={pos.left}
              width={pos.width}
              cellWidth={cellWidth}
              onClick={onReservationClick}
            />
          );
        })}
      </div>
    </div>
  );
}
