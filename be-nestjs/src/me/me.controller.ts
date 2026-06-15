import {
  Controller, Get, Patch, Post, Put, Delete,
  Query, Body, Param, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeService } from './me.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  tenant_id: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: CurrentUserType) {
    return this.meService.getProfile(user.id, user.tenant_id);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() body: { full_name?: string; phone?: string; cccd?: string },
  ) {
    return this.meService.updateProfile(user.id, body);
  }

  @Post('certificates')
  @UseInterceptors(FileInterceptor('file'))
  uploadCertificate(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
  ) {
    return this.meService.uploadCertificate(user.id, file, name ?? file.originalname);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  updateAvatar(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meService.updateAvatar(user.id, file);
  }

  @Post('leave-workspace')
  leaveWorkspace(
    @CurrentUser() user: CurrentUserType,
    @Body('reason') reason?: string,
  ) {
    return this.meService.leaveWorkspace(user.id, user.tenant_id, reason);
  }

  @Delete('certificates/:id')
  deleteCertificate(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ) {
    return this.meService.deleteCertificate(user.id, id);
  }

  @Get('workspace/services')
  getWorkspaceServices(@CurrentUser() user: CurrentUserType) {
    return this.meService.getWorkspaceServices(user.tenant_id);
  }

  @Get('workspace/payment')
  getPaymentInfo(@CurrentUser() user: CurrentUserType) {
    return this.meService.getPaymentInfo(user.tenant_id);
  }

  /** GET /me/tasks/pool — pool requests available to self-assign. MUST be before /me/tasks */
  @Get('tasks/pool')
  getPoolRequests(
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
  ) {
    return this.meService.getPoolRequests(user, pagination);
  }

  /** GET /me/tasks/history — MUST be before /me/tasks */
  @Get('tasks/history')
  getMyRequestHistory(
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
  ) {
    return this.meService.getMyRequestHistory(user, pagination);
  }

  @Post('tasks/:id/start')
  startMoving(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.meService.startMoving(id, user);
  }

  @Post('tasks/:id/arrive')
  markArrived(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.meService.markArrived(id, user);
  }

  @Post('tasks/:id/begin')
  beginWork(
    @Param('id') id: string,
    @Body('gps_lat') gpsLat: number,
    @Body('gps_lng') gpsLng: number,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.meService.beginWork(id, user, Number(gpsLat), Number(gpsLng));
  }

  /** POST /me/tasks/:id/claim — Staff self-assigns from pool. MUST be before /me/tasks */
  @Post('tasks/:id/claim')
  claimPoolRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.meService.claimPoolRequest(id, user);
  }

  @Post('tasks/:id/reject')
  rejectRequest(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.meService.rejectRequest(id, reason, user);
  }

  @Get('tasks/:id/items')
  getRequestItems(@Param('id') id: string) {
    return this.meService.getRequestItems(id);
  }

  @Put('tasks/:id/items')
  saveRequestItems(
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    return this.meService.saveRequestItems(id, body.items);
  }

  @Get('tasks')
  getMyRequests(
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.meService.getMyRequests(user, pagination, status);
  }
}

/** Separate controller for BO/OT to view staff profiles */
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('business_owner', 'operator')
export class StaffProfileController {
  constructor(private readonly meService: MeService) {}

  @Get(':id/profile')
  getStaffProfile(@Param('id') id: string) {
    return this.meService.getStaffProfile(id);
  }
}
