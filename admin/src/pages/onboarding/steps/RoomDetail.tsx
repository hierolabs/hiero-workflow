import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

export default function RoomDetail({ propertyId, data, onSaved }: StepProps) {
  const p = (data as Record<string, unknown>).property as Record<string, unknown> || {};
  const pk = (data as Record<string, unknown>).parking as Record<string, unknown> || {};

  const [form, setForm] = useState({
    bed_type: "", tv_type: "", entrance_password: "", room_password: "", management_office: "",
    parking: {
      building_name: "", self_parking: false, street_parking: false, mechanical_spec: "",
      public_parking: "", public_parking_rate: "", daily_charge: 0, monthly_charge: 0,
      remote_fee: 0, management_company: "", memo: "",
    },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((f) => ({
      bed_type: (p.bed_type as string) || f.bed_type,
      tv_type: (p.tv_type as string) || f.tv_type,
      entrance_password: (p.entrance_password as string) || f.entrance_password,
      room_password: (p.room_password as string) || f.room_password,
      management_office: (p.management_office as string) || f.management_office,
      parking: { ...f.parking, ...Object.fromEntries(Object.entries(pk).filter(([, v]) => v != null && v !== "" && v !== 0)) },
    }));
  }, [data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setPk = (k: string, v: unknown) => setForm((f) => ({ ...f, parking: { ...f.parking, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try { await saveStep(propertyId, "room", form); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-gray-700">공간 정보</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">침대 타입</label>
          <input value={form.bed_type} onChange={(e) => set("bed_type", e.target.value)}
            placeholder="싱글, 더블, 퀸, 킹, 이층침대 등" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">TV 타입</label>
          <input value={form.tv_type} onChange={(e) => set("tv_type", e.target.value)}
            placeholder="스마트TV 55인치, 없음 등" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">현관 비밀번호</label>
          <input value={form.entrance_password} onChange={(e) => set("entrance_password", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">방 비밀번호</label>
          <input value={form.room_password} onChange={(e) => set("room_password", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">관리사무소</label>
          <input value={form.management_office} onChange={(e) => set("management_office", e.target.value)}
            placeholder="연락처 / 위치" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-700 pt-4">주차 정보</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">건물명</label>
          <input value={form.parking.building_name} onChange={(e) => setPk("building_name", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-5">
          <input type="checkbox" checked={form.parking.self_parking} onChange={(e) => setPk("self_parking", e.target.checked)} />
          자체 주차장
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-5">
          <input type="checkbox" checked={form.parking.street_parking} onChange={(e) => setPk("street_parking", e.target.checked)} />
          노상 주차 가능
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">기계식 사양</label>
          <input value={form.parking.mechanical_spec} onChange={(e) => setPk("mechanical_spec", e.target.value)}
            placeholder="높이 155cm 이하 등" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">공영주차장</label>
          <input value={form.parking.public_parking} onChange={(e) => setPk("public_parking", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">일 주차료</label>
          <input type="number" value={form.parking.daily_charge} onChange={(e) => setPk("daily_charge", Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-md bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
