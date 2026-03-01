/**
 * Entitlements middleware — plan-based feature gating.
 *
 * Priority: fee waiver / admin grant > active subscription > plan default > hardcoded fallback
 */
const { getUserSubscription } = require('../utils/billingUtils');
const Job     = require('../models/Job');
const Service = require('../models/Service');

// ── Fallback limits when no plan found ─────────────────────────
const FALLBACK_LIMITS = { activeJobs: 3, activeServices: 1, analyticsLevel: 'basic' };

/**
 * Get a user's resolved plan limits.
 * Returns { activeJobs, activeServices, analyticsLevel }
 */
async function getPlanLimits(userId) {
  try {
    const sub = await getUserSubscription(userId);
    if (!sub?.plan?.limits) return FALLBACK_LIMITS;
    const l = sub.plan.limits;
    return {
      activeJobs:      l.activeJobs      ?? FALLBACK_LIMITS.activeJobs,
      activeServices:  l.activeServices  ?? FALLBACK_LIMITS.activeServices,
      analyticsLevel:  l.analyticsLevel  || FALLBACK_LIMITS.analyticsLevel,
    };
  } catch {
    return FALLBACK_LIMITS;
  }
}

/**
 * Get just the analytics level for a user.
 * Returns 'basic' | 'standard' | 'full'
 */
async function getAnalyticsLevel(userId) {
  const limits = await getPlanLimits(userId);
  return limits.analyticsLevel;
}

/**
 * Middleware: prevent job creation if user is at their plan's activeJobs limit.
 * Attaches req.planLimits for downstream use.
 *
 * Returns 403 { error, reason: 'job_limit', limit, currentCount, upgradeUrl }
 */
async function checkJobLimit(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return next(); // auth middleware handles unauthenticated

    const limits = await getPlanLimits(userId);
    req.planLimits = limits;

    // null = unlimited
    if (limits.activeJobs === null) return next();

    const count = await Job.countDocuments({
      client: userId,
      status: { $in: ['open', 'in_progress'] },
    });

    if (count >= limits.activeJobs) {
      return res.status(403).json({
        error:        `You've reached your limit of ${limits.activeJobs} active job post${limits.activeJobs === 1 ? '' : 's'}.`,
        reason:       'job_limit',
        limit:        limits.activeJobs,
        currentCount: count,
        upgradeUrl:   '/pricing',
      });
    }

    next();
  } catch (err) {
    console.error('checkJobLimit error:', err.message);
    next(); // fail open — don't block on billing error
  }
}

/**
 * Middleware: prevent service creation if user is at their plan's activeServices limit.
 *
 * Returns 403 { error, reason: 'service_limit', limit, currentCount, upgradeUrl }
 */
async function checkServiceLimit(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return next();

    const limits = await getPlanLimits(userId);
    req.planLimits = limits;

    if (limits.activeServices === null) return next();

    const count = await Service.countDocuments({
      freelancer: userId,
      isActive:   true,
    });

    if (count >= limits.activeServices) {
      return res.status(403).json({
        error:        `You've reached your limit of ${limits.activeServices} active service listing${limits.activeServices === 1 ? '' : 's'}.`,
        reason:       'service_limit',
        limit:        limits.activeServices,
        currentCount: count,
        upgradeUrl:   '/pricing',
      });
    }

    next();
  } catch (err) {
    console.error('checkServiceLimit error:', err.message);
    next();
  }
}

/**
 * Middleware factory: gate a route by a feature slug.
 * Delegates to entitlementEngine for full priority chain:
 *   individual grant → group grant → plan features → free baseline
 *
 * Usage: router.get('/some-route', requireFeature('booking_calendar'), handler)
 */
function requireFeature(feature) {
  // Lazy-require to avoid circular dependency at startup
  const { requireFeature: engineRequireFeature } = require('../services/entitlementEngine');
  return engineRequireFeature(feature);
}

module.exports = { checkJobLimit, checkServiceLimit, requireFeature, getPlanLimits, getAnalyticsLevel };
