const mongoose = require('mongoose');

// ── Dispute Message Schema ──────────────────────────────────────
const disputeMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin'],
    required: true
  },
  // Who can see this message
  visibility: {
    type: String,
    enum: ['all', 'client_only', 'freelancer_only', 'admin_only'],
    default: 'all'
  },
  message: {
    type: String,
    required: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  attachments: [{
    filename: String,
    originalUrl: String,      // Private — admin only, logged access
    watermarkedUrl: String,   // Served to all parties
    mimeType: String,
    size: Number,
    watermarked: { type: Boolean, default: false },
    watermarkFailed: { type: Boolean, default: false }
  }],
  isInternal: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// ── Evidence File Schema ────────────────────────────────────────
const evidenceSchema = new mongoose.Schema({
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploaderRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin'],
    required: true
  },
  filename: { type: String, required: true },
  originalUrl: String,         // Private, secured
  watermarkedUrl: String,      // Served to parties
  mimeType: String,
  size: Number,
  watermarked: { type: Boolean, default: false },
  watermarkFailed: { type: Boolean, default: false },
  isFinalDeliverable: { type: Boolean, default: false },
  description: { type: String, maxlength: 500 }
}, { timestamps: true });

// ── Financial Action Schema ─────────────────────────────────────
const financialActionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['hold', 'release', 'refund', 'split', 'fee', 'remove_hold'],
    required: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Amounts
  amountToFreelancer: { type: Number, default: 0 },
  amountToClient: { type: Number, default: 0 },
  adminFee: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  // Stripe references
  stripePaymentIntentId: String,
  stripeRefundId: String,
  stripeTransferId: String,
  idempotencyKey: { type: String, unique: true, sparse: true },
  // Status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  failureReason: String,
  notes: { type: String, maxlength: 1000 }
}, { timestamps: true });

// ── Admin Note Schema ───────────────────────────────────────────
const adminNoteSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Note cannot exceed 2000 characters']
  }
}, { timestamps: true });

// ── Main Dispute Schema ─────────────────────────────────────────
const disputeSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    default: null
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  freelancer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: [
      'non_delivery',
      'quality_issues',
      'missed_deadline',
      'payment_fraud',
      'scope_creep',
      'abusive_communication',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  // ── State Machine ───────────────────────────────────────────
  status: {
    type: String,
    enum: [
      'opened',           // User filed dispute
      'needs_info',       // Admin requesting more info
      'under_review',     // Admin actively reviewing
      'escalated',        // Higher-level review
      'proposed_resolution', // Admin proposed outcome
      'resolved',         // Financial actions executed
      'closed'            // Finalized + archived
    ],
    default: 'opened'
  },

  // ── Payment Control ─────────────────────────────────────────
  payoutHold: {
    type: Boolean,
    default: true  // Auto-hold on dispute creation
  },
  escrowAmount: {
    type: Number,
    default: 0
  },

  // ── Resolution ──────────────────────────────────────────────
  resolution: {
    type: {
      type: String,
      enum: ['release_to_freelancer', 'refund_to_client', 'split', 'no_action', 'mutual_agreement'],
      default: null
    },
    amounts: {
      toFreelancer: { type: Number, default: 0 },
      toClient: { type: Number, default: 0 },
      adminFee: { type: Number, default: 0 }
    },
    summary: {
      type: String,
      maxlength: [2000, 'Resolution summary cannot exceed 2000 characters']
    },
    proposedAt: Date,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // ── Nested Data ─────────────────────────────────────────────
  messages: [disputeMessageSchema],
  evidence: [evidenceSchema],
  financialActions: [financialActionSchema],
  adminNotes: [adminNoteSchema],

  // ── Timers ──────────────────────────────────────────────────
  deadline: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  responseDeadline: Date,  // Deadline for other party to respond
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ── Valid Status Transitions ────────────────────────────────────
const VALID_TRANSITIONS = {
  'opened':              ['needs_info', 'under_review', 'escalated', 'closed'],
  'needs_info':          ['under_review', 'escalated', 'closed'],
  'under_review':        ['needs_info', 'escalated', 'proposed_resolution', 'resolved', 'closed'],
  'escalated':           ['under_review', 'proposed_resolution', 'resolved', 'closed'],
  'proposed_resolution': ['under_review', 'resolved', 'closed'],
  'resolved':            ['closed'],
  'closed':              []  // Terminal state
};

disputeSchema.methods.canTransitionTo = function(newStatus) {
  const allowed = VALID_TRANSITIONS[this.status] || [];
  return allowed.includes(newStatus);
};

disputeSchema.methods.transitionTo = function(newStatus) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Invalid transition: ${this.status} → ${newStatus}`);
  }
  this.status = newStatus;
  this.lastActivityAt = new Date();
  return this;
};

// ── Indexes ─────────────────────────────────────────────────────
disputeSchema.index({ job: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ filedBy: 1 });
disputeSchema.index({ client: 1 });
disputeSchema.index({ freelancer: 1 });
disputeSchema.index({ 'payoutHold': 1, status: 1 });
disputeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Dispute', disputeSchema);
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
