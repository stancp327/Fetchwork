/**
 * SlotEngine Hybrid Availability Integration Tests
 * Tests SlotEngine using AvailabilityService for exceptions and overrides.
 */

const { SlotEngine } = require('../../booking-sql/services/SlotEngine');
const { DateTime } = require('luxon');

describe('SlotEngine Hybrid Availability', () => {
  // Next Monday from now
  function nextMonday() {
    const d = DateTime.now().plus({ weeks: 1 }).set({ weekday: 1 });
    return d.toFormat('yyyy-MM-dd');
  }

  const mockService = {
    id: 'svc-1',
    freelancerId: 'freelancer-1',
    timezone: 'America/Los_Angeles',
    maxPerSlot: 1,
    bookingEnabled: true,
    slotDuration: 60,
    bufferTime: 0,
    maxAdvanceDays: 365,
    availabilityWindows: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Hybrid Availability Integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('with AvailabilityService', () => {
    test('uses resolved availability from AvailabilityService', async () => {
      const monday = nextMonday();

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: jest.fn().mockResolvedValue({
            freelancerId: 'freelancer-1',
            timezone: 'America/New_York', // Override timezone
            slotDuration: 30, // Override duration
            bufferTime: 10,
            capacity: 3,
            minNoticeHours: 0,
            maxAdvanceBookingDays: 365,
            weeklySchedule: [
              { dayOfWeek: 1, windows: [{ startTime: '10:00', endTime: '14:00' }] },
            ],
          }),
          getWindowsForDate: jest.fn().mockResolvedValue({
            available: true,
            windows: [{ startTime: '10:00', endTime: '14:00' }],
            source: 'global_default',
          }),
        },
        useHybridAvailability: true,
      });

      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: monday,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.timezone).toBe('America/New_York');
      // 30min slots from 10:00-14:00 = 8 slots (with 10min buffer = fewer)
      expect(result.body.slots.length).toBeGreaterThan(0);
      expect(result.body.slots[0].totalSpots).toBe(3); // Capacity override
    });

    test('respects exception blocking a date', async () => {
      const monday = nextMonday();

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: jest.fn().mockResolvedValue({
            freelancerId: 'freelancer-1',
            timezone: 'America/Los_Angeles',
            slotDuration: 60,
            bufferTime: 0,
            capacity: 1,
            minNoticeHours: 0,
            maxAdvanceBookingDays: 365,
            weeklySchedule: [],
          }),
          getWindowsForDate: jest.fn().mockResolvedValue({
            available: false,
            windows: [],
            reason: 'Holiday - Office Closed',
          }),
        },
        useHybridAvailability: true,
      });

      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: monday,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.slots).toHaveLength(0);
      expect(result.body.message).toBe('Holiday - Office Closed');
    });

    test('uses exception custom windows', async () => {
      const monday = nextMonday();

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: jest.fn().mockResolvedValue({
            freelancerId: 'freelancer-1',
            timezone: 'America/Los_Angeles',
            slotDuration: 60,
            bufferTime: 0,
            capacity: 1,
            minNoticeHours: 0,
            maxAdvanceBookingDays: 365,
            weeklySchedule: [
              { dayOfWeek: 1, windows: [{ startTime: '09:00', endTime: '17:00' }] },
            ],
          }),
          getWindowsForDate: jest.fn().mockResolvedValue({
            available: true,
            windows: [{ startTime: '12:00', endTime: '14:00' }], // Reduced hours
            source: 'exception',
          }),
        },
        useHybridAvailability: true,
      });

      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: monday,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.slots.length).toBe(2); // 12:00-13:00, 13:00-14:00
      expect(result.body.slots[0].startTime).toBe('12:00');
      expect(result.body.source).toBe('exception');
    });

    test('falls back to service when hybrid availability fails', async () => {
      const monday = nextMonday();

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: jest.fn().mockRejectedValue(new Error('DB connection failed')),
          getWindowsForDate: jest.fn(),
        },
        useHybridAvailability: true,
      });

      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: monday,
      });

      // Should still work using service fallback
      expect(result.statusCode).toBe(200);
      expect(result.body.slots.length).toBe(3); // From mockService windows
      expect(result.body.source).toBe('service_fallback');
    });

    test('can disable hybrid availability', async () => {
      const monday = nextMonday();
      const availabilitySpy = jest.fn();

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: availabilitySpy,
          getWindowsForDate: jest.fn(),
        },
        useHybridAvailability: false, // Disabled
      });

      await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: monday,
      });

      // AvailabilityService should not be called
      expect(availabilitySpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Date Range (Calendar View)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSlotsForDateRange', () => {
    test('returns availability summary for date range', async () => {
      const startDate = nextMonday();
      const endDate = DateTime.fromISO(startDate).plus({ days: 6 }).toFormat('yyyy-MM-dd');

      const engine = new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(mockService) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
        availabilityService: {
          getResolvedAvailability: jest.fn().mockResolvedValue(null),
          getWindowsForDate: jest.fn(),
        },
        useHybridAvailability: false,
      });

      const result = await engine.getSlotsForDateRange({
        serviceId: 'svc-1',
        fromDate: startDate,
        toDate: endDate,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.dates).toHaveLength(7);
      
      // Monday should have slots (dayOfWeek=1 in mockService)
      const monday = result.body.dates.find(d => d.dayOfWeek === 1);
      expect(monday.available).toBe(true);
      expect(monday.slotsCount).toBe(3);

      // Tuesday (dayOfWeek=2) should not have slots
      const tuesday = result.body.dates.find(d => d.dayOfWeek === 2);
      expect(tuesday.available).toBe(false);
    });
  });
});
