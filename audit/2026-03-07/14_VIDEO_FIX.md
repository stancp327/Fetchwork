# WebRTC Video — Fix Plan — 2026-03-07

## Root Cause Analysis

Video calls fail for users behind symmetric NATs (mobile carriers, corporate firewalls) because **TURN relay credentials are never provided to the client**. Here's the exact chain of failure:

1. **Server has TURN code ready** — `server/routes/calls.js` lines 21–37 (`/turn-credentials`) and lines 83–115 (`/:id/relay-credentials`) both generate time-limited HMAC-SHA1 TURN credentials using `TURN_AUTH_SECRET` and `TURN_URLS` env vars.

2. **Env vars are NOT set on Render** — Both endpoints check `process.env.TURN_AUTH_SECRET` and `process.env.TURN_URLS`. When missing, they return **503** with `{ error: 'TURN not configured' }` (line 24) or `{ error: 'TURN is not configured' }` (line 107).

3. **Client silently falls back to STUN-only** — `client/src/components/Calls/VideoCallModal.js` line 146-161: `getIceServers()` calls `POST /api/calls/${callId}/relay-credentials`, catches the 503 error, logs a warning (`console.warn`), and falls back to `FALLBACK_ICE_SERVERS` (lines 5-8) which is only Google STUN:
   ```js
   const FALLBACK_ICE_SERVERS = [
     { urls: 'stun:stun.l.google.com:19302' },
     { urls: 'stun:stun1.l.google.com:19302' },
   ];
   ```

4. **STUN-only fails on cross-NAT** — When both peers are behind symmetric NATs (common on mobile carriers), STUN cannot establish a direct peer connection, and without TURN relay, the ICE negotiation fails silently. The `oniceconnectionstatechange` handler (line 183) detects `failed` state and calls `handleEndCall()`.

5. **Mobile app has NO video call support** — No `react-native-webrtc` dependency, no VideoCallScreen, no call-related components exist in `mobile/src/`. The mobile app cannot participate in video calls at all.

**Signaling is correct** — Socket.io relay for `call:offer`, `call:answer`, `call:ice-candidate` in `server/socket/events.js` (lines ~450-475) works properly with authorization checks via `relayIfAuthorized()`. The call state machine (`transitionCall`) is also solid.

---

## Fix 1: TURN Server — Set Env Vars on Render

### What
Set `TURN_AUTH_SECRET` and `TURN_URLS` environment variables on the Render service so the existing server code returns valid TURN credentials.

### Current code in calls.js (lines 83-115)
```js
router.post('/:id/relay-credentials', authenticateToken, async (req, res) => {
  // ...authorization checks...
  const turnUrls = (process.env.TURN_URLS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (!turnUrls.length || !process.env.TURN_AUTH_SECRET) {
    return res.status(503).json({ error: 'TURN is not configured' });
  }

  const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 120);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${userId}:${req.params.id}`;
  const credential = crypto
    .createHmac('sha1', process.env.TURN_AUTH_SECRET)
    .update(username)
    .digest('base64');

  return res.json({
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: turnUrls, username, credential },
    ],
    ttlSeconds,
    expiresAt,
  });
});
```

### What it needs — exact env var names and format

| Env Var | Format | Example |
|---------|--------|---------|
| `TURN_AUTH_SECRET` | Shared secret string from TURN provider | `a1b2c3d4e5f6...` (from Metered.ca dashboard) |
| `TURN_URLS` | Comma-separated TURN URIs | `turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443,turns:global.relay.metered.ca:443` |
| `TURN_TTL_SECONDS` | (Optional) Credential lifetime | `86400` (default is 120, consider increasing to 86400) |

### Metered.ca Setup Steps

1. Go to https://www.metered.ca/stun-turn
2. Click **"Sign Up Free"** — free tier includes 500 GB/month relay traffic
3. After signup, go to **Dashboard → TURN Server**
4. Click **"Create Credentials"** or find the **API Key / Shared Secret**
5. Copy the **Shared Secret** → this is `TURN_AUTH_SECRET`
6. Copy the TURN server URLs. Metered provides multiple protocols. Use:
   - `turn:global.relay.metered.ca:80` (TCP, works through most firewalls)
   - `turn:global.relay.metered.ca:443` (TCP on 443, best firewall traversal)  
   - `turns:global.relay.metered.ca:443` (TLS-encrypted, most reliable)
7. Format as comma-separated for `TURN_URLS`

**⚠️ Important:** Metered.ca uses the **static auth credential** model, NOT the HMAC time-limited model that the Fetchwork code implements. This means:

**Option A (Recommended — requires code change):** Use Metered.ca's REST API to generate temporary credentials:
- API endpoint: `https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=YOUR_API_KEY`
- This returns `{ iceServers: [...] }` directly
- Modify `relay-credentials` endpoint to proxy this API call instead of HMAC generation

**Option B (Quick fix — use static credentials):** 
- Set `TURN_AUTH_SECRET` to the Metered API key
- Modify the relay-credentials endpoint to call the Metered REST API instead of HMAC
- OR use a TURN provider that supports HMAC auth (Coturn self-hosted, Twilio, Xirsys)

### Code Change for Option A (Metered.ca REST API proxy)

**File:** `server/routes/calls.js`, replace lines 83-115

```js
// POST /api/calls/:id/relay-credentials — ephemeral TURN credentials via Metered.ca
router.post('/:id/relay-credentials', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const call = await Call.findById(req.params.id).select('caller recipient status').lean();
    if (!call) return res.status(404).json({ error: 'Call not found' });

    if (call.caller.toString() !== userId && call.recipient.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const meteredApiKey = process.env.METERED_API_KEY;
    const meteredApp = process.env.METERED_APP_NAME; // e.g. "fetchwork"
    
    if (!meteredApiKey || !meteredApp) {
      // Fallback: return STUN-only if TURN not configured
      return res.json({
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        ],
        ttlSeconds: 0,
        expiresAt: 0,
      });
    }

    const response = await fetch(
      `https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`
    );
    
    if (!response.ok) {
      console.error('Metered API error:', response.status);
      return res.json({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
        ttlSeconds: 0,
        expiresAt: 0,
      });
    }

    const iceServers = await response.json();
    return res.json({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        ...iceServers,
      ],
      ttlSeconds: 86400,
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    });
  } catch (err) {
    console.error('relay credentials error:', err.message);
    res.status(500).json({ error: 'Failed to issue relay credentials' });
  }
});
```

### New Env Vars (Option A)

| Env Var | Value |
|---------|-------|
| `METERED_API_KEY` | Your Metered.ca API key |
| `METERED_APP_NAME` | Your Metered app name (e.g. `fetchwork`) |

---

## Fix 2: Client ICE Server Fallback — Improve Error Visibility

### File
`client/src/components/Calls/VideoCallModal.js`

### Current code (lines 146-161)
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
    console.warn('Using fallback ICE servers:', err?.message || err);
  }
  iceServersRef.current = FALLBACK_ICE_SERVERS;
  return FALLBACK_ICE_SERVERS;
}, [callId]);
```

### Fixed code
```js
const getIceServers = useCallback(async () => {
  if (iceServersRef.current) return iceServersRef.current;
  try {
    const data = await apiRequest(`/api/calls/${callId}/relay-credentials`, { method: 'POST' });
    if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
      const hasTurn = data.iceServers.some(s => 
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => u?.startsWith('turn:') || u?.startsWith('turns:'))
      );
      if (!hasTurn) {
        console.warn('Server returned ICE servers but no TURN — calls may fail on mobile networks');
      }
      iceServersRef.current = data.iceServers;
      return data.iceServers;
    }
  } catch (err) {
    console.warn('TURN credential fetch failed, falling back to STUN-only (calls may fail on mobile):', err?.message || err);
  }
  iceServersRef.current = FALLBACK_ICE_SERVERS;
  return FALLBACK_ICE_SERVERS;
}, [callId]);
```

### Additional: Add ICE connection failure recovery (after line 183)

```js
pc.oniceconnectionstatechange = () => {
  const state = pc.iceConnectionState;
  console.log(`[WebRTC] ICE connection state: ${state}`);
  if (state === 'failed') {
    // Attempt ICE restart before giving up
    if (pc.restartIce) {
      console.log('[WebRTC] Attempting ICE restart...');
      pc.restartIce();
    } else {
      handleEndCall();
    }
  } else if (state === 'disconnected') {
    // Give 5 seconds for recovery before ending
    setTimeout(() => {
      if (pcRef.current?.iceConnectionState === 'disconnected') {
        handleEndCall();
      }
    }, 5000);
  }
};
```

---

## Fix 3: Mobile WebRTC

### Current State
- **Zero WebRTC support** in the mobile app
- No `react-native-webrtc` in `mobile/package.json`
- No VideoCallScreen or call-related components in `mobile/src/`
- Mobile users **cannot** make or receive video calls

### What Needs to Be Added

This is a significant feature addition. Minimum viable implementation:

1. **Install dependency:**
   ```bash
   cd mobile
   npm install react-native-webrtc
   # iOS: cd ios && pod install
   ```

2. **Add permissions:**
   - iOS: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` in Info.plist
   - Android: `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` in AndroidManifest.xml

3. **Create components:**
   - `mobile/src/screens/VideoCallScreen.tsx` — mirrors `VideoCallModal.js` logic but uses `react-native-webrtc`'s `RTCPeerConnection`, `RTCView`, `mediaDevices`
   - `mobile/src/components/IncomingCallOverlay.tsx` — incoming call UI

4. **Wire up socket events:**
   - Same socket events (`call:offer`, `call:answer`, `call:ice-candidate`, etc.)
   - Navigation to VideoCallScreen on `call:incoming`

5. **Estimated effort:** 2-3 days for a senior RN developer

**Recommendation:** Defer mobile WebRTC to a future sprint. Focus on fixing web video calls first (Fixes 1 & 2), which is a 1-hour task.

---

## Manual Actions Required (Chaz)

### Option A: Metered.ca (Recommended)

1. **Sign up** at https://www.metered.ca/stun-turn (free tier: 500 GB/month)
2. After login, go to **Dashboard**
3. Note your **App Name** (shown in the URL, e.g., `fetchwork`)
4. Go to **Developers → API Keys** and copy the **API Key**
5. Add to Render environment variables:
   - `METERED_API_KEY` = `<your API key>`
   - `METERED_APP_NAME` = `<your app name>`
6. Remove or leave unset: `TURN_AUTH_SECRET`, `TURN_URLS` (no longer needed with Option A)
7. Deploy the code change to `server/routes/calls.js` (relay-credentials endpoint)
8. Redeploy on Render

### Option B: Keep HMAC Auth (requires Coturn or compatible provider)

1. Set up a Coturn server or use a provider that supports HMAC time-limited credentials (Twilio, Xirsys)
2. Set `TURN_AUTH_SECRET` = shared secret
3. Set `TURN_URLS` = comma-separated TURN URIs
4. Set `TURN_TTL_SECONDS` = `86400`
5. Redeploy on Render (no code change needed for Option B)

---

## Testing Plan

### Pre-test Checklist
- [ ] Env vars set on Render
- [ ] Server redeployed
- [ ] Client code deployed (if Fix 2 applied)

### Test 1: TURN Credential Endpoint
```bash
# After login, with a valid call ID:
curl -X POST https://fetchwork.onrender.com/api/calls/<callId>/relay-credentials \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Expected: 200 with iceServers array containing TURN URLs
# Failure: 503 means env vars still not set
```

### Test 2: Same-Network Video Call
1. Open two browser tabs, login as two different users
2. Initiate a video call from User A to User B
3. User B accepts
4. Both should see each other's video within 3-5 seconds
5. Check browser console for `[WebRTC] ICE connection state: connected`

### Test 3: Cross-NAT Video Call (the real test)
1. User A on WiFi (home network)
2. User B on mobile data (4G/5G) — disconnect from WiFi
3. Initiate call — this is the scenario that currently fails
4. If TURN is working: call connects, ICE candidate type should be `relay`
5. Check quality endpoint: `POST /api/calls/<id>/quality` should report `iceSelectedCandidateType: "relay"`

### Test 4: Quality Metrics Upload
1. After a call ends, check MongoDB `calls` collection for `networkDiagnostics` field
2. Should contain: `avgRttMs`, `avgJitterMs`, `avgPacketLossPct`, `iceSelectedCandidateType`

---

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `server/routes/calls.js` | 83-115 | Replace HMAC relay-credentials with Metered.ca API proxy (Option A only) |
| `client/src/components/Calls/VideoCallModal.js` | 146-161 | Add TURN presence check + better error logging |
| `client/src/components/Calls/VideoCallModal.js` | 183-188 | Add ICE restart on failure + disconnection grace period |
| Render Dashboard | N/A | Set `METERED_API_KEY` + `METERED_APP_NAME` env vars |

### Files That Do NOT Need Changes (confirmed working)
- `server/socket/events.js` — signaling relay is correct with auth checks
- `server/models/Call.js` — call state machine transitions are solid
- `client/src/components/Calls/IncomingCallOverlay.js` — incoming call UI works
- `client/src/App.js` — IncomingCallOverlay properly imported

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Metered.ca free tier exhausted | Low (500GB/month is generous) | Calls fail silently | Monitor usage, upgrade if needed |
| TURN credential caching | Low | Stale credentials on long sessions | TTL is 86400s, client re-fetches per call |
| Mobile users can't call | Confirmed | No video on mobile app | Defer to future sprint, web-only for now |
| ICE restart causes double-connect | Low | Brief audio glitch | Already handled by `sent` flag pattern |
