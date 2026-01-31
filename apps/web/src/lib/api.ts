type Json = Record<string, any>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

function normalizeErrorMessage(raw: any): string {
  if (raw == null) return "Request failed";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(", ");
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function buildApiError(res: Response, data: any): Error {
  // NestJS errors often come as: { statusCode, message, error }
  // where `message` can be string | string[] | object.
  const raw = data?.message ?? data?.error ?? data;
  const err = new Error(normalizeErrorMessage(raw));
  (err as any).status = res.status;
  (err as any).response = data;

  // If message is structured object, expose it so UI can branch on it.
  if (data && typeof data.message === "object" && data.message !== null) {
    (err as any).details = data.message;
  }
  return err;
}

async function post<T>(path: string, body: Json): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw buildApiError(res, data);
  }
  return data as T;
}

export const api = {
  register: (dto: Json) => post<{ tenantId: string; otpSent: boolean }>("/auth/register", dto),
  revenueCheck: (dto: Json) =>
    post<{ status: string; name?: string | null; source: string; manualUrl?: string; errorCode?: string }>(
      "/revenue/check",
      dto,
    ),
  requestOtp: (dto: Json) => post<{ ok: boolean }>("/auth/login/request-otp", dto),
  verifyOtp: (dto: Json) =>
    post<{
      tenant: Json;
      accessToken: string;
      refreshToken: string;
      accessTtl: string;
      refreshTtlSeconds: number;
    }>("/auth/login/verify-otp", dto),
  refresh: (dto: Json) =>
    post<{
      tenant: Json;
      accessToken: string;
      refreshToken: string;
      accessTtl: string;
      refreshTtlSeconds: number;
    }>("/auth/refresh", dto),
};

export const tokenStore = {
  set(accessToken: string, refreshToken: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  },
  get() {
    if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
    return {
      accessToken: localStorage.getItem("accessToken"),
      refreshToken: localStorage.getItem("refreshToken"),
    };
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
};
