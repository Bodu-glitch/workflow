import { Module } from '@nestjs/common';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';

@Module({
  imports: [NotificationsModule, GatewayModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
