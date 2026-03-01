# Task: MVP Booking Calendar

Build an MVP booking calendar system for Fetchwork. This is a freelance marketplace with React frontend + Express/Node backend + MongoDB.

## What to Build

### 1. Backend — Availability Schema on Service Model

Add to `server/models/Service.js`:
```js
availability: {
  enabled: { type: Boolean, default: false },
  timezone: { type: String, default: 'America/Los_Angeles' },
  windows: [{
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0=Sunday
    startTime: { type: String }, // "09:00" (24hr)
    endTime: { type: String },   // "17:00"
  }],
  slotDuration: { type: Number, default: 60 }, // minutes
  bufferTime: { type: Number, default: 0 },    // minutes between slots
  maxAdvanceDays: { type: Number, default: 30 }, // how far ahead clients can book
}
```

### 2. Backend — Booking Model

Create `server/models/Booking.js`:
- service (ref Service)
- client (ref User)
- freelancer (ref User)
- date (Date — the calendar date)
- startTime (String — "09:00")
- endTime (String — "10:00")
- status: enum ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']
- notes (String — client message)
- cancellationReason (String)
- cancelledBy (ref User)
- cancelledAt (Date)
- createdAt, updatedAt

Indexes: { service: 1, date: 1 }, { freelancer: 1, date: 1 }, { client: 1, status: 1 }

### 3. Backend — Routes (`server/routes/bookings.js`)

All routes need `authenticateToken` from `server/middleware/auth.js`. The auth middleware sets `req.user` with `userId` (NOT `_id`). Always use `req.user.userId` for user identification.

Feature gate: use `requireFeature('booking_calendar')` from `server/middleware/entitlements.js` on freelancer-only routes (setting availability). Client booking routes should NOT be gated.

Routes:
- `PUT /api/bookings/availability/:serviceId` — freelancer sets/updates availability windows (gated)
- `GET /api/bookings/availability/:serviceId` — public, returns availability config
- `GET /api/bookings/slots/:serviceId?date=YYYY-MM-DD` — public, returns available time slots for a date (computes from windows minus existing bookings)
- `POST /api/bookings/:serviceId` — client books a slot { date, startTime, endTime, notes }
- `GET /api/bookings/me?role=client|freelancer&status=upcoming|past|cancelled` — get my bookings
- `PATCH /api/bookings/:bookingId/confirm` — freelancer confirms pending booking
- `PATCH /api/bookings/:bookingId/cancel` — either party cancels { reason }
- `PATCH /api/bookings/:bookingId/complete` — freelancer marks complete

Mount in `server/index.js` as: `app.use('/api/bookings', require('./routes/bookings'));`
Place the mount AFTER the auth routes but BEFORE error handlers. Look at existing route mounts in index.js for placement.

### 4. Frontend — Freelancer Availability Manager

Create `client/src/components/Bookings/AvailabilityManager.js` + CSS

This goes in the freelancer's service edit flow or as a standalone page at `/services/:id/availability`.

UI:
- Weekly grid showing Mon-Sun with time slots
- Click to add availability windows (start time, end time per day)
- Slot duration picker (30min, 45min, 60min, 90min, 120min)
- Buffer time picker (0, 15, 30 min)
- Max advance days input
- Timezone display (auto-detect from browser)
- Save button → PUT /api/bookings/availability/:serviceId

### 5. Frontend — Client Booking Flow

Create `client/src/components/Bookings/BookingCalendar.js` + CSS

This appears on the ServiceDetails page when the service has `availability.enabled = true`.

UI:
- Date picker (calendar grid showing next N days based on maxAdvanceDays)
- Available slots grid for selected date (fetched from GET /api/bookings/slots/:serviceId?date=...)
- Slot selection → "Book This Time" button
- Notes field (optional)
- Confirm → POST /api/bookings/:serviceId

### 6. Frontend — My Bookings Page

Create `client/src/components/Bookings/MyBookings.js` + CSS

Tabs: Upcoming | Past | Cancelled
Each booking card shows: service name, date, time, other party name, status badge, cancel/confirm buttons

Register route in `client/src/App.js` as `/bookings` (lazy loaded, ProtectedRoute).

### 7. Wire into ServiceDetails

In `client/src/components/Services/ServiceDetails.js`, after the order/subscribe section, add a BookingCalendar component if `service.availability?.enabled`.

Import: `import BookingCalendar from '../Bookings/BookingCalendar';`

## Key Rules

- **NEVER use `req.user._id`** — use `req.user.userId`. The auth middleware sets `userId`.
- **ObjectId comparisons must use `.toString()`** on both sides
- **Mobile-first CSS**: base at 360px, `min-width` media queries only, 44px touch targets
- **Use CSS variables** from the existing theme (--primary, --bg-card, --border-color, --text-muted, etc.) — look at any existing CSS file for patterns
- **Error handling**: try/catch on all routes, return proper HTTP status codes
- **Notifications**: when a booking is created/confirmed/cancelled, create a notification:
  ```js
  const Notification = require('../models/Notification');
  await Notification.create({
    recipient: userId,
    title: 'New Booking',
    message: 'You have a new booking for ...',
    link: '/bookings',
    type: 'booking',
  });
  ```
- **Do NOT modify existing files** except: Service.js (add availability field), ServiceDetails.js (add BookingCalendar), App.js (add route), index.js (mount route)
- Syntax check all files with `node --check <file>` before finishing
- After all files are created, run: `cd client && npx react-scripts build` to verify no build errors

## File Structure
```
server/models/Booking.js          — NEW
server/routes/bookings.js         — NEW  
server/models/Service.js          — MODIFY (add availability schema)
server/index.js                   — MODIFY (mount booking routes)
client/src/components/Bookings/   — NEW directory
  AvailabilityManager.js          — NEW
  AvailabilityManager.css         — NEW
  BookingCalendar.js              — NEW
  BookingCalendar.css             — NEW
  MyBookings.js                   — NEW
  MyBookings.css                  — NEW
client/src/components/Services/ServiceDetails.js — MODIFY (add BookingCalendar)
client/src/App.js                 — MODIFY (add /bookings route)
```
