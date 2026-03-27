export const TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'auth_refresh_token';
export const TENANT_KEY = 'auth_tenant_id';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  get: (): Promise<string | null> => Promise.resolve(localStorage.getItem(TOKEN_KEY)),
  set: (token: string): Promise<void> => {
    localStorage.setItem(TOKEN_KEY, token);
    return Promise.resolve();
  },
  remove: (): Promise<void> => {
    localStorage.removeItem(TOKEN_KEY);
    return Promise.resolve();
  },
  getRefresh: (): Promise<string | null> => Promise.resolve(localStorage.getItem(REFRESH_TOKEN_KEY)),
  setRefresh: (token: string): Promise<void> => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    return Promise.resolve();
  },
  removeRefresh: (): Promise<void> => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return Promise.resolve();
  },
};

export const tenantStore = {
  get: (): Promise<string | null> => Promise.resolve(localStorage.getItem(TENANT_KEY)),
  set: (tenantId: string): Promise<void> => {
    localStorage.setItem(TENANT_KEY, tenantId);
    return Promise.resolve();
  },
  remove: (): Promise<void> => {
    localStorage.removeItem(TENANT_KEY);
    return Promise.resolve();
  },
};

async function doFetch<T>(path: string, options: RequestInit, token: string | null): Promise<T> {
  const tenantId = localStorage.getItem(TENANT_KEY);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  // Only set Content-Type JSON if no body is FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = body?.error?.code;
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status, code);
  }

  return response.json() as Promise<T>;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  try {
    return await doFetch<T>(path, options, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
          if (!error && data.session) {
            localStorage.setItem(TOKEN_KEY, data.session.access_token);
            localStorage.setItem(REFRESH_TOKEN_KEY, data.session.refresh_token);
            return await doFetch<T>(path, options, data.session.access_token);
          }
        } catch {
          // refresh failed — fall through to throw original error
        }
      }
    }
    throw err;
  }
}
