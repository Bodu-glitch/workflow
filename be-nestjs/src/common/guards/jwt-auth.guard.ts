import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // Support both Authorization header and ?token= query param (used when opening PDFs in browser)
    const token =
      req.headers['authorization']?.split(' ')[1] ??
      req.query?.token;
    if (!token) throw new UnauthorizedException();

    const { data: { user }, error } = await this.supabase.db.auth.getUser(token);
    if (error || !user) {
      if (error) console.error('[JwtGuard] getUser error:', error.message);
      throw new UnauthorizedException();
    }

    const { data: dbUser } = await this.supabase.db
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    // Allow new Google users (no public.users entry yet) to pass through
    if (dbUser && !dbUser.is_active) throw new UnauthorizedException();

    if (dbUser?.role === 'superadmin') {
      req.user = { id: user.id, email: user.email, role: 'superadmin', tenant_id: null };
      return true;
    }

    const tenantId: string | null = req.headers['x-tenant-id'] ?? null;
    if (tenantId) {
      const { data: membership } = await this.supabase.db
        .from('user_tenants')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (!membership) throw new UnauthorizedException();
      req.user = { id: user.id, email: user.email, role: (membership as any).role, tenant_id: tenantId };
    } else {
      // No tenant context — use the user's own role from DB (covers 'customer' role)
      req.user = { id: user.id, email: user.email, role: dbUser?.role ?? null, tenant_id: null };
    }

    return true;
  }
}
