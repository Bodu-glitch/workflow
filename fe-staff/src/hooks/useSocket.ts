import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuth } from '@/context/auth';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    const tenantId = user?.tenant_id ?? null;
    const s = connectSocket(token, tenantId);
    socketRef.current = s;

    return () => {
      // Keep socket alive across screen changes — don't disconnect
    };
  }, [token, user?.tenant_id]);

  // ── Room joins ────────────────────────────────────────────────────────────

  const joinTicketRoom = useCallback((ticketId: string) => {
    getSocket()?.emit('join:ticket', { ticketId });
  }, []);

  const joinRequestRoom = useCallback((requestId: string) => {
    getSocket()?.emit('join:request', { requestId });
  }, []);

  // ── Event listeners ───────────────────────────────────────────────────────

  const onSupportMessage = useCallback(
    (cb: (data: { ticketId: string; message: Record<string, any> }) => void) => {
      const s = getSocket();
      s?.on('support:message', cb);
      return () => { getSocket()?.off('support:message', cb); };
    },
    [],
  );

  const onNotification = useCallback(
    (cb: (notification: Record<string, any>) => void) => {
      const s = getSocket();
      s?.on('notification:new', cb);
      return () => { getSocket()?.off('notification:new', cb); };
    },
    [],
  );

  const onJobAssigned = useCallback(
    (cb: (data: Record<string, any>) => void) => {
      const s = getSocket();
      s?.on('job:assigned', cb);
      return () => { getSocket()?.off('job:assigned', cb); };
    },
    [],
  );

  const onJobCancelled = useCallback(
    (cb: (data: { requestId: string; reason?: string }) => void) => {
      const s = getSocket();
      s?.on('job:cancelled', cb);
      return () => { getSocket()?.off('job:cancelled', cb); };
    },
    [],
  );

  const onPoolNewRequest = useCallback(
    (cb: (data: Record<string, any>) => void) => {
      const s = getSocket();
      s?.on('pool:new_request', cb);
      return () => { getSocket()?.off('pool:new_request', cb); };
    },
    [],
  );

  const onRequestStatusChanged = useCallback(
    (cb: (data: { requestId: string; status: string }) => void) => {
      const s = getSocket();
      s?.on('request:status_changed', cb);
      return () => { getSocket()?.off('request:status_changed', cb); };
    },
    [],
  );

  const onChatMessage = useCallback(
    (cb: (data: { requestId: string; channel: string; message: Record<string, any> }) => void) => {
      const s = getSocket();
      s?.on('chat:message', cb);
      return () => { getSocket()?.off('chat:message', cb); };
    },
    [],
  );

  // ── Emitters ──────────────────────────────────────────────────────────────

  const sendLocationUpdate = useCallback(
    (requestId: string, lat: number, lng: number, heading?: number, speed?: number) => {
      getSocket()?.emit('location:update', { requestId, lat, lng, heading, speed });
    },
    [],
  );

  const sendChatMessage = useCallback(
    (requestId: string, channel: string, content: string) => {
      getSocket()?.emit('chat:send', { requestId, channel, content });
    },
    [],
  );

  return {
    joinTicketRoom,
    joinRequestRoom,
    onSupportMessage,
    onNotification,
    onJobAssigned,
    onJobCancelled,
    onPoolNewRequest,
    onRequestStatusChanged,
    onChatMessage,
    sendLocationUpdate,
    sendChatMessage,
  };
}
