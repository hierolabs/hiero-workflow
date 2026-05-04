import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder = "전체", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange(filtered.map((o) => o.value));
  const clearAll = () => onChange([]);

  const displayText = selected.length === 0
    ? placeholder
    : selected.length <= 2
    ? selected.map((v) => options.find((o) => o.value === v)?.label || v).join(", ")
    : `${selected.length}개 선택`;

  const hasActive = selected.length > 0;

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs transition-colors ${
          hasActive
            ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        <span className="max-w-[160px] truncate">{displayText}</span>
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* 검색 */}
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* 전체 선택/해제 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">전체 선택</button>
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500">초기화</button>
          </div>

          {/* 옵션 리스트 */}
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">결과 없음</p>
            ) : (
              filtered.map((o) => {
                const checked = selected.includes(o.value);
                return (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors ${
                      checked ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
