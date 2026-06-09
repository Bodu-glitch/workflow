import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';

@Injectable()
export class WorkspaceService {
  constructor(private supabase: SupabaseService) {}

  async getProfile(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('tenants')
      .select('id, name, slug, logo_url, description, industry, operating_area, benefits, income_level, policies, status, created_at')
      .eq('id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Workspace not found');
    return data;
  }

  async updateProfile(tenantId: string, dto: UpdateWorkspaceDto) {
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.description !== undefined) update.description = dto.description.trim();
    if (dto.industry !== undefined) update.industry = dto.industry.trim();
    if (dto.operating_area !== undefined) update.operating_area = dto.operating_area.trim();
    if (dto.benefits !== undefined) update.benefits = dto.benefits.trim();
    if (dto.income_level !== undefined) update.income_level = dto.income_level.trim();
    if (dto.policies !== undefined) update.policies = dto.policies.trim();

    const { data, error } = await this.supabase.db
      .from('tenants')
      .update(update)
      .eq('id', tenantId)
      .select('id, name, slug, logo_url, description, industry, operating_area, benefits, income_level, policies, status')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** PATCH status — BO only.
   *  Allowed transitions: active | inactive | pending.
   *  'suspended' is superadmin-only — throws ForbiddenException. */
  async updateStatus(tenantId: string, status: 'active' | 'inactive' | 'pending') {
    // Safety guard: re-check current status; prevent BO from touching suspended tenant
    const { data: current } = await this.supabase.db
      .from('tenants')
      .select('status')
      .eq('id', tenantId)
      .single();

    if (current?.status === 'suspended') {
      throw new BadRequestException({
        code: 'TENANT_SUSPENDED',
        message: 'Workspace bị đình chỉ. Vui lòng liên hệ quản trị hệ thống.',
      });
    }

    const { data, error } = await this.supabase.db
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, name, status')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** GET tenant statistics: revenue, orders, rating */
  async getStats(tenantId: string) {
    // ── 1. Orders: count by status ───────────────────────────────────────────
    const { data: orders, error: ordersErr } = await this.supabase.db
      .from('service_requests')
      .select('status, agreed_price, collected_amount')
      .eq('tenant_id', tenantId);

    if (ordersErr) throw new BadRequestException(ordersErr.message);
    const rows = orders ?? [];

    const total       = rows.length;
    const completed   = rows.filter(r => r.status === 'completed' || r.status === 'completed_late').length;
    const in_progress = rows.filter(r => r.status === 'in_progress' || r.status === 'assigned').length;
    const cancelled   = rows.filter(r => r.status === 'cancelled').length;
    const pending     = rows.filter(r =>
      r.status === 'available' || r.status === 'pending_assignment' || r.status === 'unavailable',
    ).length;

    // ── 2. Revenue: sum collected_amount (fallback agreed_price) for completed ─
    const revenue = rows
      .filter(r => r.status === 'completed' || r.status === 'completed_late')
      .reduce((sum, r) => {
        const amount = r.collected_amount ?? r.agreed_price ?? 0;
        return sum + Number(amount);
      }, 0);

    // ── 3. Rating: avg & count via service_requests.tenant_id ────────────────
    const { data: ratingRows, error: ratingErr } = await this.supabase.db
      .from('ratings')
      .select('score, service_requests!inner(tenant_id)')
      .eq('service_requests.tenant_id', tenantId);

    if (ratingErr) throw new BadRequestException(ratingErr.message);
    const scores = (ratingRows ?? []).map((r: any) => r.score);
    const rating_count = scores.length;
    const rating_avg   = rating_count > 0
      ? Math.round((scores.reduce((s: number, v: number) => s + v, 0) / rating_count) * 10) / 10
      : null;

    // ── 4. Distribution: score breakdown ────────────────────────────────────
    const score_distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of scores) score_distribution[s] = (score_distribution[s] ?? 0) + 1;

    return {
      orders: { total, completed, in_progress, cancelled, pending },
      revenue: { total: revenue, currency: 'VND' },
      rating: { avg: rating_avg, count: rating_count, distribution: score_distribution },
    };
  }

  /** GET selected service categories of tenant (BO + OT) */
  async getServiceCategories(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('tenant_service_categories')
      .select('category_id, service_categories!inner(id, name, slug, description, icon_url, sort_order)')
      .eq('tenant_id', tenantId)
      .order('service_categories(sort_order)', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row: any) => row.service_categories);
  }

  /** PUT — replace all selected categories (BO only).
   *  Pass an empty array to clear all. */
  async setServiceCategories(tenantId: string, categoryIds: string[]) {
    // Delete existing
    const { error: delError } = await this.supabase.db
      .from('tenant_service_categories')
      .delete()
      .eq('tenant_id', tenantId);

    if (delError) throw new BadRequestException(delError.message);

    if (categoryIds.length === 0) return [];

    const rows = categoryIds.map((category_id) => ({ tenant_id: tenantId, category_id }));
    const { error: insError } = await this.supabase.db
      .from('tenant_service_categories')
      .insert(rows);

    if (insError) throw new BadRequestException(insError.message);

    return this.getServiceCategories(tenantId);
  }

  async updateLogo(tenantId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${tenantId}/logo.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('workspace-logos')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from('workspace-logos')
      .getPublicUrl(path);

    const { data, error } = await this.supabase.db
      .from('tenants')
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, logo_url')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** GET /workspace/payment-info — Lấy thông tin QR thanh toán */
  async getPaymentInfo(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('tenants')
      .select('id, qr_payment_url, bank_name, bank_account, bank_account_name')
      .eq('id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Workspace not found');
    return data;
  }

  /** PATCH /workspace/payment-info — BO: cập nhật thông tin ngân hàng */
  async updatePaymentInfo(tenantId: string, dto: {
    bank_name?: string;
    bank_account?: string;
    bank_account_name?: string;
    commission_platform_percent?: number;
    commission_staff_percent?: number;
  }) {
    const { data, error } = await this.supabase.db
      .from('tenants')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, bank_name, bank_account, bank_account_name, commission_platform_percent, commission_staff_percent')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** POST /workspace/payment-qr — BO: upload ảnh QR ngân hàng */
  async uploadPaymentQr(tenantId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${tenantId}/qr.${ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('payment-qr')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) throw new BadRequestException(uploadError.message);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from('payment-qr')
      .getPublicUrl(path);

    const { data, error } = await this.supabase.db
      .from('tenants')
      .update({ qr_payment_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, qr_payment_url')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  /** Public: lấy payment info công khai (cho customer + staff) */
  async getPublicPaymentInfo(tenantId: string) {
    const { data, error } = await this.supabase.db
      .from('tenants')
      .select('id, name, qr_payment_url, bank_name, bank_account, bank_account_name')
      .eq('id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Workspace not found');
    return data;
  }
}
