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

## Immediate Day 2 Follow-ups

1. Define and implement v1 socket envelope helper and standardized ack errors.
2. Add authoritative membership checks for all conversation/room join paths.
3. Start seq + idempotent send design in data model migration notes.
