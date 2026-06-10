import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
