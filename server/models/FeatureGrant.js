const mongoose = require('mongoose');

/**
 * FeatureGrant — admin-controlled feature override for a single user.
 *
 * Priority chain (highest to lowest):
 *   1. Individual FeatureGrant (this model)  ← admin sets per user
 *   2. FeatureGroup membership               ← admin sets per cohort
 *   3. Plan features array                   ← DB-driven plan config
 *   4. Hardcoded fallback (always free tier)
 *
 * Use cases:
 *   - Grant a free user access to recurring services for 30 days
 *   - Revoke a Pro feature from a specific user (abuse, dispute)
 *   - Give a beta tester early access to a new feature
 *   - CS goodwill: "here's 60 days of Pro features on us"
 */
const featureGrantSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  feature:    { type: String, required: true, index: true },   // e.g. 'recurring_services'
  enabled:    { type: Boolean, required: true, default: true }, // false = explicit revoke
  grantedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // admin
  reason:     { type: String, maxlength: 500 },
  expiresAt:  { type: Date, default: null, index: true },       // null = permanent
}, {
  timestamps: true,
});

// One grant per user+feature (upsert on conflict)
featureGrantSchema.index({ user: 1, feature: 1 }, { unique: true });

module.exports = mongoose.model('FeatureGrant', featureGrantSchema);
