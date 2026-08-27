const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export type ApiError = {
  code: string;
  message: string;
};

const USER_KEY = "photopol_token";
const GUEST_KEY = "photopol_guest_token";
const GUEST_SESSION_KEY = "photopol_guest_session";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY) || localStorage.getItem(GUEST_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(USER_KEY, token);
  else localStorage.removeItem(USER_KEY);
}

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_KEY);
}

export function setGuestToken(token: string | null, sessionId?: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(GUEST_KEY, token);
  else localStorage.removeItem(GUEST_KEY);
  if (sessionId) localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  if (token === null) localStorage.removeItem(GUEST_SESSION_KEY);
}

export function clearGuestSession() {
  setGuestToken(null);
}

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(USER_KEY) && !!localStorage.getItem(GUEST_KEY);
}

export async function ensureGuestSession(forceNew = false): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  if (localStorage.getItem(USER_KEY)) {
    return localStorage.getItem(USER_KEY)!;
  }
  if (forceNew) clearGuestSession();
  const existing = localStorage.getItem(GUEST_KEY);
  if (existing) return existing;

  const res = await fetch(`${API_URL}/guest/session`, { method: "POST" });
  if (!res.ok) {
    clearGuestSession();
    const err = new Error("Could not start guest session") as Error & { code: string; status: number };
    err.code = "guest_session_failed";
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as { guest_token: string; session_id: string };
  setGuestToken(data.guest_token, data.session_id);
  return data.guest_token;
}

export async function claimGuestSession(): Promise<string | null> {
  const guest = getGuestToken();
  if (!guest || !localStorage.getItem(USER_KEY)) return null;
  try {
    const data = await api<{ project_id?: string | null }>("/guest/claim", {
      method: "POST",
      body: JSON.stringify({ guest_token: guest }),
    });
    clearGuestSession();
    return data.project_id ?? null;
  } catch {
    clearGuestSession();
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = "Request failed";
    let code = "error";
    try {
      const data = await res.json();
      message = data?.error?.message || data?.detail?.message || message;
      code = data?.error?.code || data?.detail?.code || code;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { code: string; status: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res as unknown as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    let code = "error";
    try {
      const data = await res.json();
      code = data?.error?.code || code;
    } catch {
      /* ignore */
    }
    const err = new Error("Download failed") as Error & { code: string; status: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export { API_URL };
