/**
 * SlotEngine unit tests
 * Verifies slot generation, conflict filtering, and ServiceAdapter decoupling.
 * No real DB or Mongo needed — all deps are mocked.
 */

const { SlotEngine } = require('../../booking-sql/services/SlotEngine');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeService(overrides = {}) {
  return {
    id: 'svc-1',
    freelancerId: 'freelancer-1',
    title: 'Dog Walking',
    timezone: 'America/Los_Angeles',
    maxPerSlot: 1,
    pricingBaseCents: 5000,
    cancellationTier: 'flexible',
    bookingEnabled: true,
    slotDuration: 60,
    bufferTime: 0,
    maxAdvanceDays: 60,
    availabilityWindows: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, // Monday
      { dayOfWeek: 2, startTime: '10:00', endTime: '14:00' }, // Tuesday
    ],
    ...overrides,
  };
}

function makeEngine({ service = makeService(), booked = [] } = {}) {
  return new SlotEngine({
    serviceAdapter: { getById: jest.fn().mockResolvedValue(service) },
    occurrenceRepo: {
      findActiveForFreelancerDateRange: jest.fn().mockResolvedValue(booked),
    },
  });
}

// Next Monday from now (so it's not in the past)
function nextWeekday(dayOfWeek) {
  const d = new Date();
  const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('SlotEngine.getSlotsForServiceDate', () => {
  test('returns 404 when service not found', async () => {
    const engine = new SlotEngine({
      serviceAdapter: { getById: jest.fn().mockResolvedValue(null) },
      occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn() },
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'missing', date: '2026-04-07' });
    expect(result.statusCode).toBe(404);
  });

  test('returns empty slots when booking not enabled', async () => {
    const engine = makeEngine({ service: makeService({ bookingEnabled: false }) });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: '2026-04-07' });
    expect(result.statusCode).toBe(200);
    expect(result.body.slots).toHaveLength(0);
    expect(result.body.message).toMatch(/not enabled/i);
  });

  test('returns empty slots for past date', async () => {
    const engine = makeEngine();
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: '2020-01-01' });
    expect(result.statusCode).toBe(200);
    expect(result.body.slots).toHaveLength(0);
  });

  test('returns empty slots when date too far in advance', async () => {
    const engine = makeEngine({ service: makeService({ maxAdvanceDays: 7 }) });
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 90);
    const result = await engine.getSlotsForServiceDate({
      serviceId: 'svc-1',
      date: farDate.toISOString().slice(0, 10),
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.slots).toHaveLength(0);
  });

  test('generates correct slots for Monday 9-12 with 60min duration', async () => {
    const monday = nextWeekday(1);
    const engine = makeEngine();
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: monday });
    expect(result.statusCode).toBe(200);
    // 09:00-10:00, 10:00-11:00, 11:00-12:00 = 3 slots
    expect(result.body.totalSlots).toBe(3);
    expect(result.body.slots).toHaveLength(3);
    expect(result.body.slots[0]).toMatchObject({ startTime: '09:00', endTime: '10:00', spotsLeft: 1, totalSpots: 1 });
  });

  test('respects buffer time between slots', async () => {
    const monday = nextWeekday(1);
    // 60min slots + 15min buffer: 09:00-10:00, 10:15-11:15, 11:30-12:30 (but window ends at 12, so 2 slots)
    const engine = makeEngine({
      service: makeService({
        slotDuration: 60,
        bufferTime: 15,
        availabilityWindows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      }),
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: monday });
    expect(result.statusCode).toBe(200);
    expect(result.body.slots[0].startTime).toBe('09:00');
    expect(result.body.slots[1].startTime).toBe('10:15');
  });

  test('filters out fully booked slots', async () => {
    const monday = nextWeekday(1);
    // 09:00 slot is booked
    const engine = makeEngine({
      booked: [{ localStartWallclock: `${monday}T09:00`, status: 'confirmed' }],
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: monday });
    const startTimes = result.body.slots.map((s) => s.startTime);
    expect(startTimes).not.toContain('09:00');
    expect(startTimes).toContain('10:00');
    expect(startTimes).toContain('11:00');
  });

  test('respects maxPerSlot > 1 for group bookings', async () => {
    const tuesday = nextWeekday(2);
    const engine = makeEngine({
      service: makeService({ maxPerSlot: 5 }),
      booked: [
        { localStartWallclock: `${tuesday}T10:00`, status: 'confirmed' },
        { localStartWallclock: `${tuesday}T10:00`, status: 'confirmed' },
      ],
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: tuesday });
    const tenAM = result.body.slots.find((s) => s.startTime === '10:00');
    expect(tenAM).toBeDefined();
    expect(tenAM.spotsLeft).toBe(3); // 5 - 2 booked
    expect(tenAM.totalSpots).toBe(5);
  });

  test('slot disappears when maxPerSlot is fully consumed', async () => {
    const tuesday = nextWeekday(2);
    const engine = makeEngine({
      service: makeService({ maxPerSlot: 2 }),
      booked: [
        { localStartWallclock: `${tuesday}T10:00`, status: 'held' },
        { localStartWallclock: `${tuesday}T10:00`, status: 'confirmed' },
      ],
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: tuesday });
    const startTimes = result.body.slots.map((s) => s.startTime);
    expect(startTimes).not.toContain('10:00');
  });

  test('returns empty slots when no windows match the requested day', async () => {
    const monday = nextWeekday(1);
    // No Monday windows (only Saturday)
    const engine = makeEngine({
      service: makeService({
        availabilityWindows: [{ dayOfWeek: 6, startTime: '10:00', endTime: '14:00' }],
      }),
    });
    const result = await engine.getSlotsForServiceDate({ serviceId: 'svc-1', date: monday });
    expect(result.body.slots).toHaveLength(0);
    expect(result.body.totalSlots).toBe(0);
  });

  test('uses serviceAdapter (not Mongo) to fetch service', async () => {
    const monday = nextWeekday(1);
    const adapterSpy = jest.fn().mockResolvedValue(makeService());
    const engine = new SlotEngine({
      serviceAdapter: { getById: adapterSpy },
      occurrenceRepo: { findActiveForFreelancerDateRange: jest.fn().mockResolvedValue([]) },
    });
    await engine.getSlotsForServiceDate({ serviceId: 'svc-test', date: monday });
    expect(adapterSpy).toHaveBeenCalledWith('svc-test');
  });
});
