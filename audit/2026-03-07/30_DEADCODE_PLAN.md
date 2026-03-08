# Dead Code & Optimization Plan — 2026-03-07

## Summary

**Audit scope:** Server (routes, models, services, utils, socket, tests) + Client (src)  
**Top issues found:**
- 5 Analytics schema fields defined but **never written to** (zero runtime calls)
- 3 Contract schema fields with zero usages outside model definition
- 1 confirmed dead client import (`apiRequest` in `AdminUsersTab.js`)
- `generateToken` duplicated verbatim across 3 test files — no shared helper exists
- 2 active TODO markers flagging incomplete Phase 3/4 features
- `twoFactorEnabled` field in Admin model — only the schema definition exists, never used in logic
- EmailLog webhook tracking fields (`resendId`, `openedAt`, `clickedAt`, `bouncedAt`) defined but webhook listener never wired up
- `admin.js` route file has **120 commented lines** (section headers + placeholder docs)
- `payments.js` has **89 commented lines**, `services.js` 77, `billing.js` 80
- `Review` reference in `User.js` line 401 uses `mongoose.model('Review')` — **NOT a duplicate model**, correct circular-dependency avoidance pattern

**Estimated dead/redundant lines:** ~60–80 lines of truly dead schema fields; ~30 lines of duplicated test utility code; 5 incomplete feature stubs.

---

## Unused Imports / Requires

> **Note:** The regex-based scanner flagged `jwt`, `configurePassport`, and `registerSocketEvents` in `index.js` due to substring matching. Manual verification confirmed all three **are actively used**. Similarly `BrowserRouter as Router` in `App.js` and `apiRequest` in `AdminUsersTab.js` — Router IS used (aliased), only `apiRequest` is genuinely dead.

| File | Variable | Imported From | Safe to Remove? |
|------|----------|---------------|-----------------|
| `client/src/components/admin/AdminUsersTab.js` | `apiRequest` | `../../utils/api` | **YES** — imported on line 2, never called anywhere in file; all actions are passed in as props |

---

## Duplicate Logic

| Pattern | Files | Lines | Recommendation |
|---------|-------|-------|----------------|
| `generateToken` (JWT sign with test-secret) | `disputes.test.js:101`, `errors.test.js:112`, `jobs.test.js:93` | Identical in disputes.test + errors.test; jobs.test adds `accountType` field | Extract to `server/__tests__/setup/tokenHelper.js` and require from each test file. Low risk, high DRY value. |
| `generateAdminToken` | `disputes.test.js:109`, `errors.test.js:120` | Identical | Same fix — move to shared test helper |
| Section-header comment style (`// ═══`) | Multiple route files | Style choice | Not a bug, but inconsistent with some files using `// ---` — no action needed |

---

## TODO/FIXME Debt

### 🔴 High Priority (incomplete features shipped to prod)

| File | Line | Comment | Risk |
|------|------|---------|------|
| `disputes.js` | 726 | `// TODO Phase 4: execute Stripe action, then mark completed` | Financial action recorded as `status: 'pending'` but Stripe is never called — admin financial resolutions may silently fail to transfer funds |

### 🟡 Medium Priority (planned feature gap)

| File | Line | Comment | Risk |
|------|------|---------|------|
| `disputes.js` | 230 | `// TODO: Phase 3 — watermark the file here` | Evidence files uploaded without watermarking; `watermarked: false` set correctly as placeholder, but the field has 2 occurrences (schema + set) — Dispute model has `watermarkFailed: String` with **2 occurrences both in model definition** (defined twice — possible schema bug on line ~83) |

### 🟢 Low Priority (informational)

| File | Line | Comment | Risk |
|------|------|---------|------|
| `payments.js` | 165 | Block comment explaining Stripe PM security model | Not a TODO — documentation only |

---

## Schema Drift

Fields defined in Mongoose models but **never read or written** anywhere in the server codebase (confirmed by full-codebase grep, count = 1 meaning only the definition line):

### Analytics.js — `DailyStats` model
`DailyStats.increment()` is the only write path. These fields are defined in the schema but `increment()` is **never called** with any of these field names:

| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `servicesCreated` | 1 (schema only) | **Dead** — never incremented anywhere in routes/services |
| `disputesFiled` | 1 (schema only) | **Dead** — never incremented |
| `loginAttempts` | 1 (schema only) | **Dead** — never incremented (note: `Admin.loginAttempts` is separate and IS used) |
| `totalTransactionValue` | 1 (schema only) | **Dead** — never incremented |
| `platformFees` | 1 (schema only) | **Dead** — analytics route uses `platformFeesPaid` from Payment aggregations instead |

**Safe to remove:** YES for all 5 fields. They add schema weight with no runtime value. Or alternatively, wire up `DailyStats.increment('servicesCreated')` calls in the services/disputes routes if the tracking is desired.

### Admin.js
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `twoFactorEnabled` | 1 (schema only) | **Dead** — no 2FA logic implemented; field defined but never read or written |
| `twoFactorSecret` | 2 (schema + `delete adminObject.twoFactorSecret`) | **Maybe** — the delete in the serializer suggests it was planned and partially wired; keep for now but flag as incomplete feature |
| `loginAttempts` | 7 total | **Active** — used in auth lockout logic, safe |
| `lockUntil` | 9 total | **Active** — used in auth lockout logic, safe |

### Contract.js
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `signedAt` | 1 (schema only) | **Dead** — never set or read in any route/service |
| `documentFilename` | 1 (schema only) | **Dead** — never used |

**Safe to remove:** YES for `signedAt` and `documentFilename` unless contract signing is planned.

### Dispute.js
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `stripeRefundId` | 1 (schema only) | **Maybe** — would be set by Phase 4 Stripe action (see TODO above); keep until Phase 4 implemented |
| `watermarkFailed` | 2 (both in schema definition) | **Bug candidate** — field appears to be defined twice in `Dispute.js` schema; safe to deduplicate |

### EmailLog.js — Webhook tracking fields
These fields exist for Resend/SendGrid webhook callbacks but no webhook route is wired up:

| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `resendId` | 1 (schema only) | **Dead** — no webhook handler sets this |
| `openedAt` | 1 (schema only) | **Dead** — no webhook handler sets this |
| `clickedAt` | 1 (schema only) | **Dead** — no webhook handler sets this |
| `bouncedAt` | 1 (schema only) | **Dead** — no webhook handler sets this |
| `deliveredAt` | 10 total | **Active** — used in Message model and socket events (different context) |

**Safe to remove:** YES for `resendId`, `openedAt`, `clickedAt`, `bouncedAt` — OR implement the webhook endpoint. Keeping them is zero-cost but misleading.

### Booking.js — `endTime`
| Field | Verdict |
|-------|---------|
| `endTime` | **Active** — heavily used across BookingService, SQL controller, SlotEngine, GroupBooking. False positive from route-only scan. |

### Job.js — Recurring fields
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `parentJobId` | 3 | **Active** — used in `recurringCron.js` |
| `instanceCount` | 3 | **Active** — used in `recurringCron.js` |
| `archivedAt` | 8 | **Active** — set in model method + indexed |
| `archiveReason` | 6 | **Active** — set in archive method |

### BundlePurchase.js
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `scheduledFor` | 10 total | **Active** — used across codebase |

### BackgroundCheck.js
| Field | Occurrences | Verdict |
|-------|-------------|---------|
| `externalId` | checked | **Maybe** — verify against background check provider integration |

---

## Commented-Out Code

Files with the highest comment-line counts. **Most are section headers / inline documentation**, not commented-out dead code — but worth a targeted review pass.

| File | Commented Lines | Total Lines | % | Notes |
|------|----------------|-------------|---|-------|
| `admin.js` | 120 | 2,251 | 5.3% | Mostly section header banners + route docs. Check for any old route stubs. |
| `payments.js` | 89 | 976 | 9.1% | High ratio — security notes + some deactivated code blocks. Review manually. |
| `billing.js` | 80 | 1,133 | 7.1% | Section docs. Verify no old route handlers commented out. |
| `services.js` | 77 | 1,148 | 6.7% | Section docs. |
| `teams.js` | 69 | 1,893 | 3.6% | Section docs. |
| `disputes.js` | 53 | 888 | 6.0% | Includes TODO blocks — see debt section. |
| `feeEngine.js` | 48 | 362 | 13.3% | **Highest ratio** — fee calculation documentation + formula derivations. Legitimate but very dense. |
| `jobs.js` | 48 | 1,149 | 4.2% | Section docs. |
| `stripeService.js` | 41 | 475 | 8.6% | Likely includes disabled Stripe features — worth manual review. |
| `analytics.js` | 38 | 529 | 7.2% | Section docs. |
| `bookings.js` | 35 | 317 | 11.0% | High ratio for file size — manual review recommended. |

---

## "Review" in User.js — Not a Duplicate (Clarification)

`User.js` line 401: `const Review = mongoose.model('Review');`  
This is **correct Mongoose pattern** for avoiding circular `require()` in schema methods. It resolves the already-registered `Review` model at call time, not re-registering it. **Do not remove.**

---

## Quick Cleanup (Safe to Delete)

These are confirmed safe with no downstream risk:

1. **`AdminUsersTab.js` line 2** — remove `import { apiRequest } from '../../utils/api';`  
   Unused import; component receives all actions as props.

2. **`Analytics.js` fields** — remove from `dailyStatsSchema`:  
   `servicesCreated`, `disputesFiled`, `loginAttempts` (DailyStats version), `totalTransactionValue`, `platformFees`  
   Never written via `DailyStats.increment()`. No reads. Zero runtime impact.

3. **`Admin.js` field** — remove `twoFactorEnabled: { type: Boolean, default: false }`  
   Never read or set anywhere. `twoFactorSecret` has a serializer delete so keep that one for now.

4. **`Contract.js` fields** — remove `signedAt` and `documentFilename`  
   Both appear only in the schema definition. No read/write paths exist.

5. **`EmailLog.js` fields** — remove `resendId`, `openedAt`, `clickedAt`, `bouncedAt`  
   No webhook handler wires these up. `deliveredAt` stays (used in Message/socket).

6. **Create `server/__tests__/setup/tokenHelper.js`** — extract `generateToken` / `generateAdminToken`  
   Deduplicates identical code in `disputes.test.js`, `errors.test.js`, `jobs.test.js`.  
   Safe because it's test infrastructure only — no production impact.

---

## Requires Investigation

These need a human decision before touching:

1. **`Dispute.js` — `watermarkFailed` defined twice in schema**  
   Appears at ~line 83 twice. May be a copy-paste artifact. Read the raw model and deduplicate if confirmed.  
   **Action:** Read `server/models/Dispute.js` around line 80–90 before touching.

2. **`Admin.js` — `twoFactorSecret`**  
   Schema field + serializer delete (`delete adminObject.twoFactorSecret`) suggests 2FA was partially stubbed. Deleting the field would remove the serializer safety net.  
   **Action:** Decide if 2FA is on the roadmap. If yes, keep. If abandoned, remove both field and delete line.

3. **`Dispute.js` — `stripeRefundId`**  
   Required by Phase 4 Stripe refund execution (see TODO at line 726). Keep until Phase 4 is implemented.  
   **Action:** Implement Phase 4 or explicitly mark as deferred.

4. **`disputes.js` line 726 — Phase 4 financial action**  
   Financial resolutions are stored as `status: 'pending'` but Stripe is never called. This is a **functional gap**, not just dead code — admins may believe refunds are being executed when they are not.  
   **Action:** HIGH PRIORITY — either implement Stripe execution or add admin-facing warning that manual Stripe action is required.

5. **`BackgroundCheck.js` — `externalId`**  
   Only 1 occurrence (schema). May be required by background check provider integration not yet built.  
   **Action:** Check if background check provider integration is planned; if not, remove.

6. **`EmailLog.js` — webhook fields**  
   Schema is ready for Resend/SendGrid webhook delivery tracking (`openedAt`, `clickedAt`, `bouncedAt`). No handler exists.  
   **Action:** Either implement the webhook endpoint (`POST /api/webhooks/email`) or remove the fields.

7. **`stripeService.js` — 41 commented lines**  
   High comment ratio for a service file. Review manually for any disabled Stripe features (e.g., old payout logic, deprecated API calls).  
   **Action:** Manual scan of the file for `/* ... */` blocks or multi-line `//` sequences.

8. **`bookings.js` — 11% comment ratio**  
   Relatively small file with high comment density — likely has commented-out migration code or old booking logic.  
   **Action:** Manual review of the 35 commented lines.
