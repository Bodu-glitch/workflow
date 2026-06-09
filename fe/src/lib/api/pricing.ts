import { apiFetch } from './client';

export interface ServicePricing {
  id: string;
  tenant_id: string;
  category_id: string;
  service_name: string;
  price_min: number | null;
  price_max: number | null;
  price_fixed: number | null;
  currency: string;
  estimated_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string; icon_url?: string | null } | null;
}

export const pricingApi = {
  list: (category_id?: string) => {
    const qs = category_id ? `?category_id=${category_id}` : '';
    return apiFetch<{ data: ServicePricing[] }>(`/pricing${qs}`);
  },

  create: (dto: {
    category_id: string;
    service_name: string;
    price_fixed?: number;
    price_min?: number;
    price_max?: number;
    estimated_duration_minutes?: number;
  }) =>
    apiFetch<{ data: ServicePricing }>('/pricing', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: Partial<{
    service_name: string;
    price_fixed: number;
    price_min: number;
    price_max: number;
    estimated_duration_minutes: number;
    is_active: boolean;
  }>) =>
    apiFetch<{ data: ServicePricing }>(`/pricing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/pricing/${id}`, { method: 'DELETE' }),
};
