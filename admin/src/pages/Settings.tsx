import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;

interface Property {
  id: number;
  code: string;
  name: string;
  region: string;
  status: string;
  display_order: number;
}

export default function Settings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const token = localStorage.getItem("token");

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/properties?page=1&page_size=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setProperties(json.properties || []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const updated = [...properties];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setProperties(updated);
    setDragIdx(idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  function moveItem(idx: number, direction: "up" | "down") {
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= properties.length) return;
    const updated = [...properties];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setProperties(updated);
  }

  async function saveOrder() {
    setSaving(true);
    const orders = properties.map((p, i) => ({ id: p.id, display_order: i + 1 }));
    const res = await fetch(`${API_URL}/properties/reorder`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
    if (res.ok) {
      setToast("순서가 저장되었습니다");
      setTimeout(() => setToast(""), 2000);
    } else {
      setToast("저장 실패");
      setTimeout(() => setToast(""), 2000);
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-500">숙소 표시 순서를 드래그 또는 버튼으로 조정합니다</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-700">숙소 순서 (캘린더/공간관리 공통)</h3>
          <button
            onClick={saveOrder}
            disabled={saving}
            className="rounded-md bg-slate-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "순서 저장"}
          </button>
        </div>

        {toast && (
          <div className="mx-4 mt-2 rounded bg-green-50 px-3 py-1.5 text-xs text-green-700">{toast}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {properties.map((p, idx) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 border-b border-gray-100 px-4 py-2 text-sm transition-colors ${
                  dragIdx === idx ? "bg-blue-50" : "hover:bg-gray-50"
                } cursor-grab active:cursor-grabbing`}
              >
                <span className="w-8 shrink-0 text-center text-xs text-gray-400">{idx + 1}</span>
                <svg className="h-4 w-4 shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                </svg>
                <span className="w-16 shrink-0 font-mono text-xs text-gray-500">{p.code}</span>
                <span className="flex-1 truncate text-gray-700">{p.name}</span>
                <span className="w-16 shrink-0 text-xs text-gray-400">{p.region}</span>
                <span className={`w-12 shrink-0 text-xs ${p.status === "active" ? "text-green-600" : "text-gray-400"}`}>
                  {p.status === "active" ? "활성" : p.status}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => moveItem(idx, "up")}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveItem(idx, "down")}
                    disabled={idx === properties.length - 1}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
