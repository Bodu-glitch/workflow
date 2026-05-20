import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface PushPayload {
  user_ids: string[];
  type: string;
  title: string;
  body: string;
  task_id?: string;
  request_id?: string;
  tenant_id?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private supabase: SupabaseService,
    private config: ConfigService,
  ) {}

  async sendPushNotification(payload: PushPayload): Promise<void> {
    // Insert directly into notifications table — guarantees in-app delivery
    const records = payload.user_ids.map((userId) => ({
      tenant_id: payload.tenant_id ?? null,
      user_id: userId,
      task_id: payload.task_id ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body,
    }));

    if (records.length > 0) {
      const { error } = await this.supabase.db.from('notifications').insert(records);
      if (error) {
        console.error('[Notifications] DB insert failed:', error.message);
      }
    }

    // Also call Edge Function for Expo push notifications (best-effort)
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-critical: edge function handles Expo push only
    }
  }

  async listNotifications(userId: string, tenantId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data, meta: { total: count, page, limit } };
  }

  async markRead(id: string, userId: string) {
    const { error } = await this.supabase.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Notification marked as read' };
  }

  async markAllRead(userId: string, tenantId: string) {
    await this.supabase.db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string, tenantId: string) {
    const { count } = await this.supabase.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    return { count: count ?? 0 };
  }
}
