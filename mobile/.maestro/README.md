# Maestro mobile smoke (Teams Phase 3)

## Flow files
- `teams-phase3-smoke.yaml` — baseline owner/admin smoke path

## Preconditions
- App installed on simulator/device (`com.fetchwork.app`)
- User is already logged in
- At least one team exists
- Prefer owner/admin user so all sections are visible

## Run
```bash
cd mobile
maestro test .maestro/teams-phase3-smoke.yaml
```

## Notes
- This is a lightweight smoke flow, not full e2e coverage.
- Full scenario coverage remains documented in:
  - `tasks/mobile-teams-phase3-e2e-checklist.md`
