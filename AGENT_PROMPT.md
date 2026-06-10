You are building 3 new scheduling features for Fetchwork (a freelance marketplace). The app uses React frontend, Express backend, MongoDB (main DB) + PostgreSQL/Prisma (booking subsystem). All booking routes are in server/routes/bookings.js using SQL via Prisma. Frontend booking components are in client/src/components/Bookings/.

IMPORTANT CONTEXT:
- Booking routes use SQL (Prisma) not MongoDB. The booking schema is in server/prisma/schema.prisma
- Routes use authenticateToken middleware for auth, requireSql wrapper for SQL routes
- Frontend uses React with lazy loading in App.js
- CSS must be mobile-first (360px base, min-width media queries only, 44px touch targets)
- Never use * selectors or overflow:hidden without checking

BUILD THESE 3 FEATURES:

## Feature 1: Public Booking Page (/book/:username)

### Backend (server/routes/bookings.js — add new routes at top before auth routes):
- GET /api/bookings/public/:username — NO auth. Looks up user by username (MongoDB User model), returns: { freelancer: { _id, firstName, lastName, username, avatar, bio, rating, reviewCount }, services: [...bookable services with pricing] }. Only return services where the freelancer has active availability (check FreelancerAvailability in Prisma).
- GET /api/bookings/public/:username/:serviceId/slots?date=YYYY-MM-DD&days=7 — NO auth. Returns available slots for the date range. Reuse existing slot generation logic (look at how getSlotsSql works).
- POST /api/bookings/public/:serviceId — auth REQUIRED. Creates a booking hold exactly like the existing POST /:serviceId route. This is just an alias so the public page flow works.

### Frontend:
- Create client/src/components/Bookings/PublicBookingPage.js + .css
- Route: /book/:username (public, no ProtectedRoute wrapper) — add to App.js
- Page layout:
  1. Freelancer header card (avatar, name, rating, bio)
  2. Service list — click to select
  3. Selected service -> date picker (month calendar) -> available slots grid
  4. Click slot -> if not logged in, show login prompt (redirect to /login?redirect=/book/:username); if logged in, show confirm modal with service details + price + cancellation policy
  5. On confirm -> create hold -> redirect to BookingDetail page for payment
- Make it look clean and professional. This is a public-facing page.
- Add meta tags / page title: 'Book [Name] on Fetchwork'

### App.js:
- Add lazy import for PublicBookingPage
- Add route: <Route path="/book/:username" element={<PublicBookingPage />} />
- Add route: <Route path="/book/:username/:serviceId" element={<PublicBookingPage />} />

## Feature 2: Cancellation Policy Engine

### Prisma Schema (server/prisma/schema.prisma — add new model):

Add a CancellationPolicyType enum with values: flexible, moderate, strict, custom

Add a CancellationPolicy model with fields:
- id: UUID primary key
- freelancerId: String
- serviceId: String? (null = default for all services)  
- type: CancellationPolicyType, default moderate
- rulesJson: Json, default to empty array
- createdAt/updatedAt timestamps
- Unique constraint on [freelancerId, serviceId]
- Index on [freelancerId]

Predefined tiers:
- flexible: [{hoursBeforeStart: 2, refundPercent: 100}, {hoursBeforeStart: 0, refundPercent: 50}]
- moderate: [{hoursBeforeStart: 24, refundPercent: 100}, {hoursBeforeStart: 12, refundPercent: 50}, {hoursBeforeStart: 0, refundPercent: 0}]
- strict: [{hoursBeforeStart: 48, refundPercent: 100}, {hoursBeforeStart: 24, refundPercent: 50}, {hoursBeforeStart: 0, refundPercent: 0}]

### Backend routes (add to bookings.js):
- PUT /api/bookings/cancellation-policy — auth required (freelancer). Upsert their policy.
- GET /api/bookings/cancellation-policy/:freelancerId — public, no auth. Returns their policy (or default moderate if none set).
- Helper function: calculateRefund(policyId, bookingStartTime) — returns refundPercent based on policy rules + current time. Hook this into the existing cancelBookingSql handler so cancellations auto-calculate refund.

### Frontend:
- CancellationPolicyEditor.js + .css — in freelancer settings area. Radio buttons for flexible/moderate/strict, or toggle to custom mode with editable rules table.
- CancellationPolicyDisplay.js — small component shown on PublicBookingPage and BookingDetail that displays the policy in human-readable format ("Free cancellation up to 24 hours before", etc.)
- In the existing cancel flow (BookingDetail.js), before confirming cancel, show the refund amount based on policy.

## Feature 3: Session Notes

### Prisma Schema (add to schema.prisma):

Add a SessionNote model with fields:
- id: UUID primary key
- bookingId: String (UUID reference)
- occurrenceId: String? (UUID reference, optional)
- authorId: String
- authorRole: String (client or freelancer)
- content: String (text)
- isPrivate: Boolean, default false
- createdAt/updatedAt timestamps
- Indexes on [bookingId, createdAt], [occurrenceId, createdAt], [authorId]

### Backend routes (add to bookings.js):
- POST /api/bookings/:bookingId/notes — auth required. Body: { content, isPrivate?, occurrenceId? }. Only booking participants can add notes.
- GET /api/bookings/:bookingId/notes — auth required. Returns notes visible to the requester (all shared notes + own private notes). Populate author name/avatar from MongoDB User model.
- PUT /api/bookings/:bookingId/notes/:noteId — auth required. Only author can edit.
- DELETE /api/bookings/:bookingId/notes/:noteId — auth required. Only author can delete.

### Frontend:
- SessionNotes.js + .css — panel component added to BookingDetail.js (below existing booking info)
- Shows timeline of notes with author avatar, name, timestamp, content
- Private notes shown with a lock icon, only to the author
- Add note form at bottom: textarea + private toggle + submit button
- Edit/delete buttons on own notes

## GENERAL RULES:
- Run "npx prisma generate" after schema changes (do NOT run migrate — I will do that manually)
- Do NOT modify existing working routes — only ADD new ones
- Use the same patterns as existing code (look at how other routes handle errors, auth, etc.)
- CSS: mobile-first, no * selectors, 44px touch targets
- Commit each feature separately with descriptive messages
- After all 3 features, run "npm run build" in the client directory to verify no build errors (set NODE_OPTIONS=--max-old-space-size=4096)

When completely finished, run this command to notify me:
openclaw system event --text "Done: Built public booking page, cancellation policy engine, and session notes" --mode now
