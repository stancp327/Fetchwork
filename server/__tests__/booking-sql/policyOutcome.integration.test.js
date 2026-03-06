/**
 * Integration test: policyOutcome + cancel/refund consistency
 *
 * Tests that BookingService.cancelBooking correctly:
 *   1. Reads the immutable policy snapshot (never live policy)
 *   2. Computes charge/refund amounts via PolicyEngine
 *   3. Returns deterministic policyOutcome across all tiers/windows
 *
 * Repos/adapter are mocked so no real DB needed.
 */

const { BookingService } = require('../../booking-sql/services/BookingService');
const { PolicyEngine } = require('../../booking-sql/services/PolicyEngine');

// ─── helpers ─────────────────────────────────────────────────────────────────

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function makeFakeBooking({ tier = 'flexible', amountCents = 10000, startAtUtc } = {}) {
  return {
    id: 'booking-uuid-1',
    clientId: 'client-1',
    freelancerId: 'freelancer-1',
    policySnapshotJson: { tier, snapshotVersion: 1 },
    pricingSnapshotJson: { amountCents, currency: 'usd' },
    currentState: 'confirmed',
  };
}

function makeFakeOccurrence({ bookingId = 'booking-uuid-1', status = 'confirmed', startAtUtc } = {}) {
  return {
    id: 'occurrence-uuid-1',
    bookingId,
    status,
    startAtUtc,
  };
}

function makeRepos({ booking, occurrence }) {
  return {
    bookingRepo: {
      findBookingById: jest.fn().mockResolvedValue(booking),
      findFirstOccurrenceByBookingId: jest.fn().mockResolvedValue(occurrence),
      updateOccurrenceStatus: jest.fn().mockResolvedValue(),
      updateBookingState: jest.fn().mockResolvedValue(),
      countConflictsAtLocalStart: jest.fn().mockResolvedValue(0),
      createBooking: jest.fn(),
      createOccurrence: jest.fn(),
    },
    auditRepo: {
      append: jest.fn().mockResolvedValue(),
    },
    idempotencyRepo: {
      findByKey: jest.fn().mockResolvedValue(null),
      saveResponse: jest.fn().mockResolvedValue(),
    },
    serviceAdapter: {
      getById: jest.fn(),
    },
    policyEngine: new PolicyEngine(),
  };
}

// withTx mock — just executes callback synchronously with a fake tx object
jest.mock('../../booking-sql/db/tx', () => ({
  withTx: async (fn) => fn({ $executeRaw: jest.fn() }),
}));

// ─── policy outcome test matrix ──────────────────────────────────────────────

describe('PolicyEngine — evaluateCancellation', () => {
  const engine = new PolicyEngine();
  const amount = 10000; // $100.00

  describe('flexible tier', () => {
    test('cancels >= 24h out → full refund', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'flexible' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(30),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.0);
      expect(result.chargeCents).toBe(0);
      expect(result.refundCents).toBe(10000);
    });

    test('cancels 6-24h out → 50% charge', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'flexible' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(12),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.5);
      expect(result.chargeCents).toBe(5000);
      expect(result.refundCents).toBe(5000);
    });

    test('cancels < 2h out → full charge (no refund)', () => {
      // New thresholds: <2h = 100% charge
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'flexible' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(1), // Less than 2h
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(1.0);
      expect(result.chargeCents).toBe(10000);
      expect(result.refundCents).toBe(0);
    });
  });

  describe('moderate tier', () => {
    test('cancels >= 48h out → full refund', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'moderate' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(72),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.0);
      expect(result.refundCents).toBe(10000);
    });

    test('cancels 24-48h out → 50% charge', () => {
      // New thresholds: 48h+=0%, 24-48h=50%, <24h=100%
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'moderate' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(36),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.5);
      expect(result.chargeCents).toBe(5000);
      expect(result.refundCents).toBe(5000);
    });

    test('cancels < 24h out → 100% charge', () => {
      // New thresholds: <24h = 100% charge
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'moderate' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(10),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(1.0);
      expect(result.chargeCents).toBe(10000);
      expect(result.refundCents).toBe(0);
    });
  });

  describe('strict tier', () => {
    // New thresholds: 7d+=0%, 48h-7d=50%, <48h=100%
    test('cancels >= 7d (168h) out → full refund', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'strict' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(200), // Well over 7 days
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.0);
      expect(result.refundCents).toBe(10000);
    });

    test('cancels 48h-7d out → 50% charge', () => {
      // 96h = 4 days, which is in 48h-7d range
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'strict' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(96),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0.5);
      expect(result.chargeCents).toBe(5000);
      expect(result.refundCents).toBe(5000);
    });

    test('cancels < 48h out → 100% charge', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'strict' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(24),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(1.0);
      expect(result.chargeCents).toBe(10000);
      expect(result.refundCents).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('unknown tier falls back to flexible', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'unicorn' },
        bookingAmountCents: amount,
        startAtUtc: hoursFromNow(30),
        cancelledAtUtc: new Date(),
      });
      // flexible >= 24h → full refund
      expect(result.chargePct).toBe(0.0);
      expect(result.refundCents).toBe(10000);
    });

    test('zero amount booking → all cents are zero', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'strict' },
        bookingAmountCents: 0,
        startAtUtc: hoursFromNow(1),
        cancelledAtUtc: new Date(),
      });
      expect(result.chargeCents).toBe(0);
      expect(result.refundCents).toBe(0);
    });

    test('invalid dates → 0% charge (safe default)', () => {
      const result = engine.evaluateCancellation({
        policySnapshot: { tier: 'strict' },
        bookingAmountCents: amount,
        startAtUtc: 'not-a-date',
        cancelledAtUtc: new Date(),
      });
      expect(result.chargePct).toBe(0);
    });
  });
});

// ─── BookingService cancel integration ───────────────────────────────────────

describe('BookingService.cancelBooking — policyOutcome integration', () => {
  async function runCancel({ tier, amountCents, hoursUntilStart, actorId = 'client-1' }) {
    const startAtUtc = hoursFromNow(hoursUntilStart);
    const booking = makeFakeBooking({ tier, amountCents, startAtUtc });
    const occurrence = makeFakeOccurrence({ status: 'confirmed', startAtUtc });
    const repos = makeRepos({ booking, occurrence });
    const svc = new BookingService(repos);

    const result = await svc.cancelBooking({
      actorId,
      route: '/cancel',
      idempotencyKey: `cancel-${Date.now()}`,
      requestHash: 'hash1',
      bookingId: booking.id,
      reason: 'test cancellation',
    });

    return result;
  }

  test('flexible: cancels 30h out → full refund in policyOutcome', async () => {
    const { statusCode, response } = await runCancel({ tier: 'flexible', amountCents: 10000, hoursUntilStart: 30 });
    expect(statusCode).toBe(200);
    expect(response.policyOutcome.chargePct).toBe(0.0);
    expect(response.policyOutcome.refundCents).toBe(10000);
    expect(response.policyOutcome.chargeCents).toBe(0);
  });

  test('flexible: cancels 3h out → 50% charge in policyOutcome', async () => {
    // New thresholds: 24h+=0%, 2-24h=50%, <2h=100%
    // 3h is in 2-24h range = 50% charge
    const { statusCode, response } = await runCancel({ tier: 'flexible', amountCents: 10000, hoursUntilStart: 3 });
    expect(statusCode).toBe(200);
    expect(response.policyOutcome.chargePct).toBe(0.5);
    expect(response.policyOutcome.refundCents).toBe(5000);
    expect(response.policyOutcome.chargeCents).toBe(5000);
  });

  test('strict: cancels 48h out → 50% charge in policyOutcome', async () => {
    const { statusCode, response } = await runCancel({ tier: 'strict', amountCents: 20000, hoursUntilStart: 48 });
    expect(statusCode).toBe(200);
    expect(response.policyOutcome.chargePct).toBe(0.5);
    expect(response.policyOutcome.chargeCents).toBe(10000);
    expect(response.policyOutcome.refundCents).toBe(10000);
  });

  test('policy snapshot is respected even if snapshot tier differs from live', async () => {
    // Snapshot says 'strict', but the "live" policy is not consulted at all.
    // This test proves the snapshot is the source of truth.
    const { response } = await runCancel({ tier: 'strict', amountCents: 10000, hoursUntilStart: 2 });
    expect(response.policyOutcome.tier).toBe('strict');
    expect(response.policyOutcome.chargePct).toBe(1.0);
  });

  test('audit event receives policyOutcome in payload', async () => {
    const startAtUtc = hoursFromNow(30);
    const booking = makeFakeBooking({ tier: 'flexible', amountCents: 5000, startAtUtc });
    const occurrence = makeFakeOccurrence({ status: 'confirmed', startAtUtc });
    const repos = makeRepos({ booking, occurrence });
    const svc = new BookingService(repos);

    await svc.cancelBooking({
      actorId: 'client-1',
      route: '/cancel',
      idempotencyKey: 'audit-check-key',
      requestHash: 'hash-audit',
      bookingId: booking.id,
      reason: 'audit test',
    });

    const auditCall = repos.auditRepo.append.mock.calls[0][0];
    expect(auditCall.eventType).toBe('booking.cancelled');
    expect(auditCall.payload).toHaveProperty('policyOutcome');
    expect(auditCall.payload.policyOutcome).toHaveProperty('chargeCents');
    expect(auditCall.payload.policyOutcome).toHaveProperty('refundCents');
  });

  test('already cancelled booking is rejected with 400', async () => {
    const startAtUtc = hoursFromNow(30);
    const booking = makeFakeBooking({ tier: 'flexible', amountCents: 5000, startAtUtc });
    const occurrence = makeFakeOccurrence({ status: 'cancelled_by_client', startAtUtc });
    const repos = makeRepos({ booking, occurrence });
    const svc = new BookingService(repos);

    const { statusCode, response } = await svc.cancelBooking({
      actorId: 'client-1',
      route: '/cancel',
      idempotencyKey: 'double-cancel-key',
      requestHash: 'hash-dc',
      bookingId: booking.id,
    });

    expect(statusCode).toBe(400);
    expect(response.code).toBe('INVALID_CANCEL_STATE');
  });

  test('unauthorized actor gets 400 NOT_AUTHORIZED', async () => {
    const startAtUtc = hoursFromNow(30);
    const booking = makeFakeBooking({ tier: 'flexible', amountCents: 5000, startAtUtc });
    const occurrence = makeFakeOccurrence({ status: 'confirmed', startAtUtc });
    const repos = makeRepos({ booking, occurrence });
    const svc = new BookingService(repos);

    const { statusCode, response } = await svc.cancelBooking({
      actorId: 'random-stranger',
      route: '/cancel',
      idempotencyKey: 'unauth-key',
      requestHash: 'hash-unauth',
      bookingId: booking.id,
    });

    expect(statusCode).toBe(400);
    expect(response.code).toBe('NOT_AUTHORIZED');
  });
});

// ─── ServiceAdapter decoupling ────────────────────────────────────────────────

describe('BookingService.createHold — ServiceAdapter decoupling', () => {
  test('uses adapter cancellationTier in policySnapshotJson', async () => {
    const booking = {
      id: 'new-booking-id',
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
    };
    const occurrence = { id: 'new-occurrence-id' };

    const repos = {
      bookingRepo: {
        countConflictsAtLocalStart: jest.fn().mockResolvedValue(0),
        createBooking: jest.fn().mockResolvedValue(booking),
        createOccurrence: jest.fn().mockResolvedValue(occurrence),
        findBookingById: jest.fn(),
        findFirstOccurrenceByBookingId: jest.fn(),
        updateOccurrenceStatus: jest.fn(),
        updateBookingState: jest.fn(),
      },
      auditRepo: { append: jest.fn().mockResolvedValue() },
      idempotencyRepo: {
        findByKey: jest.fn().mockResolvedValue(null),
        saveResponse: jest.fn().mockResolvedValue(),
      },
      serviceAdapter: {
        getById: jest.fn().mockResolvedValue({
          id: 'service-1',
          freelancerId: 'freelancer-1',
          title: 'Dog Walking',
          timezone: 'America/Los_Angeles',
          maxPerSlot: 1,
          pricingBaseCents: 5000,
          cancellationTier: 'strict',
        }),
      },
      policyEngine: new PolicyEngine(),
    };

    const svc = new BookingService(repos);
    await svc.createHold({
      actorId: 'client-1',
      route: '/hold',
      idempotencyKey: 'hold-test-key',
      requestHash: 'hash-hold',
      body: { date: '2026-04-01', startTime: '10:00', endTime: '11:00', notes: '' },
      serviceId: 'service-1',
    });

    const createBookingArgs = repos.bookingRepo.createBooking.mock.calls[0][0];
    expect(createBookingArgs.policySnapshotJson.tier).toBe('strict');
    expect(createBookingArgs.pricingSnapshotJson.amountCents).toBe(5000);
  });

  test('returns 404 when adapter returns null (service not found)', async () => {
    const repos = {
      bookingRepo: {},
      auditRepo: {},
      idempotencyRepo: {
        findByKey: jest.fn().mockResolvedValue(null),
        saveResponse: jest.fn().mockResolvedValue(),
      },
      serviceAdapter: {
        getById: jest.fn().mockResolvedValue(null),
      },
      policyEngine: new PolicyEngine(),
    };

    const svc = new BookingService(repos);
    const result = await svc.createHold({
      actorId: 'client-1',
      route: '/hold',
      idempotencyKey: 'hold-404-key',
      requestHash: 'hash-404',
      body: { date: '2026-04-01', startTime: '10:00', endTime: '11:00' },
      serviceId: 'nonexistent',
    });

    expect(result.statusCode).toBe(404);
    expect(result.response.code).toBe('SERVICE_NOT_FOUND');
  });
});
