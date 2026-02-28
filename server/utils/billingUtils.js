/**
 * Billing utility helpers.
 * Keep lightweight — no circular deps.
 */
const Plan             = require('../models/Plan');
const UserSubscription = require('../models/UserSubscription');
const BillingAuditLog  = require('../models/BillingAuditLog');

/**
 * Assign a default (free) plan subscription to a newly registered user.
 * Safe to call multiple times — skips if subscription already exists.
 *
 * @param {string} userId
 * @param {string} audience  'freelancer' | 'client'
 */
async function assignDefaultPlan(userId, audience) {
  try {
    const existing = await UserSubscription.findOne({ user: userId });
    if (existing) return existing;

    const plan = await Plan.findOne({ audience, isDefault: true, active: true });
    if (!plan) {
      console.warn(`⚠️  No default plan found for audience: ${audience}`);
      return null;
    }

    const sub = await UserSubscription.create({
      user:   userId,
      plan:   plan._id,
      status: 'active',
      source: 'default',
    });

    await BillingAuditLog.create({
      user:   userId,
      action: 'plan_assigned',
      before: null,
      after:  { planSlug: plan.slug, planName: plan.name },
      note:   'Default plan assigned on registration',
    });

    return sub;
  } catch (err) {
    // Non-fatal — fee engine has fallback rates
    console.error('assignDefaultPlan error:', err.message);
    return null;
  }
}

/**
 * Get a user's current active subscription with plan populated.
 * Returns null if none found.
 */
async function getUserSubscription(userId) {
  try {
    return await UserSubscription
      .findOne({ user: userId, status: 'active' })
      .populate('plan')
      .lean();
  } catch {
    return null;
  }
}

/**
 * Log a billing action to the audit trail.
 */
async function logBillingAction({ userId, action, before, after, adminId, note, metadata }) {
  try {
    await BillingAuditLog.create({ user: userId, action, before, after, adminId, note, metadata });
  } catch (err) {
    console.error('logBillingAction error:', err.message);
  }
}

module.exports = { assignDefaultPlan, getUserSubscription, logBillingAction };
