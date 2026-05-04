import { apiRequest } from "./api";

export interface Reservation {
  id: number;
  reservation_code: string;
  stay_code: string;
  property_id: number;
  internal_prop_id: number | null;
  channel_type: string;
  channel_name: string;
  listing_id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  status: string;
  stay_status: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  total_rate: number;
  total_commission: number;
  currency: string;
  booked_at: string;
  cancelled_at: string | null;
  remarks: string;
  conversation_id: string;
  property_name: string;
  property_code: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationListResponse {
  reservations: Reservation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  sum_rate: number;
  sum_nights: number;
}

export interface ReservationListQuery {
  page?: number;
  page_size?: number;
  status?: string;
  channel_type?: string;
  internal_prop_id?: number;
  internal_prop_ids?: string; // 콤마 구분 다중 ID
  property_id?: number;
  check_in_from?: string;
  check_in_to?: string;
  check_out_from?: string;
  check_out_to?: string;
  booked_from?: string;
  booked_to?: string;
  reservation_date_from?: string;
  reservation_date_to?: string;
  view_mode?: string;
  keyword?: string;
  unmatched_only?: boolean;
  sort_by?: string;
  sort_order?: string;
}

export interface HostexMapping {
  hostex_id: number;
  hostex_title: string;
  hostex_address: string;
  internal_prop_id: number | null;
  internal_code: string;
  internal_name: string;
  matched: boolean;
}

export interface UnmappedProperty {
  id: number;
  code: string;
  name: string;
  hostex_id: number;
}

export interface MappingResponse {
  mappings: HostexMapping[];
  unmapped_properties: UnmappedProperty[];
}

export interface WebhookLog {
  id: number;
  event: string;
  reservation_code: string;
  property_id: number;
  payload: string;
  processed_at: string;
  created_at: string;
}

export const CHANNEL_LABELS: Record<string, string> = {
  airbnb: "Airbnb",
  "booking.com": "Booking.com",
  agoda: "Agoda",
  ctrip: "Ctrip",
  expedia: "Expedia",
  "custom_channel": "직접 예약",
};

export const STATUS_LABELS: Record<string, string> = {
  accepted: "확정",
  pending: "대기",
  cancelled: "취소",
  declined: "거절",
};

export const STATUS_STYLES: Record<string, string> = {
  accepted: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-red-100 text-red-800",
  declined: "bg-gray-100 text-gray-600",
};

function buildQueryString(query: ReservationListQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.status) params.set("status", query.status);
  if (query.channel_type) params.set("channel_type", query.channel_type);
  if (query.internal_prop_ids) params.set("internal_prop_ids", query.internal_prop_ids);
  else if (query.internal_prop_id) params.set("internal_prop_id", String(query.internal_prop_id));
  if (query.property_id) params.set("property_id", String(query.property_id));
  if (query.check_in_from) params.set("check_in_from", query.check_in_from);
  if (query.check_in_to) params.set("check_in_to", query.check_in_to);
  if (query.check_out_from) params.set("check_out_from", query.check_out_from);
  if (query.check_out_to) params.set("check_out_to", query.check_out_to);
  if (query.booked_from) params.set("booked_from", query.booked_from);
  if (query.booked_to) params.set("booked_to", query.booked_to);
  if (query.view_mode) params.set("view_mode", query.view_mode);
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.unmatched_only) params.set("unmatched_only", "true");
  if (query.sort_by) params.set("sort_by", query.sort_by);
  if (query.sort_order) params.set("sort_order", query.sort_order);
  return params.toString();
}

export async function fetchReservations(query: ReservationListQuery): Promise<ReservationListResponse> {
  const qs = buildQueryString(query);
  const res = await apiRequest(`/reservations?${qs}`);
  if (!res.ok) throw new Error("예약 목록 조회 실패");
  return res.json();
}

export async function fetchReservation(id: number): Promise<Reservation> {
  const res = await apiRequest(`/reservations/${id}`);
  if (!res.ok) throw new Error("예약 조회 실패");
  return res.json();
}

export async function rematchReservations(): Promise<{ matched: number }> {
  const res = await apiRequest("/reservations/rematch", { method: "POST" });
  if (!res.ok) throw new Error("재매칭 실패");
  return res.json();
}

export async function fetchHostexMappings(): Promise<MappingResponse> {
  const res = await apiRequest("/hostex/mappings");
  if (!res.ok) throw new Error("매핑 조회 실패");
  return res.json();
}

export async function linkHostexProperty(internalPropId: number, hostexId: number): Promise<void> {
  const res = await apiRequest("/hostex/link", {
    method: "POST",
    body: JSON.stringify({ internal_prop_id: internalPropId, hostex_id: hostexId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "연결 실패");
  }
}

export async function unlinkHostexProperty(internalPropId: number): Promise<void> {
  const res = await apiRequest(`/hostex/unlink/${internalPropId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("연결 해제 실패");
}

export async function triggerInitialSync(): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL as string;
  const publicUrl = API_URL.replace("/admin", "/api");
  const res = await fetch(`${publicUrl}/webhooks/sync`, { method: "POST" });
  if (!res.ok) throw new Error("동기화 실패");
}

export async function fetchWebhookLogs(): Promise<WebhookLog[]> {
  const API_URL = import.meta.env.VITE_API_URL as string;
  const publicUrl = API_URL.replace("/admin", "/api");
  const res = await fetch(`${publicUrl}/webhooks/logs`);
  if (!res.ok) throw new Error("로그 조회 실패");
  return res.json();
}
