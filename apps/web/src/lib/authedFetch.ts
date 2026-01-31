import { api, tokenStore } from "@/lib/api";

type Json = Record<string, any>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

async function rawFetch(path: string, accessToken: string | null) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    cache: "no-store",
  });
  return res;
}

export async function getWithAuth<T>(path: string): Promise<T> {
  const { accessToken, refreshToken } = tokenStore.get();

  let res = await rawFetch(path, accessToken);

  if (res.status === 401 && refreshToken) {
    // try refresh once
    const refreshed = await api.refresh({ refreshToken });
    tokenStore.set(refreshed.accessToken, refreshed.refreshToken);
    res = await rawFetch(path, refreshed.accessToken);
  }

  const data = await res.json().catch(() => ({} as Json));
  if (!res.ok) {
    const msg = (data as any)?.message || (data as any)?.error || JSON.stringify(data);
    throw new Error(msg);
  }
  return data as T;
}


async function rawFetchJson(path: string, method: string, body: any, accessToken: string | null) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  return res;
}

export async function jsonWithAuth<T>(path: string, method: "POST" | "PUT" | "DELETE", body?: any): Promise<T> {
  const { accessToken, refreshToken } = tokenStore.get();

  let res = await rawFetchJson(path, method, body, accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshed = await api.refresh({ refreshToken });
    tokenStore.set(refreshed.accessToken, refreshed.refreshToken);
    res = await rawFetchJson(path, method, body, refreshed.accessToken);
  }

  const data = await res.json().catch(() => ({} as Json));
  if (!res.ok) {
    const msg = (data as any)?.message || (data as any)?.error || JSON.stringify(data);
    throw new Error(msg);
  }
  return data as T;
}

export async function downloadTextWithAuth(path: string): Promise<string> {
  const { accessToken, refreshToken } = tokenStore.get();

  let res = await rawFetch(path, accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshed = await api.refresh({ refreshToken });
    tokenStore.set(refreshed.accessToken, refreshed.refreshToken);
    res = await rawFetch(path, refreshed.accessToken);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Request failed: ${res.status}`);
  }
  return res.text();
}

export async function downloadBlobWithAuth(path: string): Promise<Blob> {
  const { accessToken, refreshToken } = tokenStore.get();

  let res = await rawFetch(path, accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshed = await api.refresh({ refreshToken });
    tokenStore.set(refreshed.accessToken, refreshed.refreshToken);
    res = await rawFetch(path, refreshed.accessToken);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Request failed: ${res.status}`);
  }
  return res.blob();
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
