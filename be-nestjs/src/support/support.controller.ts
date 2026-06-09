import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { SendSupportMessageDto } from './dto/send-message.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUserType {
  id: string;
  role: string;
  tenant_id: string;
}

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /** GET /support/tickets/pending — BO/OT: danh sách tickets cần xử lý */
  @Get('tickets/pending')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  listPendingTickets(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.supportService.listPendingTickets(user, pagination);
  }

  /** GET /support/tickets — Staff: tickets của mình */
  @Get('tickets')
  listMyTickets(@CurrentUser() user: CurrentUserType, @Query() pagination: PaginationDto) {
    return this.supportService.listMyTickets(user, pagination);
  }

  /** POST /support/tickets — Staff: tạo ticket */
  @Post('tickets')
  createTicket(@CurrentUser() user: CurrentUserType, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(user, dto);
  }

  /** GET /support/tickets/:id/messages */
  @Get('tickets/:id/messages')
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Query() pagination: PaginationDto,
  ) {
    return this.supportService.getMessages(id, user, pagination);
  }

  /** POST /support/tickets/:id/messages */
  @Post('tickets/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendMessage(id, user, dto);
  }

  /** PATCH /support/tickets/:id/status — BO/OT: đổi trạng thái */
  @Patch('tickets/:id/status')
  @UseGuards(RolesGuard)
  @Roles('business_owner', 'operator')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
    @Body('status') status: string,
  ) {
    return this.supportService.updateTicketStatus(id, user.tenant_id, status);
  }
}
