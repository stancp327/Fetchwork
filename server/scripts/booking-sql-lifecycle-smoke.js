require('dotenv').config();

const { bookingSqlHealthcheck } = require('../booking-sql/db/healthcheck');
const { BookingRepo } = require('../booking-sql/repos/BookingRepo');
const { BookingService } = require('../booking-sql/services/BookingService');
const { getPrisma } = require('../booking-sql/db/client');

function futureIso(hoursAhead) {
  return new Date(Date.now() + hoursAhead * 3600_000);
}

async function seedHeldBooking({ ref, clientId, freelancerId }) {
  const repo = new BookingRepo();
  const booking = await repo.createBooking({
    bookingRef: ref,
    clientId,
    freelancerId,
    policySnapshotJson: { tier: 'moderate', snapshotVersion: 1 },
    pricingSnapshotJson: { amountCents: 12000, currency: 'usd' },
    currentState: 'held',
    notes: 'lifecycle smoke seed',
  });

  const start = futureIso(48);
  const end = futureIso(49);

  const occurrence = await repo.createOccurrence({
    bookingId: booking.id,
    occurrenceNo: 1,
    clientId,
    freelancerId,
    startAtUtc: start,
    endAtUtc: end,
    timezone: 'UTC',
    localStartWallclock: start.toISOString().slice(0, 16),
    localEndWallclock: end.toISOString().slice(0, 16),
    status: 'held',
  });

  return { booking, occurrence };
}

(async () => {
  const prisma = getPrisma();
  const service = new BookingService();
  const createdBookingIds = [];

  try {
    const health = await bookingSqlHealthcheck();
    if (!health.ok) {
      throw new Error(`DB healthcheck failed: ${health.error || 'unknown'}`);
    }

    // Flow A: held -> confirmed -> completed
    const a = await seedHeldBooking({
      ref: `lifeA_${Date.now()}`,
      clientId: 'life-client-a',
      freelancerId: 'life-freelancer-a',
    });
    createdBookingIds.push(a.booking.id);

    const confirmA = await service.confirmHold({
      actorId: 'life-freelancer-a',
      route: 'SMOKE:confirm:A',
      idempotencyKey: `smoke-confirm-a-${Date.now()}`,
      requestHash: 'smoke',
      bookingId: a.booking.id,
    });
    if (confirmA.statusCode !== 200) throw new Error(`Flow A confirm failed: ${JSON.stringify(confirmA.response)}`);

    const completeA = await service.completeBooking({
      actorId: 'life-freelancer-a',
      route: 'SMOKE:complete:A',
      idempotencyKey: `smoke-complete-a-${Date.now()}`,
      requestHash: 'smoke',
      bookingId: a.booking.id,
    });
    if (completeA.statusCode !== 200) throw new Error(`Flow A complete failed: ${JSON.stringify(completeA.response)}`);

    // Flow B: held -> confirmed -> cancelled_by_client
    const b = await seedHeldBooking({
      ref: `lifeB_${Date.now()}`,
      clientId: 'life-client-b',
      freelancerId: 'life-freelancer-b',
    });
    createdBookingIds.push(b.booking.id);

    const confirmB = await service.confirmHold({
      actorId: 'life-freelancer-b',
      route: 'SMOKE:confirm:B',
      idempotencyKey: `smoke-confirm-b-${Date.now()}`,
      requestHash: 'smoke',
      bookingId: b.booking.id,
    });
    if (confirmB.statusCode !== 200) throw new Error(`Flow B confirm failed: ${JSON.stringify(confirmB.response)}`);

    const cancelB = await service.cancelBooking({
      actorId: 'life-client-b',
      route: 'SMOKE:cancel:B',
      idempotencyKey: `smoke-cancel-b-${Date.now()}`,
      requestHash: 'smoke',
      bookingId: b.booking.id,
      reason: 'smoke test',
    });
    if (cancelB.statusCode !== 200) throw new Error(`Flow B cancel failed: ${JSON.stringify(cancelB.response)}`);

    console.log('Booking SQL lifecycle smoke PASS');
    process.exit(0);
  } catch (err) {
    console.error('Booking SQL lifecycle smoke FAIL:', err?.message || err);
    process.exit(1);
  } finally {
    if (createdBookingIds.length > 0) {
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
  }
})();
