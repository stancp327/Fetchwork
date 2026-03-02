const mongoose = require('mongoose');

const backgroundCheckSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Provider info
  provider: { type: String, default: 'internal', enum: ['internal', 'checkr'] },
  externalId: String, // Checkr candidate/report ID when integrated

  // Check type
  type: {
    type: String,
    enum: ['basic', 'standard', 'enhanced'],
    default: 'basic',
    // basic: identity + sex offender ($9.99)
    // standard: + criminal + county ($19.99)
    // enhanced: + federal + credit + education ($29.99)
  },

  // Payment
  amount:          { type: Number, required: true },
  paymentIntentId: String,
  paid:            { type: Boolean, default: false },
  paidAt:          Date,

  // Status
  status: {
    type: String,
    enum: ['pending_payment', 'pending_consent', 'processing', 'completed', 'failed', 'expired'],
    default: 'pending_payment'
  },

  // Consent
  consentGiven:    { type: Boolean, default: false },
  consentAt:       Date,
  consentIp:       String,

  // Results (generic — not tied to Checkr schema)
  results: {
    overall:   { type: String, enum: ['clear', 'consider', 'alert', null], default: null },
    checks: [{
      name:   String,    // e.g. "Identity Verification", "Criminal Search"
      status: { type: String, enum: ['clear', 'consider', 'alert', 'pending'] },
      notes:  String,
    }],
    completedAt: Date,
  },

  // Validity
  validUntil: Date, // 1 year from completion
  
  // Admin review
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: String,
}, {
  timestamps: true,
});

backgroundCheckSchema.index({ user: 1, status: 1 });
backgroundCheckSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BackgroundCheck', backgroundCheckSchema);
