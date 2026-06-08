import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api/client';

const SOCKET_URL = BASE_URL.replace('/api/v1', '');

let _socket: Socket | null = null;

export function createSocket(token: string, tenantId?: string | null): Socket {
  if (_socket) { _socket.disconnect(); _socket = null; }
  _socket = io(`${SOCKET_URL}/ws`, {
    auth: { token },
    extraHeaders: tenantId ? { 'x-tenant-id': tenantId } : {},
    transports: ['websocket'],
  });
  return _socket;
}

export function destroySocket() {
  if (_socket) { _socket.disconnect(); _socket = null; }
}
