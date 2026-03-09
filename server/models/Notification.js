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
      'job_start_requested',
      'job_started',
      'job_completed',
      'job_cancelled',
      // Bookings
      'booking_confirmed',
      'booking_cancelled',
      // Orders / Services
      'new_order',
      // Payments
      'payment_received',
      'payment_released',
      'payment_failed',
      'escrow_funded',
      // Messages
      'new_message',
      // Teams
      'team_invitation',
      'team_invitation_accepted',
      'team_invitation_declined',
      // Agency relationships
      'agency_relationship_invite',
      'agency_relationship_accepted',
      // System
      'system',
      'system_announcement',
      'account_warning',
      // Alerts & Referrals
      'job_alert',
      'referral_reward',
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

// ── Real-time push via socket ───────────────────────────────────────────────
// Runs after every Notification.create() / .save() automatically.
// Routes don't need to know about socket.io — just call Notification.create().
notificationSchema.post('save', function(doc) {
  try {
    if (global.io) {
      global.io.to(doc.recipient.toString()).emit('notification:new', {
        _id:       doc._id,
        type:      doc.type,
        title:     doc.title,
        message:   doc.message,
        link:      doc.link,
        read:      doc.read,
        createdAt: doc.createdAt
      });
    }
  } catch (err) {
    // Never let socket errors break the notification save
    console.error('[Notification] socket push failed:', err.message);
  }
});

// Static helper (wraps create with error swallowing — use in non-critical paths)
notificationSchema.statics.notify = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Notification create failed:', error.message);
    return null;
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
