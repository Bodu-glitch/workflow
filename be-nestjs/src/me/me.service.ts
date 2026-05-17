import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUser {
  id: string;
  tenant_id: string;
}

@Injectable()
export class MeService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, email, full_name, phone, avatar_url, cccd, last_login_at')
      .eq('id', userId)
      .single();
    if (error || !data) throw new NotFoundException('User not found');

    const { data: certs } = await this.supabase.db
      .from('user_certificates')
      .select('id, name, file_url, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    return { ...data, certificates: certs ?? [] };
  }

  async updateProfile(userId: string, dto: { full_name?: string; phone?: string; cccd?: string }) {
    const update: Record<string, any> = {};
    if (dto.full_name !== undefined) update.full_name = dto.full_name;
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.cccd !== undefined) update.cccd = dto.cccd;

    const { data, error } = await this.supabase.db
      .from('users')
      .update(update)
      .eq('id', userId)
      .select('id, email, full_name, phone, avatar_url, cccd')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async uploadCertificate(userId: string, file: Express.Multer.File, name: string) {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('certificates')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from('certificates')
      .getPublicUrl(path);

    const { data, error } = await this.supabase.db
      .from('user_certificates')
      .insert({ user_id: userId, name, file_url: publicUrl })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteCertificate(userId: string, certId: string) {
    const { data: cert } = await this.supabase.db
      .from('user_certificates')
      .select('id, file_url')
      .eq('id', certId)
      .eq('user_id', userId)
      .single();

    if (!cert) throw new NotFoundException('Certificate not found');

    // Extract storage path from URL
    const url = new URL(cert.file_url);
    const storagePath = url.pathname.split('/certificates/')[1];
    if (storagePath) {
      await this.supabase.db.storage.from('certificates').remove([storagePath]);
    }

    await this.supabase.db.from('user_certificates').delete().eq('id', certId);
    return { message: 'Certificate deleted' };
  }

  async getStaffProfile(staffId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, email, full_name, phone, avatar_url, cccd')
      .eq('id', staffId)
      .single();

    if (error || !data) throw new NotFoundException('User not found');

    const { data: certs } = await this.supabase.db
      .from('user_certificates')
      .select('id, name, file_url, uploaded_at')
      .eq('user_id', staffId)
      .order('uploaded_at', { ascending: false });

    return { ...data, certificates: certs ?? [] };
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('avatars')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from('avatars')
      .getPublicUrl(path);

    // Append cache-buster so the URL changes each upload
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const { data, error } = await this.supabase.db
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select('id, email, full_name, phone, avatar_url, cccd')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async leaveWorkspace(userId: string, tenantId: string, reason?: string) {
    const { data: membership, error } = await this.supabase.db
      .from('user_tenants')
      .select('id, role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !membership) {
      throw new BadRequestException({ code: 'NOT_MEMBER', message: 'You are not a member of this workspace' });
    }

    await this.supabase.db
      .from('user_tenants')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: userId,
      action: 'member_removed',
      metadata: { removed_user_id: userId, reason: reason ?? null, self_leave: true },
    });

    return { message: 'Left workspace successfully' };
  }

  async getMyTasks(user: CurrentUser, pagination: PaginationDto, status?: string) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('task_assignments')
      .select(`
        task_id,
        tasks(
          id, title, description, status, priority,
          location_name, location_lat, location_lng, location_radius_m,
          scheduled_at, deadline, created_at, updated_at,
          creator:created_by(id, full_name)
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('tasks.status', status);
    }

    const { data, count, error } = await query
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);

    // Flatten: extract the nested tasks
    const tasks = (data ?? []).map((row: any) => row.tasks).filter(Boolean);
    return { data: tasks, meta: { total: count, page, limit } };
  }

  async getMyTaskHistory(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('task_assignments')
      .select(`
        task_id,
        assigned_at,
        tasks(
          id, title, status, priority, deadline, created_at,
          checkins(type, created_at, gps_verified, photo_url)
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .in('tasks.status', ['done', 'cancelled', 'rejected'])
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    const tasks = (data ?? []).map((row: any) => row.tasks).filter(Boolean);
    return { data: tasks, meta: { total: count, page, limit } };
  }
}
