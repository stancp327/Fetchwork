/**
 * GroupBookingService Tests
 * Tests group/class booking with waitlist functionality.
 */

const { GroupBookingService, HOLD_EXPIRY_MINUTES, PROMOTION_EXPIRY_HOURS } = require('../../booking-sql/services/GroupBookingService');

describe('GroupBookingService', () => {
  function createMockPrisma(overrides = {}) {
    return {
      groupBookingSlot: {
        create: jest.fn().mockResolvedValue({ id: 'slot-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        ...overrides.groupBookingSlot,
      },
      groupParticipant: {
        create: jest.fn().mockResolvedValue({ id: 'part-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        ...overrides.groupParticipant,
      },
      waitlistEntry: {
        create: jest.fn().mockResolvedValue({ id: 'wait-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        ...overrides.waitlistEntry,
      },
      $transaction: jest.fn(async (fn) => fn(createMockPrisma(overrides))),
    };
  }

  const mockSlot = {
    id: 'slot-1',
    serviceId: 'service-1',
    freelancerId: 'freelancer-1',
    date: '2026-04-01',
    startTime: '10:00',
    endTime: '11:00',
    totalCapacity: 10,
    bookedCount: 0,
    pricePerPersonCents: 5000,
    isActive: true,
    isFull: false,
    participants: [],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // createSlot Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createSlot', () => {
    test('creates a group booking slot', async () => {
      const prisma = createMockPrisma();
      const service = new GroupBookingService({ prisma });

      const result = await service.createSlot({
        serviceId: 'service-1',
        freelancerId: 'freelancer-1',
        date: '2026-04-01',
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'America/Los_Angeles',
        totalCapacity: 20,
        pricePerPersonCents: 5000,
      });

      expect(prisma.groupBookingSlot.create).toHaveBeenCalled();
      const call = prisma.groupBookingSlot.create.mock.calls[0][0];
      expect(call.data.totalCapacity).toBe(20);
      expect(call.data.pricePerPersonCents).toBe(5000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // bookSeats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('bookSeats', () => {
    test('books seats successfully', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue({ ...mockSlot }),
          update: jest.fn().mockResolvedValue({}),
        },
        groupParticipant: {
          create: jest.fn().mockResolvedValue({
            id: 'part-1',
            status: 'held',
            seatCount: 2,
            holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.bookSeats({
        slotId: 'slot-1',
        clientId: 'client-1',
        seatCount: 2,
      });

      expect(result.success).toBe(true);
      expect(result.seatCount).toBe(2);
      expect(result.status).toBe('held');
      expect(result.holdExpiresAt).toBeDefined();
    });

    test('rejects when not enough seats', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockSlot,
            bookedCount: 9,
            participants: [{ seatCount: 9, status: 'confirmed' }],
          }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.bookSeats({
        slotId: 'slot-1',
        clientId: 'client-1',
        seatCount: 5,
      });

      expect(result.error).toBeDefined();
      expect(result.code).toBe('INSUFFICIENT_SEATS');
      expect(result.availableSeats).toBe(1);
    });

    test('rejects duplicate booking', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockSlot,
            participants: [{ clientId: 'client-1', seatCount: 2, status: 'confirmed' }],
          }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.bookSeats({
        slotId: 'slot-1',
        clientId: 'client-1',
        seatCount: 1,
      });

      expect(result.code).toBe('ALREADY_BOOKED');
    });

    test('marks slot as full when capacity reached', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue({
            ...mockSlot,
            bookedCount: 8,
            participants: [{ seatCount: 8, status: 'confirmed' }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        groupParticipant: {
          create: jest.fn().mockResolvedValue({ id: 'part-1', status: 'confirmed', seatCount: 2 }),
        },
      });

      const service = new GroupBookingService({ prisma });

      await service.bookSeats({
        slotId: 'slot-1',
        clientId: 'client-1',
        seatCount: 2,
        paid: true,
      });

      const updateCall = prisma.groupBookingSlot.update.mock.calls[0][0];
      expect(updateCall.data.isFull).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // confirmBooking Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('confirmBooking', () => {
    test('confirms a held booking', async () => {
      const prisma = createMockPrisma({
        groupParticipant: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'part-1',
            status: 'held',
            holdExpiresAt: new Date(Date.now() + 60000),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.confirmBooking({
        participantId: 'part-1',
        paidAmountCents: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('confirmed');
    });

    test('rejects expired hold', async () => {
      const prisma = createMockPrisma({
        groupParticipant: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'part-1',
            status: 'held',
            holdExpiresAt: new Date(Date.now() - 60000), // Expired
          }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.confirmBooking({
        participantId: 'part-1',
        paidAmountCents: 5000,
      });

      expect(result.code).toBe('HOLD_EXPIRED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancelBooking Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelBooking', () => {
    test('cancels booking and frees seats', async () => {
      const prisma = createMockPrisma({
        groupParticipant: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'part-1',
            slotId: 'slot-1',
            status: 'confirmed',
            seatCount: 3,
            paidAmountCents: 15000,
            slot: { ...mockSlot, bookedCount: 5 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        groupBookingSlot: {
          update: jest.fn().mockResolvedValue({}),
        },
        waitlistEntry: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.cancelBooking({ participantId: 'part-1' });

      expect(result.success).toBe(true);
      expect(result.freedSeats).toBe(3);
      expect(result.refundEligible).toBe(true);
      expect(result.paidAmountCents).toBe(15000);
    });

    test('triggers waitlist promotion on cancel', async () => {
      const prisma = createMockPrisma({
        groupParticipant: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'part-1',
            slotId: 'slot-1',
            status: 'confirmed',
            seatCount: 2,
            slot: { ...mockSlot, bookedCount: 10 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        groupBookingSlot: {
          update: jest.fn().mockResolvedValue({}),
        },
        waitlistEntry: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'wait-1', clientId: 'client-2', seatCount: 1, position: 1 },
            { id: 'wait-2', clientId: 'client-3', seatCount: 1, position: 2 },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.cancelBooking({ participantId: 'part-1' });

      expect(result.waitlistPromoted).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Waitlist Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('joinWaitlist', () => {
    test('joins waitlist successfully', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue(mockSlot),
        },
        waitlistEntry: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue({ position: 5 }),
          create: jest.fn().mockResolvedValue({
            id: 'wait-1',
            position: 6,
            seatCount: 2,
          }),
        },
        groupParticipant: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.joinWaitlist({
        slotId: 'slot-1',
        clientId: 'client-1',
        seatCount: 2,
      });

      expect(result.success).toBe(true);
      expect(result.position).toBe(6);
    });

    test('rejects if already on waitlist', async () => {
      const prisma = createMockPrisma({
        groupBookingSlot: {
          findUnique: jest.fn().mockResolvedValue(mockSlot),
        },
        waitlistEntry: {
          findUnique: jest.fn().mockResolvedValue({ id: 'wait-1' }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.joinWaitlist({
        slotId: 'slot-1',
        clientId: 'client-1',
      });

      expect(result.code).toBe('ALREADY_WAITLISTED');
    });
  });

  describe('getWaitlistPosition', () => {
    test('returns position correctly', async () => {
      const prisma = createMockPrisma({
        waitlistEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'wait-1',
            status: 'waiting',
            position: 5,
            seatCount: 2,
            joinedAt: new Date(),
          }),
          count: jest.fn().mockResolvedValue(3), // 3 people ahead
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.getWaitlistPosition({
        slotId: 'slot-1',
        clientId: 'client-1',
      });

      expect(result.position).toBe(4); // 3 ahead + 1 = 4th position
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cleanup Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('expireHeldBookings', () => {
    test('expires old held bookings', async () => {
      const prisma = createMockPrisma({
        groupParticipant: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'part-1',
              status: 'held',
              seatCount: 2,
              holdExpiresAt: new Date(Date.now() - 60000),
              slot: { ...mockSlot, bookedCount: 2 },
            },
          ]),
          findUnique: jest.fn().mockResolvedValue({
            id: 'part-1',
            slotId: 'slot-1',
            status: 'held',
            seatCount: 2,
            slot: { ...mockSlot, bookedCount: 2 },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        groupBookingSlot: {
          update: jest.fn().mockResolvedValue({}),
        },
        waitlistEntry: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.expireHeldBookings();

      expect(result.expired).toBe(1);
    });
  });

  describe('expirePromotions', () => {
    test('expires old promotions', async () => {
      const prisma = createMockPrisma({
        waitlistEntry: {
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      });

      const service = new GroupBookingService({ prisma });

      const result = await service.expirePromotions();

      expect(result.expired).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constants', () => {
    test('HOLD_EXPIRY_MINUTES is reasonable', () => {
      expect(HOLD_EXPIRY_MINUTES).toBeGreaterThanOrEqual(5);
      expect(HOLD_EXPIRY_MINUTES).toBeLessThanOrEqual(30);
    });

    test('PROMOTION_EXPIRY_HOURS is reasonable', () => {
      expect(PROMOTION_EXPIRY_HOURS).toBeGreaterThanOrEqual(1);
      expect(PROMOTION_EXPIRY_HOURS).toBeLessThanOrEqual(72);
    });
  });
});
