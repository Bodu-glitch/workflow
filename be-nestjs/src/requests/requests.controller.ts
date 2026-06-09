import {
  Controller, Get, Post, Patch, Body, Param, Query, Res,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { MatchCategoriesDto } from './dto/match-categories.dto.js';
import { SelectTenantDto } from './dto/select-tenant.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { ConfirmPriceDto } from './dto/confirm-price.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  /** GET /requests/pool — operator pool view (Pool 1 + their active requests). MUST be before /:id */
  @Get('pool')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  getPool(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.service.getPool(user, pagination);
  }

  /** GET /requests/dashboard — MUST be before /:id */
  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  getDashboard(@CurrentUser() user: CurrentUserType) {
    return this.service.getDashboard(user);
  }

  @Get()
  listRequests(
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.listRequests(user, pagination, { status });
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 5, { storage: memoryStorage() }))
  createRequest(
    @Body() dto: CreateRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.createRequest(dto, files ?? [], user);
  }

  @Post('match-categories')
  matchCategories(@Body() dto: MatchCategoriesDto) {
    return this.service.matchCategories(dto.description);
  }

  @Get(':id')
  getRequest(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.getRequest(id, user);
  }

  /** GET /requests/:id/matching-tenants — Customer sees matched tenants + pricing. MUST be before other /:id/* routes */
  @Get(':id/matching-tenants')
  @UseGuards(RolesGuard)
  @Roles('customer', 'superadmin')
  getMatchingTenants(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.getMatchingTenants(id, user);
  }

  @Get(':id/candidates')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  getCandidates(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.getCandidates(id, user);
  }

  @Patch(':id/cancel')
  cancelRequest(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.cancelRequest(id, dto, user);
  }

  /** Customer selects 1 tenant → status: available → negotiating */
  @Patch(':id/select-tenant')
  @UseGuards(RolesGuard)
  @Roles('customer')
  selectTenant(
    @Param('id') id: string,
    @Body() dto: SelectTenantDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.selectTenant(id, dto, user);
  }

  /** Customer releases back to Pool 1 → status: negotiating → available */
  @Patch(':id/release')
  @UseGuards(RolesGuard)
  @Roles('customer')
  releaseToPool(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.releaseToPool(id, user);
  }

  @Patch(':id/confirm-price')
  @UseGuards(RolesGuard)
  @Roles('customer')
  confirmPrice(
    @Param('id') id: string,
    @Body() dto: ConfirmPriceDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.confirmPrice(id, dto, user);
  }

  /** Operator pushes to Pool 2 (internal staff pool) → pending_assignment + is_in_staff_pool=true */
  @Patch(':id/push-to-staff-pool')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  pushToStaffPool(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.pushToStaffPool(id, user);
  }

  /** Operator directly assigns a specific staff member */
  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  assignStaff(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.assignStaff(id, dto, user);
  }

  /** GET /requests/:id/invoice — xuất hóa đơn PDF */
  @Get(':id/invoice')
  async getInvoice(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.generateInvoicePdf(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id.substring(0, 8)}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  /** POST /requests/:id/apply-voucher — customer áp dụng voucher */
  @Post(':id/apply-voucher')
  @UseGuards(RolesGuard)
  @Roles('customer')
  applyVoucher(
    @Param('id') id: string,
    @Body() dto: { voucher_id: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.applyVoucher(id, dto.voucher_id, user);
  }

  /** POST /requests/:id/rate — customer đánh giá (alias cho ratings module) */
  @Post(':id/rate')
  @UseGuards(RolesGuard)
  @Roles('customer')
  rateRequest(
    @Param('id') id: string,
    @Body() dto: { score: number; comment?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.rateRequest(id, dto, user);
  }
}
