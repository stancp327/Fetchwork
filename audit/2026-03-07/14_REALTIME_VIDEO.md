# 14_REALTIME_VIDEO.md — WebRTC Video Call Audit
**Auditor:** SCOUT-VIDEO  
**Date:** 2026-03-07  
**Repo:** C:\Users\stanc\Fetchwork  
**Symptom:** Calls can be initiated, accepted, declined, and ended via UI — but audio/video NEVER streams. Cross-NAT test (mobile device + laptop on separate networks).

---

## Summary

**Root cause confirmed: NO TURN SERVER IS CONFIGURED.**

The server has full TURN credential-generation logic in `server/routes/calls.js` but the required environment variables (`TURN_AUTH_SECRET`, `TURN_URLS`) are absent from all env files (`.env`, `.env.example`, `.env.production.example`). When credentials cannot be issued, the server returns HTTP 503. The client silently falls back to **STUN-only** ICE servers. STUN cannot traverse cross-NAT connections (especially mobile CGNAT). ICE negotiation fails, the peer connection enters `failed` state, and the call is torn down.

**Secondary issue:** The mobile native app (`mobile/`) has **zero WebRTC capability** — `react-native-webrtc` is not installed and there is no VideoCallScreen. If the mobile tester was using the native app, that path is completely unimplemented.

**Signaling itself works correctly.** Offer/answer/ICE candidate relay via socket.io is properly implemented and authorized. The call state machine is solid. The only missing piece is a TURN relay server and its credentials in env.

---

## WebRTC Architecture Map

```
CALLER (web browser)                    SERVER (Render)                    RECIPIENT (web browser / mobile-web)
─────────────────────                   ───────────────                    ────────────────────────────────────
useSocket.js                            server/index.js                    useSocket.js
  └─ socket.io-client ────connect──────► io.use() JWT auth ◄──connect──── socket.io-client
                                         socket/events.js

VideoCallModal.js (caller)              socket/events.js                   IncomingCallOverlay.js
  ├─ POST /api/calls/:id/relay-creds ──► server/routes/calls.js            VideoCallModal.js (recipient)
  │   (gets ICE server list)            (returns 503 if no TURN env vars)
  │
  ├─ RTCPeerConnection({ iceServers })   ← uses FALLBACK (STUN-only) when 503
  ├─ getUserMedia()
  ├─ addTrack(stream tracks)
  ├─ createOffer()
  └─ emit call:offer ──────────────────► relayIfAuthorized() ─────────────► recipient gets call:offer
                                                                              └─ setRemoteDescription(offer)
                                                                              └─ createAnswer()
                                         relayIfAuthorized() ◄────────────── emit call:answer
  ├─ setRemoteDescription(answer) ◄───────────────────────────────────────────────
  │
  ├─ ICE candidates gathered (onicecandidate)
  └─ emit call:ice-candidate ──────────► relayIfAuthorized() ─────────────► addIceCandidate()
  
  ◄── ICE candidates from recipient ◄── relayIfAuthorized() ◄────────────── emit call:ice-candidate

  ⚠ ICE negotiation: STUN candidates fail to pierce cross-NAT
  → iceConnectionState → 'failed' → handleEndCall() called → call tears down
```

**Signaling transport:** Socket.io via window event bus (`window.dispatchEvent(new CustomEvent('socket:call:*', ...))`)  
**WebRTC standard:** Browser native `RTCPeerConnection` (no SDK wrapper)  
**Call records:** MongoDB (`Call` model in `server/models/Call.js`)  
**Provider field:** `Call.provider` defaults to `'p2p'` — no media server (LiveKit/Twilio/Daily/Agora) is integrated despite being listed in the enum.

---

## ICE Server Config (exact code with file:line) — ⚠️ NO TURN SERVER

### Fallback (always used in practice)
**File:** `client/src/components/Calls/VideoCallModal.js:6-9`
```js
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```
**→ STUN ONLY. NO TURN. THIS IS THE BUG.**

### Dynamic credential fetch (currently always returns 503)
**File:** `client/src/components/Calls/VideoCallModal.js:118-130`
```js
const getIceServers = useCallback(async () => {
  if (iceServersRef.current) return iceServersRef.current;
  try {
    const data = await apiRequest(`/api/calls/${callId}/relay-credentials`, { method: 'POST' });
    if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
      iceServersRef.current = data.iceServers;
      return data.iceServers;
    }
  } catch (err) {
    console.warn('Using fallback ICE servers:', err?.message || err);  // ← silent fallback
  }
  iceServersRef.current = FALLBACK_ICE_SERVERS;
  return FALLBACK_ICE_SERVERS;
}, [callId]);
```

### Server TURN credential endpoint (built, not deployed)
**File:** `server/routes/calls.js:60-88` — `POST /api/calls/:id/relay-credentials`
```js
const turnUrls = (process.env.TURN_URLS || '')
  .split(',').map((v) => v.trim()).filter(Boolean);

if (!turnUrls.length || !process.env.TURN_AUTH_SECRET) {
  return res.status(503).json({ error: 'TURN is not configured' });  // ← always hits this
}
// ... HMAC-SHA1 credential generation (RFC 5766 time-limited) — correct implementation
return res.json({
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: turnUrls, username, credential },  // ← never reached
  ],
  ttlSeconds, expiresAt,
});
```

### RTCPeerConnection creation
**File:** `client/src/components/Calls/VideoCallModal.js:137-163`
```js
const createPeerConnection = useCallback(async () => {
  const dynamicIceServers = await getIceServers();  // returns FALLBACK when 503
  const pc = new RTCPeerConnection({ iceServers: dynamicIceServers });
  ...
```

### Missing env vars (confirmed absent)
| Variable | `.env` | `.env.example` | `.env.production.example` |
|---|---|---|---|
| `TURN_AUTH_SECRET` | ❌ absent | ❌ absent | ❌ absent |
| `TURN_URLS` | ❌ absent | ❌ absent | ❌ absent |
| `TURN_TTL_SECONDS` | ❌ absent | ❌ absent | ❌ absent |

---

## Socket Events Map (all call-related events)

**File:** `server/socket/events.js` + `client/src/socket/useSocket.js`

### Client → Server (emitted by client)
| Event | Payload | Handler (server/socket/events.js) | Notes |
|---|---|---|---|
| `call:initiate` | `{ recipientId, type, jobId, conversationId }` | Creates Call doc, emits `call:incoming` to recipient | Rate limited: 6/min |
| `call:accept` | `{ callId }` | Validates `recipient === senderId`, transitions `ringing→accepted` | |
| `call:reject` | `{ callId }` | Validates `recipient === senderId`, transitions `→declined` | |
| `call:end` | `{ callId }` | Validates caller or recipient, transitions `→ended` | |
| `call:offer` | `{ callId, targetUserId, offer }` | `relayIfAuthorized()` → forwards to target | SDP offer |
| `call:answer` | `{ callId, targetUserId, answer }` | `relayIfAuthorized()` + transitions `→connecting→connected` | SDP answer |
| `call:ice-candidate` | `{ callId, targetUserId, candidate }` | `relayIfAuthorized()` → forwards to target | ICE trickling |
| `call:media-toggle` | `{ callId, targetUserId, kind, enabled }` | `relayIfAuthorized()` → forwards to target | mute/cam |

### Server → Client (emitted by server)
| Event | Recipient | Payload | When |
|---|---|---|---|
| `call:incoming` | recipient | `{ callId, caller, type }` | On `call:initiate` |
| `call:initiated` | caller | `{ callId, roomId, status }` | On `call:initiate` success |
| `call:accepted` | caller | `{ callId, recipient }` | On `call:accept` |
| `call:ended` | both | `{ callId, reason, duration }` | On end/reject/timeout |
| `call:state` | both | `{ callId, state, reason, version, participants }` | On any state transition |
| `call:offer` | targetUserId | `{ callId, fromUserId, offer }` | Relayed |
| `call:answer` | targetUserId | `{ callId, fromUserId, answer }` | Relayed |
| `call:ice-candidate` | targetUserId | `{ callId, fromUserId, candidate }` | Relayed |
| `call:media-toggle` | targetUserId | `{ callId, fromUserId, kind, enabled }` | Relayed |
| `call:rate-limit` | caller | `{ action }` | Rate limit hit |
| `call:error` | requester | `{ message }` | Error cases |

### Authorization on signaling relay
**File:** `server/socket/events.js` — `relayIfAuthorized()` function
```js
const relayIfAuthorized = async (callId, targetUserId, eventName, payload) => {
  const call = await Call.findById(callId).select('caller recipient status').lean();
  if (!call) return;
  const isParticipant = call.caller.toString() === senderId || call.recipient.toString() === senderId;
  const targetIsParticipant = call.caller.toString() === targetUserId || call.recipient.toString() === targetUserId;
  if (!isParticipant || !targetIsParticipant) return;  // drops unauthorized relays
  if (['ending','ended','declined','missed','failed','timed_out','canceled','fraud_blocked'].includes(call.status)) return;
  io.to(targetUserId).emit(eventName, payload);
};
```
✅ Authorization is correct — both sender and target must be call participants, and terminal state drops relay.

### Client event bus (window events)
**File:** `client/src/socket/useSocket.js:74-78`
```js
if (event.startsWith('call:')) {
  window.dispatchEvent(new CustomEvent(`socket:${event}`, { detail: data }));
}
```
All `call:*` events are re-dispatched as `socket:call:*` window events. `VideoCallModal` listens via `window.addEventListener('socket:call:offer', ...)` etc. This indirection works but adds one hop — relevant for debugging.

---

## Call State Flow

```
created ──► ringing ──► accepted ──► connecting ──► connected ──► ending ──► ended
              │            │                              │
              ├──► declined (recipient rejected)          └──► failed
              ├──► missed   (30s timeout / offline)
              ├──► canceled
              └──► timed_out

Legacy aliases: active = connected, rejected = declined
```

**File:** `server/services/callStateMachine.js` — `transitionCall()` + `ALLOWED` map  
**Timeout:** 30 seconds (server-side `setTimeout` in `call:initiate` handler, `server/socket/events.js`)  
**Duration tracking:** `call.startedAt` set on `→connected`, `call.duration` computed on terminal transition  
**Timeline messages:** System messages written to the conversation on initiate/accept/end  

### getUserMedia call sites
**File:** `client/src/components/Calls/VideoCallModal.js:165-183` — `getLocalMedia()`
```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
});
```
Called from:
- `startCall()` (caller, line ~187) — BEFORE `createOffer()` ✅
- `acceptCall()` (recipient, line ~205) — BEFORE setting remote description ✅

### Track ordering (correct)
**File:** `client/src/components/Calls/VideoCallModal.js` — `startCall()`:
```js
stream.getTracks().forEach(track => pc.addTrack(track, stream));  // tracks added first
const offer = await pc.createOffer();                              // then offer created ✅
```

### ontrack (receiver)
**File:** `client/src/components/Calls/VideoCallModal.js:147-151`
```js
pc.ontrack = (e) => {
  if (remoteVideoRef.current && e.streams[0]) {
    remoteVideoRef.current.srcObject = e.streams[0];  // ✅ correct
  }
};
```

### ICE connection state (minimal logging)
**File:** `client/src/components/Calls/VideoCallModal.js:153-157`
```js
pc.oniceconnectionstatechange = () => {
  if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
    handleEndCall();  // ⚠ correct action, but NO logging of intermediate states
  }
};
```
**Gap:** No logging of `checking`, `connected`, `completed` states. In STUN-fail scenario, state goes `checking → failed` silently. No console output reveals this to developers.

---

## Mobile Implementation Status

### ❌ react-native-webrtc: NOT INSTALLED

**File:** `mobile/package.json` — full dependency scan:
```json
// react-native-webrtc is ABSENT from both dependencies and devDependencies
```
Present packages (relevant): `socket.io-client: ^4.8.1`, `expo: ~52.0.0`, `react-native: 0.76.9`  
**No WebRTC package of any kind.**

### ❌ No VideoCallScreen
Scanned all files under `mobile/src/screens/`:
```
Auth/     ForgotPassword, Login, Register, Welcome
Bookings/ BookingDetail, BookingList, GroupSlots
Jobs/     Browse, Detail, MyJobs, Post
Messages/ ConversationList, MessageThread    ← closest; no call UI
Profile/  Contracts, Discovery, Earnings, EditProfile, MyProfile, Payments, Settings, TeamDetail, Teams, Verification, Wallet
Services/ AvailabilityManager, Browse, MyBundles, MyServices, ServiceDetail
Skills/   SkillAssessment
```
**No `VideoCallScreen`, `CallScreen`, or any WebRTC-related screen exists.**

### Mobile socket: connected but call events not handled
**File:** `mobile/src/api/socket.ts` — socket connects with JWT auth, but no `call:incoming` listener exists. Mobile users cannot receive call notifications in the native app.

### What the mobile tester likely hit
If the test used the **native Expo app**: Call UI doesn't exist. The test would have been entirely on the web app loaded in a mobile browser (Safari/Chrome), hitting the same STUN-only failure as the desktop.

---

## Root Cause Analysis

### Primary: No TURN Server → ICE Failure in Cross-NAT Scenario

**Why STUN fails cross-NAT:**
- STUN (`stun:stun.l.google.com:19302`) only reveals a device's public IP/port. It works if at least one peer is behind a full-cone NAT.
- Mobile networks (LTE/5G) use **Carrier-Grade NAT (CGNAT)** — symmetric NAT. STUN candidates gathered are unreachable by the other peer.
- A home laptop is typically behind a residential router — also NAT.
- Result: neither side can reach the other's STUN-derived candidates → ICE enters `failed` state.

**Failure chain:**
```
1. Call initiated → call:offer sent ✅
2. getIceServers() → POST /api/calls/:id/relay-credentials → 503 (TURN not configured) ✅
3. Client falls back to FALLBACK_ICE_SERVERS (2x Google STUN) ✅
4. RTCPeerConnection created with STUN-only ✅
5. ICE gathering: host + srflx candidates gathered ✅
6. ICE candidates exchanged via socket.io ✅
7. ICE connectivity checks: all candidate pairs fail (cross-NAT blocks traffic) ❌
8. iceConnectionState → 'failed' ❌
9. handleEndCall() called → call:end emitted → call tears down ❌
10. UI shows "connecting..." then ends — audio/video never flows ❌
```

**Evidence the signaling worked:** Call accept/reject/end functioning proves socket.io signaling is healthy. Only the media path (which needs TURN) fails.

### Secondary: Mobile Native App Has No Video Call Capability

`react-native-webrtc` is not installed. There is no VideoCallScreen. If Fetchwork intends mobile-native video calling, the entire feature needs to be built from scratch on mobile.

### Minor: Double `call:accept` Emission

`IncomingCallOverlay.js` emits `call:accept` when user clicks Accept in the toast, then `VideoCallModal.js` emits `call:accept` again when the user clicks Accept in the modal. The second emit hits `call.status !== 'ringing'` on the server and returns `call:error` (silently ignored by the client). This is a UX awkwardness but not blocking — WebRTC setup proceeds after the second click regardless. The signaling flow still works.

### Minor: No ICE State Logging

No console logging for `checking`, `connected`, `completed`, `disconnected`, `failed` ICE states. When debugging, developers cannot distinguish "never negotiated" from "negotiated but dropped" from server logs or browser console.

---

## Fix Plan

### Option 1 — Self-Hosted Coturn (Cheapest, Most Control)

**What:** Deploy [Coturn](https://github.com/coturn/coturn) open-source TURN server on a VPS.

**Cost:** ~$5-10/mo (DigitalOcean/Vultr/Hetzner 1-2GB VPS). No per-minute pricing.

**Implementation:**
1. Spin up a VPS (e.g., Hetzner CX11 at €3.29/mo). Must have a **public static IP**.
2. Install Coturn:
   ```bash
   apt install coturn
   ```
3. Configure `/etc/turnserver.conf`:
   ```
   listening-port=3478
   tls-listening-port=5349
   listening-ip=0.0.0.0
   external-ip=<YOUR_PUBLIC_IP>
   realm=fetchwork.net
   use-auth-secret
   static-auth-secret=<RANDOM_64_CHAR_SECRET>
   log-file=/var/log/coturn.log
   no-multicast-peers
   ```
4. Open firewall: TCP/UDP 3478, TCP/UDP 5349, UDP 49152-65535.
5. Set server env vars:
   ```
   TURN_AUTH_SECRET=<same secret as above>
   TURN_URLS=turn:<YOUR_PUBLIC_IP>:3478,turn:<YOUR_PUBLIC_IP>:5349?transport=tcp
   TURN_TTL_SECONDS=120
   ```
6. Add to `.env.production.example` and redeploy Render service.

**Result:** `/api/calls/:id/relay-credentials` starts returning real ICE servers. `getIceServers()` succeeds. TURN relay candidate allows cross-NAT media flow.

**Time to implement:** 2-4 hours.

---

### Option 2 — Twilio Network Traversal Service (NTS)

**What:** Twilio managed TURN. Pay-per-use.

**Cost:** ~$0.40/GB relayed (free tier: 500 MB/mo). A 10-min HD video call ≈ 150MB. Viable for low volume.

**Implementation:**
1. Create Twilio account, enable NTS.
2. Generate Time-Limited NTS credentials via Twilio API client-side or server-side.
3. Replace or augment the current `relay-credentials` endpoint to call Twilio NTS API.
4. Return Twilio ICE servers in same format.

**Docs:** https://www.twilio.com/docs/stun-turn

**Time to implement:** 1-2 hours.

---

### Option 3 — Metered TURN (Simplest, Freemium)

**What:** [Metered.ca](https://www.metered.ca/) managed TURN with 50 GB/mo free.

**Cost:** Free up to 50 GB/mo; $0.40/GB after.

**Implementation:**
1. Sign up at metered.ca, get TURN credentials.
2. Set env vars:
   ```
   TURN_AUTH_SECRET=<metered secret>
   TURN_URLS=turn:relay1.expressturn.com:3478,turns:relay1.expressturn.com:443?transport=tcp
   TURN_TTL_SECONDS=86400
   ```
   (Or use static credentials for their managed service instead of HMAC.)

**Time to implement:** 30 minutes.

---

### Option 4 — Move to a Managed WebRTC Platform (Architectural upgrade)

The `Call.provider` field already enumerates `'livekit' | 'twilio' | 'daily' | 'agora'`. For production scale, self-managing WebRTC is painful.

**Recommended: LiveKit** (self-hostable or cloud, open source)
- Handles TURN, SFU, recording, multiparty
- ~$25/mo hosted, or free self-hosted
- React SDK + React Native SDK available (solves mobile problem simultaneously)

**Time to implement:** 3-7 days (architectural change; rewrites VideoCallModal and socket events).

---

### Minimum Viable Fix (Coturn or Metered in 1-4 hours)

```
Priority  Action                                              File(s) to touch
─────────────────────────────────────────────────────────────────────────────
P0        Deploy TURN server (Coturn or Metered)             server/.env / Render env vars
P0        Set TURN_AUTH_SECRET + TURN_URLS + TURN_TTL_SECONDS  Render dashboard
P0        Add TURN vars to .env.example + .env.production.example  server/.env.*
──────────────────────────────────────────────────────────────────────────────
P1        Add ICE state change logging in VideoCallModal      client/src/components/Calls/VideoCallModal.js:153
P1        Fix double call:accept (have IncomingCallOverlay     client/src/components/Calls/IncomingCallOverlay.js
          NOT emit call:accept — let VideoCallModal own it)
P2        Build mobile VideoCallScreen + install               mobile/src/screens/Calls/ (new)
          react-native-webrtc                                  mobile/package.json
P2        Add call:incoming socket listener to mobile          mobile/src/api/socket.ts
```

---

## Failure Modes

| Mode | Trigger | Current behavior | Expected with fix |
|---|---|---|---|
| **Cross-NAT (main bug)** | Both peers behind NAT (mobile + laptop) | ICE fails silently, call tears down | TURN relay provides connectivity |
| **TURN endpoint 503** | `TURN_AUTH_SECRET`/`TURN_URLS` not set | Client uses STUN fallback (hidden failure) | Server returns 503 with informative error; client could show warning |
| **ICE `failed` state** | Any ICE negotiation failure | `handleEndCall()` called — correct teardown | Same, but now with logging |
| **Permission denied** | User denies camera/mic | Alert shown, `callStatus = 'failed'` ✅ | Same |
| **Recipient offline** | Target not in `activeUsers` map | Offline notice written to chat, `call:error` to caller ✅ | Same |
| **Call timeout (30s)** | No accept within 30s | Server-side timeout, `call:ended` emitted to both ✅ | Same |
| **Double call:accept** | Overlay + modal both emit accept | Second accept returns `call:error` (ignored), WebRTC setup still proceeds | Fix: remove accept emit from overlay |
| **Mobile native app** | User on Expo app | No video call UI exists at all | Build VideoCallScreen + install react-native-webrtc |
| **Symmetric NAT (STUN only)** | Any CGNAT mobile network | Always fails without TURN | Fixed by adding TURN |
| **No ICE debug logging** | Any ICE failure | Silent, no developer visibility | Add `console.log` on all ICE state changes |
| **TURN credential TTL expiry** | Call exceeds `TURN_TTL_SECONDS` (120s default) | ICE candidates with expired creds fail | Implement credential refresh or extend TTL |

---

## Quick Verification After Fix

After adding TURN env vars and redeploying:

1. Open browser DevTools → Network tab
2. Initiate a call
3. Watch for `POST /api/calls/:id/relay-credentials` → should return **200** with `iceServers` containing a `turn:` URL
4. In console: `navigator.mediaDevices.getUserMedia` should succeed (no error)
5. Check `RTCPeerConnection.getStats()` → `candidate-pair` with `state: 'succeeded'` and `localCandidateType: 'relay'` confirms TURN is working
6. Call should connect within 5-10 seconds

---

## SCOUT-VIDEO COMPLETE

**Files audited:**
- `server/routes/calls.js` — TURN credential endpoints (built, not deployed)
- `server/socket/events.js` — All call socket events (signaling works ✅)
- `server/services/callStateMachine.js` — State transitions (correct ✅)
- `server/models/Call.js` — Call data model (correct ✅)
- `server/index.js` — Socket auth middleware (JWT + tokenVersion ✅)
- `server/.env` + `server/.env.example` + `server/.env.production.example` — TURN vars ABSENT ❌
- `client/src/components/Calls/VideoCallModal.js` — RTCPeerConnection, STUN-only fallback ❌
- `client/src/components/Calls/IncomingCallOverlay.js` — Incoming call UI
- `client/src/socket/useSocket.js` — Event dispatch, socket init
- `mobile/package.json` — No react-native-webrtc ❌
- `mobile/src/api/socket.ts` — Socket connected, no call event handlers
- `mobile/src/screens/` — No VideoCallScreen ❌
