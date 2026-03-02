const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/entitlements');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Notification = require('../models/Notification');

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
router.put('/availability/:serviceId', authenticateToken, requireFeature('booking_calendar'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    if (service.freelancer.toString() !== req.user.userId.toString())
      return res.status(403).json({ error: 'Not your service' });

    const { enabled, timezone, windows, slotDuration, bufferTime, maxAdvanceDays, maxPerSlot } = req.body;

    service.availability = {
      enabled:        enabled !== false,
      timezone:       timezone || service.availability?.timezone || 'America/Los_Angeles',
      windows:        windows || [],
      slotDuration:   slotDuration || 60,
      bufferTime:     bufferTime || 0,
      maxAdvanceDays: maxAdvanceDays || 30,
      maxPerSlot:     maxPerSlot || 1,
    };

    await service.save();
    res.json({ message: 'Availability updated', availability: service.availability });
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/availability/:serviceId ────────────────────
// Public — returns availability config
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
// Public — returns available time slots for a specific date
router.get('/slots/:serviceId', async (req, res) => {
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

// ── PATCH /api/bookings/:bookingId/cancel ────────────────────────
router.patch('/:bookingId/cancel', authenticateToken, async (req, res) => {
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

module.exports = router;
