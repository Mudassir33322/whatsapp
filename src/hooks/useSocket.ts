import { useSocketContext, SessionStatus } from '../context/SocketContext';

export type { SessionStatus };

export function useSocket(sessionId?: string) {
  const { socket, status, initSession, sendMessage, onMessage, deleteSession } = useSocketContext();

  return { socket, status, initSession, sendMessage, onMessage, deleteSession };
}
