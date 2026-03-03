# Teams Regression Test Matrix (P0 Artifact #4)
_Last updated: 2026-03-03_

## Objective
Define regression coverage for historical issues + high-risk new controls before feature build expands.

---

## A) Historical bug signature coverage

## 1) "Create succeeded but Team not found"
- [ ] Create team -> immediate list returns new team
- [ ] Create team -> immediate detail load succeeds
- [ ] Works with owner id in object and string forms

## 2) Owner controls inconsistent visibility
- [ ] Owner sees delete/manage controls consistently in Team detail
- [ ] Non-owner sees disabled/hidden controls with safe explanation
- [ ] Backend still denies unauthorized delete regardless of UI

## 3) List breakage when invitations endpoint fails
- [ ] Simulate invite endpoint failure while team list succeeds
- [ ] Team list still renders
- [ ] Invite section shows isolated error/retry behavior

## 4) Owner/member query edge cases
- [ ] Team appears when owner membership row is missing but owner field matches
- [ ] Team appears when member row active and owner is someone else
- [ ] Owner+member duplicate query paths dedupe correctly

---

## B) Authorization + tenant isolation tests
- [ ] User from Team A cannot read Team B detail by id (IDOR)
- [ ] User from Team A cannot mutate Team B members/roles
- [ ] User from Team A cannot access Team B billing/activity/assignments
- [ ] Public agency endpoints return only public-safe fields

---

## C) Invite lifecycle tests
- [ ] Duplicate invite prevention for same email/team pending state
- [ ] Re-invite removed member follows reactivation path without duplicates
- [ ] Accept invite idempotent (double submit safe)
- [ ] Decline invite idempotent behavior
- [ ] Expired invite cannot be accepted

---

## D) Owner transfer/delete race-safety tests
- [ ] Transfer vs delete race: only one succeeds
- [ ] Dual transfer race: only one succeeds
- [ ] Owner cannot be removed via member remove route
- [ ] Delete blocked while transfer state in progress

---

## E) Billing/approval exact-once tests
- [ ] Billing add-funds action retries do not duplicate logical transaction
- [ ] Approval decide endpoint does not double-apply action on retry
- [ ] Approval permission checks enforce same-team only

---

## F) Assignment scoping tests
- [ ] Assign endpoint rejects job not belonging to team
- [ ] Assign endpoint rejects assignee not active in team
- [ ] Assignments list only includes team-scoped work

---

## G) Mobile parity smoke tests
- [ ] Create team (mobile)
- [ ] Invite + member management (mobile)
- [ ] Owner/admin/member permission behavior consistent with web
- [ ] Delete controls and denial states consistent with backend rules

---

## H) Release gate checklist
- [ ] All critical historical signatures green
- [ ] Tenant isolation tests green
- [ ] Owner/delete race tests green
- [ ] Invite idempotency tests green
- [ ] Assignment team-scoping tests green
- [ ] Manual owner/admin/member role walkthrough on production-like env
