import type { CalendarDailySummary } from "../types/calendar";

interface DailySummaryBarProps {
  summary: CalendarDailySummary;
}

export default function DailySummaryBar({ summary }: DailySummaryBarProps) {
  const items = [
    {
      label: "체크인",
      value: `${summary.checkin_completed}/${summary.today_checkins}`,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "체크아웃",
      value: `${summary.checkout_completed}/${summary.today_checkouts}`,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "턴오버",
      value: String(summary.turnover || 0),
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "입실 중",
      value: String(summary.in_house),
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "공실",
      value: String(summary.vacant),
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "마감",
      value: String(summary.closed),
      color: "text-gray-500",
      bg: "bg-gray-50",
    },
    {
      label: "내일 체크인",
      value: String(summary.tomorrow_checkins),
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "확인 필요",
      value: String(summary.tomorrow_need_confirm),
      color: summary.tomorrow_need_confirm > 0 ? "text-red-600" : "text-gray-500",
      bg: summary.tomorrow_need_confirm > 0 ? "bg-red-50" : "bg-gray-50",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg ${item.bg} px-2 py-1.5 text-center sm:px-3 sm:py-2`}
        >
          <div className={`text-base font-bold sm:text-xl ${item.color}`}>{item.value}</div>
          <div className="text-[10px] text-gray-500 sm:text-xs">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
