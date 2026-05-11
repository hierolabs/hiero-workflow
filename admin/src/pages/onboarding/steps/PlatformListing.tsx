import { useState, useEffect } from "react";
import { saveStep } from "../api";
import type { StepProps } from "./index";

const PLATFORMS = [
  { key: "airbnb", label: "Airbnb", tier: "Master" },
  { key: "33m2", label: "삼삼엠투", tier: "Fast Copy" },
  { key: "liv", label: "리브애니웨어", tier: "Fast Copy" },
  { key: "jaritalk", label: "자리톡", tier: "Fast Copy" },
  { key: "booking", label: "Booking.com", tier: "Complex" },
  { key: "agoda", label: "Agoda", tier: "Complex" },
  { key: "naver", label: "네이버", tier: "Fast Copy" },
  { key: "direct", label: "HIERO 직접", tier: "Hub" },
];

const DEPOSIT_RULES = [
  { v: "check_in", l: "체크인일" },
  { v: "check_in+1", l: "체크인+1일 (Airbnb)" },
  { v: "check_out", l: "체크아웃일 (Agoda)" },
  { v: "check_in+5", l: "체크인+5일 (자리톡)" },
];

interface PlatformForm {
  platform: string;
  platform_url: string;
  platform_name: string;
  listing_id: string;
  status: string;
  commission_rate: number;
  min_stay_nights: number;
  deposit_rule: string;
  host_name: string;
  memo: string;
  enabled: boolean;
}

export default function PlatformListing({ propertyId, data, onSaved }: StepProps) {
  const existing = ((data as Record<string, unknown>).platforms as Record<string, unknown>[]) || [];

  const [platforms, setPlatforms] = useState<PlatformForm[]>(
    PLATFORMS.map((p) => ({
      platform: p.key, platform_url: "", platform_name: "", listing_id: "",
      status: "draft", commission_rate: 0, min_stay_nights: 1,
      deposit_rule: p.key === "airbnb" ? "check_in+1" : p.key === "agoda" ? "check_out" : p.key === "jaritalk" ? "check_in+5" : "check_in",
      host_name: "", memo: "", enabled: false,
    }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlatforms((prev) => prev.map((pf) => {
      const found = existing.find((e) => (e as Record<string, unknown>).platform === pf.platform) as Record<string, unknown> | undefined;
      if (found) {
        return {
          ...pf, enabled: true,
          platform_url: (found.platform_url as string) || "",
          platform_name: (found.platform_name as string) || "",
          listing_id: (found.listing_id as string) || "",
          status: (found.status as string) || "draft",
          commission_rate: (found.commission_rate as number) || 0,
          min_stay_nights: (found.min_stay_nights as number) || 1,
          deposit_rule: (found.deposit_rule as string) || pf.deposit_rule,
          host_name: (found.host_name as string) || "",
          memo: (found.memo as string) || "",
        };
      }
      return pf;
    }));
  }, [data]);

  const setPf = (idx: number, k: string, v: unknown) => setPlatforms((prev) => prev.map((p, i) => i === idx ? { ...p, [k]: v } : p));

  const save = async () => {
    setSaving(true);
    const enabled = platforms.filter((p) => p.enabled);
    try { await saveStep(propertyId, "platform", { platforms: enabled }); onSaved(); } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {platforms.map((pf, idx) => {
        const info = PLATFORMS.find((p) => p.key === pf.platform)!;
        return (
          <div key={pf.platform} className={`border rounded-lg p-4 transition ${pf.enabled ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-gray-50/50"}`}>
            <label className="flex items-center gap-3 mb-3">
              <input type="checkbox" checked={pf.enabled} onChange={(e) => setPf(idx, "enabled", e.target.checked)} />
              <span className="text-sm font-bold text-gray-800">{info.label}</span>
              <span className="text-[10px] rounded bg-gray-200 px-1.5 py-0.5 text-gray-500">{info.tier}</span>
            </label>
            {pf.enabled && (
              <div className="grid grid-cols-2 gap-3 ml-7">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">리스팅 URL</label>
                  <input value={pf.platform_url} onChange={(e) => setPf(idx, "platform_url", e.target.value)}
                    placeholder="https://..." className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">숙소명 (플랫폼 내)</label>
                  <input value={pf.platform_name} onChange={(e) => setPf(idx, "platform_name", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">수수료율 (%)</label>
                  <input type="number" step="0.1" value={pf.commission_rate} onChange={(e) => setPf(idx, "commission_rate", Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">최소 숙박일</label>
                  <input type="number" value={pf.min_stay_nights} onChange={(e) => setPf(idx, "min_stay_nights", Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">입금 규칙</label>
                  <select value={pf.deposit_rule} onChange={(e) => setPf(idx, "deposit_rule", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
                    {DEPOSIT_RULES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상태</label>
                  <select value={pf.status} onChange={(e) => setPf(idx, "status", e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs">
                    <option value="draft">초안</option>
                    <option value="pending">등록중</option>
                    <option value="review">검토중</option>
                    <option value="active">활성</option>
                    <option value="paused">일시정지</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={save} disabled={saving}
        className="rounded-md bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
