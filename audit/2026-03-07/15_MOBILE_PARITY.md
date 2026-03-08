# Mobile Parity Audit — 2026-03-07

> **Audit scope:** Web client (`client/src/`) vs. React Native mobile app (`mobile/src/`)
> **Method:** File enumeration, route analysis, navigation tree traversal, API endpoint cross-reference, feature-area file counts
> **Mode:** Read-only. No files were modified.

---

## Summary

| Metric | Count |
|--------|-------|
| Web routes (App.js) | 56 |
| Mobile screens (all navigators) | 32 |
| Feature areas audited | 21 |
| Gaps found (MISSING or PARTIAL) | 34 |
| MISSING (no mobile equivalent) | 22 |
| PARTIAL (exists but incomplete) | 12 |
| Mobile-only features | 3 |

---

## Gap Matrix

| Feature | Web File(s) | Mobile Status | Priority |
|---------|-------------|---------------|----------|
| Dispute Center | DisputeCenter.js, DisputeDetail.js, DisputeFilingForm.js, DisputeTimeline.js | **MISSING** | HIGH |
| Video Calls | VideoCallModal.js, IncomingCallOverlay.js | **MISSING** | HIGH |
| Reviews (write/manage) | Reviews.js | **MISSING** | HIGH |
| Project Management | ProjectManagement.js, ProjectCard.js, MilestoneRow.js, MilestoneChangeModal.js | **MISSING** | HIGH |
| Freelancer Discovery | FreelancerDiscovery.js, FreelancerCard.js, FreelancerFilterPanel.js | **MISSING** | HIGH |
| Job Proposals (view/manage) | JobProposals.js | **MISSING** | HIGH |
| Universal Search | UniversalSearch.js, SearchSuggestions.js | **MISSING** | HIGH |
| Service Creation Wizard | CreateService.js (6-step wizard) | **MISSING** | HIGH |
| Escrow / Payment Flow | EscrowModal.js, CheckoutForm.js | **MISSING** | HIGH |
| Boost Checkout UI | BoostCheckout.js, BoostSuccess.js | **PARTIAL** | HIGH |
| Contract Detail / Create | ContractDetail.js, CreateContract.js | **PARTIAL** | HIGH |
| Analytics Dashboard | UserAnalytics.js, SpendDashboard.js, charts.js | **MISSING** | MEDIUM |
| Referrals | ReferralPage.js | **MISSING** | MEDIUM |
| Saved Items | SavedItems.js | **MISSING** | MEDIUM |
| Custom Offers | CustomOfferModal.js, MyOffers.js | **MISSING** | MEDIUM |
| Job Alerts / Saved Searches | JobAlertsPage.js, SaveSearchModal.js | **MISSING** | MEDIUM |
| Tip Modal | TipModal.js | **MISSING** | MEDIUM |
| Billing / Subscription | BillingSettings.js, PricingPage.js, BillingSuccess.js | **PARTIAL** | MEDIUM |
| Background Check | BackgroundCheck.js | **PARTIAL** | MEDIUM |
| Onboarding Wizard | Wizard.js, ProfileCompletion.js, ProposalWizard.js | **MISSING** | MEDIUM |
| Public Profile View | PublicProfile.js | **MISSING** | MEDIUM |
| Agency Directory | AgencyDirectory.js, AgencyProfile.js | **MISSING** | MEDIUM |
| Category Landing | CategoryLanding.js | **MISSING** | LOW |
| ChatBot | ChatBot.js | **MISSING** | LOW |
| Security Settings | Security.js | **PARTIAL** | LOW |
| Email Preferences | EmailPreferences.js | **PARTIAL** | LOW |
| Job Progress View | JobProgress.js | **MISSING** | HIGH |
| Service Order Progress | ServiceOrderProgress.js | **MISSING** | HIGH |
| Admin Panel (entire) | 22 admin files | **MISSING** | LOW (expected) |
| Stripe Connect Onboarding | StripeConnect.js | **PARTIAL** | MEDIUM |
| Calendar Connect | CalendarConnect.js, AvailabilitySettings.js | **PARTIAL** | MEDIUM |
| Recurring Session Settings | RecurringSessionSettings.js | **PARTIAL** | LOW |
| Intake Forms | IntakeFormEditor.js, IntakeFormFill.js | **MISSING** | MEDIUM |
| Portfolio Wizard | PortfolioWizard.js | **MISSING** | MEDIUM |

---

## Critical Gaps (HIGH priority — core features missing)

### 1. Dispute Center — MISSING
Web files: `DisputeCenter.js`, `DisputeDetail.js`, `DisputeFilingForm.js`, `DisputeTimeline.js`
Mobile: **Zero files**. No dispute API endpoint in `mobile/src/api/endpoints/`. No screens, no navigation entry.

A dispute workflow is core to any freelance marketplace. Users who have a payment conflict on mobile have no recourse without switching to web. This is a trust and safety gap.

---

### 2. Video Calls — MISSING
Web files: `VideoCallModal.js`, `IncomingCallOverlay.js`
Mobile: **Zero files**. No call API, no WebRTC/Agora/Twilio integration.

The web app supports live video calling between clients and freelancers. Mobile has no equivalent, which is ironic — mobile is the primary video call device for most users.

---

### 3. Project Management & Milestones — MISSING
Web files: `ProjectManagement.js`, `ProjectCard.js`, `MilestoneRow.js`, `MilestoneChangeModal.js`, `QuickUpdate.js`
Web routes: `/projects`, `/jobs/:id/progress`, `/services/:serviceId/orders/:orderId`
Mobile: **Zero screens**. `jobsApi.ts` accepts `milestones` on apply but there's no way to view, approve, or update milestone status on mobile.

Clients who hire a freelancer via mobile can't track project progress, approve milestones, or release payment without going to web. This breaks the core hire-and-manage loop.

---

### 4. Job Proposals View — MISSING
Web files: `JobProposals.js`, `ApplicantPreview.js`
Web route: `/jobs/:id/proposals`
Mobile: `jobsApi.ts` has `getProposals()` and `acceptProposal()` wired but no screen to display them.

Clients who post a job on mobile can't review applicants or hire anyone without switching to web. Core client workflow is broken.

---

### 5. Freelancer Discovery — MISSING
Web files: `FreelancerDiscovery.js`, `FreelancerCard.js`, `FreelancerFilterPanel.js`, `InviteToJob.js`
Web route: `/freelancers`, `/freelancers/:id`
Mobile: **Zero screens**. `usersApi.ts` has `getProfile()` but no browse/search UI.

Clients cannot discover or browse freelancers on mobile. This is the primary client acquisition flow.

---

### 6. Universal Search — MISSING
Web files: `UniversalSearch.js`, `SearchSuggestions.js`
Web route: `/search`
Mobile: No search screen, no search API. The home screen has quick-action buttons but no search bar.

---

### 7. Service Creation Wizard — MISSING
Web files: `CreateService.js` + 9 sub-components (`StepDetails`, `StepPricing`, `StepMedia`, `StepRequirements`, `StepReview`, `BundleEditor`, `PackageTierForm`, `ServiceTypeSelector`, `LivePreview`)
Web route: `/create-service`
Mobile: `MyServicesScreen.tsx` shows existing services but has no "Create Service" flow.

Freelancers cannot create new service offerings from mobile.

---

### 8. Escrow / Full Payment Flow — MISSING
Web files: `EscrowModal.js`, `CheckoutForm.js`, `BookingPayModal.js`
Mobile: `paymentsApi.ts` has `fundJob()` and `releasePayment()` endpoints but no UI screens. Booking payment (`bookingsApi.ts` has `getPaymentIntent()` / `confirmPayment()`) also lacks a UI surface.

Payments can't be initiated or released on mobile.

---

### 9. Job Progress / Service Order Progress — MISSING
Web routes: `/jobs/:id/progress`, `/services/:serviceId/orders/:orderId`
Web files: `JobProgress.js`, `ServiceOrderProgress.js`, `ServiceOrderCard.js`
Mobile: No equivalent screens. Active jobs and service orders are invisible once started.

---

### 10. Boost Checkout UI — PARTIAL
Web files: `BoostCheckout.js`, `BoostSuccess.js`, `JobFeatureModal.js`
Mobile: `boostsApi.ts` exists and is wired into `JobDetailScreen.tsx` (inline quick-boost via credit). However:
- No boost checkout page (can't purchase boost credits on mobile)
- No service boosting UI (only job boost)
- No boost analytics screen
- No featured job UI (`JobFeatureModal` — paying to feature a job in search)

---

### 11. Contract Detail & Create — PARTIAL
Web files: `ContractsList.js`, `ContractDetail.js`, `CreateContract.js`
Mobile: `ContractsScreen.tsx` shows a list with send/sign/cancel actions. Missing:
- **ContractDetail** — no dedicated detail view; actions are inline in the list
- **CreateContract** — no way to draft a new contract from mobile

---

## Partial Implementations (needs completion)

### Billing & Subscription (PARTIAL)
- `WalletScreen.tsx` ✅ — top-up and withdraw work, links to Stripe checkout
- `PaymentsScreen.tsx` ✅ — Stripe Connect onboarding and payment history
- Missing: **Plan/subscription management** (`BillingSettings.js`), **pricing page** (`PricingPage.js`), billing success redirect handling

### Background Check (PARTIAL)
- `VerificationScreen.tsx` ✅ — shows badges and verification status
- Missing: actual background check initiation flow (`BackgroundCheck.js`)

### Boost — Service Side (PARTIAL)
- Job boost: inline in `JobDetailScreen` ✅
- Service boost: no UI (API exists in `boostsApi.ts`)
- Boost credit purchase: no UI

### Calendar Connect (PARTIAL)
- `AvailabilityManagerScreen.tsx` ✅ — slot duration, schedule, buffer time
- Missing: `CalendarConnect.js` (Google/Apple calendar OAuth sync), `AvailabilitySettings.js` (global availability overrides)

### Contracts (PARTIAL)
- List + sign + cancel ✅
- Missing: detail view, create new contract

### Stripe Connect (PARTIAL)
- `PaymentsScreen.tsx` links to Stripe Connect onboarding via `Linking.openURL` ✅
- Missing: redirect back flow, connect status polling

### Security Settings (PARTIAL)
- Covered under `SettingsScreen.tsx` at surface level
- Missing: `Security.js` — password change, 2FA setup, active sessions, connected OAuth providers

### Email Preferences (PARTIAL)
- Not present in settings screen
- Missing: `EmailPreferences.js` — notification email toggles

### Intake Forms (PARTIAL)
- `servicesApi.ts` can order services ✅
- Missing: `IntakeFormFill.js` — clients can't fill out freelancer intake questionnaires on mobile

### Portfolio Wizard (PARTIAL)
- `EditProfileScreen.tsx` has basic profile editing
- Missing: `PortfolioWizard.js` — dedicated portfolio project creation with media

### Recurring Session Settings (PARTIAL)
- `AvailabilityManagerScreen.tsx` covers basic slot settings
- Missing: `RecurringSessionSettings.js` — recurring series configuration for group classes

### Reviews (PARTIAL at display only)
- Review counts and ratings display in `MyServicesScreen` and `MyProfileScreen`
- Missing: `Reviews.js` — the entire review-writing, review-browsing, and review-management screen

---

## Mobile-Only Features

These exist in mobile but have no direct web equivalent:

| Feature | Mobile File | Notes |
|---------|-------------|-------|
| Push Notifications | `PushPermissionPrompt.tsx`, `pushNotifications.ts` | Web uses in-browser notification API only |
| App Update Checker | `updateChecker.ts` | Checks app store version, prompts update |
| Device ID Management | `deviceId.ts` | For push token deduplication |

---

## API Coverage

Mobile has API clients for these domains (endpoints wired, may lack UI):

| Domain | API File | UI Screen | Gap |
|--------|----------|-----------|-----|
| Auth | `authApi.ts` | ✅ Full auth screens | None |
| Jobs | `jobsApi.ts` | ✅ Browse, Detail, Post, My Jobs | Proposals UI, Job Progress |
| Services | `servicesApi.ts` | ✅ Browse, Detail, My Services, Bundles | Service Creation, Order Progress |
| Messages | `messagesApi.ts` | ✅ Conversation list + thread | None |
| Bookings | `bookingsApi.ts` | ✅ List, Detail, GroupSlots | Payment UI |
| Payments | `paymentsApi.ts` | ✅ PaymentsScreen | Escrow UI, release flow |
| Billing/Wallet | `billingApi.ts` | ✅ WalletScreen | Plan management |
| Earnings | `earningsApi.ts` | ✅ EarningsScreen | None |
| Contracts | `contractsApi.ts` | ⚠️ List only | Detail + Create UI |
| Teams | `teamsApi.ts` | ✅ Teams + TeamDetail | None |
| Skills | `skillsApi.ts` | ✅ SkillAssessmentScreen | None |
| Boosts | `boostsApi.ts` | ⚠️ Inline only | Full boost checkout UI |
| Notifications | `notificationsApi.ts` | ✅ NotificationsScreen | None |
| Discovery | `discoveryApi.ts` | ✅ DiscoverySettingsScreen | None |
| Availability | `availabilityApi.ts` | ✅ AvailabilityManagerScreen | Calendar sync |
| AI | `aiApi.ts` | ⚠️ Only in PostJobScreen | Match UI |
| Users | `usersApi.ts` | ⚠️ Profile only | Freelancer browse, Public profile |

**Missing API modules (no client in mobile at all):**

| Missing | Web Equivalent | Impact |
|---------|----------------|--------|
| `disputesApi` | `DisputeCenter.js` | Cannot file or view disputes |
| `reviewsApi` | `Reviews.js` | Cannot write reviews |
| `searchApi` | `UniversalSearch.js` | No search capability |
| `offersApi` | `CustomOfferModal.js`, `MyOffers.js` | No custom offer flow |
| `jobAlertsApi` | `JobAlertsPage.js` | No saved searches |
| `analyticsApi` | `UserAnalytics.js`, `SpendDashboard.js` | No analytics (partial via usersApi) |
| `referralsApi` | `ReferralPage.js` | No referral UI (partial via usersApi) |
| `savedItemsApi` | `SavedItems.js` | No save/bookmark flow |

---

## Recommendations

Prioritized build order based on revenue impact, user trust, and feature completeness:

### Sprint 1 — Core Hire Loop (1–2 weeks)
1. **Job Proposals Screen** — Clients can review applicants and hire; API already exists (`jobsApi.getProposals`, `acceptProposal`). Wire a screen into `JobsStackNavigator`.
2. **Job Progress Screen** — Show active milestones, allow marking complete; route off `MyJobsScreen`.
3. **Service Order Progress Screen** — Mirror `ServiceOrderProgress.js`; use existing services API.
4. **Escrow/Payment Confirmation UI** — Expose `paymentsApi.fundJob()` and `releasePayment()` with a simple confirmation screen.

### Sprint 2 — Discovery & Search (1 week)
5. **Universal Search Screen** — Minimal search bar with jobs + services tabs; no backend changes needed.
6. **Freelancer Discovery Screen** — Browse freelancers, view public profiles; `usersApi.getProfile()` already works.
7. **Public Profile View** — Dedicated screen for viewing another user's profile (reuse profile components).

### Sprint 3 — Disputes & Reviews (1–2 weeks)
8. **Dispute Filing + View** — Add `disputesApi` module + 2 screens (DisputeCenter, DisputeDetail). This is a trust/safety gap.
9. **Review Writing Screen** — Add `reviewsApi` + review form triggered after job/booking completion.

### Sprint 4 — Missing Features (2+ weeks)
10. **Service Creation Wizard** — Large effort; port the 6-step wizard from web to mobile.
11. **Contract Detail + Create** — Extend `ContractsScreen` with a detail view and creation flow.
12. **Boost Checkout UI** — Add boost credit purchase screen and service boost inline.
13. **Analytics Dashboard** — Leverage `usersApi.getAnalytics()`; add charts (Victory Native or similar).
14. **Referral Screen** — Simple UI; API wired in `usersApi.getReferrals()`.
15. **Saved Items** — Bookmark jobs/services; requires backend savedItems API integration.
16. **Custom Offers / MyOffers** — Add offer creation modal and offer list screen.

### Sprint 5 — Polish (ongoing)
17. **Email Preferences** in Settings screen
18. **Security Settings** (password change, 2FA, OAuth)
19. **Portfolio Wizard** in Edit Profile
20. **Calendar Connect** (OAuth sync to Google/Apple Calendar)
21. **ChatBot** (nice-to-have)
22. **Intake Forms** for service ordering

### Do NOT Build on Mobile
- Admin Panel — intentionally web-only; fine as-is.
- Category Landing pages — SEO-driven; not appropriate for native app.
- Billing/Pricing page — upgrade flow should be a modal or deep link to web checkout.

---

*Audit generated: 2026-03-07 by igor-mobile-parity subagent*
*Codebase: C:\Users\stanc\Fetchwork*
