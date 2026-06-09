import { Module } from '@nestjs/common';
import { WorkScheduleController } from './work-schedule.controller.js';
import { WorkScheduleService } from './work-schedule.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { GatewayModule } from '../gateway/gateway.module.js';

@Module({
  imports: [SupabaseModule, GatewayModule],
  controllers: [WorkScheduleController],
  providers: [WorkScheduleService],
})
export class WorkScheduleModule {}
