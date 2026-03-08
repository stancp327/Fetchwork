import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './VideoCallModal.css';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasWebRTC = !!(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);

const toUiStatus = (state, fallback = 'connecting') => {
  switch (state) {
    case 'ringing': return 'ringing';
    case 'accepted':
    case 'connecting': return 'connecting';
    case 'active': return 'active';
    // server 'connected' = answer relayed, NOT ICE connected — stay in 'connecting'
    // UI flips to 'active' only when ICE iceConnectionState reaches 'connected'
    case 'connected': return 'connecting';
    case 'declined':
    case 'missed':
    case 'ended':
    case 'canceled':
    case 'failed':
    case 'timed_out': return 'ended';
    default: return fallback;
  }
};

const VideoCallModal = ({ callId, remoteUser, type = 'video', isIncoming = false, autoAccept = false, onClose }) => {
  const socketRef = useRef(window.__fetchworkSocket);
  // Re-check socket on each render in case it connected after mount
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = window.__fetchworkSocket;
    }
  });
  const socket = socketRef.current;
  const [callStatus, setCallStatus] = useState(() => {
    if (!hasWebRTC) return 'failed';
    return isIncoming ? 'incoming' : 'ringing';
  });
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(type === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ audio: true, video: type === 'video' });
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ iceState: 'new', candidateType: '—', turnStatus: '—' });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const iceServersRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const finalizedRef = useRef(false); // guard against double-finalize from dual call:ended + call:state events

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, []);

  const collectQualityStats = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.getStats) return null;

    const stats = await pc.getStats();
    let selectedPair = null;
    let localCandidate = null;
    const inboundVideo = [];

    stats.forEach((report) => {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
      }
      if (!selectedPair && report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
        selectedPair = report;
      }
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        inboundVideo.push(report);
      }
    });

    if (selectedPair?.localCandidateId) {
      localCandidate = stats.get(selectedPair.localCandidateId);
    }

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined);

    const jitters = inboundVideo
      .map((r) => (typeof r.jitter === 'number' ? r.jitter * 1000 : undefined))
      .filter((v) => typeof v === 'number');

    const losses = inboundVideo
      .map((r) => {
        const lost = Number(r.packetsLost || 0);
        const recv = Number(r.packetsReceived || 0);
        const total = lost + recv;
        return total > 0 ? (lost / total) * 100 : undefined;
      })
      .filter((v) => typeof v === 'number');

    const freezeMax = inboundVideo
      .map((r) => Number(r.totalFreezesDuration || 0) * 1000)
      .filter((v) => Number.isFinite(v));

    return {
      avgRttMs: typeof selectedPair?.currentRoundTripTime === 'number'
        ? selectedPair.currentRoundTripTime * 1000
        : undefined,
      avgJitterMs: avg(jitters),
      avgPacketLossPct: avg(losses),
      maxFreezeMs: freezeMax.length ? Math.max(...freezeMax) : undefined,
      iceSelectedCandidateType: localCandidate?.candidateType,
      audioFallbackUsed: type === 'audio',
    };
  }, [type]);

  const uploadQualitySummary = useCallback(async () => {
    try {
      const summary = await collectQualityStats();
      if (!summary) return;
      await apiRequest(`/api/calls/${callId}/quality`, {
        method: 'POST',
        body: JSON.stringify(summary),
      });
    } catch (err) {
      console.warn('Quality summary upload failed:', err?.message || err);
    }
  }, [callId, collectQualityStats]);

  const finalizeAndClose = useCallback(async (nextStatus = 'ended') => {
    // Guard: server emits both call:state AND call:ended on reject/end — prevent double teardown
    if (finalizedRef.current) {
      console.log('[Call] finalizeAndClose called again — ignoring duplicate (dual event guard)');
      return;
    }
    finalizedRef.current = true;
    setCallStatus(nextStatus);
    cleanup();
    uploadQualitySummary().catch(() => {});
    setTimeout(() => onClose?.(), 800);
  }, [cleanup, onClose, uploadQualitySummary]);

  const getIceServers = useCallback(async () => {
    if (iceServersRef.current) return iceServersRef.current;

    try {
      const data = await apiRequest(`/api/calls/${callId}/relay-credentials`, { method: 'POST' });
      if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
        const hasTurn = data.iceServers.some(s =>
          (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => u?.startsWith('turn:') || u?.startsWith('turns:'))
        );
        if (!hasTurn) {
          console.warn('[WebRTC] Server returned ICE config with no TURN servers — calls will fail on mobile carrier NAT');
        } else {
          console.log('[WebRTC] TURN credentials received ✓');
        }
        iceServersRef.current = data.iceServers;
        return data.iceServers;
      }
    } catch (err) {
      console.warn('[WebRTC] TURN credential fetch failed — falling back to STUN-only (will fail on mobile data):', err?.message || err);
    }

    iceServersRef.current = FALLBACK_ICE_SERVERS;
    return FALLBACK_ICE_SERVERS;
  }, [callId]);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    const dynamicIceServers = await getIceServers();
    // Debug: set localStorage.debug_turn_relay=1 in browser console to force relay-only (Q7 diagnostic)
    const forceRelay = localStorage.getItem('debug_turn_relay') === '1';
    if (forceRelay) console.warn('[WebRTC] debug_turn_relay=1: using iceTransportPolicy:relay (TURN-only mode)');
    console.log('[WebRTC] Creating PC with ICE servers:', JSON.stringify(dynamicIceServers));
    const pc = new RTCPeerConnection({
      iceServers: dynamicIceServers,
      ...(forceRelay && { iceTransportPolicy: 'relay' }),
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const t = e.candidate.type || 'unknown';
        const proto = e.candidate.protocol || '?';
        console.log(`[WebRTC] ICE candidate gathered: ${t} (${proto}) — ${e.candidate.candidate?.split(' ')[4] || ''}`);
        if (socket) {
          socket.emit('call:ice-candidate', {
            callId,
            targetUserId: remoteUser._id,
            candidate: e.candidate,
          });
        }
      } else {
        console.log('[WebRTC] ICE gathering complete (null candidate = end-of-candidates)');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state: ${pc.iceGatheringState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        console.log('[WebRTC] ✅ Peer connection established!');
      }
    };

    pc.onicecandidateerror = (e) => {
      console.warn(`[WebRTC] ICE candidate error: code=${e.errorCode} url=${e.url} text="${e.errorText}"`);
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[WebRTC] ICE state: ${state}`);

      // Set call active only when ICE actually confirms connectivity
      if (state === 'connected' || state === 'completed') {
        setCallStatus('active');
        if (!durationIntervalRef.current) {
          durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      }

      if (state === 'failed') {
        // Try ICE restart before giving up
        if (typeof pc.restartIce === 'function') {
          console.log('[WebRTC] ICE failed — attempting restart...');
          pc.restartIce();
        } else {
          handleEndCall();
        }
      } else if (state === 'disconnected') {
        // Give 5s grace period — brief network blip shouldn't end the call
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            console.warn('[WebRTC] ICE still disconnected after 5s — ending call');
            handleEndCall();
          }
        }, 5000);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [callId, remoteUser._id, socket, getIceServers]);

  // Get local media
  const getLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('Failed to get media:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Camera/microphone permission denied. Please allow access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera or microphone found. Please connect a device and try again.');
      }
      setCallStatus('failed');
      return null;
    }
  }, [type]);

  // Start call (caller side)
  const startCall = useCallback(async () => {
    const stream = await getLocalMedia();
    if (!stream) return;

    const pc = await createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('call:offer', {
      callId,
      targetUserId: remoteUser._id,
      offer: pc.localDescription,
    });
  }, [callId, createPeerConnection, getLocalMedia, remoteUser._id, socket]);

  // Accept call (recipient side)
  const acceptCall = useCallback(async () => {
    socket.emit('call:accept', { callId });
    setCallStatus('connecting');

    const stream = await getLocalMedia();
    if (!stream) return;

    const pc = await createPeerConnection();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    if (pendingOfferRef.current) {
      const { fromUserId, offer } = pendingOfferRef.current;
      pendingOfferRef.current = null;
      try {
        console.log('[WebRTC] acceptCall: setting remote description from pending offer');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Flush ICE candidates queued before remoteDescription was set
        const queued = [...pendingIceCandidatesRef.current];
        pendingIceCandidatesRef.current = [];
        for (const c of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
          catch (e) { console.warn('[WebRTC] Queued ICE candidate error after setRemoteDescription:', e); }
        }
        console.log('[WebRTC] acceptCall: creating answer');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] acceptCall: sending answer — waiting for ICE to confirm connectivity');
        socket.emit('call:answer', {
          callId,
          targetUserId: fromUserId,
          answer: pc.localDescription,
        });
        // callStatus stays 'connecting' — flips to 'active' via oniceconnectionstatechange
      } catch (err) {
        console.error('[WebRTC] acceptCall: failed to process offer/create answer:', err);
      }
    }
    // Note: ICE candidates that arrived before the offer are flushed above after setRemoteDescription.
    // Candidates that arrive after will be added live via handleIceCandidate (which now guards on remoteDescription).
  }, [callId, createPeerConnection, getLocalMedia, socket]);

  // Handle incoming offer
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async (detail) => {
      // Fix: filter stale events from other call instances
      if (detail?.callId && detail.callId !== callId) return;
      const { fromUserId, offer } = detail || {};
      if (!pcRef.current) {
        pendingOfferRef.current = { fromUserId, offer };
        return;
      }
      // Guard: only process offer if PC is in a state that can accept a remote offer
      const sigState = pcRef.current.signalingState;
      if (sigState !== 'stable' && sigState !== 'have-local-offer') {
        console.warn('[WebRTC] handleOffer: ignoring offer in signalingState:', sigState);
        return;
      }
      try {
        console.log('[WebRTC] handleOffer: setting remote description');
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        // Flush any ICE candidates that arrived before remoteDescription was set
        const queued = [...pendingIceCandidatesRef.current];
        pendingIceCandidatesRef.current = [];
        for (const c of queued) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); }
          catch (e) { console.warn('[WebRTC] Queued ICE flush error:', e); }
        }
        console.log('[WebRTC] handleOffer: creating answer');
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        console.log('[WebRTC] handleOffer: sending answer — waiting for ICE to confirm connectivity');
        socket.emit('call:answer', {
          callId,
          targetUserId: fromUserId,
          answer: pcRef.current.localDescription,
        });
        // callStatus stays 'connecting' — flips to 'active' via oniceconnectionstatechange
      } catch (err) {
        console.error('[WebRTC] handleOffer: failed:', err);
      }
    };

    const handleAnswer = async (detail) => {
      if (detail?.callId && detail.callId !== callId) return;
      if (!pcRef.current) return;
      // Guard: only apply answer if PC is awaiting one
      if (pcRef.current.signalingState !== 'have-local-offer') {
        console.warn('[WebRTC] handleAnswer: ignoring answer in signalingState:', pcRef.current.signalingState);
        return;
      }
      try {
        console.log('[WebRTC] handleAnswer: setting remote description');
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(detail?.answer ?? detail));
        console.log('[WebRTC] handleAnswer: remote description set — ICE checks beginning, waiting for connected');
        // callStatus stays 'connecting' — flips to 'active' via oniceconnectionstatechange
      } catch (err) {
        console.error('[WebRTC] handleAnswer: failed:', err);
      }
    };

    const handleIceCandidate = async (detail) => {
      if (detail?.callId && detail.callId !== callId) return;
      const { candidate } = detail || {};
      // Fix: queue if PC doesn't exist OR if remoteDescription not yet set
      // Adding ICE candidates before setRemoteDescription throws and discards them forever
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] ICE candidate error:', err);
      }
    };

    const handleCallEnded = async (detail) => {
      if (detail?.callId && detail.callId !== callId) return;
      await finalizeAndClose('ended');
    };

    const handleMediaToggle = (detail) => {
      if (detail?.callId && detail.callId !== callId) return;
      const { kind, enabled } = detail || {};
      setRemoteMediaState(prev => ({ ...prev, [kind]: enabled }));
    };

    const handleCallState = (detail = {}) => {
      if (detail?.callId && detail.callId !== callId) return;
      const { state } = detail;
      const next = toUiStatus(state, 'connecting');
      if (next === 'ended') {
        finalizeAndClose('ended').catch(() => {});
        return;
      }
      setCallStatus(next);
    };

    const wrapOffer = (e) => handleOffer(e.detail);
    const wrapAnswer = (e) => handleAnswer(e.detail);
    const wrapIce = (e) => handleIceCandidate(e.detail);
    const wrapEnded = (e) => handleCallEnded(e.detail);
    const wrapMedia = (e) => handleMediaToggle(e.detail);
    const wrapState = (e) => handleCallState(e.detail);

    window.addEventListener('socket:call:offer', wrapOffer);
    window.addEventListener('socket:call:answer', wrapAnswer);
    window.addEventListener('socket:call:ice-candidate', wrapIce);
    window.addEventListener('socket:call:ended', wrapEnded);
    window.addEventListener('socket:call:media-toggle', wrapMedia);
    window.addEventListener('socket:call:state', wrapState);

    return () => {
      window.removeEventListener('socket:call:offer', wrapOffer);
      window.removeEventListener('socket:call:answer', wrapAnswer);
      window.removeEventListener('socket:call:ice-candidate', wrapIce);
      window.removeEventListener('socket:call:ended', wrapEnded);
      window.removeEventListener('socket:call:media-toggle', wrapMedia);
      window.removeEventListener('socket:call:state', wrapState);
    };
  }, [socket, callId, finalizeAndClose]);

  // Auto-accept for callee when overlay already confirmed acceptance
  // Runs AFTER socket handlers useEffect (defined above) so socket:call:offer
  // listener is guaranteed registered before call:accept is emitted to server.
  const hasAutoAcceptedRef = useRef(false);
  useEffect(() => {
    if (autoAccept && isIncoming && callStatus === 'incoming' && !hasAutoAcceptedRef.current) {
      hasAutoAcceptedRef.current = true;
      acceptCall();
    }
  // acceptCall is stable (useCallback); callStatus triggers once on 'incoming'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept, isIncoming, callStatus]);

  // Auto-start for caller — fire on 'connecting' NOT 'ringing'
  // Rationale: sending the offer on 'ringing' creates a race condition where the offer
  // arrives before the callee's VideoCallModal is mounted (callee is still on IncomingCallOverlay).
  // The window event fires with no listener, the offer is lost, and no answer is ever sent.
  // By waiting for 'connecting' (triggered when server confirms callee accepted via call:state),
  // the callee's modal is guaranteed to be mounted and listening for the offer.
  const hasStartedCallRef = useRef(false);
  useEffect(() => {
    if (!isIncoming && callStatus === 'connecting' && !hasStartedCallRef.current) {
      hasStartedCallRef.current = true;
      startCall();
    }
  }, [isIncoming, callStatus, startCall]);

  // Safety: always release camera/mic when modal unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Safety timeout: if call never connects, auto-end and release devices
  useEffect(() => {
    if (!['ringing', 'connecting', 'incoming'].includes(callStatus)) return undefined;
    const t = setTimeout(() => {
      socket?.emit('call:end', { callId });
      finalizeAndClose('ended').catch(() => {});
    }, 30000);
    return () => clearTimeout(t);
  }, [callStatus, callId, socket, finalizeAndClose]);

  // Debug panel: poll getStats() every 5s when active and panel is open
  useEffect(() => {
    if (callStatus !== 'active' || !showDebugPanel) return undefined;
    const poll = async () => {
      const pc = pcRef.current;
      if (!pc?.getStats) return;
      try {
        const stats = await pc.getStats();
        let selectedPair = null;
        let localCand = null;
        stats.forEach((report) => {
          if (report.type === 'transport' && report.selectedCandidatePairId) {
            selectedPair = stats.get(report.selectedCandidatePairId) || selectedPair;
          }
          if (!selectedPair && report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
            selectedPair = report;
          }
        });
        if (selectedPair?.localCandidateId) {
          localCand = stats.get(selectedPair.localCandidateId);
        }
        const cType = localCand?.candidateType || '—';
        const turnActive = cType === 'relay';
        setDebugInfo({
          iceState: pc.iceConnectionState || 'unknown',
          candidateType: cType,
          turnStatus: turnActive ? 'relay (TURN active)' : cType === '—' ? '—' : `${cType} (no TURN)`,
        });
      } catch { /* ignore stats errors */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [callStatus, showDebugPanel]);

  const handleEndCall = useCallback(async () => {
    socket?.emit('call:end', { callId });
    await finalizeAndClose('ended');
  }, [socket, callId, finalizeAndClose]);

  const handleReject = useCallback(() => {
    socket?.emit('call:reject', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, cleanup, onClose]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      socket?.emit('call:media-toggle', { callId, targetUserId: remoteUser._id, kind: 'audio', enabled: audioTrack.enabled });
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
      socket?.emit('call:media-toggle', { callId, targetUserId: remoteUser._id, kind: 'video', enabled: videoTrack.enabled });
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen share failed:', err);
      }
    }
  };

  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="videocall-overlay">
      <div className={`videocall-modal ${callStatus}`}>
        {/* Remote video (full) */}
        <div className="videocall-remote">
          <video ref={remoteVideoRef} autoPlay playsInline className="videocall-remote-video" />
          {(!remoteMediaState.video || callStatus !== 'active') && (
            <div className="videocall-remote-placeholder">
              <div className="videocall-avatar">
                {remoteUser.profileImage
                  ? <img src={remoteUser.profileImage} alt="" />
                  : <span>{remoteUser.firstName?.[0]}{remoteUser.lastName?.[0]}</span>
                }
              </div>
              <div className="videocall-remote-name">{remoteUser.firstName} {remoteUser.lastName}</div>
              {callStatus === 'ringing' && <div className="videocall-status">Ringing…</div>}
              {callStatus === 'connecting' && <div className="videocall-status">Connecting…</div>}
              {callStatus === 'incoming' && <div className="videocall-status">Incoming {type} call…</div>}
              {callStatus === 'ended' && <div className="videocall-status">Call ended</div>}
              {callStatus === 'failed' && <div className="videocall-status">{!hasWebRTC ? 'Video calls not supported in this browser' : 'Call failed — check camera/mic permissions'}</div>}
            </div>
          )}
          {!remoteMediaState.audio && callStatus === 'active' && (
            <div className="videocall-muted-badge">🔇 Muted</div>
          )}
        </div>

        {/* Local video (picture-in-picture) */}
        {type === 'video' && (
          <div className="videocall-local">
            <video ref={localVideoRef} autoPlay playsInline muted className="videocall-local-video" />
            {isCameraOff && <div className="videocall-local-off">Camera off</div>}
          </div>
        )}

        {/* Duration */}
        {callStatus === 'active' && (
          <div className="videocall-duration">{formatDuration(duration)}</div>
        )}

        {/* Connection Info debug panel */}
        {callStatus === 'active' && (
          <>
            <button
              className="videocall-debug-toggle"
              onClick={() => setShowDebugPanel(v => !v)}
            >
              {showDebugPanel ? 'Hide' : 'Connection Info'}
            </button>
            {showDebugPanel && (
              <div className="videocall-debug-panel">
                <div><strong>ICE state:</strong> {debugInfo.iceState}</div>
                <div><strong>Candidate:</strong> {debugInfo.candidateType}</div>
                <div><strong>TURN:</strong> {debugInfo.turnStatus}</div>
              </div>
            )}
          </>
        )}

        {/* Controls */}
        <div className="videocall-controls">
          {callStatus === 'incoming' ? (
            <>
              <button className="videocall-btn accept" onClick={acceptCall} title="Accept">
                📞
              </button>
              <button className="videocall-btn reject" onClick={handleReject} title="Decline">
                ❌
              </button>
            </>
          ) : (
            <>
              <button className={`videocall-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? '🔇' : '🎤'}
              </button>
              {type === 'video' && (
                <button className={`videocall-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Camera on' : 'Camera off'}>
                  {isCameraOff ? '📷' : '🎥'}
                </button>
              )}
              {type === 'video' && callStatus === 'active' && !isMobile && navigator.mediaDevices?.getDisplayMedia && (
                <button className={`videocall-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} title="Screen share">
                  🖥️
                </button>
              )}
              <button className="videocall-btn end" onClick={handleEndCall} title="End call">
                📵
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
