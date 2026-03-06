/**
 * AuditService Tests
 * Tests timeline replay, admin overrides, and dispute evidence packaging.
 */

const { AuditService } = require('../../booking-sql/services/AuditService');

describe('AuditService', () => {
  function createMockPrisma(overrides = {}) {
    return {
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        ...overrides.auditEvent,
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(null),
        ...overrides.booking,
      },
    };
  }

  const mockEvents = [
    {
      id: BigInt(1),
      bookingId: 'booking-1',
      eventType: 'booking.created',
      actorType: 'client',
      actorId: 'client-1',
      occurrenceId: 'occ-1',
      createdAt: new Date('2026-03-01T10:00:00Z'),
      payloadJson: { route: '/api/bookings' },
      payloadHash: 'abc123',
    },
    {
      id: BigInt(2),
      bookingId: 'booking-1',
      eventType: 'booking.confirmed',
      actorType: 'freelancer',
      actorId: 'freelancer-1',
      occurrenceId: 'occ-1',
      createdAt: new Date('2026-03-01T10:05:00Z'),
      payloadJson: { route: '/api/bookings/confirm' },
      payloadHash: 'def456',
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // getBookingTimeline Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBookingTimeline', () => {
    test('returns all events for a booking', async () => {
      const prisma = createMockPrisma({
        auditEvent: { findMany: jest.fn().mockResolvedValue(mockEvents) },
      });

      const service = new AuditService({ prisma });
      const timeline = await service.getBookingTimeline({ bookingId: 'booking-1' });

      expect(timeline).toHaveLength(2);
      expect(timeline[0].eventType).toBe('booking.created');
      expect(timeline[1].eventType).toBe('booking.confirmed');
    });

    test('excludes payload when includePayload is false', async () => {
      const prisma = createMockPrisma({
        auditEvent: { findMany: jest.fn().mockResolvedValue(mockEvents) },
      });

      const service = new AuditService({ prisma });
      const timeline = await service.getBookingTimeline({ 
        bookingId: 'booking-1', 
        includePayload: false,
      });

      expect(timeline[0].payload).toBeUndefined();
      expect(timeline[0].payloadHash).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBookingTimelineFormatted Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBookingTimelineFormatted', () => {
    test('adds human-readable descriptions', async () => {
      const prisma = createMockPrisma({
        auditEvent: { findMany: jest.fn().mockResolvedValue(mockEvents) },
      });

      const service = new AuditService({ prisma });
      const timeline = await service.getBookingTimelineFormatted({ bookingId: 'booking-1' });

      expect(timeline[0].description).toContain('created');
      expect(timeline[1].description).toContain('confirmed');
    });

    test('adds icons to events', async () => {
      const prisma = createMockPrisma({
        auditEvent: { findMany: jest.fn().mockResolvedValue(mockEvents) },
      });

      const service = new AuditService({ prisma });
      const timeline = await service.getBookingTimelineFormatted({ bookingId: 'booking-1' });

      expect(timeline[0].icon).toBe('📝');
      expect(timeline[1].icon).toBe('✅');
    });

    test('adds severity levels', async () => {
      const cancelEvent = [{
        ...mockEvents[0],
        eventType: 'booking.cancelled',
      }];

      const prisma = createMockPrisma({
        auditEvent: { findMany: jest.fn().mockResolvedValue(cancelEvent) },
      });

      const service = new AuditService({ prisma });
      const timeline = await service.getBookingTimelineFormatted({ bookingId: 'booking-1' });

      expect(timeline[0].severity).toBe('warning');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // queryEvents Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('queryEvents', () => {
    test('filters by event types', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          findMany: jest.fn().mockResolvedValue([mockEvents[0]]),
          count: jest.fn().mockResolvedValue(1),
        },
      });

      const service = new AuditService({ prisma });
      const result = await service.queryEvents({
        eventTypes: ['booking.created'],
      });

      expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: { in: ['booking.created'] },
          }),
        })
      );
    });

    test('filters by date range', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      });

      const service = new AuditService({ prisma });
      await service.queryEvents({
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });

      const call = prisma.auditEvent.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2026-03-01'));
      expect(call.where.createdAt.lte).toEqual(new Date('2026-03-31'));
    });

    test('returns pagination info', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          findMany: jest.fn().mockResolvedValue(mockEvents),
          count: jest.fn().mockResolvedValue(50),
        },
      });

      const service = new AuditService({ prisma });
      const result = await service.queryEvents({ limit: 10, offset: 20 });

      expect(result.total).toBe(50);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordAdminOverride Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordAdminOverride', () => {
    test('creates admin override event', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
        },
      });

      const service = new AuditService({ prisma });
      await service.recordAdminOverride({
        bookingId: 'booking-1',
        adminId: 'admin-1',
        action: 'force_complete',
        reason: 'Client confirmed service was delivered',
        changes: { status: 'completed' },
      });

      const call = prisma.auditEvent.create.mock.calls[0][0];
      expect(call.data.actorType).toBe('admin');
      expect(call.data.actorId).toBe('admin-1');
      expect(call.data.eventType).toBe('admin.override');
      expect(call.data.payloadJson.action).toBe('force_complete');
      expect(call.data.payloadJson.reason).toContain('service was delivered');
    });

    test('includes payload hash for integrity', async () => {
      const prisma = createMockPrisma({
        auditEvent: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
      });

      const service = new AuditService({ prisma });
      await service.recordAdminOverride({
        bookingId: 'booking-1',
        adminId: 'admin-1',
        action: 'test',
        reason: 'test',
      });

      const call = prisma.auditEvent.create.mock.calls[0][0];
      expect(call.data.payloadHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // packageDisputeEvidence Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('packageDisputeEvidence', () => {
    test('returns complete evidence package', async () => {
      const mockBooking = {
        id: 'booking-1',
        bookingRef: 'bk_123',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        currentState: 'disputed',
        createdAt: new Date(),
        policySnapshotJson: { tier: 'flexible' },
        pricingSnapshotJson: { amountCents: 10000 },
        occurrences: [{
          id: 'occ-1',
          occurrenceNo: 1,
          startAtUtc: new Date(),
          endAtUtc: new Date(),
          timezone: 'America/Los_Angeles',
          localStartWallclock: '2026-03-10T10:00',
          localEndWallclock: '2026-03-10T11:00',
          status: 'disputed',
        }],
        chargeRecords: [{
          id: 'charge-1',
          amountCents: 10000,
          state: 'captured',
          stripePaymentIntentId: 'pi_123',
          createdAt: new Date(),
        }],
      };

      const prisma = createMockPrisma({
        booking: { findUnique: jest.fn().mockResolvedValue(mockBooking) },
        auditEvent: { findMany: jest.fn().mockResolvedValue(mockEvents) },
      });

      const service = new AuditService({ prisma });
      const evidence = await service.packageDisputeEvidence({ bookingId: 'booking-1' });

      expect(evidence.booking.bookingRef).toBe('bk_123');
      expect(evidence.occurrences).toHaveLength(1);
      expect(evidence.payments).toHaveLength(1);
      expect(evidence.timeline).toHaveLength(2);
      expect(evidence.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(evidence.exportedAt).toBeDefined();
    });

    test('returns error when booking not found', async () => {
      const prisma = createMockPrisma({
        booking: { findUnique: jest.fn().mockResolvedValue(null) },
      });

      const service = new AuditService({ prisma });
      const evidence = await service.packageDisputeEvidence({ bookingId: 'missing' });

      expect(evidence.error).toBe('Booking not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyPayloadIntegrity Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyPayloadIntegrity', () => {
    test('returns valid when hash matches', async () => {
      const crypto = require('crypto');
      const payload = { test: 'data' };
      const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

      const prisma = createMockPrisma({
        auditEvent: {
          findUnique: jest.fn().mockResolvedValue({
            payloadJson: payload,
            payloadHash: hash,
          }),
        },
      });

      const service = new AuditService({ prisma });
      const result = await service.verifyPayloadIntegrity('1');

      expect(result.valid).toBe(true);
      expect(result.reason).toContain('verified');
    });

    test('returns invalid when hash mismatches', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          findUnique: jest.fn().mockResolvedValue({
            payloadJson: { test: 'data' },
            payloadHash: 'wrong-hash',
          }),
        },
      });

      const service = new AuditService({ prisma });
      const result = await service.verifyPayloadIntegrity('1');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tampered');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getStats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getStats', () => {
    test('returns event statistics', async () => {
      const prisma = createMockPrisma({
        auditEvent: {
          groupBy: jest.fn()
            .mockResolvedValueOnce([
              { eventType: 'booking.created', _count: { eventType: 10 } },
              { eventType: 'booking.confirmed', _count: { eventType: 8 } },
            ])
            .mockResolvedValueOnce([
              { actorType: 'client', _count: { actorType: 12 } },
              { actorType: 'freelancer', _count: { actorType: 6 } },
            ]),
        },
      });

      const service = new AuditService({ prisma });
      const stats = await service.getStats({ days: 7 });

      expect(stats.period).toBe('7 days');
      expect(stats.byEventType['booking.created']).toBe(10);
      expect(stats.byActorType['client']).toBe(12);
    });
  });
});
