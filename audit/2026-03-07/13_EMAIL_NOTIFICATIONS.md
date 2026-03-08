# 13_EMAIL_NOTIFICATIONS.md
**Audit Date:** 2026-03-07  
**Agent:** SCOUT-EMAIL  
**Scope:** Email sending infrastructure, Resend integration, verification flow, admin notifications, failure modes

---

## Summary

FetchWork uses **Resend** as its sole email delivery service via the `resend` npm package. The email system is well-structured but has **critical gaps**: the local `.env` file has **no `RESEND_API_KEY` set**, which means email is **completely disabled** in the local development environment. In production/staging, `FROM_EMAIL` is set to `notifications@fetchwork.net` — but there is **no evidence** this domain is verified in Resend. Additionally, a minor inconsistency exists between the fallback "from" addresses in two different files. The verification email flow itself is correctly implemented (token generation, 24-hour expiry, correct URL structure), but email delivery depends entirely on the Resend configuration being correct in the deployed environment.

---

## Resend Integration Map

### Initialization
- **File:** `server/services/emailService.js` (lines 3–17)
- **Pattern:** Singleton class instantiated at module load time (`module.exports = new EmailService()`)
- **API Key env var:** `RESEND_API_KEY`
- **Initialization code:**
  ```js
  const apiKey = process.env.RESEND_API_KEY;
  this.enabled = !!apiKey;
  if (apiKey) {
    this.resend = new Resend(apiKey);
  } else {
    console.warn('RESEND_API_KEY not set — email service disabled');
    this.resend = null;
  }
  ```
- **Graceful degradation:** Yes — if `RESEND_API_KEY` is absent, `this.resend = null` and all send attempts return `{ success: false, error: 'Email service not configured' }` with a console.log only (no exception thrown to callers).

### From Address
- **Primary source:** `process.env.FROM_EMAIL`
- **Fallback in `emailService.js` line 13:** `'noreply@fetchwork.net'`
- **Fallback in `routes/email.js` line 85 (status route only):** `'noreply@fetchwork.com'` ← **DISCREPANCY** (`.com` vs `.net`)
- **Production example (`.env.production.example`):** `FROM_EMAIL=notifications@fetchwork.net`
- **Staging example (`.env.staging.example`):** `FROM_EMAIL=notifications@fetchwork.net`
- **Local `.env`:** `FROM_EMAIL` **NOT SET** — falls back to `noreply@fetchwork.net`

### Domain Used
`fetchwork.net` (production/staging)  
`fetchwork.com` (status route fallback only — appears to be a typo/copy-paste error)

---

## All Email Types (with file:line)

| # | Email Type | Function | Triggered From | File:Line |
|---|-----------|----------|----------------|-----------|
| 1 | **Email Verification** | `sendEmailVerification(user, token)` | POST `/auth/register` | `auth.js:59` |
| 2 | **Email Verification (resend)** | `sendEmailVerification(user, token)` | POST `/auth/resend-verification` | `auth.js:267` |
| 3 | **Welcome Email** | `sendWelcomeEmail(user)` | Admin test + onboarding sequence | `emailService.js:47` |
| 4 | **Password Reset** | `sendPasswordResetEmail(user, token)` | POST `/auth/forgot-password` | `auth.js:306` |
| 5 | **New Proposal Notification** | `sendJobNotification(client, job, 'new_proposal')` | POST proposals route | `jobs.js:734` |
| 6 | **Job Accepted Notification** | `sendJobNotification(user, job, 'job_accepted')` | Job acceptance flow | `emailService.js:154` |
| 7 | **Job Completed Notification** | `sendJobNotification(user, job, 'job_completed')` | Job completion flow | `emailService.js:166` |
| 8 | **Payment Received** | `sendPaymentNotification(freelancer, payment, 'payment_received')` | Payout webhook | `payments.js:415` |
| 9 | **Escrow Funded** | `sendPaymentNotification(freelancer, payment, 'escrow_funded')` | Escrow creation | `payments.js:318` |
| 10 | **Payment Released** | `sendPaymentNotification(user, payment, 'payment_released')` | Release flow | `emailService.js:221` |
| 11 | **Payout Account Alert** | `sendEmail(user.email, 'Action required: Update your payout account', ...)` | Stripe `account.updated` webhook | `payments.js:809` |
| 12 | **Failed Payment Method** | `sendEmail(user.email, subject, content, ...)` | Stripe billing webhook | `billing.js:328` |
| 13 | **Dispute Filed** | `sendDisputeNotification(otherParty, filer, dispute, job)` | POST `/disputes` | `disputes.js:164` |
| 14 | **Dispute Status Change** | `sendDisputeStatusChange(client/freelancer, ...)` | PATCH dispute status | `disputes.js:516-517` |
| 15 | **Dispute Resolved** | `sendDisputeResolutionNotification(client/freelancer, dispute)` | Dispute resolution | `disputes.js:786-787` |
| 16 | **Dispute Message** | `sendDisputeMessageNotification(recipient, ...)` | (defined in service, **not called anywhere found**)| `emailService.js:330` |
| 17 | **New Message Notification** | `sendNewMessageNotification(recipient, sender, conversationId)` | (defined in service, **not called anywhere found**) | `emailService.js:341` |
| 18 | **Review Notification** | `sendReviewNotification(recipient, reviewer, job, rating)` | (defined in service, **not called in reviews.js**) | `emailService.js:352` |
| 19 | **Team Invitation** | `sendEmail(invitee.email, 'You're invited to join...', ...)` | Team invite flow | `teams.js:348` |
| 20 | **Admin Broadcast** | `sendAdminBroadcast(recipients, subject, message)` | POST `/email/broadcast` (admin only) | `email.js:64` |
| 21 | **Profile Completion Reminder** | `sendEmail(user.email, ...)` | Onboarding sequence step 2 | `emailWorkflowService.js:~63` |
| 22 | **First Job Guidance** | `sendEmail(user.email, ...)` | Onboarding sequence step 3 | `emailWorkflowService.js:~82` |
| 23 | **Weekly Digest** | `sendWeeklyDigest(userId)` | (defined, no cron found calling it) | `emailWorkflowService.js:~98` |
| 24 | **Contact Form** | *(NOT implemented — logs to console only)* | POST `/contact` | `contact.js:34-49` |

---

## Verification Email Flow (Step-by-Step with Evidence)

### Step 1: Token Generation on Signup
**File:** `server/routes/auth.js` lines 34–36
```js
emailVerificationToken: crypto.randomBytes(32).toString('hex'),
emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000   // 24-hour expiry
```
✅ Token is 32 random bytes (64-char hex) — cryptographically secure  
✅ 24-hour expiry window is set at creation

### Step 2: User Saved to DB
**File:** `auth.js` lines 39–44  
Token and expiry are saved with the new User document via `await user.save()`.

### Step 3: Verification Email Sent
**File:** `auth.js` lines 57–59
```js
const emailService = require('../services/emailService');
const emailWorkflowService = require('../services/emailWorkflowService');
await emailService.sendEmailVerification(user, user.emailVerificationToken);
```
This call is **inside a try/catch** (lines 56–61) — failure is non-fatal:
```js
} catch (emailError) {
  console.warn('Warning: Could not send verification email:', emailError.message);
}
```
⚠️ **Email send failure is silently swallowed** — the user is told to check email even if email failed to send.

### Step 4: Verification Email Template
**File:** `server/services/emailService.js` lines 95–118, function `sendEmailVerification()`
- **Verification URL construction:** `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`
- **Subject:** "Verify Your FetchWork Account"
- **Content:** CTA button + plaintext URL fallback + 24-hour expiry notice
- **Token is passed directly in the URL query param** (no hashing)

### Step 5: Verification Link Domain
- Uses `process.env.CLIENT_URL` for the link
- **Production:** `CLIENT_URL=https://fetchwork.net` → link is `https://fetchwork.net/verify-email?token=...` ✅
- **Staging:** `CLIENT_URL=https://fetchwork-temp.vercel.app` → link is `https://fetchwork-temp.vercel.app/verify-email?token=...` ✅
- **Local dev:** `CLIENT_URL=http://localhost:3000` → link points to localhost ⚠️ (expected for dev, but dangerous if local config is accidentally used in production)

### Step 6: Token Verification Endpoint
**File:** `auth.js` lines 183–205, `GET /api/auth/verify-email?token=`
```js
const user = await User.findOne({
  emailVerificationToken: token,
  emailVerificationExpires: { $gt: Date.now() }   // expiry check enforced
});
if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

await User.updateOne({ _id: user._id }, {
  $set: { isVerified: true, isEmailVerified: true, verificationLevel: 'email' },
  $unset: { emailVerificationToken: '', emailVerificationExpires: '' },  // token cleared
  $addToSet: { badges: 'email_verified' }
});
```
✅ Expiry is enforced server-side  
✅ Token is one-time use (cleared on verification)  
✅ Sets `isVerified`, `isEmailVerified`, `verificationLevel: 'email'`, and `email_verified` badge

### Step 7: Resend Verification Route
**File:** `auth.js` lines 213–278, `POST /api/auth/resend-verification`
- Rate limiting: max 5 resends per 24h per IP **and** per email (in-memory Map, resets on server restart)
- Generates fresh token + 24-hour expiry
- Sends via `emailService.sendEmailVerification(user, token)`
- **Error handling on resend:** catch block is **empty** (`} catch (e) {}`) — lines 266–268
  ```js
  try {
    await emailService.sendEmailVerification(user, token);
  } catch (e) {}   // ← completely silent failure
  ```
  ⚠️ **No error logged, no user feedback if resend fails**

---

## Failure Modes Found

### 🔴 CRITICAL: RESEND_API_KEY Not Set in Local .env
**File:** `server/.env` (no `RESEND_API_KEY` line)  
The actual local `.env` file contains only database config. `RESEND_API_KEY` is **missing entirely**.  
- In `emailService.js` this causes `this.resend = null` and all emails are disabled
- Console shows: `RESEND_API_KEY not set — email service disabled`
- **Impact:** All email (including verification) is silently disabled locally

### 🔴 CRITICAL: FROM_EMAIL Domain May Not Be Verified in Resend
**Evidence:** `.env.production.example` shows `FROM_EMAIL=notifications@fetchwork.net`  
- Resend requires the sender domain (`fetchwork.net`) to be verified via DNS records
- There is **no code-level verification** of this — the system simply fails silently if domain is unverified
- Most common real-world cause of Resend emails not being delivered

### 🟠 HIGH: Verification Email Send Failure Is Silently Ignored
**File:** `auth.js` lines 56–61
```js
} catch (emailError) {
  console.warn('Warning: Could not send verification email:', emailError.message);
}
```
- User receives HTTP 201 with "Please check your email" even if email send failed
- No mechanism to alert the user that the email wasn't sent
- No retry logic

### 🟠 HIGH: Resend Verification Error Handler Is Completely Silent
**File:** `auth.js` lines 266–268
```js
try {
  await emailService.sendEmailVerification(user, token);
} catch (e) {}
```
- Empty catch block: no log, no error, no feedback to user
- If Resend is down or rate-limited, the resend verification call will silently fail

### 🟡 MEDIUM: Contact Form Sends No Email
**File:** `server/routes/contact.js` lines 34–49  
The contact form handler logs the submission to console and returns success, but **never actually sends an email**. This appears to be an unfinished stub.

### 🟡 MEDIUM: Three Email Functions Defined but Never Called
- `sendDisputeMessageNotification()` — defined in `emailService.js:330`, never called in disputes.js
- `sendNewMessageNotification()` — defined in `emailService.js:341`, never called in messages.js
- `sendReviewNotification()` — defined in `emailService.js:352`, never called in reviews.js
- `sendWeeklyDigest()` — defined in `emailWorkflowService.js`, never called by a cron job

### 🟡 MEDIUM: Inconsistent Fallback "From" Address
- `emailService.js` line 13 fallback: `'noreply@fetchwork.net'`
- `routes/email.js` line 85 (status check only) fallback: `'noreply@fetchwork.com'`
- The `.com` in the status route is likely a typo. The operative address used for actual sends is `.net`.

### 🟡 MEDIUM: In-Memory Rate Limiter for Resend Verification
**File:** `auth.js` lines 218–273  
Rate limiting uses `req.app.locals._resendEmail` (in-memory Map):
- **Resets on every server restart** — limits can be bypassed by triggering a deploy
- Not suitable for multi-process deployments (each process has its own Map)

### 🟢 LOW: Onboarding Email Sequence Uses `setTimeout`
**File:** `emailWorkflowService.js` lines 31–46
```js
setTimeout(() => this.sendOnboardingSequence(userId, 2), 24 * 60 * 60 * 1000);
setTimeout(() => this.sendOnboardingSequence(userId, 3), 72 * 60 * 60 * 1000);
```
- Lost on server restart — onboarding emails for recent signups won't fire after a redeploy
- No persistence or queue backing

### 🟢 LOW: No Retry Logic Anywhere
No email send in the codebase has retry logic. Transient Resend API failures result in permanent non-delivery.

### 🟢 LOW: Token Stored in Plain Text
The `emailVerificationToken` and `resetPasswordToken` are stored as plain hex strings in MongoDB without hashing. If the DB is compromised, tokens can be used directly. (Low severity given they expire in 24h/1h respectively.)

---

## Likely Root Cause of Missing Verification Emails

**Most probable causes (in order of likelihood):**

1. **`RESEND_API_KEY` not set in the deployed Render environment**  
   The local `.env` has no key. If the production Render service environment variables were not manually configured with `RESEND_API_KEY`, email is disabled with a console warning only — no error reaches the user or logs clearly.

2. **`fetchwork.net` domain not verified in the Resend dashboard**  
   Even with a valid API key, Resend will reject sends from an unverified domain. The error goes to the console (`Error sending email to ...`) but the registration still succeeds, leaving the user with no verification email.

3. **`CLIENT_URL` misconfiguration pointing to wrong domain**  
   If `CLIENT_URL` is not set correctly in production, the verification link in the email points to the wrong domain (or localhost), making the email useless even if delivered.

---

## Recommendations

### Immediate (Fix Broken Email)

1. **Verify `RESEND_API_KEY` is set in Render environment variables**  
   Check Render dashboard → fetchwork service → Environment. Confirm `RESEND_API_KEY` has a live key (not a placeholder like `re_xxxx`).

2. **Verify `fetchwork.net` domain in Resend dashboard**  
   Go to resend.com → Domains → Add/verify `fetchwork.net`. Add the required DNS TXT/MX records. This is the #1 cause of silent Resend delivery failures.

3. **Confirm `FROM_EMAIL=notifications@fetchwork.net` in Render environment**  
   Must match the verified domain exactly. Even a subdomain mismatch (e.g., sending from `noreply@fetchwork.net` when only `notifications@fetchwork.net` is verified) can cause failure.

4. **Confirm `CLIENT_URL=https://fetchwork.net` in Render environment**  
   The verification link is built as `${CLIENT_URL}/verify-email?token=...` — if this is wrong, users click a broken link.

### Short-Term (Reliability)

5. **Add logging to the resend-verification empty catch block** (`auth.js` line 268)  
   At minimum: `console.error('Resend verification email failed:', e.message)`

6. **Surface email send failure to the user on registration**  
   Currently the 201 response always says "check your email." Consider adding a flag like `{ emailSent: false }` so the frontend can show "We had trouble sending the email — please use the resend link."

7. **Fix the contact form** (`contact.js`)  
   Currently a stub that logs to console. Either integrate with `emailService` to forward to `support@fetchwork.net`, or remove the route.

### Medium-Term (Completeness)

8. **Wire up the unused email functions:**  
   - `sendNewMessageNotification` → call from `messages.js` on new message
   - `sendReviewNotification` → call from `reviews.js` on review submit  
   - `sendDisputeMessageNotification` → call from dispute message handler

9. **Set up cron for `sendWeeklyDigest`**  
   Currently defined but never scheduled. Add to `recurringCron.js`.

10. **Replace in-memory rate limiter with Redis** for resend-verification throttling  
    In-memory Maps don't survive server restarts and don't work across multiple processes.

11. **Replace `setTimeout`-based onboarding sequence with a persistent queue**  
    Use Bull/BullMQ or a DB-backed job table so onboarding emails survive redeploys.

12. **Fix the fallback address inconsistency** in `routes/email.js` line 85  
    Change `'noreply@fetchwork.com'` → `'noreply@fetchwork.net'` to match the service default.

---

## SCOUT-EMAIL COMPLETE
