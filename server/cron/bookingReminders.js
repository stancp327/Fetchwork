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
    {
      label:       '24h',
      ms:          WINDOW_24H,
      sentField:   'smsReminder24hSent',
      template:    SMS.bookingReminder24h,
      getTimeStr:  (occ) => occ.localStartWallclock?.split('T')[0] || '',
    },
    {
      label:       '1h',
      ms:          WINDOW_1H,
      sentField:   'smsReminder1hSent',
      template:    SMS.bookingReminder1h,
      getTimeStr:  (occ) => occ.localStartWallclock?.split('T')[1]?.slice(0, 5) || '',
    },
  ];

  for (const { ms, sentField, template, getTimeStr } of windows) {
    const windowStart = new Date(now + ms - BUFFER);
    const windowEnd   = new Date(now + ms + BUFFER);

    const occurrences = await db.bookingOccurrence.findMany({
      where: {
        startAtUtc: { gte: windowStart, lte: windowEnd }, // UTC DateTime — timezone-correct
        status: 'confirmed',
        [sentField]: false, // haven't sent this reminder yet
      },
      include: { booking: true },
      take: 200,
    });

    for (const occ of occurrences) {
      try {
        const { booking } = occ;
        const timeStr = getTimeStr(occ);

        const [client, freelancer] = await Promise.all([
          User.findById(booking.clientId).select('phone preferences firstName'),
          User.findById(booking.freelancerId).select('phone preferences firstName'),
        ]);

        const msg = template('your upcoming session', timeStr);

        await Promise.all([
          client     ? notifyUser(client,     'bookingReminders', msg) : null,
          freelancer ? notifyUser(freelancer,  'bookingReminders', msg) : null,
        ]);

        // Mark this specific reminder as sent
        await db.bookingOccurrence.update({
          where: { id: occ.id },
          data:  { [sentField]: true },
        });
      } catch (err) {
        console.error('[bookingReminders] occurrence', occ.id, err.message);
      }
    }
  }
};

module.exports = { sendBookingReminders };
