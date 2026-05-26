import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  tenant_id: string;
  role: string;
}

@Controller('tenant')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('services')
  listServices(@CurrentUser() user: CurrentUserType) {
    return this.tenantService.listServices(user);
  }

  @Post('services')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  createService(@Body() dto: CreateServiceDto, @CurrentUser() user: CurrentUserType) {
    return this.tenantService.createService(user, dto.name);
  }

  @Delete('services/:id')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  deleteService(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.tenantService.deleteService(user, id);
  }
}