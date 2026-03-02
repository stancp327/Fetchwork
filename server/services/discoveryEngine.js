/**
 * Discovery Engine — matches boosted jobs/services to users based on interests,
 * location, and category preferences. Also handles frequency capping.
 *
 * Admin toggle: process.env.DISCOVERY_ALGORITHM_ENABLED ('true'/'false')
 * When OFF: boosts just sort higher in browse (no targeted notifications)
 * When ON: boosted items trigger personalized notifications to matching users
 */

const User = require('../models/User');
const Job = require('../models/Job');
const Service = require('../models/Service');
const Notification = require('../models/Notification');

// In-memory frequency cap (reset daily via cron or TTL)
// Key: `${userId}:${targetType}:${targetId}` → timestamp
const impressionCache = new Map();
const IMPRESSION_CAP = 1;         // max times a user sees the same boosted item per day
const IMPRESSION_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if algorithm is enabled (admin toggle)
 */
function isAlgorithmEnabled() {
  return process.env.DISCOVERY_ALGORITHM_ENABLED === 'true';
}

/**
 * Check frequency cap — has this user seen this item today?
 */
function hasReachedCap(userId, targetType, targetId) {
  const key = `${userId}:${targetType}:${targetId}`;
  const lastSeen = impressionCache.get(key);
  if (!lastSeen) return false;
  return (Date.now() - lastSeen) < IMPRESSION_WINDOW;
}

/**
 * Record an impression
 */
function recordImpression(userId, targetType, targetId) {
  const key = `${userId}:${targetType}:${targetId}`;
  impressionCache.set(key, Date.now());
}

/**
 * Clean up expired impressions (call periodically)
 */
function cleanImpressions() {
  const now = Date.now();
  for (const [key, ts] of impressionCache) {
    if (now - ts > IMPRESSION_WINDOW) impressionCache.delete(key);
  }
}

/**
 * Score how well a boosted item matches a user (0-100)
 */
function scoreMatch(user, item, itemType) {
  let score = 0;
  const userInterests = (user.interests || []).map(i => i.toLowerCase());
  const userLookingFor = (user.lookingFor || []).map(i => i.toLowerCase());
  const userCategories = user.preferences?.discovery?.categories || [];

  // Category match (strongest signal)
  const itemCategory = itemType === 'job' ? item.category : item.category;
  if (itemCategory) {
    if (userCategories.length === 0 || userCategories.includes(itemCategory)) {
      score += 40;
    } else {
      return 0; // User explicitly filtered this category out
    }
  }

  // Interest/skill match
  const itemText = (
    (item.title || '') + ' ' +
    (item.description || '') + ' ' +
    (item.category || '') + ' ' +
    (item.subcategory || '') + ' ' +
    ((item.tags || item.skills || []).join(' '))
  ).toLowerCase();

  const allUserTerms = [...userInterests, ...userLookingFor];
  const matchCount = allUserTerms.filter(term => itemText.includes(term)).length;
  if (allUserTerms.length > 0) {
    score += Math.min(30, (matchCount / allUserTerms.length) * 30);
  }

  // Location match (for local items)
  const itemLocation = itemType === 'job' ? item.locationType : item.classDetails?.locationType;
  if (itemLocation === 'in_person' || itemLocation === 'local') {
    // If user prefers local work
    if (user.preferencesExtended?.local) score += 15;
    // Location proximity would go here (needs geocoding — defer)
  } else if (itemLocation === 'online' || itemLocation === 'remote') {
    if (user.preferencesExtended?.remote) score += 15;
  } else {
    score += 10; // Neutral
  }

  // Recency bonus (newer boosts score slightly higher)
  if (item.boostExpiresAt) {
    const daysLeft = (new Date(item.boostExpiresAt) - Date.now()) / (1000 * 60 * 60 * 24);
    score += Math.min(15, daysLeft);
  }

  return Math.round(score);
}

/**
 * Find matching users for a boosted item and send notifications.
 * Called when a boost is activated (from webhook or credit use).
 */
async function notifyMatchingUsers(targetType, targetId) {
  if (!isAlgorithmEnabled()) return { sent: 0, reason: 'algorithm_disabled' };

  const item = targetType === 'job'
    ? await Job.findById(targetId).lean()
    : await Service.findById(targetId).lean();

  if (!item) return { sent: 0, reason: 'item_not_found' };

  // Find users with discovery enabled
  const filter = { 'preferences.discovery.enabled': true };

  // Filter by notification type preference
  if (targetType === 'job') {
    filter['preferences.discovery.notifyJobs'] = true;
  } else if (item.serviceType === 'class') {
    filter['preferences.discovery.notifyClasses'] = true;
  } else {
    filter['preferences.discovery.notifyServices'] = true;
  }

  const users = await User.find(filter)
    .select('interests lookingFor preferences preferencesExtended')
    .lean();

  let sent = 0;
  const ownerId = (targetType === 'job' ? item.client : item.freelancer)?.toString();

  for (const user of users) {
    // Don't notify the owner
    if (user._id.toString() === ownerId) continue;

    // Check blocked providers
    const blocked = (user.preferences?.discovery?.blockedProviders || []).map(id => id.toString());
    if (ownerId && blocked.includes(ownerId)) continue;

    // Frequency cap
    if (hasReachedCap(user._id.toString(), targetType, targetId)) continue;

    // Score match
    const score = scoreMatch(user, item, targetType);
    if (score < 25) continue; // Below threshold — skip

    // Check frequency preference
    const freq = user.preferences?.discovery?.frequency || 'daily';
    if (freq !== 'realtime') continue; // Batch daily/weekly separately (via cron)

    // Send notification
    try {
      await Notification.create({
        recipient: user._id,
        title: targetType === 'job' ? '💼 Job you might like' : item.serviceType === 'class' ? '📚 Class for you' : '⭐ Service recommendation',
        message: `"${item.title}" — matches your interests`,
        link: targetType === 'job' ? `/jobs/${targetId}` : `/services/${targetId}`,
        type: 'discovery',
      });
      recordImpression(user._id.toString(), targetType, targetId);
      sent++;
    } catch (err) {
      console.error('Discovery notification error:', err.message);
    }
  }

  return { sent, total: users.length };
}

/**
 * Get personalized feed for a user — reorder results with boosted items
 * scored by relevance. Enforces organic ratio (max 30% boosted).
 */
function personalizeResults(user, items, itemType) {
  if (!isAlgorithmEnabled() || !user) {
    // Algorithm off — just sort boosted first (existing behavior)
    return items.sort((a, b) => {
      const aBoost = a.isBoosted && a.boostExpiresAt && new Date(a.boostExpiresAt) > new Date() ? 1 : 0;
      const bBoost = b.isBoosted && b.boostExpiresAt && new Date(b.boostExpiresAt) > new Date() ? 1 : 0;
      return bBoost - aBoost;
    });
  }

  // Score each item
  const scored = items.map(item => {
    const isBoosted = item.isBoosted && item.boostExpiresAt && new Date(item.boostExpiresAt) > new Date();
    const matchScore = isBoosted ? scoreMatch(user, item, itemType) : 0;
    return { item, isBoosted, matchScore };
  });

  // Separate boosted and organic
  const boosted = scored.filter(s => s.isBoosted).sort((a, b) => b.matchScore - a.matchScore);
  const organic = scored.filter(s => !s.isBoosted);

  // Enforce organic ratio: max 30% boosted in results
  const maxBoosted = Math.ceil(items.length * 0.3);
  const selectedBoosted = boosted.slice(0, maxBoosted);

  // Interleave: boosted items at positions 0, 3, 7, 12... (natural spacing)
  const result = [];
  let boostIdx = 0, organicIdx = 0;
  const boostPositions = new Set([0, 3, 7, 12, 18, 25]);

  for (let i = 0; i < items.length; i++) {
    if (boostPositions.has(i) && boostIdx < selectedBoosted.length) {
      result.push(selectedBoosted[boostIdx++].item);
    } else if (organicIdx < organic.length) {
      result.push(organic[organicIdx++].item);
    } else if (boostIdx < selectedBoosted.length) {
      result.push(selectedBoosted[boostIdx++].item);
    }
  }

  // Append any remaining
  while (boostIdx < selectedBoosted.length) result.push(selectedBoosted[boostIdx++].item);
  while (organicIdx < organic.length) result.push(organic[organicIdx++].item);

  return result;
}

// Clean impressions every hour
setInterval(cleanImpressions, 60 * 60 * 1000);

module.exports = {
  isAlgorithmEnabled,
  notifyMatchingUsers,
  personalizeResults,
  scoreMatch,
  recordImpression,
  hasReachedCap,
  cleanImpressions,
};
