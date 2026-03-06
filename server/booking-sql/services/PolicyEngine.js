class PolicyEngine {
  /**
   * Evaluate reschedule eligibility and fees.
   * Returns whether reschedule is allowed and any applicable fee.
   * 
   * Reschedule policy (from booking-feature-project.md):
   * - Flexible: free if T >= 6h, else $X or % fee, max 2 reschedules
   * - Moderate: free if T >= 24h, else fee
   * - Strict: free if T >= 48h, else fee, max 1 reschedule
   */
  evaluateReschedule({ 
    policySnapshot = {}, 
    bookingAmountCents = 0, 
    startAtUtc, 
    rescheduleAtUtc = new Date(),
    rescheduleCount = 0,
  }) {
    const tier = String(policySnapshot?.tier || 'flexible').toLowerCase();
    const start = new Date(startAtUtc);
    const rescheduleAt = new Date(rescheduleAtUtc);
    
    if (Number.isNaN(start.getTime()) || Number.isNaN(rescheduleAt.getTime())) {
      return { allowed: false, reason: 'Invalid dates', feeCents: 0 };
    }

    const hours = (start.getTime() - rescheduleAt.getTime()) / (1000 * 60 * 60);
    const gross = Math.max(0, Number(bookingAmountCents || 0));

    // Check max reschedule count
    const maxReschedules = this._getMaxReschedules(tier);
    if (rescheduleCount >= maxReschedules) {
      return { 
        allowed: false, 
        reason: `Maximum reschedules (${maxReschedules}) reached for ${tier} policy`,
        feeCents: 0,
        maxReschedules,
        rescheduleCount,
        tier,
      };
    }

    // Already started
    if (hours <= 0) {
      return { allowed: false, reason: 'Cannot reschedule past bookings', feeCents: 0 };
    }

    // Get fee based on tier and time window
    const { free, feePct } = this._getRescheduleFeeByTier(tier, hours);
    const feeCents = free ? 0 : Math.round(gross * feePct);

    return {
      allowed: true,
      tier,
      hoursUntilStart: hours,
      rescheduleCount: rescheduleCount + 1,
      maxReschedules,
      free,
      feePct: free ? 0 : feePct,
      feeCents,
      bookingAmountCents: gross,
    };
  }

  _getMaxReschedules(tier) {
    switch (tier) {
      case 'strict': return 1;
      case 'moderate': return 2;
      case 'flexible':
      default: return 2;
    }
  }

  _getRescheduleFeeByTier(tier, hours) {
    // Strict: free if >= 48h, else 10% fee
    if (tier === 'strict') {
      return hours >= 48 ? { free: true } : { free: false, feePct: 0.10 };
    }

    // Moderate: free if >= 24h, else 10% fee
    if (tier === 'moderate') {
      return hours >= 24 ? { free: true } : { free: false, feePct: 0.10 };
    }

    // Flexible: free if >= 6h, else 5% fee
    return hours >= 6 ? { free: true } : { free: false, feePct: 0.05 };
  }

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
