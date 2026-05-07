// ============================================================
// HIERO Operating OS — Shared Type Definitions
// ============================================================

// --- Enums ---

export type Channel = 'airbnb' | 'booking' | 'agoda' | 'samsam' | 'liveanywhere' | 'direct' | 'hostex';

export type Region = '성수' | '을지로' | '홍대' | '강남' | '잠실' | '여의도' | '마포' | '용산' | '종로' | '기타';

export type PropertyType = '원룸' | '투룸' | '쓰리룸' | '복층' | '펜트하우스' | '오피스텔';

export type PropertyStatus = 'active' | 'inactive' | 'maintenance' | 'closed';

export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export type CleaningStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'skipped';

export type IssueCategory = 'noise' | 'facility' | 'cleanliness' | 'amenity' | 'neighbor' | 'safety' | 'other';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SettlementStatus = 'pending' | 'partial' | 'completed' | 'disputed';

export type UserRole =
  | 'super_admin'
  | 'ceo'
  | 'cto'
  | 'cfo'
  | 'operations'
  | 'cleaning_manager'
  | 'marketing'
  | 'field_manager';

// 최신 조직구조
export type RoleLayer = 'founder' | 'etf' | 'execution' | 'external';
export type RoleTitle = 'founder' | 'ceo' | 'cto' | 'cfo' | 'marketing' | 'operations' | 'cleaning_dispatch' | 'field';

// --- Core Models ---

export interface Property {
  id: number;
  code: string;
  name: string;
  hostex_id: string;
  region: Region;
  address: string;
  property_type: PropertyType;
  status: PropertyStatus;
  owner_name: string;
  monthly_rent: number;
  management_fee: number;
  cleaning_fee: number;
  created_at: string;
}

export interface Reservation {
  id: number;
  reservation_code: string;
  property_id: number;
  property_name: string;
  channel: Channel;
  guest_name: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount: number;
  commission: number;
  net_amount: number;
  status: ReservationStatus;
  booked_at: string;   // 예약일
  paid_at: string;     // 입금일
  created_at: string;
}

export interface Settlement {
  id: number;
  reservation_id: number;
  property_id: number;
  property_name: string;
  channel: Channel;
  guest_name: string;
  total_amount: number;
  commission: number;
  cleaning_cost: number;
  extra_cost: number;
  net_amount: number;
  booked_at: string;
  paid_at: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: SettlementStatus;
  // 3가지 매출 기준
  revenue_by_booking_date: number;    // 예약일 기준
  revenue_by_payment_date: number;    // 입금일 기준
  revenue_by_stay_date: number;       // 숙박일 1/N 분할
  stay_date_breakdown: { date: string; amount: number }[];
}

export interface CleaningTask {
  id: number;
  reservation_id: number;
  property_id: number;
  property_name: string;
  cleaner_name: string;
  cleaner_phone: string;
  scheduled_date: string;
  check_in_time: string;
  status: CleaningStatus;
  cleaning_code: string;
  cleaning_fee: number;
  extra_cost: number;
  notes: string;
  photos_before: number;
  photos_after: number;
  completed_at: string | null;
}

export interface Issue {
  id: number;
  property_id: number;
  property_name: string;
  reservation_id: number | null;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  title: string;
  description: string;
  reporter: string;
  assignee: string;
  cost: number;
  created_at: string;
  resolved_at: string | null;
}

export interface TeamMember {
  id: number;
  name: string;
  login_id: string;
  role: UserRole;
  phone: string;
  assigned_regions: Region[];
  managed_properties: number;
  active_issues: number;
  cleaning_tasks_today: number;
  kpi_score: number;
}

// --- Dashboard KPI ---

export interface DashboardKPI {
  total_properties: number;
  revenue_by_booking: number;     // 이번 달 예약일 기준 매출
  revenue_by_payment: number;     // 이번 달 입금일 기준 매출
  revenue_by_stay: number;        // 이번 달 숙박일 분할 매출
  avg_occupancy: number;          // 평균 가동률 (%)
  adr: number;                    // Average Daily Rate
  unsettled_amount: number;       // 미정산 금액
  problem_properties: number;     // 문제 숙소 수
}

export interface MonthlyRevenue {
  month: string;
  booking_revenue: number;
  payment_revenue: number;
  stay_revenue: number;
}

export interface ChannelRevenue {
  channel: Channel;
  revenue: number;
  bookings: number;
  share: number;
}

export interface RegionOccupancy {
  region: Region;
  occupancy: number;
  properties: number;
}

export interface PropertyProfit {
  property_id: number;
  property_name: string;
  region: Region;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  share: number;
}

export interface CleaningStats {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  skipped: number;
  completion_rate: number;
}

export interface ReservationStatusDist {
  status: ReservationStatus;
  count: number;
}

// --- Filters ---

export interface DashboardFilters {
  month: string;
  channel: Channel | 'all';
  region: Region | 'all';
  property_type: PropertyType | 'all';
}

// --- Role Access ---

export interface MenuItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}
