const mongoose = require('mongoose');

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
  message: {
    type: String,
    required: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number
  }],
  isInternal: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const disputeSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
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
  evidence: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  messages: [disputeMessageSchema],
  status: {
    type: String,
    enum: ['open', 'under_review', 'awaiting_response', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
  },
  resolution: {
    type: String,
    enum: ['client_favor', 'freelancer_favor', 'partial_refund', 'no_action', 'mutual_agreement'],
    default: null
  },
  resolutionAmount: {
    type: Number,
    default: 0
  },
  resolutionSummary: {
    type: String,
    maxlength: [2000, 'Resolution summary cannot exceed 2000 characters']
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  deadline: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from creation
  }
}, {
  timestamps: true
});

disputeSchema.index({ job: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ filedBy: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);
