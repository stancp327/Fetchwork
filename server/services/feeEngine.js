/**
 * Fee Engine — calculates platform fees based on user's plan.
 *
 * Usage:
 *   const { getFee } = require('./feeEngine');
 *   const fee = await getFee({ userId, role, jobType, amount });
 *
 * Rules (in priority order):
 *   1. Fee waiver (User.isFeeWaived) → 0
 *   2. UserSubscription.feeRateOverrides (admin-set per-user rate)
 *   3. Active PromoRule that matches this user
 *   4. Plan default fee rates
 *   5. Hardcoded fallback (10% remote, local bracket defaults)
 *
 * Local freelancer fee is ALWAYS $0 — no exceptions.
 */

const User             = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const Plan             = require('../models/Plan');
const PromoRule        = require('../models/PromoRule');
const BillingAuditLog  = require('../models/BillingAuditLog');

// ── Fallback rates (used if no plan found) ──────────────────────
const FALLBACK_RATES = {
  remoteClient:     0.05,
  remoteFreelancer: 0.10,
  localClient: { upTo50: 4, upTo150: 6, upTo400: 10 },  // $400+ uses remoteClient %
};

// ── Local flat fee lookup ───────────────────────────────────────
function getLocalClientFlatFee(localRates, amount) {
  if (amount < 50)  return localRates.upTo50   ?? FALLBACK_RATES.localClient.upTo50;
  if (amount < 150) return localRates.upTo150  ?? FALLBACK_RATES.localClient.upTo150;
  if (amount < 400) return localRates.upTo400  ?? FALLBACK_RATES.localClient.upTo400;
  // $400+ uses percentage (same as remote client rate) — returns null to signal caller
  return null;
}

// ── Check active promo rules for a user ────────────────────────
async function getActivePromo(userId, audience) {
  const user = await User.findById(userId).select('createdAt role').lean();
  if (!user) return null;
  const now = new Date();
  const promos = await PromoRule.find({
    active:    true,
    startDate: { $lte: now },
    endDate:   { $gte: now },
    $or: [
      { audience: 'both' },
      { audience },
      { appliesTo: 'specific_users', specificUsers: userId },
    ],
  }).lean();

  for (const promo of promos) {
    if (promo.appliesTo === 'specific_users') {
      if (promo.specificUsers.some(id => String(id) === String(userId))) return promo;
      continue;
    }
    if (promo.appliesTo === 'new_users') {
      const signupInWindow =
        (!promo.cohortSignupStart || user.createdAt >= promo.cohortSignupStart) &&
        (!promo.cohortSignupEnd   || user.createdAt <= promo.cohortSignupEnd);
      if (signupInWindow) return promo;
      continue;
    }
    if (promo.appliesTo === 'existing_users') {
      const beforeWindow = !promo.cohortSignupEnd || user.createdAt < promo.cohortSignupEnd;
      if (beforeWindow) return promo;
      continue;
    }
    if (promo.appliesTo === 'all') return promo;
  }
  return null;
}

/**
 * Main fee calculation.
 *
 * @param {Object} opts
 * @param {string}  opts.userId   — user paying or receiving the fee
 * @param {string}  opts.role     — 'client' | 'freelancer'
 * @param {string}  opts.jobType  — 'local' | 'remote'
 * @param {number}  opts.amount   — job/booking amount in USD
 * @returns {Promise<{ fee: number, feeRate: number|null, source: string }>}
 *   fee      — dollar amount to deduct
 *   feeRate  — decimal rate used (null for flat fees)
 *   source   — where the rate came from (for logging/display)
 */
async function getFee({ userId, role, jobType, amount }) {
  // ── Local freelancer: always free ──────────────────────────────
  if (jobType === 'local' && role === 'freelancer') {
    return { fee: 0, feeRate: 0, source: 'local_freelancer_free' };
  }

  // ── 1. Fee waiver check ────────────────────────────────────────
  try {
    const user = await User.findById(userId).select('feeWaiver role').lean();
    // Use schema method — need full doc for method
    const fullUser = await User.findById(userId).select('feeWaiver');
    if (fullUser && fullUser.isFeeWaived()) {
      return { fee: 0, feeRate: 0, source: 'fee_waiver' };
    }
  } catch { /* continue */ }

  // ── Load subscription + plan ───────────────────────────────────
  let sub  = null;
  let plan = null;
  try {
    sub = await UserSubscription.findOne({ user: userId, status: 'active' }).populate('plan').lean();
    plan = sub?.plan || null;

    // If grant expired, ignore it
    if (sub?.grantExpiresAt && new Date() > sub.grantExpiresAt) {
      sub = null;
      plan = null;
    }
  } catch { /* continue with fallback */ }

  const audience = role === 'client' ? 'client' : 'freelancer';

  // ── 2. Per-user fee rate override (admin-set) ──────────────────
  if (sub?.feeRateOverrides) {
    const ov = sub.feeRateOverrides;
    if (jobType === 'remote' && role === 'client'     && ov.remoteClient     != null)
      return { fee: roundFee(amount * ov.remoteClient),     feeRate: ov.remoteClient,     source: 'user_override' };
    if (jobType === 'remote' && role === 'freelancer'  && ov.remoteFreelancer != null)
      return { fee: roundFee(amount * ov.remoteFreelancer), feeRate: ov.remoteFreelancer, source: 'user_override' };
    if (jobType === 'local'  && role === 'client'      && ov.localClient) {
      const flatFee = getLocalClientFlatFee(ov.localClient, amount);
      if (flatFee != null) return { fee: flatFee, feeRate: null, source: 'user_override' };
    }
  }

  // ── 3. Active promo rule ───────────────────────────────────────
  try {
    const promo = await getActivePromo(userId, audience);
    if (promo?.feeRateOverrides) {
      const ov = promo.feeRateOverrides;
      if (jobType === 'remote' && role === 'client'     && ov.remoteClient     != null)
        return { fee: roundFee(amount * ov.remoteClient),     feeRate: ov.remoteClient,     source: `promo:${promo._id}` };
      if (jobType === 'remote' && role === 'freelancer'  && ov.remoteFreelancer != null)
        return { fee: roundFee(amount * ov.remoteFreelancer), feeRate: ov.remoteFreelancer, source: `promo:${promo._id}` };
      if (jobType === 'local'  && role === 'client'      && ov.localClient) {
        const flatFee = getLocalClientFlatFee(ov.localClient, amount);
        if (flatFee != null) return { fee: flatFee, feeRate: null, source: `promo:${promo._id}` };
      }
    }
  } catch { /* continue */ }

  // ── 4. Plan default rates ──────────────────────────────────────
  if (plan?.feeRates) {
    const r = plan.feeRates;
    if (jobType === 'remote' && role === 'client')
      return { fee: roundFee(amount * r.remoteClient),     feeRate: r.remoteClient,     source: `plan:${plan.slug}` };
    if (jobType === 'remote' && role === 'freelancer')
      return { fee: roundFee(amount * r.remoteFreelancer), feeRate: r.remoteFreelancer, source: `plan:${plan.slug}` };
    if (jobType === 'local'  && role === 'client' && r.localClient) {
      const flatFee = getLocalClientFlatFee(r.localClient, amount);
      if (flatFee != null) return { fee: flatFee, feeRate: null, source: `plan:${plan.slug}` };
      // $400+ falls through to percentage
      return { fee: roundFee(amount * r.remoteClient), feeRate: r.remoteClient, source: `plan:${plan.slug}:pct` };
    }
  }

  // ── 5. Hardcoded fallback ──────────────────────────────────────
  if (jobType === 'remote' && role === 'client')
    return { fee: roundFee(amount * FALLBACK_RATES.remoteClient),     feeRate: FALLBACK_RATES.remoteClient,     source: 'fallback' };
  if (jobType === 'remote' && role === 'freelancer')
    return { fee: roundFee(amount * FALLBACK_RATES.remoteFreelancer), feeRate: FALLBACK_RATES.remoteFreelancer, source: 'fallback' };
  if (jobType === 'local' && role === 'client') {
    const flatFee = getLocalClientFlatFee(FALLBACK_RATES.localClient, amount);
    if (flatFee != null) return { fee: flatFee, feeRate: null, source: 'fallback' };
    // $400+ falls through to percentage
    return { fee: roundFee(amount * FALLBACK_RATES.remoteClient), feeRate: FALLBACK_RATES.remoteClient, source: 'fallback:pct' };
  }

  return { fee: 0, feeRate: 0, source: 'unknown' };
}

function roundFee(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Convenience wrapper — returns just the dollar fee amount.
 * Drop-in replacement for the old calcPlatformFee().
 * Defaults to remote + freelancer (the most common call site).
 */
async function calcPlatformFeeAsync({ userId, role = 'freelancer', jobType = 'remote', amount }) {
  const result = await getFee({ userId, role, jobType, amount });
  return result.fee;
}

// ── Fees-included calculator ─────────────────────────────────────
// When freelancer lists a price with fees already baked in,
// we reverse-calculate the base and split correctly.
//
// For remote (percentage):
//   listedPrice = base × (1 + clientRate)
//   base        = listedPrice / (1 + clientRate)
//   clientFee   = listedPrice - base
//   freelancerFee = base × freelancerRate
//   clientCharges = listedPrice  (client pays exactly the listed price)
//   freelancerPayout = listedPrice - clientFee - freelancerFee
//
// For local (flat fee):
//   listedPrice = base + flatFee  →  base = listedPrice - flatFee
//   clientCharges = listedPrice
//   freelancerPayout = listedPrice - flatFee (local freelancer fee always $0)

async function getFeeIncluded({ userId, role, jobType, listedPrice }) {
  // Determine rates without knowing base yet — look up user plan first
  let clientPlanKey     = 'free';
  let freelancerPlanKey = 'free';
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('subscription').lean();
    const plan = user?.subscription?.plan?.toLowerCase() || 'free';
    if (role === 'client') {
      if (plan.includes('business') || plan.includes('pro')) clientPlanKey = 'business';
      else if (plan.includes('plus'))                        clientPlanKey = 'plus';
    } else {
      if (plan.includes('pro') || plan.includes('business')) freelancerPlanKey = 'pro';
      else if (plan.includes('plus'))                        freelancerPlanKey = 'plus';
    }
  } catch { /* use defaults */ }

  if (jobType === 'local') {
    const flatFee = getLocalClientFlatFee(FALLBACK_RATES.localClient, listedPrice);
    if (flatFee != null) {
      // Under $400: flat fee
      const base        = Math.max(0, listedPrice - flatFee);
      const clientFee   = flatFee;
      const freelancerFee = 0;
      return {
        base, listedPrice,
        clientFee, freelancerFee,
        totalPlatformFee: clientFee,
        clientCharges:    listedPrice,
        freelancerPayout: roundFee(base),
        feesIncluded:     true,
        source:           'fees_included_local',
      };
    }
    // $400+: fall through to percentage (same as remote)
  }

  // Remote: reverse-calculate from listed price
  const clientRates     = { free: 0.05, plus: 0.03, business: 0.02 };
  const freelancerRates = { free: 0.10, plus: 0.07, pro: 0.05 };
  const clientRate      = clientRates[clientPlanKey]     ?? 0.05;
  const freelancerRate  = freelancerRates[freelancerPlanKey] ?? 0.10;

  const base          = roundFee(listedPrice / (1 + clientRate));
  const clientFee     = roundFee(listedPrice - base);
  const freelancerFee = roundFee(base * freelancerRate);
  const totalPlatformFee = roundFee(clientFee + freelancerFee);
  const freelancerPayout = roundFee(listedPrice - clientFee - freelancerFee);

  return {
    base, listedPrice,
    clientFee, freelancerFee,
    totalPlatformFee,
    clientCharges:    listedPrice,  // client pays exactly the listed price
    freelancerPayout,
    feesIncluded:     true,
    source:           'fees_included_remote',
  };
}

// ── Tip / bonus: always fee-free ─────────────────────────────────
async function getTipFee() {
  return { fee: 0, feeRate: 0, source: 'tip_fee_free' };
}

// ── Recurring service fee (per billing cycle) ─────────────────────
// Same priority chain as getFee, but always uses remote % rates.
async function getRecurringFee({ userId, role, amount }) {
  return getFee({ userId, role, jobType: 'remote', amount });
}

// ── Bundle fee (upfront full-price charge) ────────────────────────
// Fee taken on full bundle amount at time of purchase.
async function getBundleFee({ userId, role, jobType = 'remote', amount }) {
  return getFee({ userId, role, jobType, amount });
}

// ── Human-readable fee display string ────────────────────────────
function getFeeDisplay({ fee, feeRate, jobType, role }) {
  if (fee === 0) return 'No platform fee';
  if (jobType === 'local' && role === 'client') return `Platform fee: $${fee.toFixed(2)}`;
  if (feeRate != null) return `${(feeRate * 100).toFixed(0)}% platform fee ($${fee.toFixed(2)})`;
  return `Platform fee: $${fee.toFixed(2)}`;
}

// ── Cents helpers for Stripe ──────────────────────────────────────
function toCents(dollars) { return Math.round(dollars * 100); }
function fromCents(cents)  { return Math.round(cents) / 100; }

module.exports = {
  getFee,
  getFeeIncluded,
  calcPlatformFeeAsync,
  getTipFee,
  getRecurringFee,
  getBundleFee,
  getFeeDisplay,
  getLocalClientFlatFee,
  FALLBACK_RATES,
  toCents,
  fromCents,
};
