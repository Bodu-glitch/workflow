import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (() => {
  const api = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  return api.replace('/api/v1', '');
})();

let socket: Socket | null = null;

/**
 * Create or reuse the singleton socket connection.
 * Call whenever the auth token or tenant changes.
 */
export function connectSocket(token: string, tenantId?: string | null): Socket {
  // Reuse if already connected with same token
  if (socket && socket.connected && (socket.auth as any)?.token === token) {
    return socket;
  }

  // Disconnect old socket if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(`${SOCKET_URL}/ws`, {
    auth: { token, tenantId },
    extraHeaders: tenantId ? { 'x-tenant-id': tenantId } : {},
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.connect();
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

/** Alias for connectSocket — used by origin/master consumers */
export function createSocket(token: string, tenantId?: string | null): Socket {
  return connectSocket(token, tenantId);
}

/** Alias for disconnectSocket — used by origin/master consumers */
export function destroySocket() {
  disconnectSocket();
}
