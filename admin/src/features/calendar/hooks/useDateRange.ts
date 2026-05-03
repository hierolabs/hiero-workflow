import { useState, useMemo, useCallback } from "react";
import { generateDateRange, toDateString } from "../utils/date";

export function useDateRange() {
  const [baseDate, setBaseDate] = useState(() => toDateString(new Date()));

  // 3개월 범위: 기준 달의 전월 1일 ~ 다음달 말일
  const range = useMemo(() => {
    const d = new Date(baseDate + "T00:00:00");
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-based
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m + 2, 0); // last day of m+1
    return {
      start: toDateString(start),
      end: toDateString(end),
    };
  }, [baseDate]);

  const dates = useMemo(() => {
    return generateDateRange(range.start, range.end);
  }, [range]);

  const goToday = useCallback(() => {
    setBaseDate(toDateString(new Date()));
  }, []);

  const goPrev = useCallback(() => {
    const d = new Date(baseDate + "T00:00:00");
    d.setMonth(d.getMonth() - 1);
    setBaseDate(toDateString(d));
  }, [baseDate]);

  const goNext = useCallback(() => {
    const d = new Date(baseDate + "T00:00:00");
    d.setMonth(d.getMonth() + 1);
    setBaseDate(toDateString(d));
  }, [baseDate]);

  const goToDate = useCallback((dateStr: string) => {
    if (dateStr) setBaseDate(dateStr);
  }, []);

  const title = useMemo(() => {
    const d = new Date(baseDate + "T00:00:00");
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }, [baseDate]);

  return {
    baseDate,
    startDate: range.start,
    endDate: range.end,
    dates,
    title,
    goToday,
    goPrev,
    goNext,
    goToDate,
  };
}
