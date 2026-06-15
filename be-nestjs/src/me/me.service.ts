import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { haversineDistance } from '../common/utils/haversine.util.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

const ACTIVE_STATUSES = ['assigned', 'moving', 'arrived', 'in_progress'] as const;
const TERMINAL_STATUSES = ['completed', 'completed_late', 'cancelled'] as const;

interface CurrentUser {
  id: string;
  tenant_id: string;
}

@Injectable()
export class MeService {
  constructor(
    private supabase: SupabaseService,
    private gateway: EventsGateway,
  ) {}

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

    const url = new URL(cert.file_url);
    const storagePath = url.pathname.split('/certificates/')[1];
    if (storagePath) {
      await this.supabase.db.storage.from('certificates').remove([storagePath]);
    }

    await this.supabase.db.from('user_certificates').delete().eq('id', certId);
    return { message: 'Certificate deleted' };
  }

  // ── Workspace services & payment ────────────────────────────────────────────

  async getWorkspaceServices(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('service_pricings')
      .select('id, service_name, price_fixed, price_min')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('service_name');
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.service_name,
      unit_price: r.price_fixed ?? r.price_min ?? 0,
    }));
  }

  async getPaymentInfo(tenantId: string) {
    const { data } = await this.supabase.db
      .from('tenants')
      .select('bank_name, bank_account, bank_account_name')
      .eq('id', tenantId)
      .single();
    if (!data?.bank_name) return null;
    return {
      bank_name: data.bank_name,
      bank_account: data.bank_account,
      bank_account_name: data.bank_account_name,
    };
  }

  async getRequestItems(requestId: string) {
    const { data, error } = await this.supabase.db
      .from('request_service_items')
      .select('id, service_id, label, unit_price, is_custom, checked')
      .eq('request_id', requestId)
      .order('created_at');
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async saveRequestItems(requestId: string, items: any[]) {
    await this.supabase.db.from('request_service_items').delete().eq('request_id', requestId);
    if (items.length === 0) return [];
    const rows = items.map((item) => ({
      request_id: requestId,
      service_id: item.service_id ?? null,
      label: item.label,
      unit_price: Number(item.unit_price ?? 0),
      is_custom: item.is_custom ?? false,
      checked: item.checked ?? true,
    }));
    const { data, error } = await this.supabase.db
      .from('request_service_items')
      .insert(rows)
      .select('id, service_id, label, unit_price, is_custom, checked');
    if (error) throw new BadRequestException(error.message);

    const total = rows.filter((r) => r.checked).reduce((s, r) => s + r.unit_price, 0);
    if (total > 0) {
      await this.supabase.db
        .from('service_requests')
        .update({ agreed_price: total })
        .eq('id', requestId);
    }

    return data;
  }

  // ── Request status progression (Staff) ──────────────────────────────────────

  private async getAssignedRequest(requestId: string, userId: string, tenantId: string) {
    const { data: req, error } = await this.supabase.db
      .from('service_requests')
      .select('id, status, tenant_id, location_lat, location_lng, location_radius_m, assigned_staff_id, is_in_staff_pool')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !req) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });

    const isAssignee = req.assigned_staff_id === userId;
    const isPoolClaim = req.is_in_staff_pool === true;
    if (!isAssignee && !isPoolClaim) {
      throw new UnprocessableEntityException({ code: 'NOT_ASSIGNEE', message: 'Not assigned to this request' });
    }
    return req;
  }

  async startMoving(requestId: string, user: CurrentUser) {
    const req = await this.getAssignedRequest(requestId, user.id, user.tenant_id);
    if (req.status !== 'assigned') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Request must be in assigned status' });
    }
    const { error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'moving' })
      .eq('id', requestId);
    if (error) throw new BadRequestException(error.message);
    this.gateway.emitRequestStatusChanged(requestId, 'moving');
    return { status: 'moving' };
  }

  async markArrived(requestId: string, user: CurrentUser) {
    const req = await this.getAssignedRequest(requestId, user.id, user.tenant_id);
    if (req.status !== 'moving') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Request must be in moving status' });
    }
    const { error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'arrived' })
      .eq('id', requestId);
    if (error) throw new BadRequestException(error.message);
    this.gateway.emitRequestStatusChanged(requestId, 'arrived');
    return { status: 'arrived' };
  }

  async beginWork(requestId: string, user: CurrentUser, gpsLat: number, gpsLng: number) {
    const req = await this.getAssignedRequest(requestId, user.id, user.tenant_id);
    if (req.status !== 'arrived') {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Request must be in arrived status' });
    }

    if (req.location_lat && req.location_lng) {
      const dist = haversineDistance(req.location_lat, req.location_lng, gpsLat, gpsLng);
      const radius = req.location_radius_m ?? 100;
      if (dist > radius) {
        throw new UnprocessableEntityException({
          code: 'GPS_OUT_OF_RANGE',
          message: `Bạn cách vị trí ${Math.round(dist)}m. Hãy đến đúng địa điểm.`,
        });
      }
    }

    const { error } = await this.supabase.db
      .from('service_requests')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      request_id: requestId,
      user_id: user.id,
      action: 'checkin',
      metadata: { gps_lat: gpsLat, gps_lng: gpsLng },
    });

    // Update staff online status to working
    void this.supabase.db
      .from('user_tenants')
      .update({ online_status: 'working' })
      .eq('user_id', user.id)
      .eq('tenant_id', user.tenant_id);

    this.gateway.emitRequestStatusChanged(requestId, 'in_progress');
    return { status: 'in_progress' };
  }

  async rejectRequest(requestId: string, reason: string, user: CurrentUser) {
    const req = await this.getAssignedRequest(requestId, user.id, user.tenant_id);
    if (!['assigned', 'moving', 'arrived'].includes(req.status)) {
      throw new UnprocessableEntityException({ code: 'INVALID_STATUS', message: 'Request cannot be rejected in its current status' });
    }

    const { error } = await this.supabase.db
      .from('service_requests')
      .update({
        status: 'pending_assignment',
        assigned_staff_id: null,
        assigned_by: null,
        assigned_at: null,
        is_in_staff_pool: false,
      })
      .eq('id', requestId);
    if (error) throw new BadRequestException(error.message);

    await this.supabase.db.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      request_id: requestId,
      user_id: user.id,
      action: 'request_status_changed',
      metadata: { from: req.status, to: 'pending_assignment', reason, rejected_by_staff: true },
    });

    this.gateway.emitRequestStatusChanged(requestId, 'pending_assignment');
    return { status: 'pending_assignment' };
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

    this.gateway.emitStaffUpdated(tenantId);

    return { message: 'Left workspace successfully' };
  }

  async getMyRequests(user: CurrentUser, pagination: PaginationDto, status?: string) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.supabase.db
      .from('service_requests')
      .select(`
        id, description, status, priority,
        location_address, location_lat, location_lng, location_radius_m,
        scheduled_at, agreed_price, collected_amount,
        assigned_at, started_at, completed_at, created_at, updated_at,
        category:category_id(id, name, icon_url),
        customer:customer_id(id, full_name, phone, avatar_url)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .eq('assigned_staff_id', user.id);

    if (status === 'active') {
      query = query.in('status', [...ACTIVE_STATUSES]);
    } else if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', [...ACTIVE_STATUSES]);
    }

    const { data, count, error } = await query
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async getPoolRequests(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        id, description, status, priority,
        location_address, location_lat, location_lng,
        scheduled_at, agreed_price, created_at,
        category:category_id(id, name, icon_url),
        customer:customer_id(id, full_name, avatar_url)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .eq('is_in_staff_pool', true)
      .eq('status', 'pending_assignment')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async claimPoolRequest(requestId: string, user: CurrentUser) {
    const { data: req, error: reqErr } = await this.supabase.db
      .from('service_requests')
      .select('id, status, tenant_id, scheduled_at, is_in_staff_pool, assigned_staff_id')
      .eq('id', requestId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (reqErr || !req) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });
    if (!req.is_in_staff_pool || req.status !== 'pending_assignment') {
      throw new UnprocessableEntityException({ code: 'REQUEST_NOT_AVAILABLE', message: 'Request is not available in pool' });
    }
    if (req.assigned_staff_id) {
      throw new UnprocessableEntityException({ code: 'ALREADY_CLAIMED', message: 'Request was already claimed' });
    }

    const { error } = await this.supabase.db
      .from('service_requests')
      .update({
        assigned_staff_id: user.id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        is_in_staff_pool: false,
      })
      .eq('id', requestId)
      .is('assigned_staff_id', null);

    if (error) {
      throw new UnprocessableEntityException({ code: 'ALREADY_CLAIMED', message: 'Request was claimed by another staff member' });
    }

    return { message: 'Đã nhận yêu cầu', request_id: requestId };
  }

  async getMyRequestHistory(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('service_requests')
      .select(`
        id, description, status, priority,
        location_address, agreed_price, collected_amount,
        assigned_at, completed_at, created_at,
        category:category_id(id, name, icon_url),
        checkins(type, created_at, gps_verified, photo_url)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .eq('assigned_staff_id', user.id)
      .in('status', [...TERMINAL_STATUSES])
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }
}
