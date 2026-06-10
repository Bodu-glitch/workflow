import { apiFetch } from './client';

export interface PeakHourSlot {
  start_time: string;
  end_time: string;
  multiplier: number;
}

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
  travel_fee: number;
  surcharge_percent: number;
  peak_hours_config: PeakHourSlot[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string; icon_url?: string } | null;
}

export interface CreatePricingInput {
  category_id: string;
  service_name: string;
  price_min?: number;
  price_max?: number;
  price_fixed?: number;
  estimated_duration_minutes?: number;
  travel_fee?: number;
  surcharge_percent?: number;
  peak_hours_config?: PeakHourSlot[];
}

export type UpdatePricingInput = Partial<CreatePricingInput>;

export const categoriesApi = {
  listAll: () => apiFetch<{ data: { id: string; name: string; slug: string; icon_url?: string; sort_order: number; is_active: boolean }[] }>('/categories'),
};

export const pricingApi = {
  list: (tenantId: string, categoryId?: string) => {
    const q = categoryId ? `?category_id=${categoryId}` : '';
    return apiFetch<{ data: ServicePricing[] }>(`/pricing/tenant/${tenantId}${q}`);
  },

  create: (input: CreatePricingInput) =>
    apiFetch<{ data: ServicePricing }>('/pricing', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdatePricingInput) =>
    apiFetch<{ data: ServicePricing }>(`/pricing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/pricing/${id}`, { method: 'DELETE' }),
};
