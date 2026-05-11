const API = import.meta.env.VITE_API_URL;

function headers() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchOnboardingFull(propertyId: number) {
  const res = await fetch(`${API}/onboarding/${propertyId}/full`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export async function saveStep(propertyId: number, step: string, data: unknown) {
  const res = await fetch(`${API}/onboarding/${propertyId}/step/${step}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "저장 실패" }));
    throw new Error(err.error || "저장 실패");
  }
  return res.json();
}
