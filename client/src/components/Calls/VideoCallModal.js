import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './VideoCallModal.css';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const TURN_URLS = (process.env.REACT_APP_TURN_URLS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const ICE_SERVERS = TURN_URLS.length
  ? [
      ...STUN_SERVERS,
      {
        urls: TURN_URLS,
        username: process.env.REACT_APP_TURN_USERNAME || '',
        credential: process.env.REACT_APP_TURN_CREDENTIAL || '',
      },
    ]
  : STUN_SERVERS;

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasWebRTC = !!(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);

const toUiStatus = (state, fallback = 'connecting') => {
  switch (state) {
    case 'ringing': return 'ringing';
    case 'accepted':
    case 'connecting': return 'connecting';
    case 'connected':
    case 'active': return 'active';
    case 'declined':
    case 'missed':
    case 'ended':
    case 'canceled':
    case 'failed':
    case 'timed_out': return 'ended';
    default: return fallback;
  }
};

const VideoCallModal = ({ callId, remoteUser, type = 'video', isIncoming = false, onClose }) => {
  const socket = window.__fetchworkSocket;
  const [callStatus, setCallStatus] = useState(() => {
    if (!hasWebRTC) return 'failed';
    return isIncoming ? 'incoming' : 'ringing';
  });
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(type === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteMediaState, setRemoteMediaState] = useState({ audio: true, video: type === 'video' });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const iceServersRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);

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
        iceServersRef.current = data.iceServers;
        return data.iceServers;
      }
    } catch (err) {
      // TURN may be unavailable in some environments; safely fall back to static config.
      console.warn('Using fallback ICE servers:', err?.message || err);
    }

    iceServersRef.current = ICE_SERVERS;
    return ICE_SERVERS;
  }, [callId]);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    const dynamicIceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers: dynamicIceServers });

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('call:ice-candidate', {
          callId,
          targetUserId: remoteUser._id,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handleEndCall();
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
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', {
        callId,
        targetUserId: fromUserId,
        answer: pc.localDescription,
      });
      setCallStatus('active');
      if (!durationIntervalRef.current) {
        durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
    }

    if (pendingIceCandidatesRef.current.length > 0) {
      const queued = [...pendingIceCandidatesRef.current];
      pendingIceCandidatesRef.current = [];
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          console.error('Queued ICE candidate error:', err);
        }
      }
    }
  }, [callId, createPeerConnection, getLocalMedia, socket]);

  // Handle incoming offer
  useEffect(() => {
    if (!socket) return;

    const handleOffer = async ({ fromUserId, offer }) => {
      if (!pcRef.current) {
        pendingOfferRef.current = { fromUserId, offer };
        return;
      }
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('call:answer', {
        callId,
        targetUserId: fromUserId,
        answer: pcRef.current.localDescription,
      });
      setCallStatus('active');
      durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    };

    const handleAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus('active');
      durationIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!pcRef.current) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    };

    const handleCallEnded = async () => {
      await finalizeAndClose('ended');
    };

    const handleMediaToggle = ({ kind, enabled }) => {
      setRemoteMediaState(prev => ({ ...prev, [kind]: enabled }));
    };

    const handleCallState = ({ state } = {}) => {
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

  // Auto-start for caller
  useEffect(() => {
    if (!isIncoming && callStatus === 'ringing') {
      startCall();
    }
  }, [isIncoming, callStatus, startCall]);

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
      // Stop screen sharing, restore camera
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
