/**
 * sessions.js — API routes for the unified session/scheduling system.
 *
 * Routes delegate to SessionService for all business logic.
 * Auth patterns match existing codebase (authenticateToken, req.user).
 *
 * Route categories:
 *   /templates/*         — freelancer-authenticated (manage own templates)
 *   /occurrences/service — public (client-facing, safe fields only)
 *   /occurrences/mine    — freelancer-authenticated (dashboard)
 *   /occurrences/:id/*   — freelancer-authenticated (manage own occurrences)
 *   /book                — client-authenticated (book a seat)
 *   /my-bookings         — client-authenticated (view own session bookings)
 *   /bookings/:id/cancel — client-authenticated (cancel own booking)
 *   /generate            — admin/cron-protected (trigger occurrence generation)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const SessionService = require('../services/SessionService');

// ─── Template Management (freelancer-authenticated) ─────────────────────────

/**
 * POST /api/sessions/templates
 * Create a new session template.
 * Body: { mongoServiceId, title, capacityType, scheduleType, maxCapacity,
 *         durationMinutes, price, currency, locationMode, locationAddress,
 *         locationNotes, recurrenceRule, generationWeeks,
 *         bookingCutoffHours, cancellationHours }
 */
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();

    // Verify the service belongs to this freelancer
    const Service = require('../models/Service');
    const service = await Service.findById(req.body.mongoServiceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (service.freelancerId.toString() !== freelancerId) {
      return res.status(403).json({ error: 'You can only create templates for your own services' });
    }

    const template = await SessionService.createTemplate({
      ...req.body,
      freelancerId,
    });

    res.status(201).json(template);
  } catch (err) {
    console.error('[sessions] POST /templates error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/templates
 * List the authenticated freelancer's templates.
 * Query: ?serviceId=<mongoId>&activeOnly=true
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    const templates = await SessionService.listTemplates(freelancerId, {
      mongoServiceId: req.query.serviceId || undefined,
      activeOnly: req.query.activeOnly !== 'false',
    });
    res.json(templates);
  } catch (err) {
    console.error('[sessions] GET /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/templates/:id
 * Get a single template. Freelancer must own it.
 */
router.get('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = await SessionService.getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const freelancerId = req.user._id.toString();
    if (template.freelancerId !== freelancerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(template);
  } catch (err) {
    console.error('[sessions] GET /templates/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/sessions/templates/:id
 * Update a template. Freelancer must own it.
 * Body: any updatable template fields (title, maxCapacity, etc.)
 */
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    const template = await SessionService.updateTemplate(req.params.id, freelancerId, req.body);
    res.json(template);
  } catch (err) {
    const status = err.message === 'Not authorized' ? 403
      : err.message === 'Template not found' ? 404 : 400;
    console.error('[sessions] PUT /templates/:id error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/templates/:id/deactivate
 * Deactivate a template. Stops future generation, cancels unbooked occurrences.
 */
router.post('/templates/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    await SessionService.deactivateTemplate(req.params.id, freelancerId);
    res.json({ ok: true, message: 'Template deactivated' });
  } catch (err) {
    const status = err.message === 'Not authorized' ? 403
      : err.message === 'Template not found' ? 404 : 400;
    console.error('[sessions] POST /templates/:id/deactivate error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/templates/:id/generate
 * Manually trigger occurrence generation for one template.
 * Freelancer must own it. Useful after creating/updating a template.
 */
router.post('/templates/:id/generate', authenticateToken, async (req, res) => {
  try {
    // Verify ownership
    const template = await SessionService.getTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const freelancerId = req.user._id.toString();
    if (template.freelancerId !== freelancerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await SessionService.generateOccurrences(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[sessions] POST /templates/:id/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Occurrence Queries ─────────────────────────────────────────────────────

/**
 * GET /api/sessions/occurrences/service/:serviceId
 * Public: list upcoming occurrences for a service (client booking view).
 * Returns safe fields only — no freelancer internal data.
 * Query: ?limit=20&after=<ISO date>
 */
router.get('/occurrences/service/:serviceId', async (req, res) => {
  try {
    const occurrences = await SessionService.getUpcomingByService(req.params.serviceId, {
      limit: parseInt(req.query.limit) || 20,
      after: req.query.after ? new Date(req.query.after) : undefined,
    });

    // Strip internal fields for public response
    const safe = occurrences.map(o => ({
      id: o.id,
      startTime: o.startTime,
      endTime: o.endTime,
      maxCapacity: o.maxCapacity,
      bookedCount: o.bookedCount,
      spotsLeft: o.maxCapacity - o.bookedCount,
      status: o.status,
      title: o.template?.title || null,
      price: o.template?.price != null ? Number(o.template.price) : null,
      currency: o.template?.currency || 'usd',
      durationMinutes: o.template?.durationMinutes || null,
      locationMode: o.template?.locationMode || null,
      locationAddress: o.template?.locationAddress || null,
      bookingCutoffHours: o.template?.bookingCutoffHours || null,
      cancellationHours: o.template?.cancellationHours || null,
    }));

    res.json(safe);
  } catch (err) {
    console.error('[sessions] GET /occurrences/service/:serviceId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/occurrences/mine
 * Freelancer dashboard: upcoming occurrences with booking counts.
 * Query: ?limit=50&after=<ISO date>
 */
router.get('/occurrences/mine', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    const occurrences = await SessionService.getUpcomingByFreelancer(freelancerId, {
      limit: parseInt(req.query.limit) || 50,
      after: req.query.after ? new Date(req.query.after) : undefined,
    });
    res.json(occurrences);
  } catch (err) {
    console.error('[sessions] GET /occurrences/mine error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/occurrences/:id/bookings
 * Freelancer views who booked a specific occurrence.
 */
router.get('/occurrences/:id/bookings', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    const bookings = await SessionService.getOccurrenceBookings(req.params.id, freelancerId);
    res.json(bookings);
  } catch (err) {
    const status = err.message === 'Not authorized' ? 403
      : err.message === 'Occurrence not found' ? 404 : 500;
    console.error('[sessions] GET /occurrences/:id/bookings error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/occurrences/:id/cancel
 * Freelancer cancels an occurrence. All active bookings are cancelled.
 * Body: { reason?: string }
 */
router.post('/occurrences/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const freelancerId = req.user._id.toString();
    const result = await SessionService.cancelOccurrence(
      req.params.id,
      freelancerId,
      req.body.reason,
    );
    res.json({
      ok: true,
      cancelledBookings: result.cancelledBookings,
      message: `Occurrence cancelled. ${result.cancelledBookings} booking(s) affected.`,
    });
  } catch (err) {
    const status = err.message === 'Not authorized' ? 403
      : err.message === 'Occurrence not found' ? 404
      : err.message === 'Already cancelled' ? 409 : 400;
    console.error('[sessions] POST /occurrences/:id/cancel error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

// ─── Client Booking ─────────────────────────────────────────────────────────

/**
 * POST /api/sessions/book
 * Book seat(s) in a session occurrence.
 * Body: { occurrenceId, seats? }
 *
 * Payment safety:
 *   - Free sessions (price == 0 or null): confirmed immediately
 *   - Paid sessions: returns { paymentRequired: true } with occurrence/price info
 *     Payment finalization handled in a later gate with Stripe PaymentIntent
 */
router.post('/book', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user._id.toString();
    const { occurrenceId, seats } = req.body;

    if (!occurrenceId) return res.status(400).json({ error: 'occurrenceId is required' });

    // Look up the occurrence to check price
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const occurrence = await prisma.sessionOccurrence.findUnique({
      where: { id: occurrenceId },
      include: { template: { select: { price: true, currency: true, title: true } } },
    });

    if (!occurrence) return res.status(404).json({ error: 'Session not found' });

    const price = occurrence.priceOverride != null
      ? Number(occurrence.priceOverride)
      : (occurrence.template?.price != null ? Number(occurrence.template.price) : 0);

    // Payment safety gate: paid sessions require payment flow (future gate)
    if (price > 0) {
      return res.status(402).json({
        paymentRequired: true,
        occurrenceId,
        price,
        currency: occurrence.template?.currency || 'usd',
        title: occurrence.template?.title || 'Session',
        seats: seats || 1,
        totalAmount: price * (seats || 1),
        message: 'This session requires payment. Use the payment flow to complete booking.',
      });
    }

    // Free session — book immediately
    const booking = await SessionService.bookSeat(occurrenceId, clientId, {
      seats: seats || 1,
      paidAmount: 0,
    });

    res.status(201).json({
      ok: true,
      booking,
      message: 'Seat booked successfully',
    });
  } catch (err) {
    // P2002 = Prisma unique constraint (client already booked this occurrence)
    const isDuplicate = err.code === 'P2002' || err.message?.includes('Unique constraint');
    const status = isDuplicate ? 409
      : err.message.includes('full') ? 409
      : err.message.includes('not available') ? 409
      : err.message.includes('already started') ? 410
      : err.message.includes('closes') ? 410
      : err.message.includes('concurrent') ? 409 : 400;
    const message = isDuplicate ? 'You have already booked this session.' : err.message;
    console.error('[sessions] POST /book error:', err.message);
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/sessions/book-paid
 * Create a pending_payment hold for a paid session + Stripe PaymentIntent.
 * Body: { occurrenceId, seats? }
 * Returns: { bookingId, clientSecret, holdExpiresAt, price, currency, totalAmount }
 */
router.post('/book-paid', authenticateToken, async (req, res) => {
  try {
    // ── Feature flag: paid session checkout gated on ledger wiring ───────
    if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') {
      return res.status(503).json({
        error: 'Paid session checkout is temporarily unavailable while we finish payment safety hardening. Free sessions can still be booked.',
        code: 'paid_sessions_temporarily_disabled',
      });
    }
    // ── End feature flag ────────────────────────────────────────────────

    const clientId = req.user._id.toString();
    const { occurrenceId, seats: rawSeats } = req.body;
    const seats = rawSeats || 1;

    if (!occurrenceId) return res.status(400).json({ error: 'occurrenceId is required' });

    // Look up occurrence + template for price + freelancerId
    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();
    const occurrence = await prisma.sessionOccurrence.findUnique({
      where: { id: occurrenceId },
      include: { template: { select: { id: true, price: true, currency: true, title: true, serviceId: true, freelancerId: true } } },
    });

    if (!occurrence) return res.status(404).json({ error: 'Session not found' });

    const price = occurrence.priceOverride != null
      ? Number(occurrence.priceOverride)
      : (occurrence.template?.price != null ? Number(occurrence.template.price) : 0);

    if (price <= 0) {
      return res.status(400).json({ error: 'This is a free session. Use POST /api/sessions/book instead.' });
    }

    const totalAmount = price * seats;
    const currency = occurrence.template?.currency || 'usd';
    const freelancerId = occurrence.template?.freelancerId || occurrence.freelancerId;

    // Hold expires in 5 minutes
    const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Create pending_payment booking (holds the seat via bookedCount increment)
    const booking = await SessionService.bookSeat(occurrenceId, clientId, {
      seats,
      status: 'pending_payment',
      holdExpiresAt,
    });

    // Create PaymentLedgerEntry (status: charging)
    let ledgerEntry;
    try {
      ledgerEntry = await prisma.paymentLedgerEntry.create({
        data: {
          sourceType: 'session_booking',
          sourceId: booking.id,
          clientId,
          freelancerId,
          grossAmountCents: Math.round(totalAmount * 100),
          platformFeeCents: 0,
          payoutAmountCents: 0,
          currency,
          status: 'charging',
          chargedAt: new Date(),
          idempotencyKey: `session_booking_${booking.id}`,
          metadata: {
            occurrenceId,
            serviceId: occurrence.template?.serviceId || '',
            seats,
            templateId: occurrence.template?.id || occurrence.templateId,
          },
        },
      });
    } catch (ledgerErr) {
      // Ledger creation failed — roll back booking hold
      try {
        await prisma.$transaction(async (tx) => {
          const occ = await tx.sessionOccurrence.findUnique({ where: { id: occurrenceId } });
          if (occ) {
            const newCount = Math.max(0, occ.bookedCount - seats);
            await tx.sessionOccurrence.update({
              where: { id: occurrenceId },
              data: {
                bookedCount: newCount,
                ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
              },
            });
          }
          await tx.sessionBooking.delete({ where: { id: booking.id } });
        });
      } catch (cleanupErr) {
        console.error('[sessions] POST /book-paid cleanup error after ledger failure:', cleanupErr.message);
      }
      console.error('[sessions] POST /book-paid ledger error:', ledgerErr.message);
      return res.status(500).json({ error: 'Failed to initialize payment. Please try again.' });
    }

    // Create Stripe PaymentIntent — wrapped so a failure rolls back booking + ledger
    let pi;
    try {
      const stripeService = require('../services/stripeService');
      pi = await stripeService.createPaymentIntent({
        amount: Math.round(totalAmount * 100), // dollars → cents
        currency,
        metadata: {
          type: 'session_booking',
          ledgerEntryId: ledgerEntry.id,
          sessionBookingId: booking.id,
          occurrenceId,
          clientId,
          freelancerId,
          serviceId: occurrence.template?.serviceId || '',
        },
      });
    } catch (stripeErr) {
      // Roll back: delete booking + decrement bookedCount + mark ledger failed
      try {
        await prisma.$transaction(async (tx) => {
          const occ = await tx.sessionOccurrence.findUnique({ where: { id: occurrenceId } });
          if (occ) {
            const newCount = Math.max(0, occ.bookedCount - seats);
            await tx.sessionOccurrence.update({
              where: { id: occurrenceId },
              data: {
                bookedCount: newCount,
                ...(occ.status === 'full' && newCount < occ.maxCapacity ? { status: 'scheduled' } : {}),
              },
            });
          }
          await tx.sessionBooking.delete({ where: { id: booking.id } });
          await tx.paymentLedgerEntry.update({
            where: { id: ledgerEntry.id },
            data: { status: 'failed', failedAt: new Date(), failureReason: stripeErr.message },
          });
        });
      } catch (cleanupErr) {
        console.error('[sessions] POST /book-paid cleanup error after Stripe failure:', cleanupErr.message);
      }
      console.error('[sessions] POST /book-paid Stripe error:', stripeErr.message);
      return res.status(502).json({ error: 'Payment system unavailable. Please try again.' });
    }

    // Store stripePaymentIntentId on both the booking and ledger entry
    await prisma.$transaction(async (tx) => {
      await tx.sessionBooking.update({
        where: { id: booking.id },
        data: { paymentIntentId: pi.id },
      });
      await tx.paymentLedgerEntry.update({
        where: { id: ledgerEntry.id },
        data: { stripePaymentIntentId: pi.id },
      });
    });

    res.status(201).json({
      ok: true,
      bookingId: booking.id,
      clientSecret: pi.client_secret,
      holdExpiresAt: holdExpiresAt.toISOString(),
      price,
      currency,
      totalAmount,
      seats,
    });
  } catch (err) {
    // P2025 = record not found on conditional update (concurrent booking race — seat taken)
    const isP2025 = err.code === 'P2025';
    const isDuplicate = err.code === 'P2002' || err.message?.includes('Unique constraint');
    const status = isP2025 ? 409
      : isDuplicate ? 409
      : err.message.includes('full') ? 409
      : err.message.includes('not available') ? 409
      : err.message.includes('already started') ? 410
      : err.message.includes('closes') ? 410
      : err.message.includes('concurrent') ? 409 : 400;
    const message = isP2025 ? 'Session is full. Please choose another time.'
      : isDuplicate ? 'You already have a pending or confirmed booking for this session.' : err.message;
    console.error('[sessions] POST /book-paid error:', err.message);
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/sessions/bookings/:id/confirm-payment
 * Confirm a paid session booking after Stripe payment succeeds.
 * Body: { paymentIntentId }
 */
router.post('/bookings/:id/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user._id.toString();
    const bookingId = req.params.id;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId is required' });

    const { getPrisma } = require('../booking-sql/db/client');
    const prisma = getPrisma();

    // Look up booking
    const booking = await prisma.sessionBooking.findUnique({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.clientId !== clientId) return res.status(403).json({ error: 'Not authorized' });

    // Look up ledger entry (may not exist for legacy bookings)
    const ledger = await prisma.paymentLedgerEntry.findFirst({
      where: { sourceType: 'session_booking', sourceId: bookingId },
    });

    // ── Race-safe: webhook already confirmed ────────────────────────────
    if (booking.status === 'confirmed' && ledger && ledger.status === 'held') {
      // Verify the PI matches to prevent spoofing
      if (ledger.stripePaymentIntentId === paymentIntentId) {
        return res.json({
          ok: true,
          booking,
          alreadyConfirmed: true,
          message: 'Payment confirmed. You are booked for this session.',
        });
      }
      // PI mismatch — genuine error
      return res.status(409).json({ error: 'Payment intent does not match this booking.' });
    }

    // ── Normal path: frontend arrived first ─────────────────────────────
    if (booking.status !== 'pending_payment') {
      return res.status(409).json({ error: `Booking status is "${booking.status}", expected "pending_payment"` });
    }

    // Retrieve the PaymentIntent from Stripe
    const stripeService = require('../services/stripeService');
    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: `Payment not completed. Stripe status: ${pi.status}` });
    }

    // Transactionally confirm booking + update ledger
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const confirmed = await tx.sessionBooking.update({
        where: { id: bookingId },
        data: {
          status: 'confirmed',
          holdExpiresAt: null,
          paidAmount: pi.amount / 100, // cents → dollars
          paymentIntentId: pi.id,
        },
      });

      // Update ledger if it exists and is still in charging state
      if (ledger && ledger.status === 'charging') {
        await tx.paymentLedgerEntry.update({
          where: { id: ledger.id },
          data: {
            status: 'held',
            heldAt: new Date(),
            stripeChargeId: pi.latest_charge || null,
          },
        });
      }

      return confirmed;
    });

    res.json({
      ok: true,
      booking: updatedBooking,
      message: 'Payment confirmed. You are booked for this session.',
    });
  } catch (err) {
    const status = err.message === 'Booking not found' ? 404
      : err.message === 'Not authorized' ? 403
      : err.message.includes('expected "pending_payment"') ? 409
      : err.message.includes('Payment not completed') ? 402
      : 400;
    console.error('[sessions] POST /bookings/:id/confirm-payment error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/my-bookings
 * Client's session bookings.
 * Query: ?upcoming=true&limit=20
 */
router.get('/my-bookings', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user._id.toString();
    const bookings = await SessionService.getClientBookings(clientId, {
      upcoming: req.query.upcoming !== 'false',
      limit: parseInt(req.query.limit) || 20,
    });
    res.json(bookings);
  } catch (err) {
    console.error('[sessions] GET /my-bookings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sessions/bookings/:id/cancel
 * Cancel a session booking. Client must own it.
 * Body: { reason?: string }
 */
router.post('/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const clientId = req.user._id.toString();
    const result = await SessionService.cancelBooking(
      req.params.id,
      clientId,
      { cancelReason: req.body.reason },
    );

    res.json({
      ok: true,
      refundEligible: result.refundEligible,
      message: result.refundEligible
        ? 'Booking cancelled. You are eligible for a refund.'
        : 'Booking cancelled. Cancellation policy applies — no refund.',
    });
  } catch (err) {
    const status = err.message === 'Not authorized' ? 403
      : err.message === 'Booking not found' ? 404
      : err.message === 'Booking is already cancelled' ? 409 : 400;
    console.error('[sessions] POST /bookings/:id/cancel error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

// ─── Admin / Cron ───────────────────────────────────────────────────────────

/**
 * POST /api/sessions/generate-all
 * Trigger occurrence generation for all active templates.
 * Protected: requires CRON_SECRET header or admin auth.
 */
router.post('/generate-all', async (req, res) => {
  // Check cron secret or admin auth
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // Authenticated via cron
  } else {
    // Fall back to admin auth
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user || (!user.isAdmin && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  try {
    const result = await SessionService.generateAllPending();
    res.json(result);
  } catch (err) {
    console.error('[sessions] POST /generate-all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
