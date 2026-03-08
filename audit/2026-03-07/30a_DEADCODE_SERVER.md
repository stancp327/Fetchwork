# Dead Code — Server Routes — 2026-03-07

> Audit scope: `server/routes/*.js`
> Method: static pattern matching — verify manually before deleting anything.

---

## TODO/FIXME Debt

Only **2 true TODO markers** found across all route files. Low debt, but both are in high-risk flows.

| File | Line | Comment |
|------|------|---------|
| disputes.js | 230 | `// TODO: Phase 3 - watermark the file here` |
| disputes.js | 726 | `status: 'pending', // TODO Phase 4: execute Stripe action, then mark completed` |

**Notes:**
- disputes.js line 726 is inside a payment/dispute resolution handler. The Stripe action it mentions may never have been wired up — **check whether escrow release is actually executing or just setting a status field.**
- disputes.js line 230 is in a file upload path — watermarking was planned but skipped.
- `payments.js:165` flagged by grep is a descriptive inline comment, not an action item.

---

## Heavy Comment Debt

Files with **>15 commented-out lines** (all route files qualify, many severely):

| File | Commented Lines | Severity |
|------|----------------|----------|
| admin.js | 120 | 🔴 High |
| payments.js | 89 | 🔴 High |
| billing.js | 80 | 🔴 High |
| services.js | 77 | 🔴 High |
| teams.js | 69 | 🟠 Medium-High |
| disputes.js | 53 | 🟠 Medium-High |
| jobs.js | 48 | 🟠 Medium-High |
| analytics.js | 38 | 🟡 Medium |
| bookings.js | 35 | 🟡 Medium |
| skills.js | 22 | 🟡 Medium |
| users.js | 21 | 🟡 Medium |
| auth.js | 20 | 🟡 Medium |
| ai.js | 20 | 🟡 Medium |
| boosts.js | 20 | 🟡 Medium |
| backgroundChecks.js | 17 | 🟡 Medium |

**Every single route file** exceeds the 15-line threshold. The top 4 files (admin, payments, billing, services) are especially bad — likely contain old implementation attempts, abandoned features, or pre-refactor code that was never removed.

**Recommended action:** Run a session to manually review `admin.js` and `payments.js` comment blocks — these are highest risk for containing stale business logic that could confuse future developers.

---

## Duplicate Logic

### 1. Hardcoded 10% Fee in services.js (vs. feeEngine/computeServiceFeeBreakdown)

`services.js` has **two routes that hardcode** `Math.round(order.price * 0.10 * 100) / 100` instead of calling `computeServiceFeeBreakdown`:

- `services.js:351` — `platformFee: Math.round(order.price * 0.10 * 100) / 100`
- `services.js:460` — `const platformFee = Math.round(order.price * 0.10 * 100) / 100`

Meanwhile, other routes in the same file correctly call:
```js
const feeBreakdown = await computeServiceFeeBreakdown({ ... });
```
(lines 267, 764, 987)

**Risk:** These hardcoded paths bypass any user-specific fee overrides, subscription-based rates, or fee waivers. If a user has a custom fee rate, they'll be charged 10% flat instead.

### 2. calcPlatformFee Defined Locally AND Imported from feeEngine

- `payments.js:26` — defines `async function calcPlatformFee(userId, role, job, amount)` locally
- `jobs.js:953` — `const { calcPlatformFee } = require('../services/feeEngine')`

Two different `calcPlatformFee` implementations exist. If the feeEngine version is the canonical one, the local definition in `payments.js` may be stale or diverged.

### 3. `paginate` utility — 6 hits across admin.js + errors.js

- admin.js: lines 1998, 2001, 2004, 2008, 2010
- errors.js: line 112

Likely a shared utility used in multiple places — not necessarily dead code, but worth verifying it's the same `paginate` function throughout and not reimplemented.

---

## Unused Requires

Detected via: requires with ≤2 total references in file (1 = the declaration itself, 1 = possibly used once).

| File | Possibly Unused Require | Notes |
|------|------------------------|-------|
| services.js | `emailWorkflowService` | Imported but may not be called in any route handler |
| services.js | `emailService` | Same — verify if email sending was moved elsewhere |
| billing.js | `BillingAuditLog` | Model imported but audit logging may be disabled/removed |
| jobs.js | `milestoneRoutes` | Route file imported as a require — unusual; likely an unused sub-router |
| users.js | `multer` | File upload middleware — if no upload routes exist, dead import |
| users.js | `fs` | Filesystem module — may have been used for avatar handling that was removed |

**High priority:** `jobs.js` importing `milestoneRoutes` as a require is unusual for a route file. If milestones were merged into another route or removed, this import is dead and possibly points to a whole route file that's orphaned.

---

## Duplicate Routes

| File | Duplicate Route |
|------|----------------|
| admin.js | `GET /users/search` — defined **twice** |

**Risk:** In Express, the first matching route handler wins. The second `GET /users/search` definition in `admin.js` is **unreachable dead code**. One definition may be a newer implementation that was added without removing the old one. Verify which handler is correct and delete the other.

---

## Quick Wins (safe to clean up)

These are low-risk removals that can be done without deep review:

1. **`admin.js` — Remove duplicate `GET /users/search` route** — one is unreachable. Check line numbers (search for `router.get('/users/search'`) and keep the more complete/recent handler.

2. **`users.js` — Remove `multer` and `fs` requires** — if no file upload routes exist in this file, these are dead imports. Quick grep for `multer(` and `fs.` to confirm.

3. **`billing.js` — Remove `BillingAuditLog` require** — if audit logging was removed from billing routes, this import is dead weight.

4. **`services.js` — Remove `emailWorkflowService` and `emailService` requires** — if email sending was centralized elsewhere (e.g., event listeners or a job queue), these route-level imports are stale.

5. **`disputes.js:230` — Add watermarking or remove the TODO** — this has been sitting since Phase 3. Either it's still needed (implement it) or it was decided against (delete the comment).

6. **`services.js:351` and `services.js:460` — Replace hardcoded `0.10` fee** — swap for `computeServiceFeeBreakdown()` call to respect user-specific rates and waivers. This is a **correctness bug**, not just dead code.

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| TODO/FIXME markers | 2 | Low volume, medium risk |
| Files with heavy comment debt | 15/15 | Pervasive |
| Hardcoded fee bypasses | 2 routes | 🔴 Correctness risk |
| Duplicate fee implementations | 1 (calcPlatformFee) | Medium |
| Unused requires | 6 | Low risk to remove |
| Duplicate routes (unreachable) | 1 | Medium |

**Biggest actual risk:** The hardcoded `0.10` fee in `services.js` at lines 351 and 460 — this silently ignores fee waivers and subscription-based rates for those two order flows.
