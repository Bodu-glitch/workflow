import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { VouchersService } from './vouchers.service.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Controller('vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('business_owner', 'operator')
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserType) {
    return this.service.list(user);
  }

  @Post()
  create(@Body() dto: CreateVoucherDto, @CurrentUser() user: CurrentUserType) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto, @CurrentUser() user: CurrentUserType) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.remove(id, user);
  }
}
