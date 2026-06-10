import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    private supabase: SupabaseService,
    @Inject(forwardRef(() => NotificationsService)) private notifications: NotificationsService,
  ) {}

  async getHistory(
    requestId: string,
    channel: 'customer_operator' | 'customer_staff',
    user: CurrentUser,
    pagination: PaginationDto,
  ) {
    await this.verifyAccess(requestId, channel, user);

    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    const { data, count, error } = await this.supabase.db
      .from('request_chats')
      .select('*, sender:user_id(id, full_name, avatar_url)', { count: 'exact' })
      .eq('request_id', requestId)
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { data: data ?? [], meta: { total: count, page, limit } };
  }

  async sendMessage(
    requestId: string,
    channel: 'customer_operator' | 'customer_staff',
    content: string | undefined,
    mediaUrls: string[] | undefined,
    user: CurrentUser,
  ) {
    await this.verifyAccess(requestId, channel, user);

    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      throw new BadRequestException({ code: 'EMPTY_MESSAGE', message: 'Message must have content or media' });
    }

    const { data, error } = await this.supabase.db
      .from('request_chats')
      .insert({
        request_id: requestId,
        user_id: user.id,
        channel,
        content: content ?? null,
        media_urls: mediaUrls ?? [],
      })
      .select('*, sender:user_id(id, full_name, avatar_url)')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Notify the other party when a message is sent on customer_operator channel
    if (channel === 'customer_operator') {
      void this.notifyNewChatMessage(requestId, user, content ?? '📎 Tệp đính kèm');
    }

    return data;
  }

  private async notifyNewChatMessage(requestId: string, sender: CurrentUser, preview: string) {
    // Fetch request info to determine tenant and involved parties
    const { data: request } = await this.supabase.db
      .from('service_requests')
      .select('customer_id, tenant_id, category:category_id(name)')
      .eq('id', requestId)
      .single();

    if (!request) return;

    const senderIsCustomer = sender.role === 'customer' || sender.tenant_id === null;

    if (senderIsCustomer && request.tenant_id) {
      // Customer sent message → notify BO/OT managers
      const { data: managers } = await this.supabase.db
        .from('user_tenants')
        .select('user_id')
        .eq('tenant_id', request.tenant_id)
        .in('role', ['business_owner', 'operator'])
        .eq('is_active', true);

      if (managers && managers.length > 0) {
        const categoryName = (request.category as any)?.name ?? 'Dịch vụ';
        void this.notifications.sendPushNotification({
          user_ids: managers.map((m: any) => m.user_id),
          type: 'new_chat_message',
          title: `💬 Tin nhắn mới — ${categoryName}`,
          body: preview.length > 80 ? preview.substring(0, 80) + '…' : preview,
          request_id: requestId,
          tenant_id: request.tenant_id,
        });
      }
    }
  }

  private async verifyAccess(
    requestId: string,
    channel: 'customer_operator' | 'customer_staff',
    user: CurrentUser,
  ) {
    const { data: request } = await this.supabase.db
      .from('service_requests')
      .select('customer_id, assigned_staff_id, tenant_id')
      .eq('id', requestId)
      .single();

    if (!request) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' });

    const isCustomer = request.customer_id === user.id;
    const isStaff = request.assigned_staff_id === user.id;
    const isOperator = ['business_owner', 'operator'].includes(user.role) && request.tenant_id === user.tenant_id;
    const isSuperadmin = user.role === 'superadmin';

    if (isSuperadmin) return;

    if (channel === 'customer_operator') {
      if (!isCustomer && !isOperator) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied to this chat channel' });
    } else {
      if (!isCustomer && !isStaff) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Access denied to this chat channel' });
    }
  }
}
