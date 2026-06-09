import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { EventsGateway } from '../gateway/events.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { SendSupportMessageDto } from './dto/send-message.dto.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class SupportService {
  constructor(
    private supabase: SupabaseService,
    private gateway: EventsGateway,
    private notifications: NotificationsService,
  ) {}

  /** Staff: danh sách tickets của mình */
  async listMyTickets(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('support_tickets')
      .select('*, request:request_id(id, description, status)', { count: 'exact' })
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  /** Staff: tạo ticket */
  async createTicket(user: CurrentUser, dto: CreateTicketDto) {
    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .insert({
        staff_id: user.id,
        tenant_id: user.tenant_id,
        request_id: dto.request_id ?? null,
        subject: dto.subject,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Notify BO/OT managers of the tenant
    if (user.tenant_id) {
      const { data: managers } = await this.supabase.db
        .from('user_tenants')
        .select('user_id')
        .eq('tenant_id', user.tenant_id)
        .in('role', ['business_owner', 'operator'])
        .eq('is_active', true);

      if (managers && managers.length > 0) {
        void this.notifications.sendPushNotification({
          user_ids: managers.map((m: any) => m.user_id),
          type: 'support_ticket_created',
          title: '🎫 Yêu cầu hỗ trợ mới',
          body: dto.subject,
          tenant_id: user.tenant_id,
        });
      }
    }

    return data;
  }

  /** Lấy messages của ticket */
  async getMessages(ticketId: string, user: CurrentUser, pagination: PaginationDto) {
    // Check access: staff_id = user hoặc BO/OT cùng tenant
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('staff_id, tenant_id')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new NotFoundException('Ticket không tồn tại');
    if (ticket.staff_id !== user.id && ticket.tenant_id !== user.tenant_id) {
      throw new ForbiddenException();
    }

    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    const { data, error } = await this.supabase.db
      .from('support_messages')
      .select('*, sender:sender_id(id, full_name, avatar_url, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  /** Gửi message */
  async sendMessage(ticketId: string, user: CurrentUser, dto: SendSupportMessageDto) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('staff_id, tenant_id, status')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new NotFoundException('Ticket không tồn tại');
    if (ticket.status === 'closed') {
      throw new BadRequestException({ code: 'TICKET_CLOSED', message: 'Ticket đã đóng' });
    }
    if (ticket.staff_id !== user.id && ticket.tenant_id !== user.tenant_id) {
      throw new ForbiddenException();
    }

    const isOperator = ['business_owner', 'operator'].includes(user.role);

    const { data, error } = await this.supabase.db
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        content: dto.content,
        is_operator: isOperator,
      })
      .select('*, sender:sender_id(id, full_name, avatar_url)')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Update ticket status nếu operator reply
    if (isOperator && ticket.status === 'open') {
      await this.supabase.db
        .from('support_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    }

    // Emit socket event to ticket room
    this.gateway.emitSupportMessage(ticketId, data);

    return data;
  }

  /** BO/OT: danh sách tickets pending của tenant */
  async listPendingTickets(user: CurrentUser, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('support_tickets')
      .select(`
        *,
        staff:staff_id(id, full_name, avatar_url, phone),
        request:request_id(id, description, status)
      `, { count: 'exact' })
      .eq('tenant_id', user.tenant_id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  /** BO/OT: cập nhật trạng thái ticket */
  async updateTicketStatus(ticketId: string, tenantId: string, status: string) {
    const { data: ticket } = await this.supabase.db
      .from('support_tickets')
      .select('tenant_id')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new NotFoundException('Ticket không tồn tại');
    if (ticket.tenant_id !== tenantId) throw new ForbiddenException();

    const { data, error } = await this.supabase.db
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
