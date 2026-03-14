const mongoose = require('mongoose');
const crypto   = require('crypto');

function generateCode() {
  // 4-4-4 format: e.g. FETCH-A3X9-K7QZ
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `FW-${seg()}-${seg()}`;
}

const giftCardSchema = new mongoose.Schema({
  code:          { type: String, unique: true, uppercase: true, trim: true },
  amount:        { type: Number, required: true, min: 5 },
  remaining:     { type: Number },        // starts = amount, decrements on partial use (reserved for future)
  status:        { type: String, enum: ['pending_payment', 'active', 'redeemed', 'expired', 'voided'], default: 'pending_payment' },
  purchasedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  redeemedAt:    { type: Date, default: null },
  expiresAt:     { type: Date, default: null },   // null = no expiry
  message:       { type: String, maxlength: 300, default: '' },
  recipientEmail:{ type: String, default: '' },
  stripePaymentIntentId: { type: String, default: null },
}, { timestamps: true });

giftCardSchema.pre('save', function(next) {
  if (!this.code) this.code = generateCode();
  if (this.remaining == null) this.remaining = this.amount;
  next();
});

giftCardSchema.index({ code: 1 });
giftCardSchema.index({ purchasedBy: 1, createdAt: -1 });
giftCardSchema.index({ status: 1 });

module.exports = mongoose.model('GiftCard', giftCardSchema);
