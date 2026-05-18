import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

interface CurrentUser {
  id: string;
  tenant_id: string;
  role: string;
}

@Injectable()
export class TenantService {
  constructor(private supabase: SupabaseService) {}

  async listServices(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('tenant_services')
      .select('id, name, created_at')
      .eq('tenant_id', user.tenant_id)
      .order('name', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    // Return plain array — ResponseInterceptor wraps it as { data: [...] }
    return data ?? [];
  }

  async createService(user: CurrentUser, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Service name is required');

    const { data, error } = await this.supabase.db
      .from('tenant_services')
      .insert({ tenant_id: user.tenant_id, name: trimmed })
      .select('id, name, created_at')
      .single();

    if (error) {
      if (error.code === '23505') throw new BadRequestException('Service already exists');
      throw new BadRequestException(error.message);
    }
    // Return plain object — ResponseInterceptor wraps it as { data: { ... } }
    return data;
  }

  async deleteService(user: CurrentUser, id: string) {
    const { data: existing } = await this.supabase.db
      .from('tenant_services')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!existing) throw new NotFoundException('Service not found');

    const { error } = await this.supabase.db
      .from('tenant_services')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }
}