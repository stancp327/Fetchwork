/**
 * Tests for getMyBookingsSql and getBookingByIdSql controller handlers.
 * Verifies input validation, role/status filtering, response shape,
 * and authorization guards.
 */

// Mock DB + feature flag so controller can load without a real DB
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

jest.mock('../../booking-sql/db/healthcheck', () => ({
  bookingSqlHealthcheck: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../booking-sql/db/client', () => ({
  getPrisma: jest.fn(),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeOccurrence(overrides = {}) {
  return {
    id: 'occ-uuid-1',
    occurrenceNo: 1,
    status: 'confirmed',
    startAtUtc: new Date('2026-04-07T17:00:00Z'),
    endAtUtc: new Date('2026-04-07T18:00:00Z'),
    timezone: 'America/Los_Angeles',
    localStartWallclock: '2026-04-07T10:00',
    localEndWallclock: '2026-04-07T11:00',
    ...overrides,
  };
}

function makeBooking(overrides = {}) {
  return {
    id: 'booking-uuid-1',
    bookingRef: 'bk_123456_abc',
    currentState: 'confirmed',
    clientId: 'client-1',
    freelancerId: 'freelancer-1',
    serviceOfferingId: null,
    pricingSnapshotJson: { amountCents: 5000, currency: 'usd' },
    policySnapshotJson: { tier: 'flexible', snapshotVersion: 1 },
    notes: '',
    createdAt: new Date('2026-04-06T12:00:00Z'),
    updatedAt: new Date('2026-04-06T12:00:00Z'),
    occurrences: [makeOccurrence()],
    ...overrides,
  };
}

function makeReq({ user = { userId: 'client-1' }, params = {}, query = {}, body = {}, headers = {} } = {}) {
  return {
    user,
    params,
    query,
    body,
    header: (name) => headers[name] || null,
  };
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

// ─── Isolate controller with mocked BookingRepo ───────────────────────────────

let mockFindByActor;
let mockFindByIdWithOccurrences;

jest.mock('../../booking-sql/repos/BookingRepo', () => {
  mockFindByActor = jest.fn();
  mockFindByIdWithOccurrences = jest.fn();
  return {
    BookingRepo: jest.fn().mockImplementation(() => ({
      findByActor: mockFindByActor,
      findByIdWithOccurrences: mockFindByIdWithOccurrences,
    })),
  };
});

// Must require AFTER mocks are set up
const { getMyBookingsSql, getBookingByIdSql } = require('../../booking-sql/routes/bookingsSqlController');

// ─── withHandler error boundary ───────────────────────────────────────────────

describe('withHandler error boundary', () => {
  test('returns 500 when repo throws unexpectedly', async () => {
    mockFindByActor.mockRejectedValue(new Error('Neon connection timeout'));
    const req = makeReq({ query: { role: 'client', status: 'upcoming' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(res._status).toBe(500);
    expect(res._body.code).toBe('BOOKING_SQL_INTERNAL_ERROR');
  });

  test('does not double-send if headers already sent', async () => {
    mockFindByActor.mockRejectedValue(new Error('late throw'));
    const req = makeReq({ query: {} });
    const res = makeRes();
    res.headersSent = true; // simulate already-sent response
    // should not throw even though headers are sent
    await expect(getMyBookingsSql(req, res)).resolves.not.toThrow();
  });
});

// ─── getMyBookingsSql tests ───────────────────────────────────────────────────

describe('getMyBookingsSql', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns bookings array for client upcoming', async () => {
    mockFindByActor.mockResolvedValue([makeBooking()]);
    const req = makeReq({ query: { role: 'client', status: 'upcoming' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(res._status).toBe(200);
    expect(res._body).toHaveProperty('bookings');
    expect(res._body.bookings).toHaveLength(1);
  });

  test('response shape has required fields', async () => {
    mockFindByActor.mockResolvedValue([makeBooking()]);
    const req = makeReq({ query: {} });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    const b = res._body.bookings[0];
    expect(b).toHaveProperty('id');
    expect(b).toHaveProperty('bookingRef');
    expect(b).toHaveProperty('status');
    expect(b).toHaveProperty('date');
    expect(b).toHaveProperty('startTime');
    expect(b).toHaveProperty('endTime');
    expect(b).toHaveProperty('occurrences');
    expect(b).toHaveProperty('clientId');
    expect(b).toHaveProperty('freelancerId');
  });

  test('extracts date and startTime from primary occurrence', async () => {
    mockFindByActor.mockResolvedValue([makeBooking()]);
    const req = makeReq({ query: {} });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    const b = res._body.bookings[0];
    expect(b.date).toBe('2026-04-07');
    expect(b.startTime).toBe('10:00');
    expect(b.endTime).toBe('11:00');
  });

  test('returns empty array when no bookings found', async () => {
    mockFindByActor.mockResolvedValue([]);
    const req = makeReq({ query: { status: 'cancelled' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(res._body.bookings).toHaveLength(0);
  });

  test('rejects invalid role with 400', async () => {
    const req = makeReq({ query: { role: 'admin' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(res._status).toBe(400);
    expect(res._body.code).toBe('INVALID_ROLE');
  });

  test('rejects invalid status with 400', async () => {
    const req = makeReq({ query: { status: 'bogus' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(res._status).toBe(400);
    expect(res._body.code).toBe('INVALID_STATUS');
  });

  test('passes role=freelancer to repo', async () => {
    mockFindByActor.mockResolvedValue([]);
    const req = makeReq({ user: { userId: 'freelancer-1' }, query: { role: 'freelancer', status: 'past' } });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    expect(mockFindByActor).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'freelancer', status: 'past', actorId: 'freelancer-1' })
    );
  });

  test('occurrences array on each booking is shaped correctly', async () => {
    mockFindByActor.mockResolvedValue([makeBooking()]);
    const req = makeReq({ query: {} });
    const res = makeRes();
    await getMyBookingsSql(req, res);
    const occ = res._body.bookings[0].occurrences[0];
    expect(occ).toHaveProperty('id');
    expect(occ).toHaveProperty('occurrenceNo');
    expect(occ).toHaveProperty('status');
    expect(occ).toHaveProperty('startAtUtc');
    expect(occ).toHaveProperty('localStartWallclock');
  });
});

// ─── getBookingByIdSql tests ──────────────────────────────────────────────────

describe('getBookingByIdSql', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 400 when bookingId missing', async () => {
    const req = makeReq({ params: {} });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(400);
  });

  test('returns 404 when booking not found', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(null);
    const req = makeReq({ params: { bookingId: 'missing-id' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(404);
    expect(res._body.code).toBe('BOOKING_NOT_FOUND');
  });

  test('returns 403 when actor is neither client nor freelancer', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(makeBooking());
    const req = makeReq({ user: { userId: 'random-stranger' }, params: { bookingId: 'booking-uuid-1' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(403);
    expect(res._body.code).toBe('NOT_AUTHORIZED');
  });

  test('returns booking for authorized client', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(makeBooking());
    const req = makeReq({ user: { userId: 'client-1' }, params: { bookingId: 'booking-uuid-1' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(200);
    expect(res._body).toHaveProperty('booking');
    expect(res._body.booking.id).toBe('booking-uuid-1');
  });

  test('returns booking for authorized freelancer', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(makeBooking());
    const req = makeReq({ user: { userId: 'freelancer-1' }, params: { bookingId: 'booking-uuid-1' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(200);
  });

  test('booking detail has correct shape', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(makeBooking());
    const req = makeReq({ user: { userId: 'client-1' }, params: { bookingId: 'booking-uuid-1' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    const b = res._body.booking;
    expect(b).toHaveProperty('id');
    expect(b).toHaveProperty('bookingRef');
    expect(b).toHaveProperty('status');
    expect(b).toHaveProperty('date', '2026-04-07');
    expect(b).toHaveProperty('startTime', '10:00');
    expect(b).toHaveProperty('pricing');
    expect(b).toHaveProperty('policy');
    expect(b).toHaveProperty('occurrences');
  });

  test('booking with no occurrences returns null date/time safely', async () => {
    mockFindByIdWithOccurrences.mockResolvedValue(makeBooking({ occurrences: [] }));
    const req = makeReq({ user: { userId: 'client-1' }, params: { bookingId: 'booking-uuid-1' } });
    const res = makeRes();
    await getBookingByIdSql(req, res);
    expect(res._status).toBe(200);
    expect(res._body.booking.date).toBeNull();
    expect(res._body.booking.startTime).toBeNull();
  });
});
