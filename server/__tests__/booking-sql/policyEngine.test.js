const { PolicyEngine } = require('../../booking-sql/services/PolicyEngine');

describe('PolicyEngine cancellation matrix', () => {
  const engine = new PolicyEngine();
  const amount = 12000;

  test('flexible >=24h => 0% charge', () => {
    const now = new Date('2026-03-05T00:00:00Z');
    const start = new Date('2026-03-06T01:00:00Z'); // 25h
    const out = engine.evaluateCancellation({ policySnapshot: { tier: 'flexible' }, bookingAmountCents: amount, startAtUtc: start, cancelledAtUtc: now });
    expect(out.chargeCents).toBe(0);
    expect(out.refundCents).toBe(amount);
  });

  test('strict <24h => 100% charge', () => {
    const now = new Date('2026-03-05T12:00:00Z');
    const start = new Date('2026-03-06T00:00:00Z'); // 12h
    const out = engine.evaluateCancellation({ policySnapshot: { tier: 'strict' }, bookingAmountCents: amount, startAtUtc: start, cancelledAtUtc: now });
    expect(out.chargeCents).toBe(amount);
    expect(out.refundCents).toBe(0);
  });

  test('moderate 24-48h => 25% charge', () => {
    const now = new Date('2026-03-05T00:00:00Z');
    const start = new Date('2026-03-06T06:00:00Z'); // 30h
    const out = engine.evaluateCancellation({ policySnapshot: { tier: 'moderate' }, bookingAmountCents: amount, startAtUtc: start, cancelledAtUtc: now });
    expect(out.chargeCents).toBe(3000);
    expect(out.refundCents).toBe(9000);
  });
});
