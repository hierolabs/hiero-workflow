import { apiRequest } from "../../../utils/api";
import type { MarketPrice, MarketCompareResult, MarketSummary, CrawlJob } from "../types/market";

const API_URL = import.meta.env.VITE_API_URL;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 파일 업로드 (multipart/form-data)
async function uploadFile(path: string, file: File): Promise<{ success: boolean; data: CrawlJob; message?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return res.json();
}

// POST /admin/market/import/rooms
export async function importMarketRooms(file: File) {
  return uploadFile("/market/import/rooms", file);
}

// POST /admin/market/import/contracts
export async function importMarketContracts(file: File) {
  return uploadFile("/market/import/contracts", file);
}

// POST /admin/market/import/auto
export async function autoImportMarket(): Promise<{ success: boolean; data: CrawlJob; message?: string }> {
  const res = await apiRequest("/market/import/auto", { method: "POST" });
  return res.json();
}

// GET /admin/market/prices
export async function fetchMarketPrices(platform = "33m2", date?: string): Promise<{ success: boolean; data: MarketPrice[] }> {
  const params = new URLSearchParams({ platform });
  if (date) params.set("date", date);
  const res = await apiRequest(`/market/prices?${params}`);
  return res.json();
}

// GET /admin/market/compare
export async function fetchMarketComparison(platform = "33m2"): Promise<{ success: boolean; data: MarketCompareResult[] }> {
  const res = await apiRequest(`/market/compare?platform=${platform}`);
  return res.json();
}

// GET /admin/market/summary
export async function fetchMarketSummary(platform = "33m2"): Promise<{ success: boolean; data: MarketSummary }> {
  const res = await apiRequest(`/market/summary?platform=${platform}`);
  return res.json();
}

// GET /admin/market/jobs
export async function fetchCrawlJobs(limit = 20): Promise<{ success: boolean; data: CrawlJob[] }> {
  const res = await apiRequest(`/market/jobs?limit=${limit}`);
  return res.json();
}

// GET /admin/market/vacancy
export interface VacancyBooking {
  check_in: string;
  check_out: string;
  channel: string;
  guest_name: string;
  total_rate: number;
}

export interface VacancyItem {
  property_id: number;
  display_name: string;
  zone_code: string;
  building: string;
  room_type: string;
  current_booking: VacancyBooking | null;
  next_booking: VacancyBooking | null;
  vacant_days: number;
  urgency: "critical" | "warning" | "ok";
  our_avg_nightly: number;
  our_samsam_nightly: number;
  our_other_nightly: number;
  zone_avg_nightly: number;
  zone_samsam_avg: number;
  total_bookings: number;
  market_avg_weekly: number;
  market_min_weekly: number;
  market_max_weekly: number;
  competitor_count: number;
  suggested_nightly: number;
  suggested_weekly: number;
  suggested_monthly: number;
  suggested_headline: number;
  current_headline: number;
  headline_diff: number;
  maintenance_weekly: number;
  cleaning_fee: number;
  price_drop_pct: number;
  price_reason: string;
  recent_bookings_30: number;
  occupancy_rate_30: number;
}

export interface ZoneVacancy {
  zone_code: string;
  building: string;
  total: number;
  vacant: number;
  occupancy: number;
}

export interface RoomTypeVacancy {
  room_type: string;
  total: number;
  vacant: number;
  occupancy: number;
  market_avg_weekly: number;
}

export interface ZonePricing {
  zone_code: string;
  building: string;
  avg_nightly: number;
  samsam_avg: number;
  live_avg: number;
  personal_avg: number;
  airbnb_avg: number;
  airbnb_bookings: number;
  total_bookings: number;
}

export interface VacancyAnalysis {
  total_properties: number;
  vacant_now: number;
  vacant_in_7_days: number;
  critical_count: number;
  warning_count: number;
  avg_occupancy_30: number;
  items: VacancyItem[];
  zone_summary: ZoneVacancy[];
  room_type_summary: RoomTypeVacancy[];
  zone_pricing: ZonePricing[];
  market_effective: MarketEffective[];
}

export interface EffectiveCost {
  weeks: number;
  total_cost: number;
  nightly: number;
  weekly: number;
}

export interface LongTermDiscount {
  min_weeks: number;
  percent: number;
}

export interface ImmediateDiscount {
  within_days: number;
  amount: number;
}

export interface MarketEffective {
  room_name: string;
  rent_weekly: number;
  maintenance_weekly: number;
  cleaning_fee: number;
  deposit: number;
  headline_weekly: number;
  costs: EffectiveCost[];
  property_id: number | null;
  display_name: string;
  region: string;
  long_term_discounts: LongTermDiscount[] | null;
  immediate_discounts: ImmediateDiscount[] | null;
}

export async function fetchVacancyAnalysis(): Promise<{ success: boolean; data: VacancyAnalysis }> {
  const res = await apiRequest("/market/vacancy");
  return res.json();
}
