import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { ValidateVoucherDto } from './dto/validate-voucher.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string;
}

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  /** GET /vouchers — BO/OT: danh sách vouchers */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  listVouchers(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.vouchersService.listVouchers(user.tenant_id, pagination);
  }

  /** GET /vouchers/:id/stats — BO/OT: thống kê voucher */
  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  getVoucherStats(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.vouchersService.getVoucherStats(id, user.tenant_id);
  }

  /** POST /vouchers — BO/OT: tạo voucher */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  createVoucher(@CurrentUser() user: CurrentUserType, @Body() dto: CreateVoucherDto) {
    return this.vouchersService.createVoucher(user.tenant_id, dto, user.id);
  }

  /** POST /vouchers/validate — public: kiểm tra voucher hợp lệ */
  @Post('validate')
  validateVoucher(@Body() dto: ValidateVoucherDto) {
    return this.vouchersService.validateVoucher(dto);
  }

  /** POST /vouchers/apply/:requestId — customer: áp dụng voucher vào đơn */
  @Post('apply/:requestId')
  @UseGuards(JwtAuthGuard)
  applyVoucher(
    @Param('requestId') requestId: string,
    @Body() body: { code: string; tenant_id: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.vouchersService.applyVoucher(requestId, body.code, body.tenant_id, user.id);
  }

  /** PATCH /vouchers/:id — BO/OT: cập nhật voucher */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  updateVoucher(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchersService.updateVoucher(id, dto, user.tenant_id);
  }

  /** DELETE /vouchers/:id — BO/OT: vô hiệu hóa voucher */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  deleteVoucher(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.vouchersService.deleteVoucher(id, user.tenant_id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.getStats(id, user);
  }

  @Post(':id/notify')
  notifyCustomers(
    @Param('id') id: string,
    @Body() body: { message?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.notifyCustomers(id, body.message, user);
  }
}
