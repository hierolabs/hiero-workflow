import { useState, useEffect, useCallback } from "react";
import { fetchCalendarData } from "../api/calendarApi";
import type { CalendarData } from "../types/calendar";

export function useCalendarData(startDate: string, endDate: string) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCalendarData(startDate, endDate);
      if (res.success) {
        setData(res.data);
      } else {
        setError("데이터를 가져올 수 없습니다");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
