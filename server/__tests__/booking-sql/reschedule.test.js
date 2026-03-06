/**
 * Reschedule Engine Tests
 * Tests reschedule policy evaluation and booking rescheduling.
 */

const { PolicyEngine } = require('../../booking-sql/services/PolicyEngine');
const { BookingService } = require('../../booking-sql/services/BookingService');

describe('PolicyEngine - Reschedule', () => {
  const engine = new PolicyEngine();
  const amount = 10000; // $100

  describe('evaluateReschedule', () => {
    describe('Flexible tier', () => {
      test('free if >= 6h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-05T07:00:00Z'); // 7h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'flexible' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
          rescheduleCount: 0,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(true);
        expect(result.feeCents).toBe(0);
      });

      test('5% fee if < 6h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-05T05:00:00Z'); // 5h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'flexible' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(false);
        expect(result.feePct).toBe(0.05);
        expect(result.feeCents).toBe(500); // $5
      });

      test('max 2 reschedules', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-06T00:00:00Z');
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'flexible' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
          rescheduleCount: 2, // Already rescheduled twice
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/maximum/i);
      });
    });

    describe('Moderate tier', () => {
      test('free if >= 24h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-06T01:00:00Z'); // 25h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'moderate' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(true);
        expect(result.feeCents).toBe(0);
      });

      test('10% fee if < 24h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-05T20:00:00Z'); // 20h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'moderate' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(false);
        expect(result.feePct).toBe(0.10);
        expect(result.feeCents).toBe(1000); // $10
      });

      test('max 2 reschedules', () => {
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'moderate' },
          bookingAmountCents: amount,
          startAtUtc: new Date('2026-03-06T00:00:00Z'),
          rescheduleAtUtc: new Date('2026-03-05T00:00:00Z'),
          rescheduleCount: 2,
        });

        expect(result.allowed).toBe(false);
      });
    });

    describe('Strict tier', () => {
      test('free if >= 48h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-07T01:00:00Z'); // 49h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'strict' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(true);
      });

      test('10% fee if < 48h out', () => {
        const now = new Date('2026-03-05T00:00:00Z');
        const start = new Date('2026-03-06T20:00:00Z'); // 44h out
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'strict' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(true);
        expect(result.free).toBe(false);
        expect(result.feeCents).toBe(1000);
      });

      test('max 1 reschedule only', () => {
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'strict' },
          bookingAmountCents: amount,
          startAtUtc: new Date('2026-03-06T00:00:00Z'),
          rescheduleAtUtc: new Date('2026-03-05T00:00:00Z'),
          rescheduleCount: 1, // Already rescheduled once
        });

        expect(result.allowed).toBe(false);
        expect(result.maxReschedules).toBe(1);
      });
    });

    describe('Edge cases', () => {
      test('cannot reschedule past bookings', () => {
        const now = new Date('2026-03-06T00:00:00Z');
        const start = new Date('2026-03-05T00:00:00Z'); // In the past
        
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'flexible' },
          bookingAmountCents: amount,
          startAtUtc: start,
          rescheduleAtUtc: now,
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/past/i);
      });

      test('handles invalid dates', () => {
        const result = engine.evaluateReschedule({
          policySnapshot: { tier: 'flexible' },
          bookingAmountCents: amount,
          startAtUtc: 'invalid',
          rescheduleAtUtc: new Date(),
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/invalid/i);
      });
    });
  });
});

describe('BookingService - rescheduleBooking', () => {
  const mockBooking = {
    id: 'booking-1',
    clientId: 'client-1',
    freelancerId: 'freelancer-1',
    serviceOfferingId: 'service-1',
    policySnapshotJson: { tier: 'flexible' },
    pricingSnapshotJson: { amountCents: 10000 },
    currentState: 'confirmed',
  };

  const mockOccurrence = {
    id: 'occ-1',
    bookingId: 'booking-1',
    status: 'confirmed',
    startAtUtc: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
    endAtUtc: new Date(Date.now() + 49 * 60 * 60 * 1000),
    localStartWallclock: '2026-03-08T10:00',
    localEndWallclock: '2026-03-08T11:00',
  };

  function createMockService() {
    return new BookingService({
      bookingRepo: {
        findBookingById: jest.fn().mockResolvedValue(mockBooking),
        findFirstOccurrenceByBookingId: jest.fn().mockResolvedValue(mockOccurrence),
        countConflictsAtLocalStart: jest.fn().mockResolvedValue(0),
        updateOccurrenceTimes: jest.fn().mockResolvedValue(mockOccurrence),
      },
      auditRepo: {
        countByEventType: jest.fn().mockResolvedValue(0),
        append: jest.fn().mockResolvedValue({ id: 1 }),
      },
      idempotencyRepo: {
        findByKey: jest.fn().mockResolvedValue(null),
        saveResponse: jest.fn().mockResolvedValue({}),
      },
      serviceAdapter: {
        getById: jest.fn().mockResolvedValue({ maxPerSlot: 1 }),
      },
    });
  }

  test('successfully reschedules booking', async () => {
    const service = createMockService();

    const result = await service.rescheduleBooking({
      actorId: 'client-1',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'reschedule-1',
      requestHash: 'hash-1',
      bookingId: 'booking-1',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
      reason: 'Schedule conflict',
    });

    expect(result.statusCode).toBe(200);
    expect(result.response.message).toMatch(/rescheduled/i);
    expect(result.response.policyOutcome.allowed).toBe(true);
    expect(result.response.newTimes.date).toBe('2026-03-10');
  });

  test('returns 404 when booking not found', async () => {
    const service = createMockService();
    service.bookingRepo.findBookingById = jest.fn().mockResolvedValue(null);

    const result = await service.rescheduleBooking({
      actorId: 'client-1',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'reschedule-2',
      requestHash: 'hash-2',
      bookingId: 'missing',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
    });

    expect(result.statusCode).toBe(404);
    expect(result.response.code).toBe('BOOKING_NOT_FOUND');
  });

  test('rejects unauthorized actor', async () => {
    const service = createMockService();

    const result = await service.rescheduleBooking({
      actorId: 'stranger',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'reschedule-3',
      requestHash: 'hash-3',
      bookingId: 'booking-1',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
    });

    expect(result.statusCode).toBe(400);
    expect(result.response.code).toBe('NOT_AUTHORIZED');
  });

  test('rejects when new slot conflicts', async () => {
    const service = createMockService();
    service.bookingRepo.countConflictsAtLocalStart = jest.fn().mockResolvedValue(1);

    const result = await service.rescheduleBooking({
      actorId: 'client-1',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'reschedule-4',
      requestHash: 'hash-4',
      bookingId: 'booking-1',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
    });

    expect(result.statusCode).toBe(400);
    expect(result.response.code).toBe('SLOT_CONFLICT');
  });

  test('rejects when max reschedules reached', async () => {
    const service = createMockService();
    service.auditRepo.countByEventType = jest.fn().mockResolvedValue(2); // Already 2 reschedules

    const result = await service.rescheduleBooking({
      actorId: 'client-1',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'reschedule-5',
      requestHash: 'hash-5',
      bookingId: 'booking-1',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
    });

    expect(result.statusCode).toBe(400);
    expect(result.response.code).toBe('RESCHEDULE_NOT_ALLOWED');
  });

  test('respects idempotency', async () => {
    const service = createMockService();
    service.idempotencyRepo.findByKey = jest.fn().mockResolvedValue({
      statusCode: 200,
      responseJson: { message: 'Already rescheduled' },
    });

    const result = await service.rescheduleBooking({
      actorId: 'client-1',
      route: '/api/bookings-sql/reschedule',
      idempotencyKey: 'same-key',
      requestHash: 'hash',
      bookingId: 'booking-1',
      newDate: '2026-03-10',
      newStartTime: '14:00',
      newEndTime: '15:00',
    });

    expect(result.replayed).toBe(true);
    expect(result.response.message).toBe('Already rescheduled');
  });
});
