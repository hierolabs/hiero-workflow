import type { StatusFilter as StatusFilterType } from "../types/calendar";
import { getStatusFilterOptions } from "../utils/status";

interface StatusFilterProps {
  value: StatusFilterType;
  onChange: (value: StatusFilterType) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  const options = getStatusFilterOptions();

  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-slate-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
