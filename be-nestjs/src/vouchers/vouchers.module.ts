import { Module } from '@nestjs/common';
import { VouchersController } from './vouchers.controller.js';
import { VouchersPublicController } from './vouchers-public.controller.js';
import { VouchersService } from './vouchers.service.js';

@Module({
  controllers: [VouchersController, VouchersPublicController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
