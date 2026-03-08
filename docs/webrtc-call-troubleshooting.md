# WebRTC Video Call Troubleshooting Guide

_Written 2026-03-08 after fixing persistent call failures in Fetchwork._
_Calls were silently ending without connecting for weeks. These are the exact root causes and fixes._

---

## Architecture Overview

- `IncomingCallOverlay.js` — global component mounted in App.js; shows incoming call toast; mounts VideoCallModal when accepted
- `VideoCallModal.js` — WebRTC peer connection, ICE negotiation, offer/answer exchange
- `server/socket/events.js` — server-side call signaling via socket.io
- Window event bus (`socket:call:*`) — socket dispatches call events as CustomEvents so any component can listen
- TURN server: `turn.fetchwork.net:3478` (coturn, self-hosted at 45.32.73.196)

---

## Bug 1: ICE Candidates Applied Before `setRemoteDescription` ⚠️ PRIMARY BUG

**Symptom:** ICE never reaches `checking` state. Calls appear to start (offer/answer logged) but always time out. No `ICE state: connected` ever logged.

**Root cause:** `handleIceCandidate()` only queued candidates when `pcRef.current` was null. But if a PC existed without `remoteDescription` set yet, `addIceCandidate()` was called too early — it throws `InvalidStateError` and the candidate is **permanently discarded**.

```js
// BROKEN — addIceCandidate() throws if remoteDescription not set
const handleIceCandidate = async ({ candidate }) => {
  if (!pcRef.current) {               // ← only queues if no PC
    pendingIceCandidatesRef.current.push(candidate);
    return;
  }
  await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); // 💥 throws if no remoteDescription
};
```

**Fix:** Queue if PC has no remote description yet. Flush the queue *immediately after* `setRemoteDescription()` succeeds — in both `handleOffer` and `acceptCall`.

```js
// FIXED
const handleIceCandidate = async ({ candidate }) => {
  if (!pcRef.current || !pcRef.current.remoteDescription) {  // ← also check remoteDescription
    pendingIceCandidatesRef.current.push(candidate);
    return;
  }
  await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
};

// In handleOffer and acceptCall, after setRemoteDescription():
const queued = [...pendingIceCandidatesRef.current];
pendingIceCandidatesRef.current = [];
for (const c of queued) {
  try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
  catch (e) { console.warn('Queued ICE flush error:', e); }
}
```

---

## Bug 2: `call:accept` Emitted Before VideoCallModal Mounts

**Symptom:** Calls end immediately. No offer is ever processed by callee. `finalizeAndClose` fires after 30s timeout.

**Root cause:** `IncomingCallOverlay.acceptCall()` emitted `call:accept` to the server *before* mounting VideoCallModal. The server immediately notified the caller, who ran `startCall()` and sent the WebRTC offer. The offer arrived via `socket:call:offer` CustomEvent — but VideoCallModal wasn't mounted yet, so no listener was registered. **Offer silently dropped.**

**Fix:** Move `call:accept` emission into VideoCallModal via `autoAccept` prop. The prop triggers a `useEffect` that runs *after* mount (and after socket handlers are registered).

```js
// IncomingCallOverlay — no longer emits call:accept
const acceptCall = () => {
  setActiveCall({ callId, remoteUser, type, isIncoming: true, autoAccept: true });
  setIncomingCall(null);
};

// VideoCallModal — auto-accepts after mount
const hasAutoAcceptedRef = useRef(false);
useEffect(() => {
  if (autoAccept && isIncoming && callStatus === 'incoming' && !hasAutoAcceptedRef.current) {
    hasAutoAcceptedRef.current = true;
    acceptCall(); // emits call:accept, gets media, creates PC
  }
}, [autoAccept, isIncoming, callStatus]);
```

**Why this works:** React `useEffect` runs after the component's DOM is committed and all other effects have run. By the time `acceptCall()` emits `call:accept`, the `socket:call:offer` listener is already registered.

---

## Bug 3: Offer Sent on `ringing` Before Callee Modal Was Mounted

**Symptom:** Same as Bug 2 — offer arrives before listener exists.

**Root cause:** Caller's `startCall()` was triggered when `callStatus === 'ringing'`. At that point, the callee is still seeing `IncomingCallOverlay` (a toast), not VideoCallModal. VideoCallModal isn't mounted yet, so no offer listener exists.

**Fix:** Trigger `startCall()` on `callStatus === 'connecting'` instead. The server only sets 'connecting' after receiving `call:accept`, which (with Bug 2 fixed) means VideoCallModal is already mounted.

```js
// FIXED
useEffect(() => {
  if (!isIncoming && callStatus === 'connecting' && !hasStartedCallRef.current) {
    hasStartedCallRef.current = true;
    startCall();
  }
}, [isIncoming, callStatus, startCall]);
```

---

## Bug 4: No `callId` Filtering on Window Event Handlers

**Symptom:** Sporadic signaling failures, especially on repeated call attempts. Previous call state bleeds into new call.

**Root cause:** All handlers (`handleOffer`, `handleAnswer`, `handleIceCandidate`, `handleCallState`, `handleCallEnded`) processed any `socket:call:*` event regardless of `callId`. Stale modals (or duplicate dispatches) consumed signals meant for a different call.

**Fix:**

```js
const handleOffer = async (detail) => {
  if (detail?.callId && detail.callId !== callId) return; // ← filter early
  // ...
};
```

Apply the same filter to all handlers.

---

## Bug 5: Silent Async Failures in Signaling Handlers

**Symptom:** Call appears to proceed but no answer is ever sent. No error in console.

**Root cause:** `handleOffer`, `handleAnswer`, and `acceptCall` were all async with no `try/catch`. Any failure in `setRemoteDescription`, `createAnswer`, or `setLocalDescription` was silently swallowed as an unhandled promise rejection.

**Fix:** Wrap all signaling handlers in try/catch with step-by-step logging:

```js
const handleOffer = async (detail) => {
  // ...
  try {
    console.log('[WebRTC] handleOffer: setting remote description');
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('[WebRTC] handleOffer: creating answer');
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    console.log('[WebRTC] handleOffer: sending answer');
    socket.emit('call:answer', { ... });
  } catch (err) {
    console.error('[WebRTC] handleOffer: failed:', err);
  }
};
```

---

## Bug 6: Duplicate Offer/Answer on Wrong `signalingState`

**Symptom:** `InvalidStateError: setRemoteDescription called in wrong state: stable` in console after calls connect.

**Root cause:** Duplicate signal delivery (from re-renders or multiple socket listeners) causes `setRemoteDescription` to be called when PC is already in `stable` state.

**Fix:** Guard with `signalingState` check before processing:

```js
const handleOffer = async (detail) => {
  const sigState = pcRef.current?.signalingState;
  if (sigState !== 'stable' && sigState !== 'have-local-offer') return;
  // ...
};

const handleAnswer = async (detail) => {
  if (pcRef.current?.signalingState !== 'have-local-offer') return;
  // ...
};
```

---

## TURN Server Setup

**Self-hosted coturn** on `45.32.73.196` (Vultr VPS).

### Key config (`/etc/turnserver.conf`)
```
listening-port=3478
tls-listening-port=5349
use-auth-secret
static-auth-secret=FetchworkTurn2026
realm=turn.fetchwork.net
total-quota=200
no-loopback-peers    # ⚠️ blocks relay-to-relay on same server — see note below
```

### Render env vars
```
TURN_URLS=turn:turn.fetchwork.net:3478?transport=udp,turn:turn.fetchwork.net:3478?transport=tcp
TURN_AUTH_SECRET=FetchworkTurn2026
TURN_TTL_SECONDS=86400
```

### Important: no-loopback-peers caveat
When BOTH peers use the same TURN server, their relay addresses both point to `45.32.73.196`. With `no-loopback-peers`, coturn blocks relay traffic back to its own IP — ICE checks between two relay allocations on the same server silently fail. This only matters if you force relay-only mode (`iceTransportPolicy: 'relay'`). In normal mode, same-LAN calls use host candidates and TURN is bypassed.

### Checking TURN auth
```bash
# Test TURN credential (generates a 1-hour credential)
node tools/test-turn-allocate.js

# View coturn logs (no log file — use journalctl)
journalctl -u coturn -n 50

# Check coturn status
systemctl status coturn
```

### TTL note
Default coturn TTL was 120s — caused mid-call credential expiry. Set `TURN_TTL_SECONDS=86400` (24h).

---

## Debugging Checklist

When calls fail to connect:

1. **Check if relay candidates are gathered:**
   Look for `[WebRTC] ICE candidate gathered: relay (udp)` in console. If missing, TURN auth is broken.

2. **Check if offer is sent and received:**
   Look for `[WebRTC] handleOffer: setting remote description` on callee's console. If missing, the offer was dropped (Bug 2/3).

3. **Check if answer is sent:**
   Look for `[WebRTC] handleOffer: sending answer` on callee's console. If missing, there's a silent failure in handleOffer (enable try/catch per Bug 5).

4. **Check ICE progression:**
   `ICE state: checking` → `ICE state: connected` → `Connection state: connected` → `✅ Peer connection established!`
   If it never reaches `checking`, ICE candidates aren't being applied (Bug 1).

5. **TURN relay debug mode:**
   Force relay-only in browser console: `localStorage.setItem('debug_turn_relay', '1')`. Remove with `localStorage.removeItem('debug_turn_relay')`. ⚠️ Don't forget to remove — relay-only + same TURN server = 403 Forbidden IP from no-loopback-peers.

6. **Hard refresh required:**
   Always `Ctrl+Shift+R` after a deploy. WebRTC JS is heavily cached.

---

## Commit History (call fixes, newest first)
- `0d608b4` — signalingState guards on offer/answer handlers
- `d34fbb4` — ICE-before-remoteDescription + callId filtering + try/catch (ChatGPT audit)
- `4f75202` — autoAccept race condition (overlay vs modal mount order)
- `1a63b74` — offer timing (ringing → connecting)
- `c795209` — presence fix (isUserOnline always returned false)
- `bdefd05` — dual event teardown guard + TURN relay debug mode
- `4a3ccb3` — TURN username format simplification
- `09a2124` — TURN TTL 120s → 86400s + ICE restart on failed
