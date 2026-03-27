import { Platform } from 'react-native';

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

// Web-safe token storage: use localStorage on web, SecureStore on native
const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

export const tokenStore = {
  get: () => storage.get(TOKEN_KEY),
  set: (token: string) => storage.set(TOKEN_KEY, token),
  remove: () => storage.remove(TOKEN_KEY),
  getRefresh: () => storage.get(REFRESH_TOKEN_KEY),
  setRefresh: (token: string) => storage.set(REFRESH_TOKEN_KEY, token),
  removeRefresh: () => storage.remove(REFRESH_TOKEN_KEY),
};

export const tenantStore = {
  get: () => storage.get(TENANT_KEY),
  set: (tenantId: string) => storage.set(TENANT_KEY, tenantId),
  remove: () => storage.remove(TENANT_KEY),
};

async function doFetch<T>(path: string, options: RequestInit, token: string | null): Promise<T> {
  const tenantId = await tenantStore.get();

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
  const token = await tokenStore.get();

  try {
    return await doFetch<T>(path, options, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Attempt token refresh via Supabase
      const refreshToken = await tokenStore.getRefresh();
      if (refreshToken) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
          if (!error && data.session) {
            await tokenStore.set(data.session.access_token);
            await tokenStore.setRefresh(data.session.refresh_token);
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
