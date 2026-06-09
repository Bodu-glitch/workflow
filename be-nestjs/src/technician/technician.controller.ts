import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TechnicianService } from './technician.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { CompleteJobDto } from './dto/complete-job.dto.js';
import { RequoteJobDto } from './dto/requote-job.dto.js';
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

@Controller('technician')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('staff')
export class TechnicianController {
  constructor(private readonly service: TechnicianService) {}

  @Get('jobs')
  listJobs(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.service.listJobs(user, pagination);
  }

  /** GET /technician/jobs/history — completed/cancelled jobs. MUST be before /jobs/:id */
  @Get('jobs/history')
  listHistory(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.service.listHistory(user, pagination);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.getJob(id, user);
  }

  @Post('jobs/:id/accept')
  acceptJob(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.acceptJob(id, user);
  }

  @Post('jobs/:id/decline')
  declineJob(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.declineJob(id, user);
  }

  @Patch('jobs/:id/start')
  startJob(
    @Param('id') id: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.startJob(id, Number(lat), Number(lng), user);
  }

  @Patch('jobs/:id/complete')
  @UseInterceptors(FilesInterceptor('photos', 5, { storage: memoryStorage() }))
  completeJob(
    @Param('id') id: string,
    @Body() dto: CompleteJobDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.completeJob(id, dto, files ?? [], user);
  }

  @Patch('jobs/:id/requote')
  requoteJob(
    @Param('id') id: string,
    @Body() dto: RequoteJobDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.requoteJob(id, dto, user);
  }

  /** GET /technician/pool — Pool 2: jobs in this tenant's internal staff pool. MUST be before /jobs/:id */
  @Get('pool')
  listPool(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.service.listPool(user, pagination);
  }

  /** POST /technician/pool/:id/claim — Staff self-assigns from Pool 2 */
  @Post('pool/:id/claim')
  claimFromPool(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.service.claimFromPool(id, user);
  }

  @Patch('status')
  toggleStatus(
    @Body('is_online') isOnline: boolean,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.toggleStatus(user, Boolean(isOnline));
  }

  @Post('location')
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: CurrentUserType) {
    return this.service.updateLocation(dto, user);
  }

  /** GET /technician/earnings?period=day|week|month — Thu nhập nhân viên */
  @Get('earnings')
  getEarnings(
    @CurrentUser() user: CurrentUserType,
    @Query('period') period: 'day' | 'week' | 'month',
  ) {
    return this.service.getEarnings(user, period ?? 'month');
  }

  /** PATCH /technician/jobs/:id/checklist — cập nhật checklist dịch vụ */
  @Patch('jobs/:id/checklist')
  updateChecklist(
    @Param('id') id: string,
    @Body('checklist') checklist: any[],
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.updateChecklist(id, checklist, user);
  }
}
