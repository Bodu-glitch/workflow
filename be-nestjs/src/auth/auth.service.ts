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
      .select('id, email, full_name, role, phone, avatar_url, last_login_at, created_at, is_active')
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
}
