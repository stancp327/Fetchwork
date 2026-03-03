# Route Access Matrix

_Last updated: 2026-03-02_

## Purpose
Track whether frontend routes are actually reachable by users (not just defined in `App.js`).

## Directly discoverable (main navigation)
- `/dashboard`
- `/freelancers`
- `/browse-jobs`
- `/browse-services`
- `/create-service` / `/post-job` (role-based)
- `/messages`
- `/projects`
- `/payments`
- `/bookings`
- `/reviews`
- `/saved`
- `/offers`
- `/teams`
- `/billing`
- `/wallet`
- `/analytics`
- `/spend`
- `/contracts`
- `/security`
- `/job-alerts`
- `/discovery-settings`
- `/referrals`
- `/profile`
- `/pricing` (public nav)

## In-app flow routes (intentional, no direct nav)
- Auth flow: `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`, `/logout`
- Billing flow: `/billing/success`
- Boost flow: `/boost-checkout`, `/boost-success`
- Setup flow: `/onboarding/profile`, `/calendar-connect`, `/availability`
- Content/detail routes: `/jobs/:id`, `/jobs/:id/proposals`, `/jobs/:id/progress`, `/services/:id`, `/services/:id/availability`, `/services/:serviceId/orders/:orderId`, `/freelancers/:id`, `/freelancer/:username`, `/contracts/:id`, `/teams/:id`, `/agency/:slug`, `/categories/:categoryId`

## Notes
- `/boost-success` now maps to dedicated `BoostSuccess` component (was previously mapped to checkout component).
- Dashboard quick actions include access to key utility routes (payments, bookings, disputes, search, contracts, background check, calendar connect).
