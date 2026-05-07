const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  return response;
}

// axios-like wrapper for convenience
const api = {
  async get(path: string) {
    const res = await apiRequest(path);
    const data = await res.json();
    return { data };
  },
  async post(path: string, body?: unknown) {
    const res = await apiRequest(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { data };
  },
};

export default api;
