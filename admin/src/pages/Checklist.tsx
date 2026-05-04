import { useEffect, useState } from "react";
import { apiRequest } from "../utils/api";

interface ChecklistItem {
  id: number;
  date: string;
  template_id: string;
  page: string;
  mode: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

interface Summary {
  total: number;
  completed: number;
  rate: number;
  by_page: { page: string; total: number; completed: number }[];
}

const PAGE_LABELS: Record<string, string> = {
  dashboard: "대시보드",
  reservations: "예약",
  cleaning: "청소",
  issues: "이슈",
  settlement: "정산",
  revenue: "매출",
};

const MODE_LABELS: Record<string, string> = {
  manage: "관리",
  execute: "실행",
};

export default function Checklist() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const load = async () => {
    const [res, sumRes] = await Promise.all([
      apiRequest("/checklist/today"),
      apiRequest("/checklist/summary"),
    ]);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
    if (sumRes.ok) {
      setSummary(await sumRes.json());
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: number) => {
    const res = await apiRequest(`/checklist/${id}/toggle`, { method: "PATCH" });
    if (res.ok) {
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === id ? { ...i, completed: updated.completed, completed_at: updated.completed_at } : i));
      // 요약 재계산
      const sumRes = await apiRequest("/checklist/summary");
      if (sumRes.ok) setSummary(await sumRes.json());
    }
  };

  const filtered = items.filter(i => {
    if (filter === "pending") return !i.completed;
    if (filter === "done") return i.completed;
    return true;
  });

  const grouped = filtered.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const key = item.page;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">오늘의 체크리스트</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* Progress */}
      {summary && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {summary.completed}/{summary.total} 완료
            </span>
            <span className="text-sm font-bold text-blue-600">{Math.round(summary.rate)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${summary.rate}%` }}
            />
          </div>
          {summary.by_page.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              {summary.by_page.map(p => (
                <span key={p.page}>
                  {PAGE_LABELS[p.page] || p.page}: {p.completed}/{p.total}
                  {p.completed === p.total && " ✓"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-1">
        {([["all", "전체"], ["pending", "미완료"], ["done", "완료"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              filter === key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([page, pageItems]) => (
          <div key={page} className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <span className="text-sm font-bold text-gray-900">{PAGE_LABELS[page] || page}</span>
              <span className="ml-2 text-xs text-gray-400">
                {pageItems.filter(i => i.completed).length}/{pageItems.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {pageItems.map(item => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className={`flex-1 text-sm ${item.completed ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {item.title}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {MODE_LABELS[item.mode] || item.mode}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center text-gray-400">
          {filter === "done" ? "완료된 항목이 없습니다" : filter === "pending" ? "모두 완료했습니다!" : "체크리스트가 없습니다"}
        </div>
      )}
    </div>
  );
}
