import {
  Controller, Get, Patch, Post, Put,
  Body, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceService } from './workspace.service.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { SetServiceCategoriesDto } from './dto/set-service-categories.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

interface CurrentUserType {
  id: string;
  tenant_id: string;
  role: string;
}

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /** GET /workspace/profile — BO + OT: read workspace info */
  @Get('profile')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  getProfile(@CurrentUser() user: CurrentUserType) {
    return this.workspaceService.getProfile(user.tenant_id);
  }

  /** PATCH /workspace/profile — BO only: edit name, description, industry, operating_area */
  @Patch('profile')
  @UseGuards(RolesGuard)
  @Roles('business_owner')
  updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateProfile(user.tenant_id, dto);
  }

  /** PATCH /workspace/status — BO only: đổi trạng thái workspace (active/inactive/pending)
   *  'suspended' không được phép — admin-only */
  @Patch('status')
  @UseGuards(RolesGuard)
  @Roles('business_owner')
  updateStatus(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.workspaceService.updateStatus(user.tenant_id, dto.status);
  }

  /** GET /workspace/stats — BO + OT: thống kê doanh thu, đơn hàng, đánh giá */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  getStats(@CurrentUser() user: CurrentUserType) {
    return this.workspaceService.getStats(user.tenant_id);
  }

  /** GET /workspace/service-categories — BO + OT: xem dịch vụ tenant đã đăng ký */
  @Get('service-categories')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  getServiceCategories(@CurrentUser() user: CurrentUserType) {
    return this.workspaceService.getServiceCategories(user.tenant_id);
  }

  /** PUT /workspace/service-categories — BO only: cập nhật toàn bộ danh sách dịch vụ */
  @Put('service-categories')
  @UseGuards(RolesGuard)
  @Roles('business_owner')
  setServiceCategories(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: SetServiceCategoriesDto,
  ) {
    return this.workspaceService.setServiceCategories(user.tenant_id, dto.category_ids);
  }

  /** POST /workspace/logo — BO only: upload workspace logo */
  @Post('logo')
  @UseGuards(RolesGuard)
  @Roles('business_owner')
  @UseInterceptors(FileInterceptor('file'))
  updateLogo(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.workspaceService.updateLogo(user.tenant_id, file);
  }
}
