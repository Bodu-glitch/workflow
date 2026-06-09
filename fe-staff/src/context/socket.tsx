import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket, destroySocket } from '@/lib/socket';
import { useAuth } from '@/context/auth';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token || !user?.id) {
      destroySocket();
      setSocket(null);
      return;
    }
    const s = createSocket(token, user.tenant_id);
    setSocket(s);
    return () => {
      destroySocket();
      setSocket(null);
    };
  }, [token, user?.id, user?.tenant_id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocketContext(): Socket | null {
  return useContext(SocketContext);
}
