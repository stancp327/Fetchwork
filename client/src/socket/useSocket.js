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
  'call:incoming',
  'call:accepted',
  'call:ended',
  'call:state',
  'call:offer',
  'call:answer',
  'call:ice-candidate',
  'call:media-toggle',
  'call:rate-limit',
  'call:error',
  'rcpt:update',
  'safety:nudge',
  'diag:socket',
];

export const useSocket = (options) => {
  const { token: providedToken, onEvent } = options || {};
  const socketRef = useRef(null);

  // Always-current ref — lets the handler update without triggering
  // a socket disconnect/reconnect cycle every time onEvent changes
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

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
      window.__fetchworkSocket = socket;

      socket.on('connect', () => {
        if (typeof onEventRef.current === 'function') onEventRef.current('socket:connect', { at: Date.now() });
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

      // Use ref so changing onEvent never causes a socket reconnect
      SOCKET_EVENTS.forEach((event) => {
        socket.on(event, (data) => {
          if (event === 'diag:socket') {
            console.debug('[SOCKET_DIAG]', data);
          }
          if (typeof onEventRef.current === 'function') onEventRef.current(event, data);
          // Dispatch call events as window events for IncomingCallOverlay
          if (event.startsWith('call:')) {
            window.dispatchEvent(new CustomEvent(`socket:${event}`, { detail: data }));
          }
        });
      });
    });

    return () => {
      cancelled = true;
      if (socket) {
        SOCKET_EVENTS.forEach((event) => socket.off(event));
        socket.disconnect();
        socketRef.current = null;
        window.__fetchworkSocket = null;
      }
    };
  // Only reconnect when the token changes — NOT when onEvent changes
  }, [providedToken]);

  return socketRef;
};
