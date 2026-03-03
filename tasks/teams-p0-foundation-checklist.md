# Teams P0 Foundation Checklist
_Last updated: 2026-03-03_

## Objective
Lock down authorization, tenant scoping, and owner-safety invariants before additional Teams feature expansion.

## Work items
- [x] Authorization/policy map for current Teams endpoints (action -> required permission -> resource scope) — v1 in `tasks/teams-authz-scoping-matrix.md`
- [x] Tenant-scoping checklist for read/write/export/analytics paths — `tasks/teams-tenant-scoping-checklist.md`
- [x] Owner transfer/delete invariants and race-safety design — `tasks/teams-owner-transfer-delete-invariants.md`
- [x] Regression checklist for historical Teams bugs — `tasks/teams-regression-test-matrix.md`

## Done definition
- Centralized policy mapping documented and applied route-by-route
- No endpoint can access cross-team resources without explicit scoped checks
- Owner operations are atomic and cannot leave invalid ownership states
- Test matrix defined for authz, scoping, and concurrency edge cases
