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
      .select('*, category:service_category_id(id, name, slug)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async createVoucher(tenantId: string, dto: CreateVoucherDto, userId: string) {
    if (dto.type === 'percent' && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException({ code: 'INVALID_VOUCHER_VALUE', message: 'Giá trị phần trăm phải từ 1-100' });
    }

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .insert({
        tenant_id: tenantId,
        code: dto.code.toUpperCase().trim(),
        name: dto.name ?? null,
        type: dto.type,
        value: dto.value,
        max_discount: dto.max_discount,
        min_order_value: dto.min_order_value ?? 0,
        service_category_id: dto.service_category_id ?? null,
        usage_limit: dto.usage_limit ?? null,
        is_public: dto.is_public ?? true,
        starts_at: dto.starts_at ?? null,
        ends_at: dto.ends_at ?? null,
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

    const { data, error } = await this.supabase.db
      .from('vouchers')
      .update(dto)
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

    if (voucher.starts_at && voucher.starts_at > now) {
      throw new BadRequestException({ code: 'VOUCHER_NOT_STARTED', message: 'Voucher chưa đến thời gian sử dụng' });
    }
    if (voucher.ends_at && voucher.ends_at < now) {
      throw new BadRequestException({ code: 'VOUCHER_EXPIRED', message: 'Voucher đã hết hạn' });
    }
    if (voucher.usage_limit !== null && voucher.usage_count >= voucher.usage_limit) {
      throw new BadRequestException({ code: 'VOUCHER_EXHAUSTED', message: 'Voucher đã hết lượt sử dụng' });
    }

    const orderAmount = dto.order_amount ?? 0;
    if (voucher.min_order_value && orderAmount < voucher.min_order_value) {
      throw new BadRequestException({
        code: 'ORDER_AMOUNT_TOO_LOW',
        message: `Đơn hàng tối thiểu ${voucher.min_order_value.toLocaleString('vi-VN')}đ để sử dụng voucher này`,
      });
    }

    if (voucher.service_category_id && dto.category_id && voucher.service_category_id !== dto.category_id) {
      throw new BadRequestException({
        code: 'VOUCHER_CATEGORY_MISMATCH',
        message: 'Voucher không áp dụng cho loại dịch vụ này',
      });
    }

    let discount = 0;
    if (voucher.type === 'percent') {
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
      .select('id, agreed_price, category_id, customer_id, applied_voucher_id, status')
      .eq('id', requestId)
      .single();

    if (!request) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Đơn hàng không tồn tại' });
    if (request.customer_id !== customerId) throw new ForbiddenException();
    if (request.applied_voucher_id) {
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
        applied_voucher_id: validResult.voucher_id,
        discount_amount: discountAmount,
        final_amount: finalAmount,
      })
      .eq('id', requestId);

    await this.supabase.db.from('voucher_usages').insert({
      voucher_id: validResult.voucher_id,
      request_id: requestId,
      customer_id: customerId,
      discount_amount: discountAmount,
    });

    await this.supabase.db.rpc('increment_voucher_usage', { voucher_id: validResult.voucher_id });

    return { discount_amount: discountAmount, final_amount: finalAmount };
  }

  async getVoucherStats(id: string, tenantId: string) {
    const { data: voucher } = await this.supabase.db
      .from('vouchers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!voucher) throw new NotFoundException({ code: 'VOUCHER_NOT_FOUND', message: 'Voucher không tồn tại' });

    const { data: usages } = await this.supabase.db
      .from('voucher_usages')
      .select('discount_amount')
      .eq('voucher_id', id);

    const totalUsed = usages?.length ?? 0;
    const totalDiscount = (usages ?? []).reduce((sum, u) => sum + Number(u.discount_amount), 0);

    return {
      ...voucher,
      stats: {
        total_used: totalUsed,
        total_discount: totalDiscount,
      },
    };
  }
}
