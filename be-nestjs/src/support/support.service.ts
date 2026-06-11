import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ReplyTicketDto } from './dto/reply-ticket.dto.js';

type CurrentUser = { id: string; tenant_id: string; role: string };

@Injectable()
export class SupportService {
  constructor(
    private supabase: SupabaseService,
    private notifications: NotificationsService,
    private gateway: EventsGateway,
  ) {}

  async createTicket(dto: CreateTicketDto, user: CurrentUser) {
    const { data: ticket, error: ticketError } = await this.supabase.db
      .from('support_tickets')
      .insert({
        tenant_id: user.tenant_id,
        request_id: (dto as any).request_id ?? null,
        staff_id: user.id,
        subject: (dto as any).subject ?? 'Hỗ trợ',
        status: 'open',
      })
      .select()
      .single();

    if (ticketError) throw new BadRequestException(ticketError.message);
    return ticket;
  }

  async getMyTickets(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .select('id, subject, status, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getTicketReplies(ticketId: string, user: CurrentUser) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('id, staff_id')
      .eq('id', ticketId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!ticket) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });

    if (user.role === 'staff' && ticket.staff_id !== user.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied' });
    }

    const { data, error } = await this.supabase.db
      .from('chat_messages')
      .select('id, content, type, created_at, users!chat_messages_user_id_fkey(id, full_name, avatar_url)')
      .eq('ticket_id', ticketId)
      .eq('type', 'text')
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async replyTicket(ticketId: string, dto: ReplyTicketDto, user: CurrentUser) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('id, staff_id, tenant_id, status, subject')
      .eq('id', ticketId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!ticket) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });

    const { data: message, error: msgError } = await this.supabase.db
      .from('chat_messages')
      .insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        type: 'text',
        ticket_id: ticketId,
        content: dto.content,
      })
      .select('id, user_id, content, type, task_id, ticket_id, created_at, tenant_id, users!chat_messages_user_id_fkey(full_name)')
      .single();

    if (msgError) throw new BadRequestException(msgError.message);
    if (message) this.gateway.emitStaffChatMessage(user.tenant_id, message);

    if (ticket.status === 'open') {
      await this.supabase.db
        .from('support_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    }

    void this.notifications.sendPushNotification({
      user_ids: [ticket.staff_id],
      type: 'support_reply',
      title: 'Hỗ trợ của bạn đã được phản hồi',
      body: `Ticket "${ticket.subject ?? 'hỗ trợ'}" vừa được trả lời.`,
      tenant_id: user.tenant_id,
    });

    return message;
  }

  async updateTicketStatus(ticketId: string, status: string, user: CurrentUser) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('id, staff_id')
      .eq('id', ticketId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!ticket) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });

    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listAllTickets(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .select('id, subject, status, created_at, updated_at, staff:users!support_tickets_staff_id_fkey(id, full_name, avatar_url)')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async listPendingTickets(user: CurrentUser, pagination: { page: number; limit: number }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('support_tickets')
      .select('id, subject, status, created_at, updated_at, staff:users!support_tickets_staff_id_fkey(id, full_name, avatar_url)', { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count ?? 0, page, limit } };
  }
}
