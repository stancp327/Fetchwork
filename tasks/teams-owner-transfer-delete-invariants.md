# Teams Owner Transfer/Delete Invariants + Race-Safety (P0 Artifact #3)
_Last updated: 2026-03-03_

## Objective
Define strict ownership invariants and atomic rules so transfer/delete/member-role mutations cannot create invalid states.

---

## Core invariants (non-negotiable)
1. **Exactly one effective owner** per active team at all times.
2. Team `owner` field is canonical source of truth.
3. Owner must have active membership representation (or deterministic owner fallback handling).
4. Owner cannot be removed via member-removal route.
5. Team deletion is owner-only and blocked while transfer is in-flight.
6. Owner transfer and team delete cannot execute concurrently.

---

## Proposed model additions
- `team.transferState`: `idle | pending | applying`
- `team.transferTargetUserId` (nullable)
- `team.lockVersion` (increment on sensitive mutations)

Optional:
- `team.pendingCriticalAction` (enum) to serialize delete/transfer-sensitive operations.

---

## Atomic operation patterns

## A) Transfer ownership
### Preconditions
- Requester is current owner.
- Target user is active team member (or transaction includes active membership promotion).
- Team is active and `transferState === idle`.

### Atomic update shape (conceptual)
- Conditional filter includes: `_id`, `owner == requester`, `transferState == idle`, `isActive == true`, `lockVersion == expected`
- Set `transferState = applying`, `transferTargetUserId = target`, increment `lockVersion`

### Apply phase
1. Set team `owner = targetUserId`
2. Update former owner membership role (e.g., admin/member per policy)
3. Ensure target membership role=owner + active
4. Clear transfer state (`idle`, null target)
5. Increment `lockVersion`

### Failure handling
- If apply fails mid-flight, rollback transaction or mark transfer as recoverable-pending with compensating job.
- Never leave `owner` null.

---

## B) Delete team
### Preconditions
- Requester is canonical owner.
- `transferState === idle`
- `isActive === true`

### Atomic delete guard
- Conditional filter includes `_id`, `owner == requester`, `transferState == idle`, `isActive == true`, `lockVersion == expected`
- Apply soft-delete (`isActive=false`) + increment `lockVersion`

### Post-delete cleanup
- Remove team refs from members (scoped update)
- Preserve audit logs and historical records

---

## C) Member role mutation safety
- Role updates must fail if target member is current owner.
- Role updates use optimistic concurrency (`lockVersion` or document version) on sensitive updates.
- Promotion to admin/owner-adjacent roles requires owner policy check.

---

## Conflict matrix
| Operation A | Operation B | Required behavior |
|---|---|---|
| Transfer owner | Delete team | One must fail fast by conditional lock/version check |
| Transfer owner | Role change target user | Serialize or fail stale mutation |
| Delete team | Member remove/update | Block member mutations on inactive/pending-delete team |
| Dual transfer attempts | Dual transfer attempts | Only one succeeds; others fail stale/precondition |

---

## Required tests
1. Concurrent transfer vs delete (simulate simultaneous requests).
2. Concurrent transfer attempts by same owner.
3. Role change against transfer target during transfer.
4. Delete request with stale lockVersion.
5. Verify post-conditions: exactly one owner and valid member states.

---

## Audit requirements
Log these events with correlation id:
- `owner_transfer_requested`
- `owner_transfer_applied`
- `owner_transfer_failed`
- `team_delete_requested`
- `team_delete_applied`
- `team_delete_denied`

Include: actor, teamId, previous owner, next owner (if any), reason code.

---

## Implementation notes (incremental)
- Phase 1: add lock/version guard and transfer state fields; protect delete route.
- Phase 2: introduce explicit transfer endpoint and approval hooks if needed.
- Phase 3: optional dual-control for owner transfer in enterprise mode.
