import { apiFetch } from './client';
import type { ServiceRequestSummary } from './requests';

export const technicianApi = {
  getJobs: (params: { page?: number; limit?: number } = {}) => {
    const q = params.page || params.limit
      ? `?page=${params.page ?? 1}&limit=${params.limit ?? 20}`
      : '';
    return apiFetch<{ data: ServiceRequestSummary[]; meta: { total: number; page: number; limit: number } }>(
      `/technician/jobs${q}`,
    );
  },

  getHistory: (params: { page?: number; limit?: number } = {}) => {
    const q = `?page=${params.page ?? 1}&limit=${params.limit ?? 20}`;
    return apiFetch<{ data: ServiceRequestSummary[]; meta: { total: number; page: number; limit: number } }>(
      `/technician/jobs/history${q}`,
    );
  },

  getJob: (id: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/technician/jobs/${id}`),

  acceptJob: (id: string) =>
    apiFetch<{ message: string; request_id: string }>(`/technician/jobs/${id}/accept`, {
      method: 'POST',
    }),

  declineJob: (id: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/technician/jobs/${id}/decline`, {
      method: 'POST',
    }),

  startJob: (id: string, lat: number, lng: number) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/technician/jobs/${id}/start`, {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng }),
    }),

  completeJob: (id: string, collectedAmount?: number, finalPrice?: number) => {
    const body: Record<string, number> = {};
    if (collectedAmount !== undefined) body.collected_amount = collectedAmount;
    if (finalPrice !== undefined) body.final_price = finalPrice;
    return apiFetch<{ data: ServiceRequestSummary }>(`/technician/jobs/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  requote: (id: string, requotePrice: number, requoteReason: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/technician/jobs/${id}/requote`, {
      method: 'PATCH',
      body: JSON.stringify({ requote_price: requotePrice, requote_reason: requoteReason }),
    }),

  getPool: () =>
    apiFetch<{ data: ServiceRequestSummary[]; meta: { total: number; page: number; limit: number } }>(
      '/technician/pool',
    ),

  claimFromPool: (id: string) =>
    apiFetch<{ data: ServiceRequestSummary }>(`/technician/pool/${id}/claim`, {
      method: 'POST',
    }),

  setStatus: (isOnline: boolean) =>
    apiFetch<{ is_online: boolean }>('/technician/status', {
      method: 'PATCH',
      body: JSON.stringify({ is_online: isOnline }),
    }),

  getEarnings: (period: 'day' | 'week' | 'month') =>
    apiFetch<{
      data: {
        summary: {
          total_jobs: number;
          total_gross: number;
          total_earning: number;
          avg_rating: number | null;
        };
        jobs: Array<{
          id: string;
          description: string;
          agreed_price: number;
          final_amount: number | null;
          collected_amount: number | null;
          staff_earning: number;
          rating: number | null;
          completed_at: string;
          category: { name: string } | null;
        }>;
      };
    }>(`/technician/earnings?period=${period}`),

  updateChecklist: (id: string, checklist: Array<{ id: string; name: string; price: number; checked: boolean }>) =>
    apiFetch<{ data: any }>(`/technician/jobs/${id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ checklist }),
    }),
};
