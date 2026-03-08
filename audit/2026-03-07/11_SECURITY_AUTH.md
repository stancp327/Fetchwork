# Security & Auth Audit — 2026-03-07

## Summary

Audited the Fetchwork authentication, authorization, OAuth, and RBAC systems across 6 core files and 35 route files. The codebase has a solid security foundation — JWT tokens include `tokenVersion` for session invalidation, bcrypt uses 14 rounds, rate limiting is applied to auth endpoints, helmet and CORS are configured, and admin routes consistently use `authenticateAdmin` + `requirePermission`. However, several **HIGH** and **MEDIUM** severity issues were found around OAuth token leakage in URLs, missing password-change token invalidation, admin recovery brute-force risk, and email enumeration in dev logs.

**Findings:** 0 Critical, 5 High, 8 Medium, 4 Low

---

## Critical Findings

_None identified._

---

## High Findings

### [HIGH] H1 — JWT Token Leaked in OAuth Redirect URL

- **File:** `server/routes/auth.js:409-415` (Google), `server/routes/auth.js:439-445` (Facebook)
- **Code:**
  ```js
  res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({...}))}`);
  ```
- **Risk:** The JWT access token is passed as a URL query parameter in the OAuth callback redirect. URL query parameters are logged in browser history, server access logs, Referer headers leaked to third-party resources on the callback page, and potentially in CDN/proxy logs. This exposes the 7-day JWT to unintended parties.
- **Fix:** Use a short-lived authorization code pattern: generate a one-time code, store it server-side (Redis/DB with 60s TTL), redirect with `?code=XXX`, then the client exchanges the code for the JWT via a POST request. Alternatively, use a fragment (`#token=...`) which is not sent in HTTP requests, though it's still in browser history.

### [HIGH] H2 — Password Reset Does Not Invalidate Existing JWT Sessions

- **File:** `server/routes/auth.js:298-316` (reset-password handler)
- **Code:**
  ```js
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.updateOne({ _id: user._id }, {
    $set: { password: hashedPassword },
    $unset: { resetPasswordToken: '', resetPasswordExpires: '' }
  });
  ```
- **Risk:** When a user resets their password (e.g., after account compromise), existing JWT tokens remain valid for up to 7 days. An attacker who stole the token can continue using it. The `tokenVersion` mechanism exists in the codebase but is **not incremented** during password reset.
- **Fix:** Add `$inc: { tokenVersion: 1 }` to the password reset update operation to invalidate all existing sessions.

### [HIGH] H3 — Admin Recovery Endpoint Lacks Rate Limiting

- **File:** `server/routes/auth.js:321-349` (`/recover-admin`)
- **Code:**
  ```js
  router.post('/recover-admin', async (req, res) => {
    // ...
    if (recoveryKey !== process.env.ADMIN_RECOVERY_KEY) {
      return res.status(401).json({ error: 'Invalid recovery key' });
    }
  ```
- **Risk:** The `/api/auth/recover-admin` endpoint is not covered by the rate limiters in `index.js` (which only target `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`). The general rate limiter explicitly skips `/api/auth` paths. This allows unlimited brute-force attempts against the `ADMIN_RECOVERY_KEY`.
- **Fix:** Add `authRateLimit` (or a stricter limiter) to `/api/auth/recover-admin` in `index.js`. Consider also adding account lockout after N failed attempts.

### [HIGH] H4 — Hardcoded Admin Emails in Source Code

- **File:** `server/config/env.js:51`
- **Code:**
  ```js
  const ADMIN_EMAILS = ['admin@fetchwork.com', 'stancp327@gmail.com'];
  ```
- **Risk:** Admin email list is hardcoded in source code rather than environment variables. This means: (1) anyone with repo access knows admin accounts, (2) changing admins requires a code deploy, (3) personal email address (`stancp327@gmail.com`) is exposed in the repository. Combined with the admin auto-promotion logic in the login flow (lines 116-120), anyone who controls these email addresses automatically gets admin role.
- **Fix:** Move admin emails to an environment variable (e.g., `ADMIN_EMAILS=admin@fetchwork.com,stancp327@gmail.com`) and parse at startup.

### [HIGH] H5 — bcrypt Rounds Inconsistency Between Model and Route

- **File:** `server/routes/auth.js:312` vs `server/models/User.js:343`
- **Code (route):**
  ```js
  const hashedPassword = await bcrypt.hash(password, 10); // 10 rounds
  ```
  **Code (model):**
  ```js
  const salt = await bcrypt.genSalt(14); // 14 rounds
  this.password = await bcrypt.hash(this.password, salt);
  ```
- **Risk:** The password reset route uses 10 bcrypt rounds while the User model pre-save hook uses 14 rounds. This creates inconsistent security — passwords set via reset are weaker (~16x faster to brute-force) than passwords set via registration. This also bypasses the model's pre-save hook entirely.
- **Fix:** Use `user.password = password; await user.save();` in the reset handler to leverage the model's pre-save hook, or at minimum change the rounds to 14 to match.

---

## Medium Findings

### [MEDIUM] M1 — OAuth Callbacks Missing CSRF State Parameter Validation

- **File:** `server/config/passport.js:11-15` (Google), `server/config/passport.js:65-69` (Facebook)
- **Code:**
  ```js
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
    // No state parameter configured
  }, ...));
  ```
- **Risk:** Passport.js with `passport-google-oauth20` does generate a `state` parameter by default when sessions are enabled (which they are). However, this relies on the session working correctly. If the session cookie is not set (e.g., cross-site redirect, session misconfiguration), CSRF protection is silently lost. The risk is mitigated by the session configuration but not explicitly enforced.
- **Fix:** Consider adding `state: true` explicitly to the strategy options and verifying it in the callback, or implementing a custom state parameter with HMAC validation.

### [MEDIUM] M2 — User Object Serialized in OAuth Redirect URL

- **File:** `server/routes/auth.js:410-414` (Google), `server/routes/auth.js:440-444` (Facebook)
- **Code:**
  ```js
  res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
    id: req.user._id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    isAdmin
  }))}`);
  ```
- **Risk:** User PII (email, name) and admin status are leaked in the URL query string. This data ends up in browser history, server logs, and potentially Referer headers. The `isAdmin` flag in the URL could also be tampered with on the client side (though it wouldn't affect server-side checks).
- **Fix:** Only pass a token/code in the redirect. Let the client fetch user data via an authenticated `/api/auth/me` call.

### [MEDIUM] M3 — Email Enumeration via Dev Logs

- **File:** `server/routes/auth.js:75-82`
- **Code:**
  ```js
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) console.log(`🔐 Login attempt for: ${emailCanonical}`);
  // ...
  if (isDev) console.log(`❌ User not found: ${email}`);
  // ...
  if (isDev) console.log(`❌ Password mismatch for: ${email}`);
  ```
- **Risk:** While guarded by `isDev`, if `NODE_ENV` is accidentally unset or misconfigured in a deployment (it's not validated as required), these logs leak whether an email exists in the system and whether the password was wrong. This is exploitable for credential stuffing.
- **Fix:** Remove email from failure logs entirely, or hash it before logging. Ensure `NODE_ENV=production` is validated at startup.

### [MEDIUM] M4 — Forgot Password Logs Email Addresses

- **File:** `server/routes/auth.js:223-240`
- **Code:**
  ```js
  console.log(`🔄 Password reset request for: ${emailCanonical}`);
  console.log(`❌ User not found for password reset: ${email}`);
  console.log(`👤 User found for password reset: ${email}`);
  console.log(`🔑 Reset token generated for: ${email}`);
  console.log(`📧 Password reset email sent successfully to: ${email}`);
  ```
- **Risk:** These logs are **not** guarded by `isDev` — they run in production. Email addresses (PII) are written to production logs for every password reset request. Additionally, the pattern of log messages reveals whether a user exists (different log messages for found vs. not-found).
- **Fix:** Remove email addresses from production logs. Use user IDs or hashed identifiers instead. Remove the differentiated logging for user-found vs. not-found.

### [MEDIUM] M5 — JWT Expiry Too Long (7 Days)

- **File:** `server/routes/auth.js:122`, `server/routes/auth.js:409`, `server/routes/auth.js:462`
- **Code:**
  ```js
  jwt.sign({ ... }, JWT_SECRET, { expiresIn: '7d' });
  ```
- **Risk:** A 7-day token lifetime is quite long. If a token is leaked (see H1), it remains valid for a week. The `tokenVersion` mechanism mitigates this for explicit logouts, but not for stolen tokens where the user doesn't know they're compromised.
- **Fix:** Consider shorter access tokens (15-60 minutes) with a refresh token mechanism. The `/api/auth/refresh` endpoint exists but doesn't implement proper refresh token rotation — it just re-signs a new 7-day token using the existing token.

### [MEDIUM] M6 — No Refresh Token Rotation

- **File:** `server/routes/auth.js:449-467` (`/refresh` endpoint)
- **Code:**
  ```js
  router.post('/refresh', authenticateToken, async (req, res) => {
    // ...
    const token = jwt.sign(
      { userId: user._id, isAdmin, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  });
  ```
- **Risk:** The refresh endpoint simply issues a new 7-day token when presented with a valid token. There is no separate refresh token, no rotation, and no binding to a specific session/device. A stolen access token can be used to perpetually generate new tokens.
- **Fix:** Implement a proper refresh token flow: issue short-lived access tokens (15 min) + long-lived opaque refresh tokens stored in DB. Rotate refresh tokens on each use and invalidate the old one.

### [MEDIUM] M7 — Admin Permission Bypass — Admins Have All Permissions

- **File:** `server/middleware/auth.js:94`
- **Code:**
  ```js
  hasPermission: function(permission) {
    if (isAdmin) return true; // Admins have all permissions
    return allPerms.includes(permission);
  },
  ```
- **Risk:** The `isAdmin` check bypasses all granular permission checks, making the permission system ineffective for admin users. If an admin account is compromised, the attacker has unrestricted access to every operation including `user_impersonation` and `system_settings`. There's no way to create a limited admin.
- **Fix:** Consider implementing fine-grained permissions for all roles including admins. At minimum, sensitive operations like `user_impersonation` should require explicit permission even for admins.

### [MEDIUM] M8 — Google Mobile Auth accessToken Fallback Trusts Userinfo Without ID Token Verification

- **File:** `server/routes/auth.js:501-507`
- **Code:**
  ```js
  // Fallback: exchange accessToken for user info (Android-only flow)
  const resp = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
  if (!resp.ok) return res.status(401).json({ error: 'Invalid Google access token' });
  const info = await resp.json();
  ```
- **Risk:** The access token fallback path fetches user info from Google but doesn't cryptographically verify the token's audience. A valid Google access token from *any* application could potentially be used to authenticate as that user on Fetchwork (confused deputy attack). The `idToken` path properly verifies `audience`, but the `accessToken` fallback does not.
- **Fix:** Verify that the access token was issued for your application by checking the `aud` field via `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=...` and confirming it matches your client ID.

---

## Low Findings

### [LOW] L1 — Email Verification Token in Query String

- **File:** `server/routes/auth.js:178`
- **Code:**
  ```js
  const { token } = req.query;
  ```
- **Risk:** Email verification tokens are passed as URL query parameters (standard practice but noted). They appear in server access logs and browser history. The risk is low because these tokens are single-use and time-limited (24h), and verification requires no further privilege.
- **Fix:** Acceptable as-is. Consider POST-based verification with the token in the body for defense-in-depth.

### [LOW] L2 — Facebook OAuth May Create User Without Email

- **File:** `server/config/passport.js:84-93`
- **Code:**
  ```js
  const facebookEmail = profile.emails ? canonicalizeEmail(profile.emails[0].value) : '';
  user = new User({
    facebookId: profile.id,
    email: facebookEmail, // Could be empty string
    emailCanonical: facebookEmail,
    // ...
  });
  ```
- **Risk:** If a Facebook user hasn't shared their email, the user is created with an empty email. This could cause issues with email-dependent features and may create edge cases in the admin email check logic.
- **Fix:** Require email scope and reject users who don't provide one, or handle the empty-email case explicitly throughout the app.

### [LOW] L3 — `sameSite` Cookie Attribute Not Set

- **File:** `server/index.js:115-123`
- **Code:**
  ```js
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
      // No sameSite attribute
    }
  }));
  ```
- **Risk:** The session cookie does not set `sameSite`. Modern browsers default to `Lax`, which provides reasonable CSRF protection, but explicitly setting it is better practice. The session is primarily used for OAuth flows (passport).
- **Fix:** Add `sameSite: 'lax'` (or `'strict'` if OAuth flow allows) to the cookie options.

### [LOW] L4 — General Rate Limiter Skips Auth Paths

- **File:** `server/index.js:155-159`
- **Code:**
  ```js
  const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    skip: (req) => req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth'),
  });
  ```
- **Risk:** The general rate limiter explicitly skips all `/api/auth` paths. While the specific auth rate limiters cover `/login`, `/register`, `/forgot-password`, and `/reset-password`, other auth endpoints are unprotected: `/recover-admin`, `/google/mobile`, `/resend-verification`, `/verify-email`, `/refresh`. The `resend-verification` endpoint has its own in-memory rate limiting, but others don't.
- **Fix:** Ensure all auth endpoints are covered by at least one rate limiter. Apply `authRateLimit` to the entire `/api/auth` prefix instead of individual paths.

---

## Recommendations (Prioritized)

1. **[HIGH] Fix password reset token invalidation** — Add `$inc: { tokenVersion: 1 }` to the reset-password handler. Quick fix, high impact.

2. **[HIGH] Fix bcrypt rounds inconsistency** — Use the model's pre-save hook for password reset instead of manual hashing with 10 rounds.

3. **[HIGH] Add rate limiting to `/recover-admin`** — Single line addition in `index.js`.

4. **[HIGH] Move admin emails to environment variable** — Remove hardcoded personal email from source.

5. **[HIGH] Fix OAuth token-in-URL leakage** — Implement authorization code exchange or use URL fragment.

6. **[MEDIUM] Remove email PII from production logs** — The forgot-password handler logs emails unconditionally.

7. **[MEDIUM] Shorten JWT lifetime** — Move to 1h access + refresh token pattern.

8. **[MEDIUM] Validate Google accessToken audience** — Add tokeninfo check in the mobile auth fallback path.

9. **[MEDIUM] Add `sameSite` to session cookie** — Simple config change.

10. **[MEDIUM] Apply rate limiter to all auth endpoints** — Change from per-path to prefix-based rate limiting.

---

## Positive Findings (Things Done Well)

- ✅ **Token version mechanism** — `tokenVersion` check in auth middleware enables session invalidation on logout
- ✅ **bcrypt with 14 rounds** in User/Admin models (above OWASP minimum of 10)
- ✅ **Generic error messages** — Login returns "Invalid credentials" for both missing user and wrong password
- ✅ **Rate limiting** on login (10/15min), register, forgot-password, reset-password
- ✅ **Helmet** configured with CSP in production
- ✅ **CORS** locked to allowed origins in production
- ✅ **Consistent auth middleware** — All admin routes use `authenticateAdmin` + `requirePermission`
- ✅ **All sensitive routes protected** — payments, users, bookings, jobs all use `authenticateToken`
- ✅ **Suspended user checks** in both user and admin auth middleware
- ✅ **httpOnly + secure cookies** on session
- ✅ **Input validation** via `express-validator` on registration, login, reset-password
- ✅ **Resend-verification has its own rate limiter** (5/24h per IP and email)
- ✅ **Webhook endpoints use raw body** for Stripe signature verification
- ✅ **Fail-closed** pattern in tokenVersion check

---

## Files Audited

| File | Description |
|------|-------------|
| `server/middleware/auth.js` | Auth middleware (authenticateToken, authenticateAdmin, requirePermission, optionalAuth) |
| `server/config/passport.js` | OAuth strategy configuration (Google, Facebook) |
| `server/routes/auth.js` | Auth routes (register, login, OAuth, password reset, token refresh, logout) |
| `server/config/env.js` | Environment config, admin emails, JWT secret validation |
| `server/index.js` | App setup — session, helmet, CORS, rate limiting, route mounting |
| `server/models/User.js` | User model — bcrypt hashing (verified rounds: 14) |
| `server/models/Admin.js` | Admin model — bcrypt hashing (verified rounds: 14) |
| `server/routes/admin.js` | Admin routes — verified all use authenticateAdmin + requirePermission |
| `server/routes/payments.js` | Payment routes — verified all use authenticateToken |
| `server/routes/bookings.js` | Booking routes — verified all use authenticateToken |
| `server/routes/jobs.js` | Job routes — verified public listing (GET /) and detail (GET /:id) are correctly unauthenticated; all mutations require auth |
| `server/routes/users.js` | User routes — verified all use authenticateToken |

**35 route files scanned** for auth middleware usage; all sensitive routes confirmed protected.
