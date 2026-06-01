import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { haversineDistance } from '../common/utils/haversine.util.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

const ACTIVE_STATUSES = ['todo', 'moving', 'arrived', 'in_progress'] as const;

interface CurrentUser {
  id: string;
  tenant_id: string;
}

@Injectable()
export class MeService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(userId: string, tenantId?: string) {
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

    let online_status: string | null = null;
    if (tenantId) {
      const { data: membership } = await this.supabase.db
        .from('user_tenants')
        .select('online_status')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();
      online_status = membership?.online_status ?? 'offline';
    }

    return { ...data, certificates: certs ?? [], online_status };
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

  // ── Task status progression ─────────────────────────────────────────────────

  private async getAssignedTask(taskId: string, userId: string, tenantId: string) {
    const { data: task, error } = await this.supabase.db
      .from('tasks')
      .select('id, status, tenant_id, location_lat, location_lng, location_radius_m')
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });

    const { data: assignment } = await this.supabase.db
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .single();
    if (!assignment) throw new UnprocessableEntityException({ code: 'NOT_ASSIGNEE', message: 'Not assigned to this task' });

    return task;
  }

  async startMoving(taskId: string, user: CurrentUser) {
    const task = await this.getAssignedTask(taskId, user.id, user.tenant_id);
    if (task.status !== 'todo') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Task must be in todo status' });
    }
    const { error } = await this.supabase.db.from('tasks').update({ status: 'moving' }).eq('id', taskId);
    if (error) throw new BadRequestException(error.message);
    return { status: 'moving' };
  }

  async markArrived(taskId: string, user: CurrentUser) {
    const task = await this.getAssignedTask(taskId, user.id, user.tenant_id);
    if (task.status !== 'moving') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Task must be in moving status' });
    }
    const { error } = await this.supabase.db.from('tasks').update({ status: 'arrived' }).eq('id', taskId);
    if (error) throw new BadRequestException(error.message);
    return { status: 'arrived' };
  }

  async beginWork(taskId: string, user: CurrentUser, gpsLat: number, gpsLng: number) {
    const task = await this.getAssignedTask(taskId, user.id, user.tenant_id);
    if (task.status !== 'arrived') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Task must be in arrived status' });
    }

    // GPS verification
    if (task.location_lat && task.location_lng) {
      const dist = haversineDistance(task.location_lat, task.location_lng, gpsLat, gpsLng);
      const radius = task.location_radius_m ?? 100;
      if (dist > radius) {
        throw new UnprocessableEntityException({
          code: 'GPS_OUT_OF_RANGE',
          message: `Bạn cách vị trí nhiệm vụ ${Math.round(dist)}m. Hãy đến đúng địa điểm.`,
        });
      }
    }

    const { error } = await this.supabase.db.from('tasks').update({ status: 'in_progress' }).eq('id', taskId);
    if (error) throw new BadRequestException(error.message);
    return { status: 'in_progress' };
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
      .delete()
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    // Reset approved application so auto-enter in select-tenant doesn't re-trigger
    await this.supabase.db
      .from('workspace_applications')
      .update({ status: 'withdrawn' })
      .eq('applicant_id', userId)
      .eq('tenant_id', tenantId)
      .eq('status', 'approved');

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

  async getPoolTasks(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // Pool = tasks in tenant with no assignees, status todo
    const { data, count, error } = await this.supabase.db
      .from('tasks')
      .select(`
        id, title, description, status, priority,
        location_name, location_lat, location_lng,
        scheduled_at, deadline, created_at,
        creator:created_by(id, full_name),
        task_assignments(user_id)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'todo')
      .is('task_assignments.user_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    // Filter out tasks that already have assignments (Supabase doesn't support NOT EXISTS directly)
    const pool = (data ?? []).filter((t: any) => !t.task_assignments || t.task_assignments.length === 0);
    return { data: pool, meta: { total: count, page, limit } };
  }

  async claimPoolTask(taskId: string, user: CurrentUser) {
    // 1. Fetch task — must belong to same tenant, status todo, no assignees
    const { data: task, error: taskErr } = await this.supabase.db
      .from('tasks')
      .select('id, title, status, tenant_id, scheduled_at, deadline')
      .eq('id', taskId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (taskErr || !task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });
    if (task.status !== 'todo') throw new UnprocessableEntityException({ code: 'TASK_NOT_AVAILABLE', message: 'Task is not available' });

    const { data: existing } = await this.supabase.db
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', taskId)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new UnprocessableEntityException({ code: 'ALREADY_CLAIMED', message: 'Task was already claimed' });
    }

    // 2. Time conflict: staff has an in_progress task whose deadline overlaps
    const newStart = task.scheduled_at ? new Date(task.scheduled_at) : null;
    const newEnd   = task.deadline      ? new Date(task.deadline)      : null;

    if (newStart || newEnd) {
      const { data: myTasks } = await this.supabase.db
        .from('task_assignments')
        .select('tasks!inner(status, scheduled_at, deadline)')
        .eq('user_id', user.id)
        .in('tasks.status', [...ACTIVE_STATUSES]);

      const conflicts = (myTasks ?? []).filter((row: any) => {
        const t = row.tasks;
        if (!t) return false;
        const s = t.scheduled_at ? new Date(t.scheduled_at) : null;
        const e = t.deadline      ? new Date(t.deadline)      : null;
        // Overlap: newStart < e AND newEnd > s
        if (newStart && e && newStart >= e) return false;
        if (newEnd   && s && newEnd   <= s) return false;
        return true;
      });

      if (conflicts.length > 0) {
        throw new UnprocessableEntityException({ code: 'TIME_CONFLICT', message: 'Thời gian nhiệm vụ này trùng với nhiệm vụ bạn đang có' });
      }
    }

    // 3. Claim — insert assignment (unique constraint prevents race condition)
    const { error: insertErr } = await this.supabase.db
      .from('task_assignments')
      .insert({ task_id: taskId, user_id: user.id, assigned_by: user.id });

    if (insertErr) {
      throw new UnprocessableEntityException({ code: 'ALREADY_CLAIMED', message: 'Task was claimed by another staff member' });
    }

    return { message: 'Đã nhận nhiệm vụ', task_id: taskId };
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
