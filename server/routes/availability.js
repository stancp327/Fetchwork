const express    = require('express');
const router     = express.Router();
const Availability = require('../models/Availability');
const Booking    = require('../models/Booking');
const { authenticateToken } = require('../middleware/auth');
const { generateSlotsForRange } = require('../utils/slotGenerator');

// ── PUT /api/availability — freelancer sets/updates their schedule ──────────
router.put('/', authenticateToken, async (req, res) => {
  try {
    const {
      timezone, defaultSlotDuration, bufferTime, defaultCapacity,
      minNoticeHours, maxAdvanceBookingDays, weeklySchedule, exceptions, isActive,
    } = req.body;

    const doc = await Availability.findOneAndUpdate(
      { freelancer: req.user.userId },
      {
        freelancer: req.user.userId,
        ...(timezone              !== undefined && { timezone }),
        ...(defaultSlotDuration   !== undefined && { defaultSlotDuration: parseInt(defaultSlotDuration) }),
        ...(bufferTime            !== undefined && { bufferTime: parseInt(bufferTime) }),
        ...(defaultCapacity       !== undefined && { defaultCapacity: parseInt(defaultCapacity) }),
        ...(minNoticeHours        !== undefined && { minNoticeHours: parseInt(minNoticeHours) }),
        ...(maxAdvanceBookingDays !== undefined && { maxAdvanceBookingDays: parseInt(maxAdvanceBookingDays) }),
        ...(weeklySchedule        !== undefined && { weeklySchedule }),
        ...(exceptions            !== undefined && { exceptions }),
        ...(isActive              !== undefined && { isActive }),
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ availability: doc });
  } catch (err) {
    console.error('availability PUT error:', err);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

// ── GET /api/availability/me — current freelancer's own config ──────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const doc = await Availability.findOne({ freelancer: req.user.userId });
    res.json({ availability: doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

// ── GET /api/availability/:freelancerId — public availability config ─────────
router.get('/:freelancerId', async (req, res) => {
  try {
    const doc = await Availability.findOne({
      freelancer: req.params.freelancerId,
      isActive:   true,
    });
    if (!doc) return res.status(404).json({ error: 'Availability not configured' });
    res.json({ availability: doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

// ── GET /api/availability/:freelancerId/slots ─────────────────────────────
// Query: from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns slots grouped by date — single DB query for entire range
router.get('/:freelancerId/slots', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });

    const availability = await Availability.findOne({
      freelancer: req.params.freelancerId,
      isActive:   true,
    }).lean();
    if (!availability) return res.status(404).json({ error: 'Availability not configured' });

    // Single DB query for the whole range — no N+1
    const rangeStart = new Date(from + 'T00:00:00Z');
    const rangeEnd   = new Date(to   + 'T23:59:59Z');

    const existingBookings = await Booking.find({
      freelancer: req.params.freelancerId,
      status:     { $in: ['hold', 'confirmed'] },
      startTime:  { $lt: rangeEnd   },
      endTime:    { $gt: rangeStart },
    }).select('startTime endTime status capacity participants').lean();

    const slots = generateSlotsForRange(from, to, availability, existingBookings);

    res.json({
      freelancerId:       req.params.freelancerId,
      freelancerTimezone: availability.timezone,
      slots,
    });
  } catch (err) {
    console.error('slots error:', err);
    res.status(500).json({ error: 'Failed to generate slots' });
  }
});

module.exports = router;
