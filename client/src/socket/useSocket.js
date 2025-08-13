import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../utils/api';

const getSocketBaseUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  return getApiBaseUrl();
};

export const useSocket = ({ token, onEvent }) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 20000
    });

    socketRef.current = socket;

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
        if (typeof onEvent === 'function') {
          onEvent(event, data);
        }
      });
    });

    return () => {
      eventList.forEach((event) => socket.off(event));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onEvent]);

  return socketRef;
};
