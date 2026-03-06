require('dotenv').config();

const { bookingSqlHealthcheck } = require('../booking-sql/db/healthcheck');
const { BookingRepo } = require('../booking-sql/repos/BookingRepo');
const { AuditRepo } = require('../booking-sql/repos/AuditRepo');
const { getPrisma } = require('../booking-sql/db/client');

(async () => {
  try {
    const health = await bookingSqlHealthcheck();
    if (!health.ok) {
      console.error('DB healthcheck failed:', health.error || 'unknown');
      process.exit(1);
    }

    const bookingRepo = new BookingRepo();
    const auditRepo = new AuditRepo();
    const prisma = getPrisma();

    const booking = await bookingRepo.createBooking({
      bookingRef: `smoke_${Date.now()}`,
      clientId: 'smoke-client',
      freelancerId: 'smoke-freelancer',
      policySnapshotJson: { tier: 'flexible', smoke: true },
      pricingSnapshotJson: { amountCents: 1000, currency: 'usd' },
      currentState: 'held',
      notes: 'booking-sql smoke test',
    });

    const occurrence = await bookingRepo.createOccurrence({
      bookingId: booking.id,
      occurrenceNo: 1,
      clientId: 'smoke-client',
      freelancerId: 'smoke-freelancer',
      startAtUtc: new Date(Date.now() + 3600_000),
      endAtUtc: new Date(Date.now() + 7200_000),
      timezone: 'UTC',
      localStartWallclock: '2026-03-05T10:00',
      localEndWallclock: '2026-03-05T11:00',
      status: 'held',
    });

    await auditRepo.append({
      bookingId: booking.id,
      occurrenceId: occurrence.id,
      actorType: 'system',
      actorId: 'smoke-script',
      eventType: 'booking.smoke_created',
      payload: { script: 'booking-sql-smoke' },
    });

    // Cleanup to keep DB tidy
    await prisma.booking.delete({ where: { id: booking.id } });

    console.log('Booking SQL smoke PASS');
    process.exit(0);
  } catch (err) {
    console.error('Booking SQL smoke FAIL:', err?.message || err);
    process.exit(1);
  }
})();
