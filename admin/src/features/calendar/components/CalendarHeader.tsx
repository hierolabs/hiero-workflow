import { formatDate, getDayOfWeek, isToday, isWeekend } from "../utils/date";

interface CalendarHeaderProps {
  dates: string[];
  cellWidth: number;
}

export default function CalendarHeader({ dates, cellWidth }: CalendarHeaderProps) {
  return (
    <div className="flex border-b border-gray-200 bg-gray-50">
      {dates.map((date) => {
        const today = isToday(date);
        const weekend = isWeekend(date);
        return (
          <div
            key={date}
            className={`flex-shrink-0 border-r border-gray-100 flex flex-col items-center justify-center ${
              today
                ? "bg-blue-50 font-bold text-blue-600"
                : weekend
                  ? "bg-orange-50/50 text-orange-500"
                  : "text-gray-600"
            }`}
            style={{ width: cellWidth, height: 40 }}
          >
            <div style={{ fontSize: 12, fontWeight: today ? 700 : 600 }}>{formatDate(date)}</div>
            <div style={{ fontSize: 9, marginTop: 1 }} className={weekend ? "text-orange-400" : "text-gray-400"}>
              {getDayOfWeek(date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
