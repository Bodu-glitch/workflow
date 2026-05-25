import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { InviteStaffDto } from './dto/invite-staff.dto.js';
import { AcceptInvitationGoogleDto } from './dto/accept-invitation-google.dto.js';
import { ApplyToWorkspaceDto } from './dto/apply-to-workspace.dto.js';
import { UpdateOnlineStatusDto } from './dto/update-online-status.dto.js';
import { LockStaffDto } from './dto/lock-staff.dto.js';
import { CreateViolationNoteDto } from './dto/create-violation-note.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /** Public — accept invitation via Google OAuth (for new users) */
  @Post('accept-invitation-google')
  acceptInvitationGoogle(@Body() dto: AcceptInvitationGoogleDto) {
    return this.staffService.acceptInvitationGoogle(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Post('invite')
  invite(
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.invite(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get()
  listStaff(
    @CurrentUser() user: { tenant_id: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.staffService.listStaff(user.tenant_id, pagination);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get('invitations')
  listInvitations(
    @CurrentUser() user: { tenant_id: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.staffService.listInvitations(user.tenant_id, pagination);
  }

  /** Must be before :id routes */
  @UseGuards(JwtAuthGuard)
  @Get('my-invitations')
  getMyInvitations(@CurrentUser() user: { id: string }) {
    return this.staffService.getMyInvitations(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Post('invite/:id/resend')
  resendInvitation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.resendInvitation(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('invitations/:id/accept')
  acceptInvitation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.staffService.acceptInvitation(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('invitations/:id/decline')
  declineInvitation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.staffService.declineInvitation(id, user);
  }

  /** Public — accept invitation via email token link */
  @Patch('accept-invitation/:token')
  acceptInvitationByToken(@Param('token') token: string) {
    return this.staffService.acceptInvitationByToken(token);
  }

  // ── Workspace Applications (all fixed-path routes must be before :id) ──────

  @UseGuards(JwtAuthGuard)
  @Get('search-workspaces')
  searchWorkspaces(
    @Query('q') q: string,
    @Query('industry') industry?: string,
    @Query('area') area?: string,
    @Query('benefits') benefits?: string,
  ) {
    return this.staffService.searchWorkspaces(q ?? '', { industry, area, benefits });
  }

  @UseGuards(JwtAuthGuard)
  @Post('apply')
  applyToWorkspace(
    @Body() dto: ApplyToWorkspaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.staffService.applyToWorkspace(user, dto);
  }

  /** Must be before :id routes */
  @UseGuards(JwtAuthGuard)
  @Get('my-applications')
  myApplications(@CurrentUser() user: { id: string }) {
    return this.staffService.myApplications(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get('applications')
  listApplications(
    @CurrentUser() user: { tenant_id: string },
    @Query() pagination: PaginationDto,
  ) {
    return this.staffService.listApplications(user.tenant_id, pagination);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Patch('applications/:id/approve')
  approveApplication(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.approveApplication(id, user.tenant_id, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Patch('applications/:id/reject')
  rejectApplication(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.rejectApplication(id, user.tenant_id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('applications/:id/withdraw')
  withdrawApplication(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.staffService.withdrawApplication(id, user);
  }

  /** PATCH /staff/me/online-status — staff/OT/BO update own presence */
  @UseGuards(JwtAuthGuard)
  @Patch('me/online-status')
  updateOnlineStatus(
    @Body() dto: UpdateOnlineStatusDto,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.updateOnlineStatus(user.id, user.tenant_id, dto.status);
  }

  /** PATCH /staff/:id/lock — BO only: deactivate a staff member */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner')
  @Patch(':id/lock')
  lockStaff(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string },
    @Body() dto: LockStaffDto,
  ) {
    return this.staffService.lockStaff(id, user.tenant_id, dto.reason);
  }

  /** PATCH /staff/:id/unlock — BO only: reactivate a staff member */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner')
  @Patch(':id/unlock')
  unlockStaff(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string },
  ) {
    return this.staffService.unlockStaff(id, user.tenant_id);
  }

  // ── Violation Notes (:id/violations must be before :id) ──────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Get(':id/violations')
  listViolations(
    @Param('id') staffId: string,
    @CurrentUser() user: { tenant_id: string },
  ) {
    return this.staffService.listViolationNotes(staffId, user.tenant_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Post(':id/violations')
  addViolation(
    @Param('id') staffId: string,
    @CurrentUser() user: { id: string; tenant_id: string },
    @Body() dto: CreateViolationNoteDto,
  ) {
    return this.staffService.addViolationNote(staffId, user.tenant_id, user.id, dto.content);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Delete(':id/violations/:noteId')
  deleteViolation(
    @Param('noteId') noteId: string,
    @CurrentUser() user: { tenant_id: string },
  ) {
    return this.staffService.deleteViolationNote(noteId, user.tenant_id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('business_owner', 'operator', 'superadmin')
  @Delete(':id')
  removeStaff(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string },
  ) {
    return this.staffService.removeStaff(id, user);
  }
}
