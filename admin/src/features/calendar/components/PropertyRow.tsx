import type { CalendarProperty, CalendarReservation, DayPricing } from "../types/calendar";
import { getStatusColor, getStatusLabel } from "../utils/status";
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

/** 가격 → 만원 단위 포맷 */
function priceLabel(price: number): string {
  if (!price) return "";
  const man = price / 10000;
  return man >= 10 ? man.toFixed(0) : man.toFixed(1);
}

/** 특정 날짜에 예약이 있는지 */
function isDateOccupied(date: string, reservations: CalendarReservation[]): boolean {
  return reservations.some(
    (r) => r.check_in_date <= date && r.check_out_date > date && r.status !== "cancelled"
  );
}

const ROW_HEIGHT = 48;

interface PropertyRowProps {
  property: CalendarProperty;
  reservations: CalendarReservation[];
  dates: string[];
  cellWidth: number;
  leftColWidth: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  pricing?: Record<string, DayPricing>;
  onPriceClick?: (propertyId: number, date: string, pricing: DayPricing) => void;
}

export default function PropertyRow({
  property,
  reservations,
  dates,
  cellWidth,
  leftColWidth,
  onReservationClick,
  pricing,
  onPriceClick,
}: PropertyRowProps) {
  const statusColor = getStatusColor(property.today_status);

  return (
    <div className="flex border-b border-gray-100">
      {/* Property name — sticky left */}
      <div
        className="sticky left-0 z-10 flex flex-shrink-0 items-center gap-1.5 border-r border-gray-200 bg-white px-2"
        style={{ width: leftColWidth, height: ROW_HEIGHT }}
      >
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusColor.dot}`} title={getStatusLabel(property.today_status )} />
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-800" style={{ fontSize: 11 }} title={property.name}>
            {shortTitle(property.name)}
          </div>
          <div className={`truncate ${statusColor.text}`} style={{ fontSize: 9 }}>
            {getStatusLabel(property.today_status )}
          </div>
        </div>
      </div>

      {/* Calendar cells */}
      <div className="relative flex-1" style={{ minWidth: dates.length * cellWidth }}>
        {/* 배경: 가격 셀 */}
        <div className="flex" style={{ height: ROW_HEIGHT }}>
          {dates.map((date) => {
            const occupied = isDateOccupied(date, reservations);
            const dayPrice = pricing?.[date];

            // 예약 있는 셀 → 하단에 가격만 작게
            if (occupied) {
              return (
                <div
                  key={date}
                  className="flex-shrink-0 border-r border-gray-50 flex items-end justify-center pb-0.5"
                  style={{ width: cellWidth, height: ROW_HEIGHT }}
                >
                  {dayPrice && (
                    <span className="text-gray-300" style={{ fontSize: 8 }}>
                      {priceLabel(dayPrice.price)}
                    </span>
                  )}
                </div>
              );
            }

            // 가격 없는 빈 셀 → "-"
            if (!dayPrice) {
              return (
                <div
                  key={date}
                  className="flex-shrink-0 border-r border-gray-50 flex items-center justify-center"
                  style={{ width: cellWidth, height: ROW_HEIGHT }}
                >
                  <span className="text-gray-200" style={{ fontSize: 10 }}>-</span>
                </div>
              );
            }

            // 빈 날 → 가격 + 상태
            const blocked = !dayPrice.available;

            return (
              <div
                key={date}
                className={`flex-shrink-0 border-r border-gray-50 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  blocked ? "bg-red-50/60 hover:bg-red-100" : "hover:bg-blue-50/50"
                }`}
                style={{ width: cellWidth, height: ROW_HEIGHT }}
                onClick={() => onPriceClick?.(property.id, date, dayPrice)}
                title={`₩${dayPrice.price.toLocaleString()} | 최소 ${dayPrice.min_stay}박${blocked ? " | 차단" : ""}`}
              >
                <span
                  className={`font-medium ${blocked ? "text-red-300 line-through" : "text-gray-500"}`}
                  style={{ fontSize: 10 }}
                >
                  {priceLabel(dayPrice.price)}
                </span>
                {dayPrice.min_stay > 1 && !blocked && (
                  <span className="text-blue-400 mt-0.5" style={{ fontSize: 8 }}>
                    {dayPrice.min_stay}박
                  </span>
                )}
                {blocked && (
                  <span className="text-red-300 mt-0.5" style={{ fontSize: 8 }}>
                    차단
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 예약 블록 overlay */}
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
