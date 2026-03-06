const { bookingSqlHealthcheck } = require('../db/healthcheck');
const { buildRequestHash } = require('../middleware/idempotency');
const { BookingService } = require('../services/BookingService');
const { SlotEngine } = require('../services/SlotEngine');

const { BookingRepo } = require('../repos/BookingRepo');

const bookingService = new BookingService();
const slotEngine = new SlotEngine();
const bookingRepo = new BookingRepo();

/**
 * Wraps an async route handler so any unhandled error returns a clean 500
 * instead of hanging the request or crashing the process.
 */
function withHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('[booking-sql] Unhandled error in', fn.name || 'handler', ':', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal booking service error',
          code: 'BOOKING_SQL_INTERNAL_ERROR',
        });
      }
    }
  };
}

function notReady(res, routeName) {
  return res.status(503).json({
    error: `Booking SQL path not ready for ${routeName}`,
    code: 'BOOKING_SQL_NOT_READY',
  });
}

async function ensureSqlReady(res, routeName) {
  if (!process.env.DATABASE_URL) {
    return notReady(res, routeName);
  }

  const health = await bookingSqlHealthcheck();
  if (!health.ok) {
    return res.status(503).json({
      error: 'Booking SQL database unavailable',
      code: 'BOOKING_SQL_DB_UNAVAILABLE',
      detail: health.error || null,
    });
  }

  return null;
}

async function getSlotsSql(req, res) {
  const { date } = req.query || {};
  if (!date) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }

  const guard = await ensureSqlReady(res, 'GET /slots');
  if (guard) return guard;

  const result = await slotEngine.getSlotsForServiceDate({
    serviceId: req.params.serviceId,
    date,
  });

  return res.status(result.statusCode).json(result.body);
}

async function createBookingHoldSql(req, res) {
  const { date, startTime, endTime } = req.body || {};
  if (!date || !startTime || !endTime) {
    return res.status(400).json({ error: 'date, startTime, and endTime are required' });
  }

  const guard = await ensureSqlReady(res, 'POST /bookings/:serviceId');
  if (guard) return guard;

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }

  const result = await bookingService.createHold({
    actorId: String(req.user?.userId || req.user?._id || 'unknown'),
    route: 'POST:/api/bookings/:serviceId',
    idempotencyKey,
    requestHash: buildRequestHash(req),
    body: req.body,
    serviceId: req.params.serviceId,
  });

  return res.status(result.statusCode).json(result.response);
}

async function confirmBookingSql(req, res) {
  const { bookingId } = req.params || {};
  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/confirm');
  if (guard) return guard;

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }

  const result = await bookingService.confirmHold({
    actorId: String(req.user?.userId || req.user?._id || 'unknown'),
    route: 'PATCH:/api/bookings/:bookingId/confirm',
    idempotencyKey,
    requestHash: buildRequestHash(req),
    bookingId,
  });

  return res.status(result.statusCode).json(result.response);
}

async function cancelBookingSql(req, res) {
  const { bookingId } = req.params || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/cancel');
  if (guard) return guard;

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }

  const result = await bookingService.cancelBooking({
    actorId: String(req.user?.userId || req.user?._id || 'unknown'),
    route: 'PATCH:/api/bookings/:bookingId/cancel',
    idempotencyKey,
    requestHash: buildRequestHash(req),
    bookingId,
    reason: req.body?.reason || '',
  });

  return res.status(result.statusCode).json(result.response);
}

async function completeBookingSql(req, res) {
  const { bookingId } = req.params || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/complete');
  if (guard) return guard;

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }

  const result = await bookingService.completeBooking({
    actorId: String(req.user?.userId || req.user?._id || 'unknown'),
    route: 'PATCH:/api/bookings/:bookingId/complete',
    idempotencyKey,
    requestHash: buildRequestHash(req),
    bookingId,
  });

  return res.status(result.statusCode).json(result.response);
}

async function getMyBookingsSql(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/me');
  if (guard) return guard;

  const { role = 'client', status = 'upcoming' } = req.query;
  const validRoles = ['client', 'freelancer'];
  const validStatuses = ['upcoming', 'past', 'cancelled', 'all'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'role must be client or freelancer', code: 'INVALID_ROLE' });
  }
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'status must be upcoming, past, cancelled, or all', code: 'INVALID_STATUS' });
  }

  const actorId = String(req.user?.userId || req.user?._id || 'unknown');
  const raw = await bookingRepo.findByActor({ actorId, role, status });

  // Shape each booking to match the existing frontend contract as closely as possible.
  // Fields that were populated from Mongo (service title, user names) are not available
  // here until we add a service_offerings SQL table. Returning what we have now.
  const bookings = raw.map((b) => {
    const primaryOccurrence = b.occurrences?.[0] || null;
    return {
      // Core identity
      id: b.id,
      bookingRef: b.bookingRef,
      // Status maps: SQL currentState -> surface as status for frontend compat
      status: b.currentState,
      // Pricing / policy snapshots
      pricing: b.pricingSnapshotJson || {},
      policy: b.policySnapshotJson || {},
      notes: b.notes || '',
      // Primary occurrence fields (matches old Mongo date/startTime/endTime shape)
      date: primaryOccurrence?.startAtUtc?.toISOString().slice(0, 10) || null,
      startTime: primaryOccurrence?.localStartWallclock?.split('T')[1]?.slice(0, 5) || null,
      endTime: primaryOccurrence?.localEndWallclock?.split('T')[1]?.slice(0, 5) || null,
      timezone: primaryOccurrence?.timezone || null,
      // Participant IDs (names/photos require join with User model — stub for now)
      clientId: b.clientId,
      freelancerId: b.freelancerId,
      serviceId: b.serviceOfferingId || null,
      // All occurrences for recurring/group bookings
      occurrences: b.occurrences.map((o) => ({
        id: o.id,
        occurrenceNo: o.occurrenceNo,
        status: o.status,
        startAtUtc: o.startAtUtc,
        endAtUtc: o.endAtUtc,
        timezone: o.timezone,
        localStartWallclock: o.localStartWallclock,
        localEndWallclock: o.localEndWallclock,
      })),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });

  return res.json({ bookings });
}

async function getBookingByIdSql(req, res) {
  const { bookingId } = req.params || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  const guard = await ensureSqlReady(res, 'GET /bookings/:bookingId');
  if (guard) return guard;

  const b = await bookingRepo.findByIdWithOccurrences(bookingId);
  if (!b) return res.status(404).json({ error: 'Booking not found', code: 'BOOKING_NOT_FOUND' });

  const actorId = String(req.user?.userId || req.user?._id || '');
  if (b.clientId !== actorId && b.freelancerId !== actorId) {
    return res.status(403).json({ error: 'Not authorized', code: 'NOT_AUTHORIZED' });
  }

  const primaryOccurrence = b.occurrences?.[0] || null;
  return res.json({
    booking: {
      id: b.id,
      bookingRef: b.bookingRef,
      status: b.currentState,
      pricing: b.pricingSnapshotJson || {},
      policy: b.policySnapshotJson || {},
      notes: b.notes || '',
      date: primaryOccurrence?.startAtUtc?.toISOString().slice(0, 10) || null,
      startTime: primaryOccurrence?.localStartWallclock?.split('T')[1]?.slice(0, 5) || null,
      endTime: primaryOccurrence?.localEndWallclock?.split('T')[1]?.slice(0, 5) || null,
      timezone: primaryOccurrence?.timezone || null,
      clientId: b.clientId,
      freelancerId: b.freelancerId,
      serviceId: b.serviceOfferingId || null,
      occurrences: b.occurrences.map((o) => ({
        id: o.id,
        occurrenceNo: o.occurrenceNo,
        status: o.status,
        startAtUtc: o.startAtUtc,
        endAtUtc: o.endAtUtc,
        timezone: o.timezone,
        localStartWallclock: o.localStartWallclock,
        localEndWallclock: o.localEndWallclock,
      })),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    },
  });
}

module.exports = {
  getSlotsSql:          withHandler(getSlotsSql),
  createBookingHoldSql: withHandler(createBookingHoldSql),
  confirmBookingSql:    withHandler(confirmBookingSql),
  cancelBookingSql:     withHandler(cancelBookingSql),
  completeBookingSql:   withHandler(completeBookingSql),
  getMyBookingsSql:     withHandler(getMyBookingsSql),
  getBookingByIdSql:    withHandler(getBookingByIdSql),
};
