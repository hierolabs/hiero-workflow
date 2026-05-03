import { formatDate, getDayOfWeek, isToday, isWeekend } from "../utils/date";

interface CalendarHeaderProps {
  dates: string[];
  cellWidth: number;
}

export default function CalendarHeader({ dates, cellWidth }: CalendarHeaderProps) {
  const small = cellWidth < 32;

  return (
    <div className="flex border-b border-gray-200 bg-gray-50">
      {dates.map((date) => {
        const today = isToday(date);
        const weekend = isWeekend(date);
        return (
          <div
            key={date}
            className={`flex-shrink-0 border-r border-gray-200 py-1 text-center leading-tight ${
              today
                ? "bg-blue-100 font-bold text-blue-700"
                : weekend
                  ? "bg-red-50 text-red-500"
                  : "text-gray-600"
            }`}
            style={{ width: cellWidth, fontSize: small ? 9 : 11 }}
          >
            <div>{formatDate(date)}</div>
            <div style={{ fontSize: small ? 8 : 9 }}>{getDayOfWeek(date)}</div>
          </div>
        );
      })}
    </div>
  );
}
