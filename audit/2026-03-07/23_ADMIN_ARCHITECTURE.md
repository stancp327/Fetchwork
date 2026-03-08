# Fetchwork Admin Control System — Architecture Design Document

**Author:** Igor (Senior Marketplace Architect)
**Date:** 2026-03-07
**Status:** Implementation-Grade Design
**Scope:** Complete admin control system for a freelance marketplace handling real user funds, disputes, and trust/safety.

---

## Table of Contents

1. [Admin Control Philosophy](#1-admin-control-philosophy)
2. [Admin Roles and Permission Matrix](#2-admin-roles-and-permission-matrix)
3. [User-Level Admin Controls](#3-user-level-admin-controls)
4. [Wallet / Funds Control Design](#4-wallet--funds-control-design)
5. [Approval Workflow for Sensitive Actions](#5-approval-workflow-for-sensitive-actions)
6. [Audit Log and Forensics Design](#6-audit-log-and-forensics-design)
7. [Frontend Admin UX Design](#7-frontend-admin-ux-design)
8. [Backend Enforcement Design](#8-backend-enforcement-design)
9. [Data Model / Schema Design](#9-data-model--schema-design)
10. [API Design](#10-api-design)
11. [Security and Abuse Prevention](#11-security-and-abuse-prevention)
12. [Recommended Build Order](#12-recommended-build-order)
13. [Testing Strategy](#13-testing-strategy)
14. [Common Failure Modes](#14-common-failure-modes)
15. [Final Recommendation](#15-final-recommendation)

---

## 1. Admin Control Philosophy

### Why "Super Admin Can Do Anything" Is Dangerous

A single all-powerful admin role is the #1 architectural mistake in marketplace admin systems. Here's why:

- **Single point of compromise.** One stolen credential = total platform takeover. An attacker with super admin can drain wallets, delete audit logs, ban legitimate users, and approve fraudulent payouts — all silently.
- **Insider threat.** Employees leave, get disgruntled, or make mistakes. A support agent shouldn't be able to transfer $50,000 because they happen to have the same role as the founder.
- **No accountability.** When everyone can do everything, audit logs become meaningless. "An admin did it" tells you nothing.
- **Regulatory exposure.** Money transmission regulations (FinCEN, state MSB licenses) require separation of duties. "One person can move funds unilaterally" is a compliance failure.

**The correct pattern:** Super admin exists as a break-glass role, not a daily-use role. Even the founder should use a scoped role for day-to-day operations and only escalate when genuinely needed.

### Why Least-Privilege Matters

Every admin should have exactly the permissions they need and nothing more. This isn't bureaucracy — it's engineering:

- **Blast radius reduction.** A compromised support account can view users and pause accounts, but cannot touch wallets or approve payouts.
- **Mistake prevention.** You can't accidentally refund $10,000 if you don't have refund permissions.
- **Clean audit trail.** When permissions are scoped, you know exactly who could have performed a given action.
- **Scaling the team.** When you hire your 5th support agent, you don't want to spend a week deciding what they should access. The role is pre-defined.

### Why Wallet Balances Must Be Ledger-Driven

**Never allow direct balance editing.** This is non-negotiable for a marketplace handling real funds.

- A wallet balance is a **computed value** — the sum of all ledger entries (credits, debits, holds, releases, refunds, adjustments).
- If you allow direct edits, you create money from nothing. The balance says $500, but the ledger entries sum to $300. Now your books don't reconcile, Stripe doesn't match, and you can't explain the discrepancy to regulators or users.
- Every change to a balance must be expressed as a ledger entry with: type, amount, reason, actor, timestamp, and idempotency key.
- "Adjustments" are a specific ledger entry type — they're auditable, require approval, and have a paper trail. They are NOT edits to a balance field.

### Separation of Powers

| Domain | Who | Why Separate |
|--------|-----|-------------|
| **Support** | Customer-facing agents | Handle user issues, view accounts, apply basic restrictions. Should never touch money. |
| **Risk/Compliance** | Trust & safety team | Investigate fraud, manage disputes, apply holds. Can freeze funds but not release them unilaterally. |
| **Finance** | Finance/ops team | Manage payouts, approve adjustments, reconcile. Cannot suspend users or manage disputes. |
| **Moderation** | Content moderators | Review/remove content, moderate messages. No access to financial data. |
| **Owner/Super Admin** | Founder(s) only | Break-glass access. Used rarely. All actions still logged and require re-authentication. |

### Designing for Future Scale

- **Permission-based, not role-based checking.** Code checks `hasPermission('wallet.hold')`, not `isRole('finance')`. Roles are just bundles of permissions.
- **Custom roles from day one.** Don't hardcode role names into business logic.
- **Resource scoping.** Permissions can be scoped to categories, regions, or user segments later without refactoring.
- **Approval workflows are configurable.** Today, adjustments > $100 need dual approval. Tomorrow, you might change that to $50. Make thresholds configurable, not hardcoded.

---

## 2. Admin Roles and Permission Matrix

### Role Definitions

| Role | Description | Daily Use? | Count (typical) |
|------|------------|-----------|-----------------|
| **support** | Customer service. View users, handle basic issues, apply restrictions. | Yes | 2–10 |
| **moderation** | Content review. Moderate reviews, messages, job postings. | Yes | 1–5 |
| **risk** | Trust & safety. Investigate fraud, manage disputes, apply financial holds. | Yes | 1–3 |
| **finance** | Financial operations. Approve adjustments, manage payouts, reconcile. | Yes | 1–2 |
| **owner** | Platform owner. Break-glass access for emergencies. | Rarely | 1–2 |

### Permission Scopes

| Permission | Description |
|-----------|-------------|
| `users.view` | View user profiles, account details |
| `users.edit` | Edit user profile fields (name, email, etc.) |
| `users.suspend` | Temporarily suspend user accounts |
| `users.ban` | Permanently ban users |
| `users.verify` | Manually verify/unverify users |
| `users.restrictions.manage` | Add/remove individual restrictions (messaging, posting, etc.) |
| `features.toggle` | Enable/disable feature flags for users |
| `reviews.view` | View all reviews including flagged |
| `reviews.remove` | Remove reviews from public display |
| `disputes.view` | View dispute cases |
| `disputes.manage` | Manage dispute resolution (assign, escalate, resolve) |
| `messages.view` | View user messages (for moderation/investigation) |
| `messages.moderate` | Remove/flag messages, restrict messaging |
| `wallet.view` | View wallet balances and transaction history |
| `wallet.hold` | Place holds on wallet funds |
| `wallet.release` | Release held funds |
| `wallet.refund` | Process refunds |
| `wallet.adjustment.request` | Request a manual wallet adjustment |
| `wallet.adjustment.approve` | Approve/reject adjustment requests (cannot be same person who requested) |
| `payout.view` | View payout status and history |
| `payout.pause` | Pause scheduled payouts for a user |
| `payout.resume` | Resume paused payouts |
| `admin.view` | View other admin accounts |
| `admin.manage` | Create/edit/deactivate admin accounts, assign roles |
| `admin.roles.manage` | Create/edit custom roles and permission assignments |
| `audit.view` | View audit logs |
| `audit.export` | Export audit log data |
| `settings.view` | View platform settings |
| `settings.edit` | Modify platform settings |

### Role → Permission Matrix

| Permission | support | moderation | risk | finance | owner |
|-----------|---------|-----------|------|---------|-------|
| `users.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `users.edit` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `users.suspend` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `users.ban` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `users.verify` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `users.restrictions.manage` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `features.toggle` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `reviews.view` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `reviews.remove` | ❌ | ✅ | ✅ | ❌ | ✅ |
| `disputes.view` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `disputes.manage` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `messages.view` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `messages.moderate` | ❌ | ✅ | ✅ | ❌ | ✅ |
| `wallet.view` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `wallet.hold` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `wallet.release` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `wallet.refund` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `wallet.adjustment.request` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `wallet.adjustment.approve` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `payout.view` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `payout.pause` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `payout.resume` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.view` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `admin.manage` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `admin.roles.manage` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `audit.view` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `audit.export` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `settings.view` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `settings.edit` | ❌ | ❌ | ❌ | ❌ | ✅ |

### Key Design Decisions

**No role inheritance.** Roles are flat bundles of permissions. Inheritance creates hidden escalation paths and makes auditing harder. If a risk analyst also needs support permissions, create a `risk+support` composite role or assign both roles.

**Multiple roles per admin.** An admin can have multiple roles. Their effective permissions are the union of all role permissions. This is simpler than inheritance and more transparent.

**Custom roles.** Owners can create custom roles with arbitrary permission bundles. All custom roles are stored in the same table and work identically to built-in roles.

**Permission checks, not role checks.** Business logic NEVER checks `if (admin.role === 'finance')`. It checks `if (admin.hasPermission('wallet.refund'))`. This means custom roles work automatically.

**Separation of request and approve.** `wallet.adjustment.request` and `wallet.adjustment.approve` are separate permissions. The same admin CANNOT both request and approve the same adjustment — even if they technically have both permissions. This is enforced at the business logic level.

---

## 3. User-Level Admin Controls

### The Problem with a Single Status Field

```
// ❌ WRONG — the "god field" anti-pattern
user.status = 'suspended' | 'active' | 'banned' | 'restricted' | 'under_review'
```

This fails immediately:
- What if you want to freeze withdrawals but let them keep messaging?
- What if you want to block job posting but let them complete existing jobs?
- What if they're "under review" AND their messaging is restricted?
- What does "restricted" even mean? Restricted how?

### The Correct Model: Orthogonal Control Dimensions

Model user state as **independent, composable dimensions** rather than a single status:

#### Dimension 1: Account Status
The top-level account state. Only a few values, clear semantics.

| Status | Meaning | Can log in? | Can transact? |
|--------|---------|------------|--------------|
| `active` | Normal account | Yes | Yes |
| `suspended` | Temporarily disabled | Yes (sees suspension notice) | No |
| `banned` | Permanently disabled | No | No |
| `deactivated` | User-initiated deactivation | No | No |

#### Dimension 2: Verification State
Independent of account status. A suspended user can still be verified.

| Field | Values |
|-------|--------|
| `email_verified` | `true` / `false` |
| `phone_verified` | `true` / `false` |
| `identity_verified` | `none` / `pending` / `verified` / `rejected` |
| `background_check` | `none` / `pending` / `passed` / `failed` |

#### Dimension 3: Trust / Risk Profile
Computed and admin-adjustable risk scoring.

| Field | Values |
|-------|--------|
| `risk_level` | `low` / `medium` / `high` / `critical` |
| `risk_flags` | Array: `['chargeback_history', 'multiple_accounts', 'velocity_anomaly']` |
| `requires_manual_review` | `true` / `false` |
| `review_reason` | Free text (when manual review is required) |

#### Dimension 4: Feature Flags (per-user)
Fine-grained feature access. Each is independent.

| Flag | Default | Effect When Disabled |
|------|---------|---------------------|
| `can_post_jobs` | `true` | Cannot create new job postings |
| `can_apply_jobs` | `true` | Cannot apply/bid on jobs |
| `can_message` | `true` | Cannot send new messages |
| `can_leave_reviews` | `true` | Cannot post reviews |
| `can_receive_payouts` | `true` | Payouts are held |
| `can_withdraw` | `true` | Cannot withdraw to bank |
| `can_receive_bookings` | `true` | Profile hidden from search/booking |
| `featured_profile` | `false` | Profile gets featured placement |
| `early_access` | `false` | Access to beta features |

#### Dimension 5: Restrictions (active, reason-tagged)
Unlike feature flags (which are boolean toggles), restrictions are active records with metadata.

```
// PSEUDO-CODE — EXAMPLE
UserRestriction {
  id
  userId
  type: 'messaging' | 'posting' | 'withdrawal' | 'payout' | 'booking' | 'review'
  reason: string           // Required — why this restriction exists
  appliedBy: adminId
  appliedAt: timestamp
  expiresAt: timestamp | null   // null = indefinite
  relatedCaseId: string | null  // Link to dispute/investigation
  isActive: boolean
}
```

#### Dimension 6: Entitlements / Limits
Per-user overrides for platform limits.

| Entitlement | Default | Override Example |
|------------|---------|-----------------|
| `max_active_jobs` | 5 | Power seller → 20 |
| `max_daily_messages` | 50 | Restricted → 5 |
| `payout_frequency` | `weekly` | Trusted → `daily` |
| `max_job_value` | $5,000 | New user → $500 |
| `platform_fee_rate` | 0.15 | Negotiated → 0.10 |

### How Admins Use These Controls

| Admin Wants To... | What They Change | Dimension |
|-------------------|-----------------|-----------|
| Disable messaging only | `can_message = false` + create restriction record | Feature flag + Restriction |
| Freeze withdrawals only | `can_withdraw = false` + create restriction record | Feature flag + Restriction |
| Stop job posting only | `can_post_jobs = false` + create restriction record | Feature flag + Restriction |
| Require manual review | `requires_manual_review = true` + set reason | Risk profile |
| Suspend everything | `account_status = 'suspended'` | Account status |
| Flag for fraud investigation | `risk_level = 'critical'` + restrictions as needed | Risk profile + Restrictions |
| Lower a user's limits | Update entitlement overrides | Entitlements |

### Why This Is Better

- **Composable.** Any combination of controls works without collision.
- **Auditable.** Each dimension has its own audit trail. You can see exactly when messaging was disabled and by whom.
- **Reversible.** Remove one restriction without affecting others.
- **Queryable.** "Show me all users with frozen withdrawals" is a simple query, not a string-parsing exercise.
- **Scalable.** Adding a new control dimension doesn't require migrating existing status values.

---

## 4. Wallet / Funds Control Design

### Core Principle: The Balance Is Always Computed

```
// PSEUDO-CODE — EXAMPLE
wallet.available_balance = SUM(ledger entries WHERE state = 'settled')
                         - SUM(active holds)
                         - SUM(pending payouts)

wallet.pending_balance  = SUM(ledger entries WHERE state = 'pending')
wallet.held_balance     = SUM(active holds)
wallet.total_balance    = wallet.available_balance + wallet.pending_balance + wallet.held_balance
```

There is **no** `balance` column that gets directly updated. The balance is ALWAYS derived from the ledger.

### Wallet Ledger Model

Every financial event is an immutable ledger entry:

```
// PSEUDO-CODE — EXAMPLE
WalletLedgerEntry {
  id: uuid
  walletId: string
  type: 'payment_received' | 'payment_sent' | 'platform_fee' | 'refund_credit' |
        'refund_debit' | 'payout' | 'payout_reversal' | 'hold_placed' |
        'hold_released' | 'adjustment_credit' | 'adjustment_debit' | 'dispute_hold' |
        'dispute_release' | 'dispute_loss'
  amount: integer          // In cents. Always positive. Direction implied by type.
  currency: string         // 'usd'
  state: 'pending' | 'settled' | 'failed' | 'reversed'
  description: string      // Human-readable
  metadata: jsonb          // Flexible: jobId, disputeId, stripePaymentIntentId, etc.
  
  // Audit
  actorType: 'system' | 'admin' | 'user' | 'stripe_webhook'
  actorId: string
  reason: string | null    // Required for admin-initiated entries
  idempotencyKey: string   // Prevents double-processing
  
  // Immutability
  createdAt: timestamp
  // NO updatedAt — ledger entries are never modified. Corrections are new entries.
}
```

**Immutability rule:** Ledger entries are append-only. To "undo" a charge, you create a new entry of the opposite type (e.g., `refund_credit` to reverse a `payment_sent`). You never edit or delete an existing entry.

### Fund States

```
┌─────────────┐     Job completed      ┌───────────┐    Clearing period    ┌───────────┐
│   PENDING   │ ──────────────────────► │ AVAILABLE │ ────────────────────► │ PAID OUT  │
│ (in escrow) │                         │           │                       │           │
└──────┬──────┘                         └─────┬─────┘                       └───────────┘
       │                                      │
       │  Dispute opened                      │  Admin/risk hold
       ▼                                      ▼
┌─────────────┐                         ┌───────────┐
│   HELD      │                         │   HELD    │
│ (disputed)  │                         │ (admin)   │
└─────────────┘                         └───────────┘
```

| State | Meaning | User Can Withdraw? | User Can See? |
|-------|---------|-------------------|--------------|
| `pending` | Payment received, job not yet completed/released | No | Yes (as "pending") |
| `available` | Cleared and available for payout | Yes | Yes |
| `held` | Frozen by admin or dispute | No | Yes (as "on hold") |
| `paid_out` | Sent to user's bank account | N/A | Yes (in history) |
| `reserved` | Platform hold for potential chargebacks (30-day reserve) | No | No (internal) |

### Hold/Release System

```
// PSEUDO-CODE — EXAMPLE
WalletHold {
  id: uuid
  walletId: string
  amount: integer          // cents
  reason: string           // Required
  type: 'admin_hold' | 'dispute_hold' | 'chargeback_reserve' | 'compliance_hold'
  status: 'active' | 'released' | 'forfeited'
  
  placedBy: adminId
  placedAt: timestamp
  relatedCaseId: string | null
  
  releasedBy: adminId | null
  releasedAt: timestamp | null
  releaseReason: string | null
  
  expiresAt: timestamp | null  // Auto-release date (null = indefinite)
}
```

**Hold rules:**
- Placing a hold creates a `hold_placed` ledger entry and reduces available balance.
- Releasing a hold creates a `hold_released` ledger entry and increases available balance.
- Forfeiting a hold (dispute lost) creates a `dispute_loss` ledger entry.
- Expired holds auto-release via a scheduled job.

### Manual Adjustment Workflow

For corrections, goodwill credits, or error fixes:

```
// PSEUDO-CODE — EXAMPLE
WalletAdjustmentRequest {
  id: uuid
  walletId: string
  type: 'credit' | 'debit'
  amount: integer
  reason: string              // Required, detailed
  category: 'error_correction' | 'goodwill_credit' | 'fee_waiver' | 'chargeback_loss' | 'other'
  
  requestedBy: adminId
  requestedAt: timestamp
  
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  
  reviewedBy: adminId | null  // MUST be different from requestedBy
  reviewedAt: timestamp | null
  reviewNote: string | null
  
  executedAt: timestamp | null
  ledgerEntryId: string | null  // Links to the created ledger entry
  
  idempotencyKey: string
}
```

### Action Authorization Matrix

| Action | Permission Required | Approval Required | Re-Auth | Notes |
|--------|-------------------|------------------|---------|-------|
| View wallet balance | `wallet.view` | No | No | Read-only |
| View transaction history | `wallet.view` | No | No | Read-only |
| Place hold ≤ $500 | `wallet.hold` | No | No | Reason required |
| Place hold > $500 | `wallet.hold` | No | Yes (re-enter password) | Reason required |
| Release hold ≤ $500 | `wallet.release` | No | No | Reason required |
| Release hold > $500 | `wallet.release` | Dual approval | Yes | — |
| Process refund ≤ $100 | `wallet.refund` | No | No | Reason required, idempotent |
| Process refund $100–$1,000 | `wallet.refund` | Single approval | Yes | — |
| Process refund > $1,000 | `wallet.refund` | Dual approval | Yes | — |
| Request adjustment (any) | `wallet.adjustment.request` | Always (separate approver) | No | — |
| Approve adjustment ≤ $500 | `wallet.adjustment.approve` | Self-sufficient | Yes | Cannot approve own request |
| Approve adjustment > $500 | `wallet.adjustment.approve` | Dual approval | Yes | Cannot approve own request |
| Pause payouts | `payout.pause` | No | No | Reason required |
| Resume payouts | `payout.resume` | Single approval | No | — |
| **Edit balance directly** | — | — | — | **IMPOSSIBLE. Does not exist.** |

### Stripe Connect Mapping

Fetchwork uses Stripe Connect. The platform wallet state must map to Stripe state:

| Platform State | Stripe State | Notes |
|---------------|-------------|-------|
| Payment pending (escrow) | PaymentIntent succeeded, funds in platform account | Funds held on platform's Stripe |
| Available | Ready for Transfer | Can initiate Transfer to connected account |
| Payout paused | Transfer blocked (application-level) | Don't call Stripe Transfer API |
| Hold (admin) | No Stripe equivalent — application-level | Block transfers in app logic |
| Hold (dispute) | Stripe Dispute object exists | May result in chargeback deduction |
| Paid out | Transfer completed to connected account | Stripe Transfer object created |
| Withdrawn to bank | Payout from connected account to bank | Stripe Payout object on connected account |

**Key insight:** Most holds and restrictions are application-level, not Stripe-level. Stripe doesn't know about your admin holds. Your application must check hold status before initiating any Stripe Transfer.

---

## 5. Approval Workflow for Sensitive Actions

### Tiered Risk Model

Every admin action has a risk tier that determines the required approval process:

#### Tier 1 — Low Risk (Immediate Execution)

| Action | Reason Required? | Re-Auth? | Dual Approval? |
|--------|-----------------|---------|---------------|
| View user profile | No | No | No |
| View wallet balance | No | No | No |
| View audit logs | No | No | No |
| Edit user profile fields | Yes | No | No |
| Add restriction (messaging, posting) | Yes | No | No |
| Remove restriction | Yes | No | No |
| Verify user manually | Yes | No | No |
| Place hold ≤ $500 | Yes | No | No |
| Process refund ≤ $100 | Yes | No | No |

#### Tier 2 — Medium Risk (Single Approval or Re-Auth)

| Action | Reason Required? | Re-Auth? | Dual Approval? |
|--------|-----------------|---------|---------------|
| Suspend user account | Yes | Yes | No |
| Place hold > $500 | Yes | Yes | No |
| Release hold ≤ $500 | Yes | No | No |
| Process refund $100–$1,000 | Yes | Yes | Single approver |
| Resume paused payouts | Yes | No | Single approver |
| Remove published review | Yes | Yes | No |
| Resolve dispute (payout decision) | Yes | Yes | No |
| Toggle feature flags | Yes | No | No |

#### Tier 3 — High Risk (Dual Approval + Re-Auth)

| Action | Reason Required? | Re-Auth? | Dual Approval? |
|--------|-----------------|---------|---------------|
| Ban user permanently | Yes | Yes | Yes |
| Release hold > $500 | Yes | Yes | Yes |
| Process refund > $1,000 | Yes | Yes | Yes |
| Approve adjustment > $500 | Yes | Yes | Yes |
| Create/modify admin accounts | Yes | Yes | Yes |
| Modify admin roles/permissions | Yes | Yes | Yes |
| Export audit logs | Yes | Yes | No |
| Modify platform settings | Yes | Yes | Yes |

### Approval Request Flow

```
┌──────────┐     Request      ┌──────────┐    Approve/Reject    ┌──────────┐
│ Requester│ ───────────────► │ Pending  │ ──────────────────► │ Executed │
│  Admin   │                  │ Approval │                      │ / Denied │
└──────────┘                  └────┬─────┘                      └──────────┘
                                   │
                                   │  Expires (48h)
                                   ▼
                              ┌──────────┐
                              │ Expired  │
                              └──────────┘
```

**Rules:**
1. Requester cannot approve their own request — even if they have the approval permission.
2. For dual approval: two different admins (neither being the requester) must approve.
3. Pending requests expire after 48 hours.
4. The requester can cancel a pending request before it's approved.
5. Approved actions execute immediately upon final approval.
6. All approval/rejection events are audit-logged with the approver's reason.

### Re-Authentication

For medium and high-risk actions, the admin must re-enter their password (or complete MFA if enabled) within the same session. This:
- Prevents "walk-away" attacks (someone using an unlocked admin session)
- Creates a second confirmation point
- Generates a re-auth event in the audit log

Re-auth tokens are valid for 5 minutes. After that, the admin must re-authenticate again.

---

## 6. Audit Log and Forensics Design

### Required Fields for Every Audit Event

```
// PSEUDO-CODE — EXAMPLE
AdminAuditEvent {
  id: uuid
  
  // WHO
  actorId: string            // Admin user ID
  actorEmail: string         // Snapshot at time of action (in case email changes later)
  actorRoles: string[]       // Snapshot of roles at time of action
  actorIp: string
  actorUserAgent: string
  actorSessionId: string
  
  // WHAT
  actionType: string         // e.g., 'user.suspend', 'wallet.hold.place', 'adjustment.approve'
  actionCategory: string     // 'account', 'financial', 'moderation', 'admin', 'system'
  riskTier: 'low' | 'medium' | 'high'
  
  // ON WHAT
  targetType: string         // 'user', 'wallet', 'dispute', 'review', 'admin_user'
  targetId: string           // The target entity's ID
  
  // CHANGE
  oldValue: jsonb | null     // Previous state (snapshot relevant fields)
  newValue: jsonb | null     // New state
  reason: string             // Required for all write actions
  metadata: jsonb            // Additional context (amount, currency, related IDs, etc.)
  
  // CONTEXT
  relatedCaseId: string | null      // Dispute or investigation case ID
  relatedApprovalId: string | null  // If this action required approval
  approvalChain: jsonb | null       // Full approval history for this action
  
  // WHEN
  createdAt: timestamp       // Immutable
  
  // IMMUTABILITY
  checksum: string           // SHA-256 hash of the event data — tamper detection
}
```

### Immutability Requirements

| Requirement | Implementation |
|------------|---------------|
| No updates | Audit table has no UPDATE permission. Only INSERT. |
| No deletes | Audit table has no DELETE permission. |
| Checksum | Each entry includes a SHA-256 hash of its contents. Periodic integrity checks compare stored checksums. |
| Retention | Minimum 7 years for financial events. 3 years for all others. |
| Backup | Audit logs are backed up separately from main database, with independent access controls. |

### How Audit Logs Appear in Admin UI

**User audit log tab** (`/admin/users/:id/audit`):
- Chronological list filtered to actions targeting this user
- Each entry shows: timestamp, actor (admin name), action type, summary, reason
- Expandable details: old/new values, metadata, related case
- Filters: by action type, by actor, by date range, by category
- No edit or delete buttons (read-only)

**Global audit log** (`/admin/audit-log`):
- Same format but across all users
- Additional filters: by target user, by actor admin, by risk tier
- Search by reason text
- Export to CSV (requires `audit.export` permission, logged)

### Investigation Support

**Correlation features:**
- Click any audit event → see all events from the same admin session
- Click any admin → see all their recent actions (pattern detection)
- Click any user → see all admin actions taken on them
- Timeline view: interleave admin actions with user actions for full picture

**Red flag detection (automated):**
- Admin performing > 20 financial actions in 1 hour
- Admin accessing > 50 user profiles in 1 hour
- Admin actions outside their normal working hours
- Same admin requesting and different admin approving repeatedly (collusion pattern)
- Multiple holds/releases on the same wallet in short succession

### Rollback Strategy

Not all actions can be rolled back. Document clearly:

| Action | Rollback Possible? | How |
|--------|-------------------|-----|
| User suspension | Yes | Revert account status, remove restrictions |
| Feature flag change | Yes | Toggle back |
| Restriction added | Yes | Remove restriction |
| Hold placed | Yes | Release hold (follows normal release flow) |
| Refund processed | Partial | If Stripe refund succeeded, cannot un-refund. Can debit user wallet as adjustment. |
| Adjustment credit | Yes | Create debit adjustment (requires approval) |
| User banned | Yes | Unban (high-risk, requires dual approval) |
| Payout completed | No | Money has left the platform. Recovery requires user cooperation. |

---

## 7. Frontend Admin UX Design

### Route Structure

```
/admin                          → Dashboard (overview stats, pending approvals, alerts)
/admin/users                    → User search and list
/admin/users/:id                → User detail (tabbed)
/admin/users/:id/overview       → Account overview
/admin/users/:id/permissions    → Feature flags, restrictions, entitlements
/admin/users/:id/wallet         → Wallet balance, ledger, holds
/admin/users/:id/jobs           → Job postings and applications
/admin/users/:id/messages       → Message history (moderation view)
/admin/users/:id/reviews        → Reviews given and received
/admin/users/:id/disputes       → Dispute history
/admin/users/:id/audit          → Audit log for this user

/admin/disputes                 → Dispute queue and management
/admin/disputes/:id             → Dispute detail

/admin/approvals                → Pending approval queue
/admin/approvals/:id            → Approval detail

/admin/moderation               → Content moderation queue
/admin/audit-log                → Global audit log

/admin/finance                  → Financial overview
/admin/finance/payouts          → Payout management
/admin/finance/adjustments      → Adjustment requests

/admin/settings                 → Platform settings
/admin/settings/roles           → Role management
/admin/settings/admins          → Admin user management
```

### User Detail Tab Structure

**Overview Tab:**
- Account status badge (active/suspended/banned)
- Risk level indicator (green/yellow/orange/red)
- Verification checklist (email ✅, phone ✅, identity ❌)
- Key metrics: member since, total earnings, total spent, dispute rate, response time
- Active restrictions (if any) with reasons
- Quick actions: Suspend, Verify, Add Restriction

**Permissions Tab:**
- Feature flags as toggle switches (each with current state, who last changed it, when)
- Active restrictions as a list with: type, reason, applied by, applied date, expires
- Add restriction button → modal with type, reason (required), expiry (optional)
- Entitlements/limits as editable fields with defaults shown

**Wallet Tab:**
- Balance summary cards: Available | Pending | Held | Total
- **Balances are DISPLAY ONLY — no edit buttons, no input fields**
- Transaction ledger: sortable, filterable table
  - Columns: Date, Type, Amount (+/-), Description, Status, Actor
  - Expandable row: full metadata, related job/dispute
- Active holds: list with amount, reason, placed by, placed date, release/forfeit buttons
- Actions panel:
  - "Place Hold" button → modal: amount, reason (required)
  - "Request Adjustment" button → modal: type (credit/debit), amount, reason (required), category
  - "Pause Payouts" / "Resume Payouts" button
  - "Process Refund" button → modal: amount, reason, related job (required)
- Each action button is permission-gated (not rendered if admin lacks permission)

**Audit Tab:**
- Chronological list of all admin actions on this user
- Filters by action type, actor, date range
- Each entry expandable for full details

### Permission-Gated Rendering

```
// PSEUDO-CODE — EXAMPLE
// Frontend component pattern
function WalletTab({ user, adminPermissions }) {
  return (
    <div>
      <BalanceSummary balance={user.wallet.balance} />  {/* Always visible if wallet.view */}
      <TransactionLedger transactions={user.wallet.ledger} />
      
      {adminPermissions.has('wallet.hold') && (
        <Button onClick={openHoldModal}>Place Hold</Button>
      )}
      
      {adminPermissions.has('wallet.refund') && (
        <Button onClick={openRefundModal}>Process Refund</Button>
      )}
      
      {adminPermissions.has('wallet.adjustment.request') && (
        <Button onClick={openAdjustmentModal}>Request Adjustment</Button>
      )}
      
      {/* NEVER render a hidden button that can be triggered via DOM manipulation */}
      {/* If the permission check fails, the button simply doesn't exist */}
    </div>
  )
}
```

**Critical rule:** Permission-gating on the frontend is a UX convenience, not a security measure. The backend MUST independently verify permissions on every request. The frontend just prevents admins from seeing buttons they can't use.

### Modal/Confirmation Patterns

**Standard confirmation modal (Tier 1 actions):**
```
┌─────────────────────────────────────┐
│  Place Hold on User's Wallet        │
│                                     │
│  Amount: [________] USD             │
│                                     │
│  Reason: [________________________] │
│          [________________________] │
│          (Required — min 20 chars)  │
│                                     │
│  Related Case: [dropdown/search]    │
│                                     │
│  [Cancel]              [Place Hold] │
└─────────────────────────────────────┘
```

**Dangerous action modal (Tier 2-3 actions):**
```
┌─────────────────────────────────────┐
│  ⚠️  Ban User Permanently           │
│                                     │
│  This action:                       │
│  • Permanently disables login       │
│  • Cancels all active jobs          │
│  • Forfeits held funds (if any)     │
│  • Requires dual approval           │
│                                     │
│  Reason: [________________________] │
│          [________________________] │
│          (Required — min 50 chars)  │
│                                     │
│  Type "BAN" to confirm: [________] │
│                                     │
│  [Cancel]        [Request Ban]      │
│  (requires re-authentication)       │
└─────────────────────────────────────┘
```

### Approval Queue UX

```
/admin/approvals
┌──────────────────────────────────────────────────────────────────────┐
│  Pending Approvals (3)                                               │
│                                                                      │
│  🔴 HIGH  Wallet Adjustment +$2,500 for user@email.com              │
│           Requested by: Sarah (risk) — 2h ago                        │
│           Reason: "Duplicate charge on job #4521..."                 │
│           [View Details]  [Approve]  [Reject]                        │
│                                                                      │
│  🟡 MED   Resume Payouts for freelancer@email.com                   │
│           Requested by: Mike (finance) — 5h ago                      │
│           Reason: "Investigation complete, no fraud found..."        │
│           [View Details]  [Approve]  [Reject]                        │
│                                                                      │
│  🔴 HIGH  Ban User account suspicious@email.com                     │
│           Requested by: Sarah (risk) — 1d ago                        │
│           1 of 2 approvals received                                  │
│           [View Details]  [Approve]  [Reject]                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Dangerous Patterns to Avoid

| Anti-Pattern | Why It's Dangerous | Correct Pattern |
|-------------|-------------------|-----------------|
| Editable wallet balance field | Creates money from nothing, breaks reconciliation | Display-only balance, adjustment workflow for changes |
| Optimistic updates for financial actions | Shows success before backend confirms, masks failures | Pessimistic: show loading, confirm from backend, then update UI |
| Hidden buttons (CSS `display:none`) for unpermitted actions | DOM manipulation can reveal and trigger them | Don't render the component at all if no permission |
| Frontend-only permission checks | Anyone with DevTools can bypass | Backend enforces independently |
| "Are you sure?" without requiring a reason | No audit trail for why action was taken | Always require a written reason for write actions |
| Single "Save" button for multiple changes | Unclear what changed, hard to audit | One action per confirmation |
| Auto-save on admin forms | Accidental changes saved without intent | Explicit save with confirmation |

---

## 8. Backend Enforcement Design

### Middleware Stack

Every admin API request passes through this middleware chain:

```
Request → Auth → AdminCheck → PermissionCheck → RateLimit → Handler → AuditLog → Response
```

```
// PSEUDO-CODE — EXAMPLE

// 1. Authentication middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization
  const session = verifyAdminSession(token)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (session.expiresAt < now()) return res.status(401).json({ error: 'Session expired' })
  req.adminUser = session.adminUser
  req.adminSession = session
  next()
}

// 2. Admin check middleware
function adminCheckMiddleware(req, res, next) {
  if (!req.adminUser.isActive) return res.status(403).json({ error: 'Admin account deactivated' })
  next()
}

// 3. Permission check middleware (parameterized)
function requirePermission(...permissions) {
  return (req, res, next) => {
    const adminPermissions = getAdminPermissions(req.adminUser.id)
    const hasAll = permissions.every(p => adminPermissions.has(p))
    if (!hasAll) {
      auditLog({
        type: 'permission_denied',
        actorId: req.adminUser.id,
        attemptedAction: req.route,
        requiredPermissions: permissions,
        ip: req.ip
      })
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

// 4. Re-auth middleware (for sensitive actions)
function requireReAuth(req, res, next) {
  const reAuthToken = req.headers['x-reauth-token']
  if (!reAuthToken || !verifyReAuthToken(reAuthToken, req.adminUser.id)) {
    return res.status(403).json({ error: 'Re-authentication required', code: 'REAUTH_REQUIRED' })
  }
  next()
}
```

### Policy-Check Layer

Centralized policy engine that encapsulates business rules:

```
// PSEUDO-CODE — EXAMPLE

class AdminPolicyEngine {
  
  // Can this admin perform this action?
  canPerform(adminId, action, target, context) {
    // 1. Check permissions
    if (!this.hasPermission(adminId, action.requiredPermission)) {
      return { allowed: false, reason: 'Missing permission' }
    }
    
    // 2. Check self-action prevention
    if (action.type === 'adjustment.approve' && context.requestedBy === adminId) {
      return { allowed: false, reason: 'Cannot approve own request' }
    }
    
    // 3. Check approval requirements
    const approvalNeeded = this.getApprovalRequirement(action, context)
    if (approvalNeeded && !context.approvalId) {
      return { allowed: false, reason: 'Approval required', approvalType: approvalNeeded }
    }
    
    // 4. Check re-auth requirements
    if (action.riskTier >= 2 && !context.reAuthVerified) {
      return { allowed: false, reason: 'Re-authentication required' }
    }
    
    return { allowed: true }
  }
  
  getApprovalRequirement(action, context) {
    if (action.type === 'wallet.refund' && context.amount > 100_00) {
      return context.amount > 1000_00 ? 'dual' : 'single'
    }
    if (action.type === 'wallet.adjustment') {
      return context.amount > 500_00 ? 'dual' : 'single'
    }
    if (action.type === 'user.ban') return 'dual'
    return null
  }
}
```

### Resource-Scoped Authorization

Don't just check "can this admin refund?" — check "can this admin refund THIS wallet, for THIS amount, in THIS context?"

```
// PSEUDO-CODE — EXAMPLE

// Route handler
app.post('/admin/wallets/:userId/refund',
  authMiddleware,
  requirePermission('wallet.refund'),
  async (req, res) => {
    const { userId } = req.params
    const { amount, reason, jobId } = req.body
    
    // Validate inputs
    if (!reason || reason.length < 20) {
      return res.status(400).json({ error: 'Reason required (min 20 characters)' })
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' })
    }
    
    // Policy check (resource-scoped)
    const policy = adminPolicyEngine.canPerform(req.adminUser.id, {
      type: 'wallet.refund',
      riskTier: amount > 1000_00 ? 3 : amount > 100_00 ? 2 : 1,
      requiredPermission: 'wallet.refund'
    }, { userId, amount }, {
      reAuthVerified: req.reAuthVerified,
      approvalId: req.body.approvalId
    })
    
    if (!policy.allowed) {
      return res.status(403).json({ error: policy.reason, code: policy.approvalType || 'FORBIDDEN' })
    }
    
    // Execute with idempotency
    const result = await walletService.processRefund({
      userId,
      amount,
      reason,
      jobId,
      adminId: req.adminUser.id,
      idempotencyKey: req.headers['idempotency-key']
    })
    
    // Audit log (automatic via service layer)
    
    res.json(result)
  }
)
```

### Idempotency for Financial Actions

Every financial admin action MUST be idempotent:

```
// PSEUDO-CODE — EXAMPLE

async function processRefund({ userId, amount, reason, jobId, adminId, idempotencyKey }) {
  // Check for existing operation with same idempotency key
  const existing = await db.walletLedger.findByIdempotencyKey(idempotencyKey)
  if (existing) {
    // Return the same result — don't process twice
    return { success: true, ledgerEntryId: existing.id, duplicate: true }
  }
  
  // Process the refund within a transaction
  return await db.transaction(async (tx) => {
    // 1. Verify sufficient balance
    const wallet = await tx.wallets.getForUpdate(userId)  // SELECT ... FOR UPDATE
    if (wallet.availableBalance < amount) {
      throw new InsufficientBalanceError()
    }
    
    // 2. Create ledger entry
    const entry = await tx.walletLedger.insert({
      walletId: wallet.id,
      type: 'refund_debit',
      amount,
      reason,
      actorType: 'admin',
      actorId: adminId,
      idempotencyKey,
      metadata: { jobId }
    })
    
    // 3. Process Stripe refund
    const stripeRefund = await stripe.refunds.create({
      payment_intent: job.paymentIntentId,
      amount,
    }, { idempotencyKey })
    
    // 4. Create audit event
    await tx.auditEvents.insert({
      actorId: adminId,
      actionType: 'wallet.refund',
      targetType: 'wallet',
      targetId: wallet.id,
      newValue: { amount, reason, jobId },
      metadata: { stripeRefundId: stripeRefund.id, ledgerEntryId: entry.id }
    })
    
    return { success: true, ledgerEntryId: entry.id }
  })
}
```

### Event-Driven Notifications

Admin actions trigger events that notify relevant parties:

| Action | Notify User? | Notify Other Admins? | Notify System? |
|--------|-------------|---------------------|---------------|
| Account suspended | Yes (email + in-app) | Risk team (if support did it) | Slack alert |
| Hold placed | Yes (email) | No | No |
| Hold released | Yes (email) | No | No |
| Refund processed | Yes (email + in-app) | No | Finance reconciliation |
| Payout paused | Yes (email) | Finance team | No |
| Payout resumed | Yes (email) | No | No |
| Adjustment approved | No (internal) | Requester notified | Finance reconciliation |
| User banned | Yes (email) | All admins | Slack alert |
| Approval pending | No | Eligible approvers | No |

---

## 9. Data Model / Schema Design

> **Note:** All schemas below are PSEUDO-CODE EXAMPLES — not copy-paste production code. Adapt to your ORM and database.

### Admin System Tables

```sql
-- EXAMPLE SCHEMA

-- Admin users (separate from regular users)
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  mfa_secret    VARCHAR(255),        -- TOTP secret, encrypted at rest
  mfa_enabled   BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES admin_users(id)
);

-- Roles
CREATE TABLE admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) UNIQUE NOT NULL,  -- 'support', 'risk', 'finance', etc.
  description TEXT,
  is_system   BOOLEAN DEFAULT false,         -- System roles can't be deleted
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Permissions (seeded, rarely change)
CREATE TABLE admin_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       VARCHAR(100) UNIQUE NOT NULL,  -- 'wallet.hold', 'users.suspend', etc.
  description TEXT,
  category    VARCHAR(50) NOT NULL           -- 'account', 'financial', 'moderation', 'admin'
);

-- Role ↔ Permission mapping
CREATE TABLE admin_role_permissions (
  role_id       UUID REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Admin ↔ Role mapping (many-to-many)
CREATE TABLE admin_user_roles (
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id       UUID REFERENCES admin_roles(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ DEFAULT now(),
  assigned_by   UUID REFERENCES admin_users(id),
  PRIMARY KEY (admin_user_id, role_id)
);
```

### User Control Tables

```sql
-- EXAMPLE SCHEMA

-- Per-user feature flags
CREATE TABLE user_feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  flag_name  VARCHAR(100) NOT NULL,           -- 'can_post_jobs', 'can_message', etc.
  enabled    BOOLEAN NOT NULL DEFAULT true,
  changed_by UUID REFERENCES admin_users(id), -- null if system-set
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason     TEXT,
  UNIQUE (user_id, flag_name)
);

-- Per-user entitlement overrides
CREATE TABLE user_entitlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  entitlement_key VARCHAR(100) NOT NULL,      -- 'max_active_jobs', 'platform_fee_rate', etc.
  value           JSONB NOT NULL,             -- Flexible: number, string, object
  changed_by      UUID REFERENCES admin_users(id),
  changed_at      TIMESTAMPTZ DEFAULT now(),
  reason          TEXT,
  UNIQUE (user_id, entitlement_key)
);

-- Active restrictions (with metadata)
CREATE TABLE user_restrictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  restriction_type VARCHAR(50) NOT NULL,      -- 'messaging', 'posting', 'withdrawal', etc.
  reason          TEXT NOT NULL,
  applied_by      UUID NOT NULL REFERENCES admin_users(id),
  applied_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,                -- null = indefinite
  related_case_id UUID,                       -- Link to dispute/investigation
  is_active       BOOLEAN DEFAULT true,
  removed_by      UUID REFERENCES admin_users(id),
  removed_at      TIMESTAMPTZ,
  removal_reason  TEXT
);
CREATE INDEX idx_user_restrictions_active ON user_restrictions(user_id, is_active) WHERE is_active = true;

-- User risk profile (one per user)
CREATE TABLE user_risk_profiles (
  user_id               UUID PRIMARY KEY REFERENCES users(id),
  risk_level            VARCHAR(20) DEFAULT 'low',       -- low, medium, high, critical
  risk_flags            JSONB DEFAULT '[]',              -- Array of flag strings
  requires_manual_review BOOLEAN DEFAULT false,
  review_reason         TEXT,
  last_assessed_at      TIMESTAMPTZ,
  assessed_by           VARCHAR(20) DEFAULT 'system',    -- 'system' or admin user ID
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

### Wallet Tables

```sql
-- EXAMPLE SCHEMA

-- Wallet account (one per user)
CREATE TABLE wallet_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id),
  currency              VARCHAR(3) DEFAULT 'usd',
  stripe_connect_id     VARCHAR(255),           -- Stripe connected account ID
  payouts_enabled       BOOLEAN DEFAULT true,
  payouts_paused_by     UUID REFERENCES admin_users(id),
  payouts_paused_at     TIMESTAMPTZ,
  payouts_pause_reason  TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
  -- NOTE: No "balance" column. Balance is computed from ledger.
);

-- Immutable ledger (append-only)
CREATE TABLE wallet_ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL REFERENCES wallet_accounts(id),
  entry_type      VARCHAR(50) NOT NULL,        -- See type enum in section 4
  amount          INTEGER NOT NULL,            -- Cents, always positive
  direction       VARCHAR(6) NOT NULL,         -- 'credit' or 'debit'
  currency        VARCHAR(3) DEFAULT 'usd',
  state           VARCHAR(20) DEFAULT 'settled', -- pending, settled, failed, reversed
  description     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  
  actor_type      VARCHAR(20) NOT NULL,        -- 'system', 'admin', 'user', 'stripe'
  actor_id        VARCHAR(255),
  reason          TEXT,
  
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  
  related_job_id      UUID,
  related_dispute_id  UUID,
  related_hold_id     UUID,
  
  created_at      TIMESTAMPTZ DEFAULT now()
  -- NO updated_at — immutable
);
CREATE INDEX idx_ledger_wallet ON wallet_ledger_entries(wallet_id, created_at DESC);
CREATE INDEX idx_ledger_idempotency ON wallet_ledger_entries(idempotency_key);

-- Holds
CREATE TABLE wallet_holds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL REFERENCES wallet_accounts(id),
  amount          INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  hold_type       VARCHAR(30) NOT NULL,        -- admin_hold, dispute_hold, chargeback_reserve, compliance_hold
  status          VARCHAR(20) DEFAULT 'active', -- active, released, forfeited
  
  placed_by       UUID NOT NULL REFERENCES admin_users(id),
  placed_at       TIMESTAMPTZ DEFAULT now(),
  related_case_id UUID,
  
  released_by     UUID REFERENCES admin_users(id),
  released_at     TIMESTAMPTZ,
  release_reason  TEXT,
  
  expires_at      TIMESTAMPTZ,
  
  ledger_entry_id       UUID REFERENCES wallet_ledger_entries(id), -- hold_placed entry
  release_ledger_entry_id UUID REFERENCES wallet_ledger_entries(id) -- hold_released entry
);
CREATE INDEX idx_holds_active ON wallet_holds(wallet_id, status) WHERE status = 'active';

-- Adjustment requests
CREATE TABLE wallet_adjustment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID NOT NULL REFERENCES wallet_accounts(id),
  adjustment_type VARCHAR(10) NOT NULL,        -- 'credit' or 'debit'
  amount          INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  category        VARCHAR(30) NOT NULL,        -- error_correction, goodwill_credit, fee_waiver, etc.
  
  requested_by    UUID NOT NULL REFERENCES admin_users(id),
  requested_at    TIMESTAMPTZ DEFAULT now(),
  
  status          VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, executed, cancelled
  
  reviewed_by     UUID REFERENCES admin_users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  
  -- For dual approval
  second_reviewer UUID REFERENCES admin_users(id),
  second_reviewed_at TIMESTAMPTZ,
  second_review_note TEXT,
  
  executed_at     TIMESTAMPTZ,
  ledger_entry_id UUID REFERENCES wallet_ledger_entries(id),
  
  idempotency_key VARCHAR(255) UNIQUE NOT NULL
);
```

### Approval and Audit Tables

```sql
-- EXAMPLE SCHEMA

-- Generic approval requests
CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type     VARCHAR(100) NOT NULL,       -- 'wallet.refund', 'user.ban', etc.
  action_payload  JSONB NOT NULL,              -- Full action details
  risk_tier       VARCHAR(10) NOT NULL,        -- 'low', 'medium', 'high'
  approval_type   VARCHAR(10) NOT NULL,        -- 'single', 'dual'
  
  requested_by    UUID NOT NULL REFERENCES admin_users(id),
  requested_at    TIMESTAMPTZ DEFAULT now(),
  reason          TEXT NOT NULL,
  
  status          VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired, cancelled
  
  -- First approver
  approved_by     UUID REFERENCES admin_users(id),
  approved_at     TIMESTAMPTZ,
  approval_note   TEXT,
  
  -- Second approver (for dual approval)
  second_approved_by UUID REFERENCES admin_users(id),
  second_approved_at TIMESTAMPTZ,
  second_approval_note TEXT,
  
  -- Rejection
  rejected_by     UUID REFERENCES admin_users(id),
  rejected_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  
  expires_at      TIMESTAMPTZ NOT NULL,        -- Default: requested_at + 48 hours
  executed_at     TIMESTAMPTZ,
  
  target_type     VARCHAR(50),                 -- 'user', 'wallet', etc.
  target_id       UUID
);
CREATE INDEX idx_approvals_pending ON approval_requests(status) WHERE status = 'pending';

-- Immutable audit log
CREATE TABLE admin_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  actor_id        UUID NOT NULL,
  actor_email     VARCHAR(255) NOT NULL,
  actor_roles     JSONB NOT NULL,              -- Snapshot
  actor_ip        VARCHAR(45),
  actor_user_agent TEXT,
  actor_session_id VARCHAR(255),
  
  -- Action
  action_type     VARCHAR(100) NOT NULL,
  action_category VARCHAR(50) NOT NULL,
  risk_tier       VARCHAR(10),
  
  -- Target
  target_type     VARCHAR(50),
  target_id       UUID,
  
  -- Change
  old_value       JSONB,
  new_value       JSONB,
  reason          TEXT,
  metadata        JSONB DEFAULT '{}',
  
  -- Context
  related_case_id     UUID,
  related_approval_id UUID,
  approval_chain      JSONB,
  
  -- Integrity
  checksum        VARCHAR(64) NOT NULL,        -- SHA-256
  created_at      TIMESTAMPTZ DEFAULT now()
  -- NO updated_at — immutable
);
CREATE INDEX idx_audit_target ON admin_audit_events(target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_actor ON admin_audit_events(actor_id, created_at DESC);
CREATE INDEX idx_audit_type ON admin_audit_events(action_type, created_at DESC);

-- Prevent updates and deletes on audit table
-- (Enforce via database permissions: REVOKE UPDATE, DELETE ON admin_audit_events)
```

---

## 10. API Design

### User Management Endpoints

#### `GET /admin/users`
- **Purpose:** Search and list users
- **Permission:** `users.view`
- **Query params:** `?q=search&status=active&riskLevel=high&page=1&limit=20&sort=createdAt`
- **Validation:** Pagination limits (max 100 per page)
- **Idempotency:** N/A (read-only)

#### `GET /admin/users/:id`
- **Purpose:** Get full user detail (profile + status + risk + verification)
- **Permission:** `users.view`
- **Response:** Account info, risk profile, active restrictions, verification state, feature flags
- **Idempotency:** N/A (read-only)

#### `PATCH /admin/users/:id`
- **Purpose:** Edit user profile fields (name, email, phone)
- **Permission:** `users.edit`
- **Body:** `{ fields: { name: "...", email: "..." }, reason: "..." }`
- **Validation:** Reason required (min 20 chars), field-level validation
- **Idempotency:** N/A (PATCH is inherently idempotent for same values)

#### `POST /admin/users/:id/suspend`
- **Purpose:** Suspend user account
- **Permission:** `users.suspend`
- **Body:** `{ reason: "...", duration: "7d" | null }`
- **Validation:** Reason required, re-auth required
- **Audit:** Logs old status, new status, reason, duration

#### `POST /admin/users/:id/unsuspend`
- **Purpose:** Reactivate suspended account
- **Permission:** `users.suspend`
- **Body:** `{ reason: "..." }`

#### `POST /admin/users/:id/ban`
- **Purpose:** Permanently ban user
- **Permission:** `users.ban`
- **Approval:** Dual approval required → creates approval request, returns `202 Accepted`
- **Body:** `{ reason: "..." }`
- **Re-auth:** Required

#### `POST /admin/users/:id/verify`
- **Purpose:** Manually verify user identity
- **Permission:** `users.verify`
- **Body:** `{ verificationType: "identity", reason: "..." }`

### Feature and Restriction Endpoints

#### `GET /admin/users/:id/features`
- **Purpose:** List all feature flags for user
- **Permission:** `users.view`
- **Response:** Array of `{ flagName, enabled, changedBy, changedAt, reason }`

#### `PATCH /admin/users/:id/features/:flagName`
- **Purpose:** Toggle a feature flag
- **Permission:** `features.toggle`
- **Body:** `{ enabled: true|false, reason: "..." }`
- **Validation:** Reason required
- **Idempotency:** Setting same value is a no-op (returns 200 with current state)

#### `GET /admin/users/:id/restrictions`
- **Purpose:** List active restrictions
- **Permission:** `users.view`

#### `POST /admin/users/:id/restrictions`
- **Purpose:** Add a restriction
- **Permission:** `users.restrictions.manage`
- **Body:** `{ type: "messaging", reason: "...", expiresAt: "..." | null, relatedCaseId: "..." }`
- **Validation:** Reason required, valid restriction type

#### `DELETE /admin/users/:id/restrictions/:restrictionId`
- **Purpose:** Remove a restriction
- **Permission:** `users.restrictions.manage`
- **Body:** `{ reason: "..." }`
- **Note:** Soft delete — sets `is_active = false`, records removal metadata

### Wallet Endpoints

#### `GET /admin/wallets/:userId`
- **Purpose:** View wallet balance and summary
- **Permission:** `wallet.view`
- **Response:** `{ available, pending, held, total, payoutsEnabled, payoutsPaused }`

#### `GET /admin/wallets/:userId/ledger`
- **Purpose:** View transaction history
- **Permission:** `wallet.view`
- **Query params:** `?type=refund&fromDate=...&toDate=...&page=1&limit=50`

#### `POST /admin/wallets/:userId/holds`
- **Purpose:** Place a hold on funds
- **Permission:** `wallet.hold`
- **Body:** `{ amount: 5000, reason: "...", type: "admin_hold", relatedCaseId: "...", expiresAt: "..." }`
- **Headers:** `Idempotency-Key: <uuid>`
- **Re-auth:** Required if amount > $500
- **Validation:** Amount > 0, reason required, sufficient available balance

#### `POST /admin/wallets/holds/:holdId/release`
- **Purpose:** Release a hold
- **Permission:** `wallet.release`
- **Body:** `{ reason: "..." }`
- **Headers:** `Idempotency-Key: <uuid>`
- **Approval:** Required if hold amount > $500
- **Re-auth:** Required if hold amount > $500

#### `POST /admin/wallets/:userId/refund`
- **Purpose:** Process a refund
- **Permission:** `wallet.refund`
- **Body:** `{ amount: 2500, reason: "...", jobId: "...", approvalId: "..." }`
- **Headers:** `Idempotency-Key: <uuid>`
- **Approval:** Required if > $100 (single), > $1000 (dual)
- **Re-auth:** Required if > $100

#### `POST /admin/wallets/adjustments/request`
- **Purpose:** Request a manual wallet adjustment
- **Permission:** `wallet.adjustment.request`
- **Body:** `{ walletId: "...", type: "credit"|"debit", amount: 1500, reason: "...", category: "error_correction" }`
- **Headers:** `Idempotency-Key: <uuid>`
- **Response:** `201 Created` with adjustment request ID (not yet executed)

#### `POST /admin/wallets/adjustments/:id/approve`
- **Purpose:** Approve an adjustment request
- **Permission:** `wallet.adjustment.approve`
- **Body:** `{ note: "..." }`
- **Validation:** Approver ≠ requester. If dual approval needed, checks both approvals.
- **Re-auth:** Required if amount > $500
- **Side effect:** On final approval, executes the adjustment (creates ledger entry)

#### `POST /admin/wallets/adjustments/:id/reject`
- **Purpose:** Reject an adjustment request
- **Permission:** `wallet.adjustment.approve`
- **Body:** `{ note: "..." }`

#### `POST /admin/wallets/:userId/payouts/pause`
- **Purpose:** Pause user's payouts
- **Permission:** `payout.pause`
- **Body:** `{ reason: "..." }`

#### `POST /admin/wallets/:userId/payouts/resume`
- **Purpose:** Resume user's payouts
- **Permission:** `payout.resume`
- **Body:** `{ reason: "...", approvalId: "..." }`
- **Approval:** Single approval required

### Approval Endpoints

#### `GET /admin/approvals`
- **Purpose:** List pending approval requests
- **Permission:** Auto-filtered to show only approvals the current admin can act on
- **Query params:** `?status=pending&actionType=wallet.refund&page=1`

#### `GET /admin/approvals/:id`
- **Purpose:** View approval request detail
- **Response:** Full action details, requester info, current approval state

#### `POST /admin/approvals/:id/approve`
- **Permission:** Must have the permission for the underlying action
- **Body:** `{ note: "..." }`
- **Validation:** Cannot approve own request, re-auth required for high-risk
- **Side effect:** If final approval, executes the pending action

#### `POST /admin/approvals/:id/reject`
- **Permission:** Must have the permission for the underlying action
- **Body:** `{ note: "..." }`

### Audit Endpoints

#### `GET /admin/audit-log`
- **Purpose:** Global audit log
- **Permission:** `audit.view`
- **Query params:** `?actorId=...&targetType=user&targetId=...&actionType=...&fromDate=...&toDate=...&riskTier=high&page=1&limit=50`
- **Response:** Paginated audit events

#### `GET /admin/audit-log/export`
- **Purpose:** Export audit log as CSV
- **Permission:** `audit.export`
- **Query params:** Same filters as list
- **Response:** CSV file download
- **Audit:** This action itself is logged

### All Endpoints: Common Patterns

| Pattern | Implementation |
|---------|---------------|
| **Error format** | `{ error: "message", code: "ERROR_CODE", details: {} }` |
| **Pagination** | `{ data: [...], pagination: { page, limit, total, totalPages } }` |
| **Idempotency** | Financial endpoints require `Idempotency-Key` header |
| **Re-auth** | Sensitive endpoints require `X-Reauth-Token` header |
| **Rate limiting** | 100 req/min per admin for reads, 20 req/min for writes |
| **Approval redirect** | When approval required, return `202 Accepted` with approval request ID |

---

## 11. Security and Abuse Prevention

### Least Privilege Implementation

- **Default deny.** New admin accounts have zero permissions until roles are assigned.
- **No default super admin.** Even the owner account uses a defined role with explicit permissions. Break-glass access requires a separate authentication flow.
- **Permission checks at every layer.** Frontend hides UI, backend enforces, database has row-level security for sensitive tables.
- **Time-boxed elevated access.** If an admin needs temporary elevated permissions (e.g., during an incident), grant them with an automatic expiry. Log the grant, the actions taken, and the revocation.

### Separation of Duties Matrix

| Action | Who Can Request | Who Can Approve | Key Constraint |
|--------|---------------|----------------|---------------|
| Wallet adjustment | Risk, Finance | Finance | Requester ≠ Approver |
| User ban | Risk, Support | Risk (dual) | Two different risk admins |
| Payout resume | Finance | Finance (different person) | Requester ≠ Approver |
| Large refund (>$1K) | Finance, Risk | Finance (dual) | Two approvers, neither is requester |
| Admin account creation | Owner | Owner (second) | Only if dual-owner setup |
| Role modification | Owner | Owner | Logged, re-auth required |

### Break-Glass Protocol

For genuine emergencies where normal approval workflows are too slow:

1. **Break-glass is a specific, logged action** — not "use the super admin account."
2. Admin invokes break-glass with reason → system grants temporary elevated permissions (4 hours max).
3. All actions during break-glass are flagged with `BREAK_GLASS` in audit log.
4. Automatic alert sent to all other admins with owner/risk roles.
5. Mandatory post-incident review of all break-glass actions within 24 hours.
6. Break-glass frequency > 2x/month triggers process review.

### Re-Authentication Design

```
// PSEUDO-CODE — EXAMPLE

// Re-auth endpoint
POST /admin/auth/reauth
Body: { password: "..." }  // Or MFA code if MFA enabled
Response: { reAuthToken: "...", expiresAt: "..." }  // Valid 5 minutes

// Token is:
// - Scoped to the current admin session
// - Single-use (consumed on first sensitive action)
// - Stored server-side with expiry
// - Not a JWT (server-validated, revocable)
```

### Suspicious Admin Activity Detection

| Signal | Threshold | Action |
|--------|----------|--------|
| Financial actions per hour | > 20 | Alert to owner + temporary rate limit |
| User profile views per hour | > 50 | Alert to risk team |
| Actions outside normal hours | Configurable per admin | Log as anomalous, alert if financial |
| Failed permission checks | > 10 in 1 hour | Temporary account lock + alert |
| Same requester/approver pair repeatedly | > 5 approvals in a week | Alert for collusion review |
| Bulk user suspensions | > 5 in 1 hour | Require owner approval for subsequent |
| Accessing own admin record | Any time | Alert (potential privilege escalation attempt) |
| Export requests | > 2 per day | Alert to owner |

### Session Security

- Admin sessions expire after 8 hours of activity, 30 minutes of inactivity.
- Sessions are tied to IP + user agent. IP change = session invalidation.
- Only one active session per admin (new login kills old session).
- Session tokens are opaque (not JWTs) — server-validated, instantly revocable.
- Admin logout invalidates the session server-side immediately.

### "View as User" vs. True Impersonation

**Recommendation: "View as User" only. Never true impersonation.**

| Feature | View as User ✅ | True Impersonation ❌ |
|---------|---------------|---------------------|
| What it does | Read-only view of what the user sees | Act as the user (make purchases, send messages) |
| Risk | Low — no state changes possible | Extreme — admin could transfer funds, message users |
| Audit | Simple — "Admin X viewed user Y's perspective" | Complex — which actions were the admin vs the user? |
| Liability | Clear — admin only looked | Murky — did the admin or user make that purchase? |
| Implementation | Render user's dashboard with admin header overlay | Complex session injection, hard to secure |
| Recommendation | **Use this** | **Never build this** |

If an admin needs to do something "on behalf of" a user, the admin should use the admin tools (adjustments, restrictions, etc.) — never act as the user.

---

## 12. Recommended Build Order

### Phase 1: Admin RBAC Foundation (Weeks 1–3)

**Goals:** Admin login, role-based access, basic user viewing.

| Area | Work |
|------|------|
| **Backend** | Admin user model, authentication (session-based), role/permission tables, permission-check middleware, seed default roles and permissions |
| **Frontend** | Admin login page, admin layout with nav, user search/list page, basic user detail page (overview tab only), permission-gated component wrapper |
| **Database** | `admin_users`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_user_roles` tables |
| **Risk Level** | Low — no financial actions, no user-facing impact |
| **Dependencies** | Existing user model, authentication library |
| **Test Priorities** | Permission check middleware (unit), role-permission resolution (unit), login/session flow (integration), permission boundary tests (every role can/cannot access expected routes) |

### Phase 2: User Restrictions + Feature Controls (Weeks 3–5)

**Goals:** Admins can manage user accounts, restrictions, feature flags, and verification.

| Area | Work |
|------|------|
| **Backend** | User restriction CRUD, feature flag CRUD, entitlement overrides, user risk profile, suspend/ban endpoints, basic audit logging |
| **Frontend** | User detail tabs: Overview (with quick actions), Permissions (flags + restrictions), feature flag toggles, restriction add/remove modals, confirmation dialogs with reason fields |
| **Database** | `user_feature_flags`, `user_restrictions`, `user_entitlements`, `user_risk_profiles`, `admin_audit_events` tables |
| **Risk Level** | Medium — affects user accounts but no financial impact |
| **Dependencies** | Phase 1 complete |
| **Test Priorities** | Restriction application/removal (integration), feature flag effects on user behavior (integration), suspend/ban flow (integration), audit log creation (unit + integration) |

### Phase 3: Wallet Ledger + Holds (Weeks 5–8)

**Goals:** Financial visibility and control. Holds, refunds, payout management.

| Area | Work |
|------|------|
| **Backend** | Wallet account model, ledger entry model, balance computation service, hold/release service, refund service (Stripe integration), payout pause/resume, idempotency handling |
| **Frontend** | Wallet tab: balance cards (read-only), transaction ledger table, active holds list, hold/release modals, refund modal, payout pause/resume buttons |
| **Database** | `wallet_accounts`, `wallet_ledger_entries`, `wallet_holds` tables |
| **Risk Level** | **HIGH** — touching real money. Extensive testing required. |
| **Dependencies** | Phase 1 + 2, Stripe Connect setup |
| **Test Priorities** | **Ledger integrity** (balance = sum of entries), **idempotency** (double-submit doesn't double-charge), hold/release (unit + integration), refund flow with Stripe (integration), concurrent access (race conditions on balance) |

### Phase 4: Approval Workflow (Weeks 8–10)

**Goals:** Sensitive actions require approval. Dual approval for high-risk.

| Area | Work |
|------|------|
| **Backend** | Approval request model, approval flow engine, integration with financial endpoints (refund, adjustment, payout resume), re-auth endpoint, approval expiry job |
| **Frontend** | Approval queue page, approval detail page, approve/reject modals, re-auth dialog, pending approval badges in nav, inline approval status on action buttons |
| **Database** | `approval_requests`, `wallet_adjustment_requests` tables |
| **Risk Level** | Medium — adds safety, but bugs could block legitimate operations |
| **Dependencies** | Phase 3 complete (financial actions to gate) |
| **Test Priorities** | Approval flow (unit + integration), self-approval prevention, dual approval counting, expiry job, re-auth flow, approval → execution chain |

### Phase 5: Audit UI + Reporting (Weeks 10–12)

**Goals:** Full audit visibility, investigation tools, export capability.

| Area | Work |
|------|------|
| **Backend** | Audit log query API (filters, pagination), export endpoint, correlation queries (by session, by admin), checksum verification job |
| **Frontend** | Global audit log page, user audit tab, admin activity dashboard, filter panel, expandable event details, CSV export button, timeline view |
| **Database** | Indexes on audit table, materialized views for common queries |
| **Risk Level** | Low — read-only features, but export needs permission gating |
| **Dependencies** | All previous phases (audit data must exist) |
| **Test Priorities** | Audit log completeness (every action creates an event), filter accuracy, export permission check, checksum integrity |

### Phase 6: Advanced Risk/Compliance (Weeks 12–16)

**Goals:** Automated risk detection, admin activity monitoring, compliance features.

| Area | Work |
|------|------|
| **Backend** | Suspicious activity detection rules, automated alerts, admin activity anomaly detection, break-glass protocol, view-as-user feature, scheduled hold expiry, automated risk scoring |
| **Frontend** | Risk dashboard, alert queue, admin activity monitor, break-glass UI, anomaly investigation tools |
| **Database** | Alert/notification tables, risk scoring model |
| **Risk Level** | Medium — false positives could be disruptive, false negatives miss fraud |
| **Dependencies** | All previous phases |
| **Test Priorities** | Detection rule accuracy, alert delivery, break-glass flow, false positive rate tuning |

---

## 13. Testing Strategy

### Permission Boundary Tests (Critical)

Every role must be tested for both allowed and denied actions:

```
// PSEUDO-CODE — EXAMPLE

describe('Permission Boundaries', () => {
  for (const role of ['support', 'moderation', 'risk', 'finance', 'owner']) {
    describe(`Role: ${role}`, () => {
      const allowedEndpoints = getEndpointsForRole(role)
      const deniedEndpoints = getAllEndpoints().filter(e => !allowedEndpoints.includes(e))
      
      for (const endpoint of allowedEndpoints) {
        it(`should ALLOW ${endpoint.method} ${endpoint.path}`, async () => {
          const res = await request(endpoint).withRole(role)
          expect(res.status).not.toBe(403)
        })
      }
      
      for (const endpoint of deniedEndpoints) {
        it(`should DENY ${endpoint.method} ${endpoint.path}`, async () => {
          const res = await request(endpoint).withRole(role)
          expect(res.status).toBe(403)
        })
      }
    })
  }
})
```

**This test suite is non-negotiable.** It catches the #1 admin security bug: "forgot to add permission check to new endpoint."

### Wallet Ledger Integrity Tests

```
// PSEUDO-CODE — EXAMPLE

describe('Wallet Ledger Integrity', () => {
  it('computed balance always equals sum of ledger entries', async () => {
    // Perform various operations
    await placeHold(wallet, 5000)
    await processRefund(wallet, 2000)
    await releaseHold(wallet, 5000)
    await requestAndApproveAdjustment(wallet, 'credit', 1000)
    
    // Verify
    const computedBalance = await computeBalanceFromLedger(wallet.id)
    const reportedBalance = await getWalletBalance(wallet.id)
    expect(reportedBalance).toEqual(computedBalance)
  })
  
  it('ledger entries are immutable', async () => {
    const entry = await createLedgerEntry(...)
    await expect(updateLedgerEntry(entry.id, { amount: 9999 })).rejects.toThrow()
    await expect(deleteLedgerEntry(entry.id)).rejects.toThrow()
  })
  
  it('double-submit with same idempotency key returns same result', async () => {
    const key = 'test-idempotency-key'
    const result1 = await processRefund(wallet, 1000, { idempotencyKey: key })
    const result2 = await processRefund(wallet, 1000, { idempotencyKey: key })
    expect(result1.ledgerEntryId).toEqual(result2.ledgerEntryId)
    expect(result2.duplicate).toBe(true)
    // Balance should only be affected once
    const balance = await getWalletBalance(wallet.id)
    expect(balance.available).toBe(initialBalance - 1000)
  })
})
```

### Approval Workflow Tests

```
// PSEUDO-CODE — EXAMPLE

describe('Approval Workflow', () => {
  it('prevents self-approval', async () => {
    const request = await createAdjustmentRequest(adminA, wallet, 'credit', 5000)
    await expect(approveRequest(adminA, request.id)).rejects.toThrow('Cannot approve own request')
  })
  
  it('dual approval requires two different approvers', async () => {
    const request = await createLargeRefundRequest(adminA, wallet, 2000_00)
    await approveRequest(adminB, request.id)
    expect(request.status).toBe('pending') // Still needs second approval
    await approveRequest(adminC, request.id)
    expect(request.status).toBe('approved')
    // Verify execution
    const entry = await getLatestLedgerEntry(wallet.id)
    expect(entry.type).toBe('refund_debit')
  })
  
  it('expired requests cannot be approved', async () => {
    const request = await createAdjustmentRequest(adminA, wallet, 'credit', 100)
    await advanceTime(49, 'hours')
    await expect(approveRequest(adminB, request.id)).rejects.toThrow('Request expired')
  })
})
```

### Audit Log Tests

```
// PSEUDO-CODE — EXAMPLE

describe('Audit Logging', () => {
  it('every write action creates an audit event', async () => {
    const writeEndpoints = getAllWriteEndpoints()
    for (const endpoint of writeEndpoints) {
      const auditCountBefore = await countAuditEvents()
      await request(endpoint).withValidAdmin()
      const auditCountAfter = await countAuditEvents()
      expect(auditCountAfter).toBeGreaterThan(auditCountBefore)
    }
  })
  
  it('audit events contain required fields', async () => {
    await suspendUser(adminA, userId, 'Test reason')
    const event = await getLatestAuditEvent()
    expect(event.actorId).toBe(adminA.id)
    expect(event.actorEmail).toBe(adminA.email)
    expect(event.actionType).toBe('user.suspend')
    expect(event.targetId).toBe(userId)
    expect(event.reason).toBe('Test reason')
    expect(event.oldValue).toContain({ status: 'active' })
    expect(event.newValue).toContain({ status: 'suspended' })
    expect(event.checksum).toBeDefined()
  })
  
  it('permission denied attempts are logged', async () => {
    await expect(processRefund(supportAdmin, wallet)).rejects.toThrow()
    const event = await getLatestAuditEvent()
    expect(event.actionType).toBe('permission_denied')
    expect(event.actorId).toBe(supportAdmin.id)
  })
})
```

### UI Tests

```
// PSEUDO-CODE — EXAMPLE

describe('Admin UI Permission Rendering', () => {
  it('support admin does not see refund button', async () => {
    renderWalletTab({ role: 'support', permissions: supportPermissions })
    expect(screen.queryByText('Process Refund')).toBeNull()
  })
  
  it('finance admin sees refund button', async () => {
    renderWalletTab({ role: 'finance', permissions: financePermissions })
    expect(screen.getByText('Process Refund')).toBeVisible()
  })
  
  it('wallet balance is not editable', async () => {
    renderWalletTab({ role: 'owner', permissions: allPermissions })
    const balanceElement = screen.getByTestId('available-balance')
    expect(balanceElement.tagName).not.toBe('INPUT')
    expect(balanceElement.contentEditable).not.toBe('true')
  })
  
  it('dangerous actions require confirmation with reason', async () => {
    renderUserOverview({ role: 'risk', permissions: riskPermissions })
    fireEvent.click(screen.getByText('Suspend Account'))
    const modal = screen.getByRole('dialog')
    const submitButton = within(modal).getByText('Confirm Suspension')
    expect(submitButton).toBeDisabled() // Disabled until reason is provided
    fireEvent.change(within(modal).getByLabelText('Reason'), { target: { value: 'Fraudulent activity detected in multiple transactions' } })
    expect(submitButton).toBeEnabled()
  })
})
```

### Test Coverage Summary

| Area | Test Type | Priority |
|------|----------|----------|
| Permission boundaries (every role × every endpoint) | Integration | **P0 — Must have** |
| Ledger balance integrity | Unit + Integration | **P0 — Must have** |
| Idempotency (financial actions) | Integration | **P0 — Must have** |
| Self-approval prevention | Unit | **P0 — Must have** |
| Audit log completeness | Integration | **P0 — Must have** |
| Approval workflow (single, dual, expiry) | Integration | **P1 — Should have** |
| Re-auth flow | Integration | **P1 — Should have** |
| UI permission rendering | Component | **P1 — Should have** |
| Concurrent wallet operations (race conditions) | Load/Stress | **P1 — Should have** |
| Suspicious activity detection | Unit | **P2 — Nice to have (Phase 6)** |
| Export/CSV generation | Integration | **P2 — Nice to have** |

---

## 14. Common Failure Modes

### Failure Mode 1: Hidden Frontend Buttons but Unsecured Backend Routes

**What happens:** Developer adds permission check to the React component (button doesn't render) but forgets to add middleware to the Express route. Admin with DevTools or cURL bypasses the frontend completely.

**Frequency:** Extremely common — the #1 admin security bug.

**Fix:**
- Backend permission middleware is mandatory for every admin route — no exceptions.
- Permission boundary test suite (Section 13) catches this automatically.
- Code review checklist: "Does this new route have `requirePermission()` middleware?"
- Lint rule: flag any admin route handler without permission middleware.

---

### Failure Mode 2: Admins Overwriting Balances Directly

**What happens:** A `PATCH /admin/wallets/:id` endpoint exists that accepts `{ balance: 50000 }`. Admin (or attacker) sets arbitrary balance.

**Frequency:** Common in early-stage platforms that don't use ledger architecture.

**Fix:**
- **No balance column exists.** Balance is always computed from ledger entries.
- **No endpoint accepts a balance value.** Only holds, refunds, and adjustments exist.
- Database constraint: if you do cache a balance, it's a materialized view rebuilt from ledger, never directly writable.

---

### Failure Mode 3: Missing Audit Metadata

**What happens:** Audit log says "Admin X suspended User Y" but doesn't record why, what the previous state was, or what case it relates to. Investigation becomes impossible.

**Frequency:** Very common — developers log the action but not the context.

**Fix:**
- `reason` field is required (validated server-side, minimum character length).
- `oldValue` / `newValue` are automatically captured by the audit service — not manually specified by the developer.
- Standard audit event creator function that rejects events missing required fields.
- Periodic audit quality check: flag events with missing metadata.

---

### Failure Mode 4: Support Staff Given Finance Powers

**What happens:** During a busy period, someone grants the support role `wallet.refund` permission "temporarily." It's never revoked. Now 8 support agents can process refunds.

**Frequency:** Common as teams grow.

**Fix:**
- Role modification requires dual approval and is audit-logged.
- Temporary permission grants have mandatory expiry dates.
- Monthly permission review: automated report of all role changes in the past 30 days.
- Alert when a role gains a financial permission.

---

### Failure Mode 5: Too Much in One Status Field

**What happens:** `user.status = 'restricted'` — but what's restricted? Messaging? Withdrawals? Everything? Different code paths interpret "restricted" differently.

**Frequency:** Very common in early designs.

**Fix:**
- Account status is one of exactly four values: `active`, `suspended`, `banned`, `deactivated`.
- Everything else is modeled as independent dimensions (feature flags, restrictions, entitlements).
- See Section 3 for the full orthogonal control model.

---

### Failure Mode 6: No Approval Threshold for Fund Actions

**What happens:** A single finance admin processes a $50,000 refund at 2 AM with no additional checks. Turns out it was a social engineering attack — someone convinced the admin the refund was legitimate.

**Frequency:** Rare but catastrophic when it happens.

**Fix:**
- Tiered approval thresholds (Section 5).
- Refunds > $100 require at least one approval. > $1,000 requires dual approval.
- Re-authentication required for all financial actions above threshold.
- Off-hours actions generate alerts.
- Daily financial action summary sent to owner.

---

### Failure Mode 7: Inconsistent Permission Checks Across Pages

**What happens:** The wallet tab checks `wallet.view` correctly, but the user overview page shows wallet balance without any permission check. Or the API checks permissions but the GraphQL resolver doesn't.

**Frequency:** Common when multiple developers work on different parts of admin.

**Fix:**
- Single source of truth for permission requirements: a route → permission mapping file.
- Permission middleware is attached at the route level, not inside handlers.
- The same permission-check function is used everywhere (API routes, GraphQL resolvers, WebSocket handlers).
- Permission boundary test suite covers ALL entry points, not just REST routes.

---

### Failure Mode 8: No Rollback Strategy

**What happens:** Admin accidentally bans 50 users via a bulk action. There's no way to undo it except manually reactivating each one, and the system doesn't track which users were affected by a single action.

**Frequency:** Uncommon but devastating when it happens.

**Fix:**
- Bulk actions are logged as a group (with a batch ID linking individual audit events).
- Every action documents its rollback path (Section 6 table).
- For irreversible actions (payouts), make the irreversibility extremely clear in the UI.
- "Undo" for recent actions (within 5 minutes) where safe — implemented as the reverse action, not a database rollback.
- Bulk actions require approval regardless of individual item risk level.

---

## 15. Final Recommendation

### For Fetchwork Specifically

Fetchwork is an early-stage freelance marketplace. The admin system needs to be **safe from day one** (you're handling real money) but **buildable incrementally** (you don't have a 10-person team). Here's the recommended architecture:

### Best Admin Role Structure

**Start with 3 roles, expand to 5:**

| Phase | Roles | Who Fills Them |
|-------|-------|---------------|
| **Launch** | `owner`, `support` | Chaz (owner), first hire or Chaz dual-hatting as support |
| **Post-traction** | Add `risk`, `finance` | As volume justifies dedicated roles |
| **Scale** | Add `moderation`, custom roles | When content volume requires dedicated moderation |

Don't over-engineer roles before you have the team to fill them. But build the RBAC system correctly from the start so adding roles is trivial.

### Best Wallet Control Pattern

**Ledger-based, no exceptions.**

- Wallet balance = `SUM(ledger entries)` — always computed, never stored as an editable field.
- Every financial admin action creates a ledger entry with actor, reason, and idempotency key.
- Holds for disputes and investigations — never directly editing balances.
- Adjustments always require a separate approver.
- Map to Stripe Connect state — your application layer enforces holds and restrictions before calling Stripe Transfer APIs.

This is more work upfront than a simple `balance` column, but it's the only pattern that survives an audit, a dispute, or a regulatory inquiry.

### Best Frontend Admin UX Pattern

**Permission-gated rendering with pessimistic updates:**

- Buttons only render if the admin has the permission. No hidden buttons.
- Financial actions show loading state → wait for backend confirmation → then update UI. Never optimistic.
- Every write action requires a reason (enforced in modal, validated on backend).
- Dangerous actions require typing a confirmation word + re-authentication.
- Wallet balances are display-only cards — no edit affordance whatsoever.

### Best Approval Workflow Pattern

**Tiered by amount with self-approval prevention:**

| Threshold | Approval |
|----------|----------|
| < $100 | Direct (with reason + audit) |
| $100 – $1,000 | Single approval (different admin) |
| > $1,000 | Dual approval (two different admins, neither is requester) |
| Any adjustment | Always requires separate approver |
| User ban | Always dual approval |

Keep thresholds configurable (in platform settings, not hardcoded). Start conservative — you can always relax thresholds later, but tightening them after a loss is painful.

### Safest Architecture Overall

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN FRONTEND                                │
│  Permission-gated rendering │ Pessimistic updates │ Reason required  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────┐
│                        BACKEND API                                   │
│  Auth → AdminCheck → PermissionCheck → RateLimit → Handler → Audit  │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐           │
│  │ Policy Engine│  │ Approval     │  │ Wallet Service   │           │
│  │ (can this    │  │ Workflow     │  │ (ledger-based,   │           │
│  │  admin do    │  │ (single/dual │  │  idempotent)     │           │
│  │  this?)      │  │  approval)   │  │                  │           │
│  └──────────────┘  └──────────────┘  └──────────────────┘           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        DATABASE                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐       │
│  │ Admin RBAC  │  │ User Controls│  │ Wallet Ledger        │       │
│  │ (roles,     │  │ (flags,      │  │ (immutable entries,  │       │
│  │  permissions│  │  restrictions│  │  holds, adjustments) │       │
│  │  audit log) │  │  entitlements│  │                      │       │
│  └─────────────┘  └──────────────┘  └──────────────────────┘       │
│                                                                      │
│  CONSTRAINTS: No UPDATE/DELETE on ledger or audit tables             │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     STRIPE CONNECT                                   │
│  Platform account → Transfers → Connected accounts → Payouts        │
│  (App logic enforces holds/restrictions BEFORE calling Stripe)       │
└─────────────────────────────────────────────────────────────────────┘
```

### Summary Checklist

Before shipping any admin feature, verify:

- [ ] Backend permission check on every route (not just frontend)
- [ ] Audit log entry for every write action (with reason, old/new values)
- [ ] No direct balance editing anywhere in the codebase
- [ ] Idempotency keys on all financial operations
- [ ] Self-approval prevention enforced server-side
- [ ] Reason field required and validated (min length)
- [ ] Re-auth for financial actions above threshold
- [ ] Permission boundary tests pass for all roles
- [ ] Ledger balance integrity test passes
- [ ] Wallets: application checks holds/restrictions before calling Stripe

**Build order: Phases 1–3 before launch. Phases 4–5 within first month. Phase 6 when volume justifies it.**

This architecture handles real money safely, scales with the team, survives regulatory scrutiny, and can be built incrementally by a small team. It's opinionated by design — the worst admin systems are the ones that try to be flexible about security.

---

*End of Admin Control System Architecture Document*
*Fetchwork — 2026-03-07*
