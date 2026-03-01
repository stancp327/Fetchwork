const mongoose = require('mongoose');

/**
 * ServiceSubscription — tracks a client's recurring subscription to a freelancer service.
 *
 * Lifecycle:
 *   pending   → client initiated, awaiting first payment confirmation
 *   active    → Stripe subscription live, charging on schedule
 *   past_due  → payment failed, retrying
 *   cancelled → client or freelancer cancelled
 *   completed → freelancer marked the engagement done (optional graceful end)
 */
const serviceSubscriptionSchema = new mongoose.Schema({
  service:    { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },

  // Pricing snapshot at time of subscribe (so plan changes don't affect live subs)
  tier:         { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  amountPerCycle: { type: Number, required: true },          // USD, what client pays each cycle
  billingCycle: { type: String, enum: ['per_session', 'weekly', 'monthly'], required: true },

  // Stripe IDs
  stripeSubscriptionId: { type: String, index: true },
  stripeProductId:      { type: String },
  stripePriceId:        { type: String },
  stripeCustomerId:     { type: String },

  status: {
    type: String,
    enum: ['pending', 'active', 'past_due', 'cancelled', 'completed'],
    default: 'pending',
    index: true,
  },

  // Fee snapshot (locked at subscribe time so plan changes don't retroactively apply)
  platformFeeRate:   { type: Number },   // decimal e.g. 0.10
  platformFeeAmount: { type: Number },   // dollars per cycle (Fetchwork keeps this)
  freelancerPayout:  { type: Number },   // dollars per cycle (freelancer receives)

  // Billing history (lightweight — full detail in Stripe dashboard)
  invoices: [{
    stripeInvoiceId: String,
    amount:          Number,     // client paid
    platformFee:     Number,     // Fetchwork kept
    freelancerPaid:  Number,     // transferred to freelancer
    paidAt:          Date,
    status:          { type: String, enum: ['paid', 'failed', 'refunded'] },
    stripeTransferId: String,
  }],

  cancelledAt: { type: Date },
  cancelReason: { type: String },
  nextBillingDate: { type: Date },
  startedAt: { type: Date },
}, {
  timestamps: true,
});

// Index for fast lookup of a specific client+service combination
serviceSubscriptionSchema.index({ service: 1, client: 1 });
serviceSubscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

module.exports = mongoose.model('ServiceSubscription', serviceSubscriptionSchema);
