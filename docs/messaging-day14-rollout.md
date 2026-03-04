# Messaging Rebuild — Day 14 Rollout/Deletion Plan

Date: 2026-03-04
Status: Ready for controlled canary

## Canary Verification Checklist (Day 13/14)

Run with 2 real accounts on web + mobile where possible.

1. Conversation list loads with `unreadSeqCount` present.
2. Send text message (socket path) -> single delivery, no duplicate bubble.
3. Send same message with same `requestId` retry simulation -> deduped (one persisted message).
4. Open other device/client and verify `/sync?sinceSeq=` fills missed messages in order.
5. Read receipts:
   - reader marks read
   - sender receives `rcpt:update`
   - conversation unread count updates.
6. Presence:
   - online/offline transition observed within TTL window.
7. Safety detector:
   - medium/high signal message triggers non-blocking `safety:nudge`.
8. Calling timeline:
   - initiate/accept/end call writes system timeline messages into thread.
9. Asset contract:
   - `/api/messages/assets/sign` returns contract payload
   - `assetRefs` send accepted by message routes.
10. Moderation endpoint:
    - non-admin denied
    - admin with permission allowed.

## Rollout gates

- Cohort plan:
  - Internal testers -> 1% -> 5% -> 25% -> 50% -> 100%
- Hold each step for 24-48h with no P0/P1 incidents.

### Success thresholds
- Message send success >= 99.9%
- Duplicate message rate <= 0.1% (target <= 0.01%)
- Sync reconciliation success >= 99%
- Receipt update latency p95 <= 1.5s

### Automatic rollback triggers
- Send failure rate +1% over baseline for >= 10m
- Duplicate rate > 0.1%
- Sync gap incidents spike above baseline threshold

Rollback action: disable
- `ff_msg_protocol_v1`
- `ff_msg_seq_ordering`
- `ff_receipts_cursor_model`
- `ff_presence_v1`
- `ff_offplatform_v1`
- `ff_call_timeline_v1`

## Deprecated code deletion plan (do not delete yet)

Delete only after:
- 2 weeks stable at >=95% traffic
- 0 open P0/P1 messaging incidents
- canary metrics consistently within thresholds

Targets for delete-later:
1. Legacy socket event aliases superseded by v1 ack contract.
2. Content-only validation assumptions that conflict with `assetRefs` path.
3. Legacy unread/read inference not based on seq/cursors.
4. Duplicate room/conversation join handlers once all clients use canonical `conv:*` path.

## Day 14 decision log

- Continue with controlled canary instead of broad rollout.
- Keep feature flags default-off for riskier paths (`FF_ROOM_SEQ_V1`) until canary pass.
- Keep finalize/sign routes contract-compatible while storage backend hardening completes.
