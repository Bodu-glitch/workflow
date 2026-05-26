import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TasksService } from './tasks.service.js';
import { ReportService } from './report.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { AssignTaskDto } from './dto/assign-task.dto.js';
import { CancelTaskDto } from './dto/cancel-task.dto.js';
import { RejectTaskDto } from './dto/reject-task.dto.js';
import { CheckinDto } from './dto/checkin.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  tenant_id: string;
  role: string;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly reportService: ReportService,
  ) {}

  /** GET /tasks/dashboard — MUST be before /:id */
  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  getDashboard(
    @CurrentUser() user: CurrentUserType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tasksService.getDashboard(user, from, to);
  }

  /** GET /tasks/filter-options — MUST be before /:id */
  @Get('filter-options')
  getFilterOptions(@CurrentUser() user: CurrentUserType) {
    return this.tasksService.getFilterOptions(user);
  }

  /** GET /tasks/report — MUST be before /:id */
  @Get('report')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  async getReport(
    @CurrentUser() user: CurrentUserType,
    @Query('period') period: string,
    @Query('date') date: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const p = period === 'year' ? 'year' : 'month';
    const fmt = format === 'pdf' ? 'pdf' : 'excel';
    const reportData = await this.reportService.getReportData(user, p, date);

    if (fmt === 'excel') {
      const buffer = await this.reportService.generateExcel(reportData);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report-${date}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } else {
      const buffer = await this.reportService.generatePDF(reportData);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${date}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    }
  }

  /** GET /tasks/chart — MUST be before /:id */
  @Get('chart')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  getChart(
    @CurrentUser() user: CurrentUserType,
    @Query('period') period?: string,
  ) {
    const p = (period === 'month' || period === 'year') ? period : 'week';
    return this.tasksService.getChart(user, p);
  }

  @Get()
  listTasks(
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('area') area?: string,
    @Query('service_type') service_type?: string,
    @Query('assignee_id') assignee_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('overdue') overdue?: string,
  ) {
    return this.tasksService.listTasks(user, pagination, { status, priority, area, service_type, assignee_id, from, to, search, overdue: overdue === 'true' });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: CurrentUserType) {
    return this.tasksService.createTask(dto, user);
  }

  @Get(':id')
  getTask(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.tasksService.getTask(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.updateTask(id, dto, user);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  assignTask(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.assignTask(id, dto, user);
  }

  @Delete(':id/assign/:staffId')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  unassignTask(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.unassignTask(id, staffId, user);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  cancelTask(
    @Param('id') id: string,
    @Body() dto: CancelTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.cancelTask(id, dto, user);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  rejectTask(
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.rejectTask(id, dto.reason, user);
  }

  @Post(':id/checkin')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  checkin(
    @Param('id') id: string,
    @Body() dto: CheckinDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.checkin(id, dto, file, user, 'checkin');
  }

  @Post(':id/checkout')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  checkout(
    @Param('id') id: string,
    @Body() dto: CheckinDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.tasksService.checkin(id, dto, file, user, 'checkout');
  }
}
