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
  final_amount: number | null;
  discount_amount: number | null;
  completion_checklist: any[] | null;
  completed_at: string | null;
  address?: string | null;
  tenant_id?: string | null;
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

export interface RequestDashboardSummary {
  unavailable: number;
  available: number;
  pending_assignment: number;
  assigned: number;
  in_progress: number;
  completed: number;
  completed_late: number;
  cancelled: number;
  emergency: number;
}

export const requestsApi = {
  dashboard: () =>
    apiFetch<{ data: { summary: RequestDashboardSummary } }>('/requests/dashboard'),

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

  // ── Chat (customer_operator channel) ──────────────────────────────────────
  getChatHistory: (requestId: string, channel: 'customer_operator' | 'customer_staff' = 'customer_operator', page = 1, limit = 50) =>
    apiFetch<{ data: ChatMessage[]; meta: { total: number | null; page: number; limit: number } }>(
      `/requests/${requestId}/chat/${channel}?page=${page}&limit=${limit}`,
    ),

  sendChatMessage: (requestId: string, content: string, channel: 'customer_operator' | 'customer_staff' = 'customer_operator') =>
    apiFetch<{ data: ChatMessage }>(`/requests/${requestId}/chat/${channel}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  createTask: (id: string) =>
    apiFetch<{ task_id: string; message: string }>(`/requests/${id}/create-task`, {
      method: 'POST',
    }),
};

export interface ChatMessage {
  id: string;
  request_id: string;
  user_id: string;
  channel: string;
  content: string | null;
  media_urls: string[];
  is_system: boolean;
  created_at: string;
  sender?: { id: string; full_name: string; avatar_url?: string | null } | null;
}
