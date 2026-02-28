/**
 * Plan — a billing tier definition.
 * Plans are DB data, never hardcoded. Changing a price = DB update, no deploy.
 * See ADR-003.
 */
const mongoose = require('mongoose');

// Local flat-fee tiers by booking amount bracket
const localFeeSchema = new mongoose.Schema({
  upTo50:   { type: Number, default: 4 },   // bookings < $50
  upTo150:  { type: Number, default: 6 },   // $50–$149.99
  upTo400:  { type: Number, default: 10 },  // $150–$399.99
  above400: { type: Number, default: 15 },  // $400+
}, { _id: false });

const planSchema = new mongoose.Schema({
  // Identity
  slug:        { type: String, required: true, unique: true }, // 'freelancer_free', 'client_plus', etc.
  name:        { type: String, required: true },               // 'Freelancer Free'
  audience:    { type: String, enum: ['freelancer', 'client'], required: true },
  tier:        { type: String, enum: ['free', 'plus', 'pro'], required: true },

  // Pricing
  price:       { type: Number, default: 0 },      // monthly price in USD
  interval:    { type: String, enum: ['month', 'year', 'one_time', 'free'], default: 'month' },
  stripePriceId:   { type: String, default: null },  // Stripe Price ID (null for free)
  stripeProductId: { type: String, default: null },  // Stripe Product ID

  // Fee rates
  feeRates: {
    // Remote fees (percentage, stored as decimal e.g. 0.10 = 10%)
    remoteClient:     { type: Number, default: 0.05 },
    remoteFreelancer: { type: Number, default: 0.10 },
    // Local client flat fees by bracket (freelancer always $0)
    localClient: { type: localFeeSchema, default: () => ({}) },
  },

  // Features (array of feature slugs this plan unlocks)
  features: [{ type: String }],

  // Limits (null = unlimited)
  limits: {
    activeJobs:      { type: Number, default: 3 },   // max active job posts
    activeServices:  { type: Number, default: 1 },   // max active service listings
    analyticsLevel:  { type: String, enum: ['basic', 'standard', 'full'], default: 'basic' },
  },

  // Status
  active:    { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }, // auto-assign to new users of this audience

  // Meta
  description: { type: String, default: '' },
  sortOrder:   { type: Number, default: 0 },    // display order on pricing page
}, {
  timestamps: true,
});

planSchema.index({ slug: 1 }, { unique: true });
planSchema.index({ audience: 1, tier: 1 });

module.exports = mongoose.model('Plan', planSchema);
