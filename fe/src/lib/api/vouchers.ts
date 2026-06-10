import { apiFetch } from './client';

export interface Voucher {
  id: string;
  tenant_id: string;
  code: string;
  name?: string;
  type: 'percent' | 'fixed' | 'percentage';
  value: number;
  max_discount: number | null;
  min_order_value?: number | null;
  min_order_amount?: number | null;
  usage_limit: number | null;
  usage_count?: number;
  used_count?: number;
  is_public?: boolean;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  service_category_id?: string | null;
  created_at: string;
  updated_at?: string;
  category?: { id: string; name: string } | null;
}

export interface VoucherStats {
  total_used: number;
  total_discount: number;
}

export interface CreateVoucherInput {
  code: string;
  name?: string;
  type: 'percent' | 'fixed' | 'percentage';
  value: number;
  min_order_amount?: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
  start_date?: string;
  starts_at?: string;
  end_date?: string;
  ends_at?: string;
  is_public?: boolean;
  service_category_id?: string;
}

export type UpdateVoucherInput = Partial<CreateVoucherInput & { is_active: boolean }>;

export interface VoucherValidateResult {
  voucher_id: string;
  code: string;
  name: string;
  discount_amount: number;
  final_amount: number;
}

export const vouchersApi = {
  list: () =>
    apiFetch<{ data: Voucher[] }>('/vouchers'),

  getStats: (id: string) =>
    apiFetch<{ data: VoucherStats }>(`/vouchers/${id}/stats`),

  create: (input: CreateVoucherInput) =>
    apiFetch<{ data: Voucher }>('/vouchers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateVoucherInput) =>
    apiFetch<{ data: Voucher }>(`/vouchers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/vouchers/${id}`, { method: 'DELETE' }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/vouchers/${id}`, { method: 'DELETE' }),

  deactivate: (id: string) =>
    apiFetch<{ data: Voucher }>(`/vouchers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: false }),
    }),

  validatePublic: (code: string, tenantId: string, orderAmount: number) =>
    apiFetch<{ data: VoucherValidateResult }>('/vouchers/public/validate', {
      method: 'POST',
      body: JSON.stringify({ code, tenant_id: tenantId, order_amount: orderAmount }),
    }),

  getStats: (id: string) =>
    apiFetch<{ voucher_id: string; code: string; name: string; used_count: number; total_discount_given: number }>(`/vouchers/${id}/stats`),

  notify: (id: string, message?: string) =>
    apiFetch<{ sent: number }>(`/vouchers/${id}/notify`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
