export type Channel =
  | "airbnb"
  | "booking"
  | "agoda"
  | "samsam"
  | "live"
  | "direct"
  | "unknown";

export type RoomStatus =
  | "in_house"
  | "vacant"
  | "closed"
  | "checkin_today"
  | "checkout_today"
  | "turnover_today"
  | "needs_cleaning"
  | "cleaning_done"
  | "issue_open";

export type CheckStatus = "pending" | "completed";

export type CleaningPriority = "normal" | "high";
export type CleaningStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface CalendarProperty {
  id: number;
  code: string;
  name: string;
  hostex_id: number;
  region?: string;
  room_type?: string;
  operation_status: string;
  today_status: RoomStatus;
}

export interface CalendarReservation {
  id: number;
  reservation_code: string;
  property_id: number;
  internal_prop_id: number | null;
  guest_name: string;
  channel_type: string;
  channel_name: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_rate?: number;
  status: string;
  stay_status: string;
  needs_cleaning: boolean;
}

export interface CalendarDailySummary {
  today_checkins: number;
  today_checkouts: number;
  turnover: number;
  checkin_completed: number;
  checkout_completed: number;
  in_house: number;
  vacant: number;
  closed: number;
  tomorrow_checkins: number;
  tomorrow_need_confirm: number;
}

export interface CalendarData {
  summary: CalendarDailySummary;
  properties: CalendarProperty[];
  reservations: CalendarReservation[];
}

export interface CalendarApiResponse {
  success: boolean;
  message: string;
  data: CalendarData;
}

export interface ReservationDetailResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    hostex_reservation_id: string;
    property_id: number;
    property: {
      id: number;
      name: string;
      region: string;
      room_type: string;
    };
    guest_name: string;
    guest_phone: string;
    guest_email: string;
    channel: Channel;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    amount: number;
    currency: string;
    status: string;
    checkin_status: CheckStatus;
    checkout_status: CheckStatus;
    memo: string;
  };
}

export interface CleaningTask {
  id: number;
  property_id: number;
  property_name: string;
  date: string;
  priority: CleaningPriority;
  status: CleaningStatus;
  note: string;
  completed_at?: string;
}

export type StatusFilter =
  | "all"
  | "in_house"
  | "checkin_today"
  | "checkout_today"
  | "turnover_today"
  | "vacant"
  | "closed";

