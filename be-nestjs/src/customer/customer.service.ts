import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { UpdateCustomerProfileDto } from './dto/update-profile.dto.js';
import { CreateAddressDto } from './dto/create-address.dto.js';

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class CustomerService {
  constructor(private supabase: SupabaseService) {}

  /** GET /customer/profile */
  async getProfile(userId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, email, full_name, phone, avatar_url, role, created_at')
      .eq('id', userId)
      .single();
    if (error || !data) throw new NotFoundException('Profile not found');
    return data;
  }

  /** PATCH /customer/profile */
  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const update: Record<string, any> = {};
    if (dto.full_name !== undefined) update.full_name = dto.full_name.trim();
    if (dto.phone !== undefined) update.phone = dto.phone.trim();

    const { data, error } = await this.supabase.db
      .from('users')
      .update(update)
      .eq('id', userId)
      .select('id, email, full_name, phone, avatar_url')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** POST /customer/avatar — upload avatar */
  async updateAvatar(userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('avatars')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from('avatars')
      .getPublicUrl(path);

    const { data, error } = await this.supabase.db
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)
      .select('id, avatar_url')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** GET /customer/addresses */
  async listAddresses(userId: string) {
    const { data, error } = await this.supabase.db
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  /** POST /customer/addresses */
  async createAddress(userId: string, dto: CreateAddressDto) {
    // Nếu set là default, clear các địa chỉ default cũ
    if (dto.is_default) {
      await this.supabase.db
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data, error } = await this.supabase.db
      .from('customer_addresses')
      .insert({
        user_id: userId,
        label: dto.label,
        address: dto.address,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        is_default: dto.is_default ?? false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** PATCH /customer/addresses/:id */
  async updateAddress(id: string, userId: string, dto: Partial<CreateAddressDto>) {
    const { data: existing } = await this.supabase.db
      .from('customer_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException('Địa chỉ không tồn tại');
    if (existing.user_id !== userId) throw new ForbiddenException();

    if (dto.is_default) {
      await this.supabase.db
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data, error } = await this.supabase.db
      .from('customer_addresses')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** DELETE /customer/addresses/:id */
  async deleteAddress(id: string, userId: string) {
    const { data: existing } = await this.supabase.db
      .from('customer_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing) throw new NotFoundException('Địa chỉ không tồn tại');
    if (existing.user_id !== userId) throw new ForbiddenException();

    await this.supabase.db.from('customer_addresses').delete().eq('id', id);
    return { message: 'Địa chỉ đã được xóa' };
  }

  /** Public: lấy voucher đang active của một tenant (để customer chọn) */
  async getPublicVouchers(tenantId: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.db
      .from('vouchers')
      .select('id, code, type, value, max_discount, min_order_value, usage_limit, usage_count, ends_at, is_active, category:service_category_id(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_public', true)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    // Filter ra voucher còn lượt dùng
    const filtered = (data ?? []).filter((v: any) => {
      if (v.usage_limit != null && v.usage_count >= v.usage_limit) return false;
      return true;
    });

    return filtered;
  }

  /** Public: tìm kiếm workspace/tenant */
  async searchWorkspaces(query: {
    q?: string;
    category_id?: string;
    min_rating?: number;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('tenants')
      .select(
        'id, name, slug, logo_url, description, industry, operating_area',
        { count: 'exact' },
      )
      .eq('status', 'active')
      .range(offset, offset + limit - 1);

    if (query.q) {
      dbQuery = dbQuery.or(`name.ilike.%${query.q}%,description.ilike.%${query.q}%,industry.ilike.%${query.q}%`);
    }

    const { data: tenants, count, error } = await dbQuery;
    if (error) throw new BadRequestException(error.message);

    if (!tenants?.length) {
      return { data: [], meta: { total: 0, page, limit } };
    }

    const tenantIds = tenants.map((t: any) => t.id);

    // Derive categories from service_pricings (no junction table needed)
    const { data: pricings } = await this.supabase.db
      .from('service_pricings')
      .select('tenant_id, category_id, service_categories!inner(id, name, slug, icon_url)')
      .in('tenant_id', tenantIds)
      .eq('is_active', true);

    // Build tenantId → distinct categories map
    const catMap: Record<string, any[]> = {};
    for (const p of pricings ?? []) {
      const cat = (p as any).service_categories;
      if (!cat) continue;
      if (!catMap[p.tenant_id]) catMap[p.tenant_id] = [];
      if (!catMap[p.tenant_id].some((c: any) => c.id === cat.id)) {
        catMap[p.tenant_id].push(cat);
      }
    }

    let result: any[] = tenants;

    // Filter by category_id if requested (client-side after map)
    if (query.category_id) {
      result = result.filter((t: any) =>
        (catMap[t.id] ?? []).some((c: any) => c.id === query.category_id),
      );
    }

    return {
      data: result.map((t: any) => ({
        ...t,
        categories: catMap[t.id] ?? [],
      })),
      meta: { total: count ?? 0, page, limit },
    };
  }

  /** Public: chi tiết workspace */
  async getWorkspaceDetail(tenantId: string) {
    const { data: tenant, error } = await this.supabase.db
      .from('tenants')
      .select(
        'id, name, slug, logo_url, description, industry, operating_area, benefits, income_level, policies, status',
      )
      .eq('id', tenantId)
      .eq('status', 'active')
      .single();

    if (error || !tenant) throw new NotFoundException('Workspace không tồn tại');

    // Lấy pricing (includes category info)
    const { data: pricings } = await this.supabase.db
      .from('service_pricings')
      .select('id, service_name, price_min, price_max, price_fixed, estimated_duration_minutes, category:category_id(id, name, slug, icon_url)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('service_name');

    // Derive distinct categories from pricings
    const categoriesMap = new Map<string, any>();
    for (const p of pricings ?? []) {
      const cat = (p as any).category;
      if (cat && !categoriesMap.has(cat.id)) {
        categoriesMap.set(cat.id, cat);
      }
    }

    // Lấy ratings trung bình
    const { data: ratingRows } = await this.supabase.db
      .from('ratings')
      .select('score')
      .eq('service_requests.tenant_id', tenantId);

    const scores = (ratingRows ?? []).map((r: any) => r.score).filter((s: any) => s != null);
    const rating_avg = scores.length > 0
      ? Math.round((scores.reduce((s: number, v: number) => s + v, 0) / scores.length) * 10) / 10
      : null;

    return {
      ...tenant,
      categories: Array.from(categoriesMap.values()),
      pricings: pricings ?? [],
      rating: { avg: rating_avg, count: scores.length },
    };
  }
}
