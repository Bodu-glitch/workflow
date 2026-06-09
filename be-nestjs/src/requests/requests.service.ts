import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MatchingService } from '../matching/matching.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { SelectTenantDto } from './dto/select-tenant.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { ConfirmPriceDto } from './dto/confirm-price.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { VouchersService } from '../vouchers/vouchers.service.js';

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

const TERMINAL_STATUSES = ['completed', 'completed_late', 'cancelled'];

@Injectable()
export class RequestsService {
  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
    private matching: MatchingService,
    private gateway: EventsGateway,
    private config: ConfigService,
    private vouchers: VouchersService,
  ) {}

  async createRequest(
    dto: CreateRequestDto,
    files: Express.Multer.File[],
    user: CurrentUser,
  ) {
    const photoUrls: string[] = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await this.supabase.db.storage
        .from('request-photos')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

      if (uploadError) throw new BadRequestException(`Photo upload failed: ${uploadError.message}`);

      const { data: publicData } = this.supabase.db.storage
        .from('request-photos')
        .getPublicUrl(uploadData.path);

      photoUrls.push(publicData.publicUrl);
    }

    const suggestedCategories = await this.matching.suggestCategories(dto.description);
    const suggestedIds = suggestedCategories.map((c) => c.id);
    const resolvedCategoryId = dto.category_id ?? (suggestedCategories[0]?.id ?? null);

    const priority = dto.is_emergency ? 'sos' : 'normal';
    const isScheduled = !!dto.scheduled_at;

    const { data: request, error } = await this.supabase.db
      .from('service_requests')
      .insert({
        customer_id: user.id,
        description: dto.description,
        photo_urls: photoUrls,
        location_lat: dto.location_lat,
        location_lng: dto.location_lng,
        location_name: dto.location_name,
        location_address: dto.location_address,
        category_id: resolvedCategoryId,
        ai_suggested_categories: suggestedIds.length > 0 ? suggestedIds : null,
        is_emergency: dto.is_emergency ?? false,
        priority,
        scheduled_at: dto.scheduled_at ?? null,
        status: isScheduled ? 'unavailable' : 'available',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: request.id,
      user_id: user.id,
      action: 'request_created',
      metadata: { description: dto.description.substring(0, 100), priority },
    });

    // Always populate matches; only notify tenants for immediately available requests
    if (resolvedCategoryId) {
      void this.autoMatchAndNotify(request.id, resolvedCategoryId, isScheduled);
    }

    return { ...request, suggested_categories: suggestedCategories };
  }

  async listRequests(user: CurrentUser, pagination: PaginationDto, filters: { status?: string }) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('service_requests')
      .select(`
        *,
        category:category_id(id, name, slug, icon_url),
        tenant:tenant_id(id, name, slug),
        staff:assigned_staff_id(id, full_name, avatar_url, rating_avg)
      `, { count: 'exact' });

    if (user.role === 'customer') {
      query = query.eq('customer_id', user.id);
    } else if (user.tenant_id) {
      query = query.eq('tenant_id', user.tenant_id);
    }

    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async getRequest(id: string, user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url, phone),
        category:category_id(id, name, slug, icon_url),
        tenant:tenant_id(id, name, slug),
        pricing:pricing_id(id, service_name, price_min, price_max, price_fixed, currency, estimated_duration_minutes),
        staff:assigned_staff_id(id, full_name, avatar_url, phone, rating_avg, rating_count)
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Service request not found' });

    this.enforceAccess(data, user);
    return data;
  }

  async cancelRequest(id: string, dto: CancelRequestDto, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (TERMINAL_STATUSES.includes(request.status)) {
      throw new UnprocessableEntityException({ code: 'CANNOT_CANCEL', message: 'Request is already closed' });
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'cancelled', cancel_reason: dto.cancel_reason, cancelled_by: user.id, cancelled_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      action: 'request_cancelled',
      metadata: { cancel_reason: dto.cancel_reason },
    });

    this.gateway.emitRequestStatusChanged(id, 'cancelled');

    if (request.assigned_staff_id) {
      this.gateway.emitJobCancelled(request.assigned_staff_id, id, dto.cancel_reason);
      void this.notifications.sendPushNotification({
        user_ids: [request.assigned_staff_id],
        type: 'request_cancelled',
        title: 'Yêu cầu đã bị hủy',
        body: 'Khách hàng đã hủy yêu cầu hỗ trợ',
        request_id: id,
      });
    }

    return data;
  }

  async matchCategories(description: string) {
    const suggestions = await this.matching.suggestCategories(description);
    return { suggestions };
  }

  // Customer: view matched tenants + pricing for a request
  async getMatchingTenants(id: string, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (request.customer_id !== user.id && user.role !== 'superadmin') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const { data, error } = await this.supabase.db
      .from('request_tenant_matches')
      .select(`
        id,
        matched_at,
        tenant:tenant_id(id, name, slug),
        pricing:pricing_id(id, service_name, price_min, price_max, price_fixed, currency, estimated_duration_minutes)
      `)
      .eq('request_id', id);

    if (error) throw new BadRequestException(error.message);
    return { matches: data ?? [] };
  }

  // Customer: select a tenant → status: available → pending_assignment
  async selectTenant(id: string, dto: SelectTenantDto, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (!['available', 'unavailable'].includes(request.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot select tenant at this stage' });
    }

    // Verify the tenant is in the match list for this request
    const { data: match } = await this.supabase.db
      .from('request_tenant_matches')
      .select('id, pricing_id')
      .eq('request_id', id)
      .eq('tenant_id', dto.tenant_id)
      .single();

    if (!match) {
      throw new BadRequestException({ code: 'TENANT_NOT_MATCHED', message: 'Tenant is not in the matched list for this request' });
    }

    // Scheduled requests stay 'unavailable' until scheduled time; immediate requests go to 'pending_assignment'
    const newStatus = request.status === 'unavailable' ? 'unavailable' : 'pending_assignment';

    let voucherId: string | null = null;
    let discountAmount: number | null = null;
    if (dto.voucher_code && dto.agreed_price != null) {
      try {
        const vr = await this.vouchers.validate(dto.voucher_code, dto.tenant_id, dto.agreed_price);
        voucherId = vr.voucher_id;
        discountAmount = vr.discount_amount;
        // Increment used_count
        await this.supabase.db.rpc('increment_voucher_used_count', { voucher_id: voucherId });
      } catch {
        // voucher invalid — proceed without discount
      }
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        tenant_id: dto.tenant_id,
        pricing_id: dto.pricing_id ?? match.pricing_id ?? null,
        status: newStatus,
        ...(voucherId ? { voucher_id: voucherId, discount_amount: discountAmount } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: dto.tenant_id,
      action: 'request_status_changed',
      metadata: { from: request.status, to: newStatus, tenant_id: dto.tenant_id },
    });

    if (newStatus === 'pending_assignment') {
      this.gateway.emitRequestStatusChanged(id, 'pending_assignment');
    }

    // Notify operators of selected tenant
    const { data: operators } = await this.supabase.db
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', dto.tenant_id)
      .in('role', ['business_owner', 'operator'])
      .eq('is_active', true);

    const operatorIds = (operators ?? []).map((o: any) => o.user_id);
    if (operatorIds.length > 0) {
      void this.notifications.sendPushNotification({
        user_ids: operatorIds,
        type: 'request_available',
        title: 'Khách hàng đã chọn bạn!',
        body: `Yêu cầu: ${request.description.substring(0, 60)}`,
        request_id: id,
        tenant_id: dto.tenant_id,
      });
    }

    return data;
  }

  // Customer: release back to pool (Pool 1) → pending_assignment → available
  async releaseToPool(id: string, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (request.status !== 'pending_assignment') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Request is not in pending_assignment status' });
    }

    const previousTenantId = request.tenant_id;

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'available', tenant_id: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      action: 'request_status_changed',
      metadata: { from: 'pending_assignment', to: 'available', reason: 'customer_released' },
    });

    this.gateway.emitRequestStatusChanged(id, 'available');

    // Re-notify all matched tenants except the rejected one
    const { data: matches } = await this.supabase.db
      .from('request_tenant_matches')
      .select('tenant_id')
      .eq('request_id', id)
      .neq('tenant_id', previousTenantId ?? '');

    for (const match of matches ?? []) {
      this.gateway.emitPoolNewRequest((match as any).tenant_id, {
        requestId: id,
        category_id: request.category_id,
        is_emergency: request.is_emergency,
      });
    }

    return data;
  }

  // Operator: push to internal staff pool (Pool 2) — from pending_assignment
  async pushToStaffPool(id: string, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (!['pending_assignment'].includes(request.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot push to staff pool at this stage' });
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        status: 'pending_assignment',
        is_in_staff_pool: true,
        assigned_staff_id: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: user.tenant_id,
      action: 'request_status_changed',
      metadata: { to: 'pending_assignment', is_in_staff_pool: true },
    });

    this.gateway.emitStaffPoolUpdated(user.tenant_id!, id);

    return data;
  }

  async confirmPrice(id: string, dto: ConfirmPriceDto, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (!['pending_assignment'].includes(request.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot confirm price at this stage' });
    }

    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({ agreed_price: dto.agreed_price })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // Operator: pool view — available requests matched to this tenant + their in-progress requests
  async getPool(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;
    const tenantId = user.tenant_id!;

    // Get request IDs matched to this tenant (Pool 1 candidates)
    const { data: matches } = await this.supabase.db
      .from('request_tenant_matches')
      .select('request_id')
      .eq('tenant_id', tenantId);

    const matchedIds = (matches ?? []).map((m: any) => m.request_id as string);

    const baseSelect = this.supabase.db
      .from('service_requests')
      .select(`
        *,
        customer:customer_id(id, full_name, avatar_url),
        category:category_id(id, name, slug, icon_url)
      `, { count: 'exact' });

    let query;
    if (matchedIds.length > 0) {
      // Pool 1: available requests matched to this tenant
      // + All non-terminal requests where tenant_id = tenantId
      query = baseSelect.or(
        `and(status.eq.available,id.in.(${matchedIds.join(',')})),` +
        `and(tenant_id.eq.${tenantId},status.in.(pending_assignment,assigned,in_progress))`,
      );
    } else {
      query = baseSelect
        .eq('tenant_id', tenantId)
        .in('status', ['pending_assignment', 'assigned', 'in_progress']);
    }

    const { data, count, error } = await query
      .order('is_emergency', { ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  // Operator: assign a staff member (from negotiating or pending_assignment)
  async assignStaff(id: string, dto: AssignRequestDto, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (!['pending_assignment', 'assigned'].includes(request.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Cannot assign staff at this stage' });
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .update({
        assigned_staff_id: dto.staff_id,
        assigned_by: user.id,
        assigned_at: now,
        status: 'assigned',
        is_in_staff_pool: false,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      request_id: id,
      user_id: user.id,
      tenant_id: user.tenant_id,
      action: 'request_assigned',
      metadata: { staff_id: dto.staff_id },
    });

    this.gateway.emitRequestStatusChanged(id, 'assigned');
    this.gateway.emitStaffAssigned(id, { id: dto.staff_id });
    this.gateway.emitJobAssigned(dto.staff_id, {
      requestId: id,
      customerName: (request as any).customer?.full_name,
      location: { lat: request.location_lat, lng: request.location_lng },
      category: (request as any).category?.name,
    });

    void this.notifications.sendPushNotification({
      user_ids: [dto.staff_id],
      type: 'request_assigned',
      title: 'Bạn có việc mới!',
      body: `Yêu cầu hỗ trợ: ${request.description.substring(0, 60)}`,
      request_id: id,
      tenant_id: user.tenant_id ?? undefined,
    });

    void this.notifications.sendPushNotification({
      user_ids: [request.customer_id],
      type: 'request_accepted',
      title: 'Kỹ thuật viên đang đến',
      body: 'Yêu cầu của bạn đã được tiếp nhận',
      request_id: id,
    });

    return data;
  }

  async getCandidates(id: string, user: CurrentUser) {
    const request = await this.getRequest(id, user);

    if (!request.tenant_id || !request.category_id) {
      throw new BadRequestException({ code: 'MISSING_CONTEXT', message: 'Request must have tenant and category assigned' });
    }

    const candidates = await this.matching.findCandidates(
      request.tenant_id,
      request.category_id,
      request.location_lat,
      request.location_lng,
    );

    return { candidates };
  }

  async getDashboard(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('service_requests')
      .select('status, is_emergency')
      .eq('tenant_id', user.tenant_id!);

    if (error) throw new BadRequestException(error.message);

    const summary: Record<string, number> = {
      unavailable: 0,
      available: 0,
      pending_assignment: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      completed_late: 0,
      cancelled: 0,
      emergency: 0,
    };

    for (const r of data ?? []) {
      summary[r.status] = (summary[r.status] ?? 0) + 1;
      if (r.is_emergency) summary.emergency += 1;
    }

    return { summary };
  }

  private async autoMatchAndNotify(requestId: string, categoryId: string, skipNotify = false) {
    const tenants = await this.matching.findMatchingTenants(categoryId);
    if (tenants.length === 0) return;

    const matchRows = tenants.map(({ tenant, pricing }) => ({
      request_id: requestId,
      tenant_id: tenant.id,
      pricing_id: pricing?.id ?? null,
    }));

    await this.supabase.db.from('request_tenant_matches').insert(matchRows);

    if (!skipNotify) {
      for (const { tenant, pricing } of tenants) {
        this.gateway.emitPoolNewRequest(tenant.id, {
          requestId,
          category_id: categoryId,
          pricing: pricing
            ? { min: pricing.price_min, max: pricing.price_max, fixed: pricing.price_fixed }
            : null,
        });
      }
    }
  }

  // Customer: view bill + payment QR after task completion
  async getBill(requestId: string, user: CurrentUser) {
    const request = await this.getRequest(requestId, user);

    const taskId = (request as any).task_id;
    const taskStatus = (request as any).task?.status;
    const isCompleted = taskStatus === 'done'
      || ['completed', 'completed_late'].includes(request.status);

    if (!isCompleted) {
      throw new UnprocessableEntityException({
        code: 'BILL_NOT_READY',
        message: 'Hóa đơn sẽ có sau khi nhân viên hoàn thành công việc.',
      });
    }

    // Service items from the linked task
    let items: Array<{ label: string; unit_price: number }> = [];
    if (taskId) {
      const { data: serviceItems } = await this.supabase.db
        .from('task_service_items')
        .select('label, unit_price, checked')
        .eq('task_id', taskId)
        .eq('checked', true)
        .order('created_at');
      items = (serviceItems ?? []).map((i: any) => ({ label: i.label, unit_price: Number(i.unit_price) || 0 }));
    }

    const itemsTotal = items.reduce((s, i) => s + i.unit_price, 0);
    // Prefer the actual collected/agreed amount if set, else the checklist total
    const total = request.collected_amount ?? request.agreed_price ?? itemsTotal;

    // Tenant bank payment info for VietQR
    let payment: { bank_code: string; account_number: string; account_name: string } | null = null;
    if (request.tenant_id) {
      const { data: tenant } = await this.supabase.db
        .from('tenants')
        .select('settings')
        .eq('id', request.tenant_id)
        .single();
      payment = (tenant?.settings as any)?.payment ?? null;
    }

    return {
      request_id: requestId,
      tenant: request.tenant,
      items,
      items_total: itemsTotal,
      total,
      collected_amount: request.collected_amount ?? null,
      payment,
      status: taskStatus ?? request.status,
    };
  }

  // BO/OT: convert a customer service_request into a pool task
  async createTaskFromRequest(requestId: string, user: CurrentUser) {
    const { data: req, error: reqErr } = await this.supabase.db
      .from('service_requests')
      .select('*, customer:customer_id(id, full_name, phone, email)')
      .eq('id', requestId)
      .single();

    if (reqErr || !req) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });
    if (req.tenant_id !== user.tenant_id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Request does not belong to your workspace' });
    }
    if (req.task_id) {
      throw new UnprocessableEntityException({ code: 'TASK_ALREADY_CREATED', message: 'Task already created from this request' });
    }

    const title = (req.description ?? '').slice(0, 100) || 'Yêu cầu từ khách hàng';
    const { data: task, error: taskErr } = await this.supabase.db
      .from('tasks')
      .insert({
        title,
        description: req.description,
        tenant_id: req.tenant_id,
        created_by: user.id,
        status: 'todo',
        priority: req.is_emergency ? 'urgent' : 'medium',
        location_lat: req.location_lat,
        location_lng: req.location_lng,
        location_name: req.location_name ?? req.location_address,
        location_radius_m: 100,
        customer_name: (req.customer as any)?.full_name ?? null,
        customer_phone: (req.customer as any)?.phone ?? null,
        customer_email: (req.customer as any)?.email ?? null,
        scheduled_at: req.scheduled_at,
      })
      .select()
      .single();

    if (taskErr || !task) throw new BadRequestException(taskErr?.message ?? 'Failed to create task');

    // Link task back to service_request
    await this.supabase.db
      .from('service_requests')
      .update({ task_id: task.id, status: 'pending_assignment' })
      .eq('id', requestId);

    // Notify nearby staff (F1) — fire-and-forget
    if (task.location_lat && task.location_lng) {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: locs } = await this.supabase.db
        .from('staff_locations')
        .select('user_id, lat, lng')
        .eq('tenant_id', user.tenant_id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      if (locs && locs.length > 0) {
        const seen = new Set<string>();
        const nearby: string[] = [];
        for (const loc of locs) {
          if (seen.has(loc.user_id)) continue;
          seen.add(loc.user_id);
          const dLat = (task.location_lat - loc.lat) * Math.PI / 180;
          const dLng = (task.location_lng - loc.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(task.location_lat * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist <= 10_000) nearby.push(loc.user_id);
        }
        if (nearby.length > 0) {
          void this.notifications.sendPushNotification({
            user_ids: nearby,
            type: 'new_pool_task',
            title: 'Nhiệm vụ mới gần bạn',
            body: `${task.title} – Nhấn để nhận ngay!`,
            task_id: task.id,
            tenant_id: user.tenant_id,
          });
        }
      }
    }

    return { task_id: task.id, message: 'Task created and added to pool' };
  }

  private enforceAccess(request: any, user: CurrentUser) {
    if (user.role === 'superadmin') return;
    if (user.role === 'customer' && request.customer_id !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    if (['business_owner', 'operator'].includes(user.role) && request.tenant_id && request.tenant_id !== user.tenant_id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }
    if (user.role === 'staff' && request.assigned_staff_id !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }
  }
}
