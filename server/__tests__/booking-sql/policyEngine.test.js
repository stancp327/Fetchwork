const { PolicyEngine } = require('../../booking-sql/services/PolicyEngine');

describe('PolicyEngine cancellation matrix', () => {
  const engine = new PolicyEngine();
  const amount = 12000; // $120.00 in cents

  // ═══════════════════════════════════════════════════════════════════════════
  // FLEXIBLE TIER: 24h+=0%, 2-24h=50%, <2h=100%
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Flexible tier', () => {
    test('>=24h => 0% charge (full refund)', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-06T01:00:00Z'); // 25h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.0);
      expect(out.chargeCents).toBe(0);
      expect(out.refundCents).toBe(amount);
    });

    test('exactly 24h => 0% charge (boundary, favorable)', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // exactly 24h
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.0);
      expect(out.chargeCents).toBe(0);
    });

    test('2-24h => 50% charge', () => {
      const now = new Date('2026-03-05T12:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 12h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.5);
      expect(out.chargeCents).toBe(6000);
      expect(out.refundCents).toBe(6000);
    });

    test('<2h => 100% charge (no refund)', () => {
      const now = new Date('2026-03-05T23:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 1h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(1.0);
      expect(out.chargeCents).toBe(amount);
      expect(out.refundCents).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATE TIER: 48h+=0%, 24-48h=50%, <24h=100%
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Moderate tier', () => {
    test('>=48h => 0% charge (full refund)', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-07T01:00:00Z'); // 49h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'moderate' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.0);
      expect(out.chargeCents).toBe(0);
      expect(out.refundCents).toBe(amount);
    });

    test('24-48h => 50% charge', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-06T06:00:00Z'); // 30h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'moderate' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.5);
      expect(out.chargeCents).toBe(6000);
      expect(out.refundCents).toBe(6000);
    });

    test('<24h => 100% charge (no refund)', () => {
      const now = new Date('2026-03-05T12:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 12h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'moderate' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(1.0);
      expect(out.chargeCents).toBe(amount);
      expect(out.refundCents).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRICT TIER: 7d+=0%, 48h-7d=50%, <48h=100%
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Strict tier', () => {
    test('>=7d (168h) => 0% charge (full refund)', () => {
      const now = new Date('2026-03-01T00:00:00Z');
      const start = new Date('2026-03-08T01:00:00Z'); // 169h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'strict' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.0);
      expect(out.chargeCents).toBe(0);
      expect(out.refundCents).toBe(amount);
    });

    test('48h-7d => 50% charge', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-08T00:00:00Z'); // 72h out (3 days)
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'strict' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(0.5);
      expect(out.chargeCents).toBe(6000);
      expect(out.refundCents).toBe(6000);
    });

    test('<48h => 100% charge (no refund)', () => {
      const now = new Date('2026-03-05T12:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 12h out
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'strict' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(1.0);
      expect(out.chargeCents).toBe(amount);
      expect(out.refundCents).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Edge cases', () => {
    test('already started (negative hours) => 100% charge', () => {
      const now = new Date('2026-03-06T01:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 1h ago
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargePct).toBe(1.0);
      expect(out.chargeCents).toBe(amount);
    });

    test('zero-dollar booking => no error', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z');
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: 0, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.chargeCents).toBe(0);
      expect(out.refundCents).toBe(0);
    });

    test('invalid dates => 0% charge (fallback)', () => {
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: 'invalid', 
        cancelledAtUtc: new Date() 
      });
      expect(out.chargePct).toBe(0);
    });

    test('missing tier defaults to flexible', () => {
      const now = new Date('2026-03-05T00:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 24h
      const out = engine.evaluateCancellation({ 
        policySnapshot: {}, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out.tier).toBe('flexible');
      expect(out.chargePct).toBe(0.0); // 24h = favorable
    });

    test('returns chargeFeeAmountCents and refundAmountCents', () => {
      const now = new Date('2026-03-05T12:00:00Z');
      const start = new Date('2026-03-06T00:00:00Z'); // 12h
      const out = engine.evaluateCancellation({ 
        policySnapshot: { tier: 'flexible' }, 
        bookingAmountCents: amount, 
        startAtUtc: start, 
        cancelledAtUtc: now 
      });
      expect(out).toHaveProperty('chargeFeeAmountCents');
      expect(out).toHaveProperty('refundAmountCents');
      expect(out.chargeFeeAmountCents).toBe(out.chargeCents);
      expect(out.refundAmountCents).toBe(out.refundCents);
    });
  });
});
