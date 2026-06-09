import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { CompleteGoogleOnboardingDto } from './dto/complete-google-onboarding.dto.js';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  async googleLogin(dto: GoogleAuthDto) {
    const { data: { user: googleUser }, error } = await this.supabase.db.auth.getUser(dto.access_token);

    if (error || !googleUser) {
      throw new UnauthorizedException({ error: { code: 'INVALID_TOKEN', message: 'Token không hợp lệ' } });
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, email, full_name, role, avatar_url, is_active')
      .eq('id', googleUser.id)
      .single();

    if (!user || !user.is_active) {
      return {
        requires_onboarding: true,
        user: {
          email: googleUser.email,
          full_name: googleUser.user_metadata?.full_name ?? googleUser.user_metadata?.name ?? null,
        },
      };
    }

    await this.supabase.db
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Customers skip tenant onboarding
    if (user.role === 'customer') {
      return {
        access_token: dto.access_token,
        user: { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url, role: 'customer' },
      };
    }

    const { data: memberships } = await this.supabase.db
      .from('user_tenants')
      .select('role, tenant_id, tenants!inner(id, name, slug, status)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('tenants.status', 'active');

    if (!memberships || memberships.length === 0) {
      return {
        requires_onboarding: true,
        user: { email: user.email, full_name: user.full_name },
      };
    }

    const tenants = (memberships as any[]).map((m) => ({
      id: m.tenants.id,
      name: m.tenants.name,
      slug: m.tenants.slug,
      role: m.role,
    }));

    const tokens = { access_token: dto.access_token };
    const userInfo = { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url };

    if (memberships.length === 1) {
      const m = memberships[0] as any;
      return { ...tokens, user: { ...userInfo, role: m.role, tenant_id: m.tenant_id }, tenants };
    }

    return { ...tokens, user: userInfo, tenants, requires_tenant_selection: true };
  }

  async registerCustomer(accessToken: string) {
    const { data: { user: googleUser }, error } = await this.supabase.db.auth.getUser(accessToken);

    if (error || !googleUser) {
      throw new UnauthorizedException({ error: { code: 'INVALID_TOKEN', message: 'Token không hợp lệ' } });
    }

    const fullName = googleUser.user_metadata?.full_name
      ?? googleUser.user_metadata?.name
      ?? googleUser.email!;

    const { error: upsertError } = await this.supabase.db
      .from('users')
      .upsert(
        {
          id: googleUser.id,
          email: googleUser.email!,
          full_name: fullName,
          role: 'customer',
          avatar_url: googleUser.user_metadata?.avatar_url ?? null,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (upsertError) throw new BadRequestException(upsertError.message);

    return {
      access_token: accessToken,
      user: {
        id: googleUser.id,
        email: googleUser.email,
        full_name: fullName,
        role: 'customer',
      },
    };
  }

  async completeGoogleOnboarding(dto: CompleteGoogleOnboardingDto) {
    const { data: { user: googleUser }, error } = await this.supabase.db.auth.getUser(dto.access_token);

    if (error || !googleUser) {
      throw new UnauthorizedException({ error: { code: 'INVALID_TOKEN', message: 'Token không hợp lệ' } });
    }

    const fullName = dto.full_name
      ?? googleUser.user_metadata?.full_name
      ?? googleUser.user_metadata?.name
      ?? googleUser.email!;

    await this.supabase.db
      .from('users')
      .upsert(
        { id: googleUser.id, email: googleUser.email!, full_name: fullName },
        { onConflict: 'id' },
      );

    const slug = dto.tenant_slug ?? generateSlug(dto.tenant_name);

    const { data: existingTenant } = await this.supabase.db
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      throw new ConflictException({ error: { code: 'SLUG_ALREADY_EXISTS', message: 'Tên miền đã được sử dụng' } });
    }

    const { data: tenant, error: tenantError } = await this.supabase.db
      .from('tenants')
      .insert({ name: dto.tenant_name, slug })
      .select()
      .single();

    if (tenantError) throw new BadRequestException(tenantError.message);

    await this.supabase.db.from('user_tenants').insert({
      user_id: googleUser.id,
      tenant_id: tenant.id,
      role: 'business_owner',
    });

    await this.supabase.db
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', googleUser.id);

    return {
      access_token: dto.access_token,
      user: {
        id: googleUser.id,
        email: googleUser.email,
        full_name: fullName,
        role: 'business_owner',
        tenant_id: tenant.id,
      },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    };
  }

  async logout(userId: string) {
    await this.supabase.db
      .from('users')
      .update({ device_token: null })
      .eq('id', userId);
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string, tenantId: string | null) {
    const { data: user, error } = await this.supabase.db
      .from('users')
      .select('id, email, full_name, role, phone, address, avatar_url, last_login_at, created_at, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { requires_onboarding: true };
    }

    if (user.role === 'superadmin') {
      return { ...user, tenant_id: null, tenants: [] };
    }

    const { data: memberships } = await this.supabase.db
      .from('user_tenants')
      .select('role, tenant_id, tenants!inner(id, name, slug, status)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('tenants.status', 'active');

    const tenants = (memberships ?? []).map((m: any) => ({
      id: m.tenants.id,
      name: m.tenants.name,
      slug: m.tenants.slug,
      role: m.role,
    }));

    // New Google user auto-created by trigger but has no workspace yet
    if (tenants.length === 0) {
      return { requires_onboarding: true };
    }

    if (tenantId) {
      const membership = (memberships ?? []).find((m: any) => m.tenant_id === tenantId);
      return {
        ...user,
        role: (membership as any)?.role ?? user.role,
        tenant_id: tenantId,
        tenants,
      };
    }

    return { ...user, tenant_id: null, tenants };
  }

  async createTenant(userId: string, dto: { tenant_name: string; tenant_slug?: string }) {
    const slug = dto.tenant_slug ?? generateSlug(dto.tenant_name);

    const { data: existingTenant } = await this.supabase.db
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      throw new ConflictException({ code: 'SLUG_ALREADY_EXISTS', message: 'Tenant slug already taken' });
    }

    const { data: tenant, error: tenantError } = await this.supabase.db
      .from('tenants')
      .insert({ name: dto.tenant_name, slug })
      .select()
      .single();

    if (tenantError) throw new BadRequestException(tenantError.message);

    await this.supabase.db.from('user_tenants').insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: 'business_owner',
    });

    return { tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } };
  }

  async updateDeviceToken(userId: string, deviceToken: string | null) {
    await this.supabase.db
      .from('users')
      .update({ device_token: deviceToken })
      .eq('id', userId);
    return { message: 'Device token updated' };
  }

  async updateCustomerProfile(userId: string, dto: { full_name?: string; phone?: string; address?: string }) {
    const update: Record<string, any> = {};
    if (dto.full_name?.trim()) update.full_name = dto.full_name.trim();
    if (dto.phone !== undefined) update.phone = dto.phone.trim() || null;
    if (dto.address !== undefined) update.address = dto.address.trim() || null;

    const { data, error } = await this.supabase.db
      .from('users')
      .update(update)
      .eq('id', userId)
      .select('id, email, full_name, phone, address, avatar_url, role')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // Public workspace listing for customer app
  async listPublicWorkspaces(params: {
    search?: string;
    category?: string;
    lat?: number;
    lng?: number;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, search, category } = params;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('tenants')
      .select(`
        id, name, slug, logo_url, description, industry, operating_area,
        benefits, income_level, status
      `, { count: 'exact' })
      .eq('status', 'active')
      .range(offset, offset + limit - 1)
      .order('name');

    if (search) query = query.ilike('name', `%${search}%`);
    if (category) query = query.ilike('industry', `%${category}%`);

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async getPublicWorkspace(slug: string) {
    const { data: tenant, error } = await this.supabase.db
      .from('tenants')
      .select('id, name, slug, logo_url, description, industry, operating_area, benefits, income_level, status')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !tenant) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workspace not found' });

    // Get services
    const { data: services } = await this.supabase.db
      .from('tenant_services')
      .select('id, name')
      .eq('tenant_id', tenant.id);

    // Get average rating
    const { data: ratings } = await this.supabase.db
      .from('ratings')
      .select('score')
      .eq('tenant_id', tenant.id);

    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((s: number, r: any) => s + r.score, 0) / ratings.length
      : null;

    return { ...tenant, services: services ?? [], rating_avg: avgRating, rating_count: ratings?.length ?? 0 };
  }
}
