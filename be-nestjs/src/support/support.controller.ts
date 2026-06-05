import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ReplyTicketDto } from './dto/reply-ticket.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private service: SupportService) {}

  /** POST /support/tickets — staff tạo ticket từ task */
  @Post('tickets')
  createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: any) {
    return this.service.createTicket(dto, user);
  }

  /** GET /support/tickets/mine — staff xem ticket của mình */
  @Get('tickets/mine')
  getMyTickets(@CurrentUser() user: any) {
    return this.service.getMyTickets(user);
  }

  /** GET /support/tickets — BO/OT xem tất cả ticket của tenant */
  @Get('tickets')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  listAllTickets(@CurrentUser() user: any) {
    return this.service.listAllTickets(user);
  }

  /** GET /support/tickets/:id/replies — xem replies của ticket */
  @Get('tickets/:id/replies')
  getTicketReplies(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getTicketReplies(id, user);
  }

  /** POST /support/tickets/:id/reply — BO/OT trả lời ticket */
  @Post('tickets/:id/reply')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  replyTicket(
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.service.replyTicket(id, dto, user);
  }

  /** PATCH /support/tickets/:id/status — BO/OT cập nhật status */
  @Patch('tickets/:id/status')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.service.updateTicketStatus(id, status, user);
  }
}
