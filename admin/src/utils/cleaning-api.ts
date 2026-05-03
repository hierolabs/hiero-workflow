import { apiRequest } from "./api";

export interface CleaningTask {
  id: number;
  property_id: number | null;
  reservation_id: number | null;
  reservation_code: string;
  cleaning_date: string;
  check_out_time: string;
  next_check_in: string;
  cleaner_id: number | null;
  cleaner_name: string;
  status: string;
  priority: string;
  started_at: string | null;
  completed_at: string | null;
  property_name: string;
  property_code: string;
  address: string;
  guest_name: string;
  memo: string;
  issue_memo: string;
  created_at: string;
  updated_at: string;
}

export interface CleaningListResponse {
  tasks: CleaningTask[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CleaningSummary {
  total: number;
  pending: number;
  assigned: number;
  in_progress: number;
  completed: number;
  issue: number;
}

export interface Cleaner {
  id: number;
  name: string;
  phone: string;
  region: string;
  regions: string;
  available_days: string;
  transport: string;
  can_laundry: boolean;
  can_dry: boolean;
  max_daily: number;
  active: boolean;
  memo: string;
}

export interface CleaningCode {
  id: number;
  code: string;
  region_code: string;
  region_name: string;
  building_name: string;
  room_name: string;
  room_count: number;
  base_price: number;
  property_id: number | null;
  memo: string;
}

export interface CleanerWorkload {
  cleaner_id: number;
  cleaner_name: string;
  assigned: number;
  completed: number;
  in_progress: number;
  max_daily: number;
}

export interface Issue {
  id: number;
  property_id: number | null;
  reservation_id: number | null;
  cleaning_task_id: number | null;
  reservation_code: string;
  title: string;
  description: string;
  issue_type: string;
  priority: string;
  status: string;
  assignee_id: number | null;
  assignee_name: string;
  property_name: string;
  property_code: string;
  resolved_at: string | null;
  resolution: string;
  created_by_id: number | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface IssueListResponse {
  issues: Issue[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface IssueSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

export interface CommunicationLog {
  id: number;
  property_id: number | null;
  reservation_id: number | null;
  reservation_code: string;
  issue_id: number | null;
  comm_type: string;
  content: string;
  channel: string;
  author_id: number | null;
  author_name: string;
  property_name: string;
  guest_name: string;
  created_at: string;
}

// --- Labels ---

export const CLEANING_STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  assigned: "배정됨",
  in_progress: "진행 중",
  completed: "완료",
  issue: "문제",
};

export const CLEANING_STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  issue: "bg-red-100 text-red-800",
};

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: "긴급",
  normal: "보통",
  low: "여유",
};

export const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-800",
  normal: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-600",
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  cleaning: "청소",
  facility: "시설",
  guest: "게스트",
  settlement: "정산",
  decision: "의사결정",
  other: "기타",
};

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: "열림",
  in_progress: "처리 중",
  resolved: "해결",
  closed: "종료",
};

export const ISSUE_STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

export const ISSUE_PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-red-100 text-red-800",
  P1: "bg-orange-100 text-orange-800",
  P2: "bg-yellow-100 text-yellow-800",
  P3: "bg-gray-100 text-gray-600",
};

export const COMM_TYPE_LABELS: Record<string, string> = {
  note: "메모",
  phone: "전화",
  message: "메시지",
  visit: "현장방문",
  issue: "이슈",
  system: "시스템",
};

// --- API functions ---

export async function fetchCleaningTasks(params: Record<string, string>): Promise<CleaningListResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiRequest(`/cleaning/tasks?${qs}`);
  if (!res.ok) throw new Error("조회 실패");
  return res.json();
}

export async function fetchCleaningSummary(date: string): Promise<CleaningSummary> {
  const res = await apiRequest(`/cleaning/summary?date=${date}`);
  if (!res.ok) throw new Error("요약 조회 실패");
  return res.json();
}

export async function generateCleaningTasks(date: string): Promise<{ created: number }> {
  const res = await apiRequest("/cleaning/generate", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error("생성 실패");
  return res.json();
}

export async function assignCleaner(taskId: number, cleanerId: number): Promise<CleaningTask> {
  const res = await apiRequest(`/cleaning/tasks/${taskId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ cleaner_id: cleanerId }),
  });
  if (!res.ok) throw new Error("배정 실패");
  return res.json();
}

export async function startCleaning(taskId: number): Promise<CleaningTask> {
  const res = await apiRequest(`/cleaning/tasks/${taskId}/start`, { method: "PATCH" });
  if (!res.ok) throw new Error("시작 실패");
  return res.json();
}

export async function completeCleaning(taskId: number): Promise<CleaningTask> {
  const res = await apiRequest(`/cleaning/tasks/${taskId}/complete`, { method: "PATCH" });
  if (!res.ok) throw new Error("완료 처리 실패");
  return res.json();
}

export async function reportCleaningIssue(taskId: number, issueMemo: string): Promise<unknown> {
  const res = await apiRequest(`/cleaning/tasks/${taskId}/issue`, {
    method: "PATCH",
    body: JSON.stringify({ issue_memo: issueMemo }),
  });
  if (!res.ok) throw new Error("이슈 등록 실패");
  return res.json();
}

export async function fetchCleaners(): Promise<Cleaner[]> {
  const res = await apiRequest("/cleaners");
  if (!res.ok) throw new Error("청소자 조회 실패");
  return res.json();
}

export async function createCleaner(data: { name: string; phone: string; region: string; memo: string }): Promise<Cleaner> {
  const res = await apiRequest("/cleaners", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("생성 실패");
  return res.json();
}

export async function deleteCleaner(id: number): Promise<void> {
  const res = await apiRequest(`/cleaners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제 실패");
}

// Cleaning Codes
export async function fetchCleaningCodes(): Promise<CleaningCode[]> {
  const res = await apiRequest("/cleaning-codes");
  if (!res.ok) throw new Error("청소코드 조회 실패");
  return res.json();
}

// Cleaner Workload
export async function fetchCleanerWorkload(date: string): Promise<CleanerWorkload[]> {
  const res = await apiRequest(`/cleaning/workload?date=${date}`);
  if (!res.ok) throw new Error("워크로드 조회 실패");
  return res.json();
}

// Issues
export async function fetchIssues(params: Record<string, string>): Promise<IssueListResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiRequest(`/issues?${qs}`);
  if (!res.ok) throw new Error("이슈 조회 실패");
  return res.json();
}

export async function fetchIssueSummary(): Promise<IssueSummary> {
  const res = await apiRequest("/issues/summary");
  if (!res.ok) throw new Error("요약 조회 실패");
  return res.json();
}

export async function createIssue(data: Partial<Issue>): Promise<Issue> {
  const res = await apiRequest("/issues", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("이슈 생성 실패");
  return res.json();
}

export async function updateIssueStatus(id: number, status: string): Promise<Issue> {
  const res = await apiRequest(`/issues/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("상태 변경 실패");
  return res.json();
}

export async function updateIssueAssignee(id: number, assigneeName: string): Promise<Issue> {
  const res = await apiRequest(`/issues/${id}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ assignee_name: assigneeName }),
  });
  if (!res.ok) throw new Error("담당자 변경 실패");
  return res.json();
}

// Communications
export async function fetchRecentComms(): Promise<CommunicationLog[]> {
  const res = await apiRequest("/communications/recent");
  if (!res.ok) throw new Error("조회 실패");
  return res.json();
}

export async function fetchReservationComms(reservationId: number): Promise<CommunicationLog[]> {
  const res = await apiRequest(`/communications/reservation/${reservationId}`);
  if (!res.ok) throw new Error("조회 실패");
  return res.json();
}

export async function fetchPropertyComms(propertyId: number): Promise<CommunicationLog[]> {
  const res = await apiRequest(`/communications/property/${propertyId}`);
  if (!res.ok) throw new Error("조회 실패");
  return res.json();
}

export async function createComm(data: Partial<CommunicationLog>): Promise<CommunicationLog> {
  const res = await apiRequest("/communications", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("기록 추가 실패");
  return res.json();
}
