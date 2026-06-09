import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [AuthModule, GatewayModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
