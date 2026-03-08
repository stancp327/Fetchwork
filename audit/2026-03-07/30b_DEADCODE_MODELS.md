# Dead Code Audit — Mongoose Models
**Fetchwork Codebase | Audit Date: 2026-03-07**
**Auditor:** Igor (subagent) | **Scope:** `server/models/` vs `server/routes/` + `server/services/`

---

## Summary

| Check | Findings |
|---|---|
| Total models audited | 43 |
| Never imported (dead models) | 1 (`EmailLog.js`) |
| Duplicate collection registrations | 1 (false positive — model *fetch*, not *register*) |
| Models with no indexes (>50 lines) | **0** ✅ |
| Top-5 models with possibly unused fields | 5 models, 40+ candidate fields |

**Overall health:** Reasonably clean. One confirmed dead model. No index gaps. Schema drift is the main concern — particularly in `User.js` and `Service.js` which carry many fields that appear untouched by any route handler.

---

## Model Inventory (by size)

| Model File | Lines |
|---|---|
| Job.js | 497 |
| User.js | 459 |
| Message.js | 364 |
| Review.js | 319 |
| Service.js | 291 |
| Payment.js | 271 |
| Dispute.js | 260 |
| CustomOffer.js | 192 |
| Admin.js | 166 |
| Team.js | 150 |
| Notification.js | 121 |
| AuditLog.js | 112 |
| BundlePurchase.js | 90 |
| Contract.js | 84 |
| ServerError.js | 81 |
| Call.js | 80 |
| Analytics.js | 73 |
| UserSubscription.js | 69 |
| ServiceSubscription.js | 64 |
| Plan.js | 62 |
| BackgroundCheck.js | 62 |
| Organization.js | 60 |
| PromoRule.js | 55 |
| TeamAuditLog.js | 51 |
| Availability.js | 46 |
| TeamApproval.js | 45 |
| BillingAuditLog.js | 44 |
| EmailLog.js | 38 |
| CheckoutSession.js | 37 |
| JobAlert.js | 35 |
| Referral.js | 35 |
| FeatureGrant.js | 32 |
| BillingCredit.js | 29 |
| FeatureGroup.js | 29 |
| JobTemplate.js | 26 |
| TeamClient.js | 25 |
| Booking.js | 25 |
| SkillAssessment.js | 24 |
| BoostImpression.js | 19 |
| ModerationEvent.js | 17 |
| ProcessedWebhookEvent.js | 16 |
| Saved.js | 14 |
| BoostCredit.js | 12 |

---

## Never-Imported Models

### ❌ `EmailLog.js` — CONFIRMED DEAD

**Status:** Not imported in any route, service, controller, middleware, or utility file.

**Schema fields:** `recipient`, `emailType`, `subject`, `status`, `resendId`, `sentAt`, `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`, `errorMessage`

**Indexes defined (wasted):**
- `{ recipient: 1, emailType: 1 }`
- `{ status: 1 }`
- `{ sentAt: -1 }`

**Assessment:** This model was built for email delivery tracking (likely Resend webhook integration) but was never wired up. The `resendId` field and `status` enum (`sent → delivered → opened → clicked → bounced → failed`) suggest a Resend webhook handler was planned but never implemented.

**Action:** Either implement the webhook handler or drop the model. If email analytics are not a roadmap priority, drop it to reduce confusion.

---

## Duplicate Collections

### ⚠️ `mongoose.model('Review')` in `User.js` — FALSE POSITIVE

**What the scanner found:** `User.js` line 401 calls `mongoose.model('Review')`, which the regex matched as a duplicate registration alongside `Review.js`.

**Actual situation:** This is a *one-argument* `mongoose.model()` call — a model *retrieval*, not a *registration*. It appears inside `userSchema.methods.calculateRating`:

```js
userSchema.methods.calculateRating = async function() {
  const Review = mongoose.model('Review');  // retrieves existing registered model
  const reviews = await Review.find({ freelancer: this._id });
  ...
};
```

**Assessment:** This is an anti-pattern (cross-model reference via string lookup instead of require), but it is not a duplicate registration and will not cause a Mongoose `OverwriteModelError`.

**Minor risk:** If `Review.js` is ever not loaded before `User.js` methods are called, this will throw at runtime. Consider converting to a `require('../models/Review')` import at the top of the file.

**No duplicates confirmed.** ✅

---

## Schema Drift (Unused Fields in Top 5 Models)

Fields present in the schema but with **zero references** in any route file. These may be planned features, legacy cruft, or moved to a different data strategy.

### `Job.js` (497 lines)

| Field | Assessment |
|---|---|
| `uploadedAt` | Attachment upload timestamp — no route reads or writes this |
| `archivedAt` | Archive timestamp — no archive endpoint found in routes |
| `archiveReason` | Pairs with `archivedAt` — both unused |
| `parentJobId` | Suggests recurring/template jobs were planned — never implemented |
| `instanceCount` | Pairs with `parentJobId` — recurring job instance tracking, dead |
| `maxlength` | Schema validator keyword picked up by regex — not a real field |

**Verdict:** `parentJobId` + `instanceCount` are dead feature flags for a recurring jobs system. `archivedAt` + `archiveReason` suggest a soft-archive flow that was designed but not shipped. Low risk to keep; medium confusion cost.

---

### `User.js` (459 lines)

| Field | Assessment |
|---|---|
| `notificationFrequency` | Notification digest frequency — no route reads/sets it |
| `smsNotifications` | SMS toggle — no SMS service wired up |
| `accountNumber` | Bank account number — no payout/bank route references this |
| `routingNumber` | Pairs with `accountNumber` — same issue |
| `accountHolderName` | Same bank data cluster |
| `bankName` | Same bank data cluster |
| `googleCalendarId` | ⚠️ Referenced in routes (found in route files) — keep |
| `googleCalRefreshToken` | OAuth token — no route explicitly uses the field name but may be handled upstream |
| `googleCalAccessToken` | Same as above |
| `facebookId` | Facebook OAuth — no route references; likely abandoned login strategy |
| `availabilityHours` | Legacy — superseded by `Availability.js` model |
| `availabilityDays` | Same — legacy |
| `availabilityNote` | Same — legacy |
| `minProject` | Minimum project budget filter — no route references |
| `showEmail` | Privacy toggle — no route reads/enforces it |
| `showPhone` | Privacy toggle — same |
| `sharePortfolioOnlyViaInvite` | Privacy setting — no enforcement found in routes |
| `completionRate` | Derived metric — no route sets or exposes it |
| `totalJobsCancelled` | Derived metric — same |
| `onTimeDelivery` | Derived metric — no calculation found in routes |
| `minlength` / `maxlength` | Schema validator keywords — false positives |

**Verdict:** High schema drift. Three clusters:
1. **Bank account fields** (`accountNumber`, `routingNumber`, `accountHolderName`, `bankName`) — Stripe handles payouts, these fields appear to be legacy from a manual payout approach.
2. **Legacy availability fields** (`availabilityHours`, `availabilityDays`, `availabilityNote`) — superseded by the dedicated `Availability.js` model.
3. **Derived metrics** (`completionRate`, `totalJobsCancelled`, `onTimeDelivery`) — stored but never populated or returned in routes; likely intended for a stats pipeline that was never built.

---

### `Service.js` (291 lines)

| Field | Assessment |
|---|---|
| `sessionDuration` | For session-based services — no route references |
| `sessionsPerCycle` | Subscription cycle session count — same |
| `trialEnabled` | Free trial toggle — no route implements trial logic |
| `trialPrice` | Trial pricing — same |
| `classDetails` | Group class info — no route reads it |
| `maxStudents` / `minStudents` | Class capacity — not checked in any booking route |
| `skillLevel` | Target audience skill level — unused |
| `materialsIncluded` / `materialsNote` | Materials info — unused |
| `ageGroup` | Audience age — unused |
| `totalSessions` | Session count for packages — not referenced in routes |
| `refundable` | Refund policy flag — no route checks it |
| `freeWithinMiles` | Local service radius perk — unused |
| `maxPerDay` / `maxPerWeek` / `maxConcurrent` | Booking throttle limits — no route enforces them |
| `savings` | Computed savings display — no route sets it |
| `caption` | Media caption — not referenced |
| `question` | Custom intake question — no route reads it |
| `archivedAt` / `archiveReason` | Same archive pattern as Job — not implemented |

**Verdict:** `Service.js` is heavily over-engineered. The subscription/session/class/trial fields suggest multiple service types were modeled upfront but most are not yet implemented. The booking throttle fields (`maxPerDay`, `maxPerWeek`, `maxConcurrent`) are especially risky — they imply limits that are silently never enforced.

---

### `Message.js` (364 lines)

| Field | Assessment |
|---|---|
| `requestId` | Custom offer request reference — no route uses field name |
| `deliveredAt` | Read receipt timestamp — no route sets it |
| `deliveredTo` | Array of users who received — same |
| `isEdited` | Edit flag — no edit endpoint found |
| `editedAt` | Edit timestamp — same |
| `deletedAt` | Soft delete timestamp — no route implements soft delete |
| `maxMembers` | Conversation member cap — not enforced in any route |
| `maxlength` | Schema validator keyword — false positive |

**Verdict:** Message editing and delivery receipts were designed but not implemented. `deletedAt` suggests soft deletes were planned but messages are probably hard-deleted or kept forever.

---

### `Dispute.js` (260 lines)

| Field | Assessment |
|---|---|
| `watermarkFailed` | Watermark verification failure flag — no route sets it |
| `stripeRefundId` | Stripe refund tracking — no route stores this |
| `failureReason` | Refund failure reason — same |
| `maxlength` | Schema validator keyword — false positive |

**Verdict:** Stripe refund tracking fields (`stripeRefundId`, `failureReason`) suggest the dispute resolution flow should be recording refund outcomes but isn't. `watermarkFailed` suggests a content protection feature that was never finished.

---

## Missing Indexes

**Result: None found.** ✅

All models with more than 50 lines of schema definition have at least one index defined (either `index: true` on a field or `schema.index()`). This is the cleanest part of the codebase.

---

## Recommendations

### 🔴 High Priority

1. **Delete `EmailLog.js`** — Completely unused. Either wire it up with a Resend webhook handler or remove it. The model has proper indexes and structure; it would take ~30 min to implement the handler. If email analytics aren't on the roadmap, delete it.

2. **Enforce `Service.js` booking throttle fields or document them** — `maxPerDay`, `maxPerWeek`, `maxConcurrent` silently imply limits that are never enforced. A provider could set these expecting they'd be respected. Either implement enforcement in the booking route or remove the fields.

3. **Remove bank account fields from `User.js`** — `accountNumber`, `routingNumber`, `accountHolderName`, `bankName` are PII stored in MongoDB with no apparent use. If Stripe handles payouts (likely), these are both unused and a compliance liability. Audit whether any data is stored here; if so, migrate and purge.

### 🟡 Medium Priority

4. **Remove legacy availability fields from `User.js`** — `availabilityHours`, `availabilityDays`, `availabilityNote` are superseded by the `Availability` model. Remove from schema after confirming no data in production relies on them.

5. **Archive pattern is half-built** — `Job.js` and `Service.js` both have `archivedAt` + `archiveReason` fields with no corresponding route logic. Decide: implement the archive endpoint or remove the fields.

6. **Convert `User.js` cross-model reference** — Line 401 uses `mongoose.model('Review')` (string lookup) inside `calculateRating`. Replace with a top-of-file `require` to make the dependency explicit and avoid potential runtime errors if model load order changes.

### 🟢 Low Priority / Track

7. **`parentJobId` + `instanceCount` in `Job.js`** — Recurring jobs feature. If not on the roadmap, remove to reduce confusion. If planned, add a comment explaining the intent.

8. **`facebookId` in `User.js`** — Facebook OAuth appears abandoned. Remove if confirmed unused.

9. **Derived metrics in `User.js`** — `completionRate`, `totalJobsCancelled`, `onTimeDelivery` are stored but never populated. Either build the calculation pipeline (background job / post-save hook) or remove the fields.

10. **Message soft-delete** — `deletedAt` in `Message.js` implies soft delete but no route implements it. If hard delete is the current strategy, remove `deletedAt`.

---

## Appendix — Commands Run

```powershell
# Step 1: Model sizes
Get-ChildItem "server\models\" -Filter "*.js" | Select-Object Name, @{N='Lines';E={(Get-Content $_.FullName).Count}} | Sort-Object Lines -Descending

# Step 2: Never-imported models (routes + services scope)
# Result: EmailLog.js — confirmed dead across routes, services, controllers, middleware, utils

# Step 3: Duplicate mongoose.model() registrations
# Result: User.js line 401 is a model *fetch* (1-arg), not a registration — false positive

# Step 4: Top-5 schema fields unused in routes
# Covered: Job.js, User.js, Service.js, Message.js, Dispute.js

# Step 5: Models >50 lines with no indexes
# Result: None — all large models have indexes defined ✅
```
