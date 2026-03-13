const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  signedAt:  { type: Date, default: Date.now },
  ipAddress: String,
  userAgent: String,
  name:      { type: String, required: true }, // typed signature
});

const contractSchema = new mongoose.Schema({
  // Parties
  client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job:        { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },

  // Template
  template: {
    type: String,
    enum: ['standard_service', 'nda', 'non_compete', 'custom'],
    default: 'standard_service'
  },
  title:   { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true }, // Full contract text (HTML/markdown)

  // Custom fields filled in by the creator
  customFields: [{
    label: String,
    value: String,
  }],

  // Terms
  terms: {
    scope:         String,   // Description of work
    compensation:  Number,   // Payment amount
    currency:      { type: String, default: 'USD' },
    startDate:     Date,
    endDate:       Date,
    paymentTerms:  String,   // e.g. "Net 30", "Upon completion"
    ndaDuration:   String,   // e.g. "2 years" for NDAs
    jurisdiction:  String,   // e.g. "State of California"
    terminationClause: String,
    // Concern-based AI generation
    concerns:      String,   // User's concerns about the job
    checklist:     [String], // Selected checklist items (e.g. IP, NDA, cancellation)
    tools:         String,   // Tools/equipment notes (bring own / provided)
  },

  // AI generation metadata
  aiGenerated: { type: Boolean, default: false },

  // Signatures
  signatures: [signatureSchema],

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'completed', 'cancelled', 'expired'],
    default: 'draft'
  },

  // Who created it
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Document attachment (if uploaded)
  documentUrl: String,
  documentFilename: String,

  // Metadata
  sentAt:      Date,
  expiresAt:   Date,
  cancelledAt: Date,
  cancelReason: String,
}, {
  timestamps: true,
});

contractSchema.index({ client: 1, status: 1 });
contractSchema.index({ freelancer: 1, status: 1 });
contractSchema.index({ job: 1 });

// Virtual: is fully signed?
contractSchema.virtual('isFullySigned').get(function() {
  const clientSigned = this.signatures.some(s => s.user.toString() === this.client.toString());
  const freelancerSigned = this.signatures.some(s => s.user.toString() === this.freelancer.toString());
  return clientSigned && freelancerSigned;
});

contractSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Contract', contractSchema);
