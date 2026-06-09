import { apiFetch } from './client';

export interface Voucher {
  id: string;
  tenant_id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  max_discount: number | null;
  min_order_value: number | null;
  usage_limit: number | null;
  usage_count: number;
  is_public: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  service_category_id: string | null;
  created_at: string;
  category?: { id: string; name: string } | null;
}

export interface VoucherStats {
  total_used: number;
  total_discount: number;
}

export const vouchersApi = {
  list: () =>
    apiFetch<{ data: Voucher[] }>('/vouchers'),

  getStats: (id: string) =>
    apiFetch<{ data: VoucherStats }>(`/vouchers/${id}/stats`),

  create: (dto: {
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    max_discount?: number;
    min_order_value?: number;
    usage_limit?: number;
    is_public?: boolean;
    starts_at?: string;
    ends_at?: string;
    service_category_id?: string;
  }) =>
    apiFetch<{ data: Voucher }>('/vouchers', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: Partial<{
    code: string;
    type: 'percent' | 'fixed';
    value: number;
    max_discount: number;
    min_order_value: number;
    usage_limit: number;
    is_public: boolean;
    is_active: boolean;
    starts_at: string;
    ends_at: string;
    service_category_id: string;
  }>) =>
    apiFetch<{ data: Voucher }>(`/vouchers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/vouchers/${id}`, { method: 'DELETE' }),

  deactivate: (id: string) =>
    apiFetch<{ data: Voucher }>(`/vouchers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    }),
};
