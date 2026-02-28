/**
 * PromoRule — time-bound fee or price override applied to a cohort.
 * Examples: new user promo, seasonal discount, test market, retention offer.
 */
const mongoose = require('mongoose');

const promoRuleSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },

  // Who it applies to
  appliesTo: {
    type: String,
    enum: ['new_users', 'existing_users', 'all', 'specific_users'],
    default: 'new_users',
  },
  specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // for 'specific_users'
  audience:      { type: String, enum: ['freelancer', 'client', 'both'], default: 'both' },

  // Cohort filter (signup date range for 'new_users')
  cohortSignupStart: { type: Date, default: null },
  cohortSignupEnd:   { type: Date, default: null },

  // Promo window
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },

  // What it does — fee rate overrides (null = no override for that field)
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

  // Subscription discount (% off plan price, e.g. 0.20 = 20% off)
  subscriptionDiscount: { type: Number, default: null },

  // Stripe Coupon ID if applicable
  stripeCouponId: { type: String, default: null },

  active:    { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usageCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

promoRuleSchema.index({ active: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('PromoRule', promoRuleSchema);
