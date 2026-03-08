# 00_REPO_MAP.md — Fetchwork Repo Inventory
_Date: 2026-03-07 | Agent: SCOUT-REPO | Phase: 0_

---

## 1. Repo Structure

Top-level directories and their purpose (from `Get-ChildItem C:\Users\stanc\Fetchwork -Depth 1`):

| Name | Type | Purpose |
|------|------|---------|
| `.github/` | dir | GitHub Actions CI/CD workflows |
| `api/` | dir | Vercel serverless function (deploy webhook: `api/deploy-webhook.js`) |
| `audit/` | dir | Audit output files (this document lives here) |
| `client/` | dir | React CRA frontend (src/, build/, public/) |
| `docs/` | dir | Internal documentation (4 .md files) |
| `e2e/` | dir | Playwright end-to-end tests |
| `mobile/` | dir | Expo/React Native mobile app |
| `node_modules/` | dir | Root-level shared deps (concurrently, socket.io-client, jsonwebtoken, etc.) |
| `packages/` | dir | Internal shared package: `packages/shared` (`@fetchwork/shared`, TypeScript) |
| `scripts/` | dir | One-off maintenance/migration scripts (JS + PS1) |
| `server/` | dir | Express + Mongoose backend |
| `tasks/` | dir | Task tracking, audit checklists, and spec documents (.md files) |
| `test-utils/` | dir | Shared test helpers (`common.js`, `factories.js`) |

Top-level notable files:
- `package.json` — root workspace; contains jest config and root-level deps
- `jest.config.js` — root jest configuration
- `README.md` — project readme
- `RENDER_DEPLOYMENT_GUIDE.md` — Render deploy instructions
- `.env.test` — test environment variables
- `.nvmrc` — Node version pin
- `TESTING.md` — testing overview
- Several `*.md` docs: `PROJECT_DOCUMENTATION.md`, `WIREFRAMES.md`, `BOOKING_TASK.md`, `MOBILE_RESPONSIVE_TASK.md`, `DATABASE_CLEANUP_ANALYSIS.md`, duplicate account docs, SSL analysis, Vercel domain config guide, plan/category docs

---

## 2. Entrypoints

**Server:**
- File: `server/index.js`
- Port: `process.env.PORT || 10000` (default 10000; Render sets this)
- Framework: Express + Socket.io (http.createServer wrapping Express)
- Starts MongoDB connection, mounts all routes, initializes cron jobs, starts listening
- Keep-alive self-ping every 10 min in production (prevents Render free-tier sleep)

**Client:**
- CRA entrypoint: `client/src/index.js` (standard CRA; App.js/App.jsx is the root component)
- Build command: `CI=false react-scripts build`
- Start: `react-scripts start`
- API URL env: `REACT_APP_API_URL`

**Mobile:**
- Expo entrypoint: `mobile/index.js` (registered with Expo)
- Root component: `mobile/App.tsx`
- Framework: Expo ~52.0.0 + React Native 0.76.9
- Start: `expo start`

---

## 3. Scripts Inventory

### server/package.json
| Script | Command |
|--------|---------|
| `postinstall` | `prisma generate` |
| `start` | `node index.js` |
| `build` | `echo 'No build step needed'` |
| `test` | `jest --forceExit --detectOpenHandles` |
| `test:watch` | `jest --watch --forceExit --detectOpenHandles` |
| `verify-deployment` | `node ../scripts/verify-deployment.js` |
| `smoke:teams:phase3` | `node ../scripts/smoke-teams-phase3.js` |
| `test:booking-sql` | `jest --forceExit --detectOpenHandles __tests__/booking-sql` |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate:status` | `prisma migrate status` |
| `booking-sql:check` | `node scripts/check-booking-sql-ready.js` |
| `booking-sql:smoke` | `node scripts/booking-sql-smoke.js` |
| `booking-sql:lifecycle-smoke` | `node scripts/booking-sql-lifecycle-smoke.js` |
| `booking-sql:concurrency-smoke` | `node scripts/booking-sql-concurrency-smoke.js` |
| `booking-sql:full-smoke` | `node scripts/booking-sql-full-smoke.js` |

### client/package.json
| Script | Command |
|--------|---------|
| `start` | `react-scripts start` |
| `build` | `CI=false react-scripts build` |
| `test` | `react-scripts test` |
| `eject` | `react-scripts eject` |

### mobile/package.json
| Script | Command |
|--------|---------|
| `start` | `expo start` |
| `android` | `expo run:android` |
| `ios` | `expo run:ios` |
| `test` | `jest --watchAll` |
| `lint` | `eslint src --ext .ts,.tsx` |
| `e2e:maestro:teams:phase3` | `maestro test .maestro/teams-phase3-smoke.yaml` |
| `e2e:maestro:teams:phase3:org` | `maestro test .maestro/teams-phase3-org-settings.yaml` |
| `e2e:maestro:teams:phase3:roles` | `maestro test .maestro/teams-phase3-custom-roles.yaml` |
| `e2e:maestro:teams:phase3:clients` | `maestro test .maestro/teams-phase3-linked-clients.yaml` |
| `e2e:maestro:teams:phase3:all` | runs all 4 maestro tests above in sequence |
| `e2e:maestro:teams:phase3:ps` | `powershell -ExecutionPolicy Bypass -File ./scripts/run-maestro-phase3.ps1 -All` |

---

## 4. Environment Variables

All `process.env.*` references found in `server/` (excluding node_modules):

| VAR_NAME | Where Used (file) | Required/Optional |
|----------|-------------------|-------------------|
| `ADMIN_EMAILS` | routes/admin.js, integration tests | Optional (defaults in config) |
| `ADMIN_RECOVERY_KEY` | routes/auth.js | Optional |
| `API_URL` | routes/calendar.js | Optional |
| `BOOKING_SQL_ENABLED` | booking-sql/db/featureFlag.js | Optional (feature flag; default false) |
| `BOOKING_SQL_LOG_LEVEL` | booking-sql/db/client.js | Optional |
| `CALENDAR_ENCRYPTION_KEY` | utils/encryption.js | Optional (calendar feature) |
| `CLIENT_URL` | config/env.js, index.js, routes/calendar.js, routes/payments.js, routes/referrals.js, routes/seo.js, routes/teams.js, services/emailService.js, services/emailWorkflowService.js, booking-sql/services/BookingNotificationService.js, integration tests | **Required** |
| `CLOUDINARY_API_KEY` | middleware/upload.js, routes/messages.js | Optional (file uploads) |
| `CLOUDINARY_API_SECRET` | middleware/upload.js, routes/messages.js | Optional (file uploads) |
| `CLOUDINARY_CLOUD_NAME` | middleware/upload.js, routes/messages.js | Optional (file uploads) |
| `CLOUDINARY_MESSAGE_FOLDER` | routes/messages.js | Optional |
| `CLOUDINARY_URL` | middleware/upload.js | Optional |
| `DATABASE_URL` | booking-sql/routes/bookingsSqlController.js, routes/bookings.js, scripts/check-booking-sql-ready.js, booking-sql tests | Required if BOOKING_SQL_ENABLED=true (PostgreSQL) |
| `DISCOVERY_ALGORITHM_ENABLED` | services/discoveryEngine.js | Optional (feature flag) |
| `FACEBOOK_APP_ID` | config/passport.js | Optional (Facebook OAuth) |
| `FACEBOOK_APP_SECRET` | config/passport.js | Optional (Facebook OAuth) |
| `FF_ROOM_SEQ_V1` | socket/events.js | Optional (feature flag) |
| `FF_SOCKET_DIAGNOSTICS` | socket/events.js | Optional (feature flag) |
| `FROM_EMAIL` | config/env.js, index.js, routes/email.js, services/emailService.js | **Required** |
| `GOOGLE_CAL_CLIENT_ID` | routes/calendar.js, services/calendarService.js | Optional (Google Calendar) |
| `GOOGLE_CAL_CLIENT_SECRET` | services/calendarService.js | Optional (Google Calendar) |
| `GOOGLE_CAL_REDIRECT_URI` | services/calendarService.js | Optional (Google Calendar) |
| `GOOGLE_CLIENT_ID` | config/passport.js, routes/auth.js | Optional (Google OAuth) |
| `GOOGLE_CLIENT_SECRET` | config/passport.js | Optional (Google OAuth) |
| `JWT_SECRET` | config/env.js, middleware/auth.js, index.js, tests | **Required** (min 32 chars) |
| `MONGO_URI` | config/env.js, index.js, scripts | **Required** |
| `MONGO_URI_TEST` | __tests__/setup/dbHelpers.js, globalSetup.js | Optional (set auto by mongodb-memory-server in tests) |
| `MONGODB_URI` | scripts/backfill-*.js, seeds | Optional (scripts only) |
| `NODE_ENV` | Multiple files | Optional (defaults to development) |
| `OPENAI_API_KEY` | config/env.js | Optional (AI features degrade gracefully) |
| `PLATFORM_FEE_PERCENT` | __tests__/integration/payments.integration.test.js | Optional (CI only) |
| `PORT` | config/env.js | Optional (default: 10000) |
| `RENDER` | index.js | Optional (auto-set by Render platform) |
| `RENDER_EXTERNAL_URL` | index.js | Optional (auto-set by Render) |
| `RESEND_API_KEY` | config/env.js, index.js, routes/email.js, services/emailService.js | **Required** |
| `SERVER_URL` | routes/calendar.js | Optional |
| `SESSION_SECRET` | config/env.js, index.js, integration tests | Optional (warns if missing in prod) |
| `SOCKET_CORS_ORIGIN` | index.js | Optional (comma-separated origins; defaults to localhost:3000) |
| `STRIPE_BILLING_WEBHOOK_SECRET` | routes/billing.js | Optional (Stripe billing webhooks) |
| `STRIPE_SECRET_KEY` | routes/admin.js, billing.js, bookings.js, boosts.js, jobs.js, teams.js, services/stripeService.js | Optional (required for payments) |
| `STRIPE_WEBHOOK_SECRET` | routes/billing.js, routes/payments.js | Optional (required for Stripe webhooks) |
| `TURN_AUTH_SECRET` | routes/calls.js | Optional (WebRTC TURN server) |
| `TURN_TTL_SECONDS` | routes/calls.js | Optional |
| `TURN_URLS` | routes/calls.js | Optional |

---

## 5. Dependencies of Note

### server/package.json — Notable Dependencies
| Package | Version | Flag |
|---------|---------|------|
| `@prisma/client` | ^5.22.0 | Dual DB: Mongo + Postgres (new) |
| `prisma` | ^5.22.0 | Dual DB migration tooling |
| `mongoose` | ^8.12.2 | Primary DB ORM |
| `stripe` | ^18.3.0 | Payment processing — **security-sensitive** |
| `jsonwebtoken` | ^9.0.2 | Auth — **security-sensitive** |
| `passport` | ^0.7.0 | OAuth — **security-sensitive** |
| `passport-google-oauth20` | ^2.0.0 | Google login |
| `passport-facebook` | ^3.0.0 | Facebook login |
| `bcryptjs` | ^3.0.2 | Password hashing — security-sensitive |
| `helmet` | ^8.1.0 | Security headers |
| `express-rate-limit` | 8.0.1 | Rate limiting (pinned exact version) |
| `cloudinary` | ^1.41.3 | File uploads; v1 (v2 exists — potentially outdated) |
| `multer` | ^2.0.2 | File uploads |
| `openai` | ^6.27.0 | AI features (graceful fallback if no key) |
| `resend` | ^4.7.0 | Email service |
| `socket.io` | ^4.8.1 | Real-time WebSocket |
| `node-cron` | ^4.2.1 | Background job scheduling |
| `googleapis` | ^171.4.0 | Google Calendar integration |
| `ical-generator` | ^10.0.0 | Calendar event generation |
| `luxon` | ^3.7.2 | Date/time (duplicated in client too) |
| `multer-storage-cloudinary` | ^4.0.0 | Cloudinary+Multer bridge |

### client/package.json — Notable Dependencies
| Package | Version | Flag |
|---------|---------|------|
| `react-scripts` | 5.0.1 | CRA — **deprecated/unmaintained** (pinned exact) |
| `@stripe/react-stripe-js` | ^5.6.0 | Stripe UI — security-sensitive |
| `@stripe/stripe-js` | ^8.8.0 | Stripe JS — security-sensitive |
| `@tanstack/react-query` | ^5.90.21 | Data fetching |
| `socket.io-client` | ^4.8.1 | Real-time (duplicated in root node_modules too) |
| `luxon` | ^3.7.2 | Date/time (duplicated in server) |
| `jwt-decode` | ^4.0.0 | Client-side token decode |
| `react-router-dom` | ^6.30.1 | Routing |
| `react` | ^18.2.0 | React 18 |

### mobile/package.json — Notable Dependencies
| Package | Version | Flag |
|---------|---------|------|
| `expo` | ~52.0.0 | Expo SDK 52 |
| `react-native` | 0.76.9 | React Native |
| `@stripe/stripe-react-native` | 0.38.6 | Stripe payments (pinned exact) — security-sensitive |
| `@tanstack/react-query` | ^5.62.3 | Different minor than client (^5.90.21 vs ^5.62.3) — **potential version drift** |
| `socket.io-client` | ^4.8.1 | Duplicated across root, client, mobile |
| `expo-secure-store` | ~14.0.0 | Secure token storage |
| `expo-notifications` | ~0.29.0 | Push notifications |
| `zustand` | ^5.0.2 | State management |
| `axios` | ^1.7.9 | HTTP client (also in client devDeps and root) |
| `zod` | ^3.23.8 | Validation |

### Cross-Package Duplications
- `socket.io-client` — root, client, mobile
- `luxon` — server, client
- `axios` — root node_modules, mobile deps, client devDeps
- `@tanstack/react-query` — client (^5.90.21) vs mobile (^5.62.3) — **version drift**

---

## 6. CI/CD & Deploy Config

### GitHub Actions — `.github/workflows/ci.yml`
Single workflow file: `ci.yml` (triggers on push/PR to `main`).

**Jobs (in order):**
1. **server-unit** — Unit tests (no DB), Node 18, `npx jest --selectProjects unit`
2. **server-integration** — Integration tests with in-memory MongoDB (`mongodb-memory-server`), coverage upload; needs server-unit
3. **client-tests** — CRA build + React Testing Library tests + coverage upload; parallel with server-integration
4. **e2e** — Playwright E2E (push to main only); needs server-integration + client-tests; spins up real Express + serve client build + MongoDB
5. **security-audit** — `npm audit` on server + client; non-blocking (always runs, publishes summary)
6. **coverage-gate** — Downloads coverage artifacts, reports coverage summary; needs server-integration + client-tests

Concurrency: cancels previous runs on same branch.

### Vercel Config — `client/vercel.json`
- All `/api/*` requests rewrote to `/api/$1`
- All other routes → `/index.html` (SPA fallback)
- `fetchwork.net` (apex) permanently redirects to `www.fetchwork.net`
- Manifest content-type header set

No `vercel.json` at repo root.

### Render Config
- No `render.yaml` found anywhere in repo
- Deployment is configured manually in Render dashboard
- `RENDER_DEPLOYMENT_GUIDE.md` documents required env vars and troubleshooting
- Server defaults to port 10000 (Render standard)
- Self-ping keep-alive built into `server/index.js` (every 10 min, prevents Render free-tier sleep)
- Service ID referenced in `TOOLS.md`: `srv-d1so7iemcj7s73e9colg`

### Docker
- No `Dockerfile` or `docker-compose.yml` found anywhere in repo.

---

## 7. Feature Flags

| Flag Name | Type | Where Defined | Where Checked | Behavior |
|-----------|------|---------------|---------------|----------|
| `BOOKING_SQL_ENABLED` | env var (`==='true'`) | `server/booking-sql/db/featureFlag.js` | `server/booking-sql/index.js`, `server/crons/bookingCrons.js`, `server/scripts/check-booking-sql-ready.js` | Gates entire Prisma/PostgreSQL booking subsystem; default OFF |
| `FF_SOCKET_DIAGNOSTICS` | env var (`==='true'`) | inline in `server/socket/events.js` | `server/socket/events.js` | Enables socket diagnostic logging |
| `FF_ROOM_SEQ_V1` | env var (`==='true'`) | inline in `server/socket/events.js` | `server/socket/events.js` | Enables room sequence v1 logic |
| `DISCOVERY_ALGORITHM_ENABLED` | env var | `server/services/discoveryEngine.js` | `server/services/discoveryEngine.js` | Toggles discovery algorithm |

**No client-side feature flags found** in `client/src/` (no `REACT_APP_FEATURE_*` or FF_ patterns).

---

## 8. Existing Documentation

### Repo Root .md Files (found):
- `README.md` ✅ FOUND
- `SETUP*.md` — NOT FOUND
- `ARCHITECTURE*.md` — NOT FOUND
- `CONTRIBUTING.md` — NOT FOUND
- `CHANGELOG.md` — NOT FOUND
- `TESTING.md` ✅ FOUND
- `PROJECT_DOCUMENTATION.md` ✅ FOUND
- `WIREFRAMES.md` ✅ FOUND
- `BOOKING_TASK.md` ✅ FOUND
- `MOBILE_RESPONSIVE_TASK.md` ✅ FOUND
- `RENDER_DEPLOYMENT_GUIDE.md` ✅ FOUND
- `VERCEL_DOMAIN_CONFIGURATION_GUIDE.md` ✅ FOUND
- `SSL_CERTIFICATE_ANALYSIS.md` ✅ FOUND
- `DATABASE_CLEANUP_ANALYSIS.md` ✅ FOUND
- `DUPLICATE_ACCOUNTS_RESOLUTION.md` ✅ FOUND
- `DUPLICATE_CLEANUP_GUIDE.md` ✅ FOUND
- `FINAL_CLEANUP_RECOMMENDATIONS.md` ✅ FOUND
- `PLAN-categories-location.md` ✅ FOUND

### `/docs/` Directory:
- `docs/messaging-day1-audit.md`
- `docs/messaging-day14-rollout.md`
- `docs/route-access-matrix.md`
- `docs/stripe-webhook-test-plan.md`

### `/tasks/` Directory:
- `tasks/mobile-qa-checklist.md`
- `tasks/mobile-release-readiness.md`
- `tasks/mobile-teams-phase3-e2e-checklist.md`
- `tasks/mobile-teams-phase3-parity-audit.md`
- `tasks/teams-authz-scoping-matrix.md`
- `tasks/teams-awesome-spec.md`
- `tasks/teams-owner-transfer-delete-invariants.md`
- `tasks/teams-p0-foundation-checklist.md`
- `tasks/teams-regression-test-matrix.md`
- `tasks/teams-research-implementation-brief.md`
- `tasks/teams-temporary-project-log.md`
- `tasks/teams-tenant-scoping-checklist.md`
- `tasks/reports/` (directory, contents not enumerated)

### Other Docs:
- `server/docs/` — NOT FOUND
- `client/docs/` — NOT FOUND
- `/runbooks/` — NOT FOUND
- `/notes/` — NOT FOUND

---

## 9. Test Coverage

### Server Tests (`server/__tests__/`) — **36 test files**

**Unit tests (5):**
- `__tests__/auth.test.js`
- `__tests__/disputes.test.js`
- `__tests__/errors.test.js`
- `__tests__/errorTracker.test.js`
- `__tests__/jobs.test.js`

**Integration tests (12):**
- `__tests__/integration/auth.integration.test.js`
- `__tests__/integration/booking-sql.concurrency.test.js`
- `__tests__/integration/booking-sql.lifecycle.test.js`
- `__tests__/integration/disputes.integration.test.js`
- `__tests__/integration/jobs.integration.test.js`
- `__tests__/integration/messages.day12.integration.test.js`
- `__tests__/integration/payments.integration.test.js`
- `__tests__/integration/reviews.integration.test.js`
- `__tests__/integration/security.integration.test.js`
- `__tests__/integration/teams.integration.test.js`
- `__tests__/integration/teams.phase3b.integration.test.js`
- `__tests__/unit/teams.security.test.js`

**Booking-SQL tests (16):**
- `__tests__/booking-sql/attendanceService.test.js`
- `__tests__/booking-sql/auditService.test.js`
- `__tests__/booking-sql/availabilityService.test.js`
- `__tests__/booking-sql/bookingsSqlController.test.js`
- `__tests__/booking-sql/groupBookingService.test.js`
- `__tests__/booking-sql/idempotencyMiddleware.test.js`
- `__tests__/booking-sql/myBookings.test.js`
- `__tests__/booking-sql/policyEngine.test.js`
- `__tests__/booking-sql/policyOutcome.integration.test.js`
- `__tests__/booking-sql/recurringSeriesService.test.js`
- `__tests__/booking-sql/reminderService.test.js`
- `__tests__/booking-sql/reschedule.test.js`
- `__tests__/booking-sql/slotEngine.dst.test.js`
- `__tests__/booking-sql/slotEngine.hybrid.test.js`
- `__tests__/booking-sql/slotEngine.test.js`
- `__tests__/booking-sql/waitlistNotificationService.test.js`

**Setup (3 — not test files):**
- `__tests__/setup/dbHelpers.js`
- `__tests__/setup/globalSetup.js`
- `__tests__/setup/globalTeardown.js`

### Client Tests (`client/src/`) — **5 test files**
- `src/App.test.js`
- `src/__tests__/AuthContext.test.js`
- `src/__tests__/JobCard.test.js`
- `src/__tests__/Login.test.js`
- `src/__tests__/ProtectedRoute.test.js`

### Mobile Tests — **0 test files found** in `mobile/src/`

### E2E Tests (`e2e/tests/`) — **2 test files**
- `e2e/tests/happyPath.spec.js`
- `e2e/tests/mobile.spec.js`

### Summary
| Area | Test File Count |
|------|----------------|
| Server (unit) | 5 |
| Server (integration) | 12 |
| Server (booking-sql) | 16 |
| Client | 5 |
| Mobile | 0 |
| E2E (Playwright) | 2 |
| **Total** | **40** |

---

## 10. Database Models

### Mongoose Models (`server/models/*.js`) — 43 model files, 47 collections

| Model File | Collection Name(s) |
|------------|-------------------|
| Admin.js | Admin |
| Analytics.js | DailyStats, PageView, VisitorSession |
| AuditLog.js | AuditLog |
| Availability.js | Availability |
| BackgroundCheck.js | BackgroundCheck |
| BillingAuditLog.js | BillingAuditLog |
| BillingCredit.js | BillingCredit |
| Booking.js | Booking |
| BoostCredit.js | BoostCredit |
| BoostImpression.js | BoostImpression |
| BundlePurchase.js | BundlePurchase |
| Call.js | Call |
| CheckoutSession.js | CheckoutSession |
| Contract.js | Contract |
| CustomOffer.js | CustomOffer |
| Dispute.js | Dispute |
| EmailLog.js | EmailLog |
| FeatureGrant.js | FeatureGrant |
| FeatureGroup.js | FeatureGroup |
| Job.js | Job |
| JobAlert.js | JobAlert |
| JobTemplate.js | JobTemplate |
| Message.js | Message, Conversation, ChatRoom, ReceiptCursor |
| ModerationEvent.js | ModerationEvent |
| Notification.js | Notification |
| Organization.js | Organization |
| Payment.js | Payment |
| Plan.js | Plan |
| ProcessedWebhookEvent.js | ProcessedWebhookEvent |
| PromoRule.js | PromoRule |
| Referral.js | Referral |
| Review.js | Review |
| Saved.js | Saved |
| ServerError.js | ServerError |
| Service.js | Service |
| ServiceSubscription.js | ServiceSubscription |
| SkillAssessment.js | SkillAssessment |
| Team.js | Team |
| TeamApproval.js | TeamApproval |
| TeamAuditLog.js | TeamAuditLog |
| TeamClient.js | TeamClient |
| User.js | User (also references Review collection) |
| UserSubscription.js | UserSubscription |

### Prisma Models (`server/prisma/schema.prisma`) — PostgreSQL (new booking subsystem)

Database: PostgreSQL (via `DATABASE_URL` env var)

| Prisma Model | Purpose |
|-------------|---------|
| `Booking` | Core booking record with policy/pricing snapshots |
| `BookingOccurrence` | Individual occurrences of a booking (supports recurring) |
| `RecurringSeries` | Weekly/biweekly/monthly recurring schedules |
| `AuditEvent` | Immutable audit log for booking events |
| `IdempotencyKey` | Prevents duplicate payment/booking operations |
| `ChargeRecord` | Stripe charge tracking per booking/occurrence |
| `AttendanceRecord` | Check-in/check-out tracking for in-person sessions |
| `FreelancerAvailability` | Freelancer weekly schedule defaults |
| `ServiceAvailabilityOverride` | Per-service availability overrides |
| `AvailabilityException` | Date-specific exceptions (holidays, blocks) — inferred from schema |

Enums: `BookingStatus` (10 states: pending_payment, held, confirmed, in_progress, completed, cancelled_by_client, cancelled_by_freelancer, no_show_client, no_show_freelancer, disputed, resolved), `ActorType` (client, freelancer, admin, system)

---

## 11. API Surface

**Route files in `server/routes/`:** 54 files total (includes route files and helper modules)

**Primary route files (31 with router exports):**

| Filename | Purpose |
|----------|---------|
| `admin.js` | Admin panel operations (user management, Stripe keys) |
| `ai.js` | AI-powered features (job description gen, smart matching via OpenAI) |
| `analytics.js` | Platform analytics and metrics |
| `auth.js` | Authentication: register, login, Google/Facebook OAuth, email verify |
| `availability.js` | Freelancer availability calendar management |
| `backgroundChecks.js` | Background check requests and status |
| `billing.js` | Subscription billing, plans, Stripe billing webhook |
| `bookings.js` | Legacy Mongoose-backed booking flow |
| `boosts.js` | Profile/listing boost credits and purchases |
| `calendar.js` | Google Calendar integration (connect, sync, iCal export) |
| `calls.js` | WebRTC TURN credential generation for video calls |
| `categories.js` | Service categories (public read) |
| `chatrooms.js` | Group chat room management |
| `contact.js` | Contact form submission |
| `contracts.js` | Service contracts between clients and freelancers |
| `disputes.js` | Dispute filing and resolution |
| `email.js` | Email send/test endpoints (admin) |
| `errors.js` | Client-side error reporting |
| `freelancers.js` | Freelancer listing, search, filtering |
| `jobAlerts.js` | Job alert subscription management |
| `jobs.js` | Job posting CRUD (with Stripe boost payments) |
| `jobTemplates.js` | Saved job posting templates |
| `messages.js` | Direct messaging, Cloudinary file attachments |
| `notifications.js` | In-app notification management |
| `offers.js` | Custom service offers between users |
| `organizations.js` | Organization management |
| `payments.js` | Stripe payment processing, Stripe webhook handler |
| `portfolio.js` | Freelancer portfolio items |
| `preferences.js` | User preference settings |
| `publicProfiles.js` | Public-facing freelancer/user profiles by username |
| `referrals.js` | Referral program management |
| `reviews.js` | Review creation and listing |
| `saved.js` | Saved jobs/freelancers |
| `search.js` | Global search (public, no auth) |
| `seo.js` | robots.txt and SEO-related endpoints |
| `services.js` | Service offerings CRUD (main router) |
| `skills.js` | Skill assessment and tagging |
| `stats.js` | Public platform statistics |
| `teams.js` | Teams feature (create, manage members, organizations, roles) |
| `users.js` | User profile management |

**Helper modules in routes/ (not routers):**
- `billing.helpers.js` — Billing utility functions
- `payments.helpers.js` — Payment calculation helpers
- `services.conversation.helpers.js` — Service conversation logic
- `services.fees.helpers.js` — Fee calculation for services
- `services.helpers.js` — General service helpers
- `services.lookup.helpers.js` — Service lookup utilities
- `services.messaging.helpers.js` — Service messaging
- `services.metadata.helpers.js` — Service metadata
- `services.notification.helpers.js` — Service notification dispatch
- `services.order.helpers.js` — Service order flow
- `services.payment.helpers.js` — Service payment processing
- `services.response.helpers.js` — Response formatting
- `services.state.helpers.js` — Service state machine
- `services.transitions.helpers.js` — Service state transitions

**`jobs/` subdirectory in routes:** exists but not fully enumerated above.

**Total route files:** 40 primary + 14 helpers = 54 files

---

## 12. Known Docs Digest

The 10 most important constraints and facts about this codebase:

1. **Dual database architecture in migration**: The server uses MongoDB (Mongoose) as the primary database for most features, AND is actively migrating the booking subsystem to PostgreSQL (Prisma). The Prisma/SQL booking system is behind a feature flag (`BOOKING_SQL_ENABLED=false` by default). Both systems coexist; `postinstall` always runs `prisma generate`.

2. **Required environment variables will crash the server on missing**: `config/env.js` hard-exits (`process.exit(1)`) if any of `MONGO_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `FROM_EMAIL`, or `CLIENT_URL` are missing. No graceful degradation.

3. **CRA is deprecated but still in use**: `client/` uses `react-scripts@5.0.1` (Create React App), which is no longer maintained. Build command intentionally sets `CI=false` to suppress CRA's warning-as-error behavior.

4. **No render.yaml — Render is manually configured**: There is no `render.yaml` in the repo. All Render deploy config lives in the Render dashboard. Service ID: `srv-d1so7iemcj7s73e9colg`. A `RENDER_DEPLOYMENT_GUIDE.md` documents the manual steps.

5. **Socket.io is used for real-time features with multi-origin CORS**: The server uses Socket.io for real-time messaging/notifications. CORS origins are configured via `SOCKET_CORS_ORIGIN` env var (comma-separated). `global.io` is set so Notification model post-save hooks can emit events without dependency injection.

6. **Stripe is deeply integrated (payments, billing, boosts, jobs)**: Stripe appears in 7+ route files. `STRIPE_SECRET_KEY` is used in admin, billing, bookings, boosts, jobs, teams, and stripeService. There is a separate `STRIPE_BILLING_WEBHOOK_SECRET` (for billing) and `STRIPE_WEBHOOK_SECRET` (for payments). `ProcessedWebhookEvent` model ensures idempotent webhook handling.

7. **Teams feature is a major recent addition**: Multiple spec docs, parity audits, test suites, and Maestro e2e flows exist under `tasks/` for a "Teams" feature (Phase 3). There are dedicated Mongoose models (Team, TeamApproval, TeamAuditLog, TeamClient), a teams route, and integration tests including `teams.phase3b.integration.test.js`.

8. **Self-ping keep-alive is baked into server startup**: `server/index.js` starts a `setInterval` that pings `RENDER_EXTERNAL_URL/health` every 10 minutes when `NODE_ENV=production` or `RENDER=true`, to prevent Render free-tier sleep. This means the server depends on its own `/health` endpoint being live.

9. **Mobile app has zero unit tests**: The `mobile/src/` directory contains no `.test.*` files. Mobile testing relies entirely on Maestro e2e YAML flows (`.maestro/` directory) and manual QA checklists in `tasks/`. The `jest` script exists in package.json but no test files back it up.

10. **Message.js defines 4 Mongoose collections in one file**: The `Message.js` model file defines `Message`, `Conversation`, `ChatRoom`, and `ReceiptCursor` collections. The messaging subsystem is documented in `docs/messaging-day1-audit.md` and `docs/messaging-day14-rollout.md`, suggesting significant iterative development with potential complexity/tech debt. `FF_ROOM_SEQ_V1` and `FF_SOCKET_DIAGNOSTICS` feature flags are tied to this subsystem.

---

SCOUT-REPO COMPLETE
