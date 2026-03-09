/**
 * BillingCredit — goodwill gestures, refund credits, promotional credits.
 * Applied against next invoice or job fee.
 */
const mongoose = require('mongoose');

const billingCreditSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  amount:      { type: Number, required: true },   // USD
  remaining:   { type: Number },                   // starts = amount, decrements as used
  reason:      { type: String, required: true },
  appliedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin
  expiresAt:   { type: Date, default: null },       // null = no expiry
  usedAt:      { type: Date, default: null },
  usedOn:      { type: String, default: null },     // jobId, subscriptionId, etc.
  status:      { type: String, enum: ['active', 'used', 'expired', 'voided'], default: 'active' },
}, {
  timestamps: true,
});

billingCreditSchema.pre('save', function(next) {
  if (this.isNew) this.remaining = this.amount;
  next();
});

billingCreditSchema.index({ user: 1, status: 1 });
billingCreditSchema.index({ team: 1, createdAt: -1 });
billingCreditSchema.index({ user: 1, usedOn: 1, usedAt: -1 });

module.exports = mongoose.model('BillingCredit', billingCreditSchema);
