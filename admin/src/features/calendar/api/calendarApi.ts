import { apiRequest } from "../../../utils/api";
import type {
  CalendarApiResponse,
  ReservationDetailResponse,
  CleaningTask,
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

export async function triggerSync(): Promise<void> {
  // Sync endpoint is on /api path, not /admin
  const res = await fetch("http://localhost:8080/api/webhooks/sync", { method: "POST" });
  if (!res.ok) throw new Error("동기화에 실패했습니다");
}
