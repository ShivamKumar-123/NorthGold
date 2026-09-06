/**
 * API client.
 *
 * Tokens live in localStorage because the two front-ends are served from
 * separate origins to the API and a cookie session would need a shared parent
 * domain. A 401 triggers exactly one refresh attempt; concurrent 401s share
 * that single attempt rather than each firing their own.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

const ACCESS_KEY = 'mc_admin_access';
const REFRESH_KEY = 'mc_admin_refresh';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh?: string) {
  try {
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* private mode — the session simply won't persist across reloads */
  }
}

export function clearTokens() {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/** Pull the most useful message out of DRF's several error shapes. */
function extractMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (payload.detail) return String(payload.detail);
  const firstKey = Object.keys(payload)[0];
  if (firstKey) {
    const value = payload[firstKey];
    const text = Array.isArray(value) ? value[0] : value;
    if (typeof text === 'string') {
      return firstKey === 'non_field_errors' ? text : `${firstKey}: ${text}`;
    }
  }
  return fallback;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    let refresh: string | null = null;
    try {
      refresh = window.localStorage.getItem(REFRESH_KEY);
    } catch {
      return false;
    }
    if (!refresh) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access) return false;
      setTokens(data.access, data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this same promise all see
      // the result before a fresh attempt becomes possible.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}, retrying = false): Promise<T> {
  const { method = 'GET', body, auth = true, isForm = false, signal } = options;

  const headers: Record<string, string> = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }

  if (res.status === 401 && auth && !retrying) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Your session expired. Please sign in again.', 401);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(extractMessage(payload, `Request failed (${res.status})`), res.status, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form, isForm: true }),
};

// ─── formatting ───────────────────────────────────────────────────────────

// `en-IN`, not `en-US`: Indian grouping is 2-2-3 from the right, so a lakh is
// ₹1,00,000 and not ₹100,000. Getting that wrong is immediately obvious to
// every user this platform is built for.
export function money(value: number | string | null | undefined, currency = 'INR'): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function num(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(value: number | string | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
