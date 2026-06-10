import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { CreatePricingDto } from './dto/create-pricing.dto.js';
import { UpdatePricingDto } from './dto/update-pricing.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Controller('pricing')
export class PricingController {
  constructor(private readonly service: PricingService) {}

  @Get('tenant/:tenantId')
  getTenantPricing(
    @Param('tenantId') tenantId: string,
    @Query('category_id') categoryId?: string,
  ) {
    return this.service.getTenantPricing(tenantId, categoryId);
  }

  /** GET /pricing — BO/OT: lấy pricing của tenant mình */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  getMyPricing(
    @CurrentUser() user: CurrentUserType,
    @Query('category_id') categoryId?: string,
  ) {
    return this.service.getTenantPricing(user.tenant_id!, categoryId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  create(@Body() dto: CreatePricingDto, @CurrentUser() user: CurrentUserType) {
    return this.service.createPricing(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  update(@Param('id') id: string, @Body() dto: UpdatePricingDto, @CurrentUser() user: CurrentUserType) {
    return this.service.updatePricing(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.deletePricing(id, user);
  }
}
