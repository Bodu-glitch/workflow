import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const ALERT_WINDOW_MINUTES = 30;
const REMINDER_COOLDOWN_MINUTES = 60;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
  ) {}

  @Cron('*/5 * * * *')
  async checkScheduledReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ALERT_WINDOW_MINUTES * 60 * 1000);

    // Requests with scheduled_at in the next 30 min that haven't started yet
    const { data: requests, error } = await this.supabase.db
      .from('service_requests')
      .select('id, description, scheduled_at, tenant_id, assigned_staff_id, assigned_by')
      .eq('status', 'assigned')
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', windowEnd.toISOString());

    if (error) {
      this.logger.error('Failed to query upcoming requests', error.message);
      return;
    }
    if (!requests?.length) return;

    const reminderCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MINUTES * 60 * 1000).toISOString();

    for (const req of requests) {
      const { data: recent } = await this.supabase.db
        .from('notifications')
        .select('id')
        .eq('request_id', req.id)
        .eq('type', 'reminder')
        .gte('created_at', reminderCutoff)
        .limit(1);

      if (recent && recent.length > 0) continue;

      const recipientIds = [...new Set([req.assigned_staff_id, req.assigned_by].filter(Boolean) as string[])];
      if (!recipientIds.length) continue;

      const minutesLeft = Math.round((new Date(req.scheduled_at!).getTime() - now.getTime()) / 60_000);

      void this.notifications.sendPushNotification({
        user_ids: recipientIds,
        type: 'reminder',
        title: 'Nhắc lịch hẹn',
        body: `Yêu cầu dịch vụ lúc ${new Date(req.scheduled_at!).toLocaleTimeString('vi-VN')} — còn ${minutesLeft} phút`,
        request_id: req.id,
        tenant_id: req.tenant_id,
      });

      this.logger.log(`Reminder sent: request ${req.id} (${minutesLeft}min left)`);
    }
  }

  @Cron('*/5 * * * *')
  async checkOverdueRequests() {
    const now = new Date();

    const { data: requests, error } = await this.supabase.db
      .from('service_requests')
      .select('id, description, scheduled_at, tenant_id, assigned_staff_id, assigned_by')
      .in('status', ['assigned', 'moving', 'arrived', 'in_progress'])
      .not('scheduled_at', 'is', null)
      .lt('scheduled_at', now.toISOString());

    if (error) {
      this.logger.error('Failed to query overdue requests', error.message);
      return;
    }
    if (!requests?.length) return;

    for (const req of requests) {
      const { data: existing } = await this.supabase.db
        .from('notifications')
        .select('id')
        .eq('request_id', req.id)
        .eq('type', 'overdue')
        .limit(1);

      if (existing && existing.length > 0) continue;

      const recipientIds = [...new Set([req.assigned_staff_id, req.assigned_by].filter(Boolean) as string[])];
      if (!recipientIds.length) continue;

      void this.notifications.sendPushNotification({
        user_ids: recipientIds,
        type: 'overdue',
        title: 'Yêu cầu quá giờ hẹn',
        body: `Yêu cầu dịch vụ đã quá thời gian hẹn.`,
        request_id: req.id,
        tenant_id: req.tenant_id,
      });

      this.logger.log(`Overdue alert sent: request ${req.id}`);
    }
  }
}
