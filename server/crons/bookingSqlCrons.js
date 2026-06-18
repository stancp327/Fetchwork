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

let bookingEmailService = null;
try { bookingEmailService = require('../services/bookingEmailService'); } catch (_) {}

let SessionService = null;
try { SessionService = require('../services/SessionService'); } catch (_) {}

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

  // ── 2. 24h reminder emails (every 5 minutes) ──────────────────
  cron.schedule('*/5 * * * *', async () => {
    if (!bookingEmailService) return;
    try {
      const prisma = getPrisma();
      const windowStart = new Date(Date.now() + 23.5 * 3600 * 1000);
      const windowEnd   = new Date(Date.now() + 24.5 * 3600 * 1000);

      const occs = await prisma.bookingOccurrence.findMany({
        where: {
          status: 'confirmed',
          smsReminder24hSent: false,
          startAtUtc: { gte: windowStart, lte: windowEnd },
        },
        include: { booking: true },
      });

      for (const occ of occs) {
        try {
          await bookingEmailService.sendBookingReminder(occ.booking, occ, '24h');
          await prisma.bookingOccurrence.updateMany({
            where: { id: occ.id, smsReminder24hSent: false },
            data:  { smsReminder24hSent: true },
          });
        } catch (err) {
          console.error(`[SQL reminder 24h] occurrence ${occ.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[bookingSqlCrons] 24h reminder error:', err.message);
    }
  });

  // ── 3. 1h reminder emails (every 5 minutes) ───────────────────
  cron.schedule('*/5 * * * *', async () => {
    if (!bookingEmailService) return;
    try {
      const prisma = getPrisma();
      const windowStart = new Date(Date.now() + 50 * 60 * 1000);
      const windowEnd   = new Date(Date.now() + 70 * 60 * 1000);

      const occs = await prisma.bookingOccurrence.findMany({
        where: {
          status: 'confirmed',
          smsReminder1hSent: false,
          startAtUtc: { gte: windowStart, lte: windowEnd },
        },
        include: { booking: true },
      });

      for (const occ of occs) {
        try {
          await bookingEmailService.sendBookingReminder(occ.booking, occ, '1h');
          await prisma.bookingOccurrence.updateMany({
            where: { id: occ.id, smsReminder1hSent: false },
            data:  { smsReminder1hSent: true },
          });
        } catch (err) {
          console.error(`[SQL reminder 1h] occurrence ${occ.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[bookingSqlCrons] 1h reminder error:', err.message);
    }
  });

  // ── 4. Review prompt emails (every 15 minutes) ───────────────
  // After a booking completes + 1 hour, email both participants to leave a review
  cron.schedule('*/15 * * * *', async () => {
    if (!bookingEmailService) return;
    try {
      const prisma = getPrisma();
      const oneHourAgo  = new Date(Date.now() - 1 * 3600 * 1000);
      const twentyFourh = new Date(Date.now() - 24 * 3600 * 1000);

      // Occurrences that completed 1-24h ago and haven't had a review prompt sent
      const occs = await prisma.bookingOccurrence.findMany({
        where: {
          status:            'completed',
          reviewPromptSentAt: null,
          endAtUtc: { gte: twentyFourh, lte: oneHourAgo },
        },
        include: { booking: true },
        take: 50,
      });

      for (const occ of occs) {
        try {
          if (bookingEmailService.sendReviewPrompt) {
            await bookingEmailService.sendReviewPrompt(occ.booking, occ);
          }
          await prisma.bookingOccurrence.update({
            where: { id: occ.id },
            data:  { reviewPromptSentAt: new Date() },
          }).catch(() => {}); // Silently ignore if column doesn't exist yet
        } catch (err) {
          console.error(`[SQL review-prompt] occurrence ${occ.id}:`, err.message);
        }
      }
    } catch (err) {
      // reviewPromptSentAt column may not exist until migration — log quietly
      if (!err.message?.includes('reviewPromptSentAt') && !err.message?.includes('column')) {
        console.error('[bookingSqlCrons] review prompt cron error:', err.message);
      }
    }
  });

  // ── 5. Expire pending_payment session holds (Gate 7C-B3) ──
  cron.schedule('*/2 * * * *', async () => {
    if (backoffUntil && new Date() < backoffUntil) return;
    if (!SessionService) return;

    try {
      const count = await SessionService.expireSessionHolds();

      if (consecutiveFailures > 0) {
        console.log('[sessionHoldExpiry] Neon reconnected — resuming session hold expiry cron');
        consecutiveFailures = 0;
        backoffUntil = null;
      }

      if (count > 0) {
        console.log(`[sessionHoldExpiry] Released ${count} expired pending_payment session hold(s)`);
      }
    } catch (err) {
      consecutiveFailures++;
      if (consecutiveFailures === BACKOFF_AFTER) {
        backoffUntil = new Date(Date.now() + BACKOFF_MINUTES * 60 * 1000);
        console.warn(`[sessionHoldExpiry] Neon unreachable after ${BACKOFF_AFTER} attempts — backing off ${BACKOFF_MINUTES}min. Check console.neon.tech`);
      } else if (consecutiveFailures < BACKOFF_AFTER) {
        console.error('[sessionHoldExpiry] Error expiring session holds:', err.message);
      }
    }
  });

  // ── 6. Session completion → release_pending (Gate 16D) ──
  cron.schedule('*/5 * * * *', async () => {
    if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') return;
    if (backoffUntil && new Date() < backoffUntil) return;
    if (!SessionService) return;

    try {
      await SessionService.markCompletedSessionLedgersReleasePending();
    } catch (err) {
      console.error('[sessionCompletion] Cron error:', err.message);
    }
  });

  // ── 7. Auto-release paid session ledgers (Gate 16D) ──
  cron.schedule('*/5 * * * *', async () => {
    if (process.env.PAID_SESSION_LEDGER_ENABLED !== 'true') return;
    if (backoffUntil && new Date() < backoffUntil) return;
    if (!SessionService) return;

    try {
      await SessionService.autoReleasePendingSessionLedgers();
    } catch (err) {
      console.error('[autoRelease] Cron error:', err.message);
    }
  });

  console.log('[bookingSqlCrons] ✅ SQL booking crons initialized (hold expiry + reminders + review prompts + session completion + auto-release)');
}

module.exports = { initBookingSqlCrons };
