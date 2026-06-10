/**
 * bookings.js — all booking routes delegate to booking-sql (Prisma/Neon).
 * Mongo is NOT used for booking data. ServiceAdapter still reads the Mongo
 * Service collection for service metadata (title, freelancerId, etc.) which
 * is intentional — the service catalog lives in Mongo.
 */

const express = require('express');
const router  = express.Router();
const { objectIdParam } = require('../middleware/validateObjectId');
router.param('id', objectIdParam);
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { notifyUser, SMS } = require('../services/smsService');
const { requireFeature }    = require('../middleware/entitlements');
const Service               = require('../models/Service'); // service catalog only
const stripeService         = require('../services/stripeService');

// ── Load SQL controller ──────────────────────────────────────────
let ctrl;
let bookingSqlHealthcheck = async () => ({ ok: false, error: 'booking-sql not loaded' });

try {
  ctrl = require('../booking-sql/routes/bookingsSqlController');
  bookingSqlHealthcheck = require('../booking-sql/db/healthcheck').bookingSqlHealthcheck;
} catch (e) {
  console.error('[bookings] FATAL: booking-sql module failed to load:', e.message);
}

function requireSql(handler) {
  return (req, res) => {
    if (!ctrl) {
      return res.status(503).json({ error: 'Booking service unavailable', code: 'SQL_MODULE_NOT_LOADED' });
    }
    return handler(req, res);
  };
}

// ── GET /api/bookings/sql/status ─────────────────────────────────
router.get('/sql/status', authenticateToken, async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ enabled: true, healthy: false, reason: 'DATABASE_URL missing' });
  }
  const health = await bookingSqlHealthcheck();
  if (!health.ok) {
    return res.status(503).json({ enabled: true, healthy: false, reason: health.error || 'db unavailable' });
  }
  return res.json({ enabled: true, healthy: true });
});

// ── PUT /api/bookings/availability/:serviceId ────────────────────
// Freelancer sets/updates availability — writes to SQL only.
// Still reads the Mongo Service doc to validate ownership.
router.put('/availability/:serviceId', authenticateToken, requireFeature('booking_calendar'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (service.freelancer.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your service' });

    const { enabled, timezone, windows, slotDuration, bufferTime, maxAdvanceDays, maxPerSlot } = req.body;

    // Group bookings (maxPerSlot > 1) require Pro
    if (maxPerSlot && maxPerSlot > 1) {
      const { hasFeature } = require('../services/entitlementEngine');
      const canGroup = await hasFeature(req.user._id, 'capacity_controls');
      if (!canGroup) {
        return res.status(403).json({ error: 'Group booking slots require a Pro plan upgrade' });
      }
    }

    const payload = {
      isActive:             enabled !== false,
      timezone:             timezone || 'America/Los_Angeles',
      weeklyScheduleJson:   windows || [],
      defaultSlotDuration:  Number(slotDuration) || 60,
      bufferTime:           Number(bufferTime)    || 0,
      maxAdvanceBookingDays: Number(maxAdvanceDays) || 30,
      defaultCapacity:      Number(maxPerSlot)    || 1,
    };

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    await prisma.freelancerAvailability.upsert({
      where:  { freelancerId: req.user._id.toString() },
      update: payload,
      create: { freelancerId: req.user._id.toString(), ...payload },
    });

    // Keep the Mongo Service doc's booking.enabled flag in sync so other
    // parts of the app (discovery, service cards) know booking is configured.
    service.availability = {
      enabled: payload.isActive,
      timezone: payload.timezone,
    };
    await service.save();

    res.json({ message: 'Availability updated', availability: payload });
  } catch (err) {
    console.error('[availability] PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/availability/:serviceId ────────────────────
// Returns availability config for a service — reads from SQL.
router.get('/availability/:serviceId', async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId)
      .select('freelancer').lean();
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const avail = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId: service.freelancer.toString() },
    });

    if (!avail) return res.json({ availability: { enabled: false } });

    res.json({
      availability: {
        enabled:        avail.isActive,
        timezone:       avail.timezone,
        windows:        avail.weeklyScheduleJson || [],
        slotDuration:   avail.defaultSlotDuration,
        bufferTime:     avail.bufferTime,
        maxAdvanceDays: avail.maxAdvanceBookingDays,
        maxPerSlot:     avail.defaultCapacity,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/slots/:serviceId ───────────────────────────
router.get('/slots/:serviceId', requireSql((...a) => ctrl.getSlotsSql(...a)));

// ── PUBLIC BOOKING PAGE ROUTES (no auth on GETs) ─────────────────
// Must be registered before generic /:serviceId and /:bookingId routes.

// GET /api/bookings/public/:username — freelancer profile + bookable services
router.get('/public/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() })
      .select('_id firstName lastName username profilePicture bio rating totalReviews')
      .lean();
    if (!user) return res.status(404).json({ error: 'Freelancer not found' });

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const avail = await prisma.freelancerAvailability.findUnique({
      where: { freelancerId: user._id.toString() },
    });

    const freelancer = {
      _id:         user._id,
      firstName:   user.firstName,
      lastName:    user.lastName,
      username:    user.username,
      avatar:      user.profilePicture,
      bio:         user.bio,
      rating:      user.rating,
      reviewCount: user.totalReviews,
    };

    if (!avail || !avail.isActive) {
      return res.json({ freelancer, services: [] });
    }

    const services = await Service.find({
      freelancer:             user._id,
      isActive:               true,
      'availability.enabled': true,
    })
      .select('_id title description pricing category')
      .lean();

    res.json({ freelancer, services });
  } catch (err) {
    console.error('[public/:username] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/public/:username/:serviceId/slots?date=YYYY-MM-DD
router.get('/public/:username/:serviceId/slots', requireSql((...a) => ctrl.getSlotsSql(...a)));

// POST /api/bookings/public/:serviceId — auth required; alias for POST /:serviceId
router.post('/public/:serviceId', authenticateToken, requireSql((...a) => ctrl.createBookingHoldSql(...a)));

// ── CANCELLATION POLICY ENGINE ───────────────────────────────────

const PREDEFINED_POLICY_RULES = {
  flexible: [
    { hoursBeforeStart: 2,  refundPercent: 100 },
    { hoursBeforeStart: 0,  refundPercent: 50  },
  ],
  moderate: [
    { hoursBeforeStart: 24, refundPercent: 100 },
    { hoursBeforeStart: 12, refundPercent: 50  },
    { hoursBeforeStart: 0,  refundPercent: 0   },
  ],
  strict: [
    { hoursBeforeStart: 48, refundPercent: 100 },
    { hoursBeforeStart: 24, refundPercent: 50  },
    { hoursBeforeStart: 0,  refundPercent: 0   },
  ],
};

function calculateRefundPercent(rules, bookingStartAt) {
  const hoursUntil = (new Date(bookingStartAt) - Date.now()) / 3600000;
  for (const rule of rules) {
    if (hoursUntil >= rule.hoursBeforeStart) return rule.refundPercent;
  }
  return 0;
}

// PUT /api/bookings/cancellation-policy — upsert freelancer's policy
router.put('/cancellation-policy', authenticateToken, async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const freelancerId = req.user._id.toString();
    const { type, serviceId, rulesJson } = req.body;

    if (!['flexible', 'moderate', 'strict', 'custom'].includes(type)) {
      return res.status(400).json({ error: 'Invalid policy type' });
    }

    const rules = type === 'custom'
      ? (Array.isArray(rulesJson) ? rulesJson : [])
      : PREDEFINED_POLICY_RULES[type];

    const existing = await prisma.cancellationPolicy.findFirst({
      where: { freelancerId, serviceId: serviceId || null },
    });

    let policy;
    if (existing) {
      policy = await prisma.cancellationPolicy.update({
        where: { id: existing.id },
        data:  { type, rulesJson: rules },
      });
    } else {
      policy = await prisma.cancellationPolicy.create({
        data: { freelancerId, serviceId: serviceId || null, type, rulesJson: rules },
      });
    }

    res.json({ policy });
  } catch (err) {
    console.error('[cancellation-policy] PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/cancellation-policy/:freelancerId — public; returns policy or moderate default
router.get('/cancellation-policy/:freelancerId', async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const { freelancerId } = req.params;
    const { serviceId } = req.query;

    // Try service-specific first, then freelancer-wide default
    let policy = null;
    if (serviceId) {
      policy = await prisma.cancellationPolicy.findFirst({
        where: { freelancerId, serviceId },
      });
    }
    if (!policy) {
      policy = await prisma.cancellationPolicy.findFirst({
        where: { freelancerId, serviceId: null },
      });
    }

    if (!policy) {
      return res.json({
        policy: { type: 'moderate', rulesJson: PREDEFINED_POLICY_RULES.moderate },
      });
    }

    // Merge predefined rules for non-custom types so caller always gets the rules
    const rulesJson = policy.type !== 'custom'
      ? PREDEFINED_POLICY_RULES[policy.type]
      : policy.rulesJson;

    res.json({ policy: { ...policy, rulesJson } });
  } catch (err) {
    console.error('[cancellation-policy] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings/:serviceId — create hold ──────────────────
router.post('/:serviceId', authenticateToken, requireSql((...a) => ctrl.createBookingHoldSql(...a)));

// ── GET /api/bookings/me ─────────────────────────────────────────
router.get('/me', authenticateToken, requireSql((...a) => ctrl.getMyBookingsSql(...a)));

// ── GET /api/bookings/:bookingId ─────────────────────────────────
router.get('/:bookingId', authenticateToken, requireSql((...a) => ctrl.getBookingByIdSql(...a)));

// ── PATCH /api/bookings/:bookingId/confirm ───────────────────────
router.patch('/:bookingId/confirm', authenticateToken, requireSql((...a) => ctrl.confirmBookingSql(...a)));

// ── PATCH /api/bookings/:bookingId/reschedule ────────────────────
router.patch('/:bookingId/reschedule', authenticateToken, requireSql((...a) => ctrl.rescheduleBookingSql(...a)));

// ── PATCH /api/bookings/:bookingId/cancel ────────────────────────
router.patch('/:bookingId/cancel', authenticateToken, requireSql((...a) => ctrl.cancelBookingSql(...a)));

// ── PATCH /api/bookings/:bookingId/complete ──────────────────────
router.patch('/:bookingId/complete', authenticateToken, requireSql((...a) => ctrl.completeBookingSql(...a)));

// ── POST /api/bookings/:bookingId/payment-intent ─────────────────
// Creates a Stripe PaymentIntent for the booking amount.
// Client uses returned clientSecret to present PaymentSheet.
router.post('/:bookingId/payment-intent', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const actorId = String(req.user?._id);

    const { getPrisma } = require('../booking-sql/db/client');
    const db = getPrisma();

    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId) return res.status(403).json({ error: 'Not authorized' });
    if (!['held', 'pending_payment'].includes(booking.currentState)) {
      return res.status(409).json({ error: `Cannot charge booking in state: ${booking.currentState}` });
    }

    const pricing = booking.pricingSnapshotJson || {};
    const amountCents = Number(pricing.amountCents || 0);
    if (amountCents < 50) {
      // Under $0.50 — treat as free, auto-confirm without payment
      await db.booking.update({ where: { id: bookingId }, data: { currentState: 'confirmed' } });
      await db.bookingOccurrence.updateMany({ where: { bookingId }, data: { status: 'confirmed' } });
      return res.json({ free: true, confirmed: true });
    }

    // Check for existing pending ChargeRecord to avoid double-charging
    const existing = await db.chargeRecord.findFirst({
      where: { bookingId, state: { in: ['intent_created', 'captured'] } },
    });
    if (existing?.state === 'captured') {
      return res.json({ alreadyPaid: true, confirmed: true });
    }

    const pi = await stripeService.createPaymentIntent({
      amount:   amountCents,
      currency: pricing.currency || 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { type: 'booking_payment', bookingId, bookingRef: booking.bookingRef, userId: actorId },
    });

    // Record the intent
    await db.chargeRecord.upsert({
      where:  { stripePaymentIntentId: pi.id },
      create: {
        bookingId,
        stripePaymentIntentId: pi.id,
        amountCents,
        currency: pricing.currency || 'usd',
        state:    'intent_created',
        idempotencyKey: pi.id,
      },
      update: { state: 'intent_created' },
    });

    return res.json({ clientSecret: pi.client_secret, amountCents });
  } catch (err) {
    console.error('[booking payment-intent]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings/:bookingId/confirm-payment ─────────────────
// Called after client confirms payment via PaymentSheet.
// Verifies PI succeeded → auto-confirms booking → notifies freelancer.
router.post('/:bookingId/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

    const actorId = String(req.user?._id);

    const { getPrisma } = require('../booking-sql/db/client');
    const db = getPrisma();

    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId) return res.status(403).json({ error: 'Not authorized' });

    // Verify with Stripe
    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment not complete', status: pi.status });
    }

    // Mark ChargeRecord as captured
    await db.chargeRecord.updateMany({
      where: { bookingId, stripePaymentIntentId: paymentIntentId },
      data:  { state: 'captured', stripeChargeId: pi.latest_charge || null },
    });

    // Auto-confirm booking
    await db.booking.update({ where: { id: bookingId }, data: { currentState: 'confirmed' } });
    await db.bookingOccurrence.updateMany({ where: { bookingId }, data: { status: 'confirmed' } });

    // Notify freelancer
    try {
      const occ = await db.bookingOccurrence.findFirst({ where: { bookingId }, orderBy: { occurrenceNo: 'asc' } });
      const { BookingNotificationService } = require('../booking-sql/services/BookingNotificationService');
      const notifySvc = new BookingNotificationService();
      await notifySvc.onConfirmed({
        bookingId,
        bookingRef:   booking.bookingRef,
        clientId:     booking.clientId,
        freelancerId: booking.freelancerId,
        serviceTitle: 'Service',
        date:         occ?.localStartWallclock?.split('T')[0] || '',
        startTime:    occ?.localStartWallclock?.split('T')[1]?.slice(0, 5) || '',
      });
    } catch (_) {}

    // SMS: notify client (booking confirmed) and freelancer
    try {
      const occ2 = await db.bookingOccurrence.findFirst({ where: { bookingId }, orderBy: { occurrenceNo: 'asc' } });
      const dateStr = occ2?.localStartWallclock?.split('T')[0] || '';
      const [client, freelancer] = await Promise.all([
        User.findById(booking.clientId).select('phone preferences firstName'),
        User.findById(booking.freelancerId).select('phone preferences firstName'),
      ]);
      if (client) notifyUser(client, 'bookingReminders', SMS.bookingConfirmed('your booking', dateStr)).catch(() => {});
      if (freelancer) notifyUser(freelancer, 'bookingReminders', SMS.bookingConfirmed('your booking', dateStr)).catch(() => {});
    } catch (_) {}

    return res.json({ success: true, confirmed: true });
  } catch (err) {
    console.error('[booking confirm-payment]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GROUP BOOKING ROUTES ─────────────────────────────────────────
router.post  ('/group/slots',                                  authenticateToken, requireSql((...a) => ctrl.createGroupSlot(...a)));
router.get   ('/group/slots/:serviceId',                       authenticateToken, requireSql((...a) => ctrl.getGroupSlots(...a)));
router.get   ('/group/slots/:slotId/detail',                   authenticateToken, requireSql((...a) => ctrl.getGroupSlotDetail(...a)));
router.post  ('/group/slots/:slotId/book',                     authenticateToken, requireSql((...a) => ctrl.bookGroupSeats(...a)));
router.patch ('/group/participants/:participantId/confirm',     authenticateToken, requireSql((...a) => ctrl.confirmGroupBooking(...a)));
router.patch ('/group/participants/:participantId/cancel',      authenticateToken, requireSql((...a) => ctrl.cancelGroupBooking(...a)));
router.post  ('/group/slots/:slotId/waitlist',                 authenticateToken, requireSql((...a) => ctrl.joinGroupWaitlist(...a)));
router.delete('/group/slots/:slotId/waitlist',                 authenticateToken, requireSql((...a) => ctrl.leaveGroupWaitlist(...a)));
router.get   ('/group/slots/:slotId/waitlist/position',        authenticateToken, requireSql((...a) => ctrl.getGroupWaitlistPosition(...a)));
router.post  ('/group/waitlist/:waitlistId/accept',            authenticateToken, requireSql((...a) => ctrl.acceptWaitlistPromotion(...a)));

// ── ATTENDANCE ROUTES ─────────────────────────────────────────────
router.post  ('/:bookingId/occurrences/:occurrenceId/checkin',    authenticateToken, requireSql((...a) => ctrl.attendanceCheckin(...a)));
router.post  ('/:bookingId/occurrences/:occurrenceId/checkout',   authenticateToken, requireSql((...a) => ctrl.attendanceCheckout(...a)));
router.post  ('/:bookingId/occurrences/:occurrenceId/no-show',    authenticateToken, requireSql((...a) => ctrl.markNoShow(...a)));
router.post  ('/:bookingId/occurrences/:occurrenceId/dispute',    authenticateToken, requireSql((...a) => ctrl.flagAttendanceDispute(...a)));
router.get   ('/:bookingId/occurrences/:occurrenceId/attendance', authenticateToken, requireSql((...a) => ctrl.getAttendanceRecord(...a)));
router.patch ('/:bookingId/occurrences/:occurrenceId/attendance/resolve', authenticateToken, requireSql((...a) => ctrl.adminResolveAttendance(...a)));

// ── RECURRING SERIES ROUTES ───────────────────────────────────────
router.post  ('/:bookingId/series',                          authenticateToken, requireSql((...a) => ctrl.createRecurringSeries(...a)));
router.get   ('/:bookingId/series/:seriesId',                authenticateToken, requireSql((...a) => ctrl.getRecurringSeries(...a)));
router.patch ('/:bookingId/series/:seriesId/skip',           authenticateToken, requireSql((...a) => ctrl.skipSeriesOccurrence(...a)));
router.patch ('/:bookingId/series/:seriesId/cancel-from',    authenticateToken, requireSql((...a) => ctrl.cancelSeriesFromDate(...a)));
router.delete('/:bookingId/series/:seriesId',                authenticateToken, requireSql((...a) => ctrl.cancelEntireSeries(...a)));
router.patch ('/:bookingId/series/:seriesId/pause',          authenticateToken, requireSql((...a) => ctrl.pauseRecurringSeries(...a)));
router.patch ('/:bookingId/series/:seriesId/resume',         authenticateToken, requireSql((...a) => ctrl.resumeRecurringSeries(...a)));

// ── AUDIT ROUTES (admin) ──────────────────────────────────────────
router.get   ('/audit/events',                      authenticateToken, requireSql((...a) => ctrl.queryAuditEvents(...a)));
router.get   ('/audit/stats',                       authenticateToken, requireSql((...a) => ctrl.getAuditStats(...a)));
router.get   ('/audit/events/:eventId/verify',      authenticateToken, requireSql((...a) => ctrl.verifyAuditIntegrity(...a)));
router.get   ('/:bookingId/timeline',               authenticateToken, requireSql((...a) => ctrl.getBookingTimeline(...a)));
router.post  ('/:bookingId/timeline/admin-override', authenticateToken, requireSql((...a) => ctrl.recordAdminOverride(...a)));
router.get   ('/:bookingId/audit/dispute-evidence', authenticateToken, requireSql((...a) => ctrl.getDisputeEvidence(...a)));

// ── CANCELLATION REFUND PREVIEW ───────────────────────────────────
// GET /api/bookings/:bookingId/cancellation-preview — returns refund estimate
router.get('/:bookingId/cancellation-preview', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const actorId = req.user._id.toString();

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const booking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: { occurrences: { orderBy: { occurrenceNo: 'asc' }, take: 1 } },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId && booking.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const occ = booking.occurrences[0];
    const startAt = occ?.startAtUtc || booking.createdAt;

    // Find policy (service-specific or freelancer default)
    const policy = await prisma.cancellationPolicy.findFirst({
      where: { freelancerId: booking.freelancerId, serviceId: null },
    });

    const policyType = policy?.type || 'moderate';
    const rules = (policy && policy.type === 'custom')
      ? policy.rulesJson
      : PREDEFINED_POLICY_RULES[policyType] || PREDEFINED_POLICY_RULES.moderate;

    const refundPercent = calculateRefundPercent(rules, startAt);
    const totalCents    = Number(booking.pricingSnapshotJson?.amountCents || 0);
    const refundCents   = Math.round(totalCents * refundPercent / 100);

    res.json({ refundPercent, refundCents, totalCents, policyType });
  } catch (err) {
    console.error('[cancellation-preview] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SESSION NOTES ROUTES ──────────────────────────────────────────

// POST /api/bookings/:bookingId/notes — add a note
router.post('/:bookingId/notes', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { content, isPrivate, occurrenceId } = req.body;
    const actorId = req.user._id.toString();

    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId && booking.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not a booking participant' });
    }

    const authorRole = booking.freelancerId === actorId ? 'freelancer' : 'client';

    const note = await prisma.sessionNote.create({
      data: {
        bookingId,
        occurrenceId: occurrenceId || null,
        authorId:     actorId,
        authorRole,
        content:      content.trim(),
        isPrivate:    Boolean(isPrivate),
      },
    });

    const author = await User.findById(actorId).select('firstName lastName profilePicture').lean();
    res.status(201).json({
      note: {
        ...note,
        author: author ? {
          _id: author._id, firstName: author.firstName,
          lastName: author.lastName, avatar: author.profilePicture,
        } : null,
      },
    });
  } catch (err) {
    console.error('[session-notes] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:bookingId/notes — list notes visible to requester
router.get('/:bookingId/notes', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const actorId = req.user._id.toString();

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId && booking.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not a booking participant' });
    }

    const notes = await prisma.sessionNote.findMany({
      where: {
        bookingId,
        OR: [{ isPrivate: false }, { authorId: actorId }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const authorIds = [...new Set(notes.map(n => n.authorId))];
    const authors   = await User.find({ _id: { $in: authorIds } })
      .select('_id firstName lastName profilePicture').lean();
    const authorMap = Object.fromEntries(authors.map(a => [a._id.toString(), a]));

    const populated = notes.map(n => {
      const a = authorMap[n.authorId];
      return {
        ...n,
        author: a ? { _id: a._id, firstName: a.firstName, lastName: a.lastName, avatar: a.profilePicture } : null,
      };
    });

    res.json({ notes: populated });
  } catch (err) {
    console.error('[session-notes] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:bookingId/notes/:noteId — edit own note
router.put('/:bookingId/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { bookingId, noteId } = req.params;
    const { content, isPrivate } = req.body;
    const actorId = req.user._id.toString();

    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const note = await prisma.sessionNote.findUnique({ where: { id: noteId } });
    if (!note || note.bookingId !== bookingId) return res.status(404).json({ error: 'Note not found' });
    if (note.authorId !== actorId) return res.status(403).json({ error: 'Can only edit your own notes' });

    const updated = await prisma.sessionNote.update({
      where: { id: noteId },
      data: {
        content:   content.trim(),
        isPrivate: isPrivate !== undefined ? Boolean(isPrivate) : note.isPrivate,
      },
    });

    res.json({ note: updated });
  } catch (err) {
    console.error('[session-notes] PUT error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:bookingId/notes/:noteId — delete own note
router.delete('/:bookingId/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { bookingId, noteId } = req.params;
    const actorId = req.user._id.toString();

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    const note = await prisma.sessionNote.findUnique({ where: { id: noteId } });
    if (!note || note.bookingId !== bookingId) return res.status(404).json({ error: 'Note not found' });
    if (note.authorId !== actorId) return res.status(403).json({ error: 'Can only delete your own notes' });

    await prisma.sessionNote.delete({ where: { id: noteId } });

    res.json({ deleted: true });
  } catch (err) {
    console.error('[session-notes] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── MULTI-SERVICE BOOKING ROUTES ──────────────────────────────────────────────

const MULTI_HOLD_MINUTES = 30;

function generateBookingRef() {
  const { randomBytes } = require('crypto');
  return 'MS' + Date.now().toString(36).toUpperCase().slice(-5) + randomBytes(2).toString('hex').toUpperCase();
}

function toUtcDate(date, time, timezone) {
  const { DateTime } = require('luxon');
  const dt = DateTime.fromISO(`${date}T${time}:00`, { zone: timezone });
  if (!dt.isValid) throw new Error(`Invalid date/time: ${date} ${time} in ${timezone}`);
  return dt.toUTC().toJSDate();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// POST /api/bookings/multi — create multi-service booking
router.post('/multi', authenticateToken, async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const { freelancerId, serviceIds, date, startTime, timezone, notes } = req.body;
    const clientId = req.user._id.toString();

    if (!freelancerId || !Array.isArray(serviceIds) || serviceIds.length < 2) {
      return res.status(400).json({ error: 'freelancerId and at least 2 serviceIds are required' });
    }
    if (!date || !startTime) return res.status(400).json({ error: 'date and startTime are required' });
    const tz = timezone || 'America/Los_Angeles';

    // Validate all services belong to this freelancer
    const services = await Service.find({ _id: { $in: serviceIds }, freelancer: freelancerId }).lean();
    if (services.length !== serviceIds.length) {
      return res.status(400).json({ error: 'One or more services not found or do not belong to this freelancer' });
    }

    // Get freelancer availability for slot durations
    const freelancerAvail = await prisma.freelancerAvailability.findUnique({
      where:   { freelancerId },
      include: { serviceOverrides: { where: { serviceId: { in: serviceIds.map(String) } } } },
    });

    const defaultDuration = freelancerAvail?.defaultSlotDuration || 60;
    const svcPricing = services.map(svc => {
      const override = freelancerAvail?.serviceOverrides?.find(o => o.serviceId === String(svc._id));
      const duration = override?.slotDuration || defaultDuration;
      const priceDollars = svc.pricing?.basic?.price || svc.pricing?.amount || 0;
      return {
        serviceId:    svc._id.toString(),
        title:        svc.title,
        duration,
        priceCents:   Math.round(Number(priceDollars) * 100),
      };
    });

    // Stack services sequentially
    let curStart = toUtcDate(date, startTime, tz);
    const bookingIds = [];
    const holdExpiresAt = addMinutes(new Date(), MULTI_HOLD_MINUTES);

    for (const svc of svcPricing) {
      const curEnd = addMinutes(curStart, svc.duration);
      const localStart = `${date}T${new Date(curStart).toISOString().slice(11, 16)}`;
      const localEnd   = `${date}T${new Date(curEnd).toISOString().slice(11, 16)}`;

      const booking = await prisma.booking.create({
        data: {
          bookingRef:         generateBookingRef(),
          clientId,
          freelancerId,
          policySnapshotJson: { type: 'moderate' },
          pricingSnapshotJson: {
            amountCents:  svc.priceCents,
            currency:     'usd',
            serviceTitle: svc.title,
          },
          currentState: 'held',
          holdExpiresAt,
          notes: notes || null,
        },
      });

      await prisma.bookingOccurrence.create({
        data: {
          bookingId:           booking.id,
          occurrenceNo:        1,
          clientId,
          freelancerId,
          startAtUtc:          curStart,
          endAtUtc:            curEnd,
          timezone:            tz,
          localStartWallclock: localStart,
          localEndWallclock:   localEnd,
          status:              'held',
        },
      });

      bookingIds.push(booking.id);
      curStart = curEnd;
    }

    const totalDurationMinutes = svcPricing.reduce((s, x) => s + x.duration, 0);
    const totalPriceCents      = svcPricing.reduce((s, x) => s + x.priceCents, 0);
    const combinedStartAtUtc   = toUtcDate(date, startTime, tz);
    const combinedEndAtUtc     = addMinutes(combinedStartAtUtc, totalDurationMinutes);

    const multi = await prisma.multiServiceBooking.create({
      data: {
        clientId,
        freelancerId,
        bookingIds,
        totalDurationMinutes,
        totalPriceCents,
        combinedStartAtUtc,
        combinedEndAtUtc,
        timezone: tz,
        status:   'pending',
        notes:    notes || null,
      },
    });

    res.status(201).json({ multiBooking: multi, bookingIds });
  } catch (err) {
    console.error('[bookings/multi] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/multi/me — list user's multi-service bookings
router.get('/multi/me', authenticateToken, async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const actorId = req.user._id.toString();

    const multiBookings = await prisma.multiServiceBooking.findMany({
      where:   { OR: [{ clientId: actorId }, { freelancerId: actorId }] },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ multiBookings });
  } catch (err) {
    console.error('[bookings/multi/me] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/multi/:multiBookingId — get one multi-booking with bookings populated
router.get('/multi/:multiBookingId', authenticateToken, async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const actorId = req.user._id.toString();
    const { multiBookingId } = req.params;

    const multi = await prisma.multiServiceBooking.findUnique({ where: { id: multiBookingId } });
    if (!multi) return res.status(404).json({ error: 'Multi-service booking not found' });
    if (multi.clientId !== actorId && multi.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const bookings = await prisma.booking.findMany({
      where:   { id: { in: multi.bookingIds } },
      include: { occurrences: { orderBy: { occurrenceNo: 'asc' } } },
    });

    res.json({ multiBooking: multi, bookings });
  } catch (err) {
    console.error('[bookings/multi/:id] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bookings/multi/:multiBookingId/cancel — cancel all individual bookings
router.patch('/multi/:multiBookingId/cancel', authenticateToken, async (req, res) => {
  try {
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const actorId = req.user._id.toString();
    const { multiBookingId } = req.params;

    const multi = await prisma.multiServiceBooking.findUnique({ where: { id: multiBookingId } });
    if (!multi) return res.status(404).json({ error: 'Multi-service booking not found' });
    if (multi.clientId !== actorId && multi.freelancerId !== actorId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const cancelledBy = actorId === multi.clientId ? 'cancelled_by_client' : 'cancelled_by_freelancer';

    await prisma.booking.updateMany({
      where: { id: { in: multi.bookingIds } },
      data:  { currentState: cancelledBy },
    });

    await prisma.bookingOccurrence.updateMany({
      where: { bookingId: { in: multi.bookingIds } },
      data:  { status: cancelledBy },
    });

    await prisma.multiServiceBooking.update({
      where: { id: multiBookingId },
      data:  { status: 'cancelled' },
    });

    res.json({ cancelled: true });
  } catch (err) {
    console.error('[bookings/multi/cancel] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


