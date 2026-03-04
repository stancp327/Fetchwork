# Mobile Teams Phase 3 E2E Checklist

Use this after deploying latest `main` to verify mobile parity for Teams Phase 3a/3b.

## Preconditions
- Mobile app built from latest `main`
- Backend live and healthy
- Test users available:
  - Owner/admin account
  - Member account
  - Client account (not team member)
- One existing team (agency recommended)

## Quick API Smoke (optional)
Run:

```bash
cd server
npm run smoke:teams:phase3
```

Consolidated Phase 3 QA runner (Windows PowerShell):

```powershell
cd <repo-root>
powershell -ExecutionPolicy Bypass -File .\scripts\run-phase3-qa.ps1
```

This writes a report to:
- `tasks/reports/phase3-qa-<timestamp>.md`

Authenticated variant:

```bash
AUTH_TOKEN=<jwt> TEAM_ID=<teamId> CLIENT_ID=<clientId> ORG_ID=<orgId> npm run smoke:teams:phase3
```

Expected: all checks pass (200/403/404 as allowed in script output).

---

## 1) Organizations (Phase 3a)
### 1.1 Create + open org detail
- Go to Profile → Teams
- Create Organization with name + description
- Tap **Manage** on created org
- Verify org detail renders

### 1.2 Departments
- Add department (name required)
- Verify appears in list
- Remove department
- Verify disappears

### 1.3 Team assignment
- Add existing team to org
- Verify team appears under "Teams in Organization"
- Remove team from org
- Verify removed

### 1.4 Org settings editor
- Toggle monthly cap ON/OFF
- Toggle payout approvals ON/OFF
- Toggle dual control ON/OFF
- Enter numeric values:
  - monthly cap >= 0
  - alert threshold 0–100
  - payout threshold >= 0
- Save settings
- Re-open org detail and verify persisted values

---

## 2) Team controls + inheritance visibility (Phase 2/3)
### 2.1 Team controls source
- Open Team Detail
- Verify "Settings source" shows (`team`/`org`/`merged`)

### 2.2 Numeric controls
- Edit monthly cap / alert threshold / payout threshold
- Save
- Verify values persist after refresh

### 2.3 Validation
- Try invalid values:
  - monthly cap < 0
  - threshold > 100
  - payout threshold < 0
- Verify client-side validation blocks save with clear error

---

## 3) Custom Roles (Phase 3b)
### 3.1 Create role
- Add custom role name
- Pick permission chips
- Save role
- Verify role appears

### 3.2 Edit role
- Tap Edit role
- Change name and permissions
- Save
- Verify updated values

### 3.3 Assign role to member
- In Members section, assign custom role to non-owner member
- Verify member row shows `custom: <role>`
- Clear role and verify removal

### 3.4 Delete role safety
- Attempt delete role while assigned to active member
- Verify blocked
- Clear assignments, then delete role

---

## 4) Linked Clients (Phase 3b)
### 4.1 Lookup + select client
- In Linked Clients, search by name/email
- Select user from results (no raw ID required)

### 4.2 Link client
- Choose access level
- Set optional project label
- Link client
- Verify row appears with label + access level

### 4.3 Update linked client
- Change access level via inline buttons
- Edit project label
- Save
- Verify values persist

### 4.4 Unlink client
- Unlink
- Verify row removed

---

## 5) Permission boundaries
- Member (non-admin) account:
  - Should not manage org settings/custom roles/linked clients
- Client account:
  - Verify access snapshot endpoint behavior is scoped

---

## Pass/Fail Template
- Build/Commit tested:
- Device/OS:
- Backend URL:
- ✅ Passed:
- ❌ Failed:
- Repro steps for failures:
- Screenshots/recordings:
