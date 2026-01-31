export const adminTokenStore = {
  key: "admin_access_token",
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(this.key);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.key);
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = adminTokenStore.get();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.code || json?.message || `HTTP_${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export function adminGet<T>(path: string): Promise<T> {
  return adminFetch<T>(path, { method: "GET" });
}

export function adminPost<T>(path: string, body: any): Promise<T> {
  return adminFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}
