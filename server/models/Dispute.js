const mongoose = require('mongoose');

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
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed'],
    default: 'open'
  },
  adminNotes: {
    type: String,
    maxlength: [2000, 'Admin notes cannot exceed 2000 characters']
  },
  resolution: {
    type: String,
    enum: ['client_favor', 'freelancer_favor', 'partial_refund', 'no_action'],
    default: null
  },
  resolutionAmount: {
    type: Number,
    default: 0
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date
}, {
  timestamps: true
});

disputeSchema.index({ job: 1 });
disputeSchema.index({ status: 1 });
disputeSchema.index({ filedBy: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);
