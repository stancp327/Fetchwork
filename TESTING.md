# FetchWork Testing Strategy

_Last updated: 2025-02_

---

## A. Testing Pyramid

```
          ┌─────────┐
          │   E2E   │  5% — Playwright, full UI flows against running app
          │ (slow)  │
          ├─────────┤
          │ Integr. │  35% — Supertest + mongodb-memory-server, real routes/DB
          ├─────────┤
          │  Unit   │  60% — Jest, pure functions + model mocks (no network, no DB)
          └─────────┘
```

**Backend split:**
- **Unit** (`server/__tests__/*.test.js` + `unit/`): Pure function tests, model validators,
  middleware logic. Zero I/O. Mock all DB calls.
- **Integration** (`server/__tests__/integration/`): Real Express routes + real MongoDB
  (in-memory). Test HTTP contracts, DB state transitions, auth middleware chains.

**Frontend split:**
- **Unit** (`client/src/__tests__/`): RTL component tests. Mock API via MSW. Test renders,
  state, user interaction, form validation.
- **E2E** (`e2e/tests/`): Playwright. Full browser. Only the most critical user journeys.

---

## B. What Goes Where

| Layer | Tests | Mocking |
|-------|-------|---------|
| Unit BE | Pure utils, model validators, JWT helpers, fee engine | Everything |
| Integration BE | Auth, CRUD, payments webhook, disputes, reviews | Stripe SDK, Email, Google |
| Unit FE | Login form, ProtectedRoute, job form, notification bell | MSW (API), socket.io-client |
| E2E | Register → post job → apply → hire → complete; Mobile scroll | Real app, test DB |

---

## C. Test Data Strategy

**Factories** (`test-utils/factories.js`):
- `buildXxx()` — plain objects for unit tests (no DB)
- `createXxx()` — saves to in-memory DB for integration tests
- All factories use `@faker-js/faker` for realistic but random data
- Deterministic fields passed as overrides (email, status, etc.)

**DB isolation:**
- Integration: `beforeEach(clearDB)` wipes all collections between tests
- E2E: register fresh users per test-run via API; use unique suffixes

**No shared state across test files.** Each file reconnects in `beforeAll`, clears in
`beforeEach`, closes in `afterAll`.

---

## D. Mock Strategy

| External Service | Mock Approach |
|-----------------|---------------|
| Stripe SDK | `jest.mock('stripe')` — returns deterministic PaymentIntent/Transfer objects |
| Stripe Webhook | Mocked `constructEvent` — validates sig header presence; returns parsed JSON |
| Email (SMTP) | `jest.mock('../../services/emailService')` — all methods `mockResolvedValue(true)` |
| Google OAuth | Passport strategy mocked — not tested at integration level |
| Socket.io | `jest.mock('socket.io-client')` in FE; `global.io` stub in BE integration |
| File uploads | `multer` mocked in unit tests; integration tests skip multipart |
| node-cron | Not tested directly; cron functions exported and tested as pure async functions |
| MongoDB | `mongodb-memory-server@10` for integration, `jest.mock()` for unit |

---

## E. Coverage Targets

| Layer | Lines | Branches | Notes |
|-------|-------|----------|-------|
| Backend global | 65% | 55% | Enforced in `jest.config.js` |
| `routes/payments.js` | **85%** | — | Money path; highest priority |
| `routes/disputes.js` | **75%** | — | State machine must be covered |
| `routes/jobs.js` | **75%** | — | Core CRUD |
| Frontend global | 60% | 50% | Enforced in `react-scripts` config |

Thresholds are **fail-build** in CI (see `jest.config.js` `coverageThresholds`).

---

## F. Definition of Done (PR checklist)

Before any PR merges:

- [ ] All existing tests still pass (`npm test -- --ci`)
- [ ] New feature has at least: 1 integration test (happy path) + 1 negative test
- [ ] Money paths (payment, dispute, escrow) have 85%+ line coverage
- [ ] Security-sensitive routes have auth + RBAC tests
- [ ] No `console.log` in test output (suppress or use `jest.spyOn`)
- [ ] No real network calls (nock/MSW intercepts all outbound HTTP)
- [ ] Test names describe the scenario, not the implementation
- [ ] `CI=false` only if ESLint warnings are pre-existing (not introduced by this PR)

---

## G. Run Commands

```bash
# ── Backend ───────────────────────────────────────────────────────
cd server

# Unit only (fast, ~5s)
npx jest --selectProjects unit

# Integration only (~20s, starts in-memory MongoDB)
npx jest --selectProjects integration

# All server tests + coverage
npx jest --coverage

# Watch mode (unit only, during development)
npx jest --selectProjects unit --watch

# ── Frontend ──────────────────────────────────────────────────────
cd client

# All RTL tests
npm test -- --watchAll=false

# With coverage
npm test -- --watchAll=false --coverage

# ── E2E ───────────────────────────────────────────────────────────
cd e2e

# Run all (requires app running at localhost:3000 + :5000)
npx playwright test

# Mobile only
npx playwright test --project mobile-chrome

# Headed (debug)
npx playwright test --headed

# View last report
npx playwright show-report playwright-report

# ── CI simulation (all stages) ───────────────────────────────────
# From root:
cd server && npx jest --selectProjects unit --ci --forceExit
cd server && npx jest --selectProjects integration --ci --forceExit --coverage
cd client && CI=false npm test -- --watchAll=false --passWithNoTests
cd e2e    && npx playwright test
```

---

## H. Folder Structure

```
Fetchwork/
├── server/
│   ├── __tests__/
│   │   ├── setup/
│   │   │   ├── globalSetup.js      # starts mongodb-memory-server
│   │   │   ├── globalTeardown.js   # stops mongodb-memory-server
│   │   │   └── dbHelpers.js        # connectDB / clearDB / closeDB
│   │   ├── unit/                   # new unit tests (pure, no DB)
│   │   ├── integration/            # real route + DB tests
│   │   │   ├── auth.integration.test.js
│   │   │   ├── jobs.integration.test.js
│   │   │   ├── payments.integration.test.js
│   │   │   ├── disputes.integration.test.js
│   │   │   ├── reviews.integration.test.js
│   │   │   └── security.integration.test.js
│   │   ├── auth.test.js            # existing unit test (model mock)
│   │   ├── jobs.test.js            # existing unit test (model mock)
│   │   └── disputes.test.js        # existing unit test
│   └── jest.config.js              # two projects: unit + integration
│
├── client/
│   └── src/__tests__/
│       ├── setup/
│       │   └── server.js           # MSW server + default handlers
│       ├── Login.test.js
│       ├── AuthContext.test.js     # existing
│       ├── JobCard.test.js         # existing
│       └── ProtectedRoute.test.js  # existing
│
├── e2e/
│   ├── playwright.config.js
│   └── tests/
│       ├── happyPath.spec.js       # full client→freelancer→hire flow
│       └── mobile.spec.js          # 375px + 360px no-overflow checks
│
├── test-utils/
│   └── factories.js                # buildXxx / createXxx / signToken
│
├── .env.test                       # env template for tests
└── TESTING.md                      # this file
```

---

## I. Key Decisions

**mongodb-memory-server over Testcontainers:** Lighter CI footprint, no Docker required,
spins up in <3s. Testcontainers would be better for testing sharding/replica-set behavior,
but overkill here.

**MSW over nock for frontend:** MSW intercepts at the Service Worker level (or Node.js
`http` interceptor in tests), which tests the actual `fetch`/`axios` call path rather than
patching Node modules. More realistic.

**nock available for backend outbound calls** (Stripe, email APIs) when SDK mocking is
insufficient.

**`jest.mock('stripe')` not nock for Stripe:** The Stripe SDK's `constructEvent` runs
synchronous HMAC validation — mocking the SDK is more reliable than intercepting HTTP
because Stripe events are validated before any HTTP response body is read.

**Two Jest projects (unit/integration) not two `package.json` scripts:** Lets you run
`npx jest --selectProjects unit` or `integration` individually, and `npx jest` runs both.
`globalSetup` only fires for the `integration` project — unit tests stay fast.
