const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      // Disputes
      'dispute_opened',
      'dispute_info_requested',
      'dispute_status_changed',
      'dispute_message_received',
      'dispute_resolution_proposed',
      'dispute_resolved',
      'dispute_escalated',
      // Jobs
      'job_proposal_received',
      'job_proposal_accepted',
      'job_completed',
      'job_cancelled',
      // Payments
      'payment_received',
      'payment_released',
      'escrow_funded',
      // Messages
      'new_message',
      // System
      'system_announcement',
      'account_warning'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  // Link to relevant resource
  link: String,
  // Related references
  relatedDispute: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' },
  relatedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  // Read status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  // Email sent?
  emailSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound index for efficient "unread notifications for user" query
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: 90 days

// Static helper
notificationSchema.statics.notify = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Notification create failed:', error.message);
    return null;
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
