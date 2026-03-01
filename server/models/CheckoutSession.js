const mongoose = require('mongoose');

/**
 * CheckoutSession — tracks Stripe Checkout sessions server-side.
 * Enables state queries (open/complete/expired) and server-side expiry.
 * Idempotency: fulfilled flag prevents double-processing on webhook replay.
 */
const checkoutSessionSchema = new mongoose.Schema({
  stripeSessionId: { type: String, required: true, unique: true, index: true },
  user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['subscription', 'wallet', 'payment'],
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'complete', 'expired'],
    default: 'open',
    index: true,
  },
  amountTotal:   { type: Number, default: null },   // cents
  currency:      { type: String, default: 'usd' },
  metadata:      { type: mongoose.Schema.Types.Mixed, default: {} },
  // Fulfillment guard — set to true by webhook handler; prevents double-credit
  fulfilled:     { type: Boolean, default: false, index: true },
  fulfilledAt:   { type: Date, default: null },
  expiresAt:     { type: Date, default: null },
  stripeCustomerId: { type: String, default: null },
}, {
  timestamps: true,
});

// Auto-expire TTL: Stripe sessions expire after 24h; clean up after 30 days
checkoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('CheckoutSession', checkoutSessionSchema);
