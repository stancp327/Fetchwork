/**
 * BillingAuditLog — immutable record of every billing action.
 * Used for CS support, dispute resolution, compliance.
 */
const mongoose = require('mongoose');

const billingAuditLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:    {
    type: String,
    enum: [
      'plan_assigned',        // default plan set on signup
      'plan_upgraded',        // user upgraded via Stripe or admin
      'plan_downgraded',      // user downgraded or subscription lapsed
      'plan_granted',         // admin manually granted a plan
      'plan_revoked',         // admin revoked a manual grant
      'fee_override_set',     // admin set custom fee rate
      'fee_override_removed', // admin removed custom fee rate
      'credit_added',         // admin added billing credit
      'credit_used',          // credit applied to a transaction
      'credit_expired',       // credit expired without use
      'promo_applied',        // promo rule matched and applied
      'subscription_created', // Stripe subscription created
      'subscription_updated', // Stripe subscription updated
      'subscription_cancelled',// Stripe subscription cancelled
      'payment_failed',       // Stripe invoice payment failed
      'grandfathered',        // user grandfathered on old plan pricing
    ],
    required: true,
  },
  before:    { type: mongoose.Schema.Types.Mixed, default: null }, // state before change
  after:     { type: mongoose.Schema.Types.Mixed, default: null }, // state after change
  adminId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note:      { type: String, default: '' },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  timestamps: true,
});

// Immutable — never update or delete audit logs
billingAuditLogSchema.index({ user: 1, createdAt: -1 });
billingAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('BillingAuditLog', billingAuditLogSchema);
