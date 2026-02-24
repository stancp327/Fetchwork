const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // What dispute this relates to
  dispute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dispute',
    required: true,
    index: true
  },
  // Who performed the action
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actorRole: {
    type: String,
    enum: ['client', 'freelancer', 'admin', 'system'],
    required: true
  },
  // What happened
  action: {
    type: String,
    enum: [
      // Status changes
      'status_change',
      // Messages
      'message_sent',
      'message_sent_to_client',
      'message_sent_to_freelancer',
      'message_sent_to_both',
      // Evidence / files
      'evidence_uploaded',
      'file_viewed',
      'original_file_accessed',   // Admin viewing unwatermarked — logged + restricted
      // Financial
      'payout_hold_enabled',
      'payout_hold_removed',
      'payment_released',
      'payment_refunded',
      'payment_split',
      'admin_fee_applied',
      'stripe_action_failed',
      // Admin actions
      'admin_note_added',
      'admin_note_edited',
      'resolution_proposed',
      'resolution_executed',
      'user_suspended',
      // Lifecycle
      'dispute_opened',
      'dispute_escalated',
      'dispute_closed',
      'deadline_extended',
      'response_deadline_set'
    ],
    required: true
  },
  // Structured metadata for the action
  metadata: {
    // Status changes
    fromStatus: String,
    toStatus: String,
    // Message info
    messageId: mongoose.Schema.Types.ObjectId,
    recipientType: String,  // 'client', 'freelancer', 'both', 'admin_only'
    // File info
    filename: String,
    fileId: mongoose.Schema.Types.ObjectId,
    // Financial
    amount: Number,
    currency: { type: String, default: 'USD' },
    amountToFreelancer: Number,
    amountToClient: Number,
    adminFee: Number,
    stripeId: String,
    idempotencyKey: String,
    // Resolution
    resolutionType: String,
    // General
    reason: String,
    notes: String,
    // Previous values (for edits)
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  },
  // IP for security auditing
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ dispute: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static helper to log an event
auditLogSchema.statics.log = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    // Never let audit logging break the main flow
    console.error('Audit log failed:', error.message, data);
    return null;
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
