import { apiRequest } from "./api";

export interface Property {
  id: number;
  code: string;
  name: string;
  hostex_id: number;
  region: string;
  address: string;
  detail_address: string;
  property_type: string;
  room_type: string;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  monthly_rent: number;
  management_fee: number;
  deposit: number;
  status: string;
  operation_status: string;
  check_in_time: string;
  check_out_time: string;
  operation_type: string;
  tax_category: string;
  license_status: string;
  contract_type: string;
  owner_name: string;
  memo: string;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyListResponse {
  properties: Property[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PropertyListQuery {
  page?: number;
  page_size?: number;
  region?: string;
  status?: string;
  operation_status?: string;
  property_type?: string;
  room_type?: string;
  keyword?: string;
}

export interface CreatePropertyPayload {
  code: string;
  name: string;
  region: string;
  address: string;
  detail_address: string;
  property_type: string;
  room_type: string;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  monthly_rent: number;
  management_fee: number;
  deposit: number;
  check_in_time: string;
  check_out_time: string;
  operation_type: string;
  tax_category: string;
  license_status: string;
  contract_type: string;
  owner_name: string;
  memo: string;
}

export type UpdatePropertyPayload = Omit<CreatePropertyPayload, "code">;

export const OPERATION_TYPES = ["MID_TERM_SUBLEASE", "LICENSED_AIRBNB", "WEHOME_SPECIAL", "FOREIGN_TOURIST_HOMESTAY", "UNLICENSED_RISK", "MIXED"] as const;
export const TAX_CATEGORIES = ["VAT_EXEMPT_RENT", "VAT_TAXABLE_LODGING", "VAT_TAXABLE_SERVICE", "COMMON_COST"] as const;
export const LICENSE_STATUSES = ["NONE", "PENDING", "APPROVED", "EXPIRED"] as const;
export const CONTRACT_TYPES = ["SUBLEASE_CONTRACT", "PLATFORM_BOOKING", "SERVICE_CONTRACT"] as const;

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  MID_TERM_SUBLEASE: "중단기 전대",
  LICENSED_AIRBNB: "허가형 비엔비",
  WEHOME_SPECIAL: "위홈 실증특례",
  FOREIGN_TOURIST_HOMESTAY: "외국인관광도시민박",
  UNLICENSED_RISK: "무허가 위험",
  MIXED: "혼합(전대+숙박)",
};

export const TAX_CATEGORY_LABELS: Record<string, string> = {
  VAT_EXEMPT_RENT: "면세 (전대임대료)",
  VAT_TAXABLE_LODGING: "과세 (숙박매출)",
  VAT_TAXABLE_SERVICE: "과세 (서비스)",
  COMMON_COST: "공통비",
};

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  NONE: "없음",
  PENDING: "신청중",
  APPROVED: "승인",
  EXPIRED: "만료",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SUBLEASE_CONTRACT: "전대차계약",
  PLATFORM_BOOKING: "플랫폼예약",
  SERVICE_CONTRACT: "서비스계약",
};

export const PROPERTY_STATUSES = ["preparing", "active", "paused", "closed"] as const;
export const OPERATION_STATUSES = ["inactive", "available", "occupied", "maintenance", "blocked"] as const;
export const PROPERTY_TYPES = ["apartment", "officetel", "villa", "house", "studio"] as const;
export const ROOM_TYPES = ["entire", "private", "shared"] as const;

export const STATUS_LABELS: Record<string, string> = {
  preparing: "준비 중",
  active: "운영 중",
  paused: "일시 중지",
  closed: "운영 종료",
};

export const OPERATION_STATUS_LABELS: Record<string, string> = {
  inactive: "미운영",
  available: "판매 가능",
  occupied: "투숙 중",
  maintenance: "점검 중",
  blocked: "판매 차단",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "아파트",
  officetel: "오피스텔",
  villa: "빌라",
  house: "주택",
  studio: "원룸",
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  entire: "집 전체",
  private: "개인실",
  shared: "다인실",
};

export const REGION_LABELS: Record<string, string> = {
  gangdong: "강동구",
  gangnam: "강남구",
  songpa: "송파구",
  seocho: "서초구",
  jongno: "종로구",
  mapo: "마포구",
  yongsan: "용산구",
  seongdong: "성동구",
};

function buildQueryString(query: PropertyListQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.region) params.set("region", query.region);
  if (query.status) params.set("status", query.status);
  if (query.operation_status) params.set("operation_status", query.operation_status);
  if (query.property_type) params.set("property_type", query.property_type);
  if (query.room_type) params.set("room_type", query.room_type);
  if (query.keyword) params.set("keyword", query.keyword);
  return params.toString();
}

export async function fetchProperties(query: PropertyListQuery): Promise<PropertyListResponse> {
  const qs = buildQueryString(query);
  const res = await apiRequest(`/properties?${qs}`);
  if (!res.ok) throw new Error("목록 조회 실패");
  return res.json();
}

export async function fetchProperty(id: number): Promise<Property> {
  const res = await apiRequest(`/properties/${id}`);
  if (!res.ok) throw new Error("조회 실패");
  return res.json();
}

export async function createProperty(payload: CreatePropertyPayload): Promise<Property> {
  const res = await apiRequest("/properties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "생성 실패");
  }
  return res.json();
}

export async function updateProperty(id: number, payload: UpdatePropertyPayload): Promise<Property> {
  const res = await apiRequest(`/properties/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "수정 실패");
  }
  return res.json();
}

export async function deleteProperty(id: number): Promise<void> {
  const res = await apiRequest(`/properties/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제 실패");
}

export async function updatePropertyStatus(id: number, status: string): Promise<Property> {
  const res = await apiRequest(`/properties/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "상태 변경 실패");
  }
  return res.json();
}

export async function updatePropertyOperationStatus(id: number, operation_status: string): Promise<Property> {
  const res = await apiRequest(`/properties/${id}/operation-status`, {
    method: "PATCH",
    body: JSON.stringify({ operation_status }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "운영 상태 변경 실패");
  }
  return res.json();
}
