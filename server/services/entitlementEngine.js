/**
 * Fetchwork Entitlement Engine
 *
 * Single source of truth for "can this user access this feature?"
 *
 * Priority chain (highest wins):
 *   1. Individual FeatureGrant  — admin override per user (enable OR disable)
 *   2. FeatureGroup membership  — cohort-level grant from any active group
 *   3. Plan features array      — DB-driven plan config
 *   4. FREE_TIER_FEATURES       — hardcoded baseline (always available)
 *
 * Fail-open: billing/DB errors never block core user actions.
 *
 * Reference: reference/MONETIZATION.md
 */

const { getUserSubscription } = require('../utils/billingUtils');

// ── Feature catalogue ─────────────────────────────────────────────────────────
// All known feature slugs. Used for validation + documentation.
const FEATURES = {
  // Freelancer — service creation
  RECURRING_SERVICES:   'recurring_services',    // create recurring service offerings
  BUNDLE_CREATION:      'bundle_creation',        // add prepaid session bundles to services
  BUNDLE_EXPIRATION:    'bundle_expiration',      // set expiry on bundles (Pro only)
  BOOKING_CALENDAR:     'booking_calendar',       // scheduling/availability calendar
  INTAKE_FORMS:         'intake_forms',           // intake forms on service listings
  DEPOSITS:             'deposits',               // require deposits on services
  TRAVEL_FEES:          'travel_fees',            // add travel fee to local services
  REPEAT_CLIENT_TOOLS:  'repeat_client_tools',    // repeat-client management tools
  CAPACITY_CONTROLS:    'capacity_controls',      // max clients per day/week
  FASTER_PAYOUT:        'faster_payout',          // faster payout tier
  ADVANCED_ANALYTICS:   'advanced_analytics',     // full analytics suite
  CSV_EXPORT:           'csv_export',             // data export

  // Client — hiring tools
  SAVED_PROVIDERS:      'saved_providers',        // saved freelancer lists
  JOB_TEMPLATES:        'job_templates',          // reusable job post templates
  PROPOSAL_COMPARISON:  'proposal_comparison',    // side-by-side proposal view
  SPEND_DASHBOARD:      'spend_dashboard',        // spend tracking dashboard
  TEAM_ACCOUNTS:        'team_accounts',          // multiple logins per org

  // Admin-only flags (can also be used to restrict features)
  BETA_ACCESS:          'beta_access',            // early feature access
  UNLIMITED_SERVICES:   'unlimited_services',     // bypass service count limit
  UNLIMITED_JOBS:       'unlimited_jobs',         // bypass job count limit
};

// Features available to ALL users regardless of plan
const FREE_TIER_FEATURES = new Set([
  'repeat_client_tools',   // basic repeat client (full repeat client tools = Plus/Pro)
  'faster_payout',         // basic payout (faster = Plus, priority = Pro)
]);

// Default features per plan name (fallback when DB plan has no features array)
const PLAN_FEATURE_DEFAULTS = {
  free: [],
  plus: [
    'recurring_services', 'bundle_creation', 'booking_calendar',
    'intake_forms', 'repeat_client_tools', 'capacity_controls', 'faster_payout',
    'csv_export', 'saved_providers', 'job_templates', 'proposal_comparison',
  ],
  pro: [
    'recurring_services', 'bundle_creation', 'bundle_expiration', 'booking_calendar',
    'intake_forms', 'deposits', 'travel_fees', 'repeat_client_tools', 'capacity_controls',
    'faster_payout', 'advanced_analytics', 'csv_export', 'unlimited_services',
    'saved_providers', 'job_templates', 'proposal_comparison', 'spend_dashboard',
  ],
  business: [  // client business plan
    'saved_providers', 'job_templates', 'proposal_comparison',
    'spend_dashboard', 'team_accounts', 'csv_export', 'advanced_analytics',
  ],
};

// ── Core: hasFeature ──────────────────────────────────────────────────────────

/**
 * Check if a user has access to a feature.
 *
 * @param {string|ObjectId} userId
 * @param {string}          feature  — feature slug from FEATURES
 * @returns {Promise<boolean>}
 */
async function hasFeature(userId, feature) {
  if (!userId || !feature) return false;

  try {
    // Admin bypass — admins have access to all features
    const User = require('../models/User');
    const user = await User.findById(userId).select('role isAdmin isAdminPromoted').lean();
    if (user?.role === 'admin' || user?.isAdmin || user?.isAdminPromoted) return true;

    const FeatureGrant = require('../models/FeatureGrant');
    const FeatureGroup = require('../models/FeatureGroup');

    const now = new Date();

    // ── 1. Individual override ─────────────────────────────────────
    const grant = await FeatureGrant.findOne({
      user:    userId,
      feature,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();

    if (grant) return grant.enabled; // explicit enable OR revoke

    // ── 2. Group membership ────────────────────────────────────────
    const group = await FeatureGroup.findOne({
      members:  userId,
      features: feature,
      active:   true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();

    if (group) return true;

    // ── 3. Plan features ───────────────────────────────────────────
    const sub = await getUserSubscription(userId);
    if (sub?.plan?.features?.length) {
      if (sub.plan.features.includes(feature)) return true;
    } else {
      // Fall back to hardcoded plan defaults
      const planName = sub?.plan?.name?.toLowerCase() || 'free';
      const defaults = PLAN_FEATURE_DEFAULTS[planName] ?? [];
      if (defaults.includes(feature)) return true;
    }

    // ── 4. Free tier baseline ──────────────────────────────────────
    return FREE_TIER_FEATURES.has(feature);
  } catch (err) {
    console.warn(`[entitlementEngine] hasFeature(${feature}) error — failing open:`, err.message);
    return true; // fail open: billing errors never block core actions
  }
}

/**
 * Get all features a user has access to.
 * Useful for frontend to conditionally show UI elements.
 */
async function getUserFeatures(userId) {
  const results = {};
  await Promise.all(
    Object.values(FEATURES).map(async feature => {
      results[feature] = await hasFeature(userId, feature);
    })
  );
  return results;
}

// ── requireFeature middleware (replaces entitlements.js version) ──────────────

/**
 * Express middleware factory: gate a route by a feature slug.
 *
 * Usage: router.post('/my-route', requireFeature('recurring_services'), handler)
 *
 * Returns 403 { error, reason: 'feature_gated', feature, upgradeUrl }
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?._id;
      if (!userId) return next(); // auth middleware handles unauthenticated

      const allowed = await hasFeature(userId, feature);
      if (!allowed) {
        return res.status(403).json({
          error:      'This feature requires a higher plan.',
          reason:     'feature_gated',
          feature,
          upgradeUrl: '/pricing',
        });
      }

      next();
    } catch {
      next(); // fail open
    }
  };
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

/**
 * Grant or revoke a feature for a single user.
 * Upserts — safe to call multiple times.
 */
async function setUserFeature({ userId, feature, enabled, grantedBy, reason, expiresAt }) {
  const FeatureGrant = require('../models/FeatureGrant');
  return FeatureGrant.findOneAndUpdate(
    { user: userId, feature },
    { $set: { enabled, grantedBy, reason: reason || '', expiresAt: expiresAt || null, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
}

/**
 * Remove an individual feature grant (revert to plan default).
 */
async function removeUserFeature(userId, feature) {
  const FeatureGrant = require('../models/FeatureGrant');
  return FeatureGrant.deleteOne({ user: userId, feature });
}

/**
 * Get all active feature grants for a user (for admin detail view).
 */
async function getUserGrants(userId) {
  const FeatureGrant = require('../models/FeatureGrant');
  const now = new Date();
  return FeatureGrant.find({
    user: userId,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).populate('grantedBy', 'firstName lastName email').lean();
}

module.exports = {
  hasFeature,
  getUserFeatures,
  requireFeature,
  setUserFeature,
  removeUserFeature,
  getUserGrants,
  FEATURES,
  PLAN_FEATURE_DEFAULTS,
};
