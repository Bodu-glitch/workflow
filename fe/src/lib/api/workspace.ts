import { apiFetch, tokenStore, tenantStore, BASE_URL, ApiError } from './client';
import type { WorkspaceProfile, UpdateWorkspaceInput, ServiceCategory, WorkspaceStats } from '@/types/api';

export const workspaceApi = {
  /** GET /workspace/profile — BO + OT */
  getProfile: () =>
    apiFetch<{ data: WorkspaceProfile }>('/workspace/profile'),

  /** PATCH /workspace/profile — BO only */
  updateProfile: (input: UpdateWorkspaceInput) =>
    apiFetch<{ data: WorkspaceProfile }>('/workspace/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  /** PATCH /workspace/status — BO only */
  updateStatus: (status: 'active' | 'inactive' | 'pending') =>
    apiFetch<{ data: { id: string; name: string; status: string } }>('/workspace/status', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  /** GET /workspace/stats — BO + OT */
  getStats: () =>
    apiFetch<{ data: WorkspaceStats }>('/workspace/stats'),

  /** GET /workspace/service-categories — BO + OT */
  getServiceCategories: () =>
    apiFetch<{ data: ServiceCategory[] }>('/workspace/service-categories'),

  /** PUT /workspace/service-categories — BO only: replace all */
  setServiceCategories: (category_ids: string[]) =>
    apiFetch<{ data: ServiceCategory[] }>('/workspace/service-categories', {
      method: 'PUT',
      body: JSON.stringify({ category_ids }),
    }),

  /** GET /categories — public: toàn bộ danh mục platform */
  listAllCategories: () =>
    apiFetch<{ data: ServiceCategory[] }>('/categories'),

  /** POST /workspace/logo — BO only */
  updateLogo: async (file: { uri: string; name: string; type: string }): Promise<{ data: { id: string; logo_url: string } }> => {
    const token = await tokenStore.get();
    const tenantId = await tenantStore.get();
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const res = await fetch(`${BASE_URL}/workspace/logo`, { method: 'POST', headers, body: form });
    const json = await res.json();
    if (!res.ok) {
      const err = json?.error ?? json;
      throw new ApiError(err?.message ?? 'Upload failed', res.status, err?.code);
    }
    return json;
  },
};
