import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const ALERT_WINDOW_MINUTES = 30;
const COOLDOWN_MINUTES = 60;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
  ) {}

  @Cron('*/1 * * * *')
  async checkDeadlineAlerts() {
    const now = new Date();
    this.logger.log(`[CRON] Running deadline check at ${now.toISOString()}`);
    const windowEnd = new Date(now.getTime() + ALERT_WINDOW_MINUTES * 60 * 1000);

    // Tasks still in todo with deadline approaching within ALERT_WINDOW_MINUTES
    const { data: tasks, error } = await this.supabase.db
      .from('tasks')
      .select('id, title, deadline, tenant_id')
      .eq('status', 'todo')
      .not('deadline', 'is', null)
      .gte('deadline', now.toISOString())
      .lte('deadline', windowEnd.toISOString());

    if (error) {
      this.logger.error('Failed to query deadline tasks', error.message);
      return;
    }
    this.logger.log(`[CRON] Found ${tasks?.length ?? 0} tasks approaching deadline (window: now → +${ALERT_WINDOW_MINUTES}min)`);
    if (!tasks?.length) return;

    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

    for (const task of tasks) {
      // Skip if a reminder was already sent for this task within the cooldown window
      const { data: recent } = await this.supabase.db
        .from('notifications')
        .select('id')
        .eq('task_id', task.id)
        .eq('type', 'reminder')
        .gte('created_at', cooldownCutoff)
        .limit(1);

      if (recent && recent.length > 0) continue;

      // Get assigned staff + the OT/BO who assigned them
      const { data: assignments } = await this.supabase.db
        .from('task_assignments')
        .select('user_id, assigned_by')
        .eq('task_id', task.id);

      if (!assignments?.length) continue;

      const staffIds = assignments.map((a) => a.user_id);
      const assignerIds = assignments.map((a) => a.assigned_by).filter(Boolean);
      const recipientIds = [...new Set([...staffIds, ...assignerIds])];

      const minutesLeft = Math.round(
        (new Date(task.deadline).getTime() - now.getTime()) / 60_000,
      );

      void this.notifications.sendPushNotification({
        user_ids: recipientIds,
        type: 'reminder',
        title: 'Task Deadline Warning',
        body: `"${task.title}" deadline in ${minutesLeft} min — not started yet`,
        task_id: task.id,
        tenant_id: task.tenant_id,
      });

      this.logger.log(`Deadline alert sent: task ${task.id} (${minutesLeft}min left)`);
    }
  }

  @Cron('*/1 * * * *')
  async checkOverdueAlerts() {
    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MINUTES * 60 * 1000).toISOString();

    const { data: tasks, error } = await this.supabase.db
      .from('tasks')
      .select('id, title, deadline, tenant_id')
      .in('status', ['todo', 'in_progress'])
      .not('deadline', 'is', null)
      .lt('deadline', now.toISOString());

    if (error) {
      this.logger.error('Failed to query overdue tasks', error.message);
      return;
    }
    if (!tasks?.length) return;

    for (const task of tasks) {
      const { data: recent } = await this.supabase.db
        .from('notifications')
        .select('id')
        .eq('task_id', task.id)
        .eq('type', 'overdue')
        .gte('created_at', cooldownCutoff)
        .limit(1);

      if (recent && recent.length > 0) continue;

      const { data: assignments } = await this.supabase.db
        .from('task_assignments')
        .select('user_id, assigned_by')
        .eq('task_id', task.id);

      if (!assignments?.length) continue;

      const staffIds = assignments.map((a) => a.user_id);
      const assignerIds = assignments.map((a) => a.assigned_by).filter(Boolean);
      const recipientIds = [...new Set([...staffIds, ...assignerIds])];

      void this.notifications.sendPushNotification({
        user_ids: recipientIds,
        type: 'overdue',
        title: 'Task Overdue',
        body: `"${task.title}" is overdued`,
        task_id: task.id,
        tenant_id: task.tenant_id,
      });

      this.logger.log(`Overdue alert sent: task ${task.id} overdued at ${task.deadline}`);
    }
  }
}