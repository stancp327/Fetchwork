require('dotenv').config();

const { withTx } = require('../booking-sql/db/tx');
const { acquireSlotLock } = require('../booking-sql/db/locks');
const { bookingSqlHealthcheck } = require('../booking-sql/db/healthcheck');
const { BookingRepo } = require('../booking-sql/repos/BookingRepo');
const { getPrisma } = require('../booking-sql/db/client');

const bookingRepo = new BookingRepo();

async function attemptHold({ idx, slotKey }) {
  const actorId = `conc-client-${idx}`;
  return withTx(async (tx) => {
    await acquireSlotLock(tx, slotKey);

    const localStartWallclock = slotKey.localStartWallclock;
    const conflictCount = await bookingRepo.countConflictsAtLocalStart({
      freelancerId: slotKey.freelancerId,
      localStartWallclock,
    }, tx);

    if (conflictCount >= 1) return { won: false, reason: 'SLOT_CONFLICT' };

    const booking = await bookingRepo.createBooking({
      bookingRef: `conc_${Date.now()}_${idx}`,
      clientId: actorId,
      freelancerId: slotKey.freelancerId,
      policySnapshotJson: { tier: 'flexible', snapshotVersion: 1 },
      pricingSnapshotJson: { amountCents: 1000, currency: 'usd' },
      currentState: 'held',
      notes: 'concurrency smoke',
    }, tx);

    await bookingRepo.createOccurrence({
      bookingId: booking.id,
      occurrenceNo: 1,
      clientId: actorId,
      freelancerId: slotKey.freelancerId,
      startAtUtc: new Date('2026-03-10T10:00:00Z'),
      endAtUtc: new Date('2026-03-10T11:00:00Z'),
      timezone: 'UTC',
      localStartWallclock,
      localEndWallclock: '2026-03-10T11:00',
      status: 'held',
    }, tx);

    return { won: true, bookingId: booking.id };
  });
}

(async () => {
  const prisma = getPrisma();
  const created = [];
  const slotKey = {
    freelancerId: 'conc-freelancer-1',
    localStartWallclock: '2026-03-10T10:00',
    serviceId: 'conc-service-1',
  };

  try {
    const health = await bookingSqlHealthcheck();
    if (!health.ok) throw new Error(`DB healthcheck failed: ${health.error || 'unknown'}`);

    // Clean stale rows from prior runs for this slot
    const stale = await prisma.bookingOccurrence.findMany({
      where: { freelancerId: slotKey.freelancerId, localStartWallclock: slotKey.localStartWallclock },
      select: { bookingId: true },
    });
    if (stale.length) {
      const staleBookingIds = [...new Set(stale.map((s) => s.bookingId))];
      await prisma.booking.deleteMany({ where: { id: { in: staleBookingIds } } });
    }

    const attempts = await Promise.all(Array.from({ length: 10 }, (_, i) => attemptHold({ idx: i + 1, slotKey })));
    const winners = attempts.filter((a) => a.won);

    if (winners.length !== 1) {
      throw new Error(`Expected exactly 1 winner, got ${winners.length}`);
    }

    created.push(winners[0].bookingId);

    console.log('Booking SQL concurrency smoke PASS (single winner enforced)');
    process.exit(0);
  } catch (err) {
    console.error('Booking SQL concurrency smoke FAIL:', err?.message || err);
    process.exit(1);
  } finally {
    if (created.length) {
      await prisma.booking.deleteMany({ where: { id: { in: created } } });
    }
  }
})();
