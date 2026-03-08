# Email System — Fix Plan — 2026-03-07

## Root Cause Analysis

### Issue 1: Inconsistent FROM_EMAIL domain (.com vs .net)
- **`server/services/emailService.js:13`** — fallback is `noreply@fetchwork.net`
- **`server/routes/email.js:85`** — `/status` endpoint reports fallback as `noreply@fetchwork.com`
- **Impact:** If `FROM_EMAIL` env var is unset, two different parts of the app think the sender is different domains. More critically, if the Resend account only has one domain verified, emails from the other domain will silently fail (Resend returns a 403 "domain not verified" error).

### Issue 2: Silent failure on registration verification email
- **`server/routes/auth.js:57-62`** — The registration endpoint catches email send failure and logs a warning, but still returns `201` with "Please check your email to verify your account."
- **Current code:**
  ```js
  try {
    const emailService = require('../services/emailService');
    const emailWorkflowService = require('../services/emailWorkflowService');
    await emailService.sendEmailVerification(user, user.emailVerificationToken);
    setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
  } catch (emailError) {
    console.warn('Warning: Could not send verification email:', emailError.message);
  }
  ```
- **Impact:** User registers, gets told to check email, but no email was sent. User is stuck — can't log in (verification required for accounts created after 2025-07-26), can't get a verification email.

### Issue 3: Empty catch block on resend-verification
- **`server/routes/auth.js:196-197`** — The resend-verification endpoint has a completely empty catch block:
  ```js
  try {
    const emailService = require('../services/emailService');
    await emailService.sendEmailVerification(user, token);
  } catch (e) {}
  ```
- **Impact:** If the email fails to send on resend, there's zero logging. Debugging email delivery issues becomes impossible. The user gets the generic "if an account exists..." response regardless.

### Issue 4: Dead code — functions defined but never called
- **`emailService.sendNewMessageNotification()`** (line 323) — defined but never called from any route or service
- **`emailService.sendReviewNotification()`** (line 338) — defined but never called from any route or service
- **`emailWorkflowService.sendWeeklyDigest()`** (line 118) — defined but never called (no cron job or scheduler triggers it)
- **`emailWorkflowService.sendProfileCompletionReminder()`** (line 57) — only called internally from `sendOnboardingSequence` via `setTimeout` (step 2), so technically reachable but relies on in-memory `setTimeout` which won't survive server restarts
- **`emailWorkflowService.sendFirstJobGuidance()`** (line 87) — same as above, step 3 of onboarding, depends on chained `setTimeout`

### Issue 5: EmailLog model defined but never used
- **`server/models/EmailLog.js`** — Full Mongoose schema defined with indexes, but zero references anywhere in the codebase. No email is ever logged to the database.

### Issue 6: No retry logic
- **`emailService.sendEmail()`** — Single attempt, returns `{ success: false }` on failure. No retry, no queue. Transient Resend API errors = lost emails.

### Issue 7: In-memory setTimeout for onboarding sequence
- **`emailWorkflowService.sendOnboardingSequence()`** uses `setTimeout` with 24h and 72h delays. These timers are lost on any server restart/deploy, meaning steps 2 and 3 of the onboarding sequence effectively never fire in production.

### Issue 8: `sendAdminBroadcast` bypasses template wrapper
- **`emailService.js:356-390`** — `sendAdminBroadcast` calls `this.resend.emails.send()` directly instead of using `this.sendEmail()`, bypassing the null check on `this.resend`, error handling, and the branded email template.

---

## Fix 1: Normalize FROM_EMAIL fallback domain

**File:** `server/services/emailService.js`
**Line:** 13
**Current code:**
```js
this.fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.net';
```
**Fixed code:**
```js
this.fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.com';
```

**File:** `server/routes/email.js`
**Line:** 85
**Current code:**
```js
const fromEmail = process.env.FROM_EMAIL || 'noreply@fetchwork.com';
```
**No change needed** — this one already uses `.com`. Just ensure the emailService fallback matches.

**Why:** Both fallbacks must use the same domain, and that domain must be the one verified in Resend. Use `.com` as the canonical domain (matching the email.js status endpoint and admin emails in env.js).

---

## Fix 2: Log and flag email failure on registration

**File:** `server/routes/auth.js`
**Lines:** 57-62
**Current code:**
```js
try {
  const emailService = require('../services/emailService');
  const emailWorkflowService = require('../services/emailWorkflowService');
  await emailService.sendEmailVerification(user, user.emailVerificationToken);
  setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
} catch (emailError) {
  console.warn('Warning: Could not send verification email:', emailError.message);
}
```
**Fixed code:**
```js
try {
  const emailService = require('../services/emailService');
  const emailWorkflowService = require('../services/emailWorkflowService');
  const emailResult = await emailService.sendEmailVerification(user, user.emailVerificationToken);
  if (!emailResult.success) {
    console.error(`❌ Verification email FAILED for ${user.email}:`, emailResult.error);
  }
  // TODO: Replace setTimeout with a proper job queue (Bull/Agenda) for onboarding steps
  setTimeout(() => emailWorkflowService.sendOnboardingSequence(user._id), 60000);
} catch (emailError) {
  console.error(`❌ Verification email EXCEPTION for ${user.email}:`, emailError.message);
}
```
**Why:** `emailService.sendEmail()` catches its own errors and returns `{ success: false }` — it doesn't throw. The outer `try/catch` only catches import or unexpected errors. We need to check the return value. Also upgrade from `console.warn` to `console.error` so it shows in error monitoring.

**Note:** The 201 response is actually correct — the user IS registered even if the email fails. But we should ensure the resend-verification flow works so users can recover. Consider adding `emailSent: emailResult.success` to the response so the frontend can show "email failed, click to resend" immediately.

---

## Fix 3: Add logging to resend-verification catch block

**File:** `server/routes/auth.js`
**Lines:** 196-197
**Current code:**
```js
try {
  const emailService = require('../services/emailService');
  await emailService.sendEmailVerification(user, token);
} catch (e) {}
```
**Fixed code:**
```js
try {
  const emailService = require('../services/emailService');
  const result = await emailService.sendEmailVerification(user, token);
  if (!result.success) {
    console.error(`❌ Resend verification email FAILED for ${user.email}:`, result.error);
  }
} catch (e) {
  console.error(`❌ Resend verification email EXCEPTION for ${user.email}:`, e.message);
}
```
**Why:** Empty catch blocks are debugging black holes. At minimum, log the error. Same pattern as Fix 2 — check the return value since `sendEmail` doesn't throw.

---

## Fix 4: Add simple retry to sendEmail

**File:** `server/services/emailService.js`
**Lines:** 69-88 (the `sendEmail` method)
**Current code:**
```js
async sendEmail(to, subject, content, title, color) {
  if (!this.resend) {
    console.log(`[Email disabled] Would send "${subject}" to ${to}`);
    return { success: false, error: 'Email service not configured' };
  }
  try {
    const { data, error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: [to],
      subject,
      html: this.getEmailTemplate(content, title, color)
    });
    if (error) {
      console.error(`Error sending email to ${to}:`, error);
      return { success: false, error };
    }
    console.log(`Email sent successfully to ${to}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}
```
**Fixed code:**
```js
async sendEmail(to, subject, content, title, color, { maxRetries = 2 } = {}) {
  if (!this.resend) {
    console.log(`[Email disabled] Would send "${subject}" to ${to}`);
    return { success: false, error: 'Email service not configured' };
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html: this.getEmailTemplate(content, title, color)
      });

      if (error) {
        // Domain not verified or validation errors — don't retry
        if (error.statusCode === 403 || error.statusCode === 422) {
          console.error(`Email to ${to} failed (non-retryable):`, error);
          return { success: false, error };
        }
        if (attempt <= maxRetries) {
          console.warn(`Email to ${to} failed (attempt ${attempt}/${maxRetries + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        console.error(`Email to ${to} failed after ${attempt} attempts:`, error);
        return { success: false, error };
      }

      console.log(`Email sent to ${to} (attempt ${attempt}):`, data?.id);
      return { success: true, data };
    } catch (error) {
      if (attempt <= maxRetries) {
        console.warn(`Email to ${to} exception (attempt ${attempt}/${maxRetries + 1}):`, error.message);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.error(`Email to ${to} failed after ${attempt} attempts:`, error.message);
      return { success: false, error: error.message };
    }
  }
}
```
**Why:** Transient network/API errors are common. Simple exponential backoff (1s, 2s) with 2 retries handles most transient failures. Non-retryable errors (domain not verified, validation) bail immediately.

---

## Fix 5: Fix sendAdminBroadcast to use sendEmail

**File:** `server/services/emailService.js`
**Lines:** 356-390
**Current code:**
```js
async sendAdminBroadcast(recipients, subject, message) {
  try {
    const emailPromises = recipients.map(email => 
      this.resend.emails.send({
        from: this.fromEmail,
        to: [email],
        subject: `[FetchWork] ${subject}`,
        html: `...raw html...`
      })
    );
    // ...
```
**Fixed code:**
```js
async sendAdminBroadcast(recipients, subject, message) {
  if (!this.resend) {
    console.log(`[Email disabled] Would broadcast "${subject}" to ${recipients.length} recipients`);
    return { success: false, error: 'Email service not configured' };
  }
  try {
    const content = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <p style="color: #666; font-size: 14px;">
        This message was sent by the FetchWork administration team.
      </p>
    `;
    const emailPromises = recipients.map(email =>
      this.sendEmail(email, `[FetchWork] ${subject}`, content, 'Message from FetchWork Team')
    );
    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - successful;
    return { success: true, sent: successful, failed, total: recipients.length };
  } catch (error) {
    console.error('Error sending admin broadcast:', error);
    return { success: false, error: error.message };
  }
}
```
**Why:** Routes through `sendEmail` for null check, retry logic, consistent logging, and branded template.

---

## Dead Code Identified

| Function | File | Line | Status |
|---|---|---|---|
| `sendNewMessageNotification()` | emailService.js | 323 | **Never called** — no route or service invokes it |
| `sendReviewNotification()` | emailService.js | 338 | **Never called** — no route or service invokes it |
| `sendWeeklyDigest()` | emailWorkflowService.js | 118 | **Never called** — no cron/scheduler triggers it |
| `sendProfileCompletionReminder()` | emailWorkflowService.js | 57 | **Reachable only via setTimeout** — won't survive restart |
| `sendFirstJobGuidance()` | emailWorkflowService.js | 87 | **Reachable only via setTimeout** — won't survive restart |
| `EmailLog` model | models/EmailLog.js | entire file | **Never imported** — no email is ever logged to DB |

**Recommendation:** Keep the functions (they're well-written and will be needed), but:
1. Wire `sendNewMessageNotification` into the messaging routes
2. Wire `sendReviewNotification` into the review creation flow
3. Replace `setTimeout` onboarding with a proper job queue (Bull/Agenda) or at minimum a cron job that checks for users who haven't completed profile after 24h/72h
4. Either integrate `EmailLog` into `sendEmail()` or delete it to avoid confusion

---

## Manual Actions Required (Chaz)

### 1. Verify Resend domain configuration
- Log into [Resend Dashboard](https://resend.com/domains)
- Confirm which domain is verified: `fetchwork.com` or `fetchwork.net`
- If neither is verified, add and verify the domain you want to send from
- Set `FROM_EMAIL` env var on Render to match the verified domain (e.g., `noreply@fetchwork.com`)

### 2. Check FROM_EMAIL env var on Render
- Go to Render dashboard → srv-d1so7iemcj7s73e9colg → Environment
- Verify `FROM_EMAIL` is set and matches verified Resend domain
- Verify `RESEND_API_KEY` starts with `re_` and is valid

### 3. Test email delivery end-to-end
- After fixes are deployed, use the admin `/api/email/test` endpoint:
  ```
  POST /api/email/test
  { "email": "stancp327@gmail.com", "type": "verification" }
  ```
- Register a test account and confirm verification email arrives

---

## Testing Plan

### Pre-deployment (local)
1. Set `RESEND_API_KEY` to a test key and `FROM_EMAIL` to verified domain
2. Run registration flow → verify email arrives
3. Trigger resend-verification → verify email arrives
4. Check server logs for new error format on intentional failure (unset API key)
5. Verify retry logic by temporarily using invalid API key (should see retry logs)

### Post-deployment
1. Register a new test account on production
2. Confirm verification email arrives within 30 seconds
3. Check Render logs for `❌` markers (should be none if working)
4. Test forgot-password flow
5. Use admin broadcast endpoint with a single recipient
6. Monitor Resend dashboard for delivery stats

### Regression checks
- Existing users can still log in
- Google OAuth still works (bypasses email verification)
- Dispute email notifications still fire
- Job notification emails still fire

---

## Priority Order

| Priority | Fix | Risk | Effort |
|---|---|---|---|
| **P0** | Fix 1: Normalize FROM_EMAIL domain | HIGH — emails may not send at all | 1 min |
| **P0** | Manual: Verify Resend domain | HIGH — root cause of delivery failures | 5 min |
| **P1** | Fix 3: Log resend-verification errors | HIGH for debugging | 1 min |
| **P1** | Fix 2: Log registration email failures | HIGH for debugging | 2 min |
| **P2** | Fix 4: Add retry logic | MEDIUM — handles transient failures | 5 min |
| **P3** | Fix 5: Fix sendAdminBroadcast | LOW — admin-only feature | 3 min |
| **P4** | Wire dead code / integrate EmailLog | LOW — feature completeness | 30 min |
| **P4** | Replace setTimeout with job queue | LOW — onboarding steps 2-3 never fire | 2 hours |

**Total implementation time for P0-P2:** ~15 minutes of code changes + Resend dashboard check.
