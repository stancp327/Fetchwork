const express      = require('express');
const router       = express.Router();
const mongoose     = require('mongoose');
const ical         = require('ical-generator');
const { DateTime } = require('luxon');
const Booking      = require('../models/Booking');
const Availability = require('../models/Availability');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { validateSlot }      = require('../utils/slotGenerator');
const calendarService       = require('../services/calendarService');

// ── iCal feed (PUBLIC — rate limited at nginx/express level) ─────────────
// GET /api/bookings/feed/:icalSecret.ics
router.get('/feed/:token', async (req, res) => {
  try {
    // Strip .ics extension
    const token = req.params.token.replace(/\.ics$/, '');

    const user = await User.findOne({ icalSecret: token })
      .select('firstName lastName email');
    if (!user) return res.status(404).send('Not found');

    const bookings = await Booking.find({
      freelancer: user._id,
      status:     { $in: ['confirmed', 'completed'] },
      startTime:  { $gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) }, // 90 days back
    }).select('startTime endTime icalUid clientNotes location locationType freelancerTimezone').lean();

    const cal = ical.default({ name: `FetchWork — ${user.firstName} ${user.lastName}` });

    for (const b of bookings) {
      cal.createEvent({
        id:       b.icalUid,
        start:    b.startTime,
        end:      b.endTime,
        summary:  'FetchWork Booking',
        description: b.clientNotes || '',
        location: b.location || (b.locationType === 'virtual' ? 'Video call' : ''),
        timezone: b.freelancerTimezone || 'UTC',
      });
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="fetchwork.ics"');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(cal.toString());
  } catch (err) {
    console.error('iCal feed error:', err);
    res.status(500).send('Error generating calendar feed');
  }
});

// ── GET /api/bookings/my — authenticated user's bookings ────────────────
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { role = 'client', status = 'upcoming', page = 1 } = req.query;
    const limit = 20;
    const skip  = (parseInt(page) - 1) * limit;
    const now   = new Date();

    const timeFilter = status === 'upcoming'
      ? { startTime: { $gte: now } }
      : { startTime: { $lt: now  } };

    let filter;
    if (role === 'freelancer') {
      filter = { freelancer: req.user.userId, ...timeFilter };
    } else {
      filter = { 'participants.client': req.user.userId, ...timeFilter };
    }

    // Exclude cancelled/hold for upcoming
    if (status === 'upcoming') {
      filter.status = { $in: ['confirmed'] };
    } else {
      filter.status = { $in: ['confirmed', 'completed', 'cancelled', 'no_show'] };
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ startTime: status === 'upcoming' ? 1 : -1 })
        .skip(skip).limit(limit)
        .populate('freelancer',         'firstName lastName profilePicture')
        .populate('participants.client','firstName lastName profilePicture')
        .populate('service',            'title')
        .populate('job',                'title')
        .lean(),
      Booking.countDocuments(filter),
    ]);

    res.json({ bookings, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// ── GET /api/bookings/:id ─────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('freelancer',          'firstName lastName profilePicture email')
      .populate('participants.client', 'firstName lastName profilePicture email')
      .populate('service', 'title')
      .populate('job',     'title');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const userId = req.user.userId;
    const isFreelancer   = String(booking.freelancer._id) === userId;
    const isParticipant  = booking.participants.some(p => String(p.client._id) === userId);
    if (!isFreelancer && !isParticipant) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load booking' });
  }
});

// ── POST /api/bookings — create hold (atomic overlap check via transaction) ──
router.post('/', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      freelancerId, startUTC, endUTC,
      notes, serviceId, jobId,
      locationType, location, price, cancellationPolicy,
    } = req.body;

    if (!freelancerId || !startUTC || !endUTC) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'freelancerId, startUTC, endUTC required' });
    }

    const proposedStart = new Date(startUTC);
    const proposedEnd   = new Date(endUTC);
    if (isNaN(proposedStart) || isNaN(proposedEnd) || proposedStart >= proposedEnd) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Invalid time range' });
    }

    // Load availability for slot validation + timezone snapshot
    const availability = await Availability.findOne({
      freelancer: freelancerId, isActive: true,
    }).lean();
    if (!availability) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Freelancer has not set up availability' });
    }

    // Server-side slot validation (prevents slot injection)
    const existingForValidation = await Booking.find({
      freelancer: freelancerId,
      status:     { $in: ['hold', 'confirmed'] },
      startTime:  { $lt: proposedEnd },
      endTime:    { $gt: proposedStart },
    }).lean();

    const isValidSlot = validateSlot(startUTC, endUTC, availability, existingForValidation);
    if (!isValidSlot) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Not a valid bookable slot' });
    }

    // Atomic overlap check
    const conflict = await Booking.findOne({
      freelancer: freelancerId,
      status:     { $in: ['hold', 'confirmed'] },
      startTime:  { $lt: proposedEnd },
      endTime:    { $gt: proposedStart },
    }).session(session).lean();

    const capacity     = conflict?.capacity ?? availability.defaultCapacity ?? 1;
    const activeCount  = conflict
      ? (conflict.participants || []).filter(p => p.status !== 'cancelled').length
      : 0;

    if (conflict && activeCount >= capacity) {
      await session.abortTransaction();
      return res.status(409).json({ error: 'slot_full', spotsRemaining: 0 });
    }

    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-min hold
    const duration      = Math.round((proposedEnd - proposedStart) / 60000);

    let booking;
    if (conflict && activeCount < capacity) {
      // Slot exists with room — add as participant
      conflict.participants.push({
        client:  req.user.userId,
        status:  'confirmed',
        price:   price ?? null,
      });
      await Booking.findByIdAndUpdate(
        conflict._id,
        { $push: { participants: { client: req.user.userId, status: 'confirmed', price: price ?? null } } },
        { session }
      );
      booking = await Booking.findById(conflict._id).session(session).lean();
    } else {
      // New slot — create hold
      [booking] = await Booking.create(
        [{
          freelancer:         freelancerId,
          startTime:          proposedStart,
          endTime:            proposedEnd,
          duration,
          freelancerTimezone: availability.timezone,
          capacity,
          participants:       [{ client: req.user.userId, status: 'confirmed', price: price ?? null }],
          status:             'hold',
          holdExpiresAt,
          locationType:       locationType || 'virtual',
          location:           location || '',
          price:              price ?? null,
          cancellationPolicy: cancellationPolicy || availability.cancellationPolicy || 'flexible',
          clientNotes:        notes || '',
          ...(serviceId && { service: serviceId }),
          ...(jobId     && { job:     jobId     }),
        }],
        { session }
      );
    }

    await session.commitTransaction();

    res.status(201).json({
      bookingId:     booking._id,
      holdExpiresAt,
      startUTC:      proposedStart,
      endUTC:        proposedEnd,
      freelancerTimezone: availability.timezone,
      spotsRemaining: Math.max(0, capacity - activeCount - 1),
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('booking create error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    session.endSession();
  }
});

// ── POST /api/bookings/:id/confirm ────────────────────────────────────────
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Idempotent — already confirmed
    if (booking.status === 'confirmed') return res.json({ booking });

    if (booking.status !== 'hold') {
      return res.status(400).json({ error: `Cannot confirm a booking with status: ${booking.status}` });
    }

    const isParticipant = booking.participants.some(
      p => String(p.client) === req.user.userId
    );
    if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

    booking.status        = 'confirmed';
    booking.holdExpiresAt = null;
    await booking.save();

    // Async calendar sync — fire and forget, never blocks response
    setImmediate(() => calendarService.pushBookingToCalendar(booking._id));

    // Notify freelancer
    try {
      const client = await User.findById(req.user.userId).select('firstName lastName');
      await Notification.create({
        recipient:  booking.freelancer,
        type:       'booking_confirmed',
        title:      'New booking confirmed',
        message:    `${client.firstName} ${client.lastName} booked a session with you.`,
        link:       `/bookings/${booking._id}`,
      });
    } catch { /* non-critical */ }

    res.json({ booking, calendarSyncQueued: true });
  } catch (err) {
    console.error('booking confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// ── PUT /api/bookings/:id/reschedule ──────────────────────────────────────
router.put('/:id/reschedule', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { newStartUTC, newEndUTC } = req.body;
    if (!newStartUTC || !newEndUTC) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'newStartUTC and newEndUTC required' });
    }

    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) { await session.abortTransaction(); return res.status(404).json({ error: 'Not found' }); }

    const isFreelancer  = String(booking.freelancer) === req.user.userId;
    const isParticipant = booking.participants.some(p => String(p.client) === req.user.userId);
    if (!isFreelancer && !isParticipant) {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!['hold', 'confirmed'].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Cannot reschedule a booking with status: ' + booking.status });
    }

    const newStart = new Date(newStartUTC);
    const newEnd   = new Date(newEndUTC);

    // Overlap check for new time, excluding current booking
    const conflict = await Booking.findOne({
      freelancer: booking.freelancer,
      _id:        { $ne: booking._id },
      status:     { $in: ['hold', 'confirmed'] },
      startTime:  { $lt: newEnd   },
      endTime:    { $gt: newStart },
    }).session(session).lean();

    const capacity    = booking.capacity ?? 1;
    const activeCount = conflict
      ? (conflict.participants || []).filter(p => p.status !== 'cancelled').length
      : 0;

    if (conflict && activeCount >= capacity) {
      await session.abortTransaction();
      return res.status(409).json({ error: 'slot_full' });
    }

    booking.startTime  = newStart;
    booking.endTime    = newEnd;
    booking.duration   = Math.round((newEnd - newStart) / 60000);
    booking.status     = 'confirmed';
    booking.holdExpiresAt = null;
    await booking.save({ session });

    await session.commitTransaction();

    // Async calendar update
    setImmediate(() => calendarService.updateCalendarEvent(booking._id));

    res.json({ booking });
  } catch (err) {
    await session.abortTransaction();
    console.error('reschedule error:', err);
    res.status(500).json({ error: 'Failed to reschedule booking' });
  } finally {
    session.endSession();
  }
});

// ── PUT /api/bookings/:id/cancel ──────────────────────────────────────────
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    const isFreelancer  = String(booking.freelancer) === req.user.userId;
    const isParticipant = booking.participants.some(p => String(p.client) === req.user.userId);
    if (!isFreelancer && !isParticipant) return res.status(403).json({ error: 'Forbidden' });

    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(400).json({ error: 'Booking is already ' + booking.status });
    }

    const cancellationFee = booking.calcCancellationFee();

    booking.status            = 'cancelled';
    booking.cancelledAt       = new Date();
    booking.cancellationReason= reason || '';
    booking.cancellationFee   = cancellationFee;
    booking.cancelledBy       = req.user.userId;
    booking.holdExpiresAt     = null;
    await booking.save();

    // Async calendar delete
    setImmediate(() => calendarService.deleteCalendarEvent(booking._id));

    // Notify the other party
    try {
      const actor = await User.findById(req.user.userId).select('firstName lastName');
      const notifyId = isFreelancer
        ? booking.participants[0]?.client
        : booking.freelancer;
      if (notifyId) {
        await Notification.create({
          recipient: notifyId,
          type:      'booking_cancelled',
          title:     'Booking cancelled',
          message:   `${actor.firstName} ${actor.lastName} cancelled the booking.${cancellationFee > 0 ? ` Cancellation fee: $${cancellationFee}` : ''}`,
          link:      `/bookings/${booking._id}`,
        });
      }
    } catch { /* non-critical */ }

    res.json({ booking, cancellationFee, refundAmount: (booking.price || 0) - cancellationFee });
  } catch (err) {
    console.error('cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ── PUT /api/bookings/:id/complete ────────────────────────────────────────
router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    const isFreelancer = String(booking.freelancer) === req.user.userId;
    if (!isFreelancer) return res.status(403).json({ error: 'Only freelancer can mark complete' });

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking must be confirmed to complete' });
    }

    booking.status = 'completed';
    await booking.save();
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// ── PUT /api/bookings/:id/no-show ─────────────────────────────────────────
router.put('/:id/no-show', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });

    if (String(booking.freelancer) !== req.user.userId) {
      return res.status(403).json({ error: 'Only freelancer can mark no-show' });
    }

    const gracePeriodMs = 15 * 60 * 1000;
    if (Date.now() < new Date(booking.startTime).getTime() + gracePeriodMs) {
      return res.status(400).json({ error: 'Grace period has not passed yet (15 minutes)' });
    }

    booking.status = 'no_show';
    await booking.save();
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark no-show' });
  }
});

module.exports = router;
