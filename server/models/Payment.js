const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    required: true,
    min: 0
  },
  freelancerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'escrowed', 'released', 'refunded', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'paypal', 'bank_transfer'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  escrowedAt: Date,
  releasedAt: Date,
  refundedAt: Date,
  coolingOffPeriod: {
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: false
    }
  },
  dispute: {
    isDisputed: {
      type: Boolean,
      default: false
    },
    disputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    disputeReason: String,
    disputedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolution: String,
    resolvedAt: Date
  },
  adminOverride: {
    overriddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    overriddenAt: Date,
    originalStatus: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    paymentGatewayResponse: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

paymentSchema.index({ job: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ freelancer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ transactionId: 1 });

paymentSchema.methods.calculatePlatformFee = function() {
  const feePercentage = 0.05; // 5% platform fee
  return Math.round(this.amount * feePercentage * 100) / 100;
};

paymentSchema.methods.calculateFreelancerAmount = function() {
  return this.amount - this.platformFee;
};

paymentSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('amount')) {
    this.platformFee = this.calculatePlatformFee();
    this.freelancerAmount = this.calculateFreelancerAmount();
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
