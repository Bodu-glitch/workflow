import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './api/client';

let _socket: Socket | null = null;

export function createSocket(token: string, tenantId?: string | null): Socket {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  const socketUrl = (BASE_URL ?? 'http://localhost:3000/api/v1').replace('/api/v1', '');
  _socket = io(`${socketUrl}/ws`, {
    auth: { token, tenantId: tenantId ?? undefined },
    transports: ['websocket'],
  });
  return _socket;
}

export function destroySocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
