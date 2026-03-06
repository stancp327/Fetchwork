/**
 * RecurringSeriesService unit tests
 * All DB calls are mocked — no real DB needed.
 */

const { RecurringSeriesService } = require('../../booking-sql/services/RecurringSeriesService');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSeries(overrides = {}) {
  return {
    id:               'series-uuid-1',
    bookingId:        'booking-uuid-1',
    frequency:        'weekly',
    intervalDays:     7,
    startDate:        '2026-04-01',
    endDate:          null,
    maxOccurrences:   52,
    startTime:        '10:00',
    endTime:          '11:00',
    timezone:         'America/Los_Angeles',
    status:           'active',
    cancelledAt:      null,
    cancelledFromDate: null,
    generatedThrough: null,
    generatedCount:   1,
    ...overrides,
  };
}

function makeBooking(overrides = {}) {
  return {
    id:           'booking-uuid-1',
    clientId:     'client-1',
    freelancerId: 'freelancer-1',
    currentState: 'confirmed',
    recurringSeries: null,
    occurrences:  [
      {
        id:                 'occ-uuid-1',
        bookingId:          'booking-uuid-1',
        occurrenceNo:       1,
        startAtUtc:         new Date('2026-04-01T17:00:00Z'),
        localStartWallclock:'2026-04-01T10:00',
      },
    ],
    ...overrides,
  };
}

function makeOccurrence(overrides = {}) {
  return {
    id:           'occ-uuid-1',
    bookingId:    'booking-uuid-1',
    seriesId:     'series-uuid-1',
    occurrenceNo: 1,
    skipped:      false,
    status:       'confirmed',
    startAtUtc:   new Date('2026-04-01T17:00:00Z'),
    ...overrides,
  };
}

function makePrisma(overrides = {}) {
  return {
    booking: {
      findUnique: jest.fn().mockResolvedValue(makeBooking()),
    },
    bookingOccurrence: {
      findUnique:  jest.fn().mockResolvedValue(makeOccurrence()),
      findFirst:   jest.fn().mockResolvedValue(null),
      findMany:    jest.fn().mockResolvedValue([]),
      count:       jest.fn().mockResolvedValue(1),
      create:      jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-occ', ...data })),
      update:      jest.fn().mockResolvedValue({}),
      updateMany:  jest.fn().mockResolvedValue({ count: 0 }),
    },
    recurringSeries: {
      findUnique: jest.fn().mockResolvedValue(makeSeries()),
      findMany:   jest.fn().mockResolvedValue([]),
      create:     jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'series-uuid-1', ...data })),
      update:     jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

// ─── createSeries ─────────────────────────────────────────────────────────────

describe('RecurringSeriesService.createSeries', () => {
  test('rejects invalid frequency', async () => {
    const svc = new RecurringSeriesService({ prisma: makePrisma() });
    const result = await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'hourly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(result.error).toBeDefined();
    expect(result.code).toBe('INVALID_FREQUENCY');
  });

  test('rejects custom frequency without intervalDays', async () => {
    const svc = new RecurringSeriesService({ prisma: makePrisma() });
    const result = await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'custom',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(result.code).toBe('MISSING_INTERVAL');
  });

  test('rejects if booking not found', async () => {
    const prisma = makePrisma();
    prisma.booking.findUnique.mockResolvedValue(null);
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.createSeries({
      bookingId: 'x', frequency: 'weekly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(result.code).toBe('BOOKING_NOT_FOUND');
  });

  test('rejects if booking already has a series', async () => {
    const prisma = makePrisma();
    prisma.booking.findUnique.mockResolvedValue(makeBooking({ recurringSeries: { id: 'existing' } }));
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'weekly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(result.code).toBe('ALREADY_RECURRING');
  });

  test('creates series and links first occurrence', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'weekly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(result.success).toBe(true);
    expect(result.frequency).toBe('weekly');
    // First occurrence linked
    expect(prisma.bookingOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ seriesId: 'series-uuid-1' }) })
    );
  });

  test('weekly uses intervalDays=7', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'weekly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(prisma.recurringSeries.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ intervalDays: 7 }) })
    );
  });

  test('biweekly uses intervalDays=14', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'biweekly',
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(prisma.recurringSeries.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ intervalDays: 14 }) })
    );
  });

  test('custom frequency uses supplied intervalDays', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    await svc.createSeries({
      bookingId: 'booking-uuid-1', frequency: 'custom', intervalDays: 10,
      startDate: '2026-04-01', startTime: '10:00', endTime: '11:00', timezone: 'America/Los_Angeles',
    });
    expect(prisma.recurringSeries.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ intervalDays: 10 }) })
    );
  });
});

// ─── skipOccurrence ───────────────────────────────────────────────────────────

describe('RecurringSeriesService.skipOccurrence', () => {
  test('skips a valid occurrence', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.skipOccurrence({ seriesId: 'series-uuid-1', occurrenceId: 'occ-uuid-1' });
    expect(result.success).toBe(true);
    expect(prisma.bookingOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ skipped: true }) })
    );
  });

  test('returns NOT_FOUND for unknown occurrence', async () => {
    const prisma = makePrisma();
    prisma.bookingOccurrence.findUnique.mockResolvedValue(null);
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.skipOccurrence({ seriesId: 'series-uuid-1', occurrenceId: 'bad-id' });
    expect(result.code).toBe('NOT_FOUND');
  });

  test('returns SERIES_MISMATCH if occurrence belongs to different series', async () => {
    const prisma = makePrisma();
    prisma.bookingOccurrence.findUnique.mockResolvedValue(makeOccurrence({ seriesId: 'other-series' }));
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.skipOccurrence({ seriesId: 'series-uuid-1', occurrenceId: 'occ-uuid-1' });
    expect(result.code).toBe('SERIES_MISMATCH');
  });

  test('returns ALREADY_SKIPPED for already-skipped occurrence', async () => {
    const prisma = makePrisma();
    prisma.bookingOccurrence.findUnique.mockResolvedValue(makeOccurrence({ skipped: true }));
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.skipOccurrence({ seriesId: 'series-uuid-1', occurrenceId: 'occ-uuid-1' });
    expect(result.code).toBe('ALREADY_SKIPPED');
  });
});

// ─── cancelFromDate ───────────────────────────────────────────────────────────

describe('RecurringSeriesService.cancelFromDate', () => {
  test('cancels occurrences from date forward', async () => {
    const prisma = makePrisma();
    prisma.bookingOccurrence.updateMany.mockResolvedValue({ count: 5 });
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.cancelFromDate({ seriesId: 'series-uuid-1', fromDate: '2026-05-01', actorId: 'client-1' });
    expect(result.success).toBe(true);
    expect(result.occurrencesCancelled).toBe(5);
    expect(result.cancelledFromDate).toBe('2026-05-01');
  });

  test('returns NOT_FOUND for unknown series', async () => {
    const prisma = makePrisma();
    prisma.recurringSeries.findUnique.mockResolvedValue(null);
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.cancelFromDate({ seriesId: 'bad', fromDate: '2026-05-01' });
    expect(result.code).toBe('NOT_FOUND');
  });

  test('rejects if series already cancelled', async () => {
    const prisma = makePrisma();
    prisma.recurringSeries.findUnique.mockResolvedValue(makeSeries({ status: 'cancelled' }));
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.cancelFromDate({ seriesId: 'series-uuid-1', fromDate: '2026-05-01' });
    expect(result.code).toBe('ALREADY_CANCELLED');
  });
});

// ─── cancelSeries ─────────────────────────────────────────────────────────────

describe('RecurringSeriesService.cancelSeries', () => {
  test('cancels all future occurrences and marks series cancelled', async () => {
    const prisma = makePrisma();
    prisma.bookingOccurrence.updateMany.mockResolvedValue({ count: 8 });
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.cancelSeries({ seriesId: 'series-uuid-1' });
    expect(result.success).toBe(true);
    expect(result.occurrencesCancelled).toBe(8);
    expect(prisma.recurringSeries.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) })
    );
  });

  test('returns NOT_FOUND for unknown series', async () => {
    const prisma = makePrisma();
    prisma.recurringSeries.findUnique.mockResolvedValue(null);
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.cancelSeries({ seriesId: 'bad' });
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ─── pauseSeries / resumeSeries ───────────────────────────────────────────────

describe('RecurringSeriesService.pauseSeries', () => {
  test('pauses an active series', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.pauseSeries('series-uuid-1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('paused');
  });

  test('rejects pausing an already-paused series', async () => {
    const prisma = makePrisma();
    prisma.recurringSeries.findUnique.mockResolvedValue(makeSeries({ status: 'paused' }));
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.pauseSeries('series-uuid-1');
    expect(result.code).toBe('INVALID_STATE');
  });
});

describe('RecurringSeriesService.resumeSeries', () => {
  test('resumes a paused series', async () => {
    const prisma = makePrisma();
    prisma.recurringSeries.findUnique.mockResolvedValue(
      makeSeries({ status: 'paused', booking: makeBooking() })
    );
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.resumeSeries('series-uuid-1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('active');
  });

  test('rejects resuming an already-active series', async () => {
    const prisma = makePrisma();
    const svc = new RecurringSeriesService({ prisma });
    const result = await svc.resumeSeries('series-uuid-1');
    expect(result.code).toBe('INVALID_STATE');
  });
});

// ─── _nextDate ────────────────────────────────────────────────────────────────

describe('RecurringSeriesService._nextDate', () => {
  const { DateTime } = require('luxon');
  const svc = new RecurringSeriesService({});

  test('weekly: adds 7 days', () => {
    const d = DateTime.fromISO('2026-04-01');
    const next = svc._nextDate(d, makeSeries({ frequency: 'weekly', intervalDays: 7 }));
    expect(next.toFormat('yyyy-MM-dd')).toBe('2026-04-08');
  });

  test('biweekly: adds 14 days', () => {
    const d = DateTime.fromISO('2026-04-01');
    const next = svc._nextDate(d, makeSeries({ frequency: 'biweekly', intervalDays: 14 }));
    expect(next.toFormat('yyyy-MM-dd')).toBe('2026-04-15');
  });

  test('monthly: adds 1 calendar month', () => {
    const d = DateTime.fromISO('2026-01-31');
    const next = svc._nextDate(d, makeSeries({ frequency: 'monthly', intervalDays: 0 }));
    expect(next.toFormat('yyyy-MM-dd')).toBe('2026-02-28'); // Feb 28 in non-leap year
  });

  test('custom: adds custom intervalDays', () => {
    const d = DateTime.fromISO('2026-04-01');
    const next = svc._nextDate(d, makeSeries({ frequency: 'custom', intervalDays: 10 }));
    expect(next.toFormat('yyyy-MM-dd')).toBe('2026-04-11');
  });
});
