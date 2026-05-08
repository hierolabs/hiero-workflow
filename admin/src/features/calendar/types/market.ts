// 시장 가격 스냅샷
export interface MarketPrice {
  id: number;
  crawl_job_id: number;
  property_id?: number;
  platform: string;
  external_room_id: string;
  room_name: string;
  address: string;
  region: string;
  visibility: string;
  rent_weekly: number;
  deposit: number;
  maintenance_weekly: number;
  cleaning_fee: number;
  refund_policy: string;
  long_term_discount_raw: string;
  immediate_discount_raw: string;
  maintenance_included: string;
  snapshot_date: string;
  created_at: string;
}

// 시장 비교 결과
export interface MarketCompareResult {
  property_id: number;
  property_name: string;
  property_region: string;
  our_rent_weekly: number;
  market_avg_weekly: number;
  market_median_weekly: number;
  market_min_weekly: number;
  market_max_weekly: number;
  competitor_count: number;
  price_position: "below_avg" | "avg" | "above_avg";
  percentile: number;
  diff_percent: number;
  nearby_competitors: NearbyCompetitor[];
}

export interface NearbyCompetitor {
  room_name: string;
  address: string;
  rent_weekly: number;
  maintenance_weekly: number;
  cleaning_fee: number;
  deposit: number;
}

// 시장 요약
export interface MarketSummary {
  platform: string;
  total_rooms: number;
  avg_rent_weekly: number;
  median_rent_weekly: number;
  min_rent_weekly: number;
  max_rent_weekly: number;
  avg_maintenance: number;
  avg_cleaning_fee: number;
  latest_snapshot: string;
  by_region: RegionSummary[];
  refund_policy_counts: Record<string, number>;
}

export interface RegionSummary {
  region: string;
  count: number;
  avg_rent_weekly: number;
  min_rent_weekly: number;
  max_rent_weekly: number;
}

// 크롤링 작업
export interface CrawlJob {
  id: number;
  platform: string;
  job_type: string;
  status: string;
  source: string;
  file_name: string;
  total_records: number;
  processed_records: number;
  error_message: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}
