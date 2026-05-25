import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { WorkScheduleService } from './work-schedule.service.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { AssignShiftDto } from './dto/assign-shift.dto.js';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('work-schedule')
@UseGuards(JwtAuthGuard)
export class WorkScheduleController {
  constructor(private readonly svc: WorkScheduleService) {}

  // ── Shifts ──────────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get('shifts')
  listShifts(@CurrentUser() user: { tenant_id: string }) {
    return this.svc.listShifts(user.tenant_id);
  }

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Post('shifts')
  createShift(
    @CurrentUser() user: { tenant_id: string },
    @Body() dto: CreateShiftDto,
  ) {
    return this.svc.createShift(user.tenant_id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Delete('shifts/:id')
  deleteShift(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string },
  ) {
    return this.svc.deleteShift(id, user.tenant_id);
  }

  // ── Shift Assignments ────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get('assignments')
  getAssignments(
    @CurrentUser() user: { tenant_id: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getAssignments(user.tenant_id, from, to);
  }

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Post('assignments')
  createAssignment(
    @CurrentUser() user: { id: string; tenant_id: string },
    @Body() dto: AssignShiftDto,
  ) {
    return this.svc.createAssignment(user.tenant_id, user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Delete('assignments/:id')
  deleteAssignment(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string },
  ) {
    return this.svc.deleteAssignment(id, user.tenant_id);
  }

  // ── Leave Requests (BO/OT) ────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get('leave-requests')
  listLeaveRequests(
    @CurrentUser() user: { tenant_id: string },
    @Query('status') status?: string,
  ) {
    return this.svc.listLeaveRequests(user.tenant_id, status);
  }

  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Patch('leave-requests/:id/review')
  reviewLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string },
    @Body() dto: ReviewLeaveRequestDto,
  ) {
    return this.svc.reviewLeaveRequest(id, user.tenant_id, user.id, dto);
  }

  // ── Me (staff — authenticated, any role) ─────────────────────────────────

  @Get('me/assignments')
  myAssignments(
    @CurrentUser() user: { id: string; tenant_id: string },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.myAssignments(user.id, user.tenant_id, from, to);
  }

  @Get('me/leave-requests')
  myLeaveRequests(@CurrentUser() user: { id: string; tenant_id: string }) {
    return this.svc.myLeaveRequests(user.id, user.tenant_id);
  }

  @Post('me/leave-requests')
  createLeaveRequest(
    @CurrentUser() user: { id: string; tenant_id: string },
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.svc.createLeaveRequest(user.id, user.tenant_id, dto);
  }
}
