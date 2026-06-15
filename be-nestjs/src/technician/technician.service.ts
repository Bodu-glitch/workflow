import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { CompleteJobDto } from './dto/complete-job.dto.js';
import { RequoteJobDto } from './dto/requote-job.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class TechnicianService {
  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
    private gateway: EventsGateway,
  ) {}

  async listJobs(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url, phone),
        category:category_id(id, name, slug, icon_url)
      `, { count: 'exact' })
      .eq('assigned_staff_id', user.id)
      .not('status', 'in', '("completed","completed_late","cancelled")')
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async listHistory(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url, phone),
        category:category_id(id, name, slug, icon_url)
      `, { count: 'exact' })
      .eq('assigned_staff_id', user.id)
      .in('status', ['completed', 'completed_late', 'cancelled'])
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async getJob(id: string, user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url, phone),
        category:category_id(id, name, slug, icon_url),
        tenant:tenant_id(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Job not found' });
    if (data.assigned_staff_id !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This job is not assigned to you' });
    }
    return data;
  }

  async acceptJob(id: string, user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (job.status !== 'assigned') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Job is not in assigned status' });
    }

    // status stays 'assigned' — acceptance is implicit; staff navigates to customer
    // Notify customer
    void this.notifications.sendPushNotification({
      user_ids: [job.customer_id],
      type: 'request_accepted',
      title: 'Kỹ thuật viên đang đến',
      body: 'Kỹ thuật viên đã xác nhận và đang trên đường đến bạn',
      request_id: id,
    });

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: job.tenant_id,
      action: 'request_status_changed',
      metadata: { action: 'staff_accepted' },
    });

    return { message: 'Job accepted', request_id: id };
  }

  async declineJob(id: string, user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (job.status !== 'assigned') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot decline at this stage' });
    }

    // Unassign staff and revert to pending_assignment
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        assigned_staff_id: null,
        assigned_by: null,
        assigned_at: null,
        status: 'pending_assignment',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Notify operators
    const { data: operators } = await this.supabase.db
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', job.tenant_id)
      .in('role', ['business_owner', 'operator'])
      .eq('is_active', true);

    const operatorIds = (operators ?? []).map((o) => o.user_id);
    if (operatorIds.length > 0) {
      void this.notifications.sendPushNotification({
        user_ids: operatorIds,
        type: 'request_available',
        title: 'Kỹ thuật viên từ chối',
        body: 'Cần phân công lại nhân viên cho yêu cầu này',
        request_id: id,
        tenant_id: job.tenant_id,
      });
    }

    return data;
  }

  async startJob(id: string, lat: number, lng: number, user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (job.status !== 'assigned') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Job must be in assigned status' });
    }

    const now = new Date().toISOString();
    const deadline = job.estimated_duration_minutes
      ? new Date(Date.now() + job.estimated_duration_minutes * 60000).toISOString()
      : null;

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'in_progress', started_at: now, deadline })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Record initial location
    if (job.tenant_id) {
      void this.supabase.db.from('staff_locations').insert({
        user_id: user.id,
        tenant_id: job.tenant_id,
        lat,
        lng,
      });
    }

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: job.tenant_id,
      action: 'request_status_changed',
      metadata: { from: 'assigned', to: 'in_progress' },
    });

    this.gateway.emitRequestStatusChanged(id, 'in_progress');

    void this.notifications.sendPushNotification({
      user_ids: [job.customer_id],
      type: 'status_changed',
      title: 'Kỹ thuật viên đã đến',
      body: 'Kỹ thuật viên đang xử lý sự cố của bạn',
      request_id: id,
    });

    return data;
  }

  async completeJob(id: string, dto: CompleteJobDto, files: Express.Multer.File[], user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (job.status !== 'in_progress') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Job must be in_progress to complete' });
    }

    const now = new Date();
    const isLate = job.deadline && now > new Date(job.deadline);
    const newStatus = isLate ? 'completed_late' : 'completed';

    const updates: Record<string, any> = {
      status: newStatus,
      completed_at: now.toISOString(),
    };
    if (dto.final_price !== undefined) updates.agreed_price = dto.final_price;
    if (dto.collected_amount !== undefined) {
      updates.collected_amount = dto.collected_amount;
      updates.collected_at = now.toISOString();
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: job.tenant_id,
      action: 'request_completed',
      metadata: { status: newStatus, is_late: !!isLate, collected_amount: dto.collected_amount ?? null },
    });

    this.gateway.emitRequestStatusChanged(id, newStatus);

    void this.notifications.sendPushNotification({
      user_ids: [job.customer_id],
      type: 'request_completed',
      title: 'Sự cố đã được xử lý',
      body: 'Hãy đánh giá kỹ thuật viên của bạn',
      request_id: id,
    });

    return data;
  }

  async requoteJob(id: string, dto: RequoteJobDto, user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (!['assigned', 'in_progress'].includes(job.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot requote at this stage' });
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        requote_price: dto.requote_price,
        requote_reason: dto.requote_reason,
        requote_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    this.gateway.emitRequote(id, dto.requote_price, dto.requote_reason);

    void this.notifications.sendPushNotification({
      user_ids: [job.customer_id],
      type: 'request_available',
      title: 'Báo giá mới từ kỹ thuật viên',
      body: `Giá mới đề xuất: ${dto.requote_price.toLocaleString('vi-VN')}₫`,
      request_id: id,
    });

    return data;
  }

  // Staff: view Pool 2 — jobs in their tenant's internal staff pool
  async listPool(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url, phone),
        category:category_id(id, name, slug, icon_url)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id!)
      .eq('status', 'pending_assignment')
      .eq('is_in_staff_pool', true)
      .order('is_emergency', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  // Staff: claim a job from Pool 2
  async claimFromPool(id: string, user: CurrentUser) {
    const { data: request, error: fetchError } = await this.supabase.db
      .from('service_requests')
      .select('id, status, is_in_staff_pool, tenant_id, customer_id, description')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Job not found' });
    }
    if (!request.is_in_staff_pool || request.status !== 'pending_assignment') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Job is not in staff pool' });
    }
    if (request.tenant_id !== user.tenant_id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Job does not belong to your tenant' });
    }

    const now = new Date().toISOString();
    // Use eq('is_in_staff_pool', true) as optimistic lock so two staff can't claim simultaneously
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        assigned_staff_id: user.id,
        assigned_by: user.id,
        assigned_at: now,
        is_in_staff_pool: false,
        status: 'assigned',
      })
      .eq('id', id)
      .eq('is_in_staff_pool', true)
      .select()
      .single();

    if (error || !data) {
      throw new UnprocessableEntityException({ code: 'ALREADY_CLAIMED', message: 'Job was already claimed by another staff member' });
    }

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: user.tenant_id,
      action: 'request_assigned',
      metadata: { staff_id: user.id, source: 'staff_pool_claim' },
    });

    this.gateway.emitRequestStatusChanged(id, 'assigned');
    this.gateway.emitStaffAssigned(id, { id: user.id });

    void this.notifications.sendPushNotification({
      user_ids: [request.customer_id],
      type: 'request_accepted',
      title: 'Kỹ thuật viên đang đến',
      body: 'Yêu cầu của bạn đã được tiếp nhận',
      request_id: id,
    });

    return data;
  }

  async toggleStatus(user: CurrentUser, isOnline: boolean) {
    const { error } = await this.supabase.db
      .from('staff_status')
      .upsert({
        user_id: user.id,
        tenant_id: user.tenant_id!,
        is_online: isOnline,
        last_ping_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw new BadRequestException(error.message);
    return { is_online: isOnline };
  }

  async updateLocation(dto: UpdateLocationDto, user: CurrentUser) {
    await this.supabase.db.from('staff_locations').insert({
      user_id: user.id,
      tenant_id: user.tenant_id!,
      lat: dto.lat,
      lng: dto.lng,
      accuracy_m: dto.accuracy_m,
      heading: dto.heading,
      speed_mps: dto.speed_mps,
    });

    // Update ping timestamp
    void this.supabase.db.from('staff_status').update({
      last_ping_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    return { message: 'Location updated' };
  }

  /** GET /technician/earnings?period=day|week|month — Thu nhập nhân viên */
  async getEarnings(user: CurrentUser, period: 'day' | 'week' | 'month' = 'month') {
    const now = new Date();
    let from: Date;

    if (period === 'day') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      const day = now.getDay();
      from = new Date(now);
      from.setDate(now.getDate() - day);
      from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const { data: jobs, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        id, description, agreed_price, collected_amount, discount_amount,
        completed_at, status,
        category:category_id(id, name, slug),
        tenant:tenant_id(id, name, commission_config),
        ratings!left(score)
      `)
      .eq('assigned_staff_id', user.id)
      .in('status', ['completed', 'completed_late'])
      .gte('completed_at', from.toISOString())
      .order('completed_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    const rows = jobs ?? [];

    // Tính thu nhập
    const jobsWithEarnings = rows.map((job: any) => {
      const grossAmount = job.collected_amount ?? job.agreed_price ?? 0;
      const commissionRate = (job.tenant?.commission_config as any)?.rate ?? 0.15;
      const staffEarning = Math.round(grossAmount * (1 - commissionRate));
      return {
        id: job.id,
        description: job.description ?? '',
        agreed_price: job.agreed_price ?? 0,
        collected_amount: job.collected_amount ?? null,
        completed_at: job.completed_at,
        status: job.status,
        category: job.category,
        gross_amount: grossAmount,
        staff_earning: staffEarning,
        rating: (job.ratings as any)?.score ?? null,
      };
    });

    const totalGross = jobsWithEarnings.reduce((s, j) => s + j.gross_amount, 0);
    const totalEarning = jobsWithEarnings.reduce((s, j) => s + j.staff_earning, 0);
    const rated = jobsWithEarnings.filter((j) => j.rating != null);
    const avgRating = rated.length > 0
      ? rated.reduce((s, j) => s + j.rating!, 0) / rated.length
      : null;

    return {
      period,
      from: from.toISOString(),
      to: now.toISOString(),
      summary: {
        total_jobs: rows.length,
        total_gross: totalGross,
        total_earning: totalEarning,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      },
      jobs: jobsWithEarnings,
    };
  }

  /** PATCH /technician/jobs/:id/update-checklist — cập nhật checklist hoàn thành */
  async updateChecklist(id: string, checklist: any[], user: CurrentUser) {
    const job = await this.getJob(id, user);
    if (!['in_progress', 'assigned'].includes(job.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot update checklist at this stage' });
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({ completion_checklist: checklist })
      .eq('id', id)
      .select('id, completion_checklist, agreed_price')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Tính lại giá từ checklist
    const totalPrice = checklist
      .filter((item: any) => item.checked)
      .reduce((sum: number, item: any) => sum + (item.price ?? 0), 0);

    if (totalPrice > 0) {
      await this.supabase.db
        .from('service_requests')
        .update({ agreed_price: totalPrice })
        .eq('id', id);
    }

    return { ...data, calculated_price: totalPrice };
  }
}
