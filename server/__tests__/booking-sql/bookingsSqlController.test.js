const { getSlotsSql, createBookingHoldSql, confirmBookingSql, cancelBookingSql, completeBookingSql } = require('../../booking-sql/routes/bookingsSqlController');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

describe('bookingsSqlController (pre-DB scaffold)', () => {
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
    else delete process.env.DATABASE_URL;
  });

  test('getSlotsSql requires date', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getSlotsSql(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/date query param required/i);
  });

  test('getSlotsSql returns 503 when DATABASE_URL missing', async () => {
    const req = { query: { date: '2026-03-06' } };
    const res = mockRes();
    await getSlotsSql(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('BOOKING_SQL_NOT_READY');
  });

  test('createBookingHoldSql requires body fields', async () => {
    const req = { body: {}, header: () => null };
    const res = mockRes();
    await createBookingHoldSql(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('createBookingHoldSql returns 503 when DATABASE_URL missing', async () => {
    const req = {
      body: { date: '2026-03-06', startTime: '09:00', endTime: '10:00' },
      header: () => 'idem-1',
    };
    const res = mockRes();
    await createBookingHoldSql(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('BOOKING_SQL_NOT_READY');
  });

  test('confirmBookingSql requires bookingId', async () => {
    const req = { params: {}, header: () => null };
    const res = mockRes();
    await confirmBookingSql(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('confirmBookingSql returns 503 when DATABASE_URL missing', async () => {
    const req = {
      params: { bookingId: 'abc-123' },
      header: () => 'idem-2',
    };
    const res = mockRes();
    await confirmBookingSql(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('BOOKING_SQL_NOT_READY');
  });

  test('cancelBookingSql requires bookingId', async () => {
    const req = { params: {}, header: () => null, body: {} };
    const res = mockRes();
    await cancelBookingSql(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('completeBookingSql requires bookingId', async () => {
    const req = { params: {}, header: () => null };
    const res = mockRes();
    await completeBookingSql(req, res);
    expect(res.statusCode).toBe(400);
  });
});
