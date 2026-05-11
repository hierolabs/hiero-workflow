import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

export default function Settlement({ propertyId, data, onSaved }: StepProps) {
  const inv = (data as Record<string, unknown>).investor as Record<string, unknown> || {};
  const pi = (data as Record<string, unknown>).property_investor as Record<string, unknown> || {};

  const [form, setForm] = useState({
    investor: { name: "", phone: "", account_holder: "", bank_name: "", account_number: "", memo: "" },
    ownership_type: "consignment", contract_start: "", contract_end: "",
    rent_amount: 0, commission_rate: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inv && Object.keys(inv).length > 0) {
      setForm((f) => ({
        ...f,
        investor: {
          name: (inv.name as string) || "", phone: (inv.phone as string) || "",
          account_holder: (inv.account_holder as string) || "", bank_name: (inv.bank_name as string) || "",
          account_number: (inv.account_number as string) || "", memo: (inv.memo as string) || "",
        },
        ownership_type: (pi.ownership_type as string) || f.ownership_type,
        contract_start: (pi.contract_start as string)?.slice(0, 10) || "",
        contract_end: (pi.contract_end as string)?.slice(0, 10) || "",
        rent_amount: (pi.rent_amount as number) || 0,
        commission_rate: (pi.commission_rate as number) || 0,
      }));
    }
  }, [data]);

  const setInv = (k: string, v: string) => setForm((f) => ({ ...f, investor: { ...f.investor, [k]: v } }));
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await saveStep(propertyId, "settlement", form); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-gray-700">건물주/투자자 정보</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
          <input value={form.investor.name} onChange={(e) => setInv("name", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
          <input value={form.investor.phone} onChange={(e) => setInv("phone", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">예금주</label>
          <input value={form.investor.account_holder} onChange={(e) => setInv("account_holder", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">은행</label>
          <input value={form.investor.bank_name} onChange={(e) => setInv("bank_name", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">계좌번호</label>
          <input value={form.investor.account_number} onChange={(e) => setInv("account_number", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input value={form.investor.memo} onChange={(e) => setInv("memo", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-700 pt-4">정산 조건</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">소유 형태</label>
          <select value={form.ownership_type} onChange={(e) => set("ownership_type", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="direct">직접 소유</option>
            <option value="sublease">전대차</option>
            <option value="consignment">위탁운영</option>
            <option value="mixed">혼합</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">수수료율 (%)</label>
          <input type="number" step="0.1" value={form.commission_rate} onChange={(e) => set("commission_rate", Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">계약 시작</label>
          <input type="date" value={form.contract_start} onChange={(e) => set("contract_start", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">계약 종료</label>
          <input type="date" value={form.contract_end} onChange={(e) => set("contract_end", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">월 임대료</label>
          <input type="number" value={form.rent_amount} onChange={(e) => set("rent_amount", Number(e.target.value))}
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
