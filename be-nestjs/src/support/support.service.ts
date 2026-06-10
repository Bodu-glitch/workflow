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
    const { data: task } = await this.supabase.db
      .from('tasks')
      .select('id, title, status, location_name')
      .eq('id', dto.task_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task not found' });

    const { data: assignment } = await this.supabase.db
      .from('task_assignments')
      .select('id')
      .eq('task_id', dto.task_id)
      .eq('user_id', user.id)
      .single();

    if (!assignment) throw new ForbiddenException({ code: 'NOT_ASSIGNEE', message: 'You are not assigned to this task' });

    const { data: ticket, error: ticketError } = await this.supabase.db
      .from('support_tickets')
      .insert({
        tenant_id: user.tenant_id,
        task_id: dto.task_id,
        created_by: user.id,
        status: 'open',
      })
      .select()
      .single();

    if (ticketError) throw new BadRequestException(ticketError.message);

    const { data: chatMsg, error: msgError } = await this.supabase.db
      .from('chat_messages')
      .insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        type: 'task_card',
        task_id: dto.task_id,
        ticket_id: ticket.id,
        content: dto.description,
      })
      .select('id, user_id, content, type, task_id, ticket_id, created_at, tenant_id, users!chat_messages_user_id_fkey(full_name)')
      .single();

    if (msgError) throw new BadRequestException(msgError.message);
    if (chatMsg) this.gateway.emitStaffChatMessage(user.tenant_id, chatMsg);

    return { ticket, task };
  }

  async getMyTickets(user: CurrentUser) {
    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .select(`
        id, status, created_at, updated_at,
        tasks(id, title, status, location_name)
      `)
      .eq('tenant_id', user.tenant_id)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getTicketReplies(ticketId: string, user: CurrentUser) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('id, created_by')
      .eq('id', ticketId)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (!ticket) throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });

    if (user.role === 'staff' && ticket.created_by !== user.id) {
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
      .select('id, created_by, tenant_id, status, tasks(title)')
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

    const taskTitle = (ticket.tasks as any)?.title ?? 'task';
    void this.notifications.sendPushNotification({
      user_ids: [ticket.created_by],
      type: 'support_reply',
      title: 'Hỗ trợ của bạn đã được phản hồi',
      body: `Ticket cho "${taskTitle}" vừa được trả lời.`,
      tenant_id: user.tenant_id,
    });

    return message;
  }

  async updateTicketStatus(ticketId: string, status: string, user: CurrentUser) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('id')
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
      .select(`
        id, status, created_at, updated_at,
        tasks(id, title, status, location_name),
        users!support_tickets_created_by_fkey(id, full_name, avatar_url)
      `)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }
}
