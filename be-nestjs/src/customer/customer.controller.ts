import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerService } from './customer.service.js';
import { UpdateCustomerProfileDto } from './dto/update-profile.dto.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /** Public: tìm kiếm workspace */
  @Get('workspaces/search')
  searchWorkspaces(
    @Query('q') q?: string,
    @Query('category_id') category_id?: string,
    @Query('min_rating') min_rating?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerService.searchWorkspaces({
      q,
      category_id,
      min_rating: min_rating ? parseFloat(min_rating) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /** Public: chi tiết workspace */
  @Get('workspaces/:id')
  getWorkspaceDetail(@Param('id') id: string) {
    return this.customerService.getWorkspaceDetail(id);
  }

  /** Public: lấy voucher public của tenant (để customer chọn khi đặt dịch vụ) */
  @Get('tenants/:tenantId/vouchers')
  getPublicVouchers(@Param('tenantId') tenantId: string) {
    return this.customerService.getPublicVouchers(tenantId);
  }

  /** GET /customer/profile */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: CurrentUserType) {
    return this.customerService.getProfile(user.id);
  }

  /** PATCH /customer/profile */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: CurrentUserType, @Body() dto: UpdateCustomerProfileDto) {
    return this.customerService.updateProfile(user.id, dto);
  }

  /** POST /customer/avatar */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  updateAvatar(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.customerService.updateAvatar(user.id, file);
  }

  /** GET /customer/addresses */
  @Get('addresses')
  @UseGuards(JwtAuthGuard)
  listAddresses(@CurrentUser() user: CurrentUserType) {
    return this.customerService.listAddresses(user.id);
  }

  /** POST /customer/addresses */
  @Post('addresses')
  @UseGuards(JwtAuthGuard)
  createAddress(@CurrentUser() user: CurrentUserType, @Body() dto: CreateAddressDto) {
    return this.customerService.createAddress(user.id, dto);
  }

  /** PATCH /customer/addresses/:id */
  @Patch('addresses/:id')
  @UseGuards(JwtAuthGuard)
  updateAddress(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body() dto: Partial<CreateAddressDto>,
  ) {
    return this.customerService.updateAddress(id, user.id, dto);
  }

  /** DELETE /customer/addresses/:id */
  @Delete('addresses/:id')
  @UseGuards(JwtAuthGuard)
  deleteAddress(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.customerService.deleteAddress(id, user.id);
  }
}
