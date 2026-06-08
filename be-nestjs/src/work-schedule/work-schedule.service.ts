import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { AssignShiftDto } from './dto/assign-shift.dto.js';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto.js';

/**
 * NOTE: Return values here go through ResponseInterceptor, which only passes-through
 * if the result has BOTH `data` AND `meta` keys. Plain objects/arrays get wrapped as
 * `{ data: <value> }`. So we return raw data — the interceptor adds the `data` wrapper.
 */
@Injectable()
export class WorkScheduleService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly gateway: EventsGateway,
  ) {}

  // ── Shifts ──────────────────────────────────────────────────────────────

  async listShifts(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('work_shifts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('start_time');
    if (error) throw new BadRequestException(error.message);
    return data; // interceptor → { data: WorkShift[] }
  }

  async createShift(tenantId: string, dto: CreateShiftDto) {
    const { data, error } = await this.supabase.db
      .from('work_shifts')
      .insert({ ...dto, tenant_id: tenantId, color: dto.color ?? '#3B82F6' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data; // interceptor → { data: WorkShift }
  }

  async deleteShift(id: string, tenantId: string) {
    const { error } = await this.supabase.db
      .from('work_shifts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { success: true }; // interceptor → { data: { success: true } }
  }

  // ── Shift Assignments ────────────────────────────────────────────────────

  async getAssignments(tenantId: string, from: string, to: string) {
    const { data, error } = await this.supabase.db
      .from('shift_assignments')
      .select(
        'id, shift_id, work_date, note, created_at, ' +
        'users!user_id(id, full_name, avatar_url), ' +
        'work_shifts!shift_id(id, name, start_time, end_time, color)',
      )
      .eq('tenant_id', tenantId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date');
    if (error) throw new BadRequestException(error.message);
    return data; // interceptor → { data: ShiftAssignment[] }
  }

  async createAssignment(tenantId: string, createdBy: string, dto: AssignShiftDto) {
    const rows = dto.user_ids.map((userId) => ({
      shift_id: dto.shift_id,
      user_id: userId,
      tenant_id: tenantId,
      work_date: dto.work_date,
      note: dto.note,
      created_by: createdBy,
    }));
    const { data, error } = await this.supabase.db
      .from('shift_assignments')
      .upsert(rows, { onConflict: 'shift_id,user_id,work_date', ignoreDuplicates: true })
      .select(
        'id, shift_id, work_date, ' +
        'users!user_id(id, full_name, avatar_url), ' +
        'work_shifts!shift_id(id, name, start_time, end_time, color)',
      );
    if (error) throw new BadRequestException(error.message);

    for (const userId of dto.user_ids) {
      this.gateway.emitScheduleUpdated(userId);
    }
    this.gateway.emitTenantScheduleUpdated(tenantId);

    return data; // interceptor → { data: ShiftAssignment[] }
  }

  async deleteAssignment(id: string, tenantId: string) {
    // Lấy thông tin trước khi xóa để kiểm tra work_date
    const { data: assignment } = await this.supabase.db
      .from('shift_assignments')
      .select('user_id, work_date')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    const { error } = await this.supabase.db
      .from('shift_assignments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);

    if (assignment?.user_id) {
      this.gateway.emitScheduleUpdated(assignment.user_id);
    }
    this.gateway.emitTenantScheduleUpdated(tenantId);

    return { success: true };
  }

  // ── Leave Requests (BO/OT) ────────────────────────────────────────────────

  async listLeaveRequests(tenantId: string, status?: string) {
    let query = this.supabase.db
      .from('leave_requests')
      .select('*, users!user_id(id, full_name, email, avatar_url)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async reviewLeaveRequest(
    id: string,
    tenantId: string,
    reviewerId: string,
    dto: ReviewLeaveRequestDto,
  ) {
    const { data, error } = await this.supabase.db
      .from('leave_requests')
      .update({
        status: dto.action,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        reject_reason: dto.action === 'rejected' ? (dto.reject_reason ?? null) : null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .select('*, users!user_id(id, full_name)')
      .single();
    if (error || !data)
      throw new NotFoundException({
        code: 'LEAVE_REQUEST_NOT_FOUND',
        message: 'Đơn nghỉ phép không tồn tại hoặc đã được xử lý',
      });

    this.gateway.emitScheduleUpdated(data.user_id);
    this.gateway.emitTenantScheduleUpdated(tenantId);

    return data;
  }

  // ── Me (staff) ────────────────────────────────────────────────────────────

  async myAssignments(userId: string, tenantId: string, from: string, to: string) {
    const { data, error } = await this.supabase.db
      .from('shift_assignments')
      .select('id, work_date, note, work_shifts!shift_id(id, name, start_time, end_time, color)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date');
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async myLeaveRequests(userId: string, tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createLeaveRequest(userId: string, tenantId: string, dto: CreateLeaveRequestDto) {
    const { data, error } = await this.supabase.db
      .from('leave_requests')
      .insert({ ...dto, user_id: userId, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
