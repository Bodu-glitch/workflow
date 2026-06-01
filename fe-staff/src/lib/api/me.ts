import { apiFetch, tokenStore, tenantStore, BASE_URL, ApiError } from './client';
import type { Task, TaskStatus, PaginatedResponse } from '@/types/api';

export interface UserCertificate {
  id: string;
  name: string;
  file_url: string;
  uploaded_at: string;
}

export type OnlineStatus = 'online' | 'offline' | 'working';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  cccd?: string;
  certificates: UserCertificate[];
  online_status?: OnlineStatus | null;
}

export interface TaskServiceItem {
  id?: string;
  service_id?: string | null;
  label: string;
  unit_price: number;
  is_custom?: boolean;
  checked: boolean;
}

export const meApi = {
  tasks: (status?: TaskStatus, page = 1, limit = 20) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set('status', status);
    return apiFetch<PaginatedResponse<Task>>(`/me/tasks?${q}`);
  },

  history: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Task>>(`/me/tasks/history?page=${page}&limit=${limit}`),

  getProfile: () => apiFetch<UserProfile>('/me/profile'),

  updateProfile: (data: { full_name?: string; phone?: string; cccd?: string }) =>
    apiFetch<UserProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  uploadCertificate: async (file: { uri: string; name: string; type: string }, certName: string): Promise<{ data: UserCertificate }> => {
    const token = await tokenStore.get();
    const tenantId = await tenantStore.get();
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    form.append('name', certName);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const res = await fetch(`${BASE_URL}/me/certificates`, { method: 'POST', headers, body: form });
    const json = await res.json();
    if (!res.ok) {
      const err = json?.error ?? json;
      throw new ApiError(err?.message ?? 'Upload failed', res.status, err?.code);
    }
    return json;
  },

  deleteCertificate: (id: string) =>
    apiFetch<{ message: string }>(`/me/certificates/${id}`, { method: 'DELETE' }),

  updateAvatar: async (file: { uri: string; name: string; type: string }): Promise<{ data: { avatar_url: string } }> => {
    const token = await tokenStore.get();
    const tenantId = await tenantStore.get();
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const res = await fetch(`${BASE_URL}/me/avatar`, { method: 'POST', headers, body: form });
    const json = await res.json();
    if (!res.ok) {
      const err = json?.error ?? json;
      throw new ApiError(err?.message ?? 'Upload failed', res.status, err?.code);
    }
    return json;
  },

  leaveWorkspace: (reason?: string) =>
    apiFetch<{ message: string }>('/me/leave-workspace', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  poolTasks: (page = 1, limit = 20) =>
    apiFetch<PaginatedResponse<Task>>(`/me/tasks/pool?page=${page}&limit=${limit}`),

  claimPoolTask: (taskId: string) =>
    apiFetch<{ message: string; task_id: string }>(`/me/tasks/${taskId}/claim`, { method: 'POST' }),

  workspaceServices: () =>
    apiFetch<{ data: Array<{ id: string; name: string }> }>('/me/workspace/services'),

  paymentInfo: () =>
    apiFetch<{ data: { bank_code: string; account_number: string; account_name: string } | null }>('/me/workspace/payment'),

  getTaskItems: (taskId: string) =>
    apiFetch<{ data: TaskServiceItem[] }>(`/me/tasks/${taskId}/items`),

  saveTaskItems: (taskId: string, items: TaskServiceItem[]) =>
    apiFetch<{ data: TaskServiceItem[] }>(`/me/tasks/${taskId}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  startMoving: (taskId: string) =>
    apiFetch<{ status: string }>(`/me/tasks/${taskId}/start`, { method: 'POST' }),

  markArrived: (taskId: string) =>
    apiFetch<{ status: string }>(`/me/tasks/${taskId}/arrive`, { method: 'POST' }),

  beginWork: (taskId: string, gpsLat: number, gpsLng: number) =>
    apiFetch<{ status: string }>(`/me/tasks/${taskId}/begin`, {
      method: 'POST',
      body: JSON.stringify({ gps_lat: gpsLat, gps_lng: gpsLng }),
    }),
};
