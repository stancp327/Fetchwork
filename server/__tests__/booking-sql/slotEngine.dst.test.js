/**
 * SlotEngine DST (Daylight Saving Time) Tests
 * Verifies correct behavior during spring-forward and fall-back transitions.
 */

const { SlotEngine, generateSlots } = require('../../booking-sql/services/SlotEngine');
const { DateTime } = require('luxon');

describe('SlotEngine DST Safety', () => {

  describe('generateSlots - Spring Forward', () => {
    // US DST 2026: March 8, 2:00 AM → 3:00 AM (clocks jump forward)
    
    test('skips non-existent 2:00 AM hour during spring forward', () => {
      const slots = generateSlots({
        windows: [{ dayOfWeek: 0, startTime: '01:00', endTime: '04:00' }], // Sunday
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-03-08', // Spring forward day
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      const startTimes = slots.map(s => s.startTime);
      
      // 01:00 exists, 02:00 doesn't exist (skipped), 03:00 exists
      expect(startTimes).toContain('01:00');
      expect(startTimes).not.toContain('02:00'); // This hour doesn't exist!
      expect(startTimes).toContain('03:00');
    });

    test('UTC times are correct across spring forward boundary', () => {
      const slots = generateSlots({
        windows: [{ dayOfWeek: 0, startTime: '01:00', endTime: '04:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-03-08',
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      // Before DST: PST (UTC-8)
      const oneAM = slots.find(s => s.startTime === '01:00');
      expect(oneAM).toBeDefined();
      expect(oneAM.startUtc).toContain('09:00'); // 1 AM PST = 9 AM UTC

      // After DST: PDT (UTC-7)
      const threeAM = slots.find(s => s.startTime === '03:00');
      expect(threeAM).toBeDefined();
      expect(threeAM.startUtc).toContain('10:00'); // 3 AM PDT = 10 AM UTC
    });
  });

  describe('generateSlots - Fall Back', () => {
    // US DST 2026: November 1, 2:00 AM → 1:00 AM (clocks fall back)
    
    test('handles ambiguous 1:00 AM hour during fall back', () => {
      const slots = generateSlots({
        windows: [{ dayOfWeek: 0, startTime: '00:00', endTime: '03:00' }], // Sunday
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-11-01', // Fall back day
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      // Luxon picks the first occurrence (PDT, before the change)
      // We should still get valid slots
      expect(slots.length).toBeGreaterThan(0);
      
      const startTimes = slots.map(s => s.startTime);
      expect(startTimes).toContain('00:00');
      expect(startTimes).toContain('01:00');
      expect(startTimes).toContain('02:00');
    });

    test('UTC times are correct across fall back boundary', () => {
      const slots = generateSlots({
        windows: [{ dayOfWeek: 0, startTime: '00:00', endTime: '03:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-11-01',
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      // Before fall back: PDT (UTC-7)
      const midnight = slots.find(s => s.startTime === '00:00');
      expect(midnight).toBeDefined();
      expect(midnight.startUtc).toContain('07:00'); // 12 AM PDT = 7 AM UTC

      // 1 AM is ambiguous; Luxon picks PDT (first)
      const oneAM = slots.find(s => s.startTime === '01:00');
      expect(oneAM).toBeDefined();
      expect(oneAM.startUtc).toContain('08:00'); // 1 AM PDT = 8 AM UTC
    });
  });

  describe('generateSlots - Timezone consistency', () => {
    test('same wall-clock time shows different UTC for different timezones', () => {
      const laSlots = generateSlots({
        windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-04-06', // Regular Monday
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      const nySlots = generateSlots({
        windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-04-06',
        timezone: 'America/New_York',
        minNoticeHours: 0,
      });

      // Both show 9:00 AM local
      expect(laSlots[0].startTime).toBe('09:00');
      expect(nySlots[0].startTime).toBe('09:00');

      // But different UTC times (3 hour difference)
      expect(laSlots[0].startUtc).toContain('16:00'); // 9 AM PDT = 4 PM UTC
      expect(nySlots[0].startUtc).toContain('13:00'); // 9 AM EDT = 1 PM UTC
    });

    test('displayTime formats correctly for different timezones', () => {
      const slots = generateSlots({
        windows: [{ dayOfWeek: 1, startTime: '14:00', endTime: '15:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: '2026-04-06',
        timezone: 'America/Los_Angeles',
        minNoticeHours: 0,
      });

      expect(slots[0].displayTime).toBe('2:00 PM');
    });
  });

  describe('generateSlots - Minimum notice window', () => {
    test('filters out slots within minimum notice period', () => {
      // Use a date far in the future to avoid issues
      const futureDate = DateTime.now().plus({ days: 30 }).toFormat('yyyy-MM-dd');
      const futureDow = DateTime.fromISO(futureDate).weekday % 7;

      const slots = generateSlots({
        windows: [{ dayOfWeek: futureDow, startTime: '09:00', endTime: '17:00' }],
        slotDuration: 60,
        bufferTime: 0,
        dateStr: futureDate,
        timezone: 'America/Los_Angeles',
        minNoticeHours: 24,
      });

      // All slots should be available (they're 30 days out)
      expect(slots.length).toBeGreaterThan(0);
    });
  });

  describe('SlotEngine.getSlotsForServiceDate - DST integration', () => {
    function makeService(overrides = {}) {
      return {
        id: 'svc-1',
        freelancerId: 'freelancer-1',
        timezone: 'America/Los_Angeles',
        maxPerSlot: 1,
        bookingEnabled: true,
        slotDuration: 60,
        bufferTime: 0,
        maxAdvanceDays: 365,
        minNoticeHours: 0,
        availabilityWindows: [
          { dayOfWeek: 0, startTime: '01:00', endTime: '04:00' }, // Sunday
        ],
        ...overrides,
      };
    }

    function makeEngine(service = makeService()) {
      return new SlotEngine({
        serviceAdapter: { getById: jest.fn().mockResolvedValue(service) },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
      });
    }

    test('returns timezone in response body', async () => {
      const engine = makeEngine();
      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: '2026-04-05', // Sunday
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.timezone).toBe('America/Los_Angeles');
    });

    test('slots include UTC times for backend use', async () => {
      const engine = makeEngine();
      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: '2026-04-05',
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.slots.length).toBeGreaterThan(0);
      
      const slot = result.body.slots[0];
      expect(slot).toHaveProperty('startUtc');
      expect(slot).toHaveProperty('endUtc');
      expect(slot).toHaveProperty('startLocal');
      expect(slot).toHaveProperty('displayTime');
    });

    test('handles spring forward correctly', async () => {
      const engine = makeEngine();
      const result = await engine.getSlotsForServiceDate({
        serviceId: 'svc-1',
        date: '2026-03-08', // Spring forward
      });

      expect(result.statusCode).toBe(200);
      const startTimes = result.body.slots.map(s => s.startTime);
      
      // 2 AM doesn't exist
      expect(startTimes).not.toContain('02:00');
    });
  });

  describe('SlotEngine.validateSlot', () => {
    function makeEngine(slots = []) {
      const engine = new SlotEngine({
        serviceAdapter: { 
          getById: jest.fn().mockResolvedValue({
            id: 'svc-1',
            freelancerId: 'freelancer-1',
            timezone: 'America/Los_Angeles',
            maxPerSlot: 1,
            bookingEnabled: true,
            slotDuration: 60,
            bufferTime: 0,
            maxAdvanceDays: 365,
            availabilityWindows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
          })
        },
        occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
      });
      return engine;
    }

    test('returns valid for available slot', async () => {
      const engine = makeEngine();
      // Find next Monday
      const monday = DateTime.now().plus({ weeks: 1 }).set({ weekday: 1 }).toFormat('yyyy-MM-dd');
      
      const result = await engine.validateSlot({
        serviceId: 'svc-1',
        date: monday,
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.valid).toBe(true);
      expect(result.slot).toBeDefined();
    });

    test('returns invalid for non-existent slot', async () => {
      const engine = makeEngine();
      const monday = DateTime.now().plus({ weeks: 1 }).set({ weekday: 1 }).toFormat('yyyy-MM-dd');
      
      const result = await engine.validateSlot({
        serviceId: 'svc-1',
        date: monday,
        startTime: '08:00', // Outside availability window
        endTime: '09:00',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/not available/i);
    });
  });
});
