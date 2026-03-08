# Admin Audit Log Implementation — 2026-03-07

## Summary

Added persistent audit logging for **all destructive admin actions** in the Fetchwork admin panel. Previously, only financial/billing actions had audit trails via `BillingAuditLog`. Non-financial admin actions (suspend, delete, promote, etc.) only had `console.log` statements that were lost on restart.

## New Files

### `server/utils/adminAudit.js`
- New `AdminAuditLog` Mongoose model (MongoDB collection)
- Schema: `adminId`, `adminEmail`, `targetId`, `action`, `reason`, `oldValue`, `newValue`, `metadata`, `ip`, plus auto `timestamps`
- Indexes on `adminId`, `targetId`, and `action` (all with `createdAt` for efficient time-range queries)
- `logAdminAction()` helper — mirrors `logBillingAction()` pattern; never throws (audit failure doesn't block the action)

## Modified Files

### `server/routes/admin.js`
- Added import: `const { logAdminAction, AdminAuditLog } = require('../utils/adminAudit')`
- Added `logAdminAction()` calls to **20 destructive admin endpoints**:

| # | Route | Action Key | Details |
|---|-------|-----------|---------|
| 1 | `PUT /users/:userId/suspend` | `user.suspend` | Logs reason, target user |
| 2 | `PUT /users/:userId/unsuspend` | `user.unsuspend` | Logs target user |
| 3 | `PUT /jobs/:jobId/cancel` | `job.cancel` | Logs job ID, title, reason |
| 4 | `DELETE /services/:serviceId` | `service.delete` | Logs service ID, title, freelancer |
| 5 | `DELETE /jobs/:jobId` | `job.delete` | Logs job ID, title, reason |
| 6 | `PUT /reviews/:reviewId/moderate` | `review.moderate` | Logs old/new moderation status |
| 7 | `DELETE /reviews/:reviewId` | `review.delete` | Logs review ID, reviewee, rating |
| 8 | `PUT /verifications/:userId` | `verification.approve` / `verification.reject` | Logs action + notes |
| 9 | `PUT /users/:userId/promote` | `user.promote` | Logs old/new role |
| 10 | `PUT /users/:userId/demote` | `user.demote` | Logs old/new role |
| 11 | `DELETE /users/:userId` | `user.delete` | Logs reason, user email/name |
| 12 | `PUT /users/:userId/make-moderator` | `user.make-moderator` | Logs old/new role + permissions |
| 13 | `PUT /users/:userId/remove-moderator` | `user.remove-moderator` | Logs old/new role |
| 14 | `PUT /users/:userId/permissions` | `user.permissions-update` | Logs old/new permission arrays |
| 15 | `PUT /boosts/:type/:id/cancel` | `boost.cancel` | Logs type, item ID, reason |
| 16 | `PATCH /bookings/:id/cancel` | `booking.cancel` | Logs booking ID, reason |
| 17 | `POST /payments/:id/refund` | `payment.refund` | Logs payment ID, amount, Stripe intent |
| 18 | `PATCH /contracts/:id/void` | `contract.void` | Logs contract ID, reason |
| 19 | `DELETE /messages/:id` | `message.delete` | Logs message ID, sender, content preview (100 chars) |
| 20 | `POST /users/:userId/features` | `feature.grant` / `feature.revoke` | Logs feature name, enabled state |
| 21 | `DELETE /users/:userId/features/:feature` | `feature.remove` | Logs feature name |

### New Endpoint: `GET /admin/audit-log`
- Query params: `page`, `limit`, `action`, `adminId`, `targetId`
- Populates admin and target user names/emails
- Sorted by `createdAt` descending
- Requires `analytics_view` permission

## What Was NOT Changed
- **Billing actions** — already covered by `BillingAuditLog` + `logBillingAction()` (wallet adjust, wallet freeze, plan grant, fee override, credits)
- **Dispute actions** — already covered by the dedicated `AuditLog` model (dispute-specific)
- **Team actions** — already covered by `TeamAuditLog`
- No existing code was refactored; all changes are purely additive

## Design Decisions
- Used `analytics_view` permission for the audit-log endpoint (not a new permission) to avoid schema changes
- Audit log entries are **immutable** — no update/delete operations exposed
- `logAdminAction` never throws — audit failure is logged to console but never blocks the admin action
- Content preview for deleted messages is truncated to 100 chars for privacy
