import type { RoomStatus, StatusFilter } from "../types/calendar";

const statusLabels: Record<StatusFilter, string> = {
  all: "전체",
  in_house: "입실 중",
  checkin_today: "체크인",
  checkout_today: "체크아웃",
  turnover_today: "턴오버",
  vacant: "공실",
  closed: "마감",
};

export function getStatusLabel(status: StatusFilter): string {
  return statusLabels[status] || status;
}

const statusColors: Record<RoomStatus, { bg: string; text: string; dot: string }> = {
  in_house: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  vacant: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  closed: { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-400" },
  checkin_today: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  checkout_today: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  turnover_today: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  needs_cleaning: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  cleaning_done: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  issue_open: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export function getStatusColor(status: RoomStatus) {
  return statusColors[status] || statusColors.vacant;
}

const statusFilterOptions: StatusFilter[] = [
  "all",
  "in_house",
  "checkin_today",
  "checkout_today",
  "turnover_today",
  "vacant",
  "closed",
];

export function getStatusFilterOptions(): { value: StatusFilter; label: string }[] {
  return statusFilterOptions.map((s) => ({ value: s, label: getStatusLabel(s) }));
}
