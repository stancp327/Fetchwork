# Messaging Day 1 Audit — Fetchwork

Date: 2026-03-04
Scope: inventory messaging + calling REST/socket surfaces, identify duplicates/conflicts, and define KEEP/REPLACE/DELETE-LATER baseline.

## Inventory Snapshot

### Messaging REST (primary)
- `server/routes/messages.js`
  - `GET /api/messages/conversations`
  - `GET /api/messages/conversations/:conversationId`
  - `POST /api/messages/conversations/find-or-create`
  - `POST /api/messages/conversations`
  - `POST /api/messages/conversations/:conversationId/messages`
  - `POST /api/messages/conversations/:conversationId/messages/upload`
  - `GET /api/messages/unread-count`

### Group/room REST (parallel surface)
- `server/routes/chatrooms.js`
  - room CRUD + room messages + membership operations

### Presence REST
- `server/routes/users.js`
  - `GET /api/users/online-status?ids=...`

### Calling REST
- `server/routes/calls.js`
  - `GET /api/calls`
  - `GET /api/calls/:id`
  - `POST /api/calls/:id/relay-credentials`
  - `POST /api/calls/:id/quality`

### Messaging/Calling Socket events
- `server/socket/events.js`
  - Messaging: `message:send`, `message:read`, `message:receive`, `message:delivered`
  - Typing: `typing:start`, `typing:stop`
  - Presence-ish: `user:get_online_status`, `user:sync_missed_messages`, `user:online`, `user:offline`
  - Rooms: `room:join`, `room:leave`
  - Calling: `call:initiate`, `call:accept`, `call:reject`, `call:end`, `call:offer`, `call:answer`, `call:ice-candidate`, `call:media-toggle`, `call:state`, `call:ended`, `call:error`

## Duplicate/Conflict Findings

1. **Two messaging surfaces**
   - Direct messages in `messages.js` and room/group messages in `chatrooms.js` use different semantics and event assumptions.
2. **Presence split-brain**
   - REST (`/users/online-status`) and socket (`user:get_online_status`, broadcast online/offline) coexist without a single protocol contract.
3. **Call state overlap**
   - Legacy call events (`call:accepted`, `call:ended`) and newer canonical `call:state` are both in use.
4. **Resync is ad hoc**
   - `user:sync_missed_messages` exists in socket layer, but no deterministic seq-based `/sync` endpoint yet.
5. **Admin route duplication (adjacent risk)**
   - `server/routes/admin.js` has duplicate `GET /users/search` declarations (outside messaging core but indicates route drift).

## KEEP / REPLACE / DELETE-LATER

| Area | Keep (now) | Replace (now) | Delete-Later (after canary stability) |
|---|---|---|---|
| Messaging transport | socket.io connection/auth foundation | Event envelope + ack shape (v1 contract) | Legacy event aliases once all clients migrated |
| Messaging REST | `/api/messages/conversations*` endpoints | Add deterministic `/sync?sinceSeq=` and seq ordering model | Old page-only history assumptions |
| Group messaging | `chatrooms.js` as temporary group path | Align room events/receipts/presence with v1 protocol | Redundant room-only utility paths once unified |
| Presence | `/api/users/online-status` read API | Server-owned heartbeat/session model | `user:get_online_status` legacy request pattern |
| Calling in chat | Existing call routes/events | Canonical `call:state` + timeline system messages | Event variants that duplicate state semantics |
| Receipts | existing read mark path | Cursor model (`lastReadSeq/lastDeliveredSeq`) | per-message receipt fanout logic |

## Day 1 Changes Completed

- Added baseline correlation ID propagation/logging in messaging REST routes.
- Added baseline socket error logs with correlation IDs in key messaging/call handlers.

## Day 2 Progress (implemented)

1. Added socket v1-style ack helpers in `server/socket/events.js`:
   - `ackOk(ack, payload, data)`
   - `ackErr(ack, payload, code, message, retryable)`
2. Added authoritative conversation join/leave events with authz:
   - `conv:join` (membership-validated)
   - `conv:leave`
3. Upgraded `room:join` / `room:leave` to support request/ack contract + structured error codes.
4. Added correlation IDs into join/leave error paths and socket emits.

## Day 3 Progress (implemented)

1. Added conversation/message sequence scaffolding:
   - `Conversation.seq`, `Conversation.lastMessageSeq`, `Conversation.lastMessageAt`
   - `Message.seq`
2. Added idempotency scaffolding:
   - `Message.requestId`
   - unique index `(conversation, sender, requestId)` (partial)
3. Updated socket direct-message send path to:
   - allocate monotonic seq via transaction
   - set `Message.seq`
   - dedupe repeated sends by `requestId`
4. Added deterministic sync route:
   - `GET /api/messages/conversations/:conversationId/sync?sinceSeq=&limit=`

## Day 4 Progress (implemented)

1. Added v1-style ack support for:
   - `message:send`
   - `message:read`
2. Added client requestId send/ack merge path in `Messages.js`:
   - optimistic messages carry `requestId`
   - socket `message:send` includes `{ v, requestId, correlationId, clientTs }`
   - ack failure removes optimistic bubble and surfaces error
   - own echo merges by `requestId` first (content-match fallback kept)
3. Kept group room sequencing as phased follow-up to avoid destabilizing room message path in same slice.

## Day 5 Progress (implemented)

1. Added client reconnect sync trigger:
   - socket connect emits `socket:connect` via `useSocket`
   - `Messages.js` runs `/sync?sinceSeq=` for active conversation on reconnect
2. Added receipt cursor skeleton:
   - new `ReceiptCursor` model in `server/models/Message.js`
   - unique index `(conversationId, userId)`
   - REST endpoint `POST /api/messages/conversations/:conversationId/receipts`
   - socket `message:read` now upserts cursor using max read seq
3. Kept room-message seq parity as next slice (intentional phased change).

## Day 6 Progress (implemented)

1. Wired client receipt updates:
   - `Messages.js` now posts receipt cursor updates when opening thread (`lastReadSeq/lastDeliveredSeq`) and on reconnect sync delivered updates.
2. Added room-message seq parity baseline:
   - `ChatRoom.seq` and `ChatRoom.lastMessageSeq`
   - room socket send allocates seq and stores `Message.seq`.
3. Sync response now includes cursor state:
   - `cursors.me.lastDeliveredSeq`
   - `cursors.me.lastReadSeq`

## Day 7 Progress (implemented)

1. Cursor-first list derivation started:
   - conversations API now returns `cursor` + `unreadSeqCount` based on `lastMessageSeq - lastReadSeq`.
2. Call timeline system inserts added:
   - writes `messageType='system'` call metadata messages for `call_initiated`, `call_accepted`, `call_missed`, `call_ended`.
3. Room seq rollout gate added:
   - `FF_ROOM_SEQ_V1=true` enables room sequence assignment.

## Day 8 Progress (implemented)

1. Call timeline rendering added in chat UI:
   - `MsgBubble` now renders system call metadata for `call_initiated/call_accepted/call_missed/call_ended`.
2. Off-platform detector v1 scaffold added:
   - `server/services/offPlatformDetector.js`
   - applied to REST and socket send paths; stores `message.safety` and emits `safety:nudge` events.
3. Receipt update event flow added:
   - server emits `rcpt:update` on read cursor changes
   - client consumes `rcpt:update` and refreshes conversation list.

## Day 9 Progress (implemented)

1. Added moderation event persistence model:
   - `server/models/ModerationEvent.js`
   - persisted from REST + socket messaging paths with score/confidence/action/ruleIds.
2. Improved safety UX to non-blocking nudge:
   - new `client/src/components/Messages/parts/SafetyNudge.js`
   - wired `safety:nudge` socket event to this component.
3. Added attachment API scaffold routes (contract-first):
   - `POST /api/messages/assets/sign`
   - `POST /api/messages/assets/:assetId/finalize`
   (returns stub payloads while storage-signing integration is finalized)

## Day 10 Progress (implemented)

1. Upgraded asset sign route toward real provider flow:
   - `POST /api/messages/assets/sign` now returns Cloudinary signed upload contract when env config exists.
   - fallback stub remains when provider config is missing.
2. Added moderation triage read endpoint:
   - `GET /api/messages/moderation/events` (admin-only basic view)
3. Finalize contract retained and standardized:
   - `POST /api/messages/assets/:assetId/finalize` returns normalized asset payload scaffold for client integration continuity.

## Day 11 Progress (implemented)

1. Wired finalized asset refs into message send routes:
   - `POST /api/messages/conversations`
   - `POST /api/messages/conversations/:conversationId/messages`
   - both now accept `assetRefs[]` and map to normalized attachment records.
2. Tightened moderation triage authz:
   - switched to `authenticateAdmin + requirePermission('content_moderation')` middleware.
3. Kept tests as immediate follow-up while preserving deploy velocity.

## Day 12 Progress (implemented)

1. Added integration tests:
   - `server/__tests__/integration/messages.day12.integration.test.js`
   - covers asset sign contract fallback response
   - moderation triage authz (non-admin denied, admin allowed)
   - attachment-only `assetRefs` send compatibility
2. Updated `validateMessage` middleware for attachment-first compatibility:
   - content now optional
   - `assetRefs[]` validated
   - custom rule enforces `content || assetRefs`
3. Ran targeted Day 12 test suite successfully (4/4 passing).

## Immediate Day 13 Follow-ups

1. Run canary verification checklist (send/read/sync/receipts/safety nudge) on production accounts.
2. Expand tests for Cloudinary-signed branch (with env-mocked signature path).
3. Add rcpt:update UI behavior assertions for unreadSeqCount refresh.
