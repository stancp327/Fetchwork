const { getSlotsSql, createBookingHoldSql, confirmBookingSql } = require('../routes/bookingsSqlController');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

describe('bookingsSqlController (pre-DB scaffold)', () => {
  test('getSlotsSql requires date', async () => {
    const req = { query: {} };
    const res = mockRes();
    await getSlotsSql(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/date query param required/i);
  });

  test('createBookingHoldSql requires body fields', async () => {
    const req = { body: {}, header: () => null };
    const res = mockRes();
    await createBookingHoldSql(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('confirmBookingSql requires bookingId', async () => {
    const req = { params: {}, header: () => null };
    const res = mockRes();
    await confirmBookingSql(req, res);
    expect(res.statusCode).toBe(400);
  });
});
