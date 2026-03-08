# Route Coverage Audit — 2026-03-07

## Summary

| Metric | Count |
|--------|-------|
| Backend route files | 54 (including helpers) |
| Active route files (routers) | 37 |
| Total backend routes defined | ~230 (including sub-router `jobs/milestones.js`) |
| Web frontend API calls (unique endpoints) | ~180 |
| Mobile API calls (unique endpoints) | ~95 |
| Dead backend routes (never called) | **28** |
| Broken web frontend calls | **4 confirmed** |
| Broken mobile calls | **9 confirmed** |
| Mobile gaps vs web | **12 feature areas** |

---

## Dead Backend Routes (defined but never called by web OR mobile)

| Route | File:Line | Called By | Status |
|-------|-----------|-----------|--------|
| `GET /api/admin/analytics` | admin.js | MISSING | Dead — frontend calls `/api/analytics/overview` (separate route file), not admin version |
| `POST /api/analytics/track` | analytics.js | MISSING | Dead — no frontend/mobile call |
| `GET /api/analytics/daily` | analytics.js | MISSING | Dead — no frontend/mobile call |
| `GET /api/analytics/pages` | analytics.js | MISSING | Dead — no frontend/mobile call |
| `POST /api/auth/recover-admin` | auth.js | MISSING | Dead — no frontend call |
| `GET /api/auth/google` | auth.js | MISSING | OAuth browser redirect — not called via apiRequest (expected) |
| `GET /api/auth/google/callback` | auth.js | MISSING | OAuth callback — browser-only (expected) |
| `GET /api/auth/facebook` | auth.js | MISSING | OAuth browser redirect (expected) |
| `GET /api/auth/facebook/callback` | auth.js | MISSING | OAuth callback — browser-only (expected) |
| `GET /api/background-checks/:userId/status` | backgroundChecks.js | MISSING | Dead — no frontend/mobile call |
| `GET /api/bookings/sql/status` | bookings.js | MISSING | Debug/health route — never called from UI |
| `PUT /api/bookings/availability/:serviceId` | bookings.js | MISSING | Dead — frontend uses `/api/availability/service/:id` instead |
| `GET /api/bookings/availability/:serviceId` | bookings.js | MISSING | Dead — frontend uses `/api/availability/service/:id` instead |
| `POST /api/boosts/track/impression` | boosts.js | MISSING | Dead — only `track/click` is called; impression tracking never wired |
| `GET /api/boosts/algorithm-status` | boosts.js | MISSING | Dead — no frontend/mobile call |
| `GET /api/calls/` | calls.js | MISSING | Dead — frontend only calls relay-credentials and quality sub-routes |
| `GET /api/calls/:id` | calls.js | MISSING | Dead — no frontend call |
| `GET /api/chatrooms/` | chatrooms.js | MISSING | **Entire chatrooms feature is dead** — 6 routes, zero frontend/mobile calls |
| `POST /api/chatrooms/` | chatrooms.js | MISSING | Dead |
| `GET /api/chatrooms/:roomId` | chatrooms.js | MISSING | Dead |
| `GET /api/chatrooms/:roomId/messages` | chatrooms.js | MISSING | Dead |
| `POST /api/chatrooms/:roomId/members` | chatrooms.js | MISSING | Dead |
| `DELETE /api/chatrooms/:roomId/members/:userId` | chatrooms.js | MISSING | Dead |
| `POST /api/messages/assets/sign` | messages.js | MISSING | Dead — file upload asset signing never wired to frontend |
| `POST /api/messages/assets/:assetId/finalize` | messages.js | MISSING | Dead |
| `GET /api/messages/moderation/events` | messages.js | MISSING | Dead — admin moderation events endpoint, no UI |
| `POST /api/messages/conversations/:id/messages/upload` | messages.js | MISSING | Dead — file upload via messages not wired |
| `POST /api/offers/:id/counter` | offers.js | MISSING | Dead — counter-offer flow not implemented in frontend |
| `POST /api/offers/:id/withdraw` | offers.js | MISSING | Dead — offer withdrawal not implemented in frontend |
| `GET /api/preferences/` | preferences.js | MISSING | Dead — preferences routes never called from web or mobile |
| `PUT /api/preferences/` | preferences.js | MISSING | Dead |
| `POST /api/preferences/unsubscribe` | preferences.js | MISSING | Dead |
| `GET /api/public-profiles/:username` | publicProfiles.js | MISSING | Dead — frontend uses `/api/freelancers/:id` instead |
| `POST /api/reviews/:id/response` | reviews.js | MISSING | Dead — freelancer review response not wired in frontend |
| `PUT /api/reviews/:id` | reviews.js | MISSING | Dead — review editing not wired in frontend |
| `GET /api/search/` | search.js | MISSING | Dead — only `GET /api/search/suggestions` is called; base search endpoint unused |
| `POST /api/users/verify-identity` | users.js | MISSING | Dead — identity verification flow not wired to frontend |
| `GET /api/users/verification-status` | users.js | MISSING | Dead |
| `GET /api/users/me/earnings/export` | users.js | MISSING | Dead — export button/flow not implemented |
| `GET /api/jobs/:id/boost` | jobs.js | MISSING | Dead — boost status check not called; boosts go through `/api/boosts/job/:id` |
| `POST /api/jobs/:id/refund` | jobs.js | MISSING | Dead — job refund route not wired to frontend |
| `GET /api/admin/users/search` | admin.js | MISSING | **Defined twice** — duplicate route definition in admin.js |

---

## Broken Frontend Calls (called but route doesn't exist or method mismatch)

### Web Frontend Broken Calls

| Call | Frontend File | Backend Route | Status |
|------|---------------|---------------|--------|
| `GET /api/calendar/google/auth` | CalendarConnect.js | `POST /api/calendar/google/connect` | ❌ **URL AND method mismatch** — frontend calls `/auth` GET, backend expects `/connect` POST |
| `GET /api/calendar/ical/url` | CalendarConnect.js | `GET /api/calendar/ical-url` | ❌ **URL mismatch** — frontend calls `/ical/url`, backend route is `/ical-url` |
| `POST /api/calendar/ical/rotate` | CalendarConnect.js | `POST /api/calendar/ical-rotate` | ❌ **URL mismatch** — frontend calls `/ical/rotate`, backend route is `/ical-rotate` |
| `GET /api/users/${id}` | useUser.js | MISSING | ❌ No `GET /:id` in users.js — no public user-by-ID lookup route exists |
| `GET /api/bookings/${bookingId}/series` (GET) | RecurringSeriesPanel.js | `GET /api/bookings/:bookingId/series/:seriesId` | ⚠️ Partial — frontend GETs without `seriesId`, backend requires it |
| `POST /api/jobs/${jobId}/milestones/request/accept` | components.js | `POST /api/jobs/:id/milestones/request/accept` | ✅ Actually OK — mounted via `router.use('/:id', milestoneRoutes)` in jobs.js:1147 |

> **Note:** The milestone routes (`/api/jobs/:id/milestones/*`, `/progress`) are defined in `server/routes/jobs/milestones.js` and mounted via `router.use('/:id', milestoneRoutes)` at jobs.js:1147. These ARE accessible; initial scan missed the sub-router pattern.

### Mobile Broken Calls

| Call | Mobile File | Backend Route | Status |
|------|-------------|---------------|--------|
| `POST /api/messages` (send message) | messagesApi.ts | MISSING | ❌ No `POST /` in messages.js — backend expects `POST /conversations/:id/messages` |
| `PUT /api/messages/conversations/:id/read` | messagesApi.ts | MISSING | ❌ No read-mark route in messages.js at all |
| `PUT /api/notifications/:id/read` | notificationsApi.ts | `PATCH /api/notifications/:id/read` | ❌ **Method mismatch** — mobile uses PUT, backend requires PATCH |
| `PUT /api/notifications/read-all` | notificationsApi.ts | `PATCH /api/notifications/read-all` | ❌ **Method mismatch** — mobile uses PUT, backend requires PATCH |
| `GET /api/notifications/unread-count` | notificationsApi.ts, MainTabNavigator.tsx | `GET /api/notifications/count` | ❌ **URL mismatch** — mobile calls `/unread-count`, backend route is `/count` |
| `POST /api/auth/push-token` | pushNotifications.ts | `POST /api/users/push-token` | ❌ **URL mismatch** — pushNotifications.ts uses auth prefix; usersApi.ts correctly uses `/api/users/push-token` (inconsistency within mobile) |
| `POST /api/payments/job/:jobId/fund` | paymentsApi.ts | `POST /api/payments/fund-escrow` | ❌ **URL mismatch** — mobile uses per-job URL, backend has flat fund-escrow endpoint |
| `POST /api/payments/job/:jobId/release` | paymentsApi.ts | `POST /api/payments/release-escrow` | ❌ **URL mismatch** — same pattern, different endpoint shape |
| `POST /api/jobs/:id/apply` | jobsApi.ts | `POST /api/jobs/:id/proposals` | ❌ **URL mismatch** — mobile uses `/apply`, backend route is `/proposals` |
| `PUT /api/jobs/:id/proposals/:proposalId/accept` | jobsApi.ts | `POST /api/jobs/:id/proposals/:proposalId/accept` | ❌ **Method mismatch** — mobile uses PUT, backend requires POST |
| `PUT /api/jobs/:id/complete` | jobsApi.ts | `POST /api/jobs/:id/complete` | ❌ **Method mismatch** — mobile uses PUT, backend requires POST |
| `PUT /api/jobs/:id/status` | jobsApi.ts | MISSING | ❌ No `/status` route in jobs.js — status is managed through discrete action routes |
| `DELETE /api/availability/service/:id/override` | availabilityApi.ts | MISSING | ❌ No DELETE override route — backend only has PUT and GET for service availability |

---

## Mobile Gaps (web has coverage, mobile doesn't)

| Route | Web File | Mobile Status |
|-------|----------|---------------|
| `POST /api/disputes` | DisputeFilingForm.js | ❌ Not implemented in mobile |
| `GET /api/disputes/user` | DisputeCenter.js | ❌ Not implemented |
| `POST /api/disputes/:id/evidence` | DisputeDetail.js | ❌ Not implemented |
| `POST /api/disputes/:id/messages` | DisputeDetail.js | ❌ Not implemented |
| `POST /api/disputes/:id/escalate` | DisputeDetail.js | ❌ Not implemented |
| `GET /api/background-checks/*` | BackgroundCheck.js | ❌ No background check flow in mobile |
| `POST /api/background-checks/` | BackgroundCheck.js | ❌ Not implemented |
| `POST /api/portfolio/upload` | PortfolioWizard.js | ❌ No portfolio upload in mobile |
| `POST /api/billing/subscribe` | PricingPage.js | ❌ Not implemented in mobile |
| `POST /api/billing/portal` | BillingSettings.js | ❌ Not implemented |
| `POST /api/billing/cancel` | BillingSettings.js | ❌ Not implemented |
| `GET /api/billing/plans` | PricingPage.js | ❌ Not implemented |
| `GET /api/contracts/templates` | CreateContract.js | ❌ Mobile contractsApi missing template fetch |
| `POST /api/contracts/` | CreateContract.js | ❌ Mobile can't create contracts |
| `GET /api/job-alerts` | JobAlertsPage.js | ❌ Not implemented in mobile |
| `POST /api/job-alerts` | SaveSearchModal.js | ❌ Not implemented |
| `GET /api/saved` | SavedItems.js | ❌ No saved items in mobile |
| `POST /api/errors/client` | errors.js (implied) | ❌ Mobile has no error reporting endpoint |
| `POST /api/analytics/track` | analytics.js | ❌ Mobile does no page view tracking |
| `GET /api/calendar/*` | CalendarConnect.js | ❌ No calendar integration in mobile |
| `GET /api/categories/:id/overview` | CategoryLanding.js | ❌ Not in mobile |
| `GET /api/users/me/earnings` | EarningsDashboard.js | ✅ Mobile earningsApi covers this |

---

## Well-Covered Routes

The following areas are properly wired across backend → web → mobile:

- **Auth core**: `POST /api/auth/login`, `/register`, `/forgot-password`, `/me`, `/logout` — covered by web AuthContext and mobile authApi
- **Jobs CRUD + proposals**: `GET/POST /api/jobs`, `GET /:id`, `POST /:id/proposals`, accept/decline — web complete; mobile has gaps in method conventions
- **Milestone system**: All routes in `jobs/milestones.js` (`/milestones`, `/milestones/:index/fund`, `/milestones/:index/release`, `/progress`) — web frontend correctly calls them; sub-router pattern works
- **Services full flow**: Order, confirm, deliver, complete, revision, cancel, subscribe, bundles — web fully covered; mobile servicesApi covers browse + order + subscribe + bundles
- **Boosts**: job/service boost, credits, options, track/click, analytics — web + mobile both cover key paths
- **Teams + Organizations**: All CRUD, members, invitations, approvals, spend-controls, custom roles, linked clients, audit logs — web fully wired; mobile teamsApi is comprehensive
- **Messages**: Conversations CRUD, find-or-create, sync, receipts — web solid; mobile partial
- **Payments**: Fund escrow, release escrow, methods, tip, connect-account, status — web covered; mobile has endpoint shape mismatches
- **Billing wallet**: add/withdraw/balance/pay/split-pay — web and mobile both covered
- **Bookings**: Full CRUD, confirm/reschedule/cancel/complete, payment-intent, group slots, recurring series, attendance, audit — web fully wired; mobile bookingsApi covers all core paths
- **Reviews**: list, create, helpful — web covered; response and edit missing
- **Disputes (admin)**: Full admin panel — web AdminDisputeDetail and AdminDisputePanel fully cover admin-side routes
- **Contracts**: list, create, send, sign, cancel — web covered; mobile contractsApi covers send/sign/cancel but not create
- **Skills**: categories, my-assessments, user/:userId, assess, pricing-insights, budget-insights — web and mobile both fully covered
- **Notifications (web)**: count, list, read, read-all — web correct; mobile has method mismatches (PUT vs PATCH)
- **Admin panel**: All admin.js routes are wired to corresponding AdminXxx.js components

---

## Recommendations

### P0 — Fix immediately (broken user-facing features)

1. **Calendar integration is completely broken** (web)
   - `CalendarConnect.js` calls `/api/calendar/google/auth` (GET) → must be `/api/calendar/google/connect` (POST)
   - `/api/calendar/ical/url` → must be `/api/calendar/ical-url`
   - `/api/calendar/ical/rotate` → must be `/api/calendar/ical-rotate`
   - Fix: Update CalendarConnect.js to use correct paths and methods, or add alias routes on backend

2. **Mobile notification badge never updates** — `notificationsApi.ts` + `MainTabNavigator.tsx` call `/api/notifications/unread-count` but backend route is `/api/notifications/count`. Mobile badge is permanently broken.

3. **Mobile HTTP method mismatches on notifications** — `notificationsApi.ts` uses PUT for `markRead` and `markAllRead`; backend expects PATCH. Fix method in mobile API file.

4. **Mobile push token registration split-brain** — `pushNotifications.ts` registers to `/api/auth/push-token` (doesn't exist); `usersApi.ts` correctly uses `/api/users/push-token`. Fix pushNotifications.ts to use usersApi.registerPushToken() instead.

5. **Mobile job apply endpoint wrong** — `jobsApi.ts` calls `POST /api/jobs/:id/apply`; backend expects `POST /api/jobs/:id/proposals`. Job applications from mobile are silently 404ing.

6. **Mobile payment funding/release shape mismatch** — `paymentsApi.ts` calls `/api/payments/job/:jobId/fund` and `/release`; backend uses flat `/fund-escrow` and `/release-escrow`. Jobs can't be funded or completed from mobile.

### P1 — Fix soon (degraded UX)

7. **`GET /api/users/:id` missing** — `useUser.js` in web calls `apiRequest('/api/users/${id}')` with a user ID. No such route exists in users.js. Any component using `useUser(id)` with an external ID will fail.

8. **Mobile messages send endpoint wrong** — `messagesApi.ts` POSTs to `/api/messages` (no such route). Must be `/api/messages/conversations/:conversationId/messages`. Sending messages from mobile is broken.

9. **Mobile job method mismatches** — `PUT /api/jobs/:id/proposals/:proposalId/accept` should be POST; `PUT /api/jobs/:id/complete` should be POST; `PUT /api/jobs/:id/status` has no backend route.

10. **Mobile availability delete override missing** — `availabilityApi.ts` calls `DELETE /api/availability/service/:id/override`; no such backend route. Add DELETE or change mobile to PUT with empty body.

### P2 — Clean up (dead code / tech debt)

11. **Delete or wire the entire `chatrooms` feature** — 6 routes in chatrooms.js, zero frontend/mobile usage. Either build the UI or remove the file.

12. **`preferences` routes are dead** — GET/PUT/unsubscribe all unused. Wire to a UI or remove.

13. **`public-profiles` route is dead** — `/api/public-profiles/:username` unused; web uses `/api/freelancers/:id`. Consider removing or redirecting.

14. **Duplicate admin route** — `GET /api/admin/users/search` is defined twice in admin.js. Remove duplicate.

15. **Boost impression tracking never fires** — `POST /api/boosts/track/impression` defined but never called. Impression analytics are incomplete.

16. **Message upload + asset signing routes wired but unused** — `POST /api/messages/assets/sign`, `POST /assets/:assetId/finalize`, and `POST /conversations/:id/messages/upload` are defined but no frontend calls them. Message file attachments are not functional.

17. **`/api/bookings/availability/:serviceId`** (GET/PUT in bookings.js) duplicates `/api/availability/service/:serviceId`. The bookings-namespaced versions are dead; remove them.

18. **Offer counter + withdraw flows missing** — `POST /api/offers/:id/counter` and `/withdraw` exist but no frontend UI triggers them.

19. **Review edit + response missing** — `PUT /api/reviews/:id` and `POST /api/reviews/:id/response` exist but no frontend calls them. Freelancers can't respond to reviews.

### P3 — Mobile parity (feature completeness)

20. Add dispute management to mobile (file, track, escalate)  
21. Add billing subscription management to mobile (subscribe, portal, cancel)  
22. Add contract creation to mobile  
23. Add job alerts to mobile  
24. Add saved items to mobile  
25. Add error reporting (`POST /api/errors/client`) to mobile crash handler

---

## Appendix: Route Mount Map

```
/api/admin         → routes/admin.js
/api/ai            → routes/ai.js
/api/analytics     → routes/analytics.js
/api/auth          → routes/auth.js
/api/availability  → routes/availability.js
/api/background-checks → routes/backgroundChecks.js
/api/billing       → routes/billing.js
/api/bookings      → routes/bookings.js
/api/boosts        → routes/boosts.js
/api/calendar      → routes/calendar.js
/api/calls         → routes/calls.js
/api/categories    → routes/categories.js
/api/chatrooms     → routes/chatrooms.js  ← DEAD
/api/contact       → routes/contact.js
/api/contracts     → routes/contracts.js
/api/disputes      → routes/disputes.js
/api/email         → routes/email.js
/api/errors        → routes/errors.js
/api/freelancers   → routes/freelancers.js
/api/job-alerts    → routes/jobAlerts.js
/api/jobs          → routes/jobs.js
  /api/jobs/:id/*  → routes/jobs/milestones.js (sub-router)
/api/job-templates → routes/jobTemplates.js
/api/messages      → routes/messages.js
/api/notifications → routes/notifications.js
/api/offers        → routes/offers.js
/api/organizations → routes/organizations.js
/api/payments      → routes/payments.js
/api/portfolio     → routes/portfolio.js
/api/preferences   → routes/preferences.js  ← DEAD
/api/public-profiles → routes/publicProfiles.js  ← DEAD
/api/referrals     → routes/referrals.js
/api/reviews       → routes/reviews.js
/api/saved         → routes/saved.js
/api/search        → routes/search.js
/api/skills        → routes/skills.js
(no prefix)        → routes/seo.js  ← /robots.txt, /sitemap.xml
/api/stats         → routes/stats.js
/api/teams         → routes/teams.js
/api/users         → routes/users.js
```

Webhooks (mounted before JSON middleware):
```
POST /api/payments/webhook → routes/payments.webhookHandler
POST /api/billing/webhook  → routes/billing.webhookHandler
```
