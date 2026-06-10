import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [forwardRef(() => ChatModule)],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
