import { Controller, Post, Body } from '@nestjs/common';
import { VouchersService } from './vouchers.service.js';

@Controller('vouchers/public')
export class VouchersPublicController {
  constructor(private readonly service: VouchersService) {}

  @Post('validate')
  validate(@Body() body: { code: string; tenant_id: string; order_amount?: number }) {
    return this.service.validate(body.code, body.tenant_id, body.order_amount ?? 0);
  }
}
