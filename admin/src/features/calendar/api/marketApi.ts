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
