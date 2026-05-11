import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

export default function CostStructure({ propertyId, data, onSaved }: StepProps) {
  const cost = (data as Record<string, unknown>).cost as Record<string, unknown> || {};

  const [form, setForm] = useState({
    owner_type: "LEASED", rent: 0, rent_recipient: "", deposit: 0, rent_memo: "",
    consigned_fixed_pay: 0, revenue_linked: false, revenue_percent: 0, revenue_basis: "NET",
    loan_interest: 0, depreciation: 0, annual_tax: 0,
    utilities: {
      management_fee: { mode: "FIXED", amount: 0 }, internet: { mode: "FIXED", amount: 0 },
      electric: { mode: "VARIABLE", amount: 0 }, gas: { mode: "VARIABLE", amount: 0 },
      water: { mode: "VARIABLE", amount: 0 }, insurance: { mode: "FIXED", amount: 0 },
      other_utility: { mode: "FIXED", amount: 0 },
    } as Record<string, { mode: string; amount: number }>,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cost && Object.keys(cost).length > 0) {
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(Object.entries(cost).filter(([k, v]) => v != null && k !== "id" && k !== "property_id" && k !== "created_at" && k !== "updated_at")),
        utilities: (cost.utilities as Record<string, { mode: string; amount: number }>) || f.utilities,
      }));
    }
  }, [data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setUtil = (key: string, field: string, v: unknown) => setForm((f) => ({
    ...f, utilities: { ...f.utilities, [key]: { ...f.utilities[key], [field]: v } },
  }));

  const save = async () => {
    setSaving(true);
    try { await saveStep(propertyId, "cost", form); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  const utilLabels: Record<string, string> = {
    management_fee: "관리비", internet: "인터넷", electric: "전기", gas: "가스",
    water: "수도", insurance: "보험", other_utility: "기타",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">소유 구조</label>
          <select value={form.owner_type} onChange={(e) => set("owner_type", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="LEASED">임차</option>
            <option value="CONSIGNED">위탁</option>
            <option value="REVENUE_SHARE">수익배분</option>
            <option value="OWNED">자가</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">월세</label>
          <input type="number" value={form.rent} onChange={(e) => set("rent", Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">보증금</label>
          <input type="number" value={form.deposit} onChange={(e) => set("deposit", Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">수령인</label>
          <input value={form.rent_recipient} onChange={(e) => set("rent_recipient", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input value={form.rent_memo} onChange={(e) => set("rent_memo", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {(form.owner_type === "CONSIGNED" || form.owner_type === "REVENUE_SHARE") && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-bold text-gray-700 mb-3">위탁/배당 조건</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">고정 지급액</label>
              <input type="number" value={form.consigned_fixed_pay} onChange={(e) => set("consigned_fixed_pay", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm pt-5">
              <input type="checkbox" checked={form.revenue_linked} onChange={(e) => set("revenue_linked", e.target.checked)} />
              매출 연동
            </label>
            {form.revenue_linked && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연동 비율 (%)</label>
                  <input type="number" value={form.revenue_percent} onChange={(e) => set("revenue_percent", Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {form.owner_type === "OWNED" && (
        <div className="border-t pt-4">
          <h4 className="text-xs font-bold text-gray-700 mb-3">자가 비용</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">대출이자 (월)</label>
              <input type="number" value={form.loan_interest} onChange={(e) => set("loan_interest", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">감가상각 (월)</label>
              <input type="number" value={form.depreciation} onChange={(e) => set("depreciation", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">연간 세금</label>
              <input type="number" value={form.annual_tax} onChange={(e) => set("annual_tax", Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <h4 className="text-xs font-bold text-gray-700 mb-3">공과금</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(utilLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-16 shrink-0">{label}</span>
              <select value={form.utilities[key]?.mode || "FIXED"} onChange={(e) => setUtil(key, "mode", e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs w-20">
                <option value="FIXED">고정</option>
                <option value="VARIABLE">변동</option>
              </select>
              <input type="number" value={form.utilities[key]?.amount || 0} onChange={(e) => setUtil(key, "amount", Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs flex-1" placeholder="금액" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-md bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
