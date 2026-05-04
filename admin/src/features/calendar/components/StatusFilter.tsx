import type { StatusFilter as StatusFilterType } from "../types/calendar";
import { getStatusFilterOptions } from "../utils/status";

interface StatusFilterProps {
  value: StatusFilterType;
  onChange: (value: StatusFilterType) => void;
  counts?: Record<string, number>;
}

export default function StatusFilter({ value, onChange, counts }: StatusFilterProps) {
  const options = getStatusFilterOptions();

  const dimmed = new Set(["turnover_today", "vacant", "closed"]);

  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const isDimmed = dimmed.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-slate-800 text-white"
                : isDimmed
                  ? "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
            {counts && counts[opt.value] != null && (
              <span className="ml-1 opacity-70">({counts[opt.value]})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
