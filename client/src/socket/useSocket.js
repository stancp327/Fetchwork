import { useEffect, useRef } from 'react';
import { getApiBaseUrl } from '../utils/api';

// socket.io-client (~107KB) is loaded lazily via dynamic import.
// It only downloads when a user actually has a token (i.e. is logged in),
// keeping it out of the main bundle entirely.

const getSocketBaseUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  return getApiBaseUrl();
};

const SOCKET_EVENTS = [
  'message:receive',
  'message:read',
  'conversation:update',
  'typing:start',
  'typing:stop',
  'user:online',
  'user:offline',
  'message:delivered',
  'user:online_status',
  'notification:new',
];

export const useSocket = (options) => {
  const { token: providedToken, onEvent } = options || {};
  const socketRef = useRef(null);

  useEffect(() => {
    const resolvedToken = providedToken || localStorage.getItem('token');
    if (!resolvedToken) return;

    let socket;
    let cancelled = false;

    // Dynamic import — socket.io chunk only loads for logged-in users
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;

      socket = io(getSocketBaseUrl(), {
        auth: { token: resolvedToken },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 20000,
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

      SOCKET_EVENTS.forEach((event) => {
        socket.on(event, (data) => {
          if (typeof onEvent === 'function') onEvent(event, data);
        });
      });
    });

    return () => {
      cancelled = true;
      if (socket) {
        SOCKET_EVENTS.forEach((event) => socket.off(event));
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [providedToken, onEvent]);

  return socketRef;
};
