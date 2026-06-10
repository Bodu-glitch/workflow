import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class VouchersService {
  constructor(private supabase: SupabaseService) {}

  async list(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('vouchers')
      .select('*')
      .eq('tenant_id', user.tenant_id!)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async create(dto: CreateVoucherDto, user: CurrentUser) {
    const code = dto.code.toUpperCase().trim();

    const { data: existing } = await this.supabase.db
      .from('vouchers')
      .select('id')
      .eq('tenant_id', user.tenant_id!)
      .eq('code', code)
      .single();

    if (existing) throw new BadRequestException({ code: 'VOUCHER_CODE_EXISTS', message: 'Voucher code already exists' });

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .insert({
        tenant_id: user.tenant_id!,
        code,
        name: dto.name,
        type: dto.type,
        value: dto.value,
        min_order_amount: dto.min_order_amount ?? null,
        max_discount: dto.max_discount ?? null,
        usage_limit: dto.usage_limit ?? null,
        start_date: dto.start_date ?? null,
        end_date: dto.end_date ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, dto: UpdateVoucherDto, user: CurrentUser) {
    const { data: existing } = await this.supabase.db
      .from('vouchers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found' });
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: string, user: CurrentUser) {
    const { data: existing } = await this.supabase.db
      .from('vouchers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found' });
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    await this.supabase.db.from('vouchers').update({ is_active: false }).eq('id', id);
    return { message: 'Voucher deactivated' };
  }

  async validate(code: string, tenantId: string, orderAmount: number) {
    const { data: voucher } = await this.supabase.db
      .from('vouchers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (!voucher) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher code not found' });

    const now = new Date();
    if (voucher.start_date && new Date(voucher.start_date) > now) {
      throw new BadRequestException({ code: 'VOUCHER_NOT_STARTED', message: 'Voucher is not yet active' });
    }
    if (voucher.end_date && new Date(voucher.end_date) < now) {
      throw new BadRequestException({ code: 'VOUCHER_EXPIRED', message: 'Voucher has expired' });
    }
    if (voucher.usage_limit != null && voucher.used_count >= voucher.usage_limit) {
      throw new BadRequestException({ code: 'VOUCHER_LIMIT_REACHED', message: 'Voucher usage limit reached' });
    }
    if (voucher.min_order_amount != null && orderAmount < voucher.min_order_amount) {
      throw new BadRequestException({
        code: 'VOUCHER_MIN_ORDER',
        message: `Minimum order amount is ${voucher.min_order_amount}`,
      });
    }

    let discount = voucher.type === 'percentage'
      ? (orderAmount * voucher.value) / 100
      : voucher.value;

    if (voucher.max_discount != null) {
      discount = Math.min(discount, voucher.max_discount);
    }

    return {
      voucher_id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      discount_amount: Math.round(discount),
      final_amount: Math.max(0, Math.round(orderAmount - discount)),
    };
  }

  async getStats(voucherId: string, user: CurrentUser) {
    const { data: voucher } = await this.supabase.db
      .from('vouchers').select('id, tenant_id, code, name, used_count').eq('id', voucherId).single();
    if (!voucher) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found' });
    if (voucher.tenant_id !== user.tenant_id) throw new ForbiddenException();

    const { data: usages } = await this.supabase.db
      .from('service_requests')
      .select('discount_amount')
      .eq('voucher_id', voucherId)
      .not('discount_amount', 'is', null);

    const total_discount = (usages ?? []).reduce((s: number, r: any) => s + Number(r.discount_amount || 0), 0);

    return {
      voucher_id: voucherId,
      code: voucher.code,
      name: voucher.name,
      used_count: voucher.used_count,
      total_discount_given: Math.round(total_discount),
    };
  }

  async notifyCustomers(voucherId: string, message: string | undefined, user: CurrentUser) {
    const { data: voucher } = await this.supabase.db
      .from('vouchers').select('id, tenant_id, code, name, is_active').eq('id', voucherId).single();
    if (!voucher) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher not found' });
    if (voucher.tenant_id !== user.tenant_id) throw new ForbiddenException();
    if (!voucher.is_active) throw new BadRequestException({ code: 'VOUCHER_INACTIVE', message: 'Voucher is inactive' });

    // Get all customers who have used services from this tenant
    const { data: customers } = await this.supabase.db
      .from('service_requests')
      .select('customer_id')
      .eq('tenant_id', user.tenant_id!)
      .in('status', ['completed', 'completed_late']);

    const customerIds = [...new Set((customers ?? []).map((r: any) => r.customer_id).filter(Boolean))];

    if (customerIds.length === 0) return { sent: 0 };

    // Insert notifications for each customer
    const rows = customerIds.map((uid: string) => ({
      user_id: uid,
      type: 'voucher_received',
      title: message ?? `Bạn có mã giảm giá mới!`,
      body: `Dùng mã "${voucher.code}" để được giảm giá khi đặt dịch vụ.`,
      data: { voucher_id: voucherId, voucher_code: voucher.code },
    }));

    await this.supabase.db.from('notifications').insert(rows);

    return { sent: customerIds.length };
  }
}
