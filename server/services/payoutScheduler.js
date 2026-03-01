/**
 * Payout Scheduler — determines payout delay based on freelancer's plan.
 *
 * Payout tiers:
 *   - Free:     3 business days hold
 *   - Plus:     1 business day hold (faster_payout feature)
 *   - Pro:      Immediate (faster_payout feature + pro plan)
 *
 * Usage:
 *   const { getPayoutDelay, schedulePayoutDate } = require('./payoutScheduler');
 *   const delay = await getPayoutDelay(freelancerId);
 *   // delay = { days: 3, tier: 'standard', label: '3 business days' }
 *
 * The actual delay enforcement happens in the payment release flow.
 * When a job is completed:
 *   1. Calculate payout date: now + delay days
 *   2. Store scheduledPayoutDate on the Payment record
 *   3. A cron job (or webhook) processes payouts when the date arrives
 *   OR for Pro users, transfer immediately.
 */

const { hasFeature } = require('./entitlementEngine');

const PAYOUT_TIERS = {
  priority:  { days: 0, tier: 'priority',  label: 'Immediate',        feature: 'pro' },
  faster:    { days: 1, tier: 'faster',    label: '1 business day',   feature: 'plus' },
  standard:  { days: 3, tier: 'standard',  label: '3 business days',  feature: 'free' },
};

/**
 * Determine payout delay for a freelancer based on their plan.
 * @param {string} userId — freelancer's user ID
 * @returns {Promise<{ days: number, tier: string, label: string }>}
 */
async function getPayoutDelay(userId) {
  try {
    const hasFasterPayout = await hasFeature(userId, 'faster_payout');

    if (!hasFasterPayout) {
      return PAYOUT_TIERS.standard;
    }

    // Has faster_payout — check if Pro (immediate) or Plus (1 day)
    const hasAdvancedAnalytics = await hasFeature(userId, 'advanced_analytics');
    // Pro users have advanced_analytics; Plus users don't
    if (hasAdvancedAnalytics) {
      return PAYOUT_TIERS.priority;
    }

    return PAYOUT_TIERS.faster;
  } catch (err) {
    console.error('Payout delay check failed, using standard:', err.message);
    return PAYOUT_TIERS.standard;
  }
}

/**
 * Calculate the scheduled payout date.
 * Skips weekends for business day calculation.
 */
function schedulePayoutDate(fromDate, businessDays) {
  if (businessDays === 0) return fromDate;

  const date = new Date(fromDate);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // skip Sat/Sun
      remaining--;
    }
  }

  return date;
}

/**
 * Get payout info for display (frontend / admin).
 */
async function getPayoutInfo(userId) {
  const delay = await getPayoutDelay(userId);
  return {
    ...delay,
    nextTier: delay.tier === 'standard' ? 'faster' : delay.tier === 'faster' ? 'priority' : null,
    upgradeBenefit: delay.tier === 'standard'
      ? 'Upgrade to Plus for 1-day payouts'
      : delay.tier === 'faster'
        ? 'Upgrade to Pro for immediate payouts'
        : null,
  };
}

module.exports = {
  getPayoutDelay,
  schedulePayoutDate,
  getPayoutInfo,
  PAYOUT_TIERS,
};
