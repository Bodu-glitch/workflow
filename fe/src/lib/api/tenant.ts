import { apiFetch } from './client';
import type { TenantService } from '@/types/api';

export const tenantApi = {
  services: {
    // Backend returns plain array → interceptor wraps as { data: TenantService[] }
    list: () =>
      apiFetch<{ data: TenantService[] }>('/tenant/services'),

    // Backend returns plain object → interceptor wraps as { data: TenantService }
    create: (name: string) =>
      apiFetch<{ data: TenantService }>('/tenant/services', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    // Backend returns { success: true } → interceptor wraps as { data: { success: boolean } }
    delete: (id: string) =>
      apiFetch<{ data: { success: boolean } }>(`/tenant/services/${id}`, {
        method: 'DELETE',
      }),
  },
};