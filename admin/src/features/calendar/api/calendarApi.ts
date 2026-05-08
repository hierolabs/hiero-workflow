import { apiRequest } from "../../../utils/api";
import type {
  CalendarApiResponse,
  ReservationDetailResponse,
  CleaningTask,
  PricingMap,
} from "../types/calendar";

export async function fetchCalendarData(
  start: string,
  end: string
): Promise<CalendarApiResponse> {
  const res = await apiRequest(`/calendar?start=${start}&end=${end}`);
  if (!res.ok) throw new Error("캘린더 데이터를 가져올 수 없습니다");
  return res.json();
}

export async function fetchDailySummary(date: string) {
  const res = await apiRequest(`/calendar/summary?date=${date}`);
  if (!res.ok) throw new Error("요약 데이터를 가져올 수 없습니다");
  return res.json();
}

export async function fetchReservationDetail(
  id: number
): Promise<ReservationDetailResponse> {
  const res = await apiRequest(`/reservations/${id}`);
  if (!res.ok) throw new Error("예약 정보를 가져올 수 없습니다");
  return res.json();
}

export async function fetchCleaningTasks(
  date: string
): Promise<{ success: boolean; data: CleaningTask[] }> {
  const res = await apiRequest(`/cleaning-tasks?date=${date}`);
  if (!res.ok) throw new Error("청소 작업을 가져올 수 없습니다");
  return res.json();
}

export async function updateCleaningTaskStatus(
  taskId: number,
  status: string
): Promise<void> {
  const res = await apiRequest(`/cleaning-tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("청소 작업 상태를 변경할 수 없습니다");
}

// --- 가격/캘린더 API ---

export async function fetchPricingData(
  start: string,
  end: string
): Promise<{ success: boolean; data: PricingMap }> {
  const res = await apiRequest(`/pricing/calendar?start=${start}&end=${end}`);
  if (!res.ok) throw new Error("가격 데이터를 가져올 수 없습니다");
  return res.json();
}

export async function updatePrice(
  propertyId: number,
  startDate: string,
  endDate: string,
  price: number
): Promise<void> {
  const res = await apiRequest("/pricing/price", {
    method: "PUT",
    body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate, price }),
  });
  if (!res.ok) throw new Error("가격 변경에 실패했습니다");
}

export async function updateRestrictions(
  propertyId: number,
  startDate: string,
  endDate: string,
  minStay: number
): Promise<void> {
  const res = await apiRequest("/pricing/restrictions", {
    method: "PUT",
    body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate, min_stay: minStay }),
  });
  if (!res.ok) throw new Error("최소숙박 변경에 실패했습니다");
}

export async function updateAvailability(
  propertyId: number,
  startDate: string,
  endDate: string,
  blocked: boolean
): Promise<void> {
  const res = await apiRequest("/pricing/availability", {
    method: "PUT",
    body: JSON.stringify({ property_id: propertyId, start_date: startDate, end_date: endDate, blocked }),
  });
  if (!res.ok) throw new Error("가용성 변경에 실패했습니다");
}

// --- PriceLabs 비교 API ---

export interface PriceCompareDay {
  hostex_price: number;
  pricelabs_price: number;
  ai_recommended: number;
  diff_percent: number;
  min_stay: number;
  booking_status: string;
  booking_status_stly: string;
  adr: number;
  adr_stly: number;
  demand_color: string;
  demand_desc: string;
  available: boolean;
}

export type PriceCompareMap = Record<number, Record<string, PriceCompareDay>>;

export async function fetchPriceComparison(
  start: string,
  end: string
): Promise<{ success: boolean; data: PriceCompareMap }> {
  const res = await apiRequest(`/pricelabs/compare?start=${start}&end=${end}`);
  if (!res.ok) throw new Error("가격 비교 데이터를 가져올 수 없습니다");
  return res.json();
}

export async function syncPriceLabs(): Promise<void> {
  const res = await apiRequest("/pricelabs/sync", { method: "POST" });
  if (!res.ok) throw new Error("PriceLabs 동기화에 실패했습니다");
}

export async function triggerSync(): Promise<void> {
  // Sync endpoint is on /api path, not /admin
  const res = await fetch("http://localhost:8080/api/webhooks/sync", { method: "POST" });
  if (!res.ok) throw new Error("동기화에 실패했습니다");
}
