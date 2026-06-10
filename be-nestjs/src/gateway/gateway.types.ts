export const WS_EVENTS = {
  // Client → Server
  LOCATION_UPDATE: 'location:update',
  CHAT_SEND: 'chat:send',
  JOIN_REQUEST: 'join:request',
  JOIN_TICKET: 'join:ticket',
  PING: 'ping',
  STAFF_CHAT_SEND: 'staff_chat:send',

  // Server → Client
  REQUEST_STATUS_CHANGED: 'request:status_changed',
  REQUEST_STAFF_ASSIGNED: 'request:staff_assigned',
  REQUEST_REQUOTE: 'request:requote',
  TRACKING_LOCATION: 'tracking:location',
  CHAT_MESSAGE: 'chat:message',
  POOL_NEW_REQUEST: 'pool:new_request',
  JOB_ASSIGNED: 'job:assigned',
  JOB_CANCELLED: 'job:cancelled',
  STAFF_POOL_UPDATED: 'staff:pool_updated',
  STAFF_STATUS_CHANGED: 'staff:status_changed',
  SUPPORT_MESSAGE: 'support:message',
  NOTIFICATION_NEW: 'notification:new',
  SCHEDULE_UPDATED: 'schedule:updated',
  STAFF_CHAT_MESSAGE: 'staff_chat:message',
  APPLICATION_UPDATED: 'application:updated',
  STAFF_UPDATED: 'staff:updated',
  ERROR: 'error',
  PONG: 'pong',
} as const;

export function requestRoom(requestId: string) {
  return `request:${requestId}`;
}

export function trackingRoom(requestId: string) {
  return `tracking:${requestId}`;
}

export function chatRoom(requestId: string, channel: string) {
  return `chat:${requestId}:${channel}`;
}

export function tenantPoolRoom(tenantId: string) {
  return `tenant:${tenantId}:pool`;
}

export function tenantStaffRoom(tenantId: string) {
  return `tenant:${tenantId}:staff`;
}

export function staffRoom(userId: string) {
  return `staff:${userId}`;
}

export function customerRoom(userId: string) {
  return `customer:${userId}`;
}

export function ticketRoom(ticketId: string) {
  return `ticket:${ticketId}`;
}

/** Per-user notification room — all roles */
export function userRoom(userId: string) {
  return `user:${userId}`;
}
