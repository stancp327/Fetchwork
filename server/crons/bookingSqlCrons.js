/**
 * bookingSqlCrons.js — SQL booking crons (replaces Mongo crons when BOOKING_SQL_ENABLED=true)
 *
 * 1. Expire stale holds (every minute)
 * 2. Send booking notifications on state changes
 */

const cron = require('node-cron');

let getPrisma;
try {
  getPrisma = require('../booking-sql/db/client').getPrisma;
} catch (_) {
  console.warn('[bookingSqlCrons] booking-sql module not available — SQL crons disabled');
}

function initBookingSqlCrons() {
  if (!getPrisma) return;

  // ── 1. Expire stale holds every minute ────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const prisma = getPrisma();
      const now = new Date();

      // Find and expire held bookings past their TTL
      const expired = await prisma.booking.updateMany({
        where: {
          currentState: 'held',
          holdExpiresAt: { lt: now },
        },
        data: {
          currentState: 'cancelled_by_client',
        },
      });

      if (expired.count > 0) {
        console.log(`[holdExpiry] Expired ${expired.count} stale SQL hold(s)`);

        // Also update the corresponding occurrences
        await prisma.bookingOccurrence.updateMany({
          where: {
            booking: {
              currentState: 'cancelled_by_client',
              holdExpiresAt: { lt: now },
            },
            status: 'held',
          },
          data: { status: 'cancelled' },
        });
      }
    } catch (err) {
      console.error('[holdExpiry] Error expiring SQL holds:', err.message);
    }
  });

  console.log('[bookingSqlCrons] ✅ SQL booking crons initialized (hold expiry)');
}

module.exports = { initBookingSqlCrons };
