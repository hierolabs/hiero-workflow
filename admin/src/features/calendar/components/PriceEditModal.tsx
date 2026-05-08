import { useState } from "react";
import type { DayPricing } from "../types/calendar";
import { updatePrice, updateRestrictions, updateAvailability } from "../api/calendarApi";

interface PriceEditModalProps {
  propertyId: number;
  propertyName: string;
  date: string;
  currentPricing: DayPricing;
  onClose: () => void;
  onSaved: () => void;
}

export default function PriceEditModal({
  propertyId,
  propertyName,
  date,
  currentPricing,
  onClose,
  onSaved,
}: PriceEditModalProps) {
  const [price, setPrice] = useState(currentPricing.price);
  const [minStay, setMinStay] = useState(currentPricing.min_stay);
  const [blocked, setBlocked] = useState(!currentPricing.available);
  const [endDate, setEndDate] = useState(date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceChanged = price !== currentPricing.price;
  const minStayChanged = minStay !== currentPricing.min_stay;
  const blockedChanged = blocked !== !currentPricing.available;
  const hasChanges = priceChanged || minStayChanged || blockedChanged;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (priceChanged) {
        await updatePrice(propertyId, date, endDate, price);
      }
      if (minStayChanged) {
        await updateRestrictions(propertyId, date, endDate, minStay);
      }
      if (blockedChanged) {
        await updateAvailability(propertyId, date, endDate, blocked);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}(${["일","월","화","수","목","금","토"][dt.getDay()]})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">가격 관리</h3>
          <p className="text-sm text-gray-500 mt-0.5">{propertyName}</p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* 날짜 범위 */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
              {formatDate(date)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              min={date}
              onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* 가격 */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            1박 가격
            {priceChanged && <span className="ml-1 text-blue-500">(변경됨)</span>}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">₩</span>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(parseInt(e.target.value) || 0)}
              step={1000}
              min={0}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium"
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            현재: ₩{currentPricing.price.toLocaleString()} ({(currentPricing.price / 10000).toFixed(1)}만)
          </div>
        </div>

        {/* 최소 숙박 */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            최소 숙박
            {minStayChanged && <span className="ml-1 text-blue-500">(변경됨)</span>}
          </label>
          <select
            value={minStay}
            onChange={e => setMinStay(parseInt(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {[1,2,3,4,5,6,7,14,30].map(n => (
              <option key={n} value={n}>{n}박</option>
            ))}
          </select>
        </div>

        {/* 차단 */}
        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={blocked}
              onChange={e => setBlocked(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              날짜 차단 (예약 불가)
              {blockedChanged && <span className="ml-1 text-blue-500">(변경됨)</span>}
            </span>
          </label>
          {blocked && (
            <p className="mt-1 text-[11px] text-red-400 ml-6">차단 시 모든 OTA에서 예약이 불가능합니다</p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "Hostex에 반영"}
          </button>
        </div>
      </div>
    </div>
  );
}
