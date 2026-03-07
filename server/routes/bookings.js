const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/entitlements');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
let isBookingSqlEnabled = () => false;
let getSlotsSql, createBookingHoldSql, confirmBookingSql, cancelBookingSql, completeBookingSql,
    rescheduleBookingSql, getMyBookingsSql, getBookingByIdSql,
    // Group
    createGroupSlot, getGroupSlots, getGroupSlotDetail, bookGroupSeats,
    confirmGroupBooking, cancelGroupBooking, joinGroupWaitlist, leaveGroupWaitlist,
    getGroupWaitlistPosition, acceptWaitlistPromotion,
    // Attendance
    attendanceCheckin, attendanceCheckout, markNoShow,
    flagAttendanceDispute, getAttendanceRecord, adminResolveAttendance,
    // Audit
    getBookingTimeline, queryAuditEvents, recordAdminOverride,
    getDisputeEvidence, getAuditStats, verifyAuditIntegrity,
    // Recurring series
    createRecurringSeries, getRecurringSeries, skipSeriesOccurrence,
    cancelSeriesFromDate, cancelEntireSeries, pauseRecurringSeries, resumeRecurringSeries;
let bookingSqlHealthcheck = async () => ({ ok: false, error: 'booking-sql module not loaded' });

try {
  isBookingSqlEnabled = require('../booking-sql/db/featureFlag').isBookingSqlEnabled;
  const ctrl = require('../booking-sql/routes/bookingsSqlController');
  // Core
  getSlotsSql              = ctrl.getSlotsSql;
  createBookingHoldSql     = ctrl.createBookingHoldSql;
  confirmBookingSql        = ctrl.confirmBookingSql;
  cancelBookingSql         = ctrl.cancelBookingSql;
  completeBookingSql       = ctrl.completeBookingSql;
  rescheduleBookingSql     = ctrl.rescheduleBookingSql;
  getMyBookingsSql         = ctrl.getMyBookingsSql;
  getBookingByIdSql        = ctrl.getBookingByIdSql;
  // Group
  createGroupSlot          = ctrl.createGroupSlot;
  getGroupSlots            = ctrl.getGroupSlots;
  getGroupSlotDetail       = ctrl.getGroupSlotDetail;
  bookGroupSeats           = ctrl.bookGroupSeats;
  confirmGroupBooking      = ctrl.confirmGroupBooking;
  cancelGroupBooking       = ctrl.cancelGroupBooking;
  joinGroupWaitlist        = ctrl.joinGroupWaitlist;
  leaveGroupWaitlist       = ctrl.leaveGroupWaitlist;
  getGroupWaitlistPosition = ctrl.getGroupWaitlistPosition;
  acceptWaitlistPromotion  = ctrl.acceptWaitlistPromotion;
  // Attendance
  attendanceCheckin        = ctrl.attendanceCheckin;
  attendanceCheckout       = ctrl.attendanceCheckout;
  markNoShow               = ctrl.markNoShow;
  flagAttendanceDispute    = ctrl.flagAttendanceDispute;
  getAttendanceRecord      = ctrl.getAttendanceRecord;
  adminResolveAttendance   = ctrl.adminResolveAttendance;
  // Audit
  // Recurring series
  createRecurringSeries    = ctrl.createRecurringSeries;
  getRecurringSeries       = ctrl.getRecurringSeries;
  skipSeriesOccurrence     = ctrl.skipSeriesOccurrence;
  cancelSeriesFromDate     = ctrl.cancelSeriesFromDate;
  cancelEntireSeries       = ctrl.cancelEntireSeries;
  pauseRecurringSeries     = ctrl.pauseRecurringSeries;
  resumeRecurringSeries    = ctrl.resumeRecurringSeries;
  // Audit
  getBookingTimeline       = ctrl.getBookingTimeline;
  queryAuditEvents         = ctrl.queryAuditEvents;
  recordAdminOverride      = ctrl.recordAdminOverride;
  getDisputeEvidence       = ctrl.getDisputeEvidence;
  getAuditStats            = ctrl.getAuditStats;
  verifyAuditIntegrity     = ctrl.verifyAuditIntegrity;
  bookingSqlHealthcheck    = require('../booking-sql/db/healthcheck').bookingSqlHealthcheck;
} catch (e) {
  console.error('[bookings] booking-sql module failed to load - falling back to Mongo-only mode:', e.message);
}

// TODO(SQL cutover): route handlers in this file branch by BOOKING_SQL_ENABLED.
// If enabled -> delegate to booking-sql service/repositories (Prisma/PostgreSQL).
// If disabled -> keep current Mongo path for safe rollback.

// ── GET /api/bookings/sql/status ────────────────────────────────
// Lightweight SQL readiness endpoint for rollout checks.
router.get('/sql/status', authenticateToken, async (_req, res) => {
  const enabled = isBookingSqlEnabled();
  if (!enabled) {
    return res.json({ enabled: false, healthy: false, reason: 'BOOKING_SQL_ENABLED=false' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ enabled: true, healthy: false, reason: 'DATABASE_URL missing' });
  }

  const health = await bookingSqlHealthcheck();
  if (!health.ok) {
    return res.status(503).json({ enabled: true, healthy: false, reason: health.error || 'db unavailable' });
  }

  return res.json({ enabled: true, healthy: true });
});

// ── Helper: generate available slots for a date ──────────────────
function generateSlots(windows, slotDuration, bufferTime, dayOfWeek) {
  const dayWindows = windows.filter(w => w.dayOfWeek === dayOfWeek);
  const slots = [];

  for (const win of dayWindows) {
    const [startH, startM] = win.startTime.split(':').map(Number);
    const [endH, endM]     = win.endTime.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin   = endH * 60 + endM;

    let cursor = startMin;
    while (cursor + slotDuration <= endMin) {
      const slotStart = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
      const slotEndMin = cursor + slotDuration;
      const slotEnd   = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;
      slots.push({ startTime: slotStart, endTime: slotEnd });
      cursor = slotEndMin + bufferTime;
    }
  }

  return slots;
}

// ── PUT /api/bookings/availability/:serviceId ────────────────────
// Freelancer sets/updates availability (feature-gated)
// Dual-writes to Mongo (Service.availability) AND SQL (FreelancerAvailability)
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

    const resolvedAvail = {
      enabled:        enabled !== false,
      timezone:       timezone || service.availability?.timezone || 'America/Los_Angeles',
      windows:        windows || [],
      slotDuration:   slotDuration || 60,
      bufferTime:     bufferTime || 0,
      maxAdvanceDays: maxAdvanceDays || 30,
      maxPerSlot:     maxPerSlot || 1,
    };

    // 1. Write to Mongo (backward compat)
    service.availability = resolvedAvail;
    await service.save();

    // 2. Dual-write to SQL FreelancerAvailability
    try {
      const { getPrisma } = require('../booking-sql/db/client');
      const prisma = getPrisma();
      await prisma.freelancerAvailability.upsert({
        where:  { freelancerId: req.user.userId.toString() },
        update: {
          isActive:             resolvedAvail.enabled,
          timezone:             resolvedAvail.timezone,
          weeklyScheduleJson:   resolvedAvail.windows,
          defaultSlotDuration:  resolvedAvail.slotDuration,
          bufferTime:           resolvedAvail.bufferTime,
          maxAdvanceBookingDays: resolvedAvail.maxAdvanceDays,
          defaultCapacity:      resolvedAvail.maxPerSlot,
        },
        create: {
          freelancerId:         req.user.userId.toString(),
          isActive:             resolvedAvail.enabled,
          timezone:             resolvedAvail.timezone,
          weeklyScheduleJson:   resolvedAvail.windows,
          defaultSlotDuration:  resolvedAvail.slotDuration,
          bufferTime:           resolvedAvail.bufferTime,
          maxAdvanceBookingDays: resolvedAvail.maxAdvanceDays,
          defaultCapacity:      resolvedAvail.maxPerSlot,
        },
      });
    } catch (sqlErr) {
      // Non-fatal: Mongo write succeeded, log and continue
      console.error('[availability] SQL upsert failed (non-fatal):', sqlErr.message);
    }

    res.json({ message: 'Availability updated', availability: resolvedAvail });
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/availability/:serviceId ────────────────────
// Public - returns availability config
router.get('/availability/:serviceId', async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId)
      .select('availability title freelancer').lean();
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json({ availability: service.availability || { enabled: false } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/slots/:serviceId?date=YYYY-MM-DD ──────────
// Public - returns available time slots for a specific date
router.get('/slots/:serviceId', async (req, res) => {
  if (isBookingSqlEnabled()) {
    return getSlotsSql(req, res);
  }
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });

    const service = await Service.findById(req.params.serviceId).select('availability').lean();
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (!service.availability?.enabled) return res.json({ slots: [], message: 'Booking not enabled' });

    const requestedDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check date is in range
    if (requestedDate < today) return res.json({ slots: [], message: 'Date is in the past' });
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + (service.availability.maxAdvanceDays || 30));
    if (requestedDate > maxDate) return res.json({ slots: [], message: 'Date too far in advance' });

    const dayOfWeek = requestedDate.getDay();
    const { windows, slotDuration, bufferTime } = service.availability;

    // Generate all possible slots
    const allSlots = generateSlots(windows || [], slotDuration || 60, bufferTime || 0, dayOfWeek);

    // Find existing bookings for this date (non-cancelled)
    const startOfDay = new Date(date + 'T00:00:00Z');
    const endOfDay   = new Date(date + 'T23:59:59Z');
    const existingBookings = await Booking.find({
      service: req.params.serviceId,
      date:    { $gte: startOfDay, $lte: endOfDay },
      status:  { $in: ['pending', 'confirmed'] },
    }).select('startTime endTime').lean();

    // Count bookings per slot
    const bookingCounts = {};
    for (const b of existingBookings) {
      bookingCounts[b.startTime] = (bookingCounts[b.startTime] || 0) + 1;
    }

    const maxPerSlot = service.availability.maxPerSlot
      || service.capacity?.maxPerSlot
      || 1;

    // Build slots with availability info
    const availableSlots = allSlots
      .map(s => {
        const booked = bookingCounts[s.startTime] || 0;
        const spotsLeft = Math.max(0, maxPerSlot - booked);
        return { ...s, spotsLeft, totalSpots: maxPerSlot };
      })
      .filter(s => s.spotsLeft > 0);

    res.json({ date, dayOfWeek, slots: availableSlots, totalSlots: allSlots.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings/:serviceId ────────────────────────────────
// Client books a slot
router.post('/:serviceId', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) {
    return createBookingHoldSql(req, res);
  }
  try {
    const { date, startTime, endTime, notes } = req.body;
    if (!date || !startTime || !endTime)
      return res.status(400).json({ error: 'date, startTime, and endTime are required' });

    const service = await Service.findById(req.params.serviceId).populate('freelancer', 'firstName lastName');
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (!service.availability?.enabled)
      return res.status(400).json({ error: 'Booking is not enabled for this service' });
    if (service.freelancer._id.toString() === req.user.userId.toString())
      return res.status(400).json({ error: 'Cannot book your own service' });

    // Check capacity for this slot
    const startOfDay = new Date(date + 'T00:00:00Z');
    const endOfDay   = new Date(date + 'T23:59:59Z');
    const maxPerSlot = service.availability.maxPerSlot
      || service.capacity?.maxPerSlot
      || 1;

    const existingCount = await Booking.countDocuments({
      service:   req.params.serviceId,
      date:      { $gte: startOfDay, $lte: endOfDay },
      startTime,
      status:    { $in: ['pending', 'confirmed'] },
    });

    if (existingCount >= maxPerSlot) {
      // Check waitlist
      if (service.capacity?.waitlistEnabled) {
        // Allow booking with waitlisted status (handled below)
      } else {
        return res.status(409).json({
          error: maxPerSlot === 1
            ? 'This time slot is already booked'
            : `This slot is full (${maxPerSlot} spots taken)`,
        });
      }
    }

    // Prevent same client from double-booking the same slot
    const alreadyBooked = await Booking.findOne({
      service: req.params.serviceId,
      client:  req.user.userId,
      date:    { $gte: startOfDay, $lte: endOfDay },
      startTime,
      status:  { $in: ['pending', 'confirmed'] },
    });
    if (alreadyBooked) return res.status(409).json({ error: 'You already have a booking for this slot' });

    const isWaitlisted = existingCount >= maxPerSlot && service.capacity?.waitlistEnabled;

    const booking = await Booking.create({
      service:    req.params.serviceId,
      client:     req.user.userId,
      freelancer: service.freelancer._id,
      date:       new Date(date + 'T00:00:00Z'),
      startTime,
      endTime,
      notes:      notes || '',
      status:     isWaitlisted ? 'waitlisted' : 'pending',
    });

    // Notify freelancer
    await Notification.create({
      recipient: service.freelancer._id,
      title:     isWaitlisted ? 'New Waitlist Entry' : 'New Booking Request',
      message:   isWaitlisted
        ? `Someone joined the waitlist for "${service.title}" on ${date} at ${startTime}`
        : `New booking for "${service.title}" on ${date} at ${startTime}`,
      link:      '/bookings',
      type:      'booking',
    });

    res.status(201).json({
      message: isWaitlisted ? 'Added to waitlist' : 'Booking created',
      booking,
      waitlisted: isWaitlisted,
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/me?role=client|freelancer&status=upcoming|past|cancelled
router.get('/me', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) return getMyBookingsSql(req, res);
  try {
    const { role = 'client', status = 'upcoming' } = req.query;
    const filter = {};

    if (role === 'freelancer') filter.freelancer = req.user.userId;
    else filter.client = req.user.userId;

    const now = new Date();
    if (status === 'upcoming') {
      filter.status = { $in: ['pending', 'confirmed'] };
      filter.date   = { $gte: new Date(now.toISOString().split('T')[0] + 'T00:00:00Z') };
    } else if (status === 'past') {
      filter.status = { $in: ['completed', 'no_show'] };
    } else if (status === 'cancelled') {
      filter.status = 'cancelled';
    }

    const bookings = await Booking.find(filter)
      .populate('service', 'title pricing availability')
      .populate('client', 'firstName lastName profilePicture')
      .populate('freelancer', 'firstName lastName profilePicture')
      .sort(status === 'upcoming' ? { date: 1, startTime: 1 } : { date: -1 })
      .lean();

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bookings/:bookingId/confirm ───────────────────────
router.patch('/:bookingId/confirm', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) {
    return confirmBookingSql(req, res);
  }
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('service', 'title');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Only the freelancer can confirm' });
    if (booking.status !== 'pending')
      return res.status(400).json({ error: `Cannot confirm a ${booking.status} booking` });

    booking.status = 'confirmed';
    await booking.save();

    await Notification.create({
      recipient: booking.client,
      title:     'Booking Confirmed',
      message:   `Your booking for "${booking.service.title}" on ${booking.date.toISOString().split('T')[0]} at ${booking.startTime} has been confirmed!`,
      link:      '/bookings',
      type:      'booking',
    });

    res.json({ message: 'Booking confirmed', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bookings/:bookingId/reschedule ────────────────────
// Either party can reschedule; policy engine enforces fees + max count
router.patch('/:bookingId/reschedule', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) {
    return rescheduleBookingSql(req, res);
  }
  // Mongo path: reschedule not implemented yet (SQL-first feature)
  return res.status(501).json({
    error: 'Reschedule is only available in the new booking engine. Enable BOOKING_SQL_ENABLED to use this feature.',
    code: 'NOT_IMPLEMENTED_MONGO_PATH',
  });
});

// ── PATCH /api/bookings/:bookingId/cancel ────────────────────────
router.patch('/:bookingId/cancel', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) {
    return cancelBookingSql(req, res);
  }
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('service', 'title');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isClient     = booking.client.toString()     === req.user.userId.toString();
    const isFreelancer = booking.freelancer.toString() === req.user.userId.toString();
    if (!isClient && !isFreelancer)
      return res.status(403).json({ error: 'Not authorized' });
    if (['cancelled', 'completed'].includes(booking.status))
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking` });

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || '';
    booking.cancelledBy = req.user.userId;
    booking.cancelledAt = new Date();
    await booking.save();

    // Notify the other party
    const notifyId = isClient ? booking.freelancer : booking.client;
    await Notification.create({
      recipient: notifyId,
      title:     'Booking Cancelled',
      message:   `Booking for "${booking.service.title}" on ${booking.date.toISOString().split('T')[0]} at ${booking.startTime} was cancelled`,
      link:      '/bookings',
      type:      'booking',
    });

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/bookings/:bookingId/complete ──────────────────────
router.patch('/:bookingId/complete', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) {
    return completeBookingSql(req, res);
  }
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('service', 'title');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Only the freelancer can mark complete' });
    if (booking.status !== 'confirmed')
      return res.status(400).json({ error: `Cannot complete a ${booking.status} booking` });

    booking.status = 'completed';
    await booking.save();

    await Notification.create({
      recipient: booking.client,
      title:     'Session Completed',
      message:   `Your session for "${booking.service.title}" has been marked complete`,
      link:      '/bookings',
      type:      'booking',
    });

    res.json({ message: 'Booking completed', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GROUP BOOKING ROUTES ─────────────────────────────────────────────────────

// POST   /api/bookings/group/slots                           — create group slot (freelancer)
// GET    /api/bookings/group/slots/:serviceId                — available slots for a service
// GET    /api/bookings/group/slots/:slotId/detail            — slot detail + participants + waitlist
// POST   /api/bookings/group/slots/:slotId/book              — book seats (client)
// PATCH  /api/bookings/group/participants/:participantId/confirm  — confirm held group seat
// PATCH  /api/bookings/group/participants/:participantId/cancel   — cancel seat (auto-promotes waitlist)
// POST   /api/bookings/group/slots/:slotId/waitlist          — join waitlist
// DELETE /api/bookings/group/slots/:slotId/waitlist          — leave waitlist
// GET    /api/bookings/group/slots/:slotId/waitlist/position — get position
// POST   /api/bookings/group/waitlist/:waitlistId/accept     — accept waitlist promotion

router.post('/group/slots', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return createGroupSlot(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/group/slots/:serviceId', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getGroupSlots(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/group/slots/:slotId/detail', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getGroupSlotDetail(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/group/slots/:slotId/book', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return bookGroupSeats(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/group/participants/:participantId/confirm', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return confirmGroupBooking(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/group/participants/:participantId/cancel', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return cancelGroupBooking(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/group/slots/:slotId/waitlist', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return joinGroupWaitlist(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.delete('/group/slots/:slotId/waitlist', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return leaveGroupWaitlist(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/group/slots/:slotId/waitlist/position', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getGroupWaitlistPosition(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/group/waitlist/:waitlistId/accept', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return acceptWaitlistPromotion(req, res);
  return res.status(501).json({ error: 'Group bookings require BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

// ── AUDIT ROUTES (admin) ──────────────────────────────────────────────────────

router.get('/audit/events', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return queryAuditEvents(req, res);
  return res.status(501).json({ error: 'Audit requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/audit/stats', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getAuditStats(req, res);
  return res.status(501).json({ error: 'Audit requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/audit/events/:eventId/verify', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return verifyAuditIntegrity(req, res);
  return res.status(501).json({ error: 'Audit requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

// ── RECURRING SERIES ROUTES ──────────────────────────────────────────────────

// POST   /:bookingId/series                              — create recurring series from booking
// GET    /:bookingId/series/:seriesId                    — series details + all occurrences
// PATCH  /:bookingId/series/:seriesId/skip               — skip one occurrence
// PATCH  /:bookingId/series/:seriesId/cancel-from        — cancel from date forward
// DELETE /:bookingId/series/:seriesId                    — cancel entire series
// PATCH  /:bookingId/series/:seriesId/pause              — pause series
// PATCH  /:bookingId/series/:seriesId/resume             — resume paused series

router.post('/:bookingId/series', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return createRecurringSeries(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/:bookingId/series/:seriesId', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getRecurringSeries(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/:bookingId/series/:seriesId/skip', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return skipSeriesOccurrence(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/:bookingId/series/:seriesId/cancel-from', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return cancelSeriesFromDate(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.delete('/:bookingId/series/:seriesId', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return cancelEntireSeries(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/:bookingId/series/:seriesId/pause', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return pauseRecurringSeries(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/:bookingId/series/:seriesId/resume', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return resumeRecurringSeries(req, res);
  return res.status(501).json({ error: 'Recurring series requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

// ── PER-BOOKING ROUTES (must stay above /:bookingId catch-all) ───────────────

router.get('/:bookingId/timeline', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getBookingTimeline(req, res);
  return res.status(501).json({ error: 'Timeline requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/:bookingId/audit/admin-override', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return recordAdminOverride(req, res);
  return res.status(501).json({ error: 'Audit requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/:bookingId/audit/dispute-evidence', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getDisputeEvidence(req, res);
  return res.status(501).json({ error: 'Audit requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

// ── ATTENDANCE ROUTES (per-occurrence) ───────────────────────────────────────

router.post('/:bookingId/occurrences/:occurrenceId/checkin', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return attendanceCheckin(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/:bookingId/occurrences/:occurrenceId/checkout', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return attendanceCheckout(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/:bookingId/occurrences/:occurrenceId/no-show', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return markNoShow(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.post('/:bookingId/occurrences/:occurrenceId/dispute', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return flagAttendanceDispute(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.get('/:bookingId/occurrences/:occurrenceId/attendance', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return getAttendanceRecord(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

router.patch('/:bookingId/occurrences/:occurrenceId/attendance/admin-resolve', authenticateToken, (req, res) => {
  if (isBookingSqlEnabled()) return adminResolveAttendance(req, res);
  return res.status(501).json({ error: 'Attendance requires BOOKING_SQL_ENABLED', code: 'NOT_IMPLEMENTED' });
});

// GET /api/bookings/:bookingId - get single booking detail
router.get('/:bookingId', authenticateToken, async (req, res) => {
  if (isBookingSqlEnabled()) return getBookingByIdSql(req, res);
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('service', 'title pricing availability')
      .populate('client', 'firstName lastName profilePicture')
      .populate('freelancer', 'firstName lastName profilePicture')
      .lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const userId = String(req.user.userId);
    if (String(booking.client._id) !== userId && String(booking.freelancer._id) !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
