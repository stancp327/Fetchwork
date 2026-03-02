import React, { useState, useEffect, useRef } from 'react';
import VideoCallModal from './VideoCallModal';
import './IncomingCallOverlay.css';

/**
 * Global overlay that handles incoming calls and active call state.
 * Listens for socket events via the window event bus (dispatched by useSocket).
 * Other components trigger calls via: window.dispatchEvent(new CustomEvent('fetchwork:start-call', { detail }))
 */
const IncomingCallOverlay = () => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const socketRef = useRef(null);

  // Get socket reference from the global socket manager
  useEffect(() => {
    // The socket is stored on window by useSocket for cross-component access
    const checkSocket = () => {
      if (window.__fetchworkSocket) {
        socketRef.current = window.__fetchworkSocket;
      }
    };
    checkSocket();
    const interval = setInterval(checkSocket, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    const handler = (e) => {
      const { callId, caller, type } = e.detail || {};
      if (activeCall) {
        // Already in a call — reject
        socketRef.current?.emit('call:reject', { callId });
        return;
      }
      setIncomingCall({ callId, caller, type });
    };
    window.addEventListener('socket:call:incoming', handler);
    return () => window.removeEventListener('socket:call:incoming', handler);
  }, [activeCall]);

  // Listen for start-call events from Messages
  useEffect(() => {
    const handler = (e) => {
      const { callId, remoteUser, type } = e.detail;
      setActiveCall({ callId, remoteUser, type, isIncoming: false });
    };
    window.addEventListener('fetchwork:start-call', handler);
    return () => window.removeEventListener('fetchwork:start-call', handler);
  }, []);

  const acceptCall = () => {
    socketRef.current?.emit('call:accept', { callId: incomingCall.callId });
    setActiveCall({
      callId: incomingCall.callId,
      remoteUser: incomingCall.caller,
      type: incomingCall.type,
      isIncoming: true,
    });
    setIncomingCall(null);
  };

  const rejectCall = () => {
    socketRef.current?.emit('call:reject', { callId: incomingCall.callId });
    setIncomingCall(null);
  };

  return (
    <>
      {incomingCall && (
        <div className="incoming-call-toast">
          <div className="incoming-call-info">
            <div className="incoming-call-avatar">
              {incomingCall.caller.profileImage
                ? <img src={incomingCall.caller.profileImage} alt="" />
                : <span>{incomingCall.caller.firstName?.[0]}</span>
              }
            </div>
            <div>
              <div className="incoming-call-name">{incomingCall.caller.firstName} {incomingCall.caller.lastName}</div>
              <div className="incoming-call-type">Incoming {incomingCall.type} call…</div>
            </div>
          </div>
          <div className="incoming-call-actions">
            <button className="incoming-btn accept" onClick={acceptCall}>Accept</button>
            <button className="incoming-btn reject" onClick={rejectCall}>Decline</button>
          </div>
        </div>
      )}

      {activeCall && (
        <VideoCallModal
          callId={activeCall.callId}
          remoteUser={activeCall.remoteUser}
          type={activeCall.type}
          isIncoming={activeCall.isIncoming}
          onClose={() => setActiveCall(null)}
        />
      )}
    </>
  );
};

export default IncomingCallOverlay;
