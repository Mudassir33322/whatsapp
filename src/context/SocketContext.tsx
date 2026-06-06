import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

export interface SessionStatus {
  sessionId: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'ERROR' | 'RECONNECTING';
  battery?: number;
  lastQr?: string;
  qr?: string;
  user?: string;
  message?: string;
}

interface SocketContextType {
  socket: Socket | null;
  status: SessionStatus | null;
  initSession: (sid: string) => void;
  restartSession: (sid: string) => void;
  sendMessage: (sid: string, to: string, text: string) => void;
  onMessage: (callback: (data: any) => void) => () => void;
  deleteSession: (sid: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children, sessionId }: { children: React.ReactNode, sessionId?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const statusRef = useRef<SessionStatus | null>(null);

  useEffect(() => {
    const url = API_URL || undefined;
    const adminToken = localStorage.getItem('admin-token');
    const s = io(url, {
      auth: { token: adminToken },
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
      autoConnect: true,
      transports: ['websocket', 'polling']
    } as any);

    setSocket(s);

    const handleConnect = () => {
      console.log('Socket Context: Connected to server');
      if (sessionId) {
        s.emit('join-session', sessionId);
      }
    };

    const handleSessionStatus = (data: SessionStatus) => {
      console.log('Socket Context: Session status updated', data);
      statusRef.current = data;
      setStatus(data);
    };

    const handleDisconnect = (reason: string) => {
      console.log('Socket Context: Disconnected', reason);
      if (sessionId) {
        const newStatus: SessionStatus = {
          sessionId,
          status: reason === 'io server disconnect' ? 'DISCONNECTED' : 'RECONNECTING',
          message: reason === 'io server disconnect' 
            ? 'Disconnected from server' 
            : 'Disconnected, attempting to reconnect...'
        };
        statusRef.current = newStatus;
        setStatus(newStatus);
      }
    };

    s.on('connect', handleConnect);
    s.on('session-status', handleSessionStatus);
    s.on('disconnect', handleDisconnect);
    s.io.on('reconnect', () => {
      console.log('Socket Context: Reconnected, re-joining session');
      if (sessionId) {
        s.emit('join-session', sessionId);
      }
    });

    return () => {
      console.log('Socket Context: Cleaning up');
      s.disconnect();
    };
  }, [sessionId]);

  const initSession = useCallback((sid: string) => {
    if (socket) socket.emit('init-session', sid);
  }, [socket]);

  const restartSession = useCallback((sid: string) => {
    if (socket) socket.emit('restart-session', sid);
  }, [socket]);

  const sendMessage = useCallback((sid: string, to: string, text: string) => {
    if (socket) socket.emit('send-message', { sessionId: sid, to, text });
  }, [socket]);

  const onMessage = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on('on-message', callback);
      return () => {
        socket.off('on-message', callback);
      };
    }
    return () => {};
  }, [socket]);

  const deleteSession = useCallback((sid: string) => {
    if (socket) socket.emit('delete-session', sid);
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, status, initSession, restartSession, sendMessage, onMessage, deleteSession }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
};
