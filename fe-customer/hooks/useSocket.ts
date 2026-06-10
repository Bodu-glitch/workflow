import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { Socket } from 'socket.io-client';

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      socketRef.current = null;
      return;
    }

    const s = connectSocket(token);
    socketRef.current = s;

    return () => {
      // Don't disconnect on unmount — keep socket alive across screens
    };
  }, [token]);

  const joinRequestRoom = useCallback((requestId: string) => {
    socketRef.current?.emit('join:request', { requestId });
  }, []);

  const onLocationUpdate = useCallback(
    (cb: (data: { requestId: string; lat: number; lng: number; etaSeconds?: number }) => void) => {
      socketRef.current?.on('tracking:location', cb);
      return () => { socketRef.current?.off('tracking:location', cb); };
    },
    [],
  );

  const onStatusChange = useCallback(
    (cb: (data: { requestId: string; status: string; timestamp: string }) => void) => {
      socketRef.current?.on('request:status_changed', cb);
      return () => { socketRef.current?.off('request:status_changed', cb); };
    },
    [],
  );

  const onChatMessage = useCallback(
    (cb: (data: { requestId: string; channel: string; message: unknown }) => void) => {
      socketRef.current?.on('chat:message', cb);
      return () => { socketRef.current?.off('chat:message', cb); };
    },
    [],
  );

  const onRequote = useCallback(
    (cb: (data: { requestId: string; requotePrice: number; reason: string }) => void) => {
      socketRef.current?.on('request:requote', cb);
      return () => { socketRef.current?.off('request:requote', cb); };
    },
    [],
  );

  const sendChatMessage = useCallback(
    (requestId: string, channel: string, content: string) => {
      socketRef.current?.emit('chat:send', { requestId, channel, content });
    },
    [],
  );

  const onNotification = useCallback(
    (cb: (notification: Record<string, any>) => void) => {
      socketRef.current?.on('notification:new', cb);
      return () => { socketRef.current?.off('notification:new', cb); };
    },
    [],
  );

  return { joinRequestRoom, onLocationUpdate, onStatusChange, onChatMessage, onRequote, sendChatMessage, onNotification };
}
