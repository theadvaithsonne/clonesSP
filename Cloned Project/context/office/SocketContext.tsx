'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficeAuth } from './AuthContext';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function OfficeSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useOfficeAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('office_access_token');
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_OFFICE_API_URL ?? 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useOfficeSocket() {
  return useContext(SocketContext);
}
