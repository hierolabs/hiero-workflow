import { apiRequest } from "./api";

export async function getConversations(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await apiRequest(`/messages/conversations${query}`);
  return res.json();
}

export async function getConversation(conversationId: string) {
  const res = await apiRequest(`/messages/conversations/${conversationId}`);
  return res.json();
}

export async function sendMessage(conversationId: string, message: string) {
  const res = await apiRequest(`/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function markRead(conversationId: string) {
  await apiRequest(`/messages/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

export async function syncMessages() {
  const res = await apiRequest("/messages/sync", { method: "POST" });
  return res.json();
}

export async function syncConversationMessages(conversationId: string) {
  const res = await apiRequest(`/messages/conversations/${conversationId}/sync`, {
    method: "POST",
  });
  return res.json();
}

export async function createGuestRequest(
  conversationId: string,
  data: { request_type: string; note?: string }
) {
  const res = await apiRequest(`/messages/conversations/${conversationId}/requests`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateGuestRequestStatus(id: number, status: string) {
  const res = await apiRequest(`/messages/requests/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function getPendingRequests() {
  const res = await apiRequest("/messages/requests/pending");
  return res.json();
}

export async function getMessageAnalysis(period: string) {
  const res = await apiRequest(`/messages/analysis?period=${period}`);
  return res.json();
}

export async function getMessageInsight(start: string, end: string) {
  const res = await apiRequest(`/messages/insight?start=${start}&end=${end}`);
  return res.json();
}
