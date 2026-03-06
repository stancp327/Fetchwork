/**
 * AvailabilityService unit tests
 * Tests hybrid availability resolution: global defaults + service overrides + exceptions
 */

const { AvailabilityService } = require('../../booking-sql/services/AvailabilityService');

describe('AvailabilityService', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Mock Prisma
  // ═══════════════════════════════════════════════════════════════════════════
  
  function createMockPrisma(overrides = {}) {
    return {
      freelancerAvailability: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        ...overrides.freelancerAvailability,
      },
      serviceAvailabilityOverride: {
        upsert: jest.fn(),
        delete: jest.fn(),
        ...overrides.serviceAvailabilityOverride,
      },
      availabilityException: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        delete: jest.fn(),
        ...overrides.availabilityException,
      },
    };
  }

  const mockGlobalAvailability = {
    id: 'avail-1',
    freelancerId: 'freelancer-1',
    timezone: 'America/Los_Angeles',
    defaultSlotDuration: 60,
    bufferTime: 15,
    defaultCapacity: 1,
    minNoticeHours: 24,
    maxAdvanceBookingDays: 60,
    isActive: true,
    weeklyScheduleJson: [
      { dayOfWeek: 1, windows: [{ startTime: '09:00', endTime: '17:00' }] }, // Monday
      { dayOfWeek: 2, windows: [{ startTime: '09:00', endTime: '17:00' }] }, // Tuesday
    ],
    serviceOverrides: [],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // getResolvedAvailability Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getResolvedAvailability', () => {
    test('returns null when freelancer has no availability configured', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(null);
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getResolvedAvailability({ freelancerId: 'missing' });
      
      expect(result).toBeNull();
    });

    test('returns global defaults when no service override', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getResolvedAvailability({ freelancerId: 'freelancer-1' });
      
      expect(result.timezone).toBe('America/Los_Angeles');
      expect(result.slotDuration).toBe(60);
      expect(result.bufferTime).toBe(15);
      expect(result.capacity).toBe(1);
      expect(result._overrideId).toBeNull();
    });

    test('service override takes precedence over global', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue({
        ...mockGlobalAvailability,
        serviceOverrides: [{
          id: 'override-1',
          serviceId: 'service-1',
          timezone: 'America/New_York',
          slotDuration: 30,
          bufferTime: null, // Use global
          capacity: 5,
          isActive: true,
          weeklyScheduleJson: null, // Use global
        }],
      });
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getResolvedAvailability({
        freelancerId: 'freelancer-1',
        serviceId: 'service-1',
      });
      
      expect(result.timezone).toBe('America/New_York'); // Override
      expect(result.slotDuration).toBe(30); // Override
      expect(result.bufferTime).toBe(15); // Global fallback
      expect(result.capacity).toBe(5); // Override
      expect(result._overrideId).toBe('override-1');
    });

    test('inactive global makes everything inactive', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue({
        ...mockGlobalAvailability,
        isActive: false,
      });
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getResolvedAvailability({ freelancerId: 'freelancer-1' });
      
      expect(result.isActive).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getWindowsForDate Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getWindowsForDate', () => {
    test('returns windows from weekly schedule', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      
      const service = new AvailabilityService({ prisma });
      // 2026-04-06 is a Monday (dayOfWeek=1)
      const result = await service.getWindowsForDate({
        freelancerId: 'freelancer-1',
        date: '2026-04-06',
      });
      
      expect(result.available).toBe(true);
      expect(result.windows).toEqual([{ startTime: '09:00', endTime: '17:00' }]);
      expect(result.source).toBe('global_default');
    });

    test('returns unavailable when exception blocks the date', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      prisma.availabilityException.findMany.mockResolvedValue([{
        id: 'exc-1',
        date: '2026-04-06',
        serviceId: null,
        unavailable: true,
        reason: 'Holiday',
      }]);
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getWindowsForDate({
        freelancerId: 'freelancer-1',
        date: '2026-04-06',
      });
      
      expect(result.available).toBe(false);
      expect(result.reason).toBe('Holiday');
    });

    test('exception custom windows override weekly schedule', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      prisma.availabilityException.findMany.mockResolvedValue([{
        id: 'exc-1',
        date: '2026-04-06',
        serviceId: null,
        unavailable: false,
        windowsJson: [{ startTime: '10:00', endTime: '14:00' }],
      }]);
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getWindowsForDate({
        freelancerId: 'freelancer-1',
        date: '2026-04-06',
      });
      
      expect(result.available).toBe(true);
      expect(result.windows).toEqual([{ startTime: '10:00', endTime: '14:00' }]);
      expect(result.source).toBe('exception');
    });

    test('service-specific exception overrides global exception', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      prisma.availabilityException.findMany.mockResolvedValue([
        {
          id: 'exc-global',
          date: '2026-04-06',
          serviceId: null,
          unavailable: true,
          reason: 'Global day off',
        },
        {
          id: 'exc-service',
          date: '2026-04-06',
          serviceId: 'service-1',
          unavailable: false,
          windowsJson: [{ startTime: '12:00', endTime: '16:00' }],
        },
      ]);
      
      const service = new AvailabilityService({ prisma });
      const result = await service.getWindowsForDate({
        freelancerId: 'freelancer-1',
        serviceId: 'service-1',
        date: '2026-04-06',
      });
      
      // Service-specific exception wins
      expect(result.available).toBe(true);
      expect(result.windows).toEqual([{ startTime: '12:00', endTime: '16:00' }]);
    });

    test('returns unavailable for day not in weekly schedule', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(mockGlobalAvailability);
      
      const service = new AvailabilityService({ prisma });
      // 2026-04-05 is a Sunday (dayOfWeek=0), not in our mock schedule
      const result = await service.getWindowsForDate({
        freelancerId: 'freelancer-1',
        date: '2026-04-05',
      });
      
      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/no availability/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('upsertGlobalAvailability', () => {
    test('creates new availability with defaults', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.upsert.mockResolvedValue({ id: 'new-avail' });
      
      const service = new AvailabilityService({ prisma });
      await service.upsertGlobalAvailability({
        freelancerId: 'freelancer-1',
        data: { timezone: 'America/Chicago' },
      });
      
      expect(prisma.freelancerAvailability.upsert).toHaveBeenCalled();
      const call = prisma.freelancerAvailability.upsert.mock.calls[0][0];
      expect(call.create.timezone).toBe('America/Chicago');
    });
  });

  describe('addException', () => {
    test('creates day-off exception', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue({ id: 'avail-1' });
      prisma.availabilityException.upsert.mockResolvedValue({ id: 'exc-1' });
      
      const service = new AvailabilityService({ prisma });
      await service.addException({
        freelancerId: 'freelancer-1',
        date: '2026-12-25',
        unavailable: true,
        reason: 'Christmas',
      });
      
      expect(prisma.availabilityException.upsert).toHaveBeenCalled();
      const call = prisma.availabilityException.upsert.mock.calls[0][0];
      expect(call.create.date).toBe('2026-12-25');
      expect(call.create.unavailable).toBe(true);
      expect(call.create.reason).toBe('Christmas');
    });

    test('creates custom-hours exception', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue({ id: 'avail-1' });
      prisma.availabilityException.upsert.mockResolvedValue({ id: 'exc-1' });
      
      const service = new AvailabilityService({ prisma });
      await service.addException({
        freelancerId: 'freelancer-1',
        date: '2026-07-04',
        unavailable: false,
        windows: [{ startTime: '10:00', endTime: '14:00' }],
        reason: 'Holiday half-day',
      });
      
      const call = prisma.availabilityException.upsert.mock.calls[0][0];
      expect(call.create.unavailable).toBe(false);
      expect(call.create.windowsJson).toEqual([{ startTime: '10:00', endTime: '14:00' }]);
    });

    test('throws when freelancer availability not configured', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(null);
      
      const service = new AvailabilityService({ prisma });
      await expect(
        service.addException({ freelancerId: 'missing', date: '2026-01-01' })
      ).rejects.toThrow(/not configured/i);
    });
  });

  describe('upsertServiceOverride', () => {
    test('creates service override', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue({ id: 'avail-1' });
      prisma.serviceAvailabilityOverride.upsert.mockResolvedValue({ id: 'override-1' });
      
      const service = new AvailabilityService({ prisma });
      await service.upsertServiceOverride({
        freelancerId: 'freelancer-1',
        serviceId: 'service-1',
        data: {
          timezone: 'America/New_York',
          slotDuration: 45,
          capacity: 10,
        },
      });
      
      expect(prisma.serviceAvailabilityOverride.upsert).toHaveBeenCalled();
      const call = prisma.serviceAvailabilityOverride.upsert.mock.calls[0][0];
      expect(call.create.serviceId).toBe('service-1');
      expect(call.create.timezone).toBe('America/New_York');
      expect(call.create.slotDuration).toBe(45);
      expect(call.create.capacity).toBe(10);
    });

    test('throws when freelancer availability not configured', async () => {
      const prisma = createMockPrisma();
      prisma.freelancerAvailability.findUnique.mockResolvedValue(null);
      
      const service = new AvailabilityService({ prisma });
      await expect(
        service.upsertServiceOverride({
          freelancerId: 'missing',
          serviceId: 'service-1',
          data: {},
        })
      ).rejects.toThrow(/not configured/i);
    });
  });
});
