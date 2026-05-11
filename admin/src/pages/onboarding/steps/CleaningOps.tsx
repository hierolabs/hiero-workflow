import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

interface CleaningCodeForm {
  code: string; region_code: string; region_name: string; building_name: string;
  room_name: string; room_count: number; base_price: number; memo: string;
}

export default function CleaningOps({ propertyId, data, onSaved }: StepProps) {
  const existing = ((data as Record<string, unknown>).cleaning_codes as Record<string, unknown>[]) || [];

  const [codes, setCodes] = useState<CleaningCodeForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing.length > 0) {
      setCodes(existing.map((e) => ({
        code: (e.code as string) || "", region_code: (e.region_code as string) || "",
        region_name: (e.region_name as string) || "", building_name: (e.building_name as string) || "",
        room_name: (e.room_name as string) || "", room_count: (e.room_count as number) || 1,
        base_price: (e.base_price as number) || 0, memo: (e.memo as string) || "",
      })));
    }
  }, [data]);

  const addCode = () => setCodes((prev) => [...prev, {
    code: "", region_code: "", region_name: "", building_name: "", room_name: "", room_count: 1, base_price: 0, memo: "",
  }]);

  const removeCode = (idx: number) => setCodes((prev) => prev.filter((_, i) => i !== idx));
  const setCode = (idx: number, k: string, v: unknown) => setCodes((prev) => prev.map((c, i) => i === idx ? { ...c, [k]: v } : c));

  const save = async () => {
    setSaving(true);
    try { await saveStep(propertyId, "cleaning", { cleaning_codes: codes }); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">청소 코드</h3>
        <button onClick={addCode} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
          + 추가
        </button>
      </div>

      {codes.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">청소 코드가 없습니다. "추가"를 눌러 등록하세요.</p>
      )}

      {codes.map((cc, idx) => (
        <div key={idx} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">코드 #{idx + 1}</span>
            <button onClick={() => removeCode(idx)} className="text-xs text-red-500 hover:text-red-700">삭제</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">코드</label>
              <input value={cc.code} onChange={(e) => setCode(idx, "code", e.target.value)}
                placeholder="예: GN-01" className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">지역 코드</label>
              <input value={cc.region_code} onChange={(e) => setCode(idx, "region_code", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">지역명</label>
              <input value={cc.region_name} onChange={(e) => setCode(idx, "region_name", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">건물명</label>
              <input value={cc.building_name} onChange={(e) => setCode(idx, "building_name", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">호실</label>
              <input value={cc.room_name} onChange={(e) => setCode(idx, "room_name", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">룸카운트</label>
              <input type="number" step="0.5" value={cc.room_count} onChange={(e) => setCode(idx, "room_count", Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">기본 청소 단가</label>
              <input type="number" value={cc.base_price} onChange={(e) => setCode(idx, "base_price", Number(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">메모</label>
              <input value={cc.memo} onChange={(e) => setCode(idx, "memo", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
        </div>
      ))}

      <button onClick={save} disabled={saving}
        className="rounded-md bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
