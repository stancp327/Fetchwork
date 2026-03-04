# Mobile Teams Phase 3 Parity Audit
_Last updated: 2026-03-03_

## Scope audited
- `mobile/src/api/endpoints/teamsApi.ts`
- `mobile/src/screens/Profile/TeamsScreen.tsx`
- `mobile/src/screens/Profile/TeamDetailScreen.tsx`

## Parity checklist

### Phase 3a (Organizations)
- [x] API: list organizations (`GET /api/organizations/mine`)
- [x] API: create organization (`POST /api/organizations`)
- [x] Mobile UI: Organizations section in Teams screen (list + create)
- [ ] Mobile UI: organization detail/edit/departments/team-assignment management

### Phase 3b (Custom Roles)
- [x] API: custom role CRUD endpoints
- [x] API: assign member custom role
- [x] Mobile UI: create/delete custom roles in Team detail
- [x] Mobile UI: assign/clear custom role from members section
- [ ] Mobile UI: edit custom roles in place
- [ ] Mobile UI: richer permission picker (currently comma-separated input)

### Phase 3b (Linked Clients)
- [x] API: list/create/update/remove linked clients
- [x] API: client access snapshot endpoint
- [x] Mobile UI: list/link/unlink linked clients in Team detail
- [ ] Mobile UI: update linked client access level/project label
- [ ] Mobile UI: client search by email/lookup (currently user-id input)

### Phase 2+ controls response parity
- [x] API typing updated for spend controls including `effectiveSource`
- [ ] Mobile controls UI awareness of `effectiveSource` source badge

## Redundant/unused code cleanup done
- Added explicit Phase 3 typed models in `teamsApi.ts` to remove ad-hoc `any` usage in callers.
- Unified endpoint surface in `teamsApi.ts` to avoid duplicate manual request construction in screens.
- Kept existing flows intact; no destructive removals in this pass.

## What remains (next pass)
1. TeamDetailScreen: convert custom-role permission entry from comma-separated text to checkbox chips.
2. TeamDetailScreen: add linked-client edit action (access level + project label).
3. TeamsScreen: add organization detail drawer/screen for departments and team-org assignment.
4. Team controls UI: show org inheritance status (`effectiveSource`) in mobile controls.
5. Add dedicated integration/e2e tests for mobile-facing Phase 3 flows (API contract-level tests already exist server-side).

## Files touched in this pass
- `mobile/src/api/endpoints/teamsApi.ts`
- `mobile/src/screens/Profile/TeamsScreen.tsx`
- `mobile/src/screens/Profile/TeamDetailScreen.tsx`
- `tasks/mobile-teams-phase3-parity-audit.md`
