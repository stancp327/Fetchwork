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
- [x] API: organization detail + department/team assignment endpoints wired in mobile client
- [x] Mobile UI: Organizations section in Teams screen (list + create)
- [x] Mobile UI: organization detail management (departments + add/remove teams)
- [x] Mobile UI: org settings editor (spend controls / approval thresholds)

### Phase 3b (Custom Roles)
- [x] API: custom role CRUD endpoints
- [x] API: assign member custom role
- [x] Mobile UI: create/delete custom roles in Team detail
- [x] Mobile UI: assign/clear custom role from members section
- [x] Mobile UI: richer permission picker (tap-to-toggle permission chips)
- [x] Mobile UI: edit custom roles in place

### Phase 3b (Linked Clients)
- [x] API: list/create/update/remove linked clients
- [x] API: client access snapshot endpoint
- [x] Mobile UI: list/link/unlink linked clients in Team detail
- [x] Mobile UI: update linked client access level (inline access buttons)
- [x] Mobile UI: project-label edit for existing linked clients
- [x] Mobile UI: client search by email/lookup

### Phase 2+ controls response parity
- [x] API typing updated for spend controls including `effectiveSource`
- [x] Mobile controls UI awareness of `effectiveSource` source badge

## Redundant/unused code cleanup done
- Added explicit Phase 3 typed models in `teamsApi.ts` to remove ad-hoc `any` usage in callers.
- Unified endpoint surface in `teamsApi.ts` to avoid duplicate manual request construction in screens.
- Kept existing flows intact; no destructive removals in this pass.

## What remains (next pass)
1. Execute Maestro flows on a connected device/simulator and capture any remaining flaky selectors (core controls now have testIDs).
2. Optional UX refinement: convert validation text to per-field hints for numeric inputs.

## Files touched in this pass
- `mobile/src/api/endpoints/teamsApi.ts`
- `mobile/src/screens/Profile/TeamsScreen.tsx`
- `mobile/src/screens/Profile/TeamDetailScreen.tsx`
- `tasks/mobile-teams-phase3-parity-audit.md`
