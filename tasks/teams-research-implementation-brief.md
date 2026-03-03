# Fetchwork Teams/Agency — Research-Informed Implementation Brief
_Last updated: 2026-03-03_

## Scope
This brief focuses on building a top-tier Teams/Agency system for Fetchwork with production reliability, monetization readiness, and clean operational controls.

It is tailored to known issues we hit in production ("Team not found" after create/open, inconsistent owner controls, query/ID mismatches, endpoint coupling failures) and avoids generic code dumps.

---

## 1) Problem Taxonomy (What has likely gone wrong)

### A. Identity mismatch failures
**Symptom:** Team create succeeds but detail/list can fail or hide records.

**Likely causes:**
- Mixed ObjectId/string comparisons across owner/member lookups
- Inconsistent source of truth for current user id (`req.user.userId` vs `_id`)
- Population state differences causing role checks to branch differently

### B. Authorization drift
**Symptom:** Delete/manage controls intermittently absent for owner.

**Likely causes:**
- UI computes ownership from incomplete local data
- Backend and frontend use different role/ownership logic
- Owner fallback logic not canonicalized

### C. Query coupling and partial-failure coupling
**Symptom:** One endpoint failure (e.g., invitations) degrades unrelated list rendering.

**Likely causes:**
- Multi-call UI flow without failure isolation
- Overly strict Promise behavior causing broad fallback state

### D. Membership lifecycle inconsistencies
**Symptom:** Re-invite / removed-member behavior creates edge-case access defects.

**Likely causes:**
- State transitions not treated as explicit finite states
- Missing invariants for owner record, active member uniqueness, and mutation idempotency

### E. Observability blind spots
**Symptom:** Hard to reproduce and confirm root cause quickly.

**Likely causes:**
- No structured event logs around team authz decisions
- No correlation IDs / decision logging for access checks

---

## 2) Target Architecture Principles

1. **Single source of truth for user identity at request boundary**
   - Normalize once in auth middleware (`requesterId` as canonical string + ObjectId)

2. **Single source of truth for role resolution**
   - Backend always computes and returns normalized flags:
   - `currentUserRole`, `currentUserIsOwner`, `currentUserCanManageMembers`, `currentUserCanDelete`

3. **Never trust UI for authorization**
   - UI is display only; backend enforces all action constraints

4. **Failure isolation by endpoint concern**
   - Team list endpoint success must not depend on invites endpoint success

5. **Idempotent and invariant-driven membership mutations**
   - Invite/reactivate/remove/role-change paths should enforce state transition rules explicitly

6. **Auditability first for sensitive actions**
   - Ownership transfer, role escalation, member removal, billing approvals, and delete actions are always logged

---

## 3) Data Model & Index Recommendations

## Team collection
- `owner: ObjectId`
- `members[]: { user:ObjectId, role, status, permissions[], invitedAt, joinedAt, removedAt, invitedBy }`
- `isActive: boolean`
- `settings: { requireApproval, approvalThreshold, defaultMemberPermissions }`

## Constraints/Invariants
- Exactly one owner semantic (owner field is canonical)
- Owner must always have active membership representation (or deterministic owner fallback path)
- Member uniqueness by `(teamId, userId)` logical invariant
- Status transitions only through valid graph (invited -> active -> removed; removed -> invited via explicit reactivation)

## Suggested indexes
- `{ isActive: 1, owner: 1 }`
- `{ isActive: 1, 'members.user': 1, 'members.status': 1 }`
- `{ type: 1, isPublic: 1, isActive: 1 }` for agency directory
- `{ slug: 1 }` unique if used for public agency route

---

## 4) Backend API Patterns (Actionable)

### A. Read-path hardening
- For `/api/teams`:
  - Query owned teams and member teams independently
  - Merge/dedupe in-memory by team id
  - Normalize role flags in response

### B. Mutation-path hardening
- Invite member:
  - Validate inviter permission via canonical role resolver
  - Enforce role escalation constraints (only owner can invite/promote admin)
  - Reactivate removed users safely (no duplicate member records)
- Remove member:
  - Explicitly block owner removal
  - Require either self-leave or `manage_members`
- Delete team:
  - Owner-only check with canonical owner identity

### C. Response contract standardization
All team detail/list responses return:
- Canonical ownership flags
- Canonical current-user role
- Canonical manage/delete capability flags

### D. Transactional thinking for sensitive mutations
Where possible, ensure multi-write operations (team + user refs + billing side-effects) are atomic or compensatable.

---

## 5) Frontend Reliability Patterns

1. **Consume backend role flags as primary signal**
   - Local role derivation only as fallback, not primary authority

2. **Isolate endpoint failures**
   - Continue rendering teams even if invitations fails
   - Render contextual retry actions per failed data source

3. **Access-state UX clarity**
   - Always show current access badge (Owner/Admin/Member)
   - Disabled controls should explain why (permission hint)

4. **Defensive render strategy**
   - Avoid brittle conditional render paths for critical controls (e.g., delete entry point visibility)

---

## 6) Authorization & Security Best Practices to Apply

- Least privilege defaults for member permissions
- Explicit deny for privilege escalation paths
- Server-side permission checks on every mutation endpoint
- Sensitive action audit logging (who, what, when, previous->next)
- Rate limits on invite and role mutation endpoints
- Input validation for all ids and role fields

---

## 7) Observability & Diagnostics

Add structured logs for every sensitive route:
- `teamId`, `requesterId`, `resolvedRole`, `action`, `allowed`, `reason`

Metrics to track:
- Team list/detail 4xx/5xx rates
- Invite acceptance/decline funnel
- Role update failures by reason
- Team delete attempts (authorized vs unauthorized)
- Endpoint partial-failure rates (list success + invites fail)

---

## 8) Test Strategy (Must-have)

### Unit
- Role resolver normalization tests (ObjectId/string/populated variants)
- Ownership resolution matrix tests

### Integration
- Create -> list -> detail consistency
- Invite -> accept -> role update -> remove -> re-invite lifecycle
- Owner-only delete enforcement
- Partial endpoint outage behavior (invites fail, list still renders)

### E2E
- Owner flow on web + mobile parity
- Admin/member restricted UI and blocked actions
- Regression for historical bug signatures ("Team not found", hidden delete controls)

---

## 9) Rollout Strategy (Phase Gates)

### Phase 1: Reliability Baseline (now)
- Canonical identity/role resolver
- Read/mutation path hardening
- Response normalization
- Observability and regression tests

### Phase 2: Monetization-Ready Team Ops
- Billing approvals
- Spend thresholds/alerts
- Team dashboards and exports
- Team plan entitlements

### Phase 3: Premium/Enterprise
- Advanced audit exports
- Custom roles
- Org hierarchy
- SSO readiness and stronger compliance controls

---

## 10) Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Identity normalization drift returns | High | Canonical request user resolver + shared helper tests |
| UI/backend permission divergence | High | Backend normalized flags + UI consumes flags first |
| Multi-write inconsistencies | Medium/High | Transactions or compensating jobs + audit log |
| Invite spam/abuse | Medium | Rate limits + invite quotas + audit alerts |
| Hidden regressions after refactors | Medium | Bug-signature regression suite + release checklist |

---

## Immediate next 10 actions (this week)

1. Add a shared `resolveRequesterIdentity()` helper and use it in all Teams routes.
2. Add a shared `normalizeTeamForUser()` contract test suite (owner/admin/member cases).
3. Add Mongo indexes for owner/member active queries and verify query plans.
4. Add structured authorization decision logs in team mutation endpoints.
5. Add regression integration tests for create/list/detail consistency and owner delete visibility.
6. Add lifecycle tests for invite/reactivate/remove/reinvite edge cases.
7. Add frontend test for list rendering when invitations endpoint fails.
8. Add permission-hint UX for disabled destructive controls.
9. Add release checklist item: “Teams role/ownership smoke test (web + mobile)”.
10. Define and track 5 Teams reliability metrics in admin monitoring dashboard.
