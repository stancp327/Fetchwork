const mongoose = require('mongoose');

/**
 * FeatureGroup — a named cohort of users with shared feature access.
 *
 * Use cases:
 *   - "Beta testers" group → gets early feature access
 *   - "February launch cohort" → gets Pro features for 60 days
 *   - "VIP freelancers" → permanent reduced fees + full feature set
 *   - "Suspended-but-not-banned" → restricted feature set
 *
 * Members are explicit user IDs. For large cohorts, filter-based
 * assignment (e.g. "all users joined before X") is a future enhancement.
 */
const featureGroupSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  features:    [{ type: String }],  // feature slugs granted to all members
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  active:      { type: Boolean, default: true },
  expiresAt:   { type: Date, default: null },  // null = permanent
}, {
  timestamps: true,
});

featureGroupSchema.index({ members: 1 });

module.exports = mongoose.model('FeatureGroup', featureGroupSchema);
