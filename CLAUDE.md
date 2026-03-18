# CLAUDE.md — Fetchwork

> Auto-loaded by Claude Code on every session. Keep this accurate.

## What This Is
Fetchwork is a freelance marketplace (React + Express + MongoDB + Stripe).
- **Web:** fetchwork.net (Vercel)
- **API:** fetchwork-1.onrender.com (Render)
- **Repo:** github.com/stancp327/Fetchwork

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React (CRA), React Router v6, socket.io-client |
| Backend | Node.js 18, Express, socket.io |
| Primary DB | MongoDB + Mongoose |
| SQL DB | PostgreSQL (Neon) + Prisma — booking subsystem only |
| Payments | Stripe Connect + Webhooks |
| Auth | JWT + express-session + Google OAuth + Facebook OAuth |
| Email | Resend |
| File uploads | Cloudinary + Multer |
| Mobile | React Native (Expo + EAS) |
| Deploy | Render (API) + Vercel (client) + EAS (mobile) |

---

## Repo Structure

```
Fetchwork/
├── client/          React frontend (CRA)
│   └── src/
│       ├── components/  Feature components (Messages/, Teams/, Admin/, etc.)
│       ├── pages/       Route-level pages
│       ├── context/     AuthContext, SocketContext
│       └── socket/      useSocket.js hook
├── server/          Express backend
│   ├── routes/      API route handlers (one file per domain)
│   ├── models/      Mongoose models
│   ├── services/    Business logic (aiContractService, etc.)
│   ├── middleware/  Auth, rate limiting, etc.
│   ├── prisma/      Prisma schema + migrations (booking SQL)
│   ├── booking-sql/ SQL booking engine (SlotEngine, etc.)
│   ├── crons/       Scheduled jobs
│   ├── utils/       Shared helpers
│   └── __tests__/   Jest tests
├── mobile/          React Native (Expo)
├── e2e/             Playwright tests
├── scripts/         One-off + maintenance scripts
└── tasks/           Planning docs, checklists
```

---

## Key Commands

### Client
```powershell
cd client
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx react-scripts build        # production build (REQUIRED before commit)
npm start                      # dev server :3000
npm test -- --watchAll=false   # run tests
```

### Server
```powershell
cd server
node index.js                  # start server :5000
npm test                       # Jest tests
npx jest --selectProjects unit # unit tests only
npx prisma migrate status      # check SQL migrations
```

### Mobile
```powershell
cd mobile
npx expo start                 # dev mode
# EAS build: always Remove-Item -Recurse -Force mobile\android first
eas build --platform android --profile preview
```

---

## Hard Rules (Never Break)

### CSS
- **NEVER** `* { ... }` selectors for layout fixes
- **NEVER** `overflow: hidden` without checking for absolute children / negative margins
- **NEVER** `min-width: 0` globally — only on the specific overflowing flex child
- Mobile-first: 360px base, `min-width` media queries only, 44px touch targets
- `html` AND `body` both need `overflow-x: hidden` — body alone doesn't work
- `overflow-x: auto` on a container clips absolutely positioned children (both axes)
- **Always read the full CSS file before editing anything in it**

### JavaScript / React
- `function` declarations hoist; `const` does not — matters for mutually-referencing closures
- Capture-group regex `.split()`: odd indices are always the matched segments
- When using `useRef` shared across hooks: pre-declare at component level, pass down
- `window.location.href` for internal navigation — use `navigate()` instead
- Blob URLs: always revoke with `URL.revokeObjectURL()` in cleanup

### Git
- Run `react-scripts build` and verify it passes before committing client changes
- One logical unit per commit, descriptive message
- Never force-push main

### Render / Env Vars
- **NEVER** `PUT /env-vars` without the FULL confirmed set — partial PUT wipes everything else
- Always GET current vars first, merge, then PUT

---

## Payment & Wallet Rules (High Risk)
- All payout/wallet deduction routes use MongoDB transactions (`mongoose.startSession()`)
- FIFO credit deduction via `BillingCredit` model (sorted by `createdAt` asc)
- `BillingCredit` field `team` = team wallet; field `user` = personal wallet
- `$1 minimum platform fee` enforced via `enforceMinimumFee()`
- Fee engine: 5-layer priority (waiver → override → promo → plan → fallback)
- `wallet/pay` enforces freeze: returns 403 `wallet_frozen` if user/team wallet is frozen
- Never modify payout routes without running the Jest wallet tests first

---

## Feature Flags
- `BOOKING_SQL_ENABLED=true` — booking CRUD hits Neon/Prisma (live on Render)
- `DISCOVERY_ALGORITHM_ENABLED` — toggleable from admin
- Plan-gated features use `entitlementEngine` + `FeatureGrant`/`FeatureGroup` models

---

## Auth
- Admin access: `stancp327@gmail.com` (Google OAuth only)
- JWT secret: `JWT_SECRET` env var
- Google OAuth: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (⚠️ secret missing — Google login broken)
- Facebook OAuth: `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET` (not yet configured)

---

## Key Models (MongoDB)
- `User` — main user, includes wallet freeze fields
- `BillingCredit` — wallet credits for users and teams (FIFO deduction)
- `Team` + `TeamTask` + `TeamPayout` — teams payout system
- `Service` + `ServiceSubscription` + `BundlePurchase` — recurring + bundle payments
- `Booking` — legacy Mongo (no longer used for core booking — SQL now)
- `Job` + proposals array (has `team` field for team-to-team proposals)
- `Payment` + `ChargeRecord` — payment ledger

## Key Models (SQL / Prisma)
- `FreelancerAvailability` + `ServiceAvailabilityOverride` — availability config
- `Booking` (SQL) — all booking CRUD (replaces Mongo Booking)
- `BookingOccurrence` — recurring series instances
- `GroupSlot` + `GroupSlotBooking` + `GroupSlotWaitlist` — group bookings

---

## Infra
- **Render service ID:** `srv-d1so7iemcj7s73e9colg`
- **Render API key:** `rnd_rE3dGaR6XeDvTCtNd1cj4wMZMJwc`
- **Neon DB:** `ep-billowing-credit-akpgq80y`, us-west-2
- **MongoDB:** `fetchwork.sch7kdf.mongodb.net`
- **EAS project ID:** `7550a4f8-a14b-4568-a588-989666852755`
- **EAS account:** `zestyfresh925s-organization`
- Manual deploy: `POST https://api.render.com/v1/services/srv-d1so7iemcj7s73e9colg/deploys`

---

## Known Issues / Tech Debt
- No Sentry — zero error visibility in production
- No tests on wallet/payout routes — highest-risk untested code
- Google login broken — missing `GOOGLE_CLIENT_SECRET` on Render
- Vercel token expires ~March 21, 2026 — needs renewal
- `OPENAI_API_KEY` missing on Render — AI features disabled
- Debug log commits (b45a67e, fa8530c) should be stripped before launch
- Featured jobs + promoted proposals: backend exists, no UI (on hold)

---

## What's NOT Deployed Yet
All commits after `835ba03` are not yet live on Render/Vercel:
- Messages refactor (5 hooks, 4 audit passes)
- Teams payout system (TeamTask, TeamPayout, 25 routes)
- Booking frontend (BookingDetail, GroupSlotsPage, RecurringSeriesPanel)
- Various bug fixes and polish commits
