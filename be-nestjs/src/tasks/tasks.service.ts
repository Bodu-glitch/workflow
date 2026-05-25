import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { AssignTaskDto } from './dto/assign-task.dto.js';
import { CancelTaskDto } from './dto/cancel-task.dto.js';
import { CheckinDto } from './dto/checkin.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { haversineDistance } from '../common/utils/haversine.util.js';
import { ConfigService } from '@nestjs/config';

interface CurrentUser {
  id: string;
  tenant_id: string;
  role: string;
}

@Injectable()
export class TasksService {
  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}

  private transformTask(raw: any) {
    const { task_assignments, checkins, ...rest } = raw;
    const assignees = (task_assignments ?? []).map((ta: any) => ({
      id: ta.users?.id ?? ta.user_id,
      full_name: ta.users?.full_name ?? '',
      avatar_url: ta.users?.avatar_url ?? null,
    }));
    const checkin = checkins != null
      ? (checkins as any[]).find((c) => c.type === 'checkin') ?? null
      : undefined;
    const checkout = checkins != null
      ? (checkins as any[]).find((c) => c.type === 'checkout') ?? null
      : undefined;
    return {
      ...rest,
      assignees,
      ...(checkins != null ? { checkin, checkout } : {}),
    };
  }

  async createTask(dto: CreateTaskDto, user: CurrentUser) {
    const { assignee_ids, ...taskData } = dto;

    const { data: task, error } = await this.supabase.db
      .from('tasks')
      .insert({
        ...taskData,
        tenant_id: user.tenant_id,
        created_by: user.id,
        location_radius_m: taskData.location_radius_m ?? 100,
        priority: taskData.priority ?? 'medium',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Assign users
    if (assignee_ids && assignee_ids.length > 0) {
      const assignments = assignee_ids.map((uid) => ({
        task_id: task.id,
        user_id: uid,
        assigned_by: user.id,
      }));
      await this.supabase.db.from('task_assignments').insert(assignments);
    }

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      task_id: task.id,
      user_id: user.id,
      action: 'task_created',
      metadata: { title: task.title },
    });

    if (assignee_ids && assignee_ids.length > 0) {
      void this.notifications.sendPushNotification({
        user_ids: assignee_ids,
        type: 'task_assigned',
        title: 'New Task Assigned',
        body: `You have been assigned to: ${task.title}`,
        task_id: task.id,
        tenant_id: user.tenant_id,
      });
    }

    return this.getTask(task.id, user);
  }

  async listTasks(user: CurrentUser, pagination: PaginationDto, filters: {
    status?: string;
    priority?: string;
    area?: string;
    service_type?: string;
    assignee_id?: string;
    from?: string;
    to?: string;
    search?: string;
    overdue?: boolean;
  }) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('tasks')
      .select(`
        *,
        task_assignments(user_id, users!task_assignments_user_id_fkey(id, full_name, avatar_url)),
        creator:created_by(id, full_name)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.area) query = query.eq('area', filters.area);
    if (filters.service_type) query = query.eq('service_type', filters.service_type);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);

    if (filters.overdue) {
      // Overdue: deadline đã qua + chưa hoàn thành/huỷ/từ chối
      query = query
        .lt('deadline', new Date().toISOString())
        .not('status', 'in', '("done","cancelled","rejected")');
    }

    const orderField = filters.overdue ? 'deadline' : 'created_at';
    const { data, count, error } = await query
      .order(orderField, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: (data ?? []).map((t) => this.transformTask(t)), meta: { total: count, page, limit } };
  }

  async getFilterOptions(user: CurrentUser) {
    const [tasksRes, servicesRes] = await Promise.all([
      this.supabase.db.from('tasks').select('area').eq('tenant_id', user.tenant_id),
      this.supabase.db.from('tenant_services').select('name').eq('tenant_id', user.tenant_id).order('name'),
    ]);

    if (tasksRes.error) throw new BadRequestException(tasksRes.error.message);
    if (servicesRes.error) throw new BadRequestException(servicesRes.error.message);

    const areas = [...new Set((tasksRes.data ?? []).map((t: any) => t.area).filter(Boolean))].sort() as string[];
    const serviceTypes = (servicesRes.data ?? []).map((s: any) => s.name) as string[];

    return { areas, service_types: serviceTypes };
  }

  async getDashboard(user: CurrentUser, from?: string, to?: string) {
    let query = this.supabase.db
      .from('tasks')
      .select('status, deadline')
      .eq('tenant_id', user.tenant_id);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    const now = new Date();
    const summary: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
      rejected: 0,
      overdue: 0,
    };

    for (const task of data ?? []) {
      summary[task.status] = (summary[task.status] ?? 0) + 1;
      if (
        task.deadline &&
        new Date(task.deadline) < now &&
        !['done', 'cancelled', 'rejected'].includes(task.status)
      ) {
        summary.overdue += 1;
      }
    }

    // on_task_staff = distinct staff được gán task todo/in_progress (bất kể from/to)
    const { data: activeTasks } = await this.supabase.db
      .from('tasks')
      .select('id')
      .eq('tenant_id', user.tenant_id)
      .in('status', ['todo', 'in_progress']);

    let on_task_staff = 0;
    const activeTaskIds = (activeTasks ?? []).map((t: any) => t.id);
    const onTaskUserIds = new Set<string>();
    if (activeTaskIds.length > 0) {
      const { data: assignments } = await this.supabase.db
        .from('task_assignments')
        .select('user_id')
        .in('task_id', activeTaskIds);
      (assignments ?? []).forEach((a: any) => onTaskUserIds.add(a.user_id));
      on_task_staff = onTaskUserIds.size;
    }

    // total_staff = tổng staff thuộc tenant (không filter is_active vì không đủ tin cậy)
    const { data: staffList } = await this.supabase.db
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', user.tenant_id)
      .eq('role', 'staff');

    const total_staff = (staffList ?? []).length;
    const unassigned_staff = Math.max(0, total_staff - on_task_staff);

    return { summary, on_task_staff, unassigned_staff, total_staff };
  }

  async getChart(user: CurrentUser, period: 'week' | 'month' | 'year') {
    const now = new Date();
    // Dùng UTC nhất quán: tránh lệch ngày khi server chạy ở timezone khác UTC
    // (VD: VN UTC+7 → local midnight = UTC hôm trước → dayStr bị lùi 1 ngày)
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let fromDate: Date;

    if (period === 'week') {
      fromDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate() - 6));
    } else if (period === 'month') {
      fromDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate() - 27));
    } else {
      // year: 12 tháng, bắt đầu từ ngày 1 của tháng cách đây 11 tháng
      fromDate = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 11, 1));
    }

    // Tasks được tạo trong khoảng → cho series Created + Completed
    const { data: createdTasks } = await this.supabase.db
      .from('tasks')
      .select('created_at, status')
      .eq('tenant_id', user.tenant_id)
      .gte('created_at', fromDate.toISOString());

    // Overdue: deadline đã qua (< now) + status = 'todo' (chưa bắt đầu, bỏ qua deadline)
    // Không tính in_progress vì đang có người làm
    const { data: overdueTasks } = await this.supabase.db
      .from('tasks')
      .select('deadline')
      .eq('tenant_id', user.tenant_id)
      .not('deadline', 'is', null)
      .gte('deadline', fromDate.toISOString())
      .lt('deadline', now.toISOString())
      .eq('status', 'todo');

    const labels: string[] = [];
    const created: number[] = [];
    const completed: number[] = [];
    const overdue: number[] = [];

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        // Tính ngày bằng UTC để dayStr khớp với created_at (UTC) trong DB
        const d = new Date(fromDate);
        d.setUTCDate(fromDate.getUTCDate() + i);
        const dayStr = d.toISOString().substring(0, 10); // 'YYYY-MM-DD' UTC

        labels.push(DAYS[d.getUTCDay()]);
        created.push((createdTasks ?? []).filter((t: any) => t.created_at.startsWith(dayStr)).length);
        completed.push((createdTasks ?? []).filter((t: any) => t.created_at.startsWith(dayStr) && t.status === 'done').length);
        overdue.push((overdueTasks ?? []).filter((t: any) => (t.deadline ?? '').startsWith(dayStr)).length);
      }
    } else if (period === 'month') {
      for (let i = 0; i < 4; i++) {
        const wStart = new Date(fromDate);
        wStart.setUTCDate(fromDate.getUTCDate() + i * 7);
        const wEnd = new Date(wStart);
        wEnd.setUTCDate(wStart.getUTCDate() + 6);
        wEnd.setUTCHours(23, 59, 59, 999);

        labels.push(`W${i + 1}`);
        created.push((createdTasks ?? []).filter((t: any) => { const d = new Date(t.created_at); return d >= wStart && d <= wEnd; }).length);
        completed.push((createdTasks ?? []).filter((t: any) => { const d = new Date(t.created_at); return d >= wStart && d <= wEnd && t.status === 'done'; }).length);
        overdue.push((overdueTasks ?? []).filter((t: any) => { if (!t.deadline) return false; const d = new Date(t.deadline); return d >= wStart && d <= wEnd; }).length);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const mDate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + i, 1));
        const mStr = `${mDate.getUTCFullYear()}-${String(mDate.getUTCMonth() + 1).padStart(2, '0')}`;

        labels.push(MONTHS[mDate.getUTCMonth()]);
        created.push((createdTasks ?? []).filter((t: any) => t.created_at.startsWith(mStr)).length);
        completed.push((createdTasks ?? []).filter((t: any) => t.created_at.startsWith(mStr) && t.status === 'done').length);
        overdue.push((overdueTasks ?? []).filter((t: any) => (t.deadline ?? '').startsWith(mStr)).length);
      }
    }

    return { labels, created, completed, overdue };
  }

  async getTask(id: string, user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('tasks')
      .select(`
        *,
        task_assignments(user_id, users!task_assignments_user_id_fkey(id, full_name, avatar_url)),
        creator:created_by(id, full_name),
        checkins(*)
      `)
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (error || !data) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });
    return this.transformTask(data);
  }

  async updateTask(id: string, dto: UpdateTaskDto, user: CurrentUser) {
    const task = await this.getTask(id, user);
    if (['done', 'cancelled', 'rejected'].includes(task.status)) {
      throw new UnprocessableEntityException({ code: 'TASK_ALREADY_CLOSED', message: 'Cannot update a closed task' });
    }

    const { data, error } = await this.supabase.db
      .from('tasks')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      task_id: id,
      user_id: user.id,
      action: 'task_updated',
      metadata: dto,
    });

    return this.getTask(id, user);
  }

  async assignTask(id: string, dto: AssignTaskDto, user: CurrentUser) {
    const task = await this.getTask(id, user);

    // Get existing assignees to find new ones
    const { data: existing } = await this.supabase.db
      .from('task_assignments')
      .select('user_id')
      .eq('task_id', id);

    const existingIds = new Set((existing ?? []).map((a) => a.user_id));
    const newAssignees = dto.assignee_ids.filter((uid) => !existingIds.has(uid));

    if (newAssignees.length > 0) {
      const assignments = newAssignees.map((uid) => ({
        task_id: id,
        user_id: uid,
        assigned_by: user.id,
      }));
      await this.supabase.db.from('task_assignments').insert(assignments);

      await this.supabase.db.from('audit_logs').insert({
        tenant_id: user.tenant_id,
        task_id: id,
        user_id: user.id,
        action: 'task_assigned',
        metadata: { assignee_ids: newAssignees },
      });

      void this.notifications.sendPushNotification({
        user_ids: newAssignees,
        type: 'task_assigned',
        title: 'New Task Assigned',
        body: `You have been assigned to: ${task.title}`,
        task_id: id,
        tenant_id: user.tenant_id,
      });
    }

    return { message: 'Task assigned', new_assignees: newAssignees.length };
  }

  async unassignTask(taskId: string, staffId: string, user: CurrentUser) {
    await this.getTask(taskId, user);

    await this.supabase.db
      .from('task_assignments')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', staffId);

    return { message: 'User unassigned from task' };
  }

  async cancelTask(id: string, dto: CancelTaskDto, user: CurrentUser) {
    const task = await this.getTask(id, user);

    if (['done', 'rejected'].includes(task.status)) {
      throw new UnprocessableEntityException({ code: 'CANNOT_CANCEL', message: 'Cannot cancel a done or rejected task' });
    }

    if (task.status === 'cancelled') {
      throw new UnprocessableEntityException({ code: 'ALREADY_CANCELLED', message: 'Task already cancelled' });
    }

    const { data, error } = await this.supabase.db
      .from('tasks')
      .update({
        status: 'cancelled',
        cancel_reason: dto.cancel_reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      task_id: id,
      user_id: user.id,
      action: 'task_cancelled',
      metadata: { cancel_reason: dto.cancel_reason },
    });

    return data;
  }

  async rejectTask(id: string, reason: string, user: CurrentUser) {
    const task = await this.getTask(id, user);

    if (['done', 'cancelled'].includes(task.status)) {
      throw new UnprocessableEntityException({ code: 'CANNOT_REJECT', message: 'Cannot reject this task' });
    }

    const { data, error } = await this.supabase.db
      .from('tasks')
      .update({ status: 'rejected', cancel_reason: reason })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      task_id: id,
      user_id: user.id,
      action: 'task_rejected',
      metadata: { reason },
    });

    return data;
  }

  async checkin(
    taskId: string,
    dto: CheckinDto,
    file: Express.Multer.File | undefined,
    user: CurrentUser,
    type: 'checkin' | 'checkout',
  ) {
    const task = await this.getTask(taskId, user);

    // Verify user is an assignee
    const { data: assignment } = await this.supabase.db
      .from('task_assignments')
      .select('id')
      .eq('task_id', taskId)
      .eq('user_id', user.id)
      .single();

    if (!assignment) {
      throw new ForbiddenException({ code: 'NOT_ASSIGNEE', message: 'You are not assigned to this task' });
    }

    if (type === 'checkin' && task.status !== 'todo') {
      throw new UnprocessableEntityException({ code: 'TASK_ALREADY_STARTED', message: 'Task is not in todo status' });
    }
    if (type === 'checkout' && task.status !== 'in_progress') {
      throw new UnprocessableEntityException({ code: 'TASK_NOT_IN_PROGRESS', message: 'Task is not in progress' });
    }

    // GPS verification
    let gpsVerified = false;
    if (
      dto.gps_lat !== undefined &&
      dto.gps_lng !== undefined &&
      task.location_lat !== null &&
      task.location_lng !== null
    ) {
      const distance = haversineDistance(dto.gps_lat, dto.gps_lng, task.location_lat, task.location_lng);
      gpsVerified = distance <= task.location_radius_m;
      if (!gpsVerified) {
        throw new BadRequestException({
          code: 'GPS_OUT_OF_RANGE',
          message: `You are ${Math.round(distance)}m away from the task location (max ${task.location_radius_m}m)`,
        });
      }
    }

    // Upload photo
    let photoUrl: string | undefined;
    if (file) {
      const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
      const filePath = `${user.tenant_id}/${taskId}/${type}/${Date.now()}.${file.originalname.split('.').pop()}`;

      const { data: uploadData, error: uploadError } = await this.supabase.db.storage
        .from('checkin-photos')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) throw new BadRequestException(`Photo upload failed: ${uploadError.message}`);

      const { data: publicData } = this.supabase.db.storage
        .from('checkin-photos')
        .getPublicUrl(uploadData.path);

      photoUrl = publicData.publicUrl;
    }

    // Insert checkin record
    const { data: checkin, error } = await this.supabase.db
      .from('checkins')
      .insert({
        task_id: taskId,
        user_id: user.id,
        type,
        gps_lat: dto.gps_lat,
        gps_lng: dto.gps_lng,
        gps_verified: gpsVerified,
        photo_url: photoUrl,
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Update task status
    const newStatus = type === 'checkin' ? 'in_progress' : 'done';
    await this.supabase.db.from('tasks').update({ status: newStatus }).eq('id', taskId);

    const auditAction = type === 'checkin' ? 'checkin' : 'checkout';
    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      task_id: taskId,
      user_id: user.id,
      action: auditAction,
      metadata: { gps_verified: gpsVerified, photo_url: photoUrl },
    });

    // Notify BO/OT
    const { data: managers } = await this.supabase.db
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', user.tenant_id)
      .in('role', ['business_owner', 'operator'])
      .eq('is_active', true);

    const managerIds = (managers ?? []).map((m) => m.user_id);
    if (managerIds.length > 0) {
      const notifType = type === 'checkout' ? 'task_completed' : 'status_changed';
      void this.notifications.sendPushNotification({
        user_ids: managerIds,
        type: notifType,
        title: type === 'checkout' ? 'Task Completed' : 'Task Started',
        body: `${task.title} has been ${type === 'checkout' ? 'completed' : 'started'}`,
        task_id: taskId,
        tenant_id: user.tenant_id,
      });
    }

    return checkin;
  }
}
