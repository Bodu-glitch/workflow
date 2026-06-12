import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { ValidateVoucherDto } from './dto/validate-voucher.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class VouchersService {
  constructor(private supabase: SupabaseService) {}

  async listVouchers(tenantId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('vouchers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async createVoucher(tenantId: string, dto: CreateVoucherDto, userId: string) {
    if (dto.type === 'percentage' && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException({ code: 'INVALID_VOUCHER_VALUE', message: 'Giá trị phần trăm phải từ 1-100' });
    }

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .insert({
        tenant_id: tenantId,
        code: dto.code.toUpperCase().trim(),
        name: dto.name ?? '',
        type: dto.type,
        value: dto.value,
        max_discount: dto.max_discount ?? null,
        min_order_amount: dto.min_order_amount ?? null,
        usage_limit: dto.usage_limit ?? null,
        start_date: dto.start_date ?? null,
        end_date: dto.end_date ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException({ code: 'VOUCHER_CODE_EXISTS', message: 'Mã voucher đã tồn tại trong tenant này' });
      }
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async updateVoucher(id: string, dto: UpdateVoucherDto, tenantId: string) {
    const { data: existing } = await this.supabase.db
      .from('vouchers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher không tồn tại' });
    if (existing.tenant_id !== tenantId) throw new ForbiddenException();

    const updatePayload: Record<string, any> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.type !== undefined) updatePayload.type = dto.type;
    if (dto.value !== undefined) updatePayload.value = dto.value;
    if (dto.max_discount !== undefined) updatePayload.max_discount = dto.max_discount;
    if (dto.min_order_amount !== undefined) updatePayload.min_order_amount = dto.min_order_amount;
    if (dto.usage_limit !== undefined) updatePayload.usage_limit = dto.usage_limit;
    if (dto.is_active !== undefined) updatePayload.is_active = dto.is_active;
    if (dto.start_date !== undefined) updatePayload.start_date = dto.start_date;
    if (dto.end_date !== undefined) updatePayload.end_date = dto.end_date;

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteVoucher(id: string, tenantId: string) {
    const { data: existing } = await this.supabase.db
      .from('vouchers')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher không tồn tại' });
    if (existing.tenant_id !== tenantId) throw new ForbiddenException();

    await this.supabase.db.from('vouchers').update({ is_active: false }).eq('id', id);
    return { message: 'Voucher đã bị vô hiệu hóa' };
  }

  async validateVoucher(dto: ValidateVoucherDto) {
    const now = new Date().toISOString();

    const { data: voucher, error } = await this.supabase.db
      .from('vouchers')
      .select('*')
      .eq('tenant_id', dto.tenant_id)
      .eq('code', dto.code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !voucher) {
      throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Mã voucher không hợp lệ hoặc không tồn tại' });
    }

    if (voucher.start_date && voucher.start_date > now) {
      throw new BadRequestException({ code: 'VOUCHER_NOT_STARTED', message: 'Voucher chưa đến thời gian sử dụng' });
    }
    if (voucher.end_date && voucher.end_date < now) {
      throw new BadRequestException({ code: 'VOUCHER_EXPIRED', message: 'Voucher đã hết hạn' });
    }
    if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
      throw new BadRequestException({ code: 'VOUCHER_EXHAUSTED', message: 'Voucher đã hết lượt sử dụng' });
    }

    const orderAmount = dto.order_amount ?? 0;
    if (voucher.min_order_amount && orderAmount < voucher.min_order_amount) {
      throw new BadRequestException({
        code: 'ORDER_AMOUNT_TOO_LOW',
        message: `Đơn hàng tối thiểu ${voucher.min_order_amount.toLocaleString('vi-VN')}đ để sử dụng voucher này`,
      });
    }

    let discount = 0;
    if (voucher.type === 'percent' || voucher.type === 'percentage') {
      discount = (orderAmount * voucher.value) / 100;
      if (voucher.max_discount) discount = Math.min(discount, voucher.max_discount);
    } else {
      discount = voucher.value;
    }
    discount = Math.min(discount, orderAmount);

    return {
      voucher_id: voucher.id,
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      discount_amount: Math.round(discount),
      final_amount: Math.max(0, orderAmount - Math.round(discount)),
    };
  }

  /** Alias for public controller compatibility */
  async validate(code: string, tenantId: string, orderAmount: number) {
    return this.validateVoucher({ code, tenant_id: tenantId, order_amount: orderAmount });
  }

  async applyVoucher(requestId: string, code: string, tenantId: string, customerId: string) {
    const { data: request } = await this.supabase.db
      .from('service_requests')
      .select('id, agreed_price, category_id, customer_id, voucher_id, status')
      .eq('id', requestId)
      .single();

    if (!request) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Đơn hàng không tồn tại' });
    if (request.customer_id !== customerId) throw new ForbiddenException();
    if (request.voucher_id) {
      throw new BadRequestException({ code: 'VOUCHER_ALREADY_APPLIED', message: 'Đơn hàng đã có voucher' });
    }

    const validResult = await this.validateVoucher({
      code,
      tenant_id: tenantId,
      order_amount: request.agreed_price ?? 0,
      category_id: request.category_id,
    });

    const finalAmount = validResult.final_amount;
    const discountAmount = validResult.discount_amount;

    await this.supabase.db
      .from('service_requests')
      .update({
        voucher_id: validResult.voucher_id,
        discount_amount: discountAmount,
      })
      .eq('id', requestId);

    await this.supabase.db.rpc('increment_voucher_used_count', { voucher_id: validResult.voucher_id });

    return { discount_amount: discountAmount, final_amount: finalAmount };
  }

  async getVoucherStats(id: string, tenantId: string) {
    const { data: voucher } = await this.supabase.db
      .from('vouchers')
      .select('id, tenant_id, code, name, used_count')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!voucher) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher không tồn tại' });

    const { data: usages } = await this.supabase.db
      .from('service_requests')
      .select('discount_amount')
      .eq('voucher_id', id)
      .not('discount_amount', 'is', null);

    const totalDiscount = (usages ?? []).reduce((sum, u) => sum + Number(u.discount_amount || 0), 0);

    return {
      voucher_id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      used_count: voucher.used_count,
      total_discount_given: Math.round(totalDiscount),
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
