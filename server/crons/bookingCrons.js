/**
 * Booking system cron jobs:
 * 1. Clean up expired holds (every minute)
 * 2. Send 24h reminders (every 5 minutes)
 * 3. Send 1h reminders (every 5 minutes)
 * 4. Calendar sync retry for failed syncs (every 10 minutes)
 */
const cron    = require('node-cron');
const Booking = require('../models/Booking');
const User    = require('../models/User');
const Notification = require('../models/Notification');
const calendarService = require('../services/calendarService');

function initBookingCrons() {

  // ── 1. Expire stale holds every minute ────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await Booking.updateMany(
        { status: 'hold', holdExpiresAt: { $lt: new Date() } },
        { status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Hold expired' }
      );
      if (expired.modifiedCount > 0) {
        console.log(`🕐 Expired ${expired.modifiedCount} stale booking hold(s)`);
      }
    } catch (err) {
      console.error('Hold expiry cron error:', err.message);
    }
  });

  // ── 2. Send 24h reminders ─────────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const windowStart = new Date(Date.now() + 23.5 * 3600 * 1000);
      const windowEnd   = new Date(Date.now() + 24.5 * 3600 * 1000);

      const bookings = await Booking.find({
        status:          'confirmed',
        reminder24hSent: false,
        startTime:       { $gte: windowStart, $lte: windowEnd },
      }).populate('freelancer', 'firstName lastName')
        .populate('participants.client', 'firstName lastName');

      for (const b of bookings) {
        try {
          // Notify freelancer
          await Notification.create({
            recipient: b.freelancer._id,
            type:      'booking_reminder',
            title:     'Booking tomorrow',
            message:   `Reminder: you have a booking tomorrow at ${new Date(b.startTime).toLocaleTimeString()}.`,
            actionUrl: `/bookings/${b._id}`,
          });

          // Notify each participant
          for (const p of b.participants) {
            if (p.status === 'confirmed' && p.client) {
              await Notification.create({
                recipient: p.client._id,
                type:      'booking_reminder',
                title:     'Booking tomorrow',
                message:   `Reminder: your booking with ${b.freelancer.firstName} is tomorrow.`,
                actionUrl: `/bookings/${b._id}`,
              });
            }
          }

          // Atomic mark sent — prevents duplicates
          await Booking.findOneAndUpdate(
            { _id: b._id, reminder24hSent: false },
            { reminder24hSent: true }
          );
        } catch (err) {
          console.error(`24h reminder error for booking ${b._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('24h reminder cron error:', err.message);
    }
  });

  // ── 3. Send 1h reminders ──────────────────────────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const windowStart = new Date(Date.now() + 50 * 60 * 1000);
      const windowEnd   = new Date(Date.now() + 70 * 60 * 1000);

      const bookings = await Booking.find({
        status:         'confirmed',
        reminder1hSent: false,
        startTime:      { $gte: windowStart, $lte: windowEnd },
      }).populate('freelancer', 'firstName')
        .populate('participants.client', '_id');

      for (const b of bookings) {
        try {
          await Notification.create({
            recipient: b.freelancer._id,
            type:      'booking_reminder',
            title:     'Booking in 1 hour',
            message:   'You have a booking starting in about 1 hour.',
            actionUrl: `/bookings/${b._id}`,
          });

          for (const p of b.participants) {
            if (p.status === 'confirmed' && p.client) {
              await Notification.create({
                recipient: p.client._id,
                type:      'booking_reminder',
                title:     'Booking in 1 hour',
                message:   `Your session with ${b.freelancer.firstName} starts in about 1 hour.`,
                actionUrl: `/bookings/${b._id}`,
              });
            }
          }

          await Booking.findOneAndUpdate(
            { _id: b._id, reminder1hSent: false },
            { reminder1hSent: true }
          );
        } catch (err) {
          console.error(`1h reminder error for booking ${b._id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('1h reminder cron error:', err.message);
    }
  });

  // ── 4. Retry failed calendar syncs every 10 minutes ──────────────────
  cron.schedule('*/10 * * * *', async () => {
    try {
      const failed = await Booking.find({
        status:             'confirmed',
        calendarSyncStatus: 'failed',
        updatedAt:          { $lt: new Date(Date.now() - 10 * 60 * 1000) }, // tried > 10m ago
      }).limit(20).lean();

      for (const b of failed) {
        await calendarService.pushBookingToCalendar(b._id);
      }
      if (failed.length) {
        console.log(`📅 Retried calendar sync for ${failed.length} booking(s)`);
      }
    } catch (err) {
      console.error('Calendar sync retry cron error:', err.message);
    }
  });

  console.log('✅ Booking crons initialized');
}

module.exports = { initBookingCrons };
