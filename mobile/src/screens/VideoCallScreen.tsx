/**
 * VideoCallScreen – full-screen modal overlay for an active WebRTC call.
 * Ported from client/src/components/Calls/VideoCallModal.js
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  StatusBar,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
} from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { getSocket } from '../api/socket';
import { callsApi, QualityStats, IceServer } from '../api/endpoints/callsApi';
import Avatar from '../components/common/Avatar';
import { colors, spacing, radius } from '../theme';

// react-native-webrtc doesn't re-export these init types, so we define them locally
export interface SdpInit {
  sdp: string;
  type: string | null;
}

export interface IceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

const FALLBACK_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface RemoteUser {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export interface VideoCallScreenProps {
  callId: string;
  remoteUser: RemoteUser;
  callType: 'video' | 'audio';
  isIncoming: boolean;
  pendingOffer?: SdpInit;
  onClose: () => void;
}

type CallStatus = 'connecting' | 'active' | 'ended' | 'failed';

export default function VideoCallScreen({
  callId,
  remoteUser,
  callType,
  isIncoming,
  pendingOffer,
  onClose,
}: VideoCallScreenProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteMediaState, setRemoteMediaState] = useState({
    audio: true,
    video: callType === 'video',
  });

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceServersRef = useRef<IceServer[] | null>(null);
  const pendingIceCandidatesRef = useRef<IceCandidateInit[]>([]);
  const mountedRef = useRef(true);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startTimer = useCallback(() => {
    if (durationIntervalRef.current) return;
    durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    if (mountedRef.current) setCallStatus('active');
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const permsToRequest = [
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ...(callType === 'video' ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
    ] as Parameters<typeof PermissionsAndroid.requestMultiple>[0];
    const results = await PermissionsAndroid.requestMultiple(permsToRequest);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  }, [callType]);

  const getIceServers = useCallback(async (): Promise<IceServer[]> => {
    if (iceServersRef.current) return iceServersRef.current;
    try {
      const data = await callsApi.getRelayCredentials(callId);
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
        iceServersRef.current = data.iceServers;
        return data.iceServers;
      }
    } catch (err) {
      console.warn('[WebRTC] TURN credential fetch failed — falling back to STUN-only:', err);
    }
    iceServersRef.current = FALLBACK_ICE_SERVERS;
    return FALLBACK_ICE_SERVERS;
  }, [callId]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
  }, []);

  const uploadQualitySummary = useCallback(async () => {
    try {
      const stats: QualityStats = { audioFallbackUsed: callType === 'audio' };
      await callsApi.uploadQuality(callId, stats);
    } catch (err) {
      console.warn('[Calls] Quality upload failed:', err);
    }
  }, [callId, callType]);

  const finalizeAndClose = useCallback(async (status: CallStatus = 'ended') => {
    if (!mountedRef.current) return;
    setCallStatus(status);
    cleanup();
    await uploadQualitySummary().catch(() => {});
    setTimeout(() => { if (mountedRef.current) onClose(); }, 600);
  }, [cleanup, onClose, uploadQualitySummary]);

  // ── Peer connection ───────────────────────────────────────────────────────

  // Forward-declared so createPeerConnection can reference it
  const handleEndCallRef = useRef<() => Promise<void>>(async () => {});

  const createPeerConnection = useCallback(async (): Promise<RTCPeerConnection> => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    // icecandidate
    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const candidateData = e.candidate;
        getSocket()
          .then(socket => socket.emit('call:ice-candidate', {
            callId,
            targetUserId: remoteUser._id,
            candidate: candidateData,
          }))
          .catch(() => null);
      }
    });

    // track
    pc.addEventListener('track', (e) => {
      if (e.streams?.[0]) {
        setRemoteStream(e.streams[0]);
      }
    });

    // ice connection state
    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState;
      console.log(`[WebRTC] ICE state: ${state}`);
      if (state === 'connected' || state === 'completed') {
        startTimer();
      } else if (state === 'failed') {
        if (typeof pc.restartIce === 'function') {
          pc.restartIce();
        } else {
          handleEndCallRef.current();
        }
      } else if (state === 'disconnected') {
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            handleEndCallRef.current();
          }
        }, 5000);
      }
    });

    pcRef.current = pc;
    return pc;
  }, [callId, remoteUser._id, getIceServers, startTimer]);

  const getLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false,
      }) as MediaStream;
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: unknown) {
      console.error('[WebRTC] getUserMedia failed:', err);
      const error = err as { name?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        Alert.alert('Permission Denied', 'Camera/microphone access is required. Please enable it in Settings.');
      } else {
        Alert.alert('Error', 'Could not access camera or microphone.');
      }
      if (mountedRef.current) setCallStatus('failed');
      return null;
    }
  }, [callType]);

  // ── Caller flow ───────────────────────────────────────────────────────────

  const startAsCallerAsync = useCallback(async () => {
    const hasPerms = await requestPermissions();
    if (!hasPerms) {
      Alert.alert('Permission Required', 'Camera and microphone permissions are needed for calls.');
      if (mountedRef.current) setCallStatus('failed');
      return;
    }
    const stream = await getLocalMedia();
    if (!stream) return;

    const pc = await createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer({}) as unknown as SdpInit;
    await pc.setLocalDescription(new RTCSessionDescription(offer));

    const socket = await getSocket().catch(() => null);
    socket?.emit('call:offer', {
      callId,
      targetUserId: remoteUser._id,
      offer: pc.localDescription,
    });
  }, [callId, createPeerConnection, getLocalMedia, remoteUser._id, requestPermissions]);

  // ── Callee flow ───────────────────────────────────────────────────────────

  const startAsCalleeAsync = useCallback(async (offer: SdpInit) => {
    const hasPerms = await requestPermissions();
    if (!hasPerms) {
      Alert.alert('Permission Required', 'Camera and microphone permissions are needed for calls.');
      if (mountedRef.current) setCallStatus('failed');
      return;
    }
    const stream = await getLocalMedia();
    if (!stream) return;

    const pc = await createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Drain queued ICE candidates
    if (pendingIceCandidatesRef.current.length > 0) {
      const queued = [...pendingIceCandidatesRef.current];
      pendingIceCandidatesRef.current = [];
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (iceErr) {
          console.warn('[WebRTC] Queued ICE candidate error:', iceErr);
        }
      }
    }

    const answer = await pc.createAnswer() as unknown as SdpInit;
    await pc.setLocalDescription(new RTCSessionDescription(answer));

    const socket = await getSocket().catch(() => null);
    socket?.emit('call:answer', {
      callId,
      targetUserId: remoteUser._id,
      answer: pc.localDescription,
    });
  }, [callId, createPeerConnection, getLocalMedia, remoteUser._id, requestPermissions]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const handleEndCall = useCallback(async () => {
    const socket = await getSocket().catch(() => null);
    socket?.emit('call:end', { callId });
    await finalizeAndClose('ended');
  }, [callId, finalizeAndClose]);

  // Keep ref in sync so ice state handler can call it without stale closure
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  const toggleMute = useCallback(async () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      const socket = await getSocket().catch(() => null);
      socket?.emit('call:media-toggle', {
        callId, targetUserId: remoteUser._id, kind: 'audio', enabled: audioTrack.enabled,
      });
    }
  }, [callId, remoteUser._id]);

  const toggleCamera = useCallback(async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
      const socket = await getSocket().catch(() => null);
      socket?.emit('call:media-toggle', {
        callId, targetUserId: remoteUser._id, kind: 'video', enabled: videoTrack.enabled,
      });
    }
  }, [callId, remoteUser._id]);

  const toggleScreenShare = useCallback(async () => {
    if (Platform.OS !== 'android') return; // iOS requires broadcast extension — not supported yet
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Stop screen share — restore camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camStream = localStreamRef.current;
      const camTrack = camStream?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        // @ts-ignore — getDisplayMedia supported on Android in react-native-webrtc v124+
        const screenStream: MediaStream = await mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        // Auto-stop when user dismisses the system screen share picker
        // @ts-ignore — onended exists at runtime in react-native-webrtc but isn't typed
        (screenTrack as any).onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          const camTrack2 = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack2) {
            const s = pc.getSenders().find((s: any) => s.track?.kind === 'video');
            s?.replaceTrack(camTrack2);
          }
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('[VideoCallScreen] Screen share failed:', err);
        Alert.alert('Screen Share', 'Could not start screen sharing. Please try again.');
      }
    }
  }, [isScreenSharing]);

  const toggleSpeaker = useCallback(() => setIsSpeakerOn(prev => !prev), []);

  // ── Socket event handlers ─────────────────────────────────────────────────

  useEffect(() => {
    let socketInstance: Awaited<ReturnType<typeof getSocket>> | null = null;

    const handleAnswer = async (data: { answer: SdpInit }) => {
      if (!pcRef.current || !mountedRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    };

    const handleIceCandidate = async (data: { candidate: IceCandidateInit }) => {
      if (!mountedRef.current) return;
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingIceCandidatesRef.current.push(data.candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('[WebRTC] ICE candidate error:', err);
      }
    };

    const handleCallEnded = async () => finalizeAndClose('ended');

    const handleMediaToggle = (data: { kind: 'audio' | 'video'; enabled: boolean }) => {
      if (!mountedRef.current) return;
      setRemoteMediaState(prev => ({ ...prev, [data.kind]: data.enabled }));
    };

    getSocket().then(socket => {
      socketInstance = socket;
      socket.on('call:answer', handleAnswer);
      socket.on('call:ice-candidate', handleIceCandidate);
      socket.on('call:ended', handleCallEnded);
      socket.on('call:media-toggle', handleMediaToggle);
    }).catch(err => console.warn('[VideoCallScreen] Socket bind failed:', err));

    return () => {
      if (socketInstance) {
        socketInstance.off('call:answer', handleAnswer);
        socketInstance.off('call:ice-candidate', handleIceCandidate);
        socketInstance.off('call:ended', handleCallEnded);
        socketInstance.off('call:media-toggle', handleMediaToggle);
      }
    };
  }, [finalizeAndClose]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (isIncoming && pendingOffer) {
      startAsCalleeAsync(pendingOffer);
    } else if (!isIncoming) {
      startAsCallerAsync();
    }

    // 30s connection timeout
    const timeout = setTimeout(() => {
      if (mountedRef.current && callStatus === 'connecting') {
        handleEndCallRef.current();
      }
    }, 30_000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const remoteDisplayName = `${remoteUser.firstName} ${remoteUser.lastName}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote video — full screen */}
      <View style={styles.remoteContainer}>
        {remoteStream && remoteMediaState.video && callStatus === 'active' ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Avatar name={remoteDisplayName} size="xl" />
            <Text style={styles.remoteName}>{remoteDisplayName}</Text>
            <Text style={styles.statusText}>
              {callStatus === 'connecting' && (isIncoming ? 'Incoming call…' : 'Calling…')}
              {callStatus === 'ended' && 'Call ended'}
              {callStatus === 'failed' && 'Call failed'}
              {callStatus === 'active' && !remoteMediaState.video && 'Camera off'}
            </Text>
          </View>
        )}

        {callStatus === 'active' && !remoteMediaState.audio && (
          <View style={styles.mutedBadge}>
            <Ionicons name="mic-off" size={16} color={colors.white} />
            <Text style={styles.mutedText}>Muted</Text>
          </View>
        )}
      </View>

      {/* Local video PiP */}
      {callType === 'video' && localStream && (
        <View style={styles.localContainer}>
          {!isCameraOff ? (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
          ) : (
            <View style={[styles.localVideo, styles.localPlaceholder]}>
              <Ionicons name="videocam-off" size={20} color={colors.white} />
            </View>
          )}
        </View>
      )}

      {/* Duration */}
      {callStatus === 'active' && (
        <View style={styles.durationContainer}>
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      )}

      {/* Name overlay */}
      <View style={styles.nameContainer}>
        <Text style={styles.nameText}>{remoteDisplayName}</Text>
        {callStatus === 'connecting' && (
          <Text style={styles.connectingText}>{isIncoming ? 'Incoming call…' : 'Calling…'}</Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={toggleMute} accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={colors.white} />
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]} onPress={toggleCamera} accessibilityLabel={isCameraOff ? 'Camera on' : 'Camera off'}>
            <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color={colors.white} />
          </TouchableOpacity>
        )}

        {callType === 'video' && Platform.OS === 'android' && callStatus === 'active' && (
          <TouchableOpacity
            style={[styles.controlBtn, isScreenSharing && styles.controlBtnActive]}
            onPress={toggleScreenShare}
            accessibilityLabel={isScreenSharing ? 'Stop screen share' : 'Share screen'}
          >
            <Ionicons name={isScreenSharing ? 'stop-circle' : 'tv'} size={24} color={colors.white} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]} onPress={toggleSpeaker} accessibilityLabel="Toggle speaker">
          <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={24} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={handleEndCall} accessibilityLabel="End call">
          <Ionicons name="call" size={28} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  remoteContainer: { flex: 1 },
  remoteVideo: { flex: 1 },
  remotePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingBottom: 100 },
  remoteName: { fontSize: 24, fontWeight: '600', color: colors.white, marginTop: spacing.md },
  statusText: { fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },
  mutedBadge: {
    position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
  },
  mutedText: { color: colors.white, fontSize: 12, fontWeight: '500' },
  localContainer: {
    position: 'absolute', right: spacing.md, bottom: 120,
    width: 90, height: 130, borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4,
  },
  localVideo: { flex: 1 },
  localPlaceholder: { backgroundColor: '#2d2d4e', justifyContent: 'center', alignItems: 'center' },
  durationContainer: {
    position: 'absolute', top: 48, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full,
  },
  durationText: { color: colors.white, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  nameContainer: { position: 'absolute', top: 80, alignSelf: 'center', alignItems: 'center' },
  nameText: { color: colors.white, fontSize: 20, fontWeight: '600' },
  connectingText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: spacing.lg, paddingBottom: 40, paddingTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  controlBtnActive: { backgroundColor: 'rgba(255,255,255,0.4)' },
  endBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center' },
});
