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

let globalSocket: Socket | null = null;
let globalMountCount = 0;

export function SocketProvider({ children, sessionId }: { children: React.ReactNode, sessionId?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const statusRef = useRef<SessionStatus | null>(null);
  const sessionIdRef = useRef(sessionId);
  const joinedSidRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const url = API_URL || undefined;

    if (globalSocket) {
      globalSocket.auth = { token: localStorage.getItem('admin-token') || localStorage.getItem('salon-token') };
      globalSocket.disconnect();
      globalSocket.connect();
    } else {
      globalSocket = io(url, {
        auth: { token: localStorage.getItem('admin-token') || localStorage.getItem('salon-token') },
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        randomizationFactor: 0.5,
        timeout: 20000,
        autoConnect: true
      });
    }

    const s = globalSocket;
    setSocket(s);

    const emitJoinSession = () => {
      const sid = sessionIdRef.current;
      if (!sid || joinedSidRef.current === sid) return;
      joinedSidRef.current = sid;
      s.emit('join-session', sid);
    };

    const handleConnect = emitJoinSession;

    const handleSessionStatus = (data: SessionStatus) => {
      statusRef.current = data;
      setStatus(data);
    };

    const handleDisconnect = (reason: string) => {
      const sid = sessionIdRef.current;
      if (sid) {
        const newStatus: SessionStatus = {
          sessionId: sid,
          status: reason === 'io server disconnect' ? 'DISCONNECTED' : 'RECONNECTING',
          message: reason === 'io server disconnect' 
            ? 'Disconnected from server' 
            : 'Disconnected, attempting to reconnect...'
        };
        statusRef.current = newStatus;
        setStatus(newStatus);
      }
    };

    const handleReconnect = emitJoinSession;

    const handleConnectError = (err: Error) => {
      console.error('Socket Context: Connection error', err.message);
      setStatus({ sessionId: sessionIdRef.current || '', status: 'ERROR', message: `Connection error: ${err.message}` });
    };

    s.on('connect', handleConnect);
    s.on('session-status', handleSessionStatus);
    s.on('disconnect', handleDisconnect);
    s.on('reconnect', handleReconnect);
    s.on('connect_error', handleConnectError);

    if (s.connected && sessionIdRef.current) {
      emitJoinSession();
    }

    globalMountCount++;

    return () => {
      s.off('connect', handleConnect);
      s.off('session-status', handleSessionStatus);
      s.off('disconnect', handleDisconnect);
      s.off('reconnect', handleReconnect);
      s.off('connect_error', handleConnectError);

      globalMountCount--;
      setTimeout(() => {
        if (globalMountCount === 0 && globalSocket) {
          globalSocket.disconnect();
          globalSocket = null;
        }
      }, 0);
    };
  }, []);

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

  const value = React.useMemo(() => ({
    socket,
    status,
    initSession,
    restartSession,
    sendMessage,
    onMessage,
    deleteSession
  }), [socket, status, initSession, restartSession, sendMessage, onMessage, deleteSession]);

  return (
    <SocketContext.Provider value={value}>
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
