# Teams "Awesome" Spec — Fetchwork

_Status: Draft v1 (execution-ready outline)_
_Owner: Igor_
_Date: 2026-03-03_

## Product Goal
Make Teams a first-class operating system for small agencies and client teams: discoverable, easy to onboard, permission-safe, payout-ready, and local/remote aware.

## Success Criteria
- Team owner can create team, invite members, assign roles/titles, and manage member lifecycle.
- Team members can see only actions they’re allowed to perform.
- Team workflows support both remote and local service operations.
- Team billing + payout actions are auditable and safe.
- Web + mobile parity for core team operations.

---

## Phase 1 — Reliability + Access (Immediate)
### Objectives
1. Fix post-create/detail reliability bugs (no false "Team not found").
2. Ensure users can always recover (retry/back flow).
3. Improve discoverability of Teams entry points.

### Deliverables
- [ ] Web TeamDetail: robust error states (404 vs permission vs network)
- [ ] Create Team redirect fallback (open from list if detail fails)
- [ ] Dashboard quick action to /teams
- [ ] Profile + More menu Teams link parity (web/mobile)

### Acceptance
- User can create team and always reach it or receive actionable error.

---

## Phase 2 — Member Management + Roles (Core UX)
### Objectives
- Team owner/admin can operate a real member directory.

### Data Model Additions (Team.members)
- `title` (already present)
- `department` (new)
- `locationMode` (new enum: `local` | `remote` | `hybrid`)
- `serviceRadiusMiles` (new, local only)
- `isPayoutEligible` (new boolean)

### Permissions Matrix
- owner: full
- admin: full except delete team/transfer ownership
- manager: invite member, assign work, view billing (optional by permission), no role escalation to admin
- member: standard contributor access

### Deliverables
- [ ] Member list with role + title + status + location mode
- [ ] Promote/demote role controls
- [ ] Edit title/department/location mode
- [ ] Remove/restore member actions
- [ ] Invitation resend + revoke

### Acceptance
- Owner can fully manage team roster without DB/admin manual intervention.

---

## Phase 3 — Team Work + Assignment
### Objectives
- Teams can execute and track work cleanly.

### Deliverables
- [ ] Team assignment board (job/service order -> assigned member)
- [ ] Assignment filters: status, assignee, local vs remote
- [ ] Team activity timeline (assignment + membership + billing events)
- [ ] Shared conversation toggle support

### Acceptance
- Team leader can assign, monitor, and reassign work in-app.

---

## Phase 4 — Billing + Payout Governance
### Objectives
- Team money movement should be controlled and auditable.

### Deliverables
- [ ] Team wallet top-up/history improvements
- [ ] Payout approval workflow (threshold-based)
- [ ] Payout eligibility per member
- [ ] Split payout rules (by assignment/milestone)
- [ ] Billing audit log UI

### Acceptance
- Sensitive money actions are permission-gated + logged.

---

## Phase 5 — Local vs Remote Team Intelligence
### Objectives
- Make team operations explicitly local/remote-aware.

### Deliverables
- [ ] Team profile tags: Local-ready, Remote-ready, Hybrid
- [ ] Member geo capability fields + travel preferences
- [ ] Assignment guardrails (don’t assign onsite-only jobs to remote-only members)
- [ ] Team-level service radius and coverage map (v1 list-based)

### Acceptance
- Team assignment and discovery respect local/remote constraints.

---

## Phase 6 — Accessibility + Onboarding
### Objectives
- Reduce friction for first-time teams.

### Deliverables
- [ ] Team onboarding wizard (create team -> invite -> assign first task)
- [ ] Empty state coaching copy everywhere
- [ ] Mobile parity checklist completion
- [ ] Keyboard + screen-reader-friendly interactions for web member management

### Acceptance
- New team can onboard and complete first assignment in <10 min.

---

## API/Backend Additions (Proposed)
- `PATCH /api/teams/:id/members/:userId/profile` (title, department, locationMode, serviceRadiusMiles, isPayoutEligible)
- `POST /api/teams/:id/invite/resend`
- `DELETE /api/teams/:id/invite/:userId` (revoke pending invite)
- `POST /api/teams/:id/transfer-ownership`
- `GET /api/teams/:id/audit`

---

## UI Surface Plan
### Web
- TeamsPage (list/create/invites)
- TeamDetail tabs: Members / Assignments / Billing / Activity / Settings / Audit

### Mobile
- TeamsScreen + TeamDetailScreen parity
- Member profile edit sheet (role/title/location mode)
- Assignment summary cards

---

## Rollout Order (Recommended)
1. Phase 1 reliability/access
2. Phase 2 member management
3. Phase 4 billing/payout governance
4. Phase 3 assignment polish
5. Phase 5 local/remote intelligence
6. Phase 6 onboarding/accessibility polish

---

## Immediate Next Build Slice (start now)
- [ ] Fix TeamDetail false-negative load state fully (web)
- [ ] Add explicit permission/404/network error rendering
- [ ] Add member title edit in TeamDetail UI
- [ ] Add invite revoke/resend endpoints + UI hooks

