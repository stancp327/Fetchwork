const mongoose = require('mongoose');

const fraudReportSchema = new mongoose.Schema({
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportType: {
    type: String,
    enum: ['fraud', 'abuse', 'spam', 'fake_profile', 'payment_dispute', 'harassment', 'inappropriate_content', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  evidence: [{
    type: {
      type: String,
      enum: ['screenshot', 'message', 'transaction', 'profile', 'other']
    },
    description: String,
    url: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  relatedJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  relatedMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  relatedPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  adminNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    action: {
      type: String,
      enum: ['no_action', 'warning', 'temporary_suspension', 'permanent_ban', 'account_restriction', 'other']
    },
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date
}, {
  timestamps: true
});

fraudReportSchema.index({ reportedUser: 1, status: 1 });
fraudReportSchema.index({ reportedBy: 1 });
fraudReportSchema.index({ status: 1, priority: 1 });
fraudReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FraudReport', fraudReportSchema);
