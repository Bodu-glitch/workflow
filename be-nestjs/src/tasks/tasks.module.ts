import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { ReportService } from './report.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';

@Module({
  imports: [AuthModule, NotificationsModule, GatewayModule],
  controllers: [TasksController],
  providers: [TasksService, ReportService],
})
export class TasksModule {}
