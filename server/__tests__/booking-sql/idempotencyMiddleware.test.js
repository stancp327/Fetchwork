const { buildRequestHash, requireIdempotencyKey } = require('../../booking-sql/middleware/idempotency');

describe('idempotency middleware scaffold', () => {
  test('buildRequestHash is deterministic', () => {
    const reqA = { method: 'POST', path: '/api/bookings/1', body: { a: 1 } };
    const reqB = { method: 'POST', path: '/api/bookings/1', body: { a: 1 } };
    expect(buildRequestHash(reqA)).toBe(buildRequestHash(reqB));
  });

  test('requireIdempotencyKey rejects missing header', () => {
    const req = { header: () => null };
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    const next = jest.fn();

    requireIdempotencyKey(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
