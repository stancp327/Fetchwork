# Payments & Stripe Audit — 2026-03-07

## Summary

Audited all payment-related routes, Stripe service layer, webhook handlers, escrow logic, billing/wallet system, boosts, and dispute resolution across the Fetchwork server codebase. The codebase demonstrates **strong fundamentals**: webhook signature verification is present and correct, raw body parsing is properly mounted before `express.json()`, server-authoritative escrow amounts prevent client-side price tampering, payment method ownership is verified before charges, and idempotency guards exist on webhook handlers. However, several **medium and low severity** issues were identified, primarily around hardcoded fee rates in service orders (bypassing the fee engine), missing idempotency keys on certain Stripe operations, and incomplete dispute financial execution.

**Overall Risk Level: MODERATE** — No critical vulnerabilities found. The architecture is sound, but there are gaps that could cause financial inconsistencies or minor security issues.

---

## Critical Findings

_No critical findings._

---

## High Findings

### [HIGH] Service order completion uses hardcoded 10% fee instead of fee engine
- **File:** `server/routes/services.js:460-461`
- **Code:**
  ```js
  const platformFee = Math.round(order.price * 0.10 * 100) / 100;
  const payoutAmt   = order.price - platformFee;
  ```
- **Also at:** `server/routes/services.js:351` (confirm route)
  ```js
  platformFee: Math.round(order.price * 0.10 * 100) / 100,
  ```
- **Risk:** The service order creation path (`/:id/order`) correctly uses `computeServiceFeeBreakdown()` from the fee engine, calculating per-user fees based on plan tier. However, when the order is **completed** (`/:id/orders/:orderId/complete`) or **confirmed** (`/:id/orders/:orderId/confirm`), the fee is recalculated using a hardcoded `0.10` (10%) instead of querying the fee engine. This means:
  - Users on paid plans with reduced fee rates are overcharged
  - Fee waivers are ignored at payout time
  - The `platformFee` stored in the Payment record at completion doesn't match the fee calculated at order creation
- **Fix:** Use the `platformFee` already stored on the order object (set during creation via `computeServiceFeeBreakdown`), or re-derive it from the fee engine at completion time. The order already has `order.platformFee` and `order.escrowAmount` (freelancer payout) set correctly at creation.

### [HIGH] Tip amount accepted from client without server-side max validation on charge
- **File:** `server/routes/payments.js:373-376`
- **Code:**
  ```js
  const { jobId, amount, paymentMethodId } = req.body;
  if (!jobId || !amount) return res.status(400).json({ error: 'jobId and amount required' });
  if (typeof amount !== 'number' || amount < 1 || amount > 5000) {
    return res.status(400).json({ error: 'Tip must be between $1 and $5,000' });
  }
  ```
- **Risk:** The tip amount is client-supplied via `req.body.amount`. While there is a $1–$5,000 range check, $5,000 is a high ceiling for a "tip." More importantly, tips bypass the fee engine entirely (fee-free), so a malicious client could use the tip flow to transfer $5,000 to a collaborating freelancer's account with zero platform fees. This is a potential **fee bypass / money laundering vector**.
- **Fix:** Consider lowering the tip ceiling (e.g., $500 or percentage of job value), adding rate limiting on tips per job, and/or applying a minimum platform fee on large tips.

### [HIGH] Dispute resolution financial actions are not executed via Stripe
- **File:** `server/routes/disputes.js:718-727`
- **Code:**
  ```js
  status: 'pending',  // TODO Phase 4: execute Stripe action, then mark completed
  ```
- **Risk:** The dispute resolution route records financial actions (refund to client, release to freelancer, split) but marks them as `status: 'pending'` with a TODO comment indicating Stripe execution is not yet implemented. Admin-resolved disputes don't actually move money — the resolution is recorded in the database but no refund or transfer is created in Stripe.
- **Fix:** Implement the Stripe financial execution in the dispute resolution flow: call `stripeService.refundPayment()` for client refunds, `stripeService.releasePayment()` for freelancer releases, and handle split scenarios. Mark actions as `completed` only after successful Stripe API calls.

---

## Medium Findings

### [MEDIUM] Missing idempotency keys on escrow charge and tip PaymentIntents
- **File:** `server/services/stripeService.js:75-83` (`chargeForJob`)
- **Code:**
  ```js
  async chargeForJob(amount, currency = 'usd', metadata = {}) {
    this._ensureStripe();
    return stripe.paymentIntents.create({
      amount:   Math.round(amount * 100),
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
  }
  ```
- **Also:** `chargeWithSavedMethod` at line ~180
- **Risk:** No `idempotencyKey` is passed to `stripe.paymentIntents.create()` for escrow funding or tip charges. If a client double-clicks "Pay" or a network retry occurs, duplicate PaymentIntents could be created. The `transferServicePayout` method correctly uses idempotency keys (`svc-payout-${invoiceId}`), but the primary charge flows do not.
- **Fix:** Generate an idempotency key from `jobId + userId + amount` (or `jobId + 'tip' + timestamp`) and pass it via `{ idempotencyKey }` as the second argument to `stripe.paymentIntents.create()`.

### [MEDIUM] Wallet withdrawal rollback is incomplete
- **File:** `server/routes/billing.js:960-967`
- **Code:**
  ```js
  } catch (stripeErr) {
    // Stripe failed — rollback wallet deductions, cancel withdrawal
    for (const credit of await BillingCredit.find({ user: userId, usedOn: 'wallet_withdrawal', usedAt: { $gte: new Date(Date.now() - 10000) } })) {
      // Rough rollback — find recently used credits and restore them
    }
    // More reliable: re-credit the amount
    await BillingCredit.create({
      user: userId, amount, remaining: amount,
      reason: `Withdrawal cancelled — bank transfer failed`,
      status: 'active',
    });
  ```
- **Risk:** The "rough rollback" loop body is empty — it finds credits but doesn't restore them. The fallback creates a new credit record, which works but creates phantom credits not tied to original purchases. The 10-second window (`Date.now() - 10000`) is fragile. If the Stripe transfer fails after the MongoDB transaction committed wallet deductions, the credit restoration approach works but leaves audit trail gaps.
- **Fix:** Either implement the per-credit rollback properly (restore `remaining` and `status: 'active'`) or remove the dead code and rely solely on the re-credit approach, but tag the new credit with a reference to the failed withdrawal for audit purposes.

### [MEDIUM] Split-pay creates a new Stripe instance instead of using stripeService
- **File:** `server/routes/billing.js:810-820`
- **Code:**
  ```js
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(cardPortion * 100),
    currency: 'usd',
    customer: user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: { type: 'split_payment', walletPortion: String(walletPortion), ref: ref || '' },
  });
  ```
- **Risk:** This bypasses the `stripeService` abstraction and its `verifyPMOwnership()` check. The `paymentMethodId` is used directly from `req.body` without verifying it belongs to the authenticated user's `stripeCustomerId`. A user could potentially charge another user's saved card.
- **Fix:** Route through `stripeService.chargeWithSavedMethod()` which includes the ownership verification check, or at minimum call `stripeService.verifyPMOwnership(paymentMethodId, user.stripeCustomerId)` before creating the PaymentIntent.

### [MEDIUM] Team wallet top-up bypasses stripeService abstraction
- **File:** `server/routes/teams.js:871-883`
- **Code:**
  ```js
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // ... creates customer and checkout session directly
  ```
- **Risk:** Similar to the split-pay issue — creates a raw Stripe instance instead of using `stripeService`. This bypasses any centralized error handling, logging, or API version pinning that the service provides. The `stripeService` is initialized with `apiVersion: '2026-01-28.clover'` but this raw instance uses whatever default the `stripe` package provides, potentially causing API version mismatch issues.
- **Fix:** Use `stripeService.createPaymentSession()` or equivalent method from the service layer.

### [MEDIUM] charge.refunded webhook marks payment as 'failed' instead of 'refunded'
- **File:** `server/routes/payments.js:825-831`
- **Code:**
  ```js
  case 'charge.refunded': {
    const charge = event.data.object;
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: charge.payment_intent },
      { status: 'failed' }  // mark as refunded/failed
    );
    console.log('↩️ charge.refunded:', charge.id);
    break;
  }
  ```
- **Risk:** Refunded payments are marked as `'failed'` rather than `'refunded'`. This conflates two distinct financial states — a failed charge (never collected) and a refund (collected then returned). This makes accurate financial reporting and reconciliation difficult, and could cause confusion in admin dashboards.
- **Fix:** Use `status: 'refunded'` to distinguish from genuine payment failures.

### [MEDIUM] No rate limiting on payment endpoints
- **File:** `server/routes/payments.js` (all POST routes)
- **Risk:** No rate limiting is applied to payment-sensitive endpoints like `/fund-escrow`, `/release-escrow`, `/tip`, `/methods/setup`. While Stripe has its own rate limits, a malicious actor could generate excessive PaymentIntents, SetupIntents, or transfer attempts, potentially hitting Stripe's rate limits for the entire platform.
- **Fix:** Apply rate limiting middleware (e.g., `express-rate-limit`) to payment routes — suggest 10 req/min per user for charge endpoints, 5 req/min for setup intents.

---

## Low Findings

### [LOW] Boost impression/click tracking endpoints are unauthenticated
- **File:** `server/routes/boosts.js:139-155`
- **Code:**
  ```js
  router.post('/track/impression', async (req, res) => {
  // ...
  router.post('/track/click', async (req, res) => {
  ```
- **Risk:** These endpoints accept `targetType` and `targetId` from any unauthenticated request and increment counters. An attacker could inflate boost analytics by replaying requests. This doesn't affect payments but could mislead users about boost effectiveness.
- **Fix:** Add rate limiting per IP or require authentication. Consider using a signed token or accepting these only from the frontend with CSRF protection.

### [LOW] Fallback fee calculation in payments.js defaults to 10% silently
- **File:** `server/routes/payments.js:30-33`
- **Code:**
  ```js
  } catch {
    // Fallback to flat 10% if fee engine errors
    return Math.round(amount * 0.10 * 100) / 100;
  }
  ```
- **Risk:** If the fee engine throws an error, the platform silently falls back to 10% without logging or alerting. Users on paid plans with reduced fees would be overcharged, and the error would go unnoticed.
- **Fix:** Log the error with context (userId, amount) and consider alerting on fee engine failures. The fallback itself is reasonable as a safety net.

### [LOW] Ephemeral key uses outdated API version
- **File:** `server/services/stripeService.js:273-276`
- **Code:**
  ```js
  return stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2023-10-16' }
  );
  ```
- **Risk:** The ephemeral key is pinned to API version `2023-10-16` while the main Stripe instance uses `2026-01-28.clover`. This is intentional for React Native compatibility but could cause subtle differences in Payment Sheet behavior if Stripe deprecates that API version.
- **Fix:** Monitor Stripe deprecation notices and update when React Native SDK supports newer versions.

### [LOW] `clientSecret` returned in tip response even for saved card flow
- **File:** `server/routes/payments.js:437`
- **Code:**
  ```js
  res.json({ success: true, paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret || null });
  ```
- **Risk:** For saved card tips (where `paymentMethodId` is provided), the PaymentIntent is already confirmed server-side. Returning `client_secret` is unnecessary and slightly increases the attack surface (a client_secret allows the holder to confirm/modify the PI). The `|| null` handles the case but it's cleaner to omit it entirely for the saved-card path.
- **Fix:** Only return `clientSecret` when the frontend needs to confirm payment (i.e., when `!paymentMethodId`).

### [LOW] No maximum check on wallet top-up accumulation
- **File:** `server/routes/billing.js:562-563`
- **Code:**
  ```js
  if (!amount || amount < 5) return res.status(400).json({ error: 'Minimum wallet top-up is $5' });
  if (amount > 500) return res.status(400).json({ error: 'Maximum single top-up is $500' });
  ```
- **Risk:** While individual top-ups are capped at $500, there's no limit on total wallet balance. A user could accumulate unlimited funds in their wallet. Combined with the withdrawal feature, this could be used for money laundering (load card → wallet → withdraw to Connect account).
- **Fix:** Consider adding a maximum wallet balance (e.g., $2,000) and/or daily/monthly top-up limits.

---

## Webhook Security Assessment

### ✅ Signature Verification: PASS
Both webhook endpoints properly verify Stripe signatures:
- **Payments webhook** (`payments.js:515-527`): Checks `STRIPE_WEBHOOK_SECRET`, validates `stripe-signature` header, calls `stripe.webhooks.constructEvent()`, returns 400 on missing header or invalid signature.
- **Billing webhook** (`billing.js:426-432`): Same pattern with `BILLING_WEBHOOK_SECRET`.

### ✅ Raw Body Parsing: PASS
- **File:** `server/index.js:101-103`
  ```js
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), ...);
  app.post('/api/billing/webhook',  express.raw({ type: 'application/json' }), ...);
  ```
- Webhooks are mounted **before** `express.json()` middleware, ensuring raw body is available for signature verification. This is correct.

### ✅ Idempotency Guard: PASS
Both webhook handlers use `ProcessedWebhookEvent` with a unique index on `stripeEventId` to prevent duplicate processing:
- **Payments:** `payments.js:533-540` — creates record, catches `11000` (duplicate key) and returns early
- **Billing:** `billing.js:438-446` — same pattern

### ✅ Missing Signature Header Check: PASS
- **Payments:** `payments.js:522` — `if (!sig) return res.status(400)...`
- **Billing:** relies on `constructEvent` throwing if sig is missing (acceptable but less explicit)

### ⚠️ Minor: Billing webhook doesn't explicitly check for missing `stripe-signature`
- **File:** `billing.js:426`
- The billing webhook handler doesn't check `if (!sig)` before calling `constructBillingWebhookEvent()`. It relies on the Stripe SDK throwing on a null/undefined signature. This works but is less defensive than the payments webhook.

---

## Recommendations

1. **[HIGH PRIORITY] Fix service order fee calculation** — Use `order.platformFee` / `order.escrowAmount` at completion instead of hardcoded 10%. This directly affects freelancer payouts.

2. **[HIGH PRIORITY] Add PM ownership check to split-pay** — Route through `stripeService.chargeWithSavedMethod()` or add explicit `verifyPMOwnership()` call.

3. **[HIGH PRIORITY] Implement Stripe execution in dispute resolution** — The TODO at disputes.js:727 means resolved disputes don't actually move money.

4. **[MEDIUM PRIORITY] Add idempotency keys to charge flows** — Prevent duplicate PaymentIntents on retries.

5. **[MEDIUM PRIORITY] Fix charge.refunded status** — Use `'refunded'` not `'failed'` for accurate financial reporting.

6. **[MEDIUM PRIORITY] Add rate limiting to payment endpoints** — Protect against abuse and Stripe rate limit exhaustion.

7. **[LOW PRIORITY] Add explicit sig check to billing webhook** — Match payments webhook defensive pattern.

8. **[LOW PRIORITY] Consider tip ceiling reduction** — $5,000 fee-free tips could be abused.

9. **[LOW PRIORITY] Clean up wallet withdrawal rollback** — Remove dead code, improve audit trail.

10. **[LOW PRIORITY] Use stripeService in teams.js** — Avoid raw Stripe instances for API version consistency.

---

## Files Audited

| File | Purpose |
|------|---------|
| `server/routes/payments.js` | Main escrow, tips, saved cards, webhook handler |
| `server/routes/payments.helpers.js` | Escrow amount derivation, validation |
| `server/services/stripeService.js` | Stripe API abstraction layer |
| `server/routes/billing.js` | Subscriptions, wallet, split-pay, billing webhook |
| `server/routes/billing.helpers.js` | Wallet credit creation helpers |
| `server/routes/boosts.js` | Boost payments and credit system |
| `server/routes/services.js` | Service order payments, completion, cancellation |
| `server/routes/services.payment.helpers.js` | Payment status update helpers |
| `server/routes/disputes.js` | Dispute resolution financial actions |
| `server/routes/teams.js` | Team wallet top-up |
| `server/routes/admin.js` | Admin refund endpoint (referenced) |
| `server/index.js` | Webhook mounting and raw body parsing |

---

## Stripe Key Exposure Check

✅ **No exposure found.** Searched all `.js` files (excluding `node_modules`) for `sk_live`, `sk_test`, or `STRIPE_SECRET` appearing in `console.log`, `logger`, or `res.json` calls. No matches. The key is loaded from `process.env.STRIPE_SECRET_KEY` in `stripeService.js` and never logged or returned to clients.
