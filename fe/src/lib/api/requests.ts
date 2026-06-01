import { apiFetch } from './client';

export interface ServiceRequestSummary {
  id: string;
  description: string;
  status: string;
  is_emergency: boolean;
  priority: string;
  created_at: string;
  collected_amount: number | null;
  agreed_price: number | null;
  completed_at: string | null;
  category?: { id: string; name: string; slug: string } | null;
  customer?: { id: string; full_name: string; avatar_url: string | null; phone?: string | null } | null;
  tenant?: { id: string; name: string } | null;
  staff?: { id: string; full_name: string; avatar_url: string | null } | null;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

export const requestsApi = {
  list: (params: { status?: string; page?: number; limit?: number } = {}) =>
    apiFetch<{ data: ServiceRequestSummary[]; meta: { total: number; page: number; limit: number } }>(
      `/requests${buildQuery(params as Record<string, string | number | undefined>)}`,
    ),

  getById: (id: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/requests/${id}`),

  assign: (id: string, staffId: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/requests/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId }),
    }),

  pushToPool: (id: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/requests/${id}/push-to-staff-pool`, {
      method: 'PATCH',
    }),

  cancel: (id: string, reason?: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/requests/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  createTask: (id: string) =>
    apiFetch<{ task_id: string; message: string }>(`/requests/${id}/create-task`, {
      method: 'POST',
    }),
};
