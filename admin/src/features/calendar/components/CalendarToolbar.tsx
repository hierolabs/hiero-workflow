import type { StatusFilter as StatusFilterType } from "../types/calendar";
import StatusFilter from "./StatusFilter";
import RegionFilter from "./RegionFilter";

interface CalendarToolbarProps {
  title: string;
  baseDate: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onGoToDate: (date: string) => void;
  statusFilter: StatusFilterType;
  onStatusFilterChange: (value: StatusFilterType) => void;
  statusCounts?: Record<string, number>;
  regions: string[];
  regionFilter: string;
  onRegionFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export default function CalendarToolbar({
  title,
  baseDate,
  onPrev,
  onNext,
  onToday,
  onGoToDate,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  regions,
  regionFilter,
  onRegionFilterChange,
  search,
  onSearchChange,
  onSync,
  syncing,
}: CalendarToolbarProps) {
  return (
    <div className="space-y-2">
      {/* Row 1 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrev} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">◀</button>
          <h2 className="min-w-[100px] text-center text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
          <button type="button" onClick={onNext} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">▶</button>
          <button type="button" onClick={onToday} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">오늘</button>
          <input
            type="date"
            value={baseDate}
            onChange={(e) => onGoToDate(e.target.value)}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing ? "동기화..." : "동기화"}
        </button>
      </div>

      {/* Row 2 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="overflow-x-auto">
          <StatusFilter value={statusFilter} onChange={onStatusFilterChange} counts={statusCounts} />
        </div>
        <div className="flex items-center gap-2">
          <RegionFilter regions={regions} value={regionFilter} onChange={onRegionFilterChange} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="숙소/게스트 검색"
            className="w-36 rounded border border-gray-300 px-2 py-1 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none sm:w-48"
          />
        </div>
      </div>
    </div>
  );
}
