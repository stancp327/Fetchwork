# Maestro mobile smoke (Teams Phase 3)

## Flow files
- `teams-phase3-smoke.yaml` — baseline owner/admin smoke path
- `teams-phase3-org-settings.yaml` — org settings persistence scenario
- `teams-phase3-custom-roles.yaml` — custom role lifecycle scenario
- `teams-phase3-linked-clients.yaml` — linked client lifecycle scenario

## Preconditions
- Maestro CLI installed: https://docs.maestro.dev/getting-started/installing-maestro
- App installed on simulator/device (`com.fetchwork.app`)
- User is already logged in
- At least one team exists
- Prefer owner/admin user so all sections are visible

## Run
```bash
cd mobile
maestro test .maestro/teams-phase3-smoke.yaml
maestro test .maestro/teams-phase3-org-settings.yaml
maestro test .maestro/teams-phase3-custom-roles.yaml
maestro test .maestro/teams-phase3-linked-clients.yaml
```

Or run all phase-3 flows:
```bash
cd mobile
npm run e2e:maestro:teams:phase3:all
```

Windows helper (does prerequisite checks + runs all):
```powershell
cd mobile
npm run e2e:maestro:teams:phase3:ps
```

The PowerShell runner writes a timestamped report to:
- `tasks/reports/mobile-teams-phase3-maestro-<timestamp>.md`


## Notes
- This is a lightweight smoke flow, not full e2e coverage.
- Full scenario coverage remains documented in:
  - `tasks/mobile-teams-phase3-e2e-checklist.md`
