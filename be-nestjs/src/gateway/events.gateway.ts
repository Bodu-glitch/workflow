import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SupabaseService } from '../supabase/supabase.service.js';
import { ChatService } from '../chat/chat.service.js';
import { haversineDistance } from '../common/utils/haversine.util.js';
import {
  WS_EVENTS,
  requestRoom,
  trackingRoom,
  chatRoom,
  tenantPoolRoom,
  tenantStaffRoom,
  staffRoom,
  customerRoom,
  ticketRoom,
  userRoom,
} from './gateway.types.js';

interface SocketUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*' },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private supabase: SupabaseService,
    @Inject(forwardRef(() => ChatService)) private chat: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.emit(WS_EVENTS.ERROR, { code: 'UNAUTHORIZED', message: 'Token required' });
        client.disconnect();
        return;
      }

      const { data: { user }, error } = await this.supabase.db.auth.getUser(token);
      if (error || !user) {
        client.emit(WS_EVENTS.ERROR, { code: 'UNAUTHORIZED', message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const { data: dbUser } = await this.supabase.db
        .from('users')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (!dbUser?.is_active) {
        client.disconnect();
        return;
      }

      let tenantId: string | null = null;
      let role = dbUser.role;

      if (role !== 'superadmin') {
        // Browsers can't set custom WS headers — tenant ID is passed via auth payload
        const tenantIdFromAuth = (client.handshake.auth as any)?.tenantId as string | undefined;
        const tenantHeader = (client.handshake.headers['x-tenant-id'] as string | undefined) ?? tenantIdFromAuth;
        if (tenantHeader) {
          const { data: membership } = await this.supabase.db
            .from('user_tenants')
            .select('role')
            .eq('user_id', user.id)
            .eq('tenant_id', tenantHeader)
            .eq('is_active', true)
            .single();

          if (membership) {
            tenantId = tenantHeader;
            role = (membership as any).role;
          }
        }
      }

      const socketUser: SocketUser = { id: user.id, email: user.email!, role, tenant_id: tenantId };
      client.data.user = socketUser;

      // All users join their personal notification room
      client.join(userRoom(user.id));

      // Auto-join rooms based on role
      if (role === 'customer') {
        client.join(customerRoom(user.id));
      } else if (role === 'staff') {
        client.join(staffRoom(user.id));
        if (tenantId) {
          client.join(tenantStaffRoom(tenantId));
          // Staff goes online — update DB + notify management
          await this.supabase.db
            .from('user_tenants')
            .update({ online_status: 'online' })
            .eq('user_id', user.id)
            .eq('tenant_id', tenantId);

          this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.STAFF_STATUS_CHANGED, {
            userId: user.id,
            online_status: 'online',
            tenant_id: tenantId,
          });
        }
      } else if (['business_owner', 'operator'].includes(role) && tenantId) {
        client.join(tenantPoolRoom(tenantId));
      }
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user: SocketUser | undefined = client.data.user;
    if (!user) return;

    // Staff goes offline on disconnect
    if (user.role === 'staff' && user.tenant_id) {
      try {
        await this.supabase.db
          .from('user_tenants')
          .update({ online_status: 'offline' })
          .eq('user_id', user.id)
          .eq('tenant_id', user.tenant_id);

        this.server.to(tenantPoolRoom(user.tenant_id)).emit(WS_EVENTS.STAFF_STATUS_CHANGED, {
          userId: user.id,
          online_status: 'offline',
          tenant_id: user.tenant_id,
        });
      } catch {
        // Best effort
      }
    }
  }

  @SubscribeMessage(WS_EVENTS.PING)
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit(WS_EVENTS.PONG);
  }

  @SubscribeMessage(WS_EVENTS.JOIN_REQUEST)
  async handleJoinRequest(
    @MessageBody() data: { requestId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user: SocketUser = client.data.user;
    if (!user) return;

    client.join(requestRoom(data.requestId));
    client.join(trackingRoom(data.requestId));
    client.join(chatRoom(data.requestId, 'customer_operator'));
    client.join(chatRoom(data.requestId, 'customer_staff'));
  }

  @SubscribeMessage(WS_EVENTS.JOIN_TICKET)
  handleJoinTicket(
    @MessageBody() data: { ticketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user: SocketUser = client.data.user;
    if (!user) return;
    client.join(ticketRoom(data.ticketId));
  }

  @SubscribeMessage(WS_EVENTS.LOCATION_UPDATE)
  async handleLocationUpdate(
    @MessageBody() data: { requestId: string; lat: number; lng: number; heading?: number; speed?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user: SocketUser = client.data.user;
    if (!user || user.role !== 'staff') return;

    // Persist location
    if (user.tenant_id) {
      void this.supabase.db.from('staff_locations').insert({
        user_id: user.id,
        tenant_id: user.tenant_id,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading,
        speed_mps: data.speed,
      });
    }

    // Get customer location to compute ETA
    let etaSeconds: number | undefined;
    const { data: request } = await this.supabase.db
      .from('service_requests')
      .select('location_lat, location_lng')
      .eq('id', data.requestId)
      .single();

    if (request) {
      const dist = haversineDistance(data.lat, data.lng, request.location_lat, request.location_lng);
      etaSeconds = Math.round(dist / 10);
    }

    // Broadcast to customer tracking room
    this.server.to(trackingRoom(data.requestId)).emit(WS_EVENTS.TRACKING_LOCATION, {
      requestId: data.requestId,
      lat: data.lat,
      lng: data.lng,
      heading: data.heading,
      etaSeconds,
    });
  }

  @SubscribeMessage(WS_EVENTS.CHAT_SEND)
  async handleChatSend(
    @MessageBody() data: {
      requestId: string;
      channel: 'customer_operator' | 'customer_staff';
      content?: string;
      mediaUrls?: string[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user: SocketUser = client.data.user;
    if (!user) return;

    try {
      const message = await this.chat.sendMessage(
        data.requestId,
        data.channel,
        data.content,
        data.mediaUrls,
        user,
      );

      this.server.to(chatRoom(data.requestId, data.channel)).emit(WS_EVENTS.CHAT_MESSAGE, {
        requestId: data.requestId,
        channel: data.channel,
        message,
      });
    } catch (err: any) {
      client.emit(WS_EVENTS.ERROR, { code: 'CHAT_ERROR', message: err.message });
    }
  }

  @SubscribeMessage(WS_EVENTS.STAFF_CHAT_SEND)
  async handleStaffChatSend(
    @MessageBody() data: { content?: string; type?: string; task_id?: string; ticket_id?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user: SocketUser = client.data.user;
    if (!user || !user.tenant_id) return;

    const { data: message, error } = await this.supabase.db
      .from('chat_messages')
      .insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        content: data.content ?? null,
        type: data.type ?? 'text',
        task_id: data.task_id ?? null,
        ticket_id: data.ticket_id ?? null,
      })
      .select('id, user_id, content, type, task_id, ticket_id, created_at, tenant_id, users!chat_messages_user_id_fkey(full_name)')
      .single();

    if (error) {
      client.emit(WS_EVENTS.ERROR, { code: 'CHAT_ERROR', message: error.message });
      return;
    }

    this.emitStaffChatMessage(user.tenant_id, message);
  }

  // ── Public methods for other services to broadcast events ─────────────────
  emitRequestStatusChanged(requestId: string, status: string) {
    const payload = { requestId, status, timestamp: new Date().toISOString() };
    this.server.to(requestRoom(requestId)).emit(WS_EVENTS.REQUEST_STATUS_CHANGED, payload);

    void this.supabase.db
      .from('service_requests')
      .select('customer_id, tenant_id')
      .eq('id', requestId)
      .single()
      .then(({ data }) => {
        if (data?.customer_id) {
          this.server.to(customerRoom(data.customer_id)).emit(WS_EVENTS.REQUEST_STATUS_CHANGED, payload);
        }
        if (data?.tenant_id) {
          this.server.to(tenantPoolRoom(data.tenant_id)).emit(WS_EVENTS.REQUEST_STATUS_CHANGED, payload);
        }
      });
  }

  emitStaffAssigned(requestId: string, staff: Record<string, any>) {
    this.server.to(requestRoom(requestId)).emit(WS_EVENTS.REQUEST_STAFF_ASSIGNED, { requestId, staff });
  }

  emitRequote(requestId: string, requotePrice: number, reason: string) {
    this.server.to(requestRoom(requestId)).emit(WS_EVENTS.REQUEST_REQUOTE, { requestId, requotePrice, reason });
  }

  emitPoolNewRequest(tenantId: string, payload: Record<string, any>) {
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.POOL_NEW_REQUEST, payload);
  }

  emitJobAssigned(staffUserId: string, payload: Record<string, any>) {
    this.server.to(staffRoom(staffUserId)).emit(WS_EVENTS.JOB_ASSIGNED, payload);
  }

  emitJobCancelled(staffUserId: string, requestId: string, reason?: string) {
    this.server.to(staffRoom(staffUserId)).emit(WS_EVENTS.JOB_CANCELLED, { requestId, reason });
  }

  emitStaffPoolUpdated(tenantId: string, requestId: string) {
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.STAFF_POOL_UPDATED, { requestId, tenantId });
  }

  emitStaffStatusChanged(tenantId: string, userId: string, onlineStatus: string) {
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.STAFF_STATUS_CHANGED, {
      userId,
      online_status: onlineStatus,
      tenant_id: tenantId,
    });
  }

  /** Emit a new notification to the target user's personal room */
  emitNotification(userId: string, notification: Record<string, any>) {
    this.server.to(userRoom(userId)).emit(WS_EVENTS.NOTIFICATION_NEW, notification);
  }

  emitNotificationNew(userId: string, data: Record<string, any>) {
    this.server.to(staffRoom(userId)).emit(WS_EVENTS.NOTIFICATION_NEW, data);
    this.server.to(customerRoom(userId)).emit(WS_EVENTS.NOTIFICATION_NEW, data);
  }

  /** Emit a new support message to all participants in a ticket room */
  emitSupportMessage(ticketId: string, message: Record<string, any>) {
    this.server.to(ticketRoom(ticketId)).emit(WS_EVENTS.SUPPORT_MESSAGE, {
      ticketId,
      message,
    });
  }

  emitScheduleUpdated(userId: string) {
    this.server.to(staffRoom(userId)).emit(WS_EVENTS.SCHEDULE_UPDATED);
  }

  emitTenantScheduleUpdated(tenantId: string) {
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.SCHEDULE_UPDATED);
  }

  emitStaffChatMessage(tenantId: string, message: Record<string, any>) {
    this.server.to(tenantStaffRoom(tenantId)).emit(WS_EVENTS.STAFF_CHAT_MESSAGE, message);
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.STAFF_CHAT_MESSAGE, message);
  }

  emitApplicationUpdated(userId: string, data: { applicationId: string; status: 'approved' | 'rejected' }) {
    this.server.to(staffRoom(userId)).emit(WS_EVENTS.APPLICATION_UPDATED, data);
  }

  emitStaffUpdated(tenantId: string) {
    this.server.to(tenantPoolRoom(tenantId)).emit(WS_EVENTS.STAFF_UPDATED);
  }
}
