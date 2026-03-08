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
const { requireFeature }    = require('../middleware/entitlements');
const Service               = require('../models/Service'); // service catalog only

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
    if (service.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your service' });

    const { enabled, timezone, windows, slotDuration, bufferTime, maxAdvanceDays, maxPerSlot } = req.body;

    // Group bookings (maxPerSlot > 1) require Pro
    if (maxPerSlot && maxPerSlot > 1) {
      const { hasFeature } = require('../services/entitlementEngine');
      const canGroup = await hasFeature(req.user.userId, 'capacity_controls');
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
      where:  { freelancerId: req.user.userId.toString() },
      update: payload,
      create: { freelancerId: req.user.userId.toString(), ...payload },
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
    const actorId = String(req.user?.userId || req.user?._id);

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

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.create({
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

    const actorId = String(req.user?.userId || req.user?._id);

    const { getPrisma } = require('../booking-sql/db/client');
    const db = getPrisma();

    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== actorId) return res.status(403).json({ error: 'Not authorized' });

    // Verify with Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
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

module.exports = router;


