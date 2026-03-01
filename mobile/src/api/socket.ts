import { io, Socket } from 'socket.io-client';
import { storage } from '../utils/storage';
import { API_BASE } from './client';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await storage.getToken();
  if (!token) throw new Error('No token for socket connection');

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket'],   // skip polling — faster + cleaner on mobile
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] disconnected:', reason);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocketInstance(): Socket | null {
  return socket;
}
