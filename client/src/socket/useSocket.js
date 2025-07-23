import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000');

export const useSocket = ({ token, onEvent }) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    console.log('[SOCKET] Initializing connection to:', SOCKET_URL);
    
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[SOCKET] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[SOCKET] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('[SOCKET] Socket error:', error);
    });

    const eventList = [
      'message:receive', 
      'message:read', 
      'conversation:update', 
      'typing:start', 
      'typing:stop',
      'user:online',
      'user:offline', 
      'message:delivered',
      'user:online_status'
    ];
    eventList.forEach((event) => {
      socket.on(event, (data) => {
        console.log(`[SOCKET] Received ${event}:`, data);
        onEvent(event, data);
      });
    });

    return () => {
      console.log('[SOCKET] Cleaning up connection');
      eventList.forEach((event) => socket.off(event));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return socketRef;
};
