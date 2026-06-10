import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreatePricingDto } from './dto/create-pricing.dto.js';
import { UpdatePricingDto } from './dto/update-pricing.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class PricingService {
  constructor(private supabase: SupabaseService) {}

  async getTenantPricing(tenantId: string, categoryId?: string) {
    let query = this.supabase.db
      .from('service_pricings')
      .select(`
        *,
        category:category_id(id, name, slug, icon_url)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category_id')
      .order('service_name');

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async createPricing(dto: CreatePricingDto, user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('service_pricings')
      .insert({
        tenant_id: user.tenant_id!,
        category_id: dto.category_id,
        service_name: dto.service_name,
        price_min: dto.price_min,
        price_max: dto.price_max,
        price_fixed: dto.price_fixed,
        estimated_duration_minutes: dto.estimated_duration_minutes,
        travel_fee: dto.travel_fee ?? 0,
        surcharge_percent: dto.surcharge_percent ?? 0,
        peak_hours_config: dto.peak_hours_config ?? [],
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updatePricing(id: string, dto: UpdatePricingDto, user: CurrentUser) {
    const { data: existing } = await this.supabase.db
      .from('service_pricings')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'PRICING_NOT_FOUND', message: 'Pricing not found' });
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    const { data, error } = await this.supabase.db
      .from('service_pricings')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deletePricing(id: string, user: CurrentUser) {
    const { data: existing } = await this.supabase.db
      .from('service_pricings')
      .select('tenant_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException({ code: 'PRICING_NOT_FOUND', message: 'Pricing not found' });
    if (existing.tenant_id !== user.tenant_id) throw new ForbiddenException();

    await this.supabase.db.from('service_pricings').update({ is_active: false }).eq('id', id);
    return { message: 'Pricing deactivated' };
  }
}
