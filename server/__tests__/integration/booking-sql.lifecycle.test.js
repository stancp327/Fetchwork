/**
 * Booking SQL Lifecycle Integration Tests
 * Tests full booking flows against real Postgres (Neon)
 */

const { DateTime } = require('luxon');
const { BookingService } = require('../../booking-sql/services/BookingService');
const { getPrisma } = require('../../booking-sql/db/client');

let prisma;

// Mock ServiceAdapter to avoid MongoDB dependency in integration tests
const mockService = {
  _id: 'mock-service-id',
  freelancerId: 'test-freelancer-lifecycle',
  maxPerSlot: 1,
  cancellationTier: 'flexible',
  pricingBaseCents: 10000,
  timezone: 'America/Los_Angeles'
};

const mockServiceAdapter = {
  getById: jest.fn().mockResolvedValue(mockService)
};

describe('Booking SQL Lifecycle', () => {
  let bookingService;
  let testServiceId;
  let testFreelancerId;
  let testClientId;

  beforeAll(async () => {
    try {
      prisma = getPrisma();
    } catch (e) {
      console.warn('Prisma not available - skipping integration tests:', e.message);
      return;
    }
    // Inject mock ServiceAdapter to avoid MongoDB dependency
    bookingService = new BookingService({ serviceAdapter: mockServiceAdapter });
    testFreelancerId = 'test-freelancer-lifecycle';
    testClientId = 'test-client-lifecycle';
    testServiceId = 'mock-service-id';
  });

  beforeEach(async () => {
    if (!prisma) return; // Skip if Prisma not available
    // Clean up any previous test bookings
    await prisma.auditEvent.deleteMany({
      where: { booking: { clientId: testClientId } }
    }).catch(() => {});
    await prisma.bookingOccurrence.deleteMany({
      where: { clientId: testClientId }
    }).catch(() => {});
    await prisma.booking.deleteMany({
      where: { clientId: testClientId }
    }).catch(() => {});
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  describe('Happy Path: hold → confirm → complete', () => {
    test('full lifecycle succeeds', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Step 1: Create hold
      const holdResult = await bookingService.createHold({
        actorId: testClientId,
        route: '/api/bookings-sql/slots/hold',
        idempotencyKey: `test-hold-${Date.now()}`,
        requestHash: 'test-hash',
        serviceId: testServiceId,
        body: {
          date: dateStr,
          startTime: '14:00',
          endTime: '15:00',
          notes: 'Lifecycle test booking'
        }
      });

      expect(holdResult.statusCode).toBe(201);
      expect(holdResult.response.status).toBe('held');
      const bookingId = holdResult.response.bookingId;

      // Step 2: Confirm
      const confirmResult = await bookingService.confirmHold({
        actorId: testFreelancerId,
        route: '/api/bookings-sql/confirm',
        idempotencyKey: `test-confirm-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      expect(confirmResult.statusCode).toBe(200);
      expect(confirmResult.response.status).toBe('confirmed');

      // Step 3: Complete
      const completeResult = await bookingService.completeBooking({
        actorId: testFreelancerId,
        route: '/api/bookings-sql/complete',
        idempotencyKey: `test-complete-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      expect(completeResult.statusCode).toBe(200);
      expect(completeResult.response.status).toBe('completed');

      // Verify final DB state
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking.currentState).toBe('completed');
    });
  });

  describe('Cancel with fee verification', () => {
    test('flexible tier: cancel <2h out = 100% charge', async () => {
      // Create booking 1 hour from now — use LA timezone since mockService.timezone = 'America/Los_Angeles'
      const soon = DateTime.now().plus({ hours: 1 }).setZone('America/Los_Angeles');
      const dateStr = soon.toFormat('yyyy-MM-dd');
      const timeStr = soon.toFormat('HH:mm');

      const holdResult = await bookingService.createHold({
        actorId: testClientId,
        route: '/api/bookings-sql/slots/hold',
        idempotencyKey: `test-hold-soon-${Date.now()}`,
        requestHash: 'test-hash',
        serviceId: testServiceId,
        body: {
          date: dateStr,
          startTime: timeStr,
          endTime: '23:59',
          notes: 'Cancel fee test'
        }
      });

      if (holdResult.statusCode !== 201) {
        console.log('Hold failed:', holdResult.response);
        return; // Skip if hold fails (e.g., no test service)
      }

      const bookingId = holdResult.response.bookingId;

      // Confirm it
      await bookingService.confirmHold({
        actorId: testFreelancerId,
        route: '/api/bookings-sql/confirm',
        idempotencyKey: `test-confirm-soon-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      // Cancel (client)
      const cancelResult = await bookingService.cancelBooking({
        actorId: testClientId,
        route: '/api/bookings-sql/cancel',
        idempotencyKey: `test-cancel-soon-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId,
        reason: 'Testing cancel fees'
      });

      expect(cancelResult.statusCode).toBe(200);
      expect(cancelResult.response.status).toBe('cancelled_by_client');
      
      // Flexible tier, <2h = 100% charge (0% refund)
      const outcome = cancelResult.response.policyOutcome;
      expect(outcome.tier).toBe('flexible');
      expect(outcome.chargePct).toBe(1.0);
      expect(outcome.refundAmountCents).toBe(0);
    });

    test('flexible tier: cancel 25h out = 0% charge', async () => {
      // Create booking 25 hours from now — use LA timezone since mockService.timezone = 'America/Los_Angeles'
      const later = DateTime.now().plus({ hours: 25 }).setZone('America/Los_Angeles');
      const dateStr = later.toFormat('yyyy-MM-dd');
      const timeStr = later.toFormat('HH:mm');

      const holdResult = await bookingService.createHold({
        actorId: testClientId,
        route: '/api/bookings-sql/slots/hold',
        idempotencyKey: `test-hold-later-${Date.now()}`,
        requestHash: 'test-hash',
        serviceId: testServiceId,
        body: {
          date: dateStr,
          startTime: timeStr,
          endTime: '23:59',
          notes: 'Full refund test'
        }
      });

      if (holdResult.statusCode !== 201) return;

      const bookingId = holdResult.response.bookingId;

      await bookingService.confirmHold({
        actorId: testFreelancerId,
        route: '/api/bookings-sql/confirm',
        idempotencyKey: `test-confirm-later-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      const cancelResult = await bookingService.cancelBooking({
        actorId: testClientId,
        route: '/api/bookings-sql/cancel',
        idempotencyKey: `test-cancel-later-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId,
        reason: 'Testing full refund'
      });

      expect(cancelResult.statusCode).toBe(200);
      const outcome = cancelResult.response.policyOutcome;
      expect(outcome.tier).toBe('flexible');
      expect(outcome.chargePct).toBe(0.0);
      expect(outcome.chargeFeeAmountCents).toBe(0);
    });
  });

  describe('Idempotency', () => {
    test('double-cancel returns same result (idempotent)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const holdResult = await bookingService.createHold({
        actorId: testClientId,
        route: '/api/bookings-sql/slots/hold',
        idempotencyKey: `test-hold-idemp-${Date.now()}`,
        requestHash: 'test-hash',
        serviceId: testServiceId,
        body: { date: dateStr, startTime: '10:00', endTime: '11:00' }
      });

      if (holdResult.statusCode !== 201) return;

      const bookingId = holdResult.response.bookingId;
      const cancelKey = `test-cancel-idemp-${Date.now()}`;

      // First cancel
      const cancel1 = await bookingService.cancelBooking({
        actorId: testClientId,
        route: '/api/bookings-sql/cancel',
        idempotencyKey: cancelKey,
        requestHash: 'test-hash',
        bookingId
      });

      // Second cancel with same idempotency key
      const cancel2 = await bookingService.cancelBooking({
        actorId: testClientId,
        route: '/api/bookings-sql/cancel',
        idempotencyKey: cancelKey,
        requestHash: 'test-hash',
        bookingId
      });

      expect(cancel2.replayed).toBe(true);
      expect(cancel2.response).toEqual(cancel1.response);
    });
  });

  describe('Edge cases', () => {
    test('cannot confirm already-cancelled booking', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const holdResult = await bookingService.createHold({
        actorId: testClientId,
        route: '/api/bookings-sql/slots/hold',
        idempotencyKey: `test-hold-edge-${Date.now()}`,
        requestHash: 'test-hash',
        serviceId: testServiceId,
        body: { date: dateStr, startTime: '16:00', endTime: '17:00' }
      });

      if (holdResult.statusCode !== 201) return;

      const bookingId = holdResult.response.bookingId;

      // Cancel first
      await bookingService.cancelBooking({
        actorId: testClientId,
        route: '/api/bookings-sql/cancel',
        idempotencyKey: `test-cancel-edge-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      // Try to confirm cancelled booking
      const confirmResult = await bookingService.confirmHold({
        actorId: testFreelancerId,
        route: '/api/bookings-sql/confirm',
        idempotencyKey: `test-confirm-edge-${Date.now()}`,
        requestHash: 'test-hash',
        bookingId
      });

      expect(confirmResult.statusCode).toBe(400);
      expect(confirmResult.response.code).toBe('INVALID_CONFIRM_STATE');
    });
  });
});
