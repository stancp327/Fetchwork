# Teams Temporary Project Log (WORKING DOC)
_Status: Temporary reference file for this project. Delete when Teams initiative is complete._
_Last updated: 2026-03-03_

## Purpose
Track what we tried, failed, fixed, and accomplished for Teams/Agency while we build.
This file is intentionally practical and implementation-focused (not polished docs).

---

## Current Plan (Execution Spine)

### Phase 1 — Reliability + Control Baseline
1. Centralize authorization decisions (policy layer; deny-by-default).
2. Normalize identity/role resolution across all Teams endpoints.
3. Harden invite lifecycle (idempotency, duplicate prevention, expiration handling).
4. Stabilize owner-only actions (transfer/delete invariants + race-safe updates).
5. Add audit logging for all sensitive actions.
6. Ensure list/detail/read paths are failure-isolated and tenant-scoped.
7. Ship regression tests for all historical bug signatures.

### Phase 2 — Monetization-Ready Operations
1. Approval engine (threshold + optional dual control).
2. Team wallet/ledger improvements + Stripe reconciliation hardening.
3. Team spend controls (caps, alerts, approval requirements).
4. Team analytics and exports.

### Phase 3 — Enterprise Foundation
1. Org tree inheritance rules (org -> dept -> team).
2. Relationship-based access for assigned-client/project visibility.
3. Custom roles + compliance-oriented controls.

---

## Critical Factors / Risk Areas to Account For

## 1) Roles/permissions: the “it works until it doesn’t” zone
- Resource scoping bugs (IDOR/tenant leaks): it’s easy to check “user is a member of *a* team” but forget to scope *the resource* to that team/org on every query/mutation.
- RBAC drift: hardcoding role checks in random endpoints/UI creates inconsistencies (“admin can do X here but not there”). Centralize authorization decisions.
- Custom roles later: if you plan for custom roles, don’t bake assumptions like role === "owner" all over the code. Use permission strings and a policy engine.
- Permission hints (“why can’t I do this?”): returning a safe, user-friendly denial reason without leaking sensitive info (e.g., existence of a team/resource) takes care.

## 2) Ownership transfer / delete: high-risk + race conditions
- Owner transfer is not just a role change. You must ensure:
  - there is always exactly one owner
  - transfer and delete can’t happen concurrently
  - any “owner-only” approvals are reassigned cleanly
- Race condition: two admins trying to change roles / transfer ownership at the same time can produce invalid states unless you use atomic conditional updates (and/or optimistic concurrency).

## 3) Invites lifecycle: token security + idempotency headaches
- Duplicate invites: multiple pending invites to the same email/team, reinvite spam, and “accepting an old invite after role changed” all cause weird bugs.
- Token handling: store hashed tokens, handle expiration, and make accept endpoint idempotent (double click / resend / app refresh).
- Email mismatch: user signs up with a different email than invite. Decide your policy now (block vs allow link with verification).

## 4) Member states: “suspended vs deactivated vs removed” ripple effects
- Every state affects:
  - message visibility
  - assignment eligibility
  - approval authority
  - analytics and history
- The tricky part is history retention: you don’t want deleting a member to break foreign keys/references (even in Mongo, references exist conceptually).

## 5) Approvals / two-person control: deadlocks and UX friction
- Self-approval rules: can the requester also approve? Usually “no” for true dual-control, but then small teams can get stuck.
- Quorum edge cases: what if an approver gets suspended mid-request?
- Expiry/cancel policy: approvals hanging forever becomes a mess; you need automatic expiration + clear UI.
- Idempotent execution: once approvals hit quorum, executing the action must be exactly-once (no double charges, no double role changes).

## 6) Wallet/ledger + Stripe: reconciliation pain
- Ledger vs Stripe truth: your DB ledger must be consistent with Stripe events (refunds, disputes, reversals). The hard part is dealing with:
  - asynchronous webhook timing
  - partial refunds
  - dispute lifecycles
- Negative balances / reversals: your wallet UI must explain why “available” differs from “pending” or why it went negative after a chargeback.
- Idempotency keys everywhere: charge/refund/payout operations must be safe to retry without duplicating money movement.

## 7) Data access controls like “only see assigned clients”
- This is where pure RBAC fails.
- You’ll need relationship-based checks (assigned client/project/work item), and those checks must be applied consistently across:
  - list endpoints (filters)
  - detail endpoints
  - exports/analytics (easy to leak here)

## 8) Org tree (parent/child): inheritance and boundaries
- If you introduce org -> departments -> teams:
  - what settings inherit downward (approval thresholds? invite policy?)
  - can someone in a department admin role administer sibling teams?
- Most bugs come from unclear inheritance rules and “which team’s policy applies.”

## 9) Audit logs: usefulness vs privacy vs cost
- Log enough to reconstruct sensitive actions (who/what/when/before-after summary) but avoid secrets/PII overexposure.
- Keep retention/index strategy practical so logs stay queryable and affordable.
- Ensure logs are actionable for support/debugging, not just compliance noise.
- Redaction: logging “before/after” can accidentally store secrets or personal data.
- Diff size: naive “store whole document snapshots” becomes huge and slow.
- Searchability: audit logs are only useful if you can filter (actor, action, date range, resource). Plan indexes.

## 10) Discovery/ranking: gaming + fairness
- If teams appear in a directory:
  - prevent review spam, badge gaming, portfolio stuffing
  - ranking signals should be explainable enough to reduce “why am I buried?” complaints
- Directory filtering + text search performance must be planned (indexes and/or search service)

## 11) UX polish: permission-aware UI complexity
- Don’t rely on UI gating alone; backend enforcement remains mandatory.
- If UI shows actions that repeatedly fail on submit, trust drops quickly.
- Preferred pattern: UI renders from API-returned capabilities, backend still enforces.
- Mobile parity risk: admin flows often break first on mobile (modals, dense tables, long forms).

---

## Shortest “watch these first” list (priority)
1. Authorization + tenant scoping
2. Owner transfer/delete race-safety
3. Invite idempotency + token security
4. Approval engine exact-once execution
5. Stripe ledger reconciliation + webhook integrity
6. Assigned-client visibility rules

## Code hygiene rule for this project
- Audit Teams code frequently for dead/redundant logic.
- Remove unused variables/props/branches as part of normal PR flow (not deferred forever).
- Keep permission logic centralized; avoid duplicate role checks across layers.

---

## Tried / Failed / Accomplished (rolling)

### Accomplished
- Project kickoff confirmed for Teams top-tier rebuild (2026-03-03 morning); P0 focus locked: auth/policy map, tenant-scoping checklist, owner transfer/delete invariants.
- Delivered first artifact: `tasks/teams-authz-scoping-matrix.md` (route-by-route endpoint auth + scoping matrix, target permission vocabulary, and P0 gap list).
- Delivered remaining P0 planning artifacts: `tasks/teams-tenant-scoping-checklist.md`, `tasks/teams-owner-transfer-delete-invariants.md`, `tasks/teams-regression-test-matrix.md`.
- Implemented centralized access helpers in `server/routes/teams.js`: `resolveRequester`, `getTeamAccessContext`, `authorizeTeamAction`; applied to management, member, billing, assignments, activity, approval, and delete routes.
- Added explicit team scoping to assignment-related job reads (`Job.findOne({_id, team})` and assignments list filter includes `team: team._id`).
- Added race-safety guardrails: `transferState`, `transferTargetUserId`, `lockVersion` fields on Team model; role patch and delete now require `transferState: idle` + matching `lockVersion` and return 409 on stale/concurrent writes.
- Added transfer ownership endpoint/state machine: `POST /api/teams/:id/transfer-ownership` with two-phase conditional updates (begin/apply), stale-write conflict handling, and rollback-to-idle fallback on apply conflicts.
- Wired structured team audit logging via new `TeamAuditLog` model and route helper (`logTeamAudit`) for ownership transfer start/completion, team delete, and member role/permission/title updates.
- Added owner/admin-scoped audit retrieval endpoint: `GET /api/teams/:id/audit-logs` with pagination and optional action/actor/targetUser filters.
- Added regression tests: `server/__tests__/unit/teams.security.test.js` (4 passing) and Mongo-backed integration tests `server/__tests__/integration/teams.integration.test.js` (4 passing) for transfer/delete/lock conflicts + audit log access.
- Web TeamDetail now includes ownership transfer UI + owner/admin audit tab (reads `/transfer-ownership` and `/audit-logs`).
- Mobile now has full transfer/audit support: `teamsApi` extended with `transferOwnership` + `getAuditLogs`, and `TeamDetailScreen` now renders owner transfer controls + owner/admin audit trail with refresh.
- UX hardening pass: mobile team detail refresh now updates both detail+audit data; transfer action is disabled when `transferState` is not idle and shows in-progress warning banner.
- Added normalization flags for current user role/capabilities in team responses.
- Hardened owner/member query behavior and dedupe logic for list reliability.
- Prevented invite-endpoint failures from blanking team list in UI.
- Cleanup pass completed and pushed (`22ebc0c`) removing redundant Teams code paths.
- Added top-tier Teams checklist into monetization strategy and created implementation brief.

### Tried
- Multiple ownership fallback strategies (owner id + member role + server flags) to avoid UI false negatives.
- Defensive split-query strategy for owner teams + member teams.

### Failed / Pain points encountered
- Inconsistent identity/role shape across layers caused intermittent control visibility.
- Endpoint coupling previously allowed unrelated failures to degrade main Teams UX.
- Tooling constraints blocked delegated subagent run in this session (pairing-required error), forcing in-session synthesis.
- (Resolved) Server Jest config had test discovery issues on this machine (`testMatch` + Windows escaped path). Fixed by switching to `testRegex` in `server/jest.config.js` and correcting `coverageThreshold` key; unit tests now execute normally.

---

## Decision Notes (temporary)
- Keep this file as the day-to-day Teams scratchpad.
- Treat policy/permission enforcement as backend-owned source of truth.
- Prefer data-driven permissions over hardcoded role-name conditionals.

---

## Delete criteria
Delete this temporary file when:
1. Teams Phase 1/2 are shipped and stable,
2. key learnings are migrated to long-term docs (`memory/fetchwork.md`, strategy docs, and permanent architecture docs),
3. open risk list is empty or moved to canonical backlog.

- Added legacy guard-field migration script: server/scripts/backfill-team-guards.js (backfills lockVersion, 	ransferState, 	ransferTargetUserId for pre-guard team docs).
