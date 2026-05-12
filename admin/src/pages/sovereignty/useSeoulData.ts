import { useState, useEffect } from "react";

export interface SeoulPlace {
  id?: string;
  name: string;
  address: string;
  district: string;
  dong?: string;
  category?: string;
  industry?: string;
  industryRaw?: string;
  type: "restaurant" | "attraction";
  phone: string;
  hours?: string;
  web: string;
  url?: string;
  subway?: string;
  tag?: string;
  lang?: string;
  gaps: string[];
  gapCount: number;
}

export interface CultureEvent {
  title: string;
  category: string;
  district: string;
  place: string;
  date: string;
  fee: string;
  lat: number | null;
  lng: number | null;
}

export interface DongStat {
  total: number;
  noPhone: number;
  noWeb: number;
}

export interface DistrictStat {
  total: number;
  noPhone: number;
  noWeb: number;
  blind: number;
  partial: number;
  ok: number;
  restaurants: number;
  attractions: number;
  dongs: Record<string, DongStat>;
}

export interface IndustryStat {
  total: number;
  noPhone: number;
  noWeb: number;
}

export interface CategoryStat {
  total: number;
  blind: number;
  partial: number;
  ok: number;
}

export interface StoreStats {
  quarter: string;
  totalStores: number;
  byGu: Record<string, { total: number; industries: Record<string, number> }>;
  topIndustries: { name: string; count: number }[];
}

export interface TotalStats {
  totalPlaces: number;
  totalRestaurants: number;
  totalAttractions: number;
  noPhone: number;
  noWeb: number;
  blind: number;
  partial: number;
  ok: number;
  storeStatsTotal: number;
  storeStatsQuarter: string;
  cultureTotal: number;
}

export interface SeoulData {
  generatedAt: string;
  area: string;
  stats: TotalStats;
  districtStats: Record<string, DistrictStat>;
  industryStats: Record<string, IndustryStat>;
  categoryStats: Record<string, CategoryStat>;
  storeStats: StoreStats;
  restaurants: SeoulPlace[];
  attractions: SeoulPlace[];
  culture: CultureEvent[];
}

export function useSeoulData() {
  const [data, setData] = useState<SeoulData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/seoul-data.json")
      .then(res => {
        if (!res.ok) throw new Error("데이터 로드 실패");
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/** 전체 음식점 데이터 (14MB, on-demand 로드) */
export function useRestaurantData() {
  const [data, setData] = useState<SeoulPlace[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (data || loading) return;
    setLoading(true);
    fetch("/data/restaurants.json")
      .then(res => res.json())
      .then(d => setData(d.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return { data, loading, error, load };
}
