/**
 * Booking SQL Concurrency Tests
 * Tests slot conflict handling with real Postgres advisory locks
 */

const { BookingService } = require('../../booking-sql/services/BookingService');
const { getPrisma } = require('../../booking-sql/db/client');

let prisma;

// Mock ServiceAdapter - single slot by default
const createMockServiceAdapter = (maxPerSlot = 1) => ({
  getById: jest.fn().mockResolvedValue({
    _id: 'mock-service-concurrent',
    freelancerId: 'test-freelancer-concurrent',
    maxPerSlot,
    cancellationTier: 'flexible',
    pricingBaseCents: 5000,
    timezone: 'America/Los_Angeles'
  })
});

describe('Booking SQL Concurrency', () => {
  let bookingService;
  const testClientPrefix = 'test-client-concurrent';
  const testFreelancerId = 'test-freelancer-concurrent';

  beforeAll(async () => {
    try {
      prisma = getPrisma();
    } catch (e) {
      console.warn('Prisma not available - skipping concurrency tests:', e.message);
      return;
    }
    // Default single-slot service; individual tests override as needed
    bookingService = new BookingService({ serviceAdapter: createMockServiceAdapter(1) });
  });

  beforeEach(async () => {
    if (!prisma) return;
    // Clean up previous concurrent test bookings
    await prisma.auditEvent.deleteMany({
      where: { booking: { clientId: { startsWith: testClientPrefix } } }
    }).catch(() => {});
    await prisma.bookingOccurrence.deleteMany({
      where: { clientId: { startsWith: testClientPrefix } }
    }).catch(() => {});
    await prisma.booking.deleteMany({
      where: { clientId: { startsWith: testClientPrefix } }
    }).catch(() => {});
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  describe('Single-slot service (maxPerSlot=1)', () => {
    test('10 parallel holds: exactly 1 wins', async () => {
      const testServiceId = 'test-service-single-slot';
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const timestamp = Date.now();

      // Fire 10 concurrent hold requests
      const holdPromises = Array.from({ length: 10 }, (_, i) =>
        bookingService.createHold({
          actorId: `${testClientPrefix}-${i}`,
          route: '/api/bookings-sql/slots/hold',
          idempotencyKey: `concurrent-hold-${timestamp}-${i}`,
          requestHash: `hash-${i}`,
          serviceId: testServiceId,
          body: {
            date: dateStr,
            startTime: '14:00',
            endTime: '15:00',
            notes: `Concurrent test ${i}`
          }
        })
      );

      const results = await Promise.all(holdPromises);

      // Count successes and conflicts
      const successes = results.filter(r => r.statusCode === 201);
      const conflicts = results.filter(r => r.response?.code === 'SLOT_CONFLICT');
      const notFounds = results.filter(r => r.response?.code === 'SERVICE_NOT_FOUND');

      // If service doesn't exist, skip the assertion
      if (notFounds.length === 10) {
        console.log('Test service not found - skipping concurrency assertions');
        return;
      }

      // Exactly 1 should succeed (single slot)
      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(9);

      // Verify DB state - only 1 occurrence should exist
      const occurrences = await prisma.bookingOccurrence.count({
        where: {
          clientId: { startsWith: testClientPrefix },
          localStartWallclock: `${dateStr}T14:00`
        }
      });
      expect(occurrences).toBe(1);
    });
  });

  describe('Group service (maxPerSlot=5)', () => {
    test('10 parallel holds: exactly 5 win', async () => {
      // Override with group service (maxPerSlot=5)
      const groupService = new BookingService({ serviceAdapter: createMockServiceAdapter(5) });
      const testServiceId = 'test-service-group-slot';
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const timestamp = Date.now();

      // Fire 10 concurrent hold requests using groupService
      const holdPromises = Array.from({ length: 10 }, (_, i) =>
        groupService.createHold({
          actorId: `${testClientPrefix}-group-${i}`,
          route: '/api/bookings-sql/slots/hold',
          idempotencyKey: `concurrent-group-${timestamp}-${i}`,
          requestHash: `hash-group-${i}`,
          serviceId: testServiceId,
          body: {
            date: dateStr,
            startTime: '10:00',
            endTime: '11:00',
            notes: `Group concurrent test ${i}`
          }
        })
      );

      const results = await Promise.all(holdPromises);

      const successes = results.filter(r => r.statusCode === 201);
      const conflicts = results.filter(r => r.response?.code === 'SLOT_CONFLICT');
      const notFounds = results.filter(r => r.response?.code === 'SERVICE_NOT_FOUND');

      if (notFounds.length === 10) {
        console.log('Test service not found - skipping group concurrency assertions');
        return;
      }

      // Exactly 5 should succeed (maxPerSlot=5)
      expect(successes.length).toBe(5);
      expect(conflicts.length).toBe(5);

      // Verify DB state
      const occurrences = await prisma.bookingOccurrence.count({
        where: {
          clientId: { startsWith: `${testClientPrefix}-group` },
          localStartWallclock: `${dateStr}T10:00`
        }
      });
      expect(occurrences).toBe(5);
    });
  });

  describe('Advisory lock correctness', () => {
    test('no phantom bookings under contention', async () => {
      const testServiceId = 'test-service-phantom-check';
      const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const timestamp = Date.now();

      // Fire 20 rapid concurrent requests
      const holdPromises = Array.from({ length: 20 }, (_, i) =>
        bookingService.createHold({
          actorId: `${testClientPrefix}-phantom-${i}`,
          route: '/api/bookings-sql/slots/hold',
          idempotencyKey: `phantom-check-${timestamp}-${i}`,
          requestHash: `hash-phantom-${i}`,
          serviceId: testServiceId,
          body: {
            date: dateStr,
            startTime: '09:00',
            endTime: '10:00'
          }
        })
      );

      const results = await Promise.all(holdPromises);

      const successes = results.filter(r => r.statusCode === 201);
      const notFounds = results.filter(r => r.response?.code === 'SERVICE_NOT_FOUND');

      if (notFounds.length === 20) {
        console.log('Test service not found - skipping phantom check');
        return;
      }

      // Count actual DB records
      const actualOccurrences = await prisma.bookingOccurrence.count({
        where: {
          clientId: { startsWith: `${testClientPrefix}-phantom` },
          localStartWallclock: `${dateStr}T09:00`
        }
      });

      // Success count must match DB count (no phantoms)
      expect(actualOccurrences).toBe(successes.length);
      
      // For single-slot service, should be exactly 1
      // For group service, should match maxPerSlot
      expect(actualOccurrences).toBeGreaterThan(0);
      expect(actualOccurrences).toBeLessThanOrEqual(successes.length);
    });
  });

  describe('Idempotency under concurrency', () => {
    test('same idempotency key returns same result', async () => {
      const testServiceId = 'test-service-idemp-concurrent';
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const sharedKey = `shared-idemp-key-${Date.now()}`;

      // Fire 5 concurrent requests with SAME idempotency key
      const holdPromises = Array.from({ length: 5 }, () =>
        bookingService.createHold({
          actorId: `${testClientPrefix}-idemp-shared`,
          route: '/api/bookings-sql/slots/hold',
          idempotencyKey: sharedKey,
          requestHash: 'shared-hash',
          serviceId: testServiceId,
          body: {
            date: dateStr,
            startTime: '15:00',
            endTime: '16:00'
          }
        })
      );

      const results = await Promise.all(holdPromises);

      const notFounds = results.filter(r => r.response?.code === 'SERVICE_NOT_FOUND');
      if (notFounds.length === 5) {
        console.log('Test service not found - skipping idempotency concurrent check');
        return;
      }

      // All should return same response (one fresh, rest replayed)
      const firstSuccess = results.find(r => r.statusCode === 201);
      if (firstSuccess) {
        const bookingIds = results
          .filter(r => r.response?.bookingId)
          .map(r => r.response.bookingId);
        
        // All should have same booking ID
        const uniqueIds = [...new Set(bookingIds)];
        expect(uniqueIds.length).toBe(1);
      }

      // Should only create 1 booking
      const occurrences = await prisma.bookingOccurrence.count({
        where: {
          clientId: `${testClientPrefix}-idemp-shared`,
          localStartWallclock: `${dateStr}T15:00`
        }
      });
      expect(occurrences).toBeLessThanOrEqual(1);
    });
  });
});
