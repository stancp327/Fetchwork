const mongoose = require('mongoose');

/**
 * BundlePurchase — tracks a client's prepaid session bundle purchase.
 *
 * Flow:
 *   1. Client pays full bundle price upfront → PaymentIntent created
 *   2. Webhook payment_intent.succeeded → status: active, funds sit in platform balance
 *   3. Freelancer marks sessions complete one by one
 *   4. Each completion → partial Transfer to freelancer's Connect account
 *   5. All sessions done → status: completed
 *
 * Fee model:
 *   - Platform fee calculated on full bundle price at purchase
 *   - perSessionPayout = (baseAmount - freelancerFee) / sessionsTotal
 *   - Fetchwork keeps clientFee + freelancerFee from the bundle total
 */
const sessionSchema = new mongoose.Schema({
  status:          { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  scheduledFor:    { type: Date },
  completedAt:     { type: Date },
  cancelledAt:     { type: Date },
  notes:           { type: String, maxlength: 500 },   // freelancer notes on session
  freelancerPaid:  { type: Number, default: 0 },        // USD transferred for this session
  stripeTransferId: { type: String },
}, { _id: true });

const bundlePurchaseSchema = new mongoose.Schema({
  service:    { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },

  // Bundle snapshot (locked at purchase time)
  bundleName:    { type: String, required: true },     // e.g. "3 sessions"
  sessionsTotal: { type: Number, required: true },     // total sessions purchased

  // Pricing snapshot (locked at purchase time)
  baseAmount:       { type: Number, required: true },  // freelancer's listed bundle price
  clientFee:        { type: Number, required: true },  // platform fee added for client
  freelancerFee:    { type: Number, required: true },  // platform fee deducted from freelancer
  totalPlatformFee: { type: Number, required: true },  // clientFee + freelancerFee
  clientCharges:    { type: Number, required: true },  // what client actually pays
  freelancerTotal:  { type: Number, required: true },  // total freelancer earns across all sessions
  perSessionPayout: { type: Number, required: true },  // freelancerTotal / sessionsTotal

  // Stripe
  stripePaymentIntentId: { type: String, index: true },

  status: {
    type:    String,
    enum:    ['pending', 'active', 'completed', 'refunded', 'expired', 'cancelled'],
    default: 'pending',
    index:   true,
  },

  // Individual session tracking
  sessions: [sessionSchema],

  // Computed counters (kept in sync on save)
  sessionsCompleted: { type: Number, default: 0 },
  sessionsRemaining: { type: Number, default: 0 },

  // Optional expiry (set by freelancer on the bundle definition)
  expiresAt: { type: Date },

  activatedAt:  { type: Date },
  completedAt:  { type: Date },
  refundedAt:   { type: Date },
}, {
  timestamps: true,
});

// Index for fast client + service lookups
bundlePurchaseSchema.index({ service: 1, client: 1 });
bundlePurchaseSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });

// Keep counters in sync before every save
bundlePurchaseSchema.pre('save', function (next) {
  if (this.sessions) {
    this.sessionsCompleted = this.sessions.filter(s => s.status === 'completed').length;
    this.sessionsRemaining = this.sessions.filter(s => s.status === 'pending').length;
    if (this.sessionsCompleted === this.sessionsTotal && this.sessionsTotal > 0) {
      this.status      = 'completed';
      this.completedAt = this.completedAt || new Date();
    }
  }
  next();
});

module.exports = mongoose.model('BundlePurchase', bundlePurchaseSchema);
