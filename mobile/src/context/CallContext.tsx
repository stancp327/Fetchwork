/**
 * CallContext – manages incoming call state + active call modal.
 *
 * Socket events handled here:
 *   call:incoming  → show IncomingCallBanner
 *   call:offer     → store pending offer for callee flow
 *   call:canceled  → dismiss IncomingCallBanner
 *   call:ended     → end active VideoCallScreen
 *
 * Provides `startCall()` for initiating outbound calls from any screen.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { getSocket } from '../api/socket';
import { callsApi } from '../api/endpoints/callsApi';
import IncomingCallBanner from '../components/calls/IncomingCallBanner';
import VideoCallScreen, { RemoteUser, SdpInit } from '../screens/VideoCallScreen';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────

interface IncomingCallState {
  callId: string;
  caller: RemoteUser;
  type: 'video' | 'audio';
  offer?: SdpInit;
}

interface ActiveCallState {
  callId: string;
  remoteUser: RemoteUser;
  callType: 'video' | 'audio';
  isIncoming: boolean;
  pendingOffer?: SdpInit;
}

interface CallContextValue {
  /** Initiate an outbound call. Returns callId on success. */
  startCall: (recipientId: string, remoteUser: RemoteUser, type?: 'video' | 'audio') => Promise<string | null>;
}

// ── Context ────────────────────────────────────────────────────────────────

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used inside CallProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  // Keep the latest pending offer even before the user taps Accept
  const pendingOfferRef = useRef<SdpInit | null>(null);

  // ── Socket wiring ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    let socket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let mounted = true;

    const handleIncoming = (data: {
      callId: string;
      caller: RemoteUser;
      type: 'video' | 'audio';
    }) => {
      if (!mounted) return;

      // If already in a call, auto-reject
      if (activeCall) {
        getSocket()
          .then(s => s.emit('call:reject', { callId: data.callId }))
          .catch(() => {});
        return;
      }

      setIncomingCall({ callId: data.callId, caller: data.caller, type: data.type });
    };

    const handleOffer = (data: {
      callId: string;
      fromUserId: string;
      offer: SdpInit;
    }) => {
      if (!mounted) return;
      // Store offer; it will be consumed when user taps Accept
      pendingOfferRef.current = data.offer;
      // Also update the incomingCall state if it matches
      setIncomingCall(prev =>
        prev && prev.callId === data.callId
          ? { ...prev, offer: data.offer }
          : prev
      );
    };

    const handleCanceled = ({ callId }: { callId: string }) => {
      if (!mounted) return;
      setIncomingCall(prev => (prev?.callId === callId ? null : prev));
      pendingOfferRef.current = null;
    };

    const handleEnded = ({ callId }: { callId: string }) => {
      if (!mounted) return;
      setActiveCall(prev => (prev?.callId === callId ? null : prev));
      setIncomingCall(prev => (prev?.callId === callId ? null : prev));
    };

    getSocket()
      .then(s => {
        if (!mounted) return;
        socket = s;
        s.on('call:incoming', handleIncoming);
        s.on('call:offer', handleOffer);
        s.on('call:canceled', handleCanceled);
        s.on('call:ended', handleEnded);
      })
      .catch(err => console.warn('[CallContext] Socket init failed:', err));

    return () => {
      mounted = false;
      if (socket) {
        socket.off('call:incoming', handleIncoming);
        socket.off('call:offer', handleOffer);
        socket.off('call:canceled', handleCanceled);
        socket.off('call:ended', handleEnded);
      }
    };
  }, [isAuthenticated, activeCall]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const startCall = useCallback(async (
    recipientId: string,
    remoteUser: RemoteUser,
    type: 'video' | 'audio' = 'video',
  ): Promise<string | null> => {
    try {
      const { callId } = await callsApi.initiateCall(recipientId, type);
      setActiveCall({
        callId,
        remoteUser,
        callType: type,
        isIncoming: false,
      });
      return callId;
    } catch (err) {
      console.error('[Calls] initiateCall failed:', err);
      return null;
    }
  }, []);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    const offer = incomingCall.offer ?? pendingOfferRef.current ?? undefined;
    setActiveCall({
      callId: incomingCall.callId,
      remoteUser: incomingCall.caller,
      callType: incomingCall.type,
      isIncoming: true,
      pendingOffer: offer,
    });
    setIncomingCall(null);
    pendingOfferRef.current = null;
  }, [incomingCall]);

  const handleDecline = useCallback(async () => {
    if (!incomingCall) return;
    const { callId } = incomingCall;
    setIncomingCall(null);
    pendingOfferRef.current = null;
    try {
      const socket = await getSocket();
      socket.emit('call:reject', { callId });
    } catch { /* non-fatal */ }
  }, [incomingCall]);

  const handleCallClose = useCallback(() => {
    setActiveCall(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}

      {/* Incoming call banner (rendered above everything) */}
      {incomingCall && !activeCall && (
        <View style={styles.bannerWrapper} pointerEvents="box-none">
          <IncomingCallBanner
            callId={incomingCall.callId}
            caller={incomingCall.caller}
            callType={incomingCall.type}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        </View>
      )}

      {/* Active call — full-screen modal */}
      {activeCall && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={() => {
            // Android back button — don't allow dismissal without ending
          }}
        >
          <VideoCallScreen
            callId={activeCall.callId}
            remoteUser={activeCall.remoteUser}
            callType={activeCall.callType}
            isIncoming={activeCall.isIncoming}
            pendingOffer={activeCall.pendingOffer}
            onClose={handleCallClose}
          />
        </Modal>
      )}
    </CallContext.Provider>
  );
}

const styles = StyleSheet.create({
  bannerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});
