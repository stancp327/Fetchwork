const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emailType: {
    type: String,
    required: true,
    enum: ['welcome', 'verification', 'password_reset', 'job_notification', 'payment_notification', 'digest', 'onboarding']
  },
  subject: String,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'],
    default: 'sent'
  },
  resendId: String,
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  openedAt: Date,
  clickedAt: Date,
  bouncedAt: Date,
  errorMessage: String
}, {
  timestamps: true
});

emailLogSchema.index({ recipient: 1, emailType: 1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ sentAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
