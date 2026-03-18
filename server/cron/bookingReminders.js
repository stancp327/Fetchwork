/**
 * bookingReminders.js — SMS reminders for upcoming bookings
 * Call this cron every 15 minutes via Render Cron Job or setInterval on startup.
 * Route: POST /api/cron/booking-reminders (secured with CRON_SECRET)
 */
const { db } = require('../booking-sql/prismaClient');
const User = require('../models/User');
const { notifyUser, SMS } = require('../services/smsService');

const WINDOW_24H = 24 * 60 * 60 * 1000;
const WINDOW_1H  =      60 * 60 * 1000;
const BUFFER     =      15 * 60 * 1000; // 15-min run window

const sendBookingReminders = async () => {
  const now = Date.now();

  // Find occurrences starting in 23h45m–24h15m (24h window)
  // and 45m–1h15m (1h window)
  const windows = [
    { label: '24h', ms: WINDOW_24H, template: SMS.bookingReminder24h },
    { label: '1h',  ms: WINDOW_1H,  template: SMS.bookingReminder1h  },
  ];

  for (const { label, ms, template } of windows) {
    const windowStart = new Date(now + ms - BUFFER);
    const windowEnd   = new Date(now + ms + BUFFER);

    const occurrences = await db.bookingOccurrence.findMany({
      where: {
        localStartWallclock: { gte: windowStart.toISOString(), lte: windowEnd.toISOString() },
        status: 'confirmed',
        smsReminderSent: { not: label }, // avoid duplicate sends
      },
      include: { booking: true },
      take: 200,
    });

    for (const occ of occurrences) {
      try {
        const { booking } = occ;
        const dateStr = occ.localStartWallclock?.split('T')[0] || '';
        const timeStr = occ.localStartWallclock?.split('T')[1]?.slice(0, 5) || '';

        const [client, freelancer] = await Promise.all([
          User.findById(booking.clientId).select('phone preferences firstName'),
          User.findById(booking.freelancerId).select('phone preferences firstName'),
        ]);

        const msg = label === '24h'
          ? template('your upcoming session', dateStr)
          : template('your upcoming session', timeStr);

        await Promise.all([
          client     ? notifyUser(client,     'bookingReminders', msg) : null,
          freelancer ? notifyUser(freelancer,  'bookingReminders', msg) : null,
        ]);

        // Mark reminder sent to avoid duplicates
        await db.bookingOccurrence.update({
          where: { id: occ.id },
          data:  { smsReminderSent: label },
        });
      } catch (err) {
        console.error('[bookingReminders] occurrence', occ.id, err.message);
      }
    }
  }
};

module.exports = { sendBookingReminders };
