// Thin real fetch wrapper — talks to the actual operational-core API
// (Identity, Workshop Analytics, Inventory Analytics, Purchase
// Recommendations, Branch Gateway, Backup, Health) with real JWT bearer
// auth, including real refresh-token rotation on a 401. No mocked data
// anywhere in this client.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3900';

let accessToken: string | null = localStorage.getItem('aios_access_token');
let refreshToken: string | null = localStorage.getItem('aios_refresh_token');

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    localStorage.setItem('aios_access_token', tokens.accessToken);
    localStorage.setItem('aios_refresh_token', tokens.refreshToken);
  } else {
    localStorage.removeItem('aios_access_token');
    localStorage.removeItem('aios_refresh_token');
  }
}

export function isAuthenticated(): boolean {
  return !!accessToken;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const tokens = await res.json();
  setTokens(tokens);
  return true;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried && (await tryRefresh())) {
    return apiRequest<T>(path, options, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message ?? `Request to ${path} failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
};
