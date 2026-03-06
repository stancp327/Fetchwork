class PolicyEngine {
  /**
   * Evaluate cancellation fees from an immutable booking policy snapshot.
   * Returns cents-based deterministic outcome.
   */
  evaluateCancellation({ policySnapshot = {}, bookingAmountCents = 0, startAtUtc, cancelledAtUtc = new Date() }) {
    const tier = String(policySnapshot?.tier || 'flexible').toLowerCase();
    const chargePct = this._getChargePctByTierAndWindow({ tier, startAtUtc, cancelledAtUtc });

    const gross = Math.max(0, Number(bookingAmountCents || 0));
    const chargeCents = Math.round(gross * chargePct);
    const refundCents = Math.max(0, gross - chargeCents);

    return {
      tier,
      chargePct,
      bookingAmountCents: gross,
      chargeCents,
      refundCents,
      chargeFeeAmountCents: chargeCents,
      refundAmountCents: refundCents,
    };
  }

  _getChargePctByTierAndWindow({ tier, startAtUtc, cancelledAtUtc }) {
    const start = new Date(startAtUtc);
    const cancelled = new Date(cancelledAtUtc);
    if (Number.isNaN(start.getTime()) || Number.isNaN(cancelled.getTime())) {
      return 0;
    }

    const hours = (start.getTime() - cancelled.getTime()) / (1000 * 60 * 60);

    // Strict: 7d+=0%, 48h-7d=50%, <48h=100%
    if (tier === 'strict') {
      if (hours >= 168) return 0.0;  // 7 days
      if (hours >= 48) return 0.5;
      return 1.0;
    }

    // Moderate: 48h+=0%, 24-48h=50%, <24h=100%
    if (tier === 'moderate') {
      if (hours >= 48) return 0.0;
      if (hours >= 24) return 0.5;
      return 1.0;
    }

    // Flexible (default): 24h+=0%, 2-24h=50%, <2h=100%
    if (hours >= 24) return 0.0;
    if (hours >= 2) return 0.5;
    return 1.0;
  }
}

module.exports = { PolicyEngine };
