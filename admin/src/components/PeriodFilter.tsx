import { useState, useCallback, useMemo } from "react";

export type PeriodKey =
  | "all"
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month"
  | "this_quarter" | "last_quarter"
  | "this_year" | "last_year"
  | "custom";

interface PeriodFilterProps {
  value: PeriodKey;
  onChange: (period: PeriodKey, start: string, end: string) => void;
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "this_week", label: "이번주" },
  { key: "last_week", label: "지난주" },
  { key: "this_month", label: "이번달" },
  { key: "last_month", label: "지난달" },
  { key: "this_quarter", label: "이번 분기" },
  { key: "last_quarter", label: "지난 분기" },
  { key: "this_year", label: "올해" },
  { key: "last_year", label: "작년" },
  { key: "custom", label: "기간설정" },
];

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function calcRange(period: PeriodKey, customStart?: string, customEnd?: string): [string, string] {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const dow = now.getDay() || 7; // 일=7

  switch (period) {
    case "all":
      return ["2023-01-01", fmt(now)];
    case "today":
      return [fmt(now), fmt(now)];
    case "yesterday": {
      const t = new Date(y, m, d - 1);
      return [fmt(t), fmt(t)];
    }
    case "this_week": {
      const mon = new Date(y, m, d - dow + 1);
      return [fmt(mon), fmt(now)];
    }
    case "last_week": {
      const mon = new Date(y, m, d - dow - 6);
      const sun = new Date(y, m, d - dow);
      return [fmt(mon), fmt(sun)];
    }
    case "this_month":
      return [`${y}-${String(m + 1).padStart(2, "0")}-01`, fmt(now)];
    case "last_month": {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return [fmt(s), fmt(e)];
    }
    case "this_quarter": {
      const qm = Math.floor(m / 3) * 3;
      return [`${y}-${String(qm + 1).padStart(2, "0")}-01`, fmt(now)];
    }
    case "last_quarter": {
      const qm = Math.floor(m / 3) * 3;
      const s = new Date(y, qm - 3, 1);
      const e = new Date(y, qm, 0);
      return [fmt(s), fmt(e)];
    }
    case "this_year":
      return [`${y}-01-01`, fmt(now)];
    case "last_year":
      return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "custom":
      return [customStart || fmt(now), customEnd || fmt(now)];
    default:
      return [fmt(now), fmt(now)];
  }
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const [customStart, setCustomStart] = useState(() => fmt(new Date()));
  const [customEnd, setCustomEnd] = useState(() => fmt(new Date()));

  const rangeLabel = useMemo(() => {
    const [s, e] = calcRange(value, customStart, customEnd);
    return `${s} ~ ${e}`;
  }, [value, customStart, customEnd]);

  const handleSelect = useCallback((key: PeriodKey) => {
    if (key === "custom") {
      onChange(key, customStart, customEnd);
    } else {
      const [s, e] = calcRange(key);
      onChange(key, s, e);
    }
  }, [onChange, customStart, customEnd]);

  const handleCustomStart = (v: string) => {
    setCustomStart(v);
    onChange("custom", v, customEnd);
  };

  const handleCustomEnd = (v: string) => {
    setCustomEnd(v);
    onChange("custom", customStart, v);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => handleSelect(p.key)}
            className={`px-3 py-1.5 text-xs rounded-full transition ${
              value === p.key
                ? "bg-slate-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customStart}
            onChange={(e) => handleCustomStart(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => handleCustomEnd(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
      )}
      <div className="text-xs text-gray-400">{rangeLabel}</div>
    </div>
  );
}
