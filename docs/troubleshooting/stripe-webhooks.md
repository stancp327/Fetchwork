# Stripe Webhook Test Plan
_Last updated: 2026-02-28_

## Prerequisites
- Stripe CLI installed: `brew install stripe/stripe-cli/stripe` or [download](https://stripe.com/docs/stripe-cli)
- Stripe test mode active (Dashboard → toggle top-left)
- Local server running: `npm start` in `server/`
- Webhook secret in `.env`: `STRIPE_BILLING_WEBHOOK_SECRET=whsec_...`

## 1. Forward webhooks locally

```bash
stripe login
stripe listen --forward-to http://localhost:5000/api/billing/webhook
# Copy the webhook signing secret printed — paste into .env as STRIPE_BILLING_WEBHOOK_SECRET
```

---

## 2. Test Subscription Flow (Task A)

### 2a. Happy path — subscribe + activate

```bash
# Trigger checkout.session.completed for a subscription
stripe trigger checkout.session.completed \
  --override checkout_session:mode=subscription \
  --override checkout_session:metadata.type=subscription \
  --override checkout_session:metadata.userId=<your-user-id> \
  --override checkout_session:metadata.planSlug=freelancer_plus
```

**Expected:**
- UserSubscription status → `active`
- User's plan tier updated
- BillingAuditLog entry created
- CheckoutSession fulfilled=true, status='complete'
- In-app notification sent

### 2b. Manual UI flow (most realistic)

1. Start server + client (`npm start` both)
2. Log in as `sarah.chen@test.com` / `TestPass123!`
3. Go to `/pricing` → click Freelancer Plus → Upgrade
4. In Stripe Checkout (test mode) use card: `4242 4242 4242 4242` exp: `12/34` CVC: `123`
5. After redirect → verify `/billing/success` page shows plan + amount
6. Check `/billing` page shows new plan
7. In Stripe Dashboard (test) → Customers → find customer → verify subscription active

### 2c. Session ID in success URL

After step 4 above, verify the URL contains `session_id=cs_test_...` — NOT `{CHECKOUT_SESSION_ID}` literal.
If you see the literal string, the template variable was not expanded = bug.

---

## 3. Test Payment Failed Flow

```bash
stripe trigger invoice.payment_failed
```

**Expected:**
- UserSubscription status → `past_due`
- BillingAuditLog entry: action='payment_failed'
- In-app notification created
- Email sent to user (check Resend logs or email inbox)

### Simulate with real card (test mode)
Use card `4000 0000 0000 0341` (always fails for subscriptions) at checkout.

---

## 4. Test Subscription Cancelled/Deleted

```bash
stripe trigger customer.subscription.deleted
```

**Expected:**
- UserSubscription status → `cancelled`
- User downgraded to free plan
- In-app notification: "Subscription ended"
- BillingAuditLog entry: action='plan_downgraded'

---

## 5. Test Wallet Top-up Flow (Task B)

1. Log in as a Plus/Pro user
2. Go to `/wallet` → Add funds → enter $20
3. Stripe Checkout (mode=payment) opens
4. Use card `4242 4242 4242 4242`
5. After redirect → verify `/billing/success?type=wallet` shows $20 added
6. Check `/wallet` balance increased by $20
7. BillingCredit record created in DB

```bash
# Or trigger directly:
stripe trigger checkout.session.completed \
  --override checkout_session:mode=payment \
  --override checkout_session:metadata.type=wallet_topup \
  --override checkout_session:metadata.userId=<your-user-id> \
  --override checkout_session:metadata.amount=20
```

---

## 6. Test Idempotency (Webhook Replay)

```bash
# Get a real event ID from Stripe Dashboard → Developers → Events
stripe events resend evt_1ABC...
stripe events resend evt_1ABC...  # Send again
```

**Expected:** Second delivery returns `{ received: true, skipped: true }` — no double-credit.
Check DB: BillingCredit has only ONE record for that session.

---

## 7. Test Session State

### Open → Expired
```bash
# Get session ID from CheckoutSession collection in MongoDB
# Then call expire endpoint:
curl -X POST http://localhost:5000/api/billing/sessions/cs_test_.../expire \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Expected:** CheckoutSession status='expired' in DB, Stripe confirms expired.

### Retrieve session details
```bash
curl http://localhost:5000/api/billing/sessions/cs_test_... \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 8. Stripe Dashboard Checklist

Before going live:

- [ ] Webhook endpoint registered: `https://fetchwork-1.onrender.com/api/billing/webhook`
- [ ] Events enabled on webhook: `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- [ ] Stripe Billing webhook secret stored in Render env: `STRIPE_BILLING_WEBHOOK_SECRET`
- [ ] Payment methods enabled: Cards + Link (Dashboard → Settings → Payment Methods)
- [ ] Subscription retry settings: Dashboard → Billing → Settings → Retry schedule (recommend: 3 retries over 7 days → cancel)
- [ ] Customer Portal enabled: Dashboard → Settings → Customer Portal → turn on
- [ ] Test mode → Live mode switch: done only when ready for real payments

---

## 9. Test Cards Reference

| Card | Behavior |
|---|---|
| `4242 4242 4242 4242` | Always succeeds |
| `4000 0000 0000 0341` | Always fails (subscription) |
| `4000 0025 0000 3155` | Requires 3D Secure |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |

All test cards: exp `12/34`, CVC `123`, any ZIP.
