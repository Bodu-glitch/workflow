import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  providers: [AlertsService],
})
export class AlertsModule {}
