# Admin Governance Audit — 2026-03-07

## Summary

**Overall Risk: HIGH**

The admin panel has **69 routes** across all 21 tabs. All routes in `admin.js` use `authenticateAdmin` middleware, and most use `requirePermission()` for granular RBAC. However, there are **zero audit logs for the vast majority of destructive actions** (only billing/wallet actions log), **no confirmation dialogs on several destructive frontend tabs**, and **critical RBAC gaps in routes outside admin.js** where `req.user.isAdmin` is checked without proper admin auth middleware.

**Key Stats:**
- 69 admin routes in `server/routes/admin.js` — all protected by `authenticateAdmin`
- 5 routes missing `requirePermission()` (monitoring, profile, dashboard, permissions list, teams)
- Only wallet/billing actions have audit logging (7 calls to `logBillingAction`)
- 0 audit log entries for: suspend, delete user, delete review, delete job, refund, void contract, cancel booking, promote/demote, message deletion
- Multiple admin frontend tabs have destructive actions with 0 confirmation dialogs

---

## Critical Findings

### CRITICAL-01: No Audit Logging on Most Destructive Admin Actions
- **File:** `server/routes/admin.js`
- **Lines:** 233 (suspend), 891 (delete user), 545 (delete review), 404 (delete job), 388 (delete service), 336 (cancel job), 809 (promote), 850 (demote), 918 (make-moderator), 936 (remove-moderator), 522 (moderate review), 1818 (refund), 1888 (void contract), 1763 (cancel booking), 1944 (delete message)
- **Severity:** CRITICAL
- **Explanation:** Only wallet/billing actions call `logBillingAction()`. All other destructive admin actions (suspend/delete user, refund payment, void contract, delete reviews/jobs/services, promote/demote, message deletion) have **zero audit trail**. The only trace is `console.log` for promote/demote (`[AUDIT]` prefix at lines 838, 879) which is not persisted to DB. If a compromised admin account takes destructive actions, there's no forensic trail.
- **Fix:** Create a general `AdminAuditLog` model and log every destructive action with: adminId, action, targetId, targetType, before/after state, timestamp, IP address.

### CRITICAL-02: Background Check Admin Routes Use Weak Auth Pattern
- **File:** `server/routes/backgroundChecks.js`, lines 229, 244
- **Severity:** CRITICAL
- **Explanation:** These admin routes use `authenticateToken` (regular user auth) + a manual `req.user.isAdmin` boolean check instead of the proper `authenticateAdmin` middleware. The `isAdmin` field is a simple boolean on the User model. While it's currently only set via the promote flow and hardcoded ADMIN_EMAILS, this pattern is weaker because:
  1. It doesn't set `req.admin` with permission helpers
  2. It doesn't check `isActive` status for suspended admins who haven't had their isAdmin cleared
  3. No permission granularity — any admin can review background checks
- **Fix:** Replace with `authenticateAdmin, requirePermission('content_moderation')`.

### CRITICAL-03: Dispute Routes Trust `req.user.isAdmin` Without Admin Auth
- **File:** `server/routes/disputes.js`, lines 275, 856
- **Severity:** CRITICAL
- **Explanation:** Dispute message and detail routes check `req.user.isAdmin || req.user.role === 'admin'` after `authenticateToken` (regular user auth). This means any user whose `isAdmin` boolean is true (even if they shouldn't have admin access) can access all disputes and post messages as "admin". The `authenticateAdmin` middleware performs additional checks (active status, suspension) that are bypassed here.
- **Fix:** Either use `authenticateAdmin` for admin-only dispute access, or add proper role verification in the dispute routes.

---

## High Findings

### HIGH-01: No Frontend Confirmation on Multiple Destructive Tabs
- **File:** Various `client/src/` admin components
- **Severity:** HIGH
- **Details:**

| Component | Destructive Actions | Confirmations | Gap |
|-----------|-------------------|---------------|-----|
| AdminBoostsTab.js | 5 | 0 | ⚠️ ALL unconfirmed |
| AdminContractsTab.js | 10 | 0 | ⚠️ ALL unconfirmed |
| AdminDisputePanel.js | 2 | 0 | ⚠️ ALL unconfirmed |
| AdminPaymentsTab.js | 1 (refund) | 0 | ⚠️ Refund unconfirmed |
| AdminOrdersTab.js | 2 | 0 | ⚠️ ALL unconfirmed |
| AdminUsersTab.js | 13 | 0 | ⚠️ ALL unconfirmed |

- **Explanation:** Accidental clicks on suspend/delete/void/refund/cancel buttons can immediately trigger destructive actions with no "Are you sure?" dialog.
- **Fix:** Add confirmation modals for all destructive actions, especially refunds (money leaves the platform) and suspensions.

### HIGH-02: Review Hard-Delete Instead of Soft-Delete
- **File:** `server/routes/admin.js`, line 553
- **Severity:** HIGH
- **Explanation:** Admin review deletion uses `Review.findByIdAndDelete()` — a hard database delete. All other admin deletions (users, jobs, services) use soft-delete patterns. A deleted review is unrecoverable and combined with no audit log (CRITICAL-01), there's no way to know a review ever existed.
- **Fix:** Change to soft-delete: set `isDeleted: true, deletedBy: adminId, deletedAt: Date`.

### HIGH-03: Payment Refund Has No Amount Validation
- **File:** `server/routes/admin.js`, lines 1818-1850
- **Severity:** HIGH
- **Explanation:** The refund endpoint creates a full Stripe refund with no partial amount support and no maximum check. Any admin with `payment_management` permission can refund any payment in full. There's no check for whether the refund amount is reasonable relative to the payment.
- **Fix:** Add amount parameter validation, support partial refunds, add maximum thresholds that require additional approval.

### HIGH-04: 5 Routes Missing `requirePermission()` Checks
- **File:** `server/routes/admin.js`
- **Severity:** HIGH
- **Lines and routes:**
  - Line 15: `GET /profile` — no permission check (acceptable, self-profile)
  - Line 27: `GET /dashboard` — no permission check (any admin/moderator sees full dashboard stats)
  - Line 701: `GET /monitoring` — no permission check (any admin/moderator sees WebSocket stats, system health)
  - Line 972: `GET /permissions` — no permission check (any admin/moderator can list all permission definitions)
  - Line 2231: `GET /teams` — no permission check (any admin/moderator sees all teams)
- **Explanation:** These routes still require `authenticateAdmin` so only admins/moderators access them, but a moderator with limited permissions (e.g., only `content_moderation`) can view the full dashboard stats, monitoring data, and teams — data they may not need.
- **Fix:** Add `requirePermission('analytics_view')` to dashboard and monitoring. Teams should require a permission too.

### HIGH-05: Duplicate Route Definition
- **File:** `server/routes/admin.js`, lines 1065 and 1480
- **Severity:** HIGH
- **Explanation:** `GET /users/search` is defined twice. Express will only hit the first match (line 1065), making the second definition (line 1480) dead code. If the second was intended to be different, it's silently ignored.
- **Fix:** Remove the duplicate at line 1480 or merge any differences.

---

## RBAC Assessment

### Auth Middleware (`authenticateAdmin`)
**Properly implemented.** The middleware at `server/middleware/auth.js:56-122`:
1. ✅ Verifies JWT token
2. ✅ Looks up user from DB (not just token claims)
3. ✅ Checks `isAdmin` OR `role === 'admin'` OR `role === 'moderator'`
4. ✅ Checks `isSuspended` — suspended users rejected
5. ✅ Checks `isActive` — deactivated users rejected
6. ✅ Sets `req.admin` with `hasPermission()` helper
7. ✅ Admins bypass all permission checks (`if (isAdmin) return true`)
8. ✅ Moderators only get their role's default permissions + custom permissions

### Permission System (`requirePermission`)
**Well-designed.** 9 permission categories:
- `user_management`, `job_management`, `content_moderation`, `payment_management`, `dispute_management`, `analytics_view`, `fee_waiver`, `user_impersonation`, `system_settings`

Moderators default to: `job_management`, `content_moderation`, `dispute_management` only.

### Privilege Escalation Protection
**Good but imperfect:**
- ✅ Promote/demote restricted to hardcoded admin emails (line 813-816, 854-857)
- ✅ Can't promote/demote yourself (lines 820-821, 861-862)
- ✅ Can't demote hardcoded admin users (line 871)
- ⚠️ `authenticateAdmin` doesn't verify token version — an old JWT from before logout could still work for admin access (though regular `authenticateToken` does check token version at line 23-31)

### RBAC Gaps Outside Admin Routes
- ❌ `backgroundChecks.js` uses `req.user.isAdmin` not `authenticateAdmin` (CRITICAL-02)
- ❌ `disputes.js` uses `req.user.isAdmin` not `authenticateAdmin` (CRITICAL-03)
- ⚠️ Any route using `authenticateToken` where the user happens to have `isAdmin: true` or `role: 'admin'` will pass manual isAdmin checks — but without the suspended/active checks that `authenticateAdmin` performs

---

## Destructive Action Audit

| Action | Route | Has Frontend Confirm | Has Audit Log | Severity |
|--------|-------|---------------------|---------------|----------|
| Suspend user | PUT /users/:id/suspend | ✅ (AdminUserCard) | ❌ None | CRITICAL |
| Unsuspend user | PUT /users/:id/unsuspend | ✅ (AdminUserCard) | ❌ None | MEDIUM |
| Delete user | DELETE /users/:id | ✅ (AdminUserCard) | ❌ None | CRITICAL |
| Cancel job | PUT /jobs/:id/cancel | ⚠️ Partial | ❌ None | HIGH |
| Delete job | DELETE /jobs/:id | ⚠️ Partial | ❌ None | HIGH |
| Delete service | DELETE /services/:id | ✅ (AdminServicesTab) | ❌ None | HIGH |
| Delete review | DELETE /reviews/:id | ✅ (AdminReviewsTab) | ❌ None + Hard-delete | CRITICAL |
| Moderate review | PUT /reviews/:id/moderate | ❌ | ❌ None | HIGH |
| Promote to admin | PUT /users/:id/promote | ✅ (AdminUserCard) | ⚠️ console.log only | CRITICAL |
| Demote from admin | PUT /users/:id/demote | ✅ (AdminUserCard) | ⚠️ console.log only | CRITICAL |
| Make moderator | PUT /users/:id/make-moderator | ❌ | ❌ None | HIGH |
| Remove moderator | PUT /users/:id/remove-moderator | ❌ | ❌ None | HIGH |
| Refund payment | POST /payments/:id/refund | ❌ | ❌ None | CRITICAL |
| Void contract | PATCH /contracts/:id/void | ❌ | ❌ None | HIGH |
| Cancel booking | PATCH /bookings/:id/cancel | ❌ | ❌ None | HIGH |
| Cancel boost | PUT /boosts/:type/:id/cancel | ❌ | ❌ None | MEDIUM |
| Delete message | DELETE /messages/:id | ❌ | ❌ None | HIGH |
| Adjust wallet | POST /wallets/:id/adjust | N/A | ✅ logBillingAction | ✅ |
| Freeze wallet | PUT /wallets/:id/freeze | N/A | ✅ logBillingAction | ✅ |
| Grant billing | POST /users/:id/billing/grant | N/A | ✅ logBillingAction | ✅ |
| Fee override | POST /users/:id/billing/fee-override | N/A | ✅ logBillingAction | ✅ |
| Billing credit | POST /users/:id/billing/credit | N/A | ✅ logBillingAction | ✅ |
| Update permissions | PUT /users/:id/permissions | ❌ | ❌ None | HIGH |

---

## Recommendations (Prioritized)

### P0 — Immediate (Before Launch)
1. **Create `AdminAuditLog` model** — Log every destructive admin action to DB with: adminId, action, targetType, targetId, before/after state, IP, timestamp. Apply to all 15+ unlogged destructive routes.
2. **Add confirmation modals** to AdminBoostsTab, AdminContractsTab, AdminDisputePanel, AdminPaymentsTab (refund), AdminOrdersTab, AdminUsersTab for all destructive actions.
3. **Fix backgroundChecks.js admin routes** (lines 229, 244) — Replace `authenticateToken` + `req.user.isAdmin` with `authenticateAdmin, requirePermission('content_moderation')`.
4. **Fix disputes.js admin checks** (lines 275, 856) — Add proper admin auth verification instead of trusting `req.user.isAdmin`.
5. **Add token version check to `authenticateAdmin`** — Currently only `authenticateToken` validates token version. Admin middleware should also reject invalidated sessions.

### P1 — High Priority
6. **Change review deletion to soft-delete** — Replace `findByIdAndDelete` with `isDeleted` flag.
7. **Add `requirePermission()` to monitoring, dashboard, teams routes** — Moderators shouldn't see everything.
8. **Remove duplicate `/users/search` route** at line 1480.
9. **Add amount validation to refund endpoint** — Support partial refunds, add maximum thresholds.
10. **Add rate limiting per admin action type** — Current rate limit is 500/15min for all admin routes combined. Destructive actions should have stricter limits (e.g., 10 refunds/hour).

### P2 — Medium Priority
11. **Add IP logging to admin sessions** — Track where admin actions originate.
12. **Add admin action notifications** — Email/Slack alerts for high-risk actions (promote, refund, mass operations).
13. **Implement 4-eyes principle for refunds over $X** — Require a second admin to approve large refunds.
14. **Add CSRF protection** for admin routes if accessed via browser sessions.
15. **Replace `console.log('[AUDIT]')` with proper DB logging** for promote/demote actions (lines 838, 879).
