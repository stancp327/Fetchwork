const { bookingSqlHealthcheck } = require('../db/healthcheck');
const { buildRequestHash } = require('../middleware/idempotency');
const { BookingService } = require('../services/BookingService');
const { SlotEngine } = require('../services/SlotEngine');
const { GroupBookingService } = require('../services/GroupBookingService');
const { RecurringSeriesService } = require('../services/RecurringSeriesService');
const { AttendanceService } = require('../services/AttendanceService');
const { AuditService } = require('../services/AuditService');

const { BookingRepo } = require('../repos/BookingRepo');

const bookingService    = new BookingService();
const slotEngine        = new SlotEngine();
const bookingRepo       = new BookingRepo();
const groupBooking       = new GroupBookingService();
const recurringSeriesSvc = new RecurringSeriesService();
const attendanceService = new AttendanceService();
const auditService      = new AuditService();

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

async function rescheduleBookingSql(req, res) {
  const { bookingId } = req.params || {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/reschedule');
  if (guard) return guard;

  const { newDate, newStartTime, newEndTime, reason } = req.body || {};
  if (!newDate || !newStartTime || !newEndTime) {
    return res.status(400).json({
      error: 'newDate, newStartTime, and newEndTime are required',
      code: 'MISSING_RESCHEDULE_PARAMS',
    });
  }

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required', code: 'MISSING_IDEMPOTENCY_KEY' });
  }

  const result = await bookingService.rescheduleBooking({
    actorId: String(req.user?.userId || req.user?._id || 'unknown'),
    route: 'PATCH:/api/bookings/:bookingId/reschedule',
    idempotencyKey,
    requestHash: buildRequestHash(req),
    bookingId,
    newDate,
    newStartTime,
    newEndTime,
    reason: reason || '',
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

// ─────────────────────────────────────────────────────────────────────────────
// GROUP BOOKING HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function createGroupSlot(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/group/slots');
  if (guard) return guard;

  const { serviceId, date, startTime, endTime, timezone, totalCapacity, pricePerPersonCents } = req.body || {};
  if (!serviceId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'serviceId, date, startTime, endTime are required', code: 'MISSING_PARAMS' });
  }

  const freelancerId = String(req.user?.userId || req.user?._id);
  const slot = await groupBooking.createSlot({ serviceId, freelancerId, date, startTime, endTime, timezone, totalCapacity, pricePerPersonCents });
  return res.status(201).json({ slot });
}

async function getGroupSlots(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/group/slots/:serviceId');
  if (guard) return guard;

  const { serviceId } = req.params;
  const { fromDate, toDate } = req.query;
  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'fromDate and toDate query params required (YYYY-MM-DD)', code: 'MISSING_PARAMS' });
  }

  const slots = await groupBooking.getAvailableSlots({ serviceId, fromDate, toDate });
  return res.json({ slots });
}

async function getGroupSlotDetail(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/group/slots/:slotId/detail');
  if (guard) return guard;

  const slot = await groupBooking.getSlot(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found', code: 'SLOT_NOT_FOUND' });
  return res.json({ slot });
}

async function bookGroupSeats(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/group/slots/:slotId/book');
  if (guard) return guard;

  const clientId = String(req.user?.userId || req.user?._id);
  const { seatCount = 1, paid = false } = req.body || {};
  const result = await groupBooking.bookSeats({ slotId: req.params.slotId, clientId, seatCount, paid });

  if (result.error) {
    const code = result.code === 'SLOT_NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.status(201).json(result);
}

async function confirmGroupBooking(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/group/participants/:participantId/confirm');
  if (guard) return guard;

  const { paidAmountCents } = req.body || {};
  const result = await groupBooking.confirmBooking({ participantId: req.params.participantId, paidAmountCents });

  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function cancelGroupBooking(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/group/participants/:participantId/cancel');
  if (guard) return guard;

  const result = await groupBooking.cancelBooking({ participantId: req.params.participantId, reason: req.body?.reason || '' });

  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function joinGroupWaitlist(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/group/slots/:slotId/waitlist');
  if (guard) return guard;

  const clientId = String(req.user?.userId || req.user?._id);
  const { seatCount = 1 } = req.body || {};
  const result = await groupBooking.joinWaitlist({ slotId: req.params.slotId, clientId, seatCount });

  if (result.error) {
    const code = result.code === 'SLOT_NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.status(201).json(result);
}

async function leaveGroupWaitlist(req, res) {
  const guard = await ensureSqlReady(res, 'DELETE /bookings/group/slots/:slotId/waitlist');
  if (guard) return guard;

  const clientId = String(req.user?.userId || req.user?._id);
  const result = await groupBooking.leaveWaitlist({ slotId: req.params.slotId, clientId });

  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

async function getGroupWaitlistPosition(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/group/slots/:slotId/waitlist/position');
  if (guard) return guard;

  const clientId = String(req.user?.userId || req.user?._id);
  const position = await groupBooking.getWaitlistPosition({ slotId: req.params.slotId, clientId });
  return res.json({ position });
}

async function acceptWaitlistPromotion(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/group/waitlist/:waitlistId/accept');
  if (guard) return guard;

  const { paid = false } = req.body || {};
  const result = await groupBooking.acceptPromotion({ waitlistId: req.params.waitlistId, paid });

  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function attendanceCheckin(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/occurrences/:occurrenceId/checkin');
  if (guard) return guard;

  const { occurrenceId } = req.params;
  const actor = req.user?.role === 'freelancer' ? 'freelancer' : 'client';
  const meta = req.body?.meta || {};

  const result = actor === 'freelancer'
    ? await attendanceService.freelancerCheckin({ occurrenceId, meta })
    : await attendanceService.clientCheckin({ occurrenceId, meta });

  return res.json(result);
}

async function attendanceCheckout(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/occurrences/:occurrenceId/checkout');
  if (guard) return guard;

  const { occurrenceId } = req.params;
  const actor = req.user?.role === 'freelancer' ? 'freelancer' : 'client';

  const result = actor === 'freelancer'
    ? await attendanceService.freelancerCheckout({ occurrenceId })
    : await attendanceService.clientCheckout({ occurrenceId });

  return res.json(result);
}

async function markNoShow(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/occurrences/:occurrenceId/no-show');
  if (guard) return guard;

  const { occurrenceId } = req.params;
  const { noShowParty } = req.body || {};

  if (!['client', 'freelancer'].includes(noShowParty)) {
    return res.status(400).json({ error: 'noShowParty must be "client" or "freelancer"', code: 'INVALID_PARTY' });
  }

  const result = await attendanceService.markNoShow({ occurrenceId, noShowParty });
  return res.json(result);
}

async function flagAttendanceDispute(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/occurrences/:occurrenceId/dispute');
  if (guard) return guard;

  const { reason } = req.body || {};
  if (!reason) return res.status(400).json({ error: 'reason is required', code: 'MISSING_REASON' });

  const result = await attendanceService.flagDispute({ occurrenceId: req.params.occurrenceId, reason });
  return res.json(result);
}

async function getAttendanceRecord(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/:bookingId/occurrences/:occurrenceId/attendance');
  if (guard) return guard;

  const record = await attendanceService.getRecord(req.params.occurrenceId);
  if (!record) return res.status(404).json({ error: 'No attendance record found', code: 'NOT_FOUND' });
  return res.json({ record });
}

async function adminResolveAttendance(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/occurrences/:occurrenceId/attendance/admin-resolve');
  if (guard) return guard;

  const { resolution } = req.body || {};
  if (!resolution) return res.status(400).json({ error: 'resolution is required', code: 'MISSING_RESOLUTION' });

  const adminId = String(req.user?.userId || req.user?._id);
  const result = await attendanceService.adminResolve({ occurrenceId: req.params.occurrenceId, resolution, adminId });
  return res.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT HANDLERS (admin only)
// ─────────────────────────────────────────────────────────────────────────────

async function getBookingTimeline(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/:bookingId/timeline');
  if (guard) return guard;

  const timeline = await auditService.getBookingTimelineFormatted({ bookingId: req.params.bookingId });
  return res.json({ timeline });
}

async function queryAuditEvents(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/audit/events');
  if (guard) return guard;

  const { bookingId, eventTypes, actorTypes, actorId, fromDate, toDate, limit = 100, offset = 0 } = req.query;

  const result = await auditService.queryEvents({
    bookingId: bookingId || null,
    eventTypes: eventTypes ? String(eventTypes).split(',') : null,
    actorTypes: actorTypes ? String(actorTypes).split(',') : null,
    actorId: actorId || null,
    fromDate: fromDate || null,
    toDate: toDate || null,
    limit: Math.min(Number(limit) || 100, 500),
    offset: Number(offset) || 0,
  });

  return res.json(result);
}

async function recordAdminOverride(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/audit/admin-override');
  if (guard) return guard;

  const { action, reason, changes } = req.body || {};
  if (!action || !reason) {
    return res.status(400).json({ error: 'action and reason are required', code: 'MISSING_PARAMS' });
  }

  const adminId = String(req.user?.userId || req.user?._id);
  const event = await auditService.recordAdminOverride({
    bookingId: req.params.bookingId,
    occurrenceId: req.body?.occurrenceId || null,
    adminId,
    action,
    reason,
    changes: changes || {},
  });

  return res.status(201).json({ event: { id: event.id.toString(), eventType: event.eventType, createdAt: event.createdAt } });
}

async function getDisputeEvidence(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/:bookingId/audit/dispute-evidence');
  if (guard) return guard;

  const result = await auditService.packageDisputeEvidence({ bookingId: req.params.bookingId });
  if (result.error) return res.status(404).json(result);
  return res.json(result);
}

async function getAuditStats(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/audit/stats');
  if (guard) return guard;

  const { days = 7 } = req.query;
  const stats = await auditService.getStats({ days: Number(days) });
  return res.json({ stats });
}

async function verifyAuditIntegrity(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/audit/events/:eventId/verify');
  if (guard) return guard;

  const result = await auditService.verifyPayloadIntegrity(req.params.eventId);
  return res.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING SERIES HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function createRecurringSeries(req, res) {
  const guard = await ensureSqlReady(res, 'POST /bookings/:bookingId/series');
  if (guard) return guard;

  const { bookingId } = req.params;
  const { frequency, intervalDays, startDate, startTime, endTime, timezone, endDate, maxOccurrences } = req.body || {};

  if (!frequency || !startDate || !startTime || !endTime || !timezone) {
    return res.status(400).json({ error: 'frequency, startDate, startTime, endTime, and timezone are required', code: 'MISSING_PARAMS' });
  }

  const result = await recurringSeriesSvc.createSeries({
    bookingId, frequency, intervalDays, startDate, startTime, endTime, timezone, endDate, maxOccurrences,
  });

  if (result.error) {
    const code = result.code === 'BOOKING_NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.status(201).json(result);
}

async function getRecurringSeries(req, res) {
  const guard = await ensureSqlReady(res, 'GET /bookings/:bookingId/series/:seriesId');
  if (guard) return guard;

  const series = await recurringSeriesSvc.getSeriesDetails(req.params.seriesId);
  if (!series) return res.status(404).json({ error: 'Series not found', code: 'NOT_FOUND' });
  return res.json({ series });
}

async function skipSeriesOccurrence(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/series/:seriesId/skip');
  if (guard) return guard;

  const { occurrenceId, reason } = req.body || {};
  if (!occurrenceId) return res.status(400).json({ error: 'occurrenceId is required', code: 'MISSING_PARAMS' });

  const result = await recurringSeriesSvc.skipOccurrence({ seriesId: req.params.seriesId, occurrenceId, reason });
  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function cancelSeriesFromDate(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/series/:seriesId/cancel-from');
  if (guard) return guard;

  const { fromDate, reason } = req.body || {};
  if (!fromDate) return res.status(400).json({ error: 'fromDate is required (YYYY-MM-DD)', code: 'MISSING_PARAMS' });

  const actorId = String(req.user?.userId || req.user?._id);
  const result = await recurringSeriesSvc.cancelFromDate({ seriesId: req.params.seriesId, fromDate, reason, actorId });
  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function cancelEntireSeries(req, res) {
  const guard = await ensureSqlReady(res, 'DELETE /bookings/:bookingId/series/:seriesId');
  if (guard) return guard;

  const actorId = String(req.user?.userId || req.user?._id);
  const result = await recurringSeriesSvc.cancelSeries({ seriesId: req.params.seriesId, reason: req.body?.reason, actorId });
  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function pauseRecurringSeries(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/series/:seriesId/pause');
  if (guard) return guard;

  const result = await recurringSeriesSvc.pauseSeries(req.params.seriesId);
  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

async function resumeRecurringSeries(req, res) {
  const guard = await ensureSqlReady(res, 'PATCH /bookings/:bookingId/series/:seriesId/resume');
  if (guard) return guard;

  const result = await recurringSeriesSvc.resumeSeries(req.params.seriesId);
  if (result.error) {
    const code = result.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(code).json(result);
  }
  return res.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core booking
  getSlotsSql:              withHandler(getSlotsSql),
  createBookingHoldSql:     withHandler(createBookingHoldSql),
  confirmBookingSql:        withHandler(confirmBookingSql),
  cancelBookingSql:         withHandler(cancelBookingSql),
  completeBookingSql:       withHandler(completeBookingSql),
  rescheduleBookingSql:     withHandler(rescheduleBookingSql),
  getMyBookingsSql:         withHandler(getMyBookingsSql),
  getBookingByIdSql:        withHandler(getBookingByIdSql),
  // Group bookings
  createGroupSlot:          withHandler(createGroupSlot),
  getGroupSlots:            withHandler(getGroupSlots),
  getGroupSlotDetail:       withHandler(getGroupSlotDetail),
  bookGroupSeats:           withHandler(bookGroupSeats),
  confirmGroupBooking:      withHandler(confirmGroupBooking),
  cancelGroupBooking:       withHandler(cancelGroupBooking),
  joinGroupWaitlist:        withHandler(joinGroupWaitlist),
  leaveGroupWaitlist:       withHandler(leaveGroupWaitlist),
  getGroupWaitlistPosition: withHandler(getGroupWaitlistPosition),
  acceptWaitlistPromotion:  withHandler(acceptWaitlistPromotion),
  // Attendance
  attendanceCheckin:        withHandler(attendanceCheckin),
  attendanceCheckout:       withHandler(attendanceCheckout),
  markNoShow:               withHandler(markNoShow),
  flagAttendanceDispute:    withHandler(flagAttendanceDispute),
  getAttendanceRecord:      withHandler(getAttendanceRecord),
  adminResolveAttendance:   withHandler(adminResolveAttendance),
  // Audit (admin)
  getBookingTimeline:       withHandler(getBookingTimeline),
  queryAuditEvents:         withHandler(queryAuditEvents),
  recordAdminOverride:      withHandler(recordAdminOverride),
  getDisputeEvidence:       withHandler(getDisputeEvidence),
  getAuditStats:            withHandler(getAuditStats),
  verifyAuditIntegrity:     withHandler(verifyAuditIntegrity),
  // Recurring series
  createRecurringSeries:    withHandler(createRecurringSeries),
  getRecurringSeries:       withHandler(getRecurringSeries),
  skipSeriesOccurrence:     withHandler(skipSeriesOccurrence),
  cancelSeriesFromDate:     withHandler(cancelSeriesFromDate),
  cancelEntireSeries:       withHandler(cancelEntireSeries),
  pauseRecurringSeries:     withHandler(pauseRecurringSeries),
  resumeRecurringSeries:    withHandler(resumeRecurringSeries),
};
