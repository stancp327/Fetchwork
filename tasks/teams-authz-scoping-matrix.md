# Teams Endpoint Authorization + Tenant-Scoping Matrix (v1)
_Last updated: 2026-03-03_
_Source audited: `server/routes/teams.js`_

## Goal
Create a single policy/scoping map for all existing Teams endpoints so we can centralize authz and prevent tenant leaks/role drift.

## Recommended permission vocabulary (target state)
- `teams.read`
- `teams.create`
- `teams.update`
- `teams.delete`
- `members.invite`
- `members.remove`
- `members.update_role`
- `invites.respond`
- `billing.manage`
- `billing.read`
- `work.assign`
- `work.read_assignments`
- `activity.read`
- `approvals.read`
- `approvals.decide`
- `agencies.read_public`
- `agencies.manage_portfolio`

---

## Endpoint matrix

| Endpoint | Current gate in code | Required scope check | Target permission | Gap / risk |
|---|---|---|---|---|
| `GET /api/teams` | Auth only + owner/member split query | Only teams where requester is owner or active member | `teams.read` | Good pattern; needs centralized identity resolver (`requesterId` normalization) |
| `POST /api/teams` | Auth only | Team owner must be requester; type allowed list | `teams.create` | Missing explicit policy layer call |
| `GET /api/teams/:id` | Must be active member or owner | Team must be active and requester belongs to same team | `teams.read` | Mixed ID usage across codebase still a maintenance risk |
| `PUT /api/teams/:id` | `team.isOwnerOrAdmin(req.user.userId)` | Team membership + role in same team | `teams.update` | Hardcoded role helper; should route through policy engine |
| `POST /api/teams/:id/invite` | `manage_members` permission | Team-scoped invite only; invitee uniqueness in team | `members.invite` | No idempotency key; invite token lifecycle still basic |
| `POST /api/teams/:id/accept` | Member entry status must be `invited` | Invite must belong to requester and same team | `invites.respond` | Uses `req.user.userId` string compare; normalize once |
| `POST /api/teams/:id/decline` | Same as accept | Same as accept | `invites.respond` | Same normalization concern |
| `DELETE /api/teams/:id/members/:userId` | Self-leave OR `manage_members` | Target member must belong to same team; owner cannot be removed | `members.remove` | No explicit atomic guard for concurrent member-role change |
| `PATCH /api/teams/:id/members/:userId` | `manage_members`, owner-only for admin promote | Target member in same team; owner immutable | `members.update_role` | Race risk on concurrent role updates; add conditional update/versioning |
| `GET /api/teams/invitations/pending` | Auth only + member status invited | Must only return invitations for requester | `invites.respond` | Query uses nested member fields directly; fine but should be helperized |
| `DELETE /api/teams/:id` | Owner check via ownerId or owner role | Same-team ownership and active state | `teams.delete` | High-risk action lacks explicit transfer/delete lock invariant |
| `GET /api/teams/agencies/public` | Auth only currently | Public-only, active-only agency rows | `agencies.read_public` | Should likely be public endpoint/no auth or explicitly policy-marked public |
| `GET /api/teams/agency/:slug` | Auth only currently | Must enforce type=agency, isPublic, isActive | `agencies.read_public` | Same as above |
| `POST /api/teams/:id/portfolio` | `manage_services` + team type check | Team membership + agency type | `agencies.manage_portfolio` | Permission naming not unified with policy set |
| `DELETE /api/teams/:id/portfolio/:itemId` | `manage_services` | Team membership + portfolio item belongs to team | `agencies.manage_portfolio` | Needs explicit not-found vs forbidden behavior policy |
| `POST /api/teams/:id/billing/add-funds` | `manage_billing` | Team membership + billing permission same team | `billing.manage` | No approval hook for high-amount ops yet |
| `GET /api/teams/:id/billing` | `manage_billing` OR `view_analytics` | Same-team access | `billing.read` | Should separate finance-read from analytics-read permission |
| `POST /api/teams/:id/assign` | `assign_work` | Assignee must be active member in same team; job/order must be team-scoped | `work.assign` | **Important:** job lookup by id currently not team-scoped before assign |
| `GET /api/teams/:id/assignments` | `team.isMember()` | Only return assignments for team members/jobs in that team | `work.read_assignments` | Currently filters by assignedTo list, but not explicit `team: team._id` guard |
| `GET /api/teams/:id/activity` | Active member check | Same team only; activity entries derived from that team | `activity.read` | Good baseline; add log redaction policy before scaling |
| `GET /api/teams/:id/pending-approvals` | `approve_orders` OR owner/admin | Team-scoped approvals only | `approvals.read` | Permission currently role+flag mixed; unify in policy check |
| `POST /api/teams/:id/approve/:jobId` | Same as above | Job must belong to same team | `approvals.decide` | Needs exact-once/idempotent execution guard |

---

## Highest-risk gaps to fix first (P0)
1. **Centralize identity resolution** (`requesterId` helper) and call policy layer for every route.
2. **Team-scope all cross-model writes/reads** (notably assignment path for `Job.findById(jobId)`).
3. **Owner delete/transfer invariants**: enforce single-owner guarantee with atomic conditional updates.
4. **Role mutation race safety**: add optimistic concurrency/version check for member role updates.
5. **Approval action idempotency**: guard against duplicate approve/reject execution paths.

---

## Immediate implementation tasks from this matrix
- [ ] Create `authorizeTeamAction({ requesterId, team, action, resource })` helper and apply per endpoint.
- [ ] Create `resolveRequester(req)` helper that emits canonical string/ObjectId forms.
- [ ] Patch assignment endpoints to enforce team scoping on target work items.
- [ ] Add atomic owner-action guard pattern for delete/transfer paths.
- [ ] Introduce denial reason codes for UI-safe permission hints.
