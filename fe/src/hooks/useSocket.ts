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
      // Keep socket alive across screen changes
    };
  }, [token, user?.tenant_id]);

  // ── Event listeners ───────────────────────────────────────────────────────

  const onNotification = useCallback(
    (cb: (notification: Record<string, any>) => void) => {
      const s = getSocket();
      s?.on('notification:new', cb);
      return () => { getSocket()?.off('notification:new', cb); };
    },
    [],
  );

  const onStaffStatusChanged = useCallback(
    (cb: (data: { userId: string; online_status: string; tenant_id: string }) => void) => {
      const s = getSocket();
      s?.on('staff:status_changed', cb);
      return () => { getSocket()?.off('staff:status_changed', cb); };
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

  const onSupportMessage = useCallback(
    (cb: (data: { ticketId: string; message: Record<string, any> }) => void) => {
      const s = getSocket();
      s?.on('support:message', cb);
      return () => { getSocket()?.off('support:message', cb); };
    },
    [],
  );

  const joinTicketRoom = useCallback((ticketId: string) => {
    getSocket()?.emit('join:ticket', { ticketId });
  }, []);

  const joinRequestRoom = useCallback((requestId: string) => {
    getSocket()?.emit('join:request', { requestId });
  }, []);

  const onChatMessage = useCallback(
    (cb: (data: { requestId: string; channel: string; message: Record<string, any> }) => void) => {
      const s = getSocket();
      s?.on('chat:message', cb);
      return () => { getSocket()?.off('chat:message', cb); };
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
    onNotification,
    onStaffStatusChanged,
    onPoolNewRequest,
    onSupportMessage,
    joinTicketRoom,
    joinRequestRoom,
    onChatMessage,
    sendChatMessage,
  };
}
