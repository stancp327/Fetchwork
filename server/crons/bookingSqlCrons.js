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

  // Circuit breaker: back off when Neon is unreachable
  let consecutiveFailures = 0;
  let backoffUntil = null;
  const BACKOFF_AFTER = 3;        // failures before backing off
  const BACKOFF_MINUTES = 15;     // how long to wait before retrying

  // ── 1. Expire stale holds every minute ────────────────────────
  cron.schedule('* * * * *', async () => {
    // If in backoff window, skip silently
    if (backoffUntil && new Date() < backoffUntil) return;

    try {
      const prisma = getPrisma();
      const now = new Date();

      const expired = await prisma.booking.updateMany({
        where: {
          currentState: 'held',
          holdExpiresAt: { lt: now },
        },
        data: {
          currentState: 'cancelled_by_client',
        },
      });

      // Reset circuit breaker on success
      if (consecutiveFailures > 0) {
        console.log('[holdExpiry] Neon reconnected — resuming hold expiry cron');
        consecutiveFailures = 0;
        backoffUntil = null;
      }

      if (expired.count > 0) {
        console.log(`[holdExpiry] Expired ${expired.count} stale SQL hold(s)`);

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
      consecutiveFailures++;
      if (consecutiveFailures === BACKOFF_AFTER) {
        backoffUntil = new Date(Date.now() + BACKOFF_MINUTES * 60 * 1000);
        console.warn(`[holdExpiry] Neon unreachable after ${BACKOFF_AFTER} attempts — backing off ${BACKOFF_MINUTES}min. Check console.neon.tech`);
      } else if (consecutiveFailures < BACKOFF_AFTER) {
        console.error('[holdExpiry] Error expiring SQL holds:', err.message);
      }
      // Silence errors during backoff window
    }
  });

  console.log('[bookingSqlCrons] ✅ SQL booking crons initialized (hold expiry)');
}

module.exports = { initBookingSqlCrons };
