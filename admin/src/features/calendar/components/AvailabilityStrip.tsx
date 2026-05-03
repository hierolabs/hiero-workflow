import type { CalendarProperty, CalendarReservation } from "../types/calendar";

interface AvailabilityStripProps {
  properties: CalendarProperty[];
  reservations: CalendarReservation[];
  dates: string[];
  cellWidth: number;
  leftColWidth: number;
}

export default function AvailabilityStrip({
  properties,
  reservations,
  dates,
  cellWidth,
  leftColWidth,
}: AvailabilityStripProps) {
  const vacantByDate = dates.map((date) => {
    const occupied = new Set<number>();
    for (const r of reservations) {
      if (r.check_in_date <= date && r.check_out_date > date && r.status !== "cancelled") {
        if (r.internal_prop_id != null) occupied.add(r.internal_prop_id);
      }
    }
    return properties.length - occupied.size;
  });

  return (
    <div className="flex border-b border-gray-200 bg-gray-50">
      <div
        className="sticky left-0 z-10 flex flex-shrink-0 items-center border-r border-gray-200 bg-gray-50 px-2 text-xs font-medium text-gray-500"
        style={{ width: leftColWidth }}
      >
        공실
      </div>
      <div className="flex">
        {dates.map((date, i) => {
          const vacant = vacantByDate[i];
          const total = properties.length;
          const ratio = total > 0 ? vacant / total : 0;
          let bgColor = "bg-red-100 text-red-700";
          if (ratio > 0.3) bgColor = "bg-yellow-100 text-yellow-700";
          if (ratio > 0.6) bgColor = "bg-green-100 text-green-700";

          return (
            <div
              key={date}
              className={`flex-shrink-0 border-r border-gray-200 py-0.5 text-center text-[10px] font-medium ${bgColor}`}
              style={{ width: cellWidth }}
            >
              {vacant}
            </div>
          );
        })}
      </div>
    </div>
  );
}
