import { useState, useEffect, useCallback } from "react";
import { fetchPricingData } from "../api/calendarApi";
import type { PricingMap } from "../types/calendar";

export function usePricingData(startDate: string, endDate: string) {
  const [pricing, setPricing] = useState<PricingMap>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await fetchPricingData(startDate, endDate);
      if (res.success && res.data) {
        // Go JSON은 map[uint] 키를 문자열로 직렬화 → 숫자 키로 변환
        const normalized: PricingMap = {};
        for (const [k, v] of Object.entries(res.data)) {
          normalized[Number(k)] = v;
        }
        setPricing(normalized);
      }
    } catch {
      // 가격 로딩 실패 시 빈 상태 유지 (캘린더는 정상 표시)
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { pricing, pricingLoading: loading, reloadPricing: load };
}
