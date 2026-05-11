import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

export default function BasicInfo({ propertyId, data, onSaved }: StepProps) {
  const p = (data as Record<string, unknown>).property as Record<string, unknown> || {};
  const [form, setForm] = useState({
    name: "", region: "", address: "", detail_address: "", building_name: "",
    property_type: "", room_type: "", max_guests: 2, bedrooms: 1, beds: 1, bathrooms: 1,
    check_in_time: "15:00", check_out_time: "11:00", grade: "",
    operation_type: "", tax_category: "", license_status: "", contract_type: "", owner_name: "", memo: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== "")) }));
  }, [data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await saveStep(propertyId, "basic", form); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  const Field = ({ label, name, type = "text", options }: { label: string; name: string; type?: string; options?: { v: string; l: string }[] }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {options ? (
        <select value={(form as Record<string, unknown>)[name] as string || ""} onChange={(e) => set(name, e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">선택</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : type === "number" ? (
        <input type="number" value={(form as Record<string, unknown>)[name] as number || 0} onChange={(e) => set(name, Number(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      ) : (
        <input type={type} value={(form as Record<string, unknown>)[name] as string || ""} onChange={(e) => set(name, e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="숙소명" name="name" />
        <Field label="지역" name="region" />
        <div className="col-span-2"><Field label="주소" name="address" /></div>
        <Field label="상세주소" name="detail_address" />
        <Field label="건물명" name="building_name" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="숙소 유형" name="property_type" options={[
          { v: "apartment", l: "아파트" }, { v: "officetel", l: "오피스텔" }, { v: "villa", l: "빌라" },
          { v: "house", l: "주택" }, { v: "studio", l: "원룸" }, { v: "other", l: "기타" },
        ]} />
        <Field label="룸 타입" name="room_type" options={[
          { v: "entire", l: "집 전체" }, { v: "private", l: "개인실" }, { v: "shared", l: "공유방" },
        ]} />
        <Field label="등급" name="grade" options={[
          { v: "S", l: "S (프리미엄)" }, { v: "D", l: "D (디럭스)" }, { v: "P", l: "P (파퓰러)" },
        ]} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Field label="최대 인원" name="max_guests" type="number" />
        <Field label="침실 수" name="bedrooms" type="number" />
        <Field label="침대 수" name="beds" type="number" />
        <Field label="욕실 수" name="bathrooms" type="number" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="체크인 시간" name="check_in_time" type="time" />
        <Field label="체크아웃 시간" name="check_out_time" type="time" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="운영 형태" name="operation_type" options={[
          { v: "consignment", l: "위탁운영" }, { v: "sublease", l: "전대차" }, { v: "revenue_share", l: "수익배분" },
          { v: "master_lease", l: "마스터리스" }, { v: "owned", l: "자가운영" }, { v: "other", l: "기타" },
        ]} />
        <Field label="세무 분류" name="tax_category" options={[
          { v: "VAT_EXEMPT_RENT", l: "면세 (주거임대)" }, { v: "VAT_TAXABLE_LODGING", l: "과세 (숙박)" },
          { v: "SIMPLIFIED_TAX", l: "간이과세" }, { v: "GENERAL_TAX", l: "일반과세" },
        ]} />
        <Field label="인허가 상태" name="license_status" options={[
          { v: "not_required", l: "불필요" }, { v: "pending", l: "신청중" },
          { v: "approved", l: "허가완료" }, { v: "rejected", l: "반려" },
        ]} />
        <Field label="계약 형태" name="contract_type" options={[
          { v: "monthly", l: "월세" }, { v: "jeonse", l: "전세" }, { v: "owned", l: "자가" },
        ]} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="소유자/건물주명" name="owner_name" />
        <Field label="메모" name="memo" />
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-md bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
