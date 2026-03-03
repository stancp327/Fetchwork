# Teams Tenant-Scoping Checklist (P0 Artifact #2)
_Last updated: 2026-03-03_

## Objective
Guarantee every Teams-related read/write/export/analytics path is scoped to the correct tenant boundary (org/team/member relationship) and cannot leak cross-team data.

---

## A) Global scoping rules (must hold everywhere)
1. Resolve requester identity once (`requesterId`, `requesterObjectId`) in middleware/helper.
2. Every resource read must include tenant predicate (teamId/orgId membership relationship), not just resource id.
3. Every mutation must re-check same-team membership at write-time, not only from cached UI state.
4. Never trust client-submitted `teamId` without server-side membership validation.
5. For public endpoints, enforce explicit public filters (`isPublic`, `isActive`, expected `type`) and avoid returning private fields.

---

## B) Read endpoints checklist

### `GET /api/teams`
- [ ] Query owner teams by canonical owner ObjectId
- [ ] Query active-member teams by canonical member ObjectId
- [ ] Merge/dedupe by team id
- [ ] Return only active teams

### `GET /api/teams/:id`
- [ ] Verify team exists and active
- [ ] Verify requester is owner or active member in that team
- [ ] Return normalized role/capability flags

### `GET /api/teams/invitations/pending`
- [ ] Match invitation rows to requester identity only
- [ ] Restrict to active teams
- [ ] Avoid leaking unrelated member data

### `GET /api/teams/:id/billing`
- [ ] Require billing-read permission in same team
- [ ] Query credits strictly by `team: team._id`
- [ ] Do not include unrelated teams’ ledger rows

### `GET /api/teams/:id/assignments`
- [ ] Require membership in same team
- [ ] Add explicit team predicate on job query (not only assignedTo list)
- [ ] Ensure selected fields are least-privilege

### `GET /api/teams/:id/activity`
- [ ] Require active member in same team
- [ ] Source only team-owned member/billing events
- [ ] Redact sensitive event payloads

### `GET /api/teams/:id/pending-approvals`
- [ ] Require approval-read permission in same team
- [ ] Query approvals/jobs by both `team` and `status`

### Public endpoints
- `GET /api/teams/agencies/public`
  - [ ] Explicitly restrict to agency + public + active
  - [ ] Return public-safe fields only
- `GET /api/teams/agency/:slug`
  - [ ] Restrict to agency + public + active
  - [ ] Prevent private/member-only data leakage in payload

---

## C) Mutation endpoints checklist

### `POST /api/teams`
- [ ] Owner on create must equal requester
- [ ] Create initial owner membership atomically
- [ ] Add user.team reference idempotently

### `PUT /api/teams/:id`
- [ ] Require team-scoped update permission
- [ ] Apply allowed-field whitelist only
- [ ] Audit log before/after summary

### `POST /api/teams/:id/invite`
- [ ] Require team-scoped invite permission
- [ ] Enforce invite uniqueness for pending/active states
- [ ] Reactivation path must not duplicate membership
- [ ] Store/send invite with idempotent behavior

### `POST /api/teams/:id/accept` / `decline`
- [ ] Invitation must belong to requester and same team
- [ ] Accept operation idempotent (double-click safe)
- [ ] User-team ref add/remove idempotent

### `DELETE /api/teams/:id/members/:userId`
- [ ] Target member must belong to same team
- [ ] Owner cannot be removed
- [ ] Self-leave vs admin-remove enforced by policy
- [ ] User-team ref removal scoped to same team only

### `PATCH /api/teams/:id/members/:userId`
- [ ] Target member belongs to same team
- [ ] Owner role immutable via this route
- [ ] Admin promotion restricted by owner policy
- [ ] Role update uses race-safe conditional write/versioning

### `DELETE /api/teams/:id`
- [ ] Owner-only + same-team check
- [ ] Block delete during ownership transfer state
- [ ] Soft-delete scoped to that team only
- [ ] Member team-ref cleanup scoped to that team only

### Billing/assignment/approval mutations
- `POST /:id/billing/add-funds`
  - [ ] Billing manage permission in same team
  - [ ] Approval threshold hook enforced (when enabled)
- `POST /:id/assign`
  - [ ] Assignee must be active member of same team
  - [ ] Job/service order lookup must be team-scoped (critical)
- `POST /:id/approve/:jobId`
  - [ ] Approval permission in same team
  - [ ] Job lookup by both job id + team id
  - [ ] Exact-once approve/reject guard

---

## D) Export/analytics scoping checklist (current + future)
- [ ] Every export endpoint includes explicit `teamId/orgId` filter
- [ ] Analytics aggregations include tenant predicate at first stage
- [ ] CSV/PDF generation receives already-scoped dataset only
- [ ] Background jobs carry tenant context and verify permissions at execution time

---

## E) Monitoring checks for tenant leaks
- [ ] Add log field: `tenantScope.teamId` for all team routes
- [ ] Alert on suspicious patterns (resource teamId != requester team context)
- [ ] Add security test cases for IDOR attempts across team ids

---

## Done criteria
- Team-scoping predicate exists for every route + dependent model query
- Assignment/job queries are explicitly tenant-scoped
- Export/analytics paths have tenant guardrails
- IDOR regression tests added for list/detail/mutation/export surfaces
