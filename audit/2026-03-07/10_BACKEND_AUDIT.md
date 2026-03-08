# Backend Routes Audit — 2026-03-07

## Summary

- **Total files:** 54 (40 route files + 14 helper files)
- **Total endpoints:** ~387 (170 GET, 132 POST, 37 PUT, 19 PATCH, 29 DELETE)
- **Overall grade: B-** — Solid foundation with consistent patterns in most files, but several security gaps and missing hardening that need attention before production scale.
- **Key patterns:** Auth middleware is well-applied (only 1 route file truly missing auth). Error responses are mostly consistent (`{error: ...}` dominant at 958 uses vs `{message: ...}` at 96). Rate limiting is severely lacking (only 3 of 40 route files use it). Input validation varies widely.

---

## Critical Findings

### [CRITICAL] ReDoS Vulnerability in categories.js
- **File:** `categories.js`, lines 37, 60-61
- **Pattern:** `req.params.id` is interpolated directly into `new RegExp()` without escaping
- **Code:** `const catFilter = { $regex: new RegExp(\`^${catId}$\`, 'i') };`
- **Risk:** An attacker can craft a category ID with regex special characters that causes catastrophic backtracking, hanging the Node.js event loop (Denial of Service). Also allows regex injection to bypass category filtering.
- **Fix:** Use `escapeRegex()` (already imported in `freelancers.js`) on `catId` before constructing the RegExp, or use exact string matching instead of regex.

### [CRITICAL] Unauthenticated Email Unsubscribe Allows Account Manipulation
- **File:** `preferences.js`, lines 37-63
- **Pattern:** `POST /unsubscribe` accepts `{ email }` in body with NO authentication
- **Risk:** Anyone can disable email notifications for any user by guessing/knowing their email. This could be used to suppress security alerts (password reset notifications, payment notifications) before an attack. Note: `paymentNotifications` stays `true` in the "all" case, but all other notifications can be silenced.
- **Fix:** Either require authentication, or use a signed unsubscribe token (HMAC of email + user ID) in unsubscribe links.

### [CRITICAL] Email Broadcast Loads All Users Without Pagination
- **File:** `email.js`, line 57
- **Pattern:** `User.find(query, 'email')` with no `.limit()` — loads ALL matching users into memory
- **Risk:** With thousands of users, this will cause memory exhaustion and potential OOM crash. Also, sending to all users at once could hit email provider rate limits and get the account suspended.
- **Fix:** Implement cursor-based pagination or use a background job queue for broadcasts.

---

## High Findings

### [HIGH] Rate Limiting Almost Entirely Missing
- **Files affected:** 37 of 40 route files have ZERO rate limiting
- **Only protected:** `ai.js` (AI generation), `disputes.js` (filing + messages), `skills.js` (quiz attempts)
- **Unprotected critical endpoints:**
  - `auth.js` — login, registration, password reset (brute force risk)
  - `payments.js` — all payment operations
  - `billing.js` — subscription and wallet operations
  - `search.js` — search endpoints (scraping risk)
  - `contact.js` — contact form (spam risk)
  - `messages.js` — message sending (abuse risk)
- **Risk:** Brute force attacks on login, spam through contact form, API abuse on search, payment replay attacks
- **Fix:** Add rate limiting middleware to auth endpoints (strict: 5-10/min), payment endpoints (moderate: 30/min), and all public endpoints (generous: 100/min)

### [HIGH] stats.js Returns Fake Data on Error (Status 200)
- **File:** `stats.js`, line 20
- **Pattern:** Catch block returns `res.json({ jobs: 24, freelancers: 50, services: 35, reviews: 120 })` — hardcoded fake stats with status 200
- **Risk:** Masks database failures silently. Frontend displays incorrect data without any indication of failure. Debugging production issues becomes nearly impossible.
- **Fix:** Return proper error response or cache last-known-good values with a staleness indicator.

### [HIGH] Console.log Statements Leaking Email Addresses in Production
- **Files:** `auth.js` (lines 43, 82, 87, 94, 286, 291, 295, 302, 307, 386), `admin.js` (lines 838, 879, 929, 946, 1542)
- **Pattern:** `console.log` with user emails — login attempts, password resets, admin actions
- **15 instances** of email addresses logged
- **Risk:** PII in logs violates privacy best practices. If logs are shipped to a third-party service, email addresses are exposed. Some logs fire on every login attempt.
- **Fix:** Replace with structured logger that redacts PII, or remove email from log messages (use user ID instead).

### [HIGH] auth.js Login Logs with isDev Guard Are Insufficient
- **File:** `auth.js`, lines 82, 87, 94
- **Pattern:** `if (isDev) console.log(...)` — but lines 43, 286, 291, 295, 302, 307, 386 log emails WITHOUT the isDev guard
- **Risk:** 8 of 11 email-logging statements in auth.js run in ALL environments including production
- **Fix:** Wrap all sensitive logs in isDev guard or use a proper logger with PII redaction.

### [HIGH] contact.js Logs Full Contact Form Submissions
- **File:** `contact.js`, lines 38-43
- **Pattern:** `console.log('Contact form submission:', { name, email, subject, message... })`
- **Risk:** Logs name and email of every contact form submission in production. Combined with no rate limiting, this could fill logs rapidly.
- **Fix:** Remove or gate behind isDev. Use structured logging without PII.

### [HIGH] Inconsistent Error Response Shapes
- **Pattern:** 958 uses of `{ error: '...' }` vs 96 uses of `{ message: '...' }` for responses
- **Files with both patterns in the same file:** `admin.js`, `auth.js`, `availability.js`, `backgroundChecks.js`, `billing.js`, `disputes.js`, `email.js`, `errors.js`, `preferences.js`
- **Risk:** Frontend must handle multiple response shapes, leading to inconsistent error display and harder debugging. Some success responses use `{ message: }` which overlaps with error responses.
- **Fix:** Standardize on `{ error: '...' }` for errors and `{ message: '...' }` for success messages exclusively. Consider a shared response helper.

---

## Medium Findings

### [MEDIUM] No MongoDB ID Validation on Most Routes
- **Files with validation:** `ai.js`, `jobs.js` (extensive use of `validateMongoId`)
- **Files WITHOUT:** All other route files that accept `:id` params — `admin.js`, `bookings.js`, `contracts.js`, `disputes.js`, `messages.js`, `offers.js`, `reviews.js`, `services.js`, `teams.js`, `users.js`, etc.
- **Risk:** Invalid ObjectId params cause Mongoose CastError (500 response) instead of clean 400. Clutters error logs.
- **Fix:** Add `validateMongoId` middleware to all routes with `:id` params, or add a global param handler.

### [MEDIUM] Missing Pagination on Multiple List Endpoints
- **Files affected:**
  - `availability.js` — lines 84, 118, 214 (3 GET endpoints)
  - `calendar.js` — lines 24, 55, 70 (3 GET endpoints)
  - `email.js` — line 82 (admin email status, less critical)
  - `jobTemplates.js` — line 12 (user templates list)
  - `organizations.js` — lines 66, 98, 308 (3 GET endpoints)
  - `preferences.js` — line 6 (single user, less critical)
  - `publicProfiles.js` — line 5 (single profile, less critical)
  - `referrals.js` — line 33 (user referrals list)
- **Risk:** As data grows, unbounded queries will cause slow responses, high memory usage, and potential timeouts
- **Fix:** Add `page`/`limit` query params with sensible defaults (10-25) and max limits (50-100)

### [MEDIUM] N+1 Query Pattern in jobAlerts.js
- **File:** `jobAlerts.js`, line 79
- **Pattern:** `for (const alert of alerts)` — loads ALL active instant alerts, then iterates in-memory
- **Risk:** With many users creating job alerts, this loop grows unboundedly. Currently does in-memory filtering (no DB calls in loop), but the initial `JobAlert.find({ active: true, frequency: 'instant' })` loads all alerts into memory without pagination.
- **Fix:** Use MongoDB aggregation pipeline to filter alerts server-side, or add index + query filters to reduce the working set.

### [MEDIUM] Potential N+1 in admin.js Service Orders
- **File:** `admin.js`, lines 1982-1983
- **Pattern:** Nested `for` loops: `for (const svc of services) { for (const order of (svc.orders || [])) { ... } }`
- **Risk:** If services have many embedded orders, this could be slow. Depends on data shape.
- **Fix:** Use aggregation pipeline with `$unwind` for better performance at scale.

### [MEDIUM] billing.js DB Call Inside Error Recovery Loop
- **File:** `billing.js`, line 989
- **Pattern:** `for (const credit of await BillingCredit.find(...))` inside a catch block for Stripe failure rollback
- **Risk:** If the rollback query itself fails, the error is silently swallowed. Also, the loop body appears empty (just a comment about "rough rollback").
- **Fix:** Implement proper transaction rollback or idempotent retry logic. The empty loop body suggests this rollback is incomplete/broken.

### [MEDIUM] Public Routes Without Auth — Intentional but Noteworthy
- **Files with no auth at all:**
  - `categories.js` — public category browsing (OK)
  - `freelancers.js` — public freelancer directory (OK)
  - `publicProfiles.js` — public username profiles (OK)
  - `search.js` — public job search (OK but needs rate limiting)
  - `seo.js` — robots.txt + sitemap (OK)
  - `stats.js` — public homepage stats (OK)
  - `contact.js` — contact form (needs rate limiting + CAPTCHA)
- **Risk:** These are intentionally public, but several lack rate limiting, allowing scraping/abuse
- **Fix:** Add rate limiting to search, contact, and stats endpoints

---

## Low Findings / Code Quality

### [LOW] Inconsistent req.user Access Patterns
- **Pattern:** Some files use `req.user._id`, others `req.user.userId`, others `req.user.id`, and some use fallbacks like `req.user._id || req.user.userId`
- **Files with fallback pattern:** `admin.js` (line 1535), `analytics.js` (line 66), `auth.js` (line 152), `bookings.js` (line 164)
- **Risk:** Suggests the auth middleware may set different property names in different contexts. Not a security issue but increases bug surface.
- **Fix:** Standardize auth middleware to always set `req.user.id` and update all route files.

### [LOW] Helper Files Mixed with Route Files
- **14 helper files** in the routes directory: `services.helpers.js`, `services.fees.helpers.js`, `services.metadata.helpers.js`, `services.messaging.helpers.js`, `payments.helpers.js`, `services.transitions.helpers.js`, `services.order.helpers.js`, `services.lookup.helpers.js`, `billing.helpers.js`, `services.response.helpers.js`, `services.payment.helpers.js`, `services.conversation.helpers.js`, `services.state.helpers.js`, `services.notification.helpers.js`
- **Risk:** Clutters the routes directory. Makes it harder to reason about which files define routes vs utilities.
- **Fix:** Move helpers to a `routes/helpers/` subdirectory or a `services/` directory.

### [LOW] admin.js Try/Catch Coverage Gap
- **File:** `admin.js` — 72 async route handlers, 71 try/catch blocks
- **Risk:** One async handler may be missing error handling, leading to unhandled promise rejection
- **Fix:** Find and add the missing try/catch block. Consider using an `asyncHandler` wrapper.

### [LOW] Inconsistent Import Patterns
- **File:** `freelancers.js`, lines 175, 181, 187
- **Pattern:** `require('../models/Service')`, `require('../models/Review')`, `require('../models/Job')` called inside route handler instead of at file top
- **Risk:** Not a performance issue (Node caches requires), but inconsistent with all other files and harder to track dependencies.
- **Fix:** Move requires to top of file.

### [LOW] seo.js Sitemap Could Return Very Large Responses
- **File:** `seo.js`, lines 82-85
- **Pattern:** Queries up to 1000 jobs + 1000 freelancers + 1000 services for sitemap XML
- **Risk:** 3000+ URL entries could generate a very large XML response. Not paginated with sitemap index.
- **Fix:** For large sites, use a sitemap index with multiple sitemap files (per type or paginated).

---

## Route Coverage Matrix

| File | Has Auth | Has Validation | Has Try/Catch | Has Pagination | Has Rate Limit |
|------|----------|---------------|---------------|----------------|----------------|
| admin.js | ✅ | ✅ | ✅ (71/72) | ✅ | ❌ |
| ai.js | ✅ | ✅ | ✅ | ✅ | ✅ |
| analytics.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| auth.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| availability.js | ✅ | ❌ | ✅ | ❌ | ❌ |
| backgroundChecks.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| billing.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| bookings.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| boosts.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| calendar.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| calls.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| categories.js | ❌ (public) | ❌ | ✅ | ✅ | ❌ |
| chatrooms.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| contact.js | ❌ (public) | ✅ | ✅ | ❌ | ❌ |
| contracts.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| disputes.js | ✅ | ✅ | ✅ | ✅ | ✅ |
| email.js | ✅ | ❌ | ✅ | ❌ | ❌ |
| errors.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| freelancers.js | ❌ (public) | ✅ | ✅ | ✅ | ❌ |
| jobAlerts.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| jobs.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| jobTemplates.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| messages.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| notifications.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| offers.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| organizations.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| payments.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| portfolio.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| preferences.js | ✅* | ❌ | ✅ | ❌ | ❌ |
| publicProfiles.js | ❌ (public) | ✅ | ✅ | ❌ | ❌ |
| referrals.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| reviews.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| saved.js | ✅ | ❌ | ✅ | ✅ | ❌ |
| search.js | ❌ (public) | ✅ | ✅ | ✅ | ❌ |
| seo.js | ❌ (public) | ❌ | ✅ | ✅ | ❌ |
| services.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| skills.js | ✅ | ❌ | ✅ | ✅ | ✅ |
| stats.js | ❌ (public) | ❌ | ✅* | ✅ | ❌ |
| teams.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| users.js | ✅ | ✅ | ✅ | ✅ | ❌ |

\* `preferences.js` has auth on 2/3 routes (unsubscribe is unauthenticated)
\* `stats.js` has try/catch but catch returns fake data with 200 status

---

## Recommendations (Prioritized)

1. **[CRITICAL] Fix ReDoS in categories.js** — Escape `req.params.id` before using in RegExp. Quick fix, high impact.

2. **[CRITICAL] Secure the unsubscribe endpoint** — Add signed token authentication to `POST /preferences/unsubscribe`. Don't allow unauthenticated email-based account modification.

3. **[CRITICAL] Add pagination to email broadcast** — `email.js` line 57 loads all users. Use cursor-based streaming or a job queue.

4. **[HIGH] Add rate limiting to auth endpoints** — Login, register, password reset, and email verification need aggressive rate limiting (5-10 req/min per IP).

5. **[HIGH] Add rate limiting to public endpoints** — search, contact form, freelancer browse, categories overview.

6. **[HIGH] Remove or redact PII from console.log** — Replace email logging in `auth.js` and `admin.js` with user ID references or use a structured logger with PII redaction.

7. **[HIGH] Standardize error response shapes** — Create a shared `sendError(res, status, message)` helper and migrate all routes.

8. **[HIGH] Fix stats.js error handling** — Return 500 on error instead of fake data. Cache last-known-good values separately.

9. **[MEDIUM] Add validateMongoId to all param routes** — Create a shared param middleware: `router.param('id', validateMongoId)`.

10. **[MEDIUM] Add pagination to availability, calendar, organizations, referrals, jobTemplates** endpoints.

11. **[MEDIUM] Fix incomplete rollback logic in billing.js** — Line 989's loop body is empty. Implement or remove.

12. **[MEDIUM] Optimize jobAlerts query** — Add filters to the initial query instead of loading all alerts and filtering in-memory.

13. **[LOW] Standardize req.user property access** — Pick `req.user.id` and use it everywhere.

14. **[LOW] Move helper files out of routes directory** — Create `routes/helpers/` or `lib/` subdirectory.

15. **[LOW] Add asyncHandler wrapper** — Prevents the missing try/catch pattern entirely with a utility wrapper.

---

## Files Audited

**Total: 54 files** (40 route files + 14 helper files)

### Route Files (40):
admin.js (2251 lines), teams.js (1893), jobs.js (1149), services.js (1148), billing.js (1133), payments.js (976), disputes.js (888), users.js (724), messages.js (636), auth.js (577), analytics.js (529), contracts.js (366), organizations.js (336), bookings.js (317), offers.js (315), skills.js (295), availability.js (276), boosts.js (275), backgroundChecks.js (273), freelancers.js (232), reviews.js (223), ai.js (223), chatrooms.js (204), errors.js (188), calls.js (171), referrals.js (129), jobAlerts.js (127), seo.js (116), calendar.js (102), search.js (102), email.js (98), categories.js (86), jobTemplates.js (80), saved.js (75), notifications.js (66), preferences.js (65), portfolio.js (59), contact.js (54), publicProfiles.js (51), stats.js (24)

### Helper Files (14):
services.helpers.js (63), services.fees.helpers.js (47), services.metadata.helpers.js (36), services.messaging.helpers.js (35), payments.helpers.js (28), services.transitions.helpers.js (28), services.order.helpers.js (24), services.lookup.helpers.js (23), billing.helpers.js (23), services.response.helpers.js (23), services.payment.helpers.js (22), services.conversation.helpers.js (21), services.state.helpers.js (21), services.notification.helpers.js (12)

**Total lines of code: ~16,498**
