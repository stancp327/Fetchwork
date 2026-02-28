/**
 * UserSubscription — tracks a user's current plan.
 * Separate from Plan so grandfathering is built-in:
 * plan price changes never cascade to existing subscriptions.
 * See ADR-003.
 */
const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:   { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },

  // Stripe subscription details (null for free plans)
  stripeSubscriptionId:  { type: String, default: null },
  stripeCustomerId:      { type: String, default: null }, // mirrors User.stripeCustomerId
  stripePriceId:         { type: String, default: null },

  // Billing cycle
  currentPeriodStart:  { type: Date, default: null },
  currentPeriodEnd:    { type: Date, default: null },
  cancelAtPeriodEnd:   { type: Boolean, default: false },

  // Status
  status: {
    type: String,
    enum: ['active', 'trialing', 'past_due', 'cancelled', 'incomplete', 'paused'],
    default: 'active',
  },

  // Custom / override pricing (admin grants)
  customPrice:    { type: Number, default: null },  // null = use plan.price
  grantedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin who granted
  grantReason:    { type: String, default: null },
  grantExpiresAt: { type: Date, default: null },     // null = no expiry

  // Custom fee rate overrides (null = use plan defaults)
  feeRateOverrides: {
    remoteClient:     { type: Number, default: null },
    remoteFreelancer: { type: Number, default: null },
    localClient: {
      upTo50:   { type: Number, default: null },
      upTo150:  { type: Number, default: null },
      upTo400:  { type: Number, default: null },
      above400: { type: Number, default: null },
    },
  },

  // Grandfathering
  grandfathered:         { type: Boolean, default: false },
  grandfatheredPrice:    { type: Number, default: null },
  grandfatheredAt:       { type: Date, default: null },

  // Source
  source: {
    type: String,
    enum: ['stripe', 'admin_grant', 'promo', 'default'],
    default: 'default',
  },

  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

userSubscriptionSchema.index({ user: 1 }, { unique: true });
userSubscriptionSchema.index({ stripeSubscriptionId: 1 });
userSubscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
