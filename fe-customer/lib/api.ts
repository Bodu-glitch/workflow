import { supabase } from './supabase';
import { API_BASE_URL } from '../constants/config';
import type { ApiError } from '../types';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    formData?: FormData;
    tenantId?: string;
  } = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.tenantId) headers['X-Tenant-ID'] = options.tenantId;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body,
  });

  const json = await res.json();

  if (!res.ok) {
    const err = json as ApiError;
    throw Object.assign(new Error(err.error?.message ?? 'Request failed'), {
      code: err.error?.code ?? 'UNKNOWN',
      status: res.status,
    });
  }

  return (json as { data: T }).data ?? json;
}

// Like request but returns the full JSON (data + meta) without unwrapping the `data` key.
async function requestFull<T>(
  method: string,
  path: string,
  options: { body?: unknown; formData?: FormData; tenantId?: string } = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.tenantId) headers['X-Tenant-ID'] = options.tenantId;
  let body: BodyInit | undefined;
  if (options.formData) { body = options.formData; }
  else if (options.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(options.body); }
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body });
  const json = await res.json();
  if (!res.ok) {
    const err = json as ApiError;
    throw Object.assign(new Error(err.error?.message ?? 'Request failed'), { code: err.error?.code ?? 'UNKNOWN', status: res.status });
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, opts?: { tenantId?: string }) =>
    request<T>('GET', path, opts),

  post: <T>(path: string, body?: unknown, opts?: { tenantId?: string }) =>
    request<T>('POST', path, { body, ...opts }),

  postForm: <T>(path: string, formData: FormData, opts?: { tenantId?: string }) =>
    request<T>('POST', path, { formData, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: { tenantId?: string }) =>
    request<T>('PATCH', path, { body, ...opts }),

  delete: <T>(path: string, opts?: { tenantId?: string }) =>
    request<T>('DELETE', path, opts),

  selectTenant: (requestId: string, tenantId: string) =>
    request<{ message: string }>('PATCH', `/requests/${requestId}/select-tenant`, { body: { tenant_id: tenantId } }),

  updateProfile: (data: { full_name?: string; phone?: string; address?: string }) =>
    request<{ id: string; full_name: string; phone: string | null; address: string | null }>('PATCH', '/auth/profile', { body: data }),

  listWorkspaces: (params: { search?: string; category?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.category) q.set('category', params.category);
    if (params.page) q.set('page', String(params.page));
    return requestFull<{ data: Workspace[]; meta: { total: number; page: number; limit: number } }>(
      'GET', `/auth/workspaces${q.toString() ? `?${q}` : ''}`,
    );
  },

  getWorkspace: (slug: string) =>
    request<Workspace & { services: Array<{ id: string; name: string }>; rating_avg: number | null; rating_count: number }>(
      'GET', `/auth/workspaces/${slug}`,
    ),

  getBill: (requestId: string) =>
    request<Bill>('GET', `/requests/${requestId}/bill`),
};

export interface Bill {
  request_id: string;
  tenant: { id: string; name: string; slug: string } | null;
  items: Array<{ label: string; unit_price: number }>;
  items_total: number;
  total: number;
  collected_amount: number | null;
  payment: { bank_code: string; account_number: string; account_name: string } | null;
  status: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  operating_area: string | null;
  benefits: string | null;
  status: string;
}
