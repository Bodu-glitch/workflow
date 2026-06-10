import { apiFetch } from './client';

export interface Voucher {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateVoucherInput {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount?: number;
  max_discount?: number;
  usage_limit?: number;
  start_date?: string;
  end_date?: string;
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

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/vouchers/${id}`, { method: 'DELETE' }),

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
